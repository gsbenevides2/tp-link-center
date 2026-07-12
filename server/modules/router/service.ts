import { getAccessToken } from "@/server/utils/authentik";
import puppeteer, { Page } from "puppeteer-core";
import { getVendor } from "mac-oui-lookup";
import { RouterModel } from "./model";
import { Device } from "../devices/service";

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

const EasyMeshCols = [
  "ID",
  "Nome do Dispositivo",
  "Endereço IP",
  "Endereço MAC",
  "Teste de Conexão",
  "Força de Sinal",
  "Link Rate",
  "Operação",
] as const;
const WiredRe0StatCols = [
  "ID",
  "Nome",
  "Endereço IP",
  "Endereço MAC",
  "Teste de Conexão",
  "Link Rate",
  "Attached To",
] as const;
const LanStatTable = [
  "Porta LAN",
  "Status",
  "Velocidade de Negociação",
] as const;

export abstract class Router {
  static accessToken: string | null = null;

  static async setAccessToken() {
    this.accessToken = await getAccessToken(AUTHENTIK_CLOAKBROWSER_CLIENT_ID!);
  }

  static async startCloakSession() {
    const url = new URL(
      `/api/profiles/${CLOAKBROWSER_PROFILE_ID}/launch`,
      CLOAKBROWSER_ENDPOINT,
    );
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.accessToken,
      },
    });
    if (!response.ok) {
      console.error(response);
      throw new Error("Browser not started");
    }
  }

  static async stopCloakSession() {
    const url = new URL(
      `/api/profiles/${CLOAKBROWSER_PROFILE_ID}/stop`,
      CLOAKBROWSER_ENDPOINT,
    );
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + this.accessToken,
      },
    });
    if (!response.ok) {
      console.error(response);
      throw new Error("Browser not ended");
    }
  }

  static async getBrowserInstance() {
    const url = new URL(
      `/api/profiles/${CLOAKBROWSER_PROFILE_ID}/cdp`,
      CLOAKBROWSER_ENDPOINT,
    );
    url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
    const browser = await puppeteer.connect({
      browserWSEndpoint: url.toString(),
      headers: {
        Authorization: "Bearer " + this.accessToken,
      },
    });
    const page = await browser.newPage();
    await page.goto(ROUTER_ENPOINT!);
    return { page, browser };
  }

  static async login(page: Page) {
    await page.type("#pc-login-password", ROUTER_PASSWORD!, { delay: 10 });
    await page.click("#pc-login-btn", { delay: 10 });
    await page.waitForNetworkIdle({
      idleTime: 2000,
    });
  }
  static async logout(page: Page) {
    await page.click("#topLogout", { delay: 10 });
    await page.click(
      ".button-button.green.pure-button.btn-msg.btn-msg-ok.btn-confirm",
    );
    await page.waitForNetworkIdle({
      idleTime: 2000,
    });
  }

  static async getTable<T extends string>(
    selector: string,
    page: Page,
  ): Promise<Record<T, string>[]> {
    await page.waitForSelector(selector);

    return page.$eval(selector, (table) => {
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
        const row = {} as Record<T, string>;

        [...tr.querySelectorAll("td")].forEach((td, i) => {
          row[headers[i] as T] =
            td.textContent?.trim() || td.querySelector("input")?.value || "";
        });

        return row;
      });
    });
  }

  static async getMapGrid(selector: string, page: Page) {
    await page.waitForSelector(selector);
    return page.$eval(selector, (grid) => {
      return Array(...grid.children[0].children)
        .filter((el) => !el.classList.contains("nd"))
        .map((el) => ({
          label: el.querySelector("label")?.textContent ?? "",
          value: el.querySelector("input")?.value ?? "",
        }));
    });
  }

  static async getMapPanel(selector: string, page: Page) {
    await page.waitForSelector(selector);

    return await page.$eval(selector, (panel) => {
      return Array.from(panel.querySelectorAll(".content")).map((c) => ({
        title: c.querySelector("h5")?.textContent ?? "",
        items: Array.from(c.querySelectorAll(".pure-control-group")).map(
          (i) => ({
            title: i.querySelector("label")?.textContent ?? "",
            value: i.querySelector("input")?.value ?? "",
          }),
        ),
      }));
    });
  }

  static async getSimpleStats() {
    await this.setAccessToken();
    await this.startCloakSession();
    const { page } = await this.getBrowserInstance();
    await this.login(page);
    const [
      tableEasymeshStat,
      tableWiredRe0Stat,
      tableWlRe0Stat,
      tableLanStat,
      map_grid_internet,
      router_panel,
    ] = await Promise.all([
      this.getTable<(typeof EasyMeshCols)[number]>("#tableEasymeshStat", page),
      this.getTable<(typeof WiredRe0StatCols)[number]>(
        "#tableWiredRe0Stat",
        page,
      ),
      this.getTable<(typeof WiredRe0StatCols)[number]>("#tableWlRe0Stat", page),
      this.getTable<(typeof LanStatTable)[number]>("#tableLanStat", page),
      this.getMapGrid("#map_grid_internet", page),
      this.getMapPanel("#router_panel", page),
    ]);
    await this.logout(page);
    await this.stopCloakSession();

    return {
      tableEasymeshStat,
      tableWiredRe0Stat,
      tableWlRe0Stat,
      tableLanStat,
      map_grid_internet,
      router_panel,
    };
  }

  static async getConnectedDevices(): Promise<
    RouterModel["getConnectedDevicesResponse"]
  > {
    const simpleStats = await this.getSimpleStats();

    const devices: RouterModel["getConnectedDevicesResponse"] =
      await Promise.all([
        ...simpleStats.tableEasymeshStat.map(async (item) => ({
          mac: item["Endereço MAC"],
          ip: item["Endereço IP"],
          vendor: getVendor(item["Endereço MAC"]) ?? "Unknown",
          name:
            (await Device.getDeviceNameOfMac(item["Endereço MAC"])) ??
            item["Nome do Dispositivo"] ??
            "",
        })),
        ...simpleStats.tableWiredRe0Stat.map(async (item) => ({
          mac: item["Endereço MAC"],
          ip: item["Endereço IP"],
          vendor: getVendor(item["Endereço MAC"]) ?? "Unknown",
          name:
            (await Device.getDeviceNameOfMac(item["Endereço MAC"])) ??
            item["Nome"] ??
            "",
        })),
        ...simpleStats.tableWlRe0Stat.map(async (item) => ({
          mac: item["Endereço MAC"],
          ip: item["Endereço IP"],
          vendor: getVendor(item["Endereço MAC"]) ?? "Unknown",
          name:
            (await Device.getDeviceNameOfMac(item["Endereço MAC"])) ??
            item["Nome"] ??
            "",
        })),
      ]);

    return devices;
  }
}
