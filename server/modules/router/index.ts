import { Elysia, status, StatusMap } from "elysia";
import z from "zod";
import { Router } from "@/server/modules/router/service";
import { RouterModel } from "./model";

export const router = new Elysia({
  prefix: "/router",
  detail: {
    tags: ["Router"],
  },
})
  .get(
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
  )
  .get(
    "/dhcp",
    async () => {
      return status(StatusMap.OK, await Router.listDHCPEntry());
    },
    {
      detail: {
        summary: "List DHCP Static Entries",
        description: "List all static DHCP entries configured on the router.",
      },
      response: {
        [StatusMap.OK]: RouterModel.listDHCPEntryResponse,
      },
    },
  )
  .post(
    "/dhcp",
    async ({ body }) => {
      const entryId = await Router.addDHCPEntry(body.mac, body.ip);
      return status(StatusMap.OK, {
        entryId,
        mac: body.mac,
        ip: body.ip,
      });
    },
    {
      detail: {
        summary: "Add DHCP Static Entry",
        description:
          "Add a new static DHCP entry to assign a fixed IP to a device by MAC.",
      },
      body: RouterModel.addDHCPEntryRequest,
      response: {
        [StatusMap.OK]: RouterModel.dhcpEntryResponse,
      },
    },
  )
  .delete(
    "/dhcp/:id",
    async ({ params }) => {
      await Router.removeDHCPEntry(params.id);
      return status(StatusMap.NoContent);
    },
    {
      detail: {
        summary: "Remove DHCP Static Entry",
        description: "Remove a static DHCP entry by its stack ID.",
      },
      params: z.object({
        id: z.string().meta({
          title: "Entry ID",
          description: "Stack ID of the DHCP entry to remove.",
        }),
      }),
      response: {
        [StatusMap.NoContent]: z.void(),
      },
    },
  );
