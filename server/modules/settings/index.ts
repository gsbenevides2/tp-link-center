import { Elysia, status, StatusMap } from "elysia";
import { SettingsModel } from "@/server/modules/settings/model";
import { Settings } from "@/server/modules/settings/service";

export const settingsModule = new Elysia({
  prefix: "/settings",
  detail: {
    tags: ["Settings"],
  },
})
  .get(
    "/",
    async () => {
      return status(StatusMap.OK, await Settings.getAll());
    },
    {
      detail: {
        summary: "List Settings",
        description: "List all settings.",
      },
      response: {
        [StatusMap.OK]: SettingsModel.getResponseArray,
      },
    },
  )
  .put(
    "/:key",
    async ({ params, body }) => {
      const result = await Settings.set(params.key, body.value);
      return status(StatusMap.OK, result);
    },
    {
      detail: {
        summary: "Update Setting",
        description: "Update a setting by key.",
      },
      params: SettingsModel.getKeyParams,
      body: SettingsModel.updateBody,
      response: {
        [StatusMap.OK]: SettingsModel.getResponse,
      },
    },
  );
