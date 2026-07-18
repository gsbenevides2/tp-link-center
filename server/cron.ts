import { Router } from "@/server/modules/router/service";
import { db } from "@/server/db";
import { onlineChecks, onlineDevicesChecks } from "@/server/db/schema";
import { Settings } from "@/server/modules/settings/service";

export async function performOnlineCheck() {
  const cronEnabled = await Settings.getCronEnabled();
  if (!cronEnabled) {
    console.log("[cron] Online check is disabled. Skipping...");
    return;
  }

  console.log("[cron] Starting online check...");

  try {
    const devices = await Router.getConnectedDevices();

    const checkId = crypto.randomUUID();

    await db.insert(onlineChecks).values({
      id: checkId,
      createdAt: new Date(),
    });

    if (devices.length > 0) {
      await db.insert(onlineDevicesChecks).values(
        devices.map((d) => ({
          mac: d.mac,
          ip: d.ip,
          checkId,
          name: d.name,
          vendor: d.vendor,
          routerInterface: d.routerInterface,
        })),
      );
    }

    console.log(
      `[cron] Online check completed. ${devices.length} device(s) found.`,
    );
  } catch (error) {
    console.error("[cron] Online check failed:", error);
  }
}
