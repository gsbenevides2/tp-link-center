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

  // Firewall
  firewallChainResponse: z
    .array(
      z.object({
        name: z.string().meta({
          title: "Chain Name",
          description: "Name of the firewall chain.",
          example: "ACCESSCTL_BLACK",
        }),
        enable: z.string().meta({
          title: "Enabled",
          description: "Whether the chain is enabled.",
          example: "0",
        }),
        ruleNumberOfEntries: z.string().meta({
          title: "Rule Count",
          description: "Number of rules in this chain.",
          example: "1",
        }),
        stack: z.string().meta({
          title: "Stack ID",
          description: "Stack identifier of the chain.",
          example: "2,0,0,0,0,0",
        }),
      }),
    )
    .meta({
      title: "List of Firewall Chains",
      description: "List of firewall chains on the router.",
    }),

  firewallRuleResponse: z
    .array(
      z.object({
        ruleName: z.string().meta({
          title: "Rule Name",
          description: "Name of the firewall rule.",
          example: "lwip0",
        }),
        ruleType: z.string().meta({
          title: "Rule Type",
          description: "Type of the rule.",
          example: "2",
        }),
        sourceType: z.string().meta({
          title: "Source Type",
          description: "Type of source matching.",
          example: "2",
        }),
        sourceIP: z.string().meta({
          title: "Source IP",
          description: "Source IP address to match.",
          example: "",
        }),
        sourceMAC: z.string().meta({
          title: "Source MAC",
          description: "Source MAC address to match.",
          example: "D8:C8:0C:40:F9:C9",
        }),
        target: z.string().meta({
          title: "Target",
          description: "Action to take when rule matches.",
          example: "Drop",
        }),
        enable: z.string().meta({
          title: "Enabled",
          description: "Whether the rule is enabled.",
          example: "1",
        }),
        stack: z.string().meta({
          title: "Stack ID",
          description: "Stack identifier of the rule.",
          example: "2,1,0,0,0,0",
        }),
      }),
    )
    .meta({
      title: "List of Firewall Rules",
      description: "List of rules in a firewall chain.",
    }),

  addFirewallRuleRequest: z
    .object({
      chainStack: z.string().meta({
        title: "Chain Stack ID",
        description: "Stack ID of the chain to add the rule to.",
        example: "2,0,0,0,0,0",
      }),
      name: z.string().meta({
        title: "Rule Name",
        description: "Name for the new rule.",
        example: "blocked-device",
      }),
      sourceMAC: z.string().meta({
        title: "Source MAC",
        description: "MAC address to block.",
        example: "D8:C8:0C:40:F9:C9",
      }),
      sourceIP: z.string().optional().meta({
        title: "Source IP",
        description: "Optional IP address to match.",
        example: "",
      }),
      target: z.string().optional().meta({
        title: "Target",
        description: "Action: Drop or Reject. Defaults to Drop.",
        example: "Drop",
      }),
    })
    .meta({
      title: "Add Firewall Rule Request",
      description: "Request body to add a firewall rule.",
    }),

  firewallRuleCreatedResponse: z
    .object({
      stack: z.string().meta({
        title: "Stack ID",
        description: "Stack identifier of the created rule.",
        example: "2,1,0,0,0,0",
      }),
    })
    .meta({
      title: "Firewall Rule Created",
      description: "Response after creating a firewall rule.",
    }),
};

export type RouterModel = {
  [k in keyof typeof RouterModel]: UnwrapSchema<(typeof RouterModel)[k]>;
};
