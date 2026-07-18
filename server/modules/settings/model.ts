import { z } from "zod/v4";

const settingKeySchema = z.enum(["cron_enabled"]);

const settingValueSchema = z.string();

export const SettingsModel = {
  getKeyParams: z.object({
    key: settingKeySchema,
  }),
  updateBody: z.object({
    value: settingValueSchema,
  }),
  getResponse: z.object({
    key: z.string(),
    value: z.string(),
  }),
  getResponseArray: z.array(
    z.object({
      key: z.string(),
      value: z.string(),
    }),
  ),
};

export type SettingsModel = {
  getKeyParams: z.infer<typeof SettingsModel.getKeyParams>;
  updateBody: z.infer<typeof SettingsModel.updateBody>;
  getResponse: z.infer<typeof SettingsModel.getResponse>;
};
