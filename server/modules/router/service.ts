import puppeteer from "puppeteer-core";
import { RouterModel } from "./model";
import getVendor from "mac-oui-lookup";
import { Device } from "../devices/service";

const { BROWSER_URL } = process.env;

type ConnectedDevices = RouterModel["getConnectedDevicesResponse"];
type DhcpEntries = RouterModel["listDHCPEntryResponse"];

if (!BROWSER_URL) throw new Error("Missing BROWSER_URL");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

const LOGIN_TIMEOUT_MS = 30_000;

async function createPage(endpoint: string) {
  const browser = await puppeteer.connect({
    browserURL: BROWSER_URL!,
  });
  const page = await browser.newPage();
  await page.goto(endpoint);

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

  return { browser, page, cleanup };
}

async function evaluate<T>(
  page: import("puppeteer-core").Page,
  script: string,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(script) as any as Promise<T>;
}

async function rebootRouter(page: import("puppeteer-core").Page): Promise<void> {
  await evaluate<void>(
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
  );
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

  private static async login(
    page: import("puppeteer-core").Page,
    password: string,
  ) {
    await wait(200);
    const isLoggedOut = await evaluate<boolean>(
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
    await evaluate(page, `$("#pc-login-btn").click()`);

    const deadline = Date.now() + LOGIN_TIMEOUT_MS;
    while (Date.now() < deadline) {
      await wait(100);
      const isInvalid = await evaluate<boolean>(
        page,
        `$(".content.error-tips-content").is(":visible")`,
      ).catch(() => false);
      if (isInvalid) throw new Error("Password is Invalid for: " + page.url());
      const isForcing = await evaluate<boolean>(
        page,
        `$("#confirm-yes").is(":visible")`,
      ).catch(() => false);
      if (isForcing) {
        await evaluate(page, `$("#confirm-yes").click()`);
      }
      const isLogged = await evaluate<boolean>(
        page,
        `$("#topReboot").is(":visible")`,
      ).catch(() => false);
      if (isLogged) return;
    }
    throw new Error(`Login timeout after ${LOGIN_TIMEOUT_MS}ms for: ${page.url()}`);
  }

  private static getVendorCached(mac: string): string {
    const oui = mac.slice(0, 8);
    if (!this.vendorCache.has(oui)) {
      this.vendorCache.set(oui, getVendor(mac) ?? "Unknown");
    }
    return this.vendorCache.get(oui)!;
  }

  private static async getConnectedEasyMeshDevices(
    page: import("puppeteer-core").Page,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV = await evaluate<
      Array<{
        MACAddress: string;
        X_TP_IPAddress: string;
        backhaulLinkType: string;
        X_TP_HostName: string;
        X_TP_Active: string;
      }>
    >(
      page,
      `(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_WIFI_APDEV",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`,
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
    page: import("puppeteer-core").Page,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ASSOCDEV = await evaluate<
      Array<{
        X_TP_HostName: string;
        X_TP_RadioMac: string;
        X_TP_IPAddress: string;
        MACAddress: string;
        active: string;
      }>
    >(
      page,
      `(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_WIFI_APDEV_ASSOCDEV",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`,
    );
    const DEV2_WIFI_APDEV_RADIO = await evaluate<
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

  private static async getConnectedWiredDevices(
    page: import("puppeteer-core").Page,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ETHASSOCDEV = await evaluate<
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
    const { page, cleanup } = await createPage(`http://${controller.ip}`);
    try {
      await this.login(page, controller.password);

      const results = await this.getConnectedEasyMeshDevices(page);
      results.push(...(await this.getConnectedWifiDevices(page)));
      results.push(...(await this.getConnectedWiredDevices(page)));
      return results.filter((result) => result.ip !== "");
    } finally {
      await cleanup();
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
    const { page, cleanup } = await createPage(`http://${controller.ip}`);
    try {
      await this.login(page, controller.password);

      const DEV2_DHCPV4_POOL_STATICADDR = await evaluate<
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
      await cleanup();
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
    const { page, cleanup } = await createPage(`http://${controller.ip}`);
    try {
      await this.login(page, controller.password);

      const result = await evaluate<{ stack: string }>(
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
      await cleanup();
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
    const { page, cleanup } = await createPage(`http://${controller.ip}`);
    try {
      await this.login(page, controller.password);
      await evaluate<void>(
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
      await cleanup();
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
    const { page, cleanup } = await createPage(`http://${controller.ip}`);
    try {
      await this.login(page, controller.password);

      const chains = await evaluate<
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
      await cleanup();
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
    const { page, cleanup } = await createPage(`http://${controller.ip}`);
    try {
      await this.login(page, controller.password);

      const rules = await evaluate<
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
      await cleanup();
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
    const { page, cleanup } = await createPage(`http://${controller.ip}`);
    try {
      await this.login(page, controller.password);

      const result = await evaluate<{ stack: string }>(
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
      await cleanup();
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
    const { page, cleanup } = await createPage(`http://${controller.ip}`);
    try {
      await this.login(page, controller.password);
      await evaluate<void>(
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
      await cleanup();
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
        const { page, cleanup } = await createPage(`http://${agent.ip}`);
        try {
          await this.login(page, agent.password);
          await rebootRouter(page);
        } finally {
          await cleanup();
        }
      }
      if (controller) {
        const { page, cleanup } = await createPage(`http://${controller.ip}`);
        try {
          await this.login(page, controller.password);
          await rebootRouter(page);
        } finally {
          await cleanup();
        }
      }
    } finally {
      this.release();
    }
  }
}

const cleanupBrowser = () => {
  // Cleanup is handled per-page via the cleanup function returned by createPage
  process.exit(0);
};

process.on("SIGTERM", cleanupBrowser);
process.on("SIGINT", cleanupBrowser);
