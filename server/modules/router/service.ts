import { getAccessToken } from "@/server/utils/authentik";
import puppeteer, { Browser, Page } from "puppeteer-core";
import { getVendor } from "mac-oui-lookup";
import { RouterModel } from "./model";
import { Device } from "../devices/service";
import { StatusMap } from "elysia";

const {
  ROUTER_ENPOINT,
  ROUTER_PASSWORD,
  AUTHENTIK_CLOAKBROWSER_CLIENT_ID,
  CLOAKBROWSER_PROFILE_ID,
  CLOAKBROWSER_ENDPOINT,
} = process.env;

if (!ROUTER_ENPOINT) throw new Error("Missing ROUTER_ENPOINT");
if (!ROUTER_PASSWORD) throw new Error("Missing ROUTER_PASSWORD");
if (!AUTHENTIK_CLOAKBROWSER_CLIENT_ID)
  throw new Error("Missing AUTHENTIK_CLOAKBROWSER_CLIENT_ID");

if (!CLOAKBROWSER_PROFILE_ID)
  throw new Error("Missing CLOAKBROWSER_PROFILE_ID");
if (!CLOAKBROWSER_ENDPOINT) throw new Error("Missing CLOAKBROWSER_ENDPOINT");

const CONNECTION_TEST_MAP: Record<string, string> = {
  Cabeado: "Conexão Cabeada",
  "--": "Roteador",
};

function mapConnectionTest(value: string): string {
  if (value in CONNECTION_TEST_MAP) {
    return CONNECTION_TEST_MAP[value];
  }
  const wifiMatch = value.match(/^(\d+(?:\.\d+)?)GHz_CH(\d+)$/);
  if (wifiMatch) {
    return `Wifi ${wifiMatch[1]} GHz no Canal ${wifiMatch[2]}`;
  }
  return value;
}

type EasyMeshCols = readonly [
  "ID",
  "Nome do Dispositivo",
  "Endereço IP",
  "Endereço MAC",
  "Teste de Conexão",
  "Força de Sinal",
  "Link Rate",
  "Operação",
];
type WiredRe0StatCols = readonly [
  "ID",
  "Nome",
  "Endereço IP",
  "Endereço MAC",
  "Teste de Conexão",
  "Link Rate",
  "Attached To",
];
type LanStatTable = readonly [
  "Porta LAN",
  "Status",
  "Velocidade de Negociação",
];

type SimpleStats = {
  tableEasymeshStat: Record<EasyMeshCols[number], string>[];
  tableWiredRe0Stat: Record<WiredRe0StatCols[number], string>[];
  tableWlRe0Stat: Record<WiredRe0StatCols[number], string>[];
  tableLanStat: Record<LanStatTable[number], string>[];
  map_grid_internet: { label: string; value: string }[];
  router_panel: { title: string; items: { title: string; value: string }[] }[];
};

interface DMParam {
  oid: string;
  data: unknown;
  callback: {
    success: (data: never) => void;
  };
}
interface FakeJQuery {
  dm: {
    add: (p: DMParam) => void;
    del: (p: DMParam) => void;
    getList: (p: DMParam) => void;
  };
}

declare global {
  interface Window {
    getMac: () => Promise<string>;
    getIp: () => Promise<string>;
    getStackId: () => Promise<string>;
  }

  var $: FakeJQuery;
}

export abstract class Router {
  private static accessToken: string | null = null;
  private static accessTokenExp: number | null = null;
  private static browser: Browser | null = null;
  private static vendorCache = new Map<string, string>();

  private static async ensureToken() {
    const isExpired = this.accessTokenExp
      ? Date.now() >= this.accessTokenExp * 1000
      : true;
    if (!isExpired) return;
    const { token, exp } = await getAccessToken(
      AUTHENTIK_CLOAKBROWSER_CLIENT_ID!,
    );
    this.accessToken = token;
    this.accessTokenExp = exp;
  }

