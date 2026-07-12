import { Elysia, status, StatusMap } from "elysia";
import { Router } from "@/server/modules/router/service";
import { RouterModel } from "./model";

export const router = new Elysia({
  prefix: "/router",
  detail: {
    tags: ["Router"],
  },
}).get(
  "/connected-devices",
  async () => {
    return status(StatusMap.OK, await Router.getConnectedDevices());
  },
  {
    detail: {
      summary: "Get Connected Devices",
      description:
        "This call scrapping in router web interface to get connected devices.",
    },
    response: {
      [StatusMap.OK]: RouterModel.getConnectedDevicesResponse,
    },
  },
);
