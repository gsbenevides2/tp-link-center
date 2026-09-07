import getVendor from "mac-oui-lookup";
import { Device } from "../devices/service";
import { DEV2_ADT_WAN, DEV2_DEV_INFO, DEV2_MEM_STATUS, DEV2_PROC_STATUS, DEV2_WIFI_APDEV, DEV2_WIFI_APDEV_ASSOCDEV, DEV2_WIFI_APDEV_RADIO, DEV2_WIFI_APDEV_ETHASSOCDEV, DEV2_DHCPV4_POOL_STATICADDR, DEV2_FW_CHAIN, DEV2_FW_CHAIN_RULE, ConnectedDevices, DhcpEntries, RouterStatus } from "./types";
import { db } from "@/server/db";
import { normalizeMac } from "@/server/utils/normalizeMac";
import { onlineChecks, onlineDevicesChecks } from "@/server/db/schema";
import { Settings } from "../settings/service";
import { TpLinkClient } from "@/server/lib/tplink/client";
export class Router {
  private static vendorCache = new Map<string, string>();

  private static async getRouterClient(ip: string, password: string) {
    const client = new TpLinkClient({
      host: ip,
      username: "user",
      password,
    });
    await client.login();
    return client;
  }

  private static getVendorCached(mac: string): string {
    const oui = mac.slice(0, 8);
    if (!this.vendorCache.has(oui)) {
      this.vendorCache.set(oui, getVendor(mac) ?? "Unknown");
    }
    return this.vendorCache.get(oui)!;
  }

  private static async getConnectedEasyMeshDevices(client: TpLinkClient): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV = await client.getList<{ data: DEV2_WIFI_APDEV[] }>("DEV2_WIFI_APDEV", {
      stack: "0,0,0,0,0,0",
      pstack: "0,0,0,0,0,0",
    });

