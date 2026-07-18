import { performOnlineCheck } from "./server/cron";
import { Settings } from "./server/modules/settings/service";

export async function register() {
  const cronEnabled = await Settings.getCronEnabled();
  if (!cronEnabled) {
    console.log("[cron] Cron is disabled. Skipping initial check.");
  } else {
    await performOnlineCheck();
  }

  Bun.cron("*/5 * * * *", async () => {
    const enabled = await Settings.getCronEnabled();
    if (!enabled) {
      console.log("[cron] Cron is disabled. Skipping...");
      return;
    }
    await performOnlineCheck();
  });
}
