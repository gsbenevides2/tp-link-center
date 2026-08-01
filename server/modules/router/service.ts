import puppeteer, { type Page } from "puppeteer-core";
import { RouterModel } from "./model";
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
} from "./types";

const { BROWSER_URL, BROWSER_WSENDPOINT } = process.env;

type ConnectedDevices = RouterModel["getConnectedDevicesResponse"];
type DhcpEntries = RouterModel["listDHCPEntryResponse"];
type RouterStatus = RouterModel["getRouterStatusResponse"];

if (!BROWSER_URL) throw new Error("Missing BROWSER_URL");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LOGIN_TIMEOUT_MS = 30_000;

async function createPage(endpoint: string) {
  const browser = await puppeteer.connect({
    browserURL: BROWSER_URL!,
    browserWSEndpoint: BROWSER_WSENDPOINT,
  });
  let page: Page;
  try {
    page = await browser.newPage();
    await page.goto(endpoint);
  } catch (error) {
    try {
      await page!.close();
    } catch {}
    throw error;
  }

  const cleanup = async () => {
    try {
      await page.close();
    } catch {}
  };

  return { page, cleanup };
}

export class Router {
  private static processQueue: Array<{
    id: string;
    resolve: () => void;
  }> = [];

  private static vendorCache = new Map<string, string>();

  private static async waitRelease(): Promise<void> {
    const processId = crypto.randomUUID();
    let resolve!: () => void;
    const promise = new Promise<void>((r) => {
      resolve = r;
    });
    this.processQueue.push({ id: processId, resolve });
    if (this.processQueue[0].id === processId) {
      return;
    }
    await promise;
  }

  private static release() {
    this.processQueue.shift();
    if (this.processQueue.length > 0) {
      this.processQueue[0].resolve();
    }
  }

  private static async login(page: Page, password: string) {
    await wait(200);
    const isLoggedOut = await this.evaluate<boolean>(
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
    await this.evaluate(page, `$("#pc-login-btn").click()`);

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await wait(100);
      const isInvalid = await this.evaluate<boolean>(
        page,
        `$(".content.error-tips-content").is(":visible")`,
      ).catch(() => false);
      if (isInvalid) throw new Error("Password is Invalid for: " + page.url());
      const isForcing = await this.evaluate<boolean>(
        page,
        `$("#confirm-yes").is(":visible")`,
      ).catch(() => false);
      if (isForcing) {
        await this.evaluate(page, `$("#confirm-yes").click()`);
      }
      const isLogged = await this.evaluate<boolean>(
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

  private static async makeDmCall<T>(
    method: string,
    oid: string,
    data: Record<string, unknown> = {},
    page: Page,
    timeoutMs = 30_000,
  ): Promise<T> {
    let timeout: ReturnType<typeof setTimeout> | undefined;
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
    const response = await Promise.race([
      this.evaluate<T>(page, str),
      new Promise<"timeout call">((resolve) => {
        timeout = setTimeout(() => resolve("timeout call"), timeoutMs);
      }),
    ]);
    if (response === "timeout call") {
      throw new Error(
        `DM call timed out after ${timeoutMs}ms for: ${page.url()}`,
      );
    }
    clearTimeout(timeout);
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

  static async getConnectedDevices(): Promise<ConnectedDevices> {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);
      const result = await Promise.all([
        this.getConnectedEasyMeshDevices(page),
        this.getConnectedWifiDevices(page),
        this.getConnectedWiredDevices(page),
      ]);
      return result.flat().filter((result) => result.ip !== "");
    } finally {
      await session?.cleanup();
      this.release();
    }
  }

  static async listDHCPEntry(): Promise<DhcpEntries> {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);

      const DEV2_DHCPV4_POOL_STATICADDR = await this.makeDmCall<
        DEV2_DHCPV4_POOL_STATICADDR[]
      >("getList", "DEV2_DHCPV4_POOL_STATICADDR", {}, page);
      return DEV2_DHCPV4_POOL_STATICADDR.map((e) => ({
        ip: e.yiaddr,
        mac: e.chaddr,
        entryId: e.stack,
      }));
    } finally {
      await session?.cleanup();
      this.release();
    }
  }

  static async addDHCPEntry(mac: string, ip: string): Promise<string> {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);

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
    } finally {
      await session?.cleanup();
      this.release();
    }
  }

  static async removeDHCPEntry(id: string) {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);
      await this.makeDmCall<void>(
        "del",
        "DEV2_DHCPV4_POOL_STATICADDR",
        { stack: id },
        page,
      );
    } finally {
      await session?.cleanup();
      this.release();
    }
  }

  static async listFirewallChains() {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);

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
    } finally {
      await session?.cleanup();
      this.release();
    }
  }

  static async listFirewallRules() {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);

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
    } finally {
      await session?.cleanup();
      this.release();
    }
  }

  static async addFirewallRule(params: {
    chainStack: string;
    name: string;
    sourceMAC: string;
    sourceIP?: string;
    target?: string;
  }) {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);

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
    } finally {
      await session?.cleanup();
      this.release();
    }
  }

  static async removeFirewallRule(ruleStack: string) {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);
      await this.makeDmCall<void>(
        "del",
        "DEV2_FW_CHAIN_RULE",
        { stack: ruleStack },
        page,
      );
    } finally {
      await session?.cleanup();
      this.release();
    }
  }

  static async restartNetwork() {
    await this.waitRelease();
    try {
      const allRouters = await Device.getAllRouters();
      const controller = allRouters.find((r) => r.isController);
      const agents = allRouters.filter((r) => !r.isController);
      for (const agent of agents) {
        let session: Awaited<ReturnType<typeof createPage>> | undefined;
        try {
          session = await createPage(`http://${agent.ip}`);
          const { page } = session;
          await this.login(page, agent.password);
          await this.rebootRouter(page);
        } finally {
          await session?.cleanup();
        }
      }
      if (controller) {
        let session: Awaited<ReturnType<typeof createPage>> | undefined;
        try {
          session = await createPage(`http://${controller.ip}`);
          const { page } = session;
          await this.login(page, controller.password);
          await this.rebootRouter(page);
        } finally {
          await session?.cleanup();
        }
      }
    } finally {
      this.release();
    }
  }

  static async getStatus(): Promise<RouterStatus> {
    const controller = await Device.getControllerRouter();
    if (!controller) {
      throw new Error(
        "No controller router registered. Please register a router controller first.",
      );
    }

    await this.waitRelease();
    let session: Awaited<ReturnType<typeof createPage>> | undefined;
    try {
      session = await createPage(`http://${controller.ip}`);
      const { page } = session;
      await this.login(page, controller.password);

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
      const memoryUsage = parseInt(
        ((usedMemory / totalMemory) * 100).toString(),
      );

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
    } finally {
      await session?.cleanup();
      this.release();
    }
  }
}
