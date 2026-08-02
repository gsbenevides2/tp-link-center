import puppeteer, { type Page, type Browser } from "puppeteer-core";
import getVendor from "mac-oui-lookup";
import { Device } from "../devices/service";
import {
  DEV2_ADT_WAN,
  DEV2_DEV_INFO,
  DEV2_MEM_STATUS,
  DEV2_PROC_STATUS,
  DEV2_WIFI_APDEV,
  DEV2_WIFI_APDEV_ASSOCDEV,
  DEV2_WIFI_APDEV_RADIO,
  DEV2_WIFI_APDEV_ETHASSOCDEV,
  DEV2_DHCPV4_POOL_STATICADDR,
  DEV2_FW_CHAIN,
  DEV2_FW_CHAIN_RULE,
  ConnectedDevices,
  DhcpEntries,
  RouterStatus,
} from "./types";
import { Queue } from "@/server/utils/queue";
import { db } from "@/server/db";
import { normalizeMac } from "@/server/utils/normalizeMac";
import { onlineChecks, onlineDevicesChecks } from "@/server/db/schema";
import { Settings } from "../settings/service";

const { BROWSER_URL, BROWSER_WSENDPOINT } = process.env;

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LOGIN_TIMEOUT_MS = 30_000;
export class Router {
  private static browser: Browser | null = null;
  private static getPageQueue = new Queue();

  private static vendorCache = new Map<string, string>();

  private static pageList = new Map<string, Page>();

  private static async getBrowser(): Promise<Browser> {
    if (this.browser && this.browser.connected) {
      return this.browser;
    }
    const browser = await puppeteer.connect({
      browserURL: BROWSER_URL,
      browserWSEndpoint: BROWSER_WSENDPOINT,
    });
    this.browser?.on("disconnected", () => {
      console.log("Browser disconnected. Clearing cached pages.");
      this.browser = null;
      this.pageList.clear();
    });
    this.browser = browser;
    return browser;
  }

  private static async getPage(ip: string, password: string): Promise<Page> {
    return await this.getPageQueue.enqueue(async () => {
      const pageInCache = this.pageList.get(ip);
      if (
        pageInCache &&
        pageInCache.isClosed() === false &&
        pageInCache.browser().connected
      ) {
        const isLoggedIn = await this.isLoggedIn(pageInCache, ip);
        if (isLoggedIn === false) {
          await this.login(pageInCache, password);
        }
        return pageInCache;
      }
      const url = `http://${ip}`;
      const browser = await this.getBrowser();
      const page = await browser.newPage();
      await page.goto(url);
      await this.login(page, password);
      this.pageList.set(ip, page);
      return page;
    });
  }

  private static async isLoggedIn(page: Page, ip: string): Promise<boolean> {
    await page.goto(`http://${ip}`);
    const isLoggedOut = await this.safeEvaluate<boolean>(
      page,
      `$("#pc-login-password").is(":visible")`,
    );
    return !isLoggedOut;
  }

