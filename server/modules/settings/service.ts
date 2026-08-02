import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import type { SettingsModel } from "@/server/modules/settings/model";
import { sql } from "drizzle-orm";

export abstract class Settings {
  static async saveStatus(
    status: Partial<SettingsModel["getLatestRouterStatusResponse"]>,
  ) {
    const entries = Object.entries(status).map(([key, value]) => ({
      key,
      value: value !== null ? String(value) : "",
    }));

    await db
      .insert(settings)
      .values(entries)
      .onConflictDoUpdate({
        target: settings.key,
        set: {
          value: sql`EXCLUDED.value`,
        },
      });
  }
  static async getStatus(): Promise<
    SettingsModel["getLatestRouterStatusResponse"]
  > {
    const dbResponse = await db.query.settings.findMany({
      where: {
        key: {
          in: [
            "wanIp",
            "connectionStatus",
            "connectionUptime",
            "routerUptime",
            "firmwareVersion",
            "hardwareVersion",
            "cpuUsage",
            "memoryUsage",
            "totalDownload",
            "totalUpload",
          ],
        },
      },
    });

    const settingsMap = new Map(
      dbResponse.map((setting) => [setting.key, setting.value]),
    );

    return {
      wanIp: settingsMap.get("wanIp") ?? "",
      connectionStatus: settingsMap.get("connectionStatus") ?? "",
      connectionUptime: settingsMap.get("connectionUptime") ?? "",
      routerUptime: settingsMap.get("routerUptime") ?? "",
      firmwareVersion: settingsMap.get("firmwareVersion") ?? "",
      hardwareVersion: settingsMap.get("hardwareVersion") ?? "",
      cpuUsage: settingsMap.has("cpuUsage")
        ? Number(settingsMap.get("cpuUsage"))
        : null,
      memoryUsage: settingsMap.has("memoryUsage")
        ? Number(settingsMap.get("memoryUsage"))
        : null,
      totalDownload: settingsMap.get("totalDownload") ?? null,
      totalUpload: settingsMap.get("totalUpload") ?? null,
    };
  }
}
