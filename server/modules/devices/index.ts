import { Elysia, status, StatusMap } from "elysia";
import { DeviceModel } from "@/server/modules/devices/model";
import { Device } from "@/server/modules/devices/service";

export const device = new Elysia({
  prefix: "/devices",
  detail: {
    tags: ["Device"],
  },
})
  .get(
    "/",
    async () => {
      return status(StatusMap.OK, await Device.get());
    },
    {
      detail: {
        summary: "List Devices",
        description: "List registred devices with our interfaces.",
      },
      response: {
        [StatusMap.OK]: DeviceModel.getResponse,
      },
    },
  )
  .post(
    "/",
    async ({ body }) => {
      const response = await Device.create(body);
      return status(StatusMap.Created, response);
    },
    {
      detail: {
        summary: "Create Device",
        description: "Create Device with name.",
      },
      body: DeviceModel.createBody,
      response: {
        [StatusMap.Created]: DeviceModel.createReponse,
      },
    },
  )
  .delete(
    "/:id",
    async ({ params }) => {
      await Device.delete(params);
    },
    {
      detail: {
        summary: "Delete Device",
        description: "Delete a device and all our interfaces.",
      },
      params: DeviceModel.deleteParams,
    },
  );
