import { defineRelations, sql } from "drizzle-orm";
import {
  boolean,
  pgEnum,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

export const deviceTypeEnum = pgEnum("device_type", ["router", "client"]);

export const settings = pgTable("settings", {
  key: text().primaryKey(),
  value: text().notNull(),
});

export const devices = pgTable("devices", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  brand: text().notNull(),
  type: deviceTypeEnum().notNull().default("client"),
  isController: boolean().notNull().default(false),
  routerPassword: text(),
});

export const interfaces = pgTable("interfaces", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  mac: text().notNull(),
  ip: text().notNull(),
  deviceId: text().notNull(),
  reservedIp: boolean().notNull().default(false),
  allowList: boolean().notNull().default(false),
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
  { devices, interfaces, onlineChecks, onlineDevicesChecks, settings },
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
