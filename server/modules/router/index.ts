import { Elysia, status, StatusMap } from "elysia";
import z from "zod";
import { RouterModel } from "./model";
import { Router } from "./service";

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
      return status(StatusMap["No Content"]);
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
        [StatusMap["No Content"]]: z.void(),
      },
    },
  )
  .get(
    "/firewall/chains",
    async () => {
      return status(StatusMap.OK, await Router.listFirewallChains());
    },
    {
      detail: {
        summary: "List Firewall Chains",
        description: "List all firewall chains on the router.",
      },
      response: {
        [StatusMap.OK]: RouterModel.firewallChainResponse,
      },
    },
  )
  .get(
    "/firewall/rules",
    async () => {
      return status(StatusMap.OK, await Router.listFirewallRules());
    },
    {
      detail: {
        summary: "List Firewall Rules",
        description: "List all rules in a specific firewall chain.",
      },
      response: {
        [StatusMap.OK]: RouterModel.firewallRuleResponse,
      },
    },
  )
  .post(
    "/firewall/rules",
    async ({ body }) => {
      const stack = await Router.addFirewallRule(body);
      return status(StatusMap.OK, { stack });
    },
    {
      detail: {
        summary: "Add Firewall Rule",
        description:
          "Add a new firewall rule to block or reject traffic by MAC/IP.",
      },
      body: RouterModel.addFirewallRuleRequest,
      response: {
        [StatusMap.OK]: RouterModel.firewallRuleCreatedResponse,
      },
    },
  )
  .delete(
    "/firewall/rules/:id",
    async ({ params }) => {
      await Router.removeFirewallRule(params.id);
      return status(StatusMap["No Content"]);
    },
    {
      detail: {
        summary: "Remove Firewall Rule",
        description: "Remove a firewall rule by its stack ID.",
      },
      params: z.object({
        id: z.string().meta({
          title: "Rule Stack ID",
          description: "Stack ID of the firewall rule to remove.",
        }),
      }),
      response: {
        [StatusMap["No Content"]]: z.void(),
      },
    },
  )
  .post(
    "/restart-network",
    async () => {
      await Router.restartNetwork();
      return status(StatusMap.OK, { success: true });
    },
    {
      detail: {
        summary: "Restart Network",
        description:
          "Restart all routers in the network. Agents are restarted first, then the controller.",
      },
      response: {
        [StatusMap.OK]: z.object({
          success: z.boolean().meta({
            title: "Success",
            description: "Whether the restart was successful.",
          }),
        }),
      },
    },
  );
