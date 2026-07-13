import { performOnlineCheck } from "./server/cron";

export async function register() {
  await performOnlineCheck();
  Bun.cron("*/5 * * * *", async () => {
    await performOnlineCheck();
  });
}
