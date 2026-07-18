import { onlineChecks, onlineDevicesChecks } from "@/server/db/schema";
import { createSelectSchema } from "drizzle-orm/zod";
import { type UnwrapSchema } from "elysia";
import z from "zod";

export const CheckModel = {
  // Get Latest Check
  getLatestCheckResponse: createSelectSchema(onlineChecks, {
    id: () =>
      z.string().uuid().meta({
        title: "Check ID",
        description: "ID of the online check.",
        example: crypto.randomUUID(),
      }),
    createdAt: () =>
      z.number().int().meta({
        title: "Created At",
        description: "Timestamp in milliseconds when the check was created.",
        example: 1700000000000,
      }),
  })
    .extend({
      devices: z
        .array(
          createSelectSchema(onlineDevicesChecks, {
            id: () =>
              z.uuid().meta({
                title: "Online Device Check ID",
                description: "ID of the online device check entry.",
                example: crypto.randomUUID(),
              }),
            mac: () =>
              z.mac().meta({
                title: "MAC Address",
                description: "MAC address of the connected device.",
                example: "00:1A:2B:3C:4D:5E",
              }),
            ip: () =>
              z.ipv4().meta({
                title: "IP Address",
                description: "IP address of the connected device.",
                example: "192.168.1.100",
              }),
            vendor: () =>
              z.string().meta({
                title: "Vendor",
                description: "Vendor name resolved from MAC OUI.",
                example: "TP-Link",
              }),
            name: () =>
              z.string().meta({
                title: "Name",
                description: "Device name from DB or router.",
                example: "Meu-PC",
              }),
            checkId: () =>
              z.uuid().meta({
                title: "Check ID",
                description: "ID of the check this entry belongs to.",
                example: crypto.randomUUID(),
              }),
            routerInterface: () =>
              z.string().meta({
                title: "Router Interface",
                description:
                  "The router interface where the device was found, mapped from 'Teste de Conexão'.",
                example: "Wifi 2.4 GHz no Canal 10",
              }),
          }),
        )
        .meta({
          title: "Online Devices",
          description: "List of devices that were online during this check.",
        }),
    })
    .meta({
      title: "Latest Check",
      description: "The most recent online check with its connected devices.",
    }),

  // Trigger Online Check
  triggerCheckResponse: z
    .object({
      success: z.boolean().meta({
        title: "Success",
        description: "Whether the check was triggered successfully.",
        example: true,
      }),
    })
    .meta({
      title: "Trigger Check Response",
      description: "Response after manually triggering an online check.",
    }),

  // Get Device History
  getDeviceHistoryParams: z.object({
    id: z.uuid().meta({
      title: "Device ID",
      description: "ID of device to get history for.",
      example: crypto.randomUUID(),
    }),
  }),

  getDeviceHistoryQuery: z.object({
    from: z.coerce.number().int().meta({
      title: "From",
      description: "Start timestamp in milliseconds.",
      example: 1700000000000,
    }),
    to: z.coerce.number().int().meta({
      title: "To",
      description: "End timestamp in milliseconds.",
      example: 1700100000000,
    }),
  }),

  getDeviceHistoryResponse: z
    .array(
      z.object({
        checkId: z.uuid().meta({
          title: "Check ID",
          description: "ID of the check.",
          example: crypto.randomUUID(),
        }),
        createdAt: z.number().int().meta({
          title: "Created At",
          description: "Timestamp in milliseconds of the check.",
          example: 1700000000000,
        }),
        online: z.boolean().meta({
          title: "Online",
          description:
            "Whether any interface of the device was found online in this check.",
          example: true,
        }),
        interfaces: z
          .array(
            z.object({
              mac: z.string().meta({
                title: "MAC Address",
                description: "MAC address of the interface.",
                example: "00:1A:2B:3C:4D:5E",
              }),
              name: z.string().meta({
                title: "Name",
                description: "Name of the interface.",
                example: "LAN1",
              }),
              routerInterface: z.string().meta({
                title: "Router Interface",
                description:
                  "The router interface where the device was found, mapped from 'Teste de Conexão'.",
                example: "Wifi 2.4 GHz no Canal 10",
              }),
            }),
          )
          .meta({
            title: "Online Interfaces",
            description: "List of interfaces that were online in this check.",
          }),
      }),
    )
    .meta({
      title: "Device History",
      description:
        "List of checks in the given period with online status and interfaces for the device.",
    }),
} as const;

export type CheckModel = {
  [k in keyof typeof CheckModel]: UnwrapSchema<(typeof CheckModel)[k]>;
};
