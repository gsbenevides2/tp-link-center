import type { DeviceModel } from "@/server/modules/devices/model";
import { db } from "@/server/db";
import { devices, interfaces } from "@/server/db/schema";
import { eq } from "drizzle-orm";
import { encryptPassword, decryptPassword } from "@/server/utils/crypto";

export abstract class Device {
  static async get(): Promise<DeviceModel["getResponse"]> {
    const devices = await db.query.devices.findMany({
      with: {
        interfaces: true,
      },
    });
    return devices.map((device) => ({
      ...device,
      routerPassword: undefined,
    }));
  }
  static async create(
    params: DeviceModel["createBody"],
  ): Promise<DeviceModel["createReponse"]> {
    const createdDevice = await db.transaction(async (tx) => {
      if (params.type === "router" && params.isController) {
        await tx
          .update(devices)
          .set({ isController: false })
          .where(eq(devices.isController, true));
      }

      const encryptedPassword = params.routerPassword
        ? await encryptPassword(params.routerPassword)
        : null;

      return tx
        .insert(devices)
        .values({
          ...params,
          routerPassword: encryptedPassword,
        })
        .returning();
    });
    const id = createdDevice.at(0)?.id;
    if (!id) throw Error("Id not generated");
    return {
      id,
    };
  }
  static async delete(params: DeviceModel["deleteParams"]) {
    await db.delete(interfaces).where(eq(interfaces.deviceId, params.id));
    await db.delete(devices).where(eq(devices.id, params.id));
  }
  static async update(
    params: DeviceModel["updateParams"],
    body: DeviceModel["updateBody"],
  ) {
    await db.transaction(async (tx) => {
      if (body.type === "router" && body.isController) {
        await tx
          .update(devices)
          .set({ isController: false })
          .where(eq(devices.isController, true));
      }

      const encryptedPassword = body.routerPassword
        ? encryptPassword(body.routerPassword)
        : body.routerPassword === null
          ? null
          : undefined;

      const updateData: Record<string, unknown> = { ...body };
      if (encryptedPassword !== undefined) {
        updateData.routerPassword = encryptedPassword;
      }

      await tx.update(devices).set(updateData).where(eq(devices.id, params.id));
    });
  }
  static async createInterface(
    deviceId: string,
    body: DeviceModel["createInterfaceBody"],
  ): Promise<DeviceModel["createInterfaceResponse"]> {
    const device = await db.query.devices.findFirst({
      where: { id: deviceId },
    });
    if (!device) throw new Error("Device not found");

    if (device.type === "router") {
      const existingInterface = await db.query.interfaces.findFirst({
        where: { deviceId },
      });
      if (existingInterface) {
        throw new Error("Router devices can only have one interface");
      }
    }

    const created = await db
      .insert(interfaces)
      .values({ ...body, deviceId })
      .returning();
    const id = created.at(0)?.id;
    if (!id) throw Error("Id not generated");
    return { id };
  }
  static async updateInterface(
    params: DeviceModel["updateInterfaceParams"],
    body: DeviceModel["updateInterfaceBody"],
  ) {
    const device = await db.query.devices.findFirst({
      where: { id: params.id },
    });

    if (device?.type === "router" && device.isController) {
      throw new Error("Controller router interface cannot be edited");
    }

    if (device?.type === "router") {
      const allowedFields: Record<string, unknown> = {};
      if (body.ip !== undefined) allowedFields.ip = body.ip;
      if (body.reservedIp !== undefined)
        allowedFields.reservedIp = body.reservedIp;

      await db
        .update(interfaces)
        .set(allowedFields)
        .where(eq(interfaces.id, params.interfaceId));
    } else {
      await db
        .update(interfaces)
        .set(body)
        .where(eq(interfaces.id, params.interfaceId));
    }
  }
  static async deleteInterface(params: DeviceModel["deleteInterfaceParams"]) {
    await db.delete(interfaces).where(eq(interfaces.id, params.interfaceId));
  }
  static async getDeviceNameOfMac(mac: string): Promise<string | undefined> {
    const dbInterface = await db.query.interfaces.findFirst({
      columns: {},
      where: {
        mac,
      },
      with: {
        device: {
          columns: {
            name: true,
          },
        },
      },
    });

    return dbInterface?.device?.name;
  }
  static async getControllerRouter(): Promise<{
    id: string;
    name: string;
    ip: string;
    password: string;
  } | null> {
    const controller = await db.query.devices.findFirst({
      where: { type: "router", isController: true },
      with: {
        interfaces: true,
      },
    });

    if (!controller || !controller.routerPassword) return null;
    if (controller.interfaces.length === 0) return null;

    return {
      id: controller.id,
      name: controller.name,
      ip: controller.interfaces[0].ip,
      password: await decryptPassword(controller.routerPassword),
    };
  }

  static async getAllRouters() {
    const devices = await db.query.devices.findMany({
      columns: {
        isController: true,
        routerPassword: true,
      },
      where: {
        type: "router",
      },
      with: {
        interfaces: {
          columns: {
            ip: true,
          },
        },
      },
    });

    const routersPromise = devices.map(async (d) => ({
      ip: d.interfaces.at(0)?.ip,
      password: d.routerPassword
        ? await decryptPassword(d.routerPassword)
        : undefined,
      isController: d.isController,
    }));

    const routerInitialList = await Promise.all(routersPromise);
    const routers = routerInitialList.filter((d) => d.ip && d.password) as {
      ip: string;
      password: string;
      isController: boolean;
    }[];

    return routers;
  }
}