  private static async ensureSession() {
    await this.ensureToken();
    await this.ensureCloakSession();
    return await this.getBrowserInstance();
  }

  private static async getBrowserInstance() {
    if (this.browser) return await this.browser.newPage();
    const url = new URL(
      `/api/profiles/${CLOAKBROWSER_PROFILE_ID}/cdp`,
      CLOAKBROWSER_ENDPOINT,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const browser = await puppeteer.connect({
      browserWSEndpoint: url.toString(),
      headers: { Authorization: "Bearer " + this.accessToken },
    });
    browser.on("disconnected", () => {
      this.browser = null;
    });
    const page = await browser.newPage();
    return page;
  }

  private static async prepareEnviroment() {
    const page = await this.ensureSession();
    await this.login(page);
    return page;
  }

  private static async ensureCloakSession() {
    const url = new URL(
      `/api/profiles/${CLOAKBROWSER_PROFILE_ID}/launch`,
      CLOAKBROWSER_ENDPOINT,
    );
    const response = await fetch(url, {
      method: "POST",
      headers: { Authorization: "Bearer " + this.accessToken },
    });
    if (response.status === StatusMap.Conflict) return;
    if (!response.ok) {
      console.error(response);
      throw new Error("Browser not started");
    }
  }

  private static async login(page: Page) {
    await page.goto(ROUTER_ENPOINT!);
    const cookie = (await page.browser().cookies()).find(
      (cookie) => cookie.name === "JSESSIONID",
    );
    if (cookie) return page.waitForNetworkIdle({ idleTime: 500 });
    await page.type("#pc-login-password", ROUTER_PASSWORD!);
    await page.click("#pc-login-btn");
    await page.waitForNetworkIdle({ idleTime: 500 });
    const overrideSession = await page.evaluate(() => {
      return document
        .querySelector("#alert-container")
        ?.computedStyleMap()
        ?.get("display")
        ?.toString();
    });
    if (overrideSession === "block") {
      await page.click("#confirm-yes");
      await page.waitForNetworkIdle({ idleTime: 500 });
    }
  }

  static async getSimpleStats(): Promise<SimpleStats> {
    const page = await this.prepareEnviroment();

    return page.evaluate(() => {
      function getTable(selector: string) {
        const table = document.querySelector(selector);
        if (!table) return [];

        const headers = [
          ...table.querySelectorAll(
            "thead th, tr:first-child th, tr:first-child td",
          ),
        ].map((th) => th.textContent?.trim() ?? "");

        const rowsInTbody = table.querySelectorAll("tbody tr");
        const bodyRows = rowsInTbody.length
          ? [...rowsInTbody]
          : [...table.querySelectorAll("tr")].slice(1);

        return bodyRows.map((tr) => {
          const row: Record<string, string> = {};
          [...tr.querySelectorAll("td")].forEach((td, i) => {
            row[headers[i]] =
              td.textContent?.trim() ||
              (td.querySelector("input") as HTMLInputElement)?.value ||
              "";
          });
          return row;
        });
      }

      function getMapGrid(selector: string) {
        const grid = document.querySelector(selector);
        if (!grid) return [];
        return [...(grid.children[0]?.children ?? [])]
          .filter((el) => !el.classList.contains("nd"))
          .map((el) => ({
            label: el.querySelector("label")?.textContent ?? "",
            value: (el.querySelector("input") as HTMLInputElement)?.value ?? "",
          }));
      }

      function getMapPanel(selector: string) {
        const panel = document.querySelector(selector);
        if (!panel) return [];
        return [...panel.querySelectorAll(".content")].map((c) => ({
          title: c.querySelector("h5")?.textContent ?? "",
          items: [...c.querySelectorAll(".pure-control-group")].map((i) => ({
            title: i.querySelector("label")?.textContent ?? "",
            value: (i.querySelector("input") as HTMLInputElement)?.value ?? "",
          })),
        }));
      }

      return {
        tableEasymeshStat: getTable("#tableEasymeshStat"),
        tableWiredRe0Stat: getTable("#tableWiredRe0Stat"),
        tableWlRe0Stat: getTable("#tableWlRe0Stat"),
        tableLanStat: getTable("#tableLanStat"),
        map_grid_internet: getMapGrid("#map_grid_internet"),
        router_panel: getMapPanel("#router_panel"),
      };
    }) as Promise<SimpleStats>;
  }

  static async getConnectedDevices(): Promise<
    RouterModel["getConnectedDevicesResponse"]
  > {
    const simpleStats = await this.getSimpleStats();

    const rows = [
      ...simpleStats.tableEasymeshStat.map((x) => ({
        mac: x["Endereço MAC"],
        ip: x["Endereço IP"],
        name: x["Nome do Dispositivo"],
        routerInterface: mapConnectionTest(x["Teste de Conexão"]),
      })),
      ...simpleStats.tableWiredRe0Stat.map((x) => ({
        mac: x["Endereço MAC"],
        ip: x["Endereço IP"],
        name: x["Nome"],
        routerInterface: mapConnectionTest(x["Teste de Conexão"]),
      })),
      ...simpleStats.tableWlRe0Stat.map((x) => ({
        mac: x["Endereço MAC"],
        ip: x["Endereço IP"],
        name: x["Nome"],
        routerInterface: mapConnectionTest(x["Teste de Conexão"]),
      })),
    ];

    return Promise.all(
      rows.map(async (row) => ({
        mac: row.mac,
        ip: row.ip,
        vendor: this.getVendorCached(row.mac),
        name: (await Device.getDeviceNameOfMac(row.mac)) ?? row.name ?? "",
        routerInterface: row.routerInterface,
      })),
    );
  }

  private static getVendorCached(mac: string): string {
    const oui = mac.slice(0, 8);
    if (!this.vendorCache.has(oui)) {
      this.vendorCache.set(oui, getVendor(mac) ?? "Unknown");
    }
    return this.vendorCache.get(oui)!;
  }

  // DHCP Manipulation
  static async addDHCPEntry(mac: string, ip: string) {
    const page = await this.prepareEnviroment();
    await page.exposeFunction("getMac", () => mac);
    await page.exposeFunction("getIp", () => ip);
    const stackId = await page.evaluate(() => {
      return new Promise<string>(async (resolve) => {
        $.dm.add({
          oid: "DEV2_DHCPV4_POOL_STATICADDR",
          data: {
            chaddr: await window.getMac(),
            yiaddr: await window.getIp(),
            enable: "1",
            pstack: "1,0,0,0,0,0",
          },
          callback: {
            success: (data: { stack: string }) => {
              resolve(data.stack);
            },
          },
        });
      });
    });
    return stackId;
  }

  static async removeDHCPEntry(id: string) {
    const page = await this.prepareEnviroment();
    await page.exposeFunction("getStackId", () => id);
    await page.evaluate(() => {
      return new Promise<void>(async (resolve) => {
        $.dm.del({
          oid: "DEV2_DHCPV4_POOL_STATICADDR",
          data: {
            stack: await window.getStackId(),
          },
          callback: {
            success: () => {
              resolve();
            },
          },
        });
      });
    });
  }

  static async listDHCPEntry() {
    const page = await this.prepareEnviroment();
    return await page.evaluate(() => {
      return new Promise<
        Array<{
          ip: string;
          mac: string;
          entryId: string;
        }>
      >(async (resolve) => {
        $.dm.getList({
          oid: "DEV2_DHCPV4_POOL_STATICADDR",
          data: {},
          callback: {
            success: (
              res: Array<{
                yiaddr: string;
                chaddr: string;
                stack: string;
              }>,
            ) => {
              resolve(
                res.map((e) => ({
                  ip: e.yiaddr,
                  mac: e.chaddr,
                  entryId: e.stack,
                })),
              );
            },
          },
        });
      });
    });
  }
}
