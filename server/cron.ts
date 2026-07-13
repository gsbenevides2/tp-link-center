import { Router } from "@/server/modules/router/service";
import { db } from "@/server/db";
import { onlineChecks, onlineDevicesChecks } from "@/server/db/schema";

export async function performOnlineCheck() {
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
