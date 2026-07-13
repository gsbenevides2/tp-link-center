import type { CheckModel } from "@/server/modules/checks/model";
import { db } from "@/server/db";
import { onlineChecks, onlineDevicesChecks } from "@/server/db/schema";
import { desc, and, gte, lte, inArray } from "drizzle-orm";

export abstract class Check {
  static async getLatest(): Promise<CheckModel["getLatestCheckResponse"]> {
    const latestCheck = await db.query.onlineChecks.findFirst({
      orderBy: (fields, { desc }) => desc(fields.createdAt),
    });

    if (!latestCheck) {
      throw new Error("No checks found");
    }

    const devices = await db.query.onlineDevicesChecks.findMany({
      where: { checkId: latestCheck.id },
    });

    return {
      id: latestCheck.id,
      createdAt: latestCheck.createdAt.getTime(),
      devices: devices.map((d) => ({
        id: d.id,
        mac: d.mac,
        ip: d.ip,
        vendor: d.vendor,
        name: d.name,
        checkId: d.checkId,
        routerInterface: d.routerInterface,
      })),
    };
  }

  static async getDeviceHistory(
    params: { id: string },
    query: CheckModel["getDeviceHistoryQuery"],
  ): Promise<CheckModel["getDeviceHistoryResponse"]> {
    const deviceInterfaces = await db.query.interfaces.findMany({
      where: { deviceId: params.id },
      columns: { mac: true, name: true },
    });

    const deviceMacs = deviceInterfaces.map((i) => i.mac);
    const macToName = new Map(deviceInterfaces.map((i) => [i.mac, i.name]));

    const checks = await db
      .select()
      .from(onlineChecks)
      .where(
        and(
          gte(onlineChecks.createdAt, new Date(query.from)),
          lte(onlineChecks.createdAt, new Date(query.to)),
        ),
      )
      .orderBy(desc(onlineChecks.createdAt));

    if (checks.length === 0) {
      return [];
    }

    const checkIds = checks.map((c) => c.id);

    const onlineDeviceChecks =
      deviceMacs.length > 0
        ? await db
            .select()
            .from(onlineDevicesChecks)
            .where(
              and(
                inArray(onlineDevicesChecks.checkId, checkIds),
                inArray(onlineDevicesChecks.mac, deviceMacs),
              ),
            )
        : [];

    const onlineByCheck = new Map<string, Set<string>>();
    const routerInterfaceByCheckMac = new Map<string, string>();
    for (const odc of onlineDeviceChecks) {
      if (!onlineByCheck.has(odc.checkId)) {
        onlineByCheck.set(odc.checkId, new Set());
      }
      onlineByCheck.get(odc.checkId)!.add(odc.mac);
      routerInterfaceByCheckMac.set(
        `${odc.checkId}:${odc.mac}`,
        odc.routerInterface ?? "Unknown",
      );
    }

    return checks.map((check) => {
      const onlineMacs = onlineByCheck.get(check.id) ?? new Set();
      return {
        checkId: check.id,
        createdAt: check.createdAt.getTime(),
        online: onlineMacs.size > 0,
        interfaces: Array.from(onlineMacs).map((mac) => ({
          mac,
          name: macToName.get(mac) ?? mac,
          routerInterface:
            routerInterfaceByCheckMac.get(`${check.id}:${mac}`) ?? "",
        })),
      };
    });
  }
}
