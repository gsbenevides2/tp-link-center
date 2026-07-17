import { unknown } from "zod";
import { RouterModel } from "./model";
import getVendor from "mac-oui-lookup";
import { Device } from "../devices/service";

const { ROUTER_PASSWORD, ROUTER_ENPOINT } = process.env;

type ConnectedDevices = RouterModel["getConnectedDevicesResponse"];
type DhcpEntries = RouterModel["listDHCPEntryResponse"];

if (!ROUTER_PASSWORD) throw new Error("Missing ROUTER_PASSWORD");
if (!ROUTER_ENPOINT) throw new Error("Missing ROUTER_ENPOINT");

const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

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

  private static async login(page: Bun.WebView) {
    await page.navigate(ROUTER_ENPOINT!);
    await page.click("#pc-login-password");
    await page.type(ROUTER_PASSWORD!);
    await page.click("#pc-login-btn");

    while (true) {
      await wait(100);
      const isForcing = await page
        .evaluate<boolean>(`$("#confirm-yes").is(":visible")`)
        .catch(() => false);
      if (isForcing) {
        await page.click("#confirm-yes");
      }
      const isLogged = await page
        .evaluate<boolean>(`$("#topReboot").is(":visible")`)
        .catch(() => false);
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
    page: Bun.WebView,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV = await page.evaluate<
      Array<{
        MACAddress: string;
        X_TP_IPAddress: string;
        backhaulLinkType: string;
        X_TP_HostName: string;
      }>
    >(`(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_WIFI_APDEV",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`);

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
      DEV2_WIFI_APDEV.map(async (item) => ({
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
    page: Bun.WebView,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ASSOCDEV = await page.evaluate<
      Array<{
        X_TP_HostName: string;
        X_TP_RadioMac: string;
        X_TP_IPAddress: string;
        MACAddress: string;
      }>
    >(`(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_WIFI_APDEV_ASSOCDEV",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`);
    const DEV2_WIFI_APDEV_RADIO = await page.evaluate<
      Array<{
        channel: string;
        operatingFrequencyBand: string;
        MACAddress: string;
      }>
    >(`(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_WIFI_APDEV_RADIO",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`);
    function getRouterInterface(radioMac: string) {
      const data = DEV2_WIFI_APDEV_RADIO.find(
        (item) => item.MACAddress === radioMac,
      );
      if (!data) return "Unknown";
      return `Wifi ${data.operatingFrequencyBand} GHz no Canal ${data.channel}`;
    }

    return await Promise.all(
      DEV2_WIFI_APDEV_ASSOCDEV.map(async (item) => ({
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
    page: Bun.WebView,
  ): Promise<ConnectedDevices> {
    const DEV2_WIFI_APDEV_ETHASSOCDEV = await page.evaluate<
      Array<{
        IPAddress: string;
        X_TP_HostName: string;
        MACAddress: string;
      }>
    >(`(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_WIFI_APDEV_ETHASSOCDEV",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`);

    return await Promise.all(
      DEV2_WIFI_APDEV_ETHASSOCDEV.map(async (i) => ({
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
    await this.waitRelease();
    try {
      await using page = new Bun.WebView();
      await this.login(page);

      const results = await this.getConnectedEasyMeshDevices(page);
      results.push(...(await this.getConnectedWifiDevices(page)));
      results.push(...(await this.getConnectedWiredDevices(page)));

      page.close();
      return results;
    } finally {
      await this.release();
    }
  }

  static async listDHCPEntry(): Promise<DhcpEntries> {
    await this.waitRelease();
    try {
      await using page = new Bun.WebView();
      await this.login(page);

      const DEV2_DHCPV4_POOL_STATICADDR = await page.evaluate<
        Array<{
          yiaddr: string;
          chaddr: string;
          stack: string;
        }>
      >(`(function routers(){
        return new Promise(resolve=>{
            $.dm.getList({
                oid: "DEV2_DHCPV4_POOL_STATICADDR",
                data: {},
                callback: {
                    success: (data)=>resolve(data)
                }
            })
            })
        })()`);

      return DEV2_DHCPV4_POOL_STATICADDR.map((e) => ({
        ip: e.yiaddr,
        mac: e.chaddr,
        entryId: e.stack,
      }));
    } finally {
      await this.release();
    }
  }

  static async addDHCPEntry(mac: string, ip: string): Promise<string> {
    await this.waitRelease();
    try {
      await using page = new Bun.WebView();
      await this.login(page);

      const DEV2_DHCPV4_POOL_STATICADDR = await page.evaluate<{
        stack: string;
      }>(`(function routers(){
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
        })()`);

      return DEV2_DHCPV4_POOL_STATICADDR.stack;
    } finally {
      await this.release();
    }
  }
  static async removeDHCPEntry(id: string) {
    await this.waitRelease();
    try {
      await using page = new Bun.WebView();
      await this.login(page);
      await page.evaluate<void>(`(function routers(){
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
        })()`);
    } finally {
      await this.release();
    }
  }

  static async listFirewallChains() {
    await this.waitRelease();
    try {
      await using page = new Bun.WebView();
      await this.login(page);

      const chains = await page.evaluate<
        Array<{
          name: string;
          enable: string;
          ruleNumberOfEntries: string;
          stack: string;
        }>
      >(`(function routers(){
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
        })()`);

      return chains.map((c) => ({
        name: c.name,
        enable: c.enable,
        ruleNumberOfEntries: c.ruleNumberOfEntries,
        stack: c.stack,
      }));
    } finally {
      await this.release();
    }
  }

  static async listFirewallRules(chainStack: string) {
    await this.waitRelease();
    try {
      await using page = new Bun.WebView();
      await this.login(page);

      const rules = await page.evaluate<
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
      >(`(function routers(){
        return new Promise((resolve, reject)=>{
            $.dm.getList({
                oid: "DEV2_FW_CHAIN_RULE",
                data: { pstack: "${chainStack}" },
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
        })()`);

      return rules;
    } finally {
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
    await this.waitRelease();
    try {
      await using page = new Bun.WebView();
      await this.login(page);

      const result = await page.evaluate<{
        stack: string;
      }>(`(function routers(){
        return new Promise((resolve, reject)=>{
            $.dm.add({
                oid: "DEV2_FW_CHAIN_RULE",
                data: {
                    enable: 1,
                    X_TP_RuleType: 2,
                    X_TP_RuleName: "${params.name}",
                    X_TP_SourceType: 2,
                    sourceIP: "${params.sourceIP ?? ""}",
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
        })()`);

      return result.stack;
    } finally {
      await this.release();
    }
  }

  static async removeFirewallRule(ruleStack: string) {
    await this.waitRelease();
    try {
      await using page = new Bun.WebView();
      await this.login(page);
      await page.evaluate<void>(`(function routers(){
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
        })()`);
    } finally {
      await this.release();
    }
  }
}
