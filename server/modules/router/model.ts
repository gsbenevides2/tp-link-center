import { UnwrapSchema } from "elysia";
import z from "zod";

export const RouterModel = {
  // Get Connected Devices
  getConnectedDevicesResponse: z
    .array(
      z.object({
        mac: z.mac().meta({
          title: "MAC Address",
          description: "MAC Address of Connected Device.",
          example: "00:1A:2B:3C:4D:5E",
        }),
        ip: z.ipv4().meta({
          title: "IP Address",
          description: "IP address of Connected Device.",
          example: "192.168.1.1",
        }),
        vendor: z.string().meta({
          title: "Device Vendor",
          description: "Retrieved the vendor name of a MAC.",
          example: "TP-Link",
        }),
        name: z.string().meta({
          title: "Device Name",
          description: "Name of database or name of device reported to router.",
          example: "Moto G7",
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
      title: "List of Connected Devices",
      description: "List of connected devices on router",
    }),

  // DHCP Static Entry
  addDHCPEntryRequest: z
    .object({
      mac: z.mac().meta({
        title: "MAC Address",
        description: "MAC Address of the device.",
        example: "00:1A:2B:3C:4D:5E",
      }),
      ip: z.ipv4().meta({
        title: "IP Address",
        description: "IP address to assign to the device.",
        example: "192.168.1.100",
      }),
    })
    .meta({
      title: "Add DHCP Entry Request",
      description: "Request body to add a static DHCP entry.",
    }),

  dhcpEntryResponse: z
    .object({
      entryId: z.string().meta({
        title: "Entry ID",
        description: "Stack ID of the DHCP entry.",
        example: "1,0,0,0,0,0",
      }),
      mac: z.mac().meta({
        title: "MAC Address",
        description: "MAC Address of the device.",
        example: "00:1A:2B:3C:4D:5E",
      }),
      ip: z.ipv4().meta({
        title: "IP Address",
        description: "IP address assigned to the device.",
        example: "192.168.1.100",
      }),
    })
    .meta({
      title: "DHCP Entry",
      description: "A static DHCP entry.",
    }),

  listDHCPEntryResponse: z
    .array(
      z.object({
        entryId: z.string().meta({
          title: "Entry ID",
          description: "Stack ID of the DHCP entry.",
          example: "1,0,0,0,0,0",
        }),
        mac: z.mac().meta({
          title: "MAC Address",
          description: "MAC Address of the device.",
          example: "00:1A:2B:3C:4D:5E",
        }),
        ip: z.ipv4().meta({
          title: "IP Address",
          description: "IP address assigned to the device.",
          example: "192.168.1.100",
        }),
      }),
    )
    .meta({
      title: "List of DHCP Entries",
      description: "List of static DHCP entries on the router.",
    }),
};

export type RouterModel = {
  [k in keyof typeof RouterModel]: UnwrapSchema<(typeof RouterModel)[k]>;
};
