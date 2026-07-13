import { defineRelations, sql } from "drizzle-orm";
import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const devices = pgTable("devices", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  brand: text().notNull(),
});

export const interfaces = pgTable("interfaces", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  mac: text().notNull(),
  ip: text().notNull(),
  deviceId: text().notNull(),
});

export const onlineChecks = pgTable("onlineChecks", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: timestamp({ mode: "date" })
    .notNull()
    .default(sql`now()`),
});

export const onlineDevicesChecks = pgTable("onlineDeviceChecks", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  mac: text().notNull(),
  ip: text().notNull(),
  vendor: text().notNull(),
  name: text().notNull(),
  checkId: text().notNull(),
  routerInterface: text().default("Unknown"),
});

export const relations = defineRelations(
  { devices, interfaces, onlineChecks, onlineDevicesChecks },
  (r) => ({
    interfaces: {
      device: r.one.devices({
        from: r.interfaces.deviceId,
        to: r.devices.id,
      }),
    },
    devices: {
      interfaces: r.many.interfaces({
        from: r.devices.id,
        to: r.interfaces.deviceId,
      }),
    },
    onlineDevicesChecks: {
      check: r.one.onlineChecks({
        from: r.onlineDevicesChecks.checkId,
        to: r.onlineChecks.id,
      }),
    },
    onlineChecks: {
      devices: r.many.onlineDevicesChecks({
        from: r.onlineChecks.id,
        to: r.onlineDevicesChecks.checkId,
      }),
    },
  }),
);
