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

    const created = await db
      .insert(interfaces)
      .values({ ...body, deviceId })
      .returning();
    const id = created.at(0)?.id;
    if (!id) throw Error("Id not generated");
    return { id };
  }
  static async getDeviceNameOfMac(mac: string): Promise<string | undefined> {
    const dbInterface = await db.query.interfaces.findFirst({
      columns: {},
      where: {
        mac,
      },
      with: {
        devices: {
          columns: {
            name: true,
          },
        },
      },
    });

    return dbInterface?.devices?.name;
  }
}
