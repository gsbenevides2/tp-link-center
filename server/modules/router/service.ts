import puppeteer from "puppeteer-core";
import { RouterModel } from "./model";
import getVendor from "mac-oui-lookup";
import { Device } from "../devices/service";

const { BROWSER_URL } = process.env;

type ConnectedDevices = RouterModel["getConnectedDevicesResponse"];
type DhcpEntries = RouterModel["listDHCPEntryResponse"];

if (!BROWSER_URL) throw new Error("Missing BROWSER_URL");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function createPage(endpoint: string) {
  const browser = await puppeteer.connect({
    browserURL: BROWSER_URL!,
  });
  const page = await browser.newPage();
  await page.goto(endpoint);
  return { browser, page };
}

// puppeteer's string overload constrains T to unknown[], so we cast
async function evaluate<T>(
  page: import("puppeteer-core").Page,
  script: string,
): Promise<T> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return page.evaluate(script) as any as Promise<T>;
}

export class Router {
  static processQueue: string[] = [];

  private static vendorCache = new Map<string, string>();

  private static async waitRelease() {
    const processId = crypto.randomUUID();
    this.processQueue.push(processId);
    while (true) {
      if (this.processQueue.at(0) === processId) break;
      await wait(100);
    }
  }

  private static async release() {
    this.processQueue.shift();
  }

  private static async login(
    page: import("puppeteer-core").Page,
    endpoint: string,
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

    while (true) {
      await wait(100);
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
      if (isLogged) break;
    }
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
      DEV2_WIFI_APDEV.filter((item) => item.X_TP_Active === "1").map(async (item) => ({
        ip: item.X_TP_IPAddress,
        mac: item.MACAddress,
        name:
          (await Device.getDeviceNameOfMac(item.MACAddress)) ||
          item.X_TP_HostName ||
          "Unknown",
        routerInterface: processBackLinkType(item.backhaulLinkType),
        vendor: this.getVendorCached(item.MACAddress),
      })),
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
      DEV2_WIFI_APDEV_ASSOCDEV.filter((item) => item.active === "1").map(async (item) => ({
        ip: item.X_TP_IPAddress,
        mac: item.MACAddress,
        name:
          (await Device.getDeviceNameOfMac(item.MACAddress)) ||
          item.X_TP_HostName ||
          "Unknown",
        vendor: this.getVendorCached(item.MACAddress),
        routerInterface: getRouterInterface(item.X_TP_RadioMac),
      })),
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
      DEV2_WIFI_APDEV_ETHASSOCDEV.filter((i) => i.active === "1").map(async (i) => ({
        ip: i.IPAddress,
        mac: i.MACAddress,
        name:
          (await Device.getDeviceNameOfMac(i.MACAddress)) ||
          i.X_TP_HostName ||
          "Unknown",
        routerInterface: "Cabeada",
        vendor: this.getVendorCached(i.MACAddress),
      })),
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
    const { page } = await createPage(
      `http://${controller.ip}`,
    );
    try {
      await this.login(page, controller.ip, controller.password);

      const results = await this.getConnectedEasyMeshDevices(page);
      results.push(...(await this.getConnectedWifiDevices(page)));
      results.push(...(await this.getConnectedWiredDevices(page)));
      return results.filter((result) => result.ip !== "");
    } finally {
      await page.close();
      await this.release();
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
    const { page } = await createPage(
      `http://${controller.ip}`,
    );
    try {
      await this.login(page, controller.ip, controller.password);

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
      await page.close();

      await this.release();
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
    const { page } = await createPage(
      `http://${controller.ip}`,
    );
    try {
      await this.login(page, controller.ip, controller.password);

      const DEV2_DHCPV4_POOL_STATICADDR = await evaluate<{
        stack: string;
      }>(
        page,
        `(function routers(){
        return new Promise(resolve=>{
            $.dm.add({
                oid: "DEV2_DHCPV4_POOL_STATICADDR",
                data: {
                    chaddr: "${mac}",
                    yiaddr: "${ip}",
                    enable: "1",
                    pstack: "1,0,0,0,0,0"
                },
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`,
      );

      return DEV2_DHCPV4_POOL_STATICADDR.stack;
    } finally {
      await page.close();

      await this.release();
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
    const { page } = await createPage(
      `http://${controller.ip}`,
    );
    try {
      await this.login(page, controller.ip, controller.password);
      await evaluate<void>(
        page,
        `(function routers(){
        return new Promise(resolve=>{
            $.dm.del({
                oid: "DEV2_DHCPV4_POOL_STATICADDR",
                data: {
                    stack: "${id}"
                },
                callback: {
                    success: ()=>resolve()
                }
            })
            })
        })()`,
      );
    } finally {
      await page.close();

      await this.release();
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
    const { page } = await createPage(
      `http://${controller.ip}`,
    );
    try {
      await this.login(page, controller.ip, controller.password);

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
      await page.close();

      await this.release();
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
    const { page } = await createPage(
      `http://${controller.ip}`,
    );
    try {
      await this.login(page, controller.ip, controller.password);

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
      await page.close();

      await this.release();
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
    const { page } = await createPage(
      `http://${controller.ip}`,
    );
    try {
      await this.login(page, controller.ip, controller.password);

      const result = await evaluate<{
        stack: string;
      }>(
        page,
        `(function routers(){
        return new Promise((resolve, reject)=>{
            $.dm.add({
                oid: "DEV2_FW_CHAIN_RULE",
                data: {
                    enable: 1,
                    X_TP_RuleType: 2,
                    X_TP_RuleName: "${params.name}",
                    X_TP_SourceType: 2,
                    ${params.sourceIP ? `sourceIP: "${params.sourceIP}",` : ""}
                    X_TP_SourceMACAddress: "${params.sourceMAC}",
                    pstack: "${params.chainStack}",
                    target: "${params.target ?? "Drop"}"
                },
                callback: {
                    success: (data)=>resolve(data),
                    fail: (error)=>reject(error),
                    error: (error)=>reject(error)
                }
            })
            })
        })()`,
      );

      return result.stack;
    } finally {
      await page.close();

      await this.release();
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
    const { page } = await createPage(
      `http://${controller.ip}`,
    );
    try {
      await this.login(page, controller.ip, controller.password);
      await evaluate<void>(
        page,
        `(function routers(){
        return new Promise((resolve, reject)=>{
            $.dm.del({
                oid: "DEV2_FW_CHAIN_RULE",
                data: {
                    stack: "${ruleStack}"
                },
                callback: {
                    success: ()=>resolve(),
                    fail: (error)=>reject(error),
                    error: (error)=>reject(error)
                }
            })
            })
        })()`,
      );
    } finally {
      await page.close();

      await this.release();
    }
  }
}
