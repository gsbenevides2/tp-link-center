import { db } from "@/server/db";
import { Router } from "../router/service";
import type { SyncModel } from "./model";

function normalizeMac(mac: string): string {
  return mac.toUpperCase().trim();
}

export class Sync {
  static async syncAll(): Promise<SyncModel["syncResponse"]> {
    const [dhcpResult, firewallResult] = await Promise.all([
      this.syncDhcp(),
      this.syncFirewall(),
    ]);

    return {
      dhcp: dhcpResult,
      firewall: firewallResult,
    };
  }

  static async syncDhcp(): Promise<{
    added: number;
    removed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let added = 0;
    let removed = 0;

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

    const routerEntries = await Router.listDHCPEntry();

    const dbMacs = new Set(interfacesToSync.map((i) => normalizeMac(i.mac)));
    const routerMacToEntry = new Map(
      routerEntries.map((e) => [normalizeMac(e.mac), e]),
    );

    for (const entry of routerEntries) {
      const normalizedMac = normalizeMac(entry.mac);
      if (!dbMacs.has(normalizedMac)) {
        try {
          await Router.removeDHCPEntry(entry.entryId);
          removed++;
        } catch (e) {
          errors.push(
            `Failed to remove DHCP entry for ${entry.mac}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    for (const iface of interfacesToSync) {
      const normalizedMac = normalizeMac(iface.mac);
      if (!routerMacToEntry.has(normalizedMac)) {
        try {
          await Router.addDHCPEntry(iface.mac, iface.ip);
          added++;
        } catch (e) {
          errors.push(
            `Failed to add DHCP entry for ${iface.mac}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    return { added, removed, errors };
  }

  static async syncFirewall(): Promise<{
    added: number;
    removed: number;
    errors: string[];
  }> {
    const errors: string[] = [];
    let added = 0;
    let removed = 0;

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

    const chains = await Router.listFirewallChains();
    const accessChain = chains.find((c) => c.name === "ACCESSCTL_WHITE");

    if (!accessChain) {
      errors.push("Could not find ACCESSCTL_BLACK firewall chain");
      return { added, removed, errors };
    }

    const allRouterRules = await Router.listFirewallRules();
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
        try {
          await Router.removeFirewallRule(rule.stack);
          removed++;
        } catch (e) {
          errors.push(
            `Failed to remove firewall rule for ${rule.sourceMAC}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    for (const iface of clientInterfaces) {
      const normalizedMac = normalizeMac(iface.mac);
      if (!routerMacToRule.has(normalizedMac)) {
        try {
          await Router.addFirewallRule({
            chainStack: accessChain.stack,
            name: iface.name,
            sourceMAC: iface.mac,
            target: "Accept",
          });
          added++;
        } catch (e) {
          errors.push(
            `Failed to add firewall rule for ${iface.mac}: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
    }

    return { added, removed, errors };
  }
}