    function processBackLinkType(type: string) {
      if (type === "Ethernet") {
        return "Cabeada";
      } else if (type === "") {
        return "Roteador";
      } else {
        return "Unknown";
      }
    }
    return await Promise.all(
      DEV2_WIFI_APDEV.data
        .filter((item) => item.X_TP_Active === "1")
        .map(async (item) => ({
          ip: item.X_TP_IPAddress,
          mac: item.MACAddress,
          name: (await Device.getDeviceNameOfMac(item.MACAddress)) || item.X_TP_HostName || "Unknown",
          routerInterface: processBackLinkType(item.backhaulLinkType),
          vendor: this.getVendorCached(item.MACAddress),
        })),
    );
  }

  private static async getConnectedWifiDevices(client: TpLinkClient): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ASSOCDEV = await client.getList<{ data: DEV2_WIFI_APDEV_ASSOCDEV[] }>("DEV2_WIFI_APDEV_ASSOCDEV", {
      stack: "0,0,0,0,0,0",
      pstack: "0,0,0,0,0,0",
    });

    const DEV2_WIFI_APDEV_RADIO = await client.getList<{ data: DEV2_WIFI_APDEV_RADIO[] }>("DEV2_WIFI_APDEV_RADIO", {
      stack: "0,0,0,0,0,0",
      pstack: "0,0,0,0,0,0",
    });
    function getRouterInterface(radioMac: string) {
      const data = DEV2_WIFI_APDEV_RADIO.data.find((item) => item.MACAddress === radioMac);
      if (!data) return "Unknown";
      return `Wifi ${data.operatingFrequencyBand} GHz no Canal ${data.channel}`;
    }

    return await Promise.all(
      DEV2_WIFI_APDEV_ASSOCDEV.data
        .filter((item) => item.active === "1")
        .map(async (item) => ({
          ip: item.X_TP_IPAddress,
          mac: item.MACAddress,
          name: (await Device.getDeviceNameOfMac(item.MACAddress)) || item.X_TP_HostName || "Unknown",
          vendor: this.getVendorCached(item.MACAddress),
          routerInterface: getRouterInterface(item.X_TP_RadioMac),
        })),
    );
  }

  private static async rebootRouter(client: TpLinkClient): Promise<void> {
    await client.op<void>("ACT_REBOOT");
  }

  private static async getConnectedWiredDevices(client: TpLinkClient): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ETHASSOCDEV = await client.getList<{ data: DEV2_WIFI_APDEV_ETHASSOCDEV[] }>("DEV2_WIFI_APDEV_ETHASSOCDEV", {
      stack: "0,0,0,0,0,0",
      pstack: "0,0,0,0,0,0",
    });

    return await Promise.all(
      DEV2_WIFI_APDEV_ETHASSOCDEV.data
        .filter((i) => i.active === "1")
        .map(async (i) => ({
          ip: i.IPAddress,
          mac: i.MACAddress,
          name: (await Device.getDeviceNameOfMac(i.MACAddress)) || i.X_TP_HostName || "Unknown",
          routerInterface: "Cabeada",
          vendor: this.getVendorCached(i.MACAddress),
        })),
    );
  }

  private static async getConnectedDevices(client?: TpLinkClient): Promise<ConnectedDevices> {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }

      client = await this.getRouterClient(controller.ip, controller.password);
    }
    const result = await Promise.all([this.getConnectedEasyMeshDevices(client), this.getConnectedWifiDevices(client), this.getConnectedWiredDevices(client)]);
    return result.flat().filter((result) => result.ip !== "");
  }

  private static async listDHCPEntry(client?: TpLinkClient): Promise<DhcpEntries> {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }

      client = await this.getRouterClient(controller.ip, controller.password);
    }

    const DEV2_DHCPV4_POOL_STATICADDR = await client.getList<{ data: DEV2_DHCPV4_POOL_STATICADDR[] }>("DEV2_DHCPV4_POOL_STATICADDR", {
      stack: "0,0,0,0,0,0",
      pstack: "0,0,0,0,0,0",
    });
    return DEV2_DHCPV4_POOL_STATICADDR.data.map((e) => ({
      ip: e.yiaddr,
      mac: e.chaddr,
      entryId: e.stack,
    }));
  }

  private static async addDHCPEntry(mac: string, ip: string, client?: TpLinkClient): Promise<string> {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }

      client = await this.getRouterClient(controller.ip, controller.password);
    }
    const result = await client.add<{ data: { stack: string } }>("DEV2_DHCPV4_POOL_STATICADDR", {
      chaddr: mac,
      yiaddr: ip,
      enable: "1",
      pstack: "1,0,0,0,0,0",
      stack: "0,0,0,0,0,0",
    });

    return result.data.stack;
  }

  private static async removeDHCPEntry(id: string, client?: TpLinkClient) {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }

      client = await this.getRouterClient(controller.ip, controller.password);
    }
    await client.del<void>("DEV2_DHCPV4_POOL_STATICADDR", { stack: id, pstack: "1,0,0,0,0,0" });
  }

  private static async listFirewallChains(client?: TpLinkClient) {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }
      client = await this.getRouterClient(controller.ip, controller.password);
    }
    const chains = await client.getList<{ data: DEV2_FW_CHAIN[] }>("DEV2_FW_CHAIN", {
      pstack: "0,0,0,0,0,0",
      stack: "0,0,0,0,0,0",
    });

    return chains.data.map((c) => ({
      name: c.name,
      enable: c.enable,
      ruleNumberOfEntries: c.ruleNumberOfEntries,
      stack: c.stack,
    }));
  }

  private static async listFirewallRules(client?: TpLinkClient) {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }
      client = await this.getRouterClient(controller.ip, controller.password);
    }
    const rawRules = await client.getList<{ data: DEV2_FW_CHAIN_RULE[] }>("DEV2_FW_CHAIN_RULE", { pstack: "0,0,0,0,0,0", stack: "0,0,0,0,0,0" });
    const rules = rawRules.data.map((r) => ({
      ruleName: r.X_TP_RuleName,
      ruleType: r.X_TP_RuleType,
      sourceType: r.X_TP_SourceType,
      sourceIP: r.sourceIP,
      sourceMAC: r.X_TP_SourceMACAddress,
      target: r.target,
      enable: r.enable,
      stack: r.stack,
    }));

    return rules;
  }

  private static async addFirewallRule(
    params: {
      chainStack: string;
      name: string;
      sourceMAC: string;
      sourceIP?: string;
      target?: string;
      stack: string;
    },
    client?: TpLinkClient,
  ): Promise<string> {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }

      client = await this.getRouterClient(controller.ip, controller.password);
    }
    const data: Record<string, unknown> = {
      enable: "1",
      X_TP_RuleType: "2",
      X_TP_RuleName: params.name,
      X_TP_SourceType: "2",
      X_TP_SourceMACAddress: params.sourceMAC,
      pstack: params.chainStack,
      target: params.target || "Drop",
      stack: params.stack,
    };
    if (params.sourceIP) {
      data.sourceIP = params.sourceIP;
    }
    const result = await client.add<{ data: { stack: string } }>("DEV2_FW_CHAIN_RULE", data);

    return result.data.stack;
  }

  private static async removeFirewallRule(ruleStack: string, client?: TpLinkClient) {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }

      client = await this.getRouterClient(controller.ip, controller.password);
    }
    await client.del<void>("DEV2_FW_CHAIN_RULE", { stack: ruleStack, pstack: "0,0,0,0,0,0" });
  }

  static async restartNetwork() {
    const allRouters = await Device.getAllRouters();
    const controller = allRouters.find((r) => r.isController);
    const agents = allRouters.filter((r) => !r.isController);
    for (const agent of agents) {
      try {
        const client = await this.getRouterClient(agent.ip, agent.password);
        await this.rebootRouter(client);
      } catch (error) {
        console.error(`Error rebooting agent ${agent.ip}:`, error);
      }
    }
    if (controller) {
      try {
        const client = await this.getRouterClient(controller.ip, controller.password);
        await this.rebootRouter(client);
      } catch (error) {
        console.error(`Error rebooting controller ${controller.ip}:`, error);
      }
    }
  }

  private static async getStatus(client?: TpLinkClient): Promise<RouterStatus> {
    if (!client) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }

      client = await this.getRouterClient(controller.ip, controller.password);
    }
    const [wanInfo, devInfo, memoryStatus, procStatus] = await Promise.all([
      client.getList<{ data: DEV2_ADT_WAN[] }>("DEV2_ADT_WAN", {
        pstack: "0,0,0,0,0,0",
        stack: "0,0,0,0,0,0",
      }),
      client.get<{ data: DEV2_DEV_INFO }>("DEV2_DEV_INFO", {
        pstack: "0,0,0,0,0,0",
        stack: "0,0,0,0,0,0",
      }),
      client.get<{ data: DEV2_MEM_STATUS }>("DEV2_MEM_STATUS", {
        pstack: "0,0,0,0,0,0",
        stack: "0,0,0,0,0,0",
      }),
      client.get<{ data: DEV2_PROC_STATUS }>("DEV2_PROC_STATUS", {
        pstack: "0,0,0,0,0,0",
        stack: "0,0,0,0,0,0",
      }),
    ]);

    const wanIp = wanInfo.data.at(0)?.connIPv4Address ?? "";
    const connectionStatus = wanInfo.data.at(0)?.connStatusV4;
    const connectionUptime = Number(wanInfo.data.at(0)?.X_TP_Uptime);
    const totalDownload = Number(wanInfo.data.at(0)?.X_TP_BytesReceived);
    const totalUpload = Number(wanInfo.data.at(0)?.X_TP_BytesSent);

    const routerUptime = Number(devInfo.data.upTime);

    const freeMemory = Number(memoryStatus.data.free);
    const totalMemory = Number(memoryStatus.data.total);
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = parseInt(((usedMemory / totalMemory) * 100).toString());

    const cpuUsage = Number(procStatus.data.CPUUsage);

    // Helper to format seconds to human readable
    const formatUptime = (totalSeconds: number): string => {
      if (!totalSeconds) return "N/A";
      const days = Math.floor(totalSeconds / 86400);
      const hours = Math.floor((totalSeconds % 86400) / 3600);
      const minutes = Math.floor((totalSeconds % 3600) / 60);
      const parts: string[] = [];
      if (days > 0) parts.push(`${days}d`);
      if (hours > 0) parts.push(`${hours}h`);
      if (minutes > 0) parts.push(`${minutes}m`);
      if (parts.length === 0) parts.push(`${totalSeconds}s`);
      return parts.join(" ");
    };

    // Helper to format bytes to human readable
    const formatBytes = (b: number): string => {
      if (isNaN(b)) return "N/A";
      if (b >= 1073741824) return `${(b / 1073741824).toFixed(1)} GB`;
      if (b >= 1048576) return `${(b / 1048576).toFixed(1)} MB`;
      if (b >= 1024) return `${(b / 1024).toFixed(1)} KB`;
      return `${b} B`;
    };

    return {
      wanIp,
      connectionStatus: connectionStatus || "Unknown",
      connectionUptime: formatUptime(connectionUptime),
      routerUptime: formatUptime(routerUptime),
      firmwareVersion: devInfo?.data.softwareVersion || "N/A",
      hardwareVersion: devInfo?.data.hardwareVersion || "N/A",
      cpuUsage,
      memoryUsage,
      totalDownload: formatBytes(totalDownload),
      totalUpload: formatBytes(totalUpload),
    };
  }

  // Data Sync Between Database and Router

  private static async syncDhcp(client: TpLinkClient): Promise<void> {
    const dbInterfaces = await db.query.interfaces.findMany({
      where: {
        reservedIp: true,
      },
      with: {
        device: true,
      },
    });

    const interfacesToSync = dbInterfaces.filter((i) => i.device?.type === "client" || (i.device?.type === "router" && !i.device.isController));

    const routerEntries = await this.listDHCPEntry(client);

    const dbMacs = new Set(interfacesToSync.map((i) => normalizeMac(i.mac)));
    const routerMacToEntry = new Map(routerEntries.map((e) => [normalizeMac(e.mac), e]));

    for (const entry of routerEntries) {
      const normalizedMac = normalizeMac(entry.mac);
      if (!dbMacs.has(normalizedMac)) {
        await Router.removeDHCPEntry(entry.entryId, client).catch((e) => {
          console.error(`Failed to remove DHCP entry for ${entry.mac}: ${e instanceof Error ? e.message : String(e)}`);
        });
      }
    }

    for (const iface of interfacesToSync) {
      const normalizedMac = normalizeMac(iface.mac);
      if (!routerMacToEntry.has(normalizedMac)) {
        await Router.addDHCPEntry(iface.mac, iface.ip, client).catch((e) => {
          console.error(`Failed to add DHCP entry for ${iface.mac}: ${e instanceof Error ? e.message : String(e)}`);
        });
      }
    }
  }

  private static async getAvailableFirewallRuleStackId(client: TpLinkClient): Promise<number> {
    const chains = await this.listFirewallChains(client);

    const accessChain = chains.find((c) => c.name === "ACCESSCTL_WHITE");
    const allRouterRules = await this.listFirewallRules(client);
    if (!accessChain) {
      throw new Error("Missing access chain");
    }
    const chainId = accessChain.stack.split(",")[0];
    const routerRules = allRouterRules.filter((r) => r.stack.split(",")[0] === chainId);
    const ids = routerRules.map((r) => Number(r.stack.split(",").at(1))).sort((a, b) => a - b);
    const lastId = ids.length > 0 ? ids.at(-1)! : 0;
    return lastId + 1;
  }

  private static async syncFirewall(client: TpLinkClient): Promise<void> {
    const dbInterfaces = await db.query.interfaces.findMany({
      where: {
        allowList: true,
      },
      with: {
        device: true,
      },
    });

    const clientInterfaces = dbInterfaces.filter((i) => i.device?.type === "client");

    const chains = await this.listFirewallChains(client);
    const accessChain = chains.find((c) => c.name === "ACCESSCTL_WHITE");

    if (!accessChain) {
      return;
    }

    const allRouterRules = await this.listFirewallRules(client);
    const accessChainId = accessChain.stack.split(",")[0];
    const routerRules = allRouterRules.filter((r) => r.stack.split(",")[0] === accessChainId);

    const dbMacs = new Set(clientInterfaces.map((i) => normalizeMac(i.mac)));
    const routerMacToRule = new Map(routerRules.map((r) => [normalizeMac(r.sourceMAC), r]));

    for (const rule of routerRules) {
      const normalizedMac = normalizeMac(rule.sourceMAC);
      if (!dbMacs.has(normalizedMac)) {
        await this.removeFirewallRule(rule.stack, client).catch((e) => {
          console.error(`Failed to remove firewall rule for ${rule.sourceMAC}: ${e instanceof Error ? e.message : String(e)}`);
        });
      }
    }

    for (const iface of clientInterfaces) {
      const normalizedMac = normalizeMac(iface.mac);
      if (!routerMacToRule.has(normalizedMac)) {
        const currentRuleChain = await this.getAvailableFirewallRuleStackId(client);
        const chainId = accessChain.stack.split(",")[0];
        await Router.addFirewallRule(
          {
            chainStack: accessChain.stack,
            name: iface.name,
            sourceMAC: iface.mac,
            target: "Accept",
            stack: `${chainId},${currentRuleChain},0,0,0,0`,
          },
          client,
        ).catch((e) => {
          console.error(`Failed to add firewall rule for ${iface.mac}: ${e instanceof Error ? e.message : String(e)}`);
        });
      }
    }
  }

  private static async syncConnectedDevices(client: TpLinkClient): Promise<void> {
    const devices = await this.getConnectedDevices(client);
    const checkId = crypto.randomUUID();

    await db.insert(onlineChecks).values({
      id: checkId,
      createdAt: new Date(),
    });

    if (devices.length > 0) {
      await db.insert(onlineDevicesChecks).values(
        devices.map((d) => ({
          mac: d.mac,
          ip: d.ip,
          checkId,
          name: d.name,
          vendor: d.vendor,
          routerInterface: d.routerInterface,
        })),
      );
    }
  }

  private static async syncRouterStatus(client: TpLinkClient): Promise<void> {
    const status = await this.getStatus(client);
    await Settings.saveStatus(status);
  }

  static async syncSettings(): Promise<void> {
    try {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error("No controller router registered. Please register a router controller first.");
      }

      const client = await this.getRouterClient(controller.ip, controller.password);
      await this.syncDhcp(client);
      await this.syncFirewall(client);
      await this.syncConnectedDevices(client);
      await this.syncRouterStatus(client);
    } catch (error) {
      console.error("Error syncing router settings:", error);
      throw new Error("Error syncing router settings: " + (error instanceof Error ? error.message : String(error)));
    }
  }
}
