import type { CheckModel } from "@/server/modules/checks/model";
import { db } from "@/server/db";
import { interfaces, onlineChecks, onlineDevicesChecks } from "@/server/db/schema";
import { desc, eq, and, gte, lte, inArray } from "drizzle-orm";

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
      })),
    };
  }

  static async getDeviceHistory(
    params: { id: string },
    query: CheckModel["getDeviceHistoryQuery"],
  ): Promise<CheckModel["getDeviceHistoryResponse"]> {
    const deviceInterfaces = await db.query.interfaces.findMany({
      where: { deviceId: params.id },
      columns: { mac: true },
    });

    const deviceMacs = deviceInterfaces.map((i) => i.mac);

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

    const onlineCheckIds = new Set(onlineDeviceChecks.map((c) => c.checkId));

    return checks.map((check) => ({
      checkId: check.id,
      createdAt: check.createdAt.getTime(),
      online: onlineCheckIds.has(check.id),
    }));
  }
}
