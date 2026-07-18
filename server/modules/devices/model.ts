import { devices, interfaces } from "@/server/db/schema";
import { createInsertSchema, createSelectSchema } from "drizzle-orm/zod";
import { type UnwrapSchema } from "elysia";
import z from "zod";

const deviceTypeSchema = z.enum(["router", "client"]).meta({
  title: "Device Type",
  description: "Type of device (router or client).",
  example: "client",
});

export const DeviceModel = {
  // Get Devices
  getResponse: z
    .array(
      createSelectSchema(devices, {
        id: () =>
          z.uuid().meta({
            title: "Device ID",
            description: "Id of Device.",
            example: crypto.randomUUID(),
          }),
        name: (schema) =>
          schema.meta({
            title: "Device Name",
            description: "Name of Device.",
            example: "Switch",
          }),
        brand: (schema) =>
          schema.meta({
            title: "Device Brand",
            description: "Brand of Device.",
            example: "Cisco",
          }),
        type: () =>
          deviceTypeSchema,
        isController: (schema) =>
          schema.meta({
            title: "Is Controller",
            description: "Whether this router is the controller.",
            example: false,
          }),
        routerPassword: (schema) =>
          schema.meta({
            title: "Router Password",
            description: "Password for router web admin (only for routers).",
            example: "password123",
          }),
      }).extend({
        interfaces: z
          .array(
            createSelectSchema(interfaces, {
              id: () =>
                z.uuid().meta({
                  title: "Interface ID",
                  description: "Id of network interface.",
                  example: crypto.randomUUID(),
                }),
              name: (schema) =>
                schema.meta({
                  title: "Interface Name",
                  description: "Name of network interface.",
                  example: "GigabitEthernet0/1",
                }),
              mac: () =>
                z.mac().meta({
                  title: "MAC Address",
                  description: "MAC address of interface.",
                  example: "00:1A:2B:3C:4D:5E",
                }),
              ip: () =>
                z.ipv4().meta({
                  title: "IP Address",
                  description: "IP address of interface.",
                  example: "192.168.1.1",
                }),
              deviceId: () =>
                z.uuid().meta({
                  title: "Device ID",
                  description: "ID of the device this interface belongs to.",
                  example: crypto.randomUUID(),
                }),
              reservedIp: (schema) =>
                schema.meta({
                  title: "Reserved IP",
                  description: "Whether the IP address is reserved for this interface.",
                  example: false,
                }),
              allowList: (schema) =>
                schema.meta({
                  title: "Allow List",
                  description: "Whether the interface is in the allow list.",
                  example: false,
                }),
            }),
          )
          .meta({
            title: "Interface List",
            description: "List of Device Network Interfaces.",
          }),
      }),
    )
    .meta({
      title: "Device List",
      description: "List of registred devices.",
    }),
  // Create Device
  createBody: createInsertSchema(devices, {
    name: (schema) =>
      schema.meta({
        title: "Name of Device",
        description: "Name of device to save.",
        example: "Switch",
      }),
    brand: (schema) =>
      schema.meta({
        title: "Brand of Device",
        description: "Brand of device to save.",
        example: "Cisco",
      }),
    type: () =>
      deviceTypeSchema,
    isController: (schema) =>
      schema.meta({
        title: "Is Controller",
        description: "Whether this router is the controller.",
        example: false,
      }),
    routerPassword: (schema) =>
      schema.meta({
        title: "Router Password",
        description: "Password for router web admin (only for routers).",
        example: "password123",
      }),
  }).omit({ id: true }),
  createReponse: createSelectSchema(devices, {
    id: () =>
      z.uuid().meta({
        title: "Device ID",
        description: "ID of device created.",
        example: crypto.randomUUID(),
      }),
  }).pick({ id: true }),
  // Delete Device
  deleteParams: createSelectSchema(devices, {
    id: () =>
      z.uuid().meta({
        title: "Device ID",
        description: "ID of device to delete.",
        example: crypto.randomUUID(),
      }),
  }).pick({ id: true }),
  // Update Device
  updateParams: createSelectSchema(devices, {
    id: () =>
      z.uuid().meta({
        title: "Device ID",
        description: "ID of device to update.",
        example: crypto.randomUUID(),
      }),
  }).pick({ id: true }),
  updateBody: createInsertSchema(devices, {
    name: (schema) =>
      schema.meta({
        title: "Name of Device",
        description: "New name of device.",
        example: "Switch",
      }),
    brand: (schema) =>
      schema.meta({
        title: "Brand of Device",
        description: "New brand of device.",
        example: "Cisco",
      }),
    type: () =>
      deviceTypeSchema,
    isController: (schema) =>
      schema.meta({
        title: "Is Controller",
        description: "Whether this router is the controller.",
        example: false,
      }),
    routerPassword: (schema) =>
      schema.meta({
        title: "Router Password",
        description: "Password for router web admin (only for routers).",
        example: "password123",
      }),
  }).omit({ id: true }),
  // Create Interface
  createInterfaceParams: createSelectSchema(devices, {
    id: () =>
      z.uuid().meta({
        title: "Device ID",
        description: "ID of device to add interface.",
        example: crypto.randomUUID(),
      }),
  }).pick({ id: true }),
  createInterfaceBody: createInsertSchema(interfaces, {
    name: (schema) =>
      schema.meta({
        title: "Interface Name",
        description: "Name of network interface.",
        example: "GigabitEthernet0/1",
      }),
    mac: () =>
      z.mac().meta({
        title: "MAC Address",
        description: "MAC address of interface.",
        example: "00:1A:2B:3C:4D:5E",
      }),
    ip: () =>
      z.ipv4().meta({
        title: "IP Address",
        description: "IP address of interface.",
        example: "192.168.1.1",
      }),
    reservedIp: (schema) =>
      schema.meta({
        title: "Reserved IP",
        description: "Whether the IP address is reserved for this interface.",
        example: false,
      }),
    allowList: (schema) =>
      schema.meta({
        title: "Allow List",
        description: "Whether the interface is in the allow list.",
        example: false,
      }),
  }).omit({ id: true, deviceId: true }),
  createInterfaceResponse: createSelectSchema(interfaces, {
    id: () =>
      z.uuid().meta({
        title: "Interface ID",
        description: "ID of interface created.",
        example: crypto.randomUUID(),
      }),
  }).pick({ id: true }),
  // Update Interface
  updateInterfaceParams: z.object({
    id: z.uuid().meta({
      title: "Device ID",
      description: "ID of device.",
      example: crypto.randomUUID(),
    }),
    interfaceId: z.uuid().meta({
      title: "Interface ID",
      description: "ID of interface to update.",
      example: crypto.randomUUID(),
    }),
  }),
  updateInterfaceBody: createInsertSchema(interfaces, {
    name: (schema) =>
      schema.meta({
        title: "Interface Name",
        description: "New name of interface.",
        example: "GigabitEthernet0/1",
      }),
    mac: () =>
      z.mac().meta({
        title: "MAC Address",
        description: "New MAC address of interface.",
        example: "00:1A:2B:3C:4D:5E",
      }),
    ip: () =>
      z.ipv4().meta({
        title: "IP Address",
        description: "New IP address of interface.",
        example: "192.168.1.1",
      }),
    reservedIp: (schema) =>
      schema.meta({
        title: "Reserved IP",
        description: "Whether the IP address is reserved for this interface.",
        example: false,
      }),
    allowList: (schema) =>
      schema.meta({
        title: "Allow List",
        description: "Whether the interface is in the allow list.",
        example: false,
      }),
  }).omit({ id: true, deviceId: true }),
  // Delete Interface
  deleteInterfaceParams: z.object({
    id: z.uuid().meta({
      title: "Device ID",
      description: "ID of device.",
      example: crypto.randomUUID(),
    }),
    interfaceId: z.uuid().meta({
      title: "Interface ID",
      description: "ID of interface to delete.",
      example: crypto.randomUUID(),
    }),
  }),
  // Get Device History
  getDeviceHistoryParams: z.object({
    id: z.uuid().meta({
      title: "Device ID",
      description: "ID of device to get history for.",
      example: crypto.randomUUID(),
    }),
  }),
} as const;

export type DeviceModel = {
  [k in keyof typeof DeviceModel]: UnwrapSchema<(typeof DeviceModel)[k]>;
};
