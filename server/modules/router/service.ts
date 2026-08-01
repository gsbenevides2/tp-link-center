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
} from "./types";

const { BROWSER_URL } = process.env;

type ConnectedDevices = RouterModel["getConnectedDevicesResponse"];
type DhcpEntries = RouterModel["listDHCPEntryResponse"];
type RouterStatus = RouterModel["getRouterStatusResponse"];

if (!BROWSER_URL) throw new Error("Missing BROWSER_URL");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LOGIN_TIMEOUT_MS = 30_000;

async function createPage(endpoint: string) {
  const browser = await puppeteer.connect({
    browserURL: BROWSER_URL!,
  });
  let page: Page;
  try {
    page = await browser.newPage();
    await page.goto(endpoint);
  } catch (error) {
    try {
      await page!.close();
    } catch {
      // page not created or already closed
    }
    browser.disconnect();
    throw error;
  }

  const cleanup = async () => {
    try {
      await page.close();
    } catch {
      // page already closed
    }
    try {
      browser.disconnect();
    } catch {
      // browser already disconnected
    }
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
    data: Record<string, unknown>,
    page: Page,
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
      `;
    const response = await this.evaluate<T>(page, str);
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

    const DEV2_WIFI_APDEV_RADIO = await this.evaluate<
      Array<{
        channel: string;
        operatingFrequencyBand: string;
        MACAddress: string;
      }>
    >(
      page,
      `(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_WIFI_APDEV_RADIO",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`,
    );
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
    const timeoutMs = 30_000;
    let timeout: ReturnType<typeof setTimeout> | undefined;

    try {
      await Promise.race([
        this.evaluate<void>(
          page,
          `(function reboot(){
          return new Promise((resolve, reject)=>{
            $.dm.op({
              oid: "ACT_REBOOT",
              callback: {
                success: ()=>resolve(),
                fail: (err)=>reject(err),
                error: (err)=>reject(err)
              }
            })
          })
        })()`,
        ),
        new Promise<void>((_, reject) => {
          timeout = setTimeout(
            () =>
              reject(new Error(`Router reboot timed out after ${timeoutMs}ms`)),
            timeoutMs,
          );
        }),
      ]);
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  private static async getConnectedWiredDevices(
    page: Page,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ETHASSOCDEV = await this.evaluate<
      Array<{
        IPAddress: string;
        X_TP_HostName: string;
        MACAddress: string;
        active: string;
      }>
    >(
      page,
      `(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_WIFI_APDEV_ETHASSOCDEV",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`,
    );

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

      const results = await this.getConnectedEasyMeshDevices(page);
      results.push(...(await this.getConnectedWifiDevices(page)));
      results.push(...(await this.getConnectedWiredDevices(page)));
      return results.filter((result) => result.ip !== "");
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

      const DEV2_DHCPV4_POOL_STATICADDR = await this.evaluate<
        Array<{
          yiaddr: string;
          chaddr: string;
          stack: string;
        }>
      >(
        page,
        `(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_DHCPV4_POOL_STATICADDR",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`,
      );
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

      const result = await this.evaluate<{ stack: string }>(
        page,
        `(function(params){
          var parsed = JSON.parse(params);
          return new Promise(function(resolve, reject){
            $.dm.add({
              oid: "DEV2_DHCPV4_POOL_STATICADDR",
              data: {
                chaddr: parsed.mac,
                yiaddr: parsed.ip,
                enable: "1",
                pstack: "1,0,0,0,0,0"
              },
              callback: {
                success: function(data){ resolve(data) },
                fail: function(err){ reject(err) },
                error: function(err){ reject(err) }
              }
            })
          })
        })(${JSON.stringify(JSON.stringify({ mac, ip }))})`,
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
      await this.evaluate<void>(
        page,
        `(function(params){
          var parsed = JSON.parse(params);
          return new Promise(function(resolve, reject){
            $.dm.del({
              oid: "DEV2_DHCPV4_POOL_STATICADDR",
              data: {
                stack: parsed.id
              },
              callback: {
                success: function(){ resolve() },
                fail: function(err){ reject(err) },
                error: function(err){ reject(err) }
              }
            })
          })
        })(${JSON.stringify(JSON.stringify({ id }))})`,
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

      const chains = await this.evaluate<
        Array<{
          name: string;
          enable: string;
          ruleNumberOfEntries: string;
          stack: string;
        }>
      >(
        page,
        `(function routers(){
        return new Promise((resolve, reject)=>{
            $.dm.getList({
                oid: "DEV2_FW_CHAIN",
                data: {},
                callback: {
                    success: (data)=>resolve(data),
                    fail: (error)=>reject(error),
                    error: (error)=>reject(error)
                }
            })
            })
        })()`,
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

      const rules = await this.evaluate<
        Array<{
          ruleName: string;
          ruleType: string;
          sourceType: string;
          sourceIP: string;
          sourceMAC: string;
          target: string;
          enable: string;
          stack: string;
        }>
      >(
        page,
        `(function routers(){
        return new Promise((resolve, reject)=>{
            $.dm.getList({
                oid: "DEV2_FW_CHAIN_RULE",
                data: { pstack: "" },
                callback: {
                    success: (res)=>resolve(res.map((r)=>({
                        ruleName: r.X_TP_RuleName,
                        ruleType: r.X_TP_RuleType,
                        sourceType: r.X_TP_SourceType,
                        sourceIP: r.sourceIP,
                        sourceMAC: r.X_TP_SourceMACAddress,
                        target: r.target,
                        enable: r.enable,
                        stack: r.stack
                    }))),
                    fail: (error)=>reject(error),
                    error: (error)=>reject(error)
                }
            })
            })
        })()`,
      );

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

      const result = await this.evaluate<{ stack: string }>(
        page,
        `(function(params){
          var p = JSON.parse(params);
          return new Promise(function(resolve, reject){
            var data = {
              enable: 1,
              X_TP_RuleType: 2,
              X_TP_RuleName: p.name,
              X_TP_SourceType: 2,
              X_TP_SourceMACAddress: p.sourceMAC,
              pstack: p.chainStack,
              target: p.target || "Drop"
            };
            if (p.sourceIP) {
              data.sourceIP = p.sourceIP;
            }
            $.dm.add({
              oid: "DEV2_FW_CHAIN_RULE",
              data: data,
              callback: {
                success: function(data){ resolve(data) },
                fail: function(err){ reject(err) },
                error: function(err){ reject(err) }
              }
            })
          })
        })(${JSON.stringify(JSON.stringify(params))})`,
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
      await this.evaluate<void>(
        page,
        `(function(params){
          var parsed = JSON.parse(params);
          return new Promise(function(resolve, reject){
            $.dm.del({
              oid: "DEV2_FW_CHAIN_RULE",
              data: {
                stack: parsed.ruleStack
              },
              callback: {
                success: function(){ resolve() },
                fail: function(err){ reject(err) },
                error: function(err){ reject(err) }
              }
            })
          })
        })(${JSON.stringify(JSON.stringify({ ruleStack }))})`,
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

      // Fetch WAN connection info
      const wanInfo = await this.evaluate<DEV2_ADT_WAN[]>(
        page,
        `(function(){
          return new Promise(resolve=>{
            $.dm.getList({
              oid: "DEV2_ADT_WAN",
              data: {},
              callback: {
                success: (data)=>resolve(data),
                fail: ()=>resolve(null),
                error: ()=>resolve(null)
              }
            })
          })
        })()`,
      );

      const wanIp = wanInfo.at(0)?.connIPv4Address ?? "";
      const connectionStatus = wanInfo.at(0)?.connStatusV4;
      const connectionUptime = Number(wanInfo.at(0)?.X_TP_Uptime);
      const totalDownload = Number(wanInfo.at(0)?.X_TP_BytesReceived);
      const totalUpload = Number(wanInfo.at(0)?.X_TP_BytesReceived);

      // Fetch device info (uptime, firmware, hardware)
      const devInfo = await this.evaluate<DEV2_DEV_INFO>(
        page,
        `(function(){
          return new Promise(resolve=>{
            $.dm.get({
              oid: "DEV2_DEV_INFO",
              data: {},
              callback: {
                success: (data)=>resolve(data),
                fail: ()=>resolve(null),
                error: ()=>resolve(null)
              }
            })
          })
        })()`,
      );

      const routerUptime = Number(devInfo.upTime);

      const memoryStatus = await this.evaluate<DEV2_MEM_STATUS>(
        page,
        `(function(){
          return new Promise(resolve=>{
            $.dm.get({
              oid: "DEV2_MEM_STATUS",
              data: {},
              callback: {
                success: (data)=>resolve(data),
                fail: ()=>resolve(null),
                error: ()=>resolve(null)
              }
            })
          })
        })()`,
      );

      const freeMemory = Number(memoryStatus.free);
      const totalMemory = Number(memoryStatus.total);
      const usedMemory = totalMemory - freeMemory;
      const memoryUsage = (usedMemory / totalMemory) * 100;

      const procStatus = await this.evaluate<DEV2_PROC_STATUS>(
        page,
        `(function(){
          return new Promise(resolve=>{
            $.dm.get({
              oid: "DEV2_PROC_STATUS",
              data: {},
              callback: {
                success: (data)=>resolve(data),
                fail: ()=>resolve(null),
                error: ()=>resolve(null)
              }
            })
          })
        })()`,
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
