import { type UnwrapSchema } from "elysia";
import z from "zod";

export const SettingsModel = {
  getLatestRouterStatusResponse: z
    .object({
      wanIp: z.string().meta({
        title: "WAN IP Address",
        description: "Public IP address of the internet connection.",
        example: "200.100.50.25",
      }),
      connectionStatus: z.string().meta({
        title: "Connection Status",
        description: "Status of the WAN connection.",
        example: "Connected",
      }),
      connectionUptime: z.string().meta({
        title: "Connection Uptime",
        description: "How long the WAN connection has been active.",
        example: "3d 5h 30m",
      }),
      routerUptime: z.string().meta({
        title: "Router Uptime",
        description: "How long the router has been powered on.",
        example: "7d 12h 45m",
      }),
      firmwareVersion: z.string().meta({
        title: "Firmware Version",
        description: "Current firmware version of the router.",
        example: "1.6.1",
      }),
      hardwareVersion: z.string().meta({
        title: "Hardware Version",
        description: "Hardware version of the router.",
        example: "Deco M5 v2.0",
      }),
      cpuUsage: z.number().nullable().meta({
        title: "CPU Usage (%)",
        description: "Current CPU usage percentage.",
        example: 35,
      }),
      memoryUsage: z.number().nullable().meta({
        title: "Memory Usage (%)",
        description: "Current memory usage percentage.",
        example: 62,
      }),
      totalDownload: z.string().nullable().meta({
        title: "Total Download",
        description: "Total data downloaded.",
        example: "256.5 GB",
      }),
      totalUpload: z.string().nullable().meta({
        title: "Total Upload",
        description: "Total data uploaded.",
        example: "45.2 GB",
      }),
    })
    .meta({
      title: "Router Status",
      description: "Current status and performance information of the router.",
    }),
} as const;

export type SettingsModel = {
  [k in keyof typeof SettingsModel]: UnwrapSchema<(typeof SettingsModel)[k]>;
};
