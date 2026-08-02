import { Elysia, status, StatusMap } from "elysia";
import { SettingsModel } from "@/server/modules/settings/model";
import { Settings } from "@/server/modules/settings/service";

export const settingsModule = new Elysia({
  prefix: "/settings",
  detail: {
    tags: ["Settings"],
  },
}).get(
  "/latest-router-status",
  async () => {
    return status(StatusMap.OK, await Settings.getStatus());
  },
  {
    detail: {
      summary: "Get Router Status",
      description:
        "Get current router status including WAN IP, uptime, and performance metrics.",
    },
    response: {
      [StatusMap.OK]: SettingsModel.getLatestRouterStatusResponse,
    },
  },
);
