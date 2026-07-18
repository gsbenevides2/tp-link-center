import type { DeviceModel } from "@/server/modules/devices/model";
import { db } from "@/server/db";
import { devices, interfaces } from "@/server/db/schema";
import { eq } from "drizzle-orm";

export abstract class Device {
  static async get(): Promise<DeviceModel["getResponse"]> {
    const devices = await db.query.devices.findMany({
      with: {
        interfaces: true,
      },
    });
    return devices;
  }
  static async create(
    params: DeviceModel["createBody"],
  ): Promise<DeviceModel["createReponse"]> {
    if (params.type === "router" && params.isController) {
      await db
        .update(devices)
        .set({ isController: false })
        .where(eq(devices.isController, true));
    }

    const createdDevice = await db.insert(devices).values(params).returning();
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
    if (body.type === "router" && body.isController) {
      await db
        .update(devices)
        .set({ isController: false })
        .where(eq(devices.isController, true));
    }

    await db.update(devices).set(body).where(eq(devices.id, params.id));
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
    await db
      .update(interfaces)
      .set(body)
      .where(eq(interfaces.id, params.interfaceId));
  }
  static async deleteInterface(
    params: DeviceModel["deleteInterfaceParams"],
  ) {
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
      password: controller.routerPassword,
    };
  }
}
