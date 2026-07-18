import { settings } from "@/server/db/schema";
import { createSelectSchema } from "drizzle-orm/zod";
import { type UnwrapSchema } from "elysia";
import z from "zod";

export const SettingsModel = {
  getKeyParams: z.object({
    key: z.enum(["cron_enabled"]).meta({
      title: "Setting Key",
      description: "Key of the setting to update.",
      example: "cron_enabled",
    }),
  }),
  updateBody: z.object({
    value: z.string().meta({
      title: "Setting Value",
      description: "Value to set for the setting.",
      example: "true",
    }),
  }),
  getResponse: createSelectSchema(settings, {
    key: (schema) =>
      schema.meta({
        title: "Setting Key",
        description: "Key of the setting.",
        example: "cron_enabled",
      }),
    value: (schema) =>
      schema.meta({
        title: "Setting Value",
        description: "Value of the setting.",
        example: "true",
      }),
  }).meta({
    title: "Setting",
    description: "A configuration setting.",
  }),
  getResponseArray: z
    .array(
      createSelectSchema(settings, {
        key: (schema) =>
          schema.meta({
            title: "Setting Key",
            description: "Key of the setting.",
            example: "cron_enabled",
          }),
        value: (schema) =>
          schema.meta({
            title: "Setting Value",
            description: "Value of the setting.",
            example: "true",
          }),
      }),
    )
    .meta({
      title: "Settings List",
      description: "List of all configuration settings.",
    }),
} as const;

export type SettingsModel = {
  [k in keyof typeof SettingsModel]: UnwrapSchema<(typeof SettingsModel)[k]>;
};
