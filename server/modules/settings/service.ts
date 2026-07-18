import { db } from "@/server/db";
import { settings } from "@/server/db/schema";
import type { SettingsModel } from "@/server/modules/settings/model";

export abstract class Settings {
  static async get(key: string): Promise<SettingsModel["getResponse"] | null> {
    const setting = await db.query.settings.findFirst({
      where: { key },
    });
    return setting ?? null;
  }

  static async getAll(): Promise<SettingsModel["getResponse"][]> {
    return await db.query.settings.findMany();
  }

  static async set(
    key: string,
    value: string,
  ): Promise<SettingsModel["getResponse"]> {
    await db
      .insert(settings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: settings.key,
        set: { value },
      });
    return { key, value };
  }

  static async getCronEnabled(): Promise<boolean> {
    const setting = await Settings.get("cron_enabled");
    return setting?.value === "true";
  }
}