  private static async login(page: Page, password: string) {
    await wait(200);
    const isLoggedOut = await this.safeEvaluate<boolean>(
      page,
      `$("#pc-login-password").is(":visible")`,
    );
    if (!isLoggedOut) return;
    await page.evaluate((pwd) => {
      const input = document.querySelector(
        "#pc-login-password",
      ) as HTMLInputElement | null;
      if (input) input.value = pwd;
    }, password);
    await wait(100);
    await this.safeEvaluate(page, `$("#pc-login-btn").click()`);

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await wait(100);
      const isInvalid = await this.safeEvaluate<boolean>(
        page,
        `$(".content.error-tips-content").is(":visible")`,
      ).catch(() => false);
      if (isInvalid) throw new Error("Password is Invalid for: " + page.url());
      const isForcing = await this.safeEvaluate<boolean>(
        page,
        `$("#confirm-yes").is(":visible")`,
      ).catch(() => false);
      if (isForcing) {
        await this.safeEvaluate(page, `$("#confirm-yes").click()`);
      }
      const isLogged = await this.safeEvaluate<boolean>(
        page,
        `$("#topReboot").is(":visible")`,
      ).catch(() => false);
      if (isLogged) return;
    }
    throw new Error(
      `Login timeout after ${LOGIN_TIMEOUT_MS}ms for: ${page.url()}`,
    );
  }

  private static async evaluate<T>(page: Page, script: string): Promise<T> {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return page.evaluate(script) as any as Promise<T>;
  }

  private static async safeEvaluate<T>(
    page: Page,
    script: string,
    timeoutMs = 30_000,
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        this.evaluate<T>(page, script),
        new Promise<"timeout call">((resolve) => {
          timeout = setTimeout(() => resolve("timeout call"), timeoutMs);
        }),
      ]);
      if (response === "timeout call") {
        throw new Error(
          `Evaluate timed out after ${timeoutMs}ms for: ${page.url()}`,
        );
      }
      return response;
    } catch (error) {
      this.browser = null;
      this.pageList.clear();
      throw error;
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private static async makeDmCall<T>(
    method: string,
    oid: string,
    data: Record<string, unknown> = {},
    page: Page,
    timeoutMs = 30_000,
  ): Promise<T> {
    const str = `(function(){
      return new Promise((resolve, reject)=>{
        $.dm.${method}({
          oid: "${oid}",
          data: ${JSON.stringify(data)},
          callback: {
            success: (data)=>resolve(data),
            fail: (err)=>reject(err),
            error: (err)=>reject(err)
          }
        })
      })
    })()`;
    const response = await this.safeEvaluate<T>(page, str, timeoutMs);
    return response;
  }

  private static getVendorCached(mac: string): string {
    const oui = mac.slice(0, 8);
    if (!this.vendorCache.has(oui)) {
      this.vendorCache.set(oui, getVendor(mac) ?? "Unknown");
    }
    return this.vendorCache.get(oui)!;
  }

  private static async getConnectedEasyMeshDevices(
    page: Page,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV = await this.makeDmCall<DEV2_WIFI_APDEV[]>(
      "getList",
      "DEV2_WIFI_APDEV",
      {},
      page,
    );

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
      DEV2_WIFI_APDEV.filter((item) => item.X_TP_Active === "1").map(
        async (item) => ({
          ip: item.X_TP_IPAddress,
          mac: item.MACAddress,
          name:
            (await Device.getDeviceNameOfMac(item.MACAddress)) ||
            item.X_TP_HostName ||
            "Unknown",
          routerInterface: processBackLinkType(item.backhaulLinkType),
          vendor: this.getVendorCached(item.MACAddress),
        }),
      ),
    );
  }

  private static async getConnectedWifiDevices(
    page: Page,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ASSOCDEV = await this.makeDmCall<
      DEV2_WIFI_APDEV_ASSOCDEV[]
    >("getList", "DEV2_WIFI_APDEV_ASSOCDEV", {}, page);

    const DEV2_WIFI_APDEV_RADIO = await this.makeDmCall<
      DEV2_WIFI_APDEV_RADIO[]
    >("getList", "DEV2_WIFI_APDEV_RADIO", {}, page);
    function getRouterInterface(radioMac: string) {
      const data = DEV2_WIFI_APDEV_RADIO.find(
        (item) => item.MACAddress === radioMac,
      );
      if (!data) return "Unknown";
      return `Wifi ${data.operatingFrequencyBand} GHz no Canal ${data.channel}`;
    }

    return await Promise.all(
      DEV2_WIFI_APDEV_ASSOCDEV.filter((item) => item.active === "1").map(
        async (item) => ({
          ip: item.X_TP_IPAddress,
          mac: item.MACAddress,
          name:
            (await Device.getDeviceNameOfMac(item.MACAddress)) ||
            item.X_TP_HostName ||
            "Unknown",
          vendor: this.getVendorCached(item.MACAddress),
          routerInterface: getRouterInterface(item.X_TP_RadioMac),
        }),
      ),
    );
  }

  private static async rebootRouter(page: Page): Promise<void> {
    await this.makeDmCall<void>("op", "ACT_REBOOT", {}, page);
  }

  private static async getConnectedWiredDevices(
    page: Page,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ETHASSOCDEV = await this.makeDmCall<
      DEV2_WIFI_APDEV_ETHASSOCDEV[]
    >("getList", "DEV2_WIFI_APDEV_ETHASSOCDEV", {}, page);

    return await Promise.all(
      DEV2_WIFI_APDEV_ETHASSOCDEV.filter((i) => i.active === "1").map(
        async (i) => ({
          ip: i.IPAddress,
          mac: i.MACAddress,
          name:
            (await Device.getDeviceNameOfMac(i.MACAddress)) ||
            i.X_TP_HostName ||
            "Unknown",
          routerInterface: "Cabeada",
          vendor: this.getVendorCached(i.MACAddress),
        }),
      ),
    );
  }

  private static async getConnectedDevices(
    page?: Page,
  ): Promise<ConnectedDevices> {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }

      page = await this.getPage(controller.ip, controller.password);
    }
    const result = await Promise.all([
      this.getConnectedEasyMeshDevices(page),
      this.getConnectedWifiDevices(page),
      this.getConnectedWiredDevices(page),
    ]);
    return result.flat().filter((result) => result.ip !== "");
  }

  private static async listDHCPEntry(page?: Page): Promise<DhcpEntries> {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }

      page = await this.getPage(controller.ip, controller.password);
    }
    const DEV2_DHCPV4_POOL_STATICADDR = await this.makeDmCall<
      DEV2_DHCPV4_POOL_STATICADDR[]
    >("getList", "DEV2_DHCPV4_POOL_STATICADDR", {}, page);
    return DEV2_DHCPV4_POOL_STATICADDR.map((e) => ({
      ip: e.yiaddr,
      mac: e.chaddr,
      entryId: e.stack,
    }));
  }

  private static async addDHCPEntry(
    mac: string,
    ip: string,
    page?: Page,
  ): Promise<string> {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }

      page = await this.getPage(controller.ip, controller.password);
    }
    const result = await this.makeDmCall<{ stack: string }>(
      "add",
      "DEV2_DHCPV4_POOL_STATICADDR",
      {
        chaddr: mac,
        yiaddr: ip,
        enable: "1",
        pstack: "1,0,0,0,0,0",
      },
      page,
    );

    return result.stack;
  }

  private static async removeDHCPEntry(id: string, page?: Page) {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }

      page = await this.getPage(controller.ip, controller.password);
    }
    await this.makeDmCall<void>(
      "del",
      "DEV2_DHCPV4_POOL_STATICADDR",
      { stack: id },
      page,
    );
  }

  private static async listFirewallChains(page?: Page) {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }
      page = await this.getPage(controller.ip, controller.password);
    }
    const chains = await this.makeDmCall<DEV2_FW_CHAIN[]>(
      "getList",
      "DEV2_FW_CHAIN",
      {},
      page,
    );

    return chains.map((c) => ({
      name: c.name,
      enable: c.enable,
      ruleNumberOfEntries: c.ruleNumberOfEntries,
      stack: c.stack,
    }));
  }

  private static async listFirewallRules(page?: Page) {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }
      page = await this.getPage(controller.ip, controller.password);
    }
    const rawRules = await this.makeDmCall<DEV2_FW_CHAIN_RULE[]>(
      "getList",
      "DEV2_FW_CHAIN_RULE",
      { pstack: "" },
      page,
    );
    const rules = rawRules.map((r) => ({
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
    },
    page?: Page,
  ): Promise<string> {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }

      page = await this.getPage(controller.ip, controller.password);
    }
    const data: Record<string, unknown> = {
      enable: 1,
      X_TP_RuleType: 2,
      X_TP_RuleName: params.name,
      X_TP_SourceType: 2,
      X_TP_SourceMACAddress: params.sourceMAC,
      pstack: params.chainStack,
      target: params.target || "Drop",
    };
    if (params.sourceIP) {
      data.sourceIP = params.sourceIP;
    }
    const result = await this.makeDmCall<{ stack: string }>(
      "add",
      "DEV2_FW_CHAIN_RULE",
      data,
      page,
    );

    return result.stack;
  }

  private static async removeFirewallRule(ruleStack: string, page?: Page) {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }

      page = await this.getPage(controller.ip, controller.password);
    }
    await this.makeDmCall<void>(
      "del",
      "DEV2_FW_CHAIN_RULE",
      { stack: ruleStack },
      page,
    );
  }

  static async restartNetwork() {
    const allRouters = await Device.getAllRouters();
    const controller = allRouters.find((r) => r.isController);
    const agents = allRouters.filter((r) => !r.isController);
    for (const agent of agents) {
      try {
        const page = await this.getPage(agent.ip, agent.password);
        await this.rebootRouter(page);
      } catch (error) {
        console.error(`Error rebooting agent ${agent.ip}:`, error);
      }
    }
    if (controller) {
      try {
        const page = await this.getPage(controller.ip, controller.password);
        await this.rebootRouter(page);
      } catch (error) {
        console.error(`Error rebooting controller ${controller.ip}:`, error);
      }
    }
  }

  private static async getStatus(page?: Page): Promise<RouterStatus> {
    if (!page) {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }

      page = await this.getPage(controller.ip, controller.password);
    }
    const [wanInfo, devInfo, memoryStatus, procStatus] = await Promise.all([
      this.makeDmCall<DEV2_ADT_WAN[]>("getList", "DEV2_ADT_WAN", {}, page),
      this.makeDmCall<DEV2_DEV_INFO>("get", "DEV2_DEV_INFO", {}, page),
      this.makeDmCall<DEV2_MEM_STATUS>("get", "DEV2_MEM_STATUS", {}, page),
      this.makeDmCall<DEV2_PROC_STATUS>("get", "DEV2_PROC_STATUS", {}, page),
    ]);

    const wanIp = wanInfo.at(0)?.connIPv4Address ?? "";
    const connectionStatus = wanInfo.at(0)?.connStatusV4;
    const connectionUptime = Number(wanInfo.at(0)?.X_TP_Uptime);
    const totalDownload = Number(wanInfo.at(0)?.X_TP_BytesReceived);
    const totalUpload = Number(wanInfo.at(0)?.X_TP_BytesSent);

    const routerUptime = Number(devInfo.upTime);

    const freeMemory = Number(memoryStatus.free);
    const totalMemory = Number(memoryStatus.total);
    const usedMemory = totalMemory - freeMemory;
    const memoryUsage = parseInt(((usedMemory / totalMemory) * 100).toString());

    const cpuUsage = Number(procStatus.CPUUsage);

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
      firmwareVersion: devInfo?.softwareVersion || "N/A",
      hardwareVersion: devInfo?.hardwareVersion || "N/A",
      cpuUsage,
      memoryUsage,
      totalDownload: formatBytes(totalDownload),
      totalUpload: formatBytes(totalUpload),
    };
  }

  // Data Sync Between Database and Router

  private static async syncDhcp(page: Page): Promise<void> {
    const dbInterfaces = await db.query.interfaces.findMany({
      where: {
        reservedIp: true,
      },
      with: {
        device: true,
      },
    });

    const interfacesToSync = dbInterfaces.filter(
      (i) =>
        i.device?.type === "client" ||
        (i.device?.type === "router" && !i.device.isController),
    );

    const routerEntries = await this.listDHCPEntry(page);

    const dbMacs = new Set(interfacesToSync.map((i) => normalizeMac(i.mac)));
    const routerMacToEntry = new Map(
      routerEntries.map((e) => [normalizeMac(e.mac), e]),
    );

    for (const entry of routerEntries) {
      const normalizedMac = normalizeMac(entry.mac);
      if (!dbMacs.has(normalizedMac)) {
        await Router.removeDHCPEntry(entry.entryId, page).catch((e) => {
          console.error(
            `Failed to remove DHCP entry for ${entry.mac}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        });
      }
    }

    for (const iface of interfacesToSync) {
      const normalizedMac = normalizeMac(iface.mac);
      if (!routerMacToEntry.has(normalizedMac)) {
        await Router.addDHCPEntry(iface.mac, iface.ip, page).catch((e) => {
          console.error(
            `Failed to add DHCP entry for ${iface.mac}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        });
      }
    }
  }

  private static async syncFirewall(page: Page): Promise<void> {
    const dbInterfaces = await db.query.interfaces.findMany({
      where: {
        allowList: true,
      },
      with: {
        device: true,
      },
    });

    const clientInterfaces = dbInterfaces.filter(
      (i) => i.device?.type === "client",
    );

    const chains = await this.listFirewallChains(page);
    const accessChain = chains.find((c) => c.name === "ACCESSCTL_WHITE");

    if (!accessChain) {
      return;
    }

    const allRouterRules = await this.listFirewallRules(page);
    const routerRules = allRouterRules.filter(
      (r) => r.stack[0] === accessChain.stack[0],
    );

    const dbMacs = new Set(clientInterfaces.map((i) => normalizeMac(i.mac)));
    const routerMacToRule = new Map(
      routerRules.map((r) => [normalizeMac(r.sourceMAC), r]),
    );

    for (const rule of routerRules) {
      const normalizedMac = normalizeMac(rule.sourceMAC);
      if (!dbMacs.has(normalizedMac)) {
        await this.removeFirewallRule(rule.stack, page).catch((e) => {
          console.error(
            `Failed to remove firewall rule for ${rule.sourceMAC}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        });
      }
    }

    for (const iface of clientInterfaces) {
      const normalizedMac = normalizeMac(iface.mac);
      if (!routerMacToRule.has(normalizedMac)) {
        await Router.addFirewallRule(
          {
            chainStack: accessChain.stack,
            name: iface.name,
            sourceMAC: iface.mac,
            target: "Accept",
          },
          page,
        ).catch((e) => {
          console.error(
            `Failed to add firewall rule for ${iface.mac}: ${
              e instanceof Error ? e.message : String(e)
            }`,
          );
        });
      }
    }
  }

  private static async syncConnectedDevices(page: Page): Promise<void> {
    const devices = await this.getConnectedDevices(page);
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

  private static async syncRouterStatus(page: Page): Promise<void> {
    const status = await this.getStatus(page);
    await Settings.saveStatus(status);
  }

  static async syncSettings(): Promise<void> {
    try {
      const controller = await Device.getControllerRouter();
      if (!controller) {
        throw new Error(
          "No controller router registered. Please register a router controller first.",
        );
      }

      const page = await this.getPage(controller.ip, controller.password);
      await this.syncDhcp(page);
      await this.syncFirewall(page);
      await this.syncConnectedDevices(page);
      await this.syncRouterStatus(page);
    } catch (error) {
      console.error("Error syncing router settings:", error);
      throw new Error(
        "Error syncing router settings: " +
          (error instanceof Error ? error.message : String(error)),
      );
    }
  }
}
