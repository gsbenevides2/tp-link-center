import { defineRelations, sql } from "drizzle-orm";
import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const devices = sqliteTable("devices", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  brand: text().notNull(),
});

export const interfaces = sqliteTable("interfaces", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  name: text().notNull(),
  mac: text().notNull(),
  ip: text().notNull(),
  deviceId: text().notNull(),
});

export const onlineChecks = sqliteTable("onlineChecks", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  createdAt: integer({
    mode: "timestamp_ms",
  })
    .notNull()
    .default(sql`(unixepoch())`),
});

export const onlineDevicesChecks = sqliteTable("onlineDeviceChecks", {
  id: text()
    .primaryKey()
    .$defaultFn(() => crypto.randomUUID()),
  mac: text().notNull(),
  ip: text().notNull(),
  vendor: text().notNull(),
  name: text().notNull(),
  checkId: text().notNull(),
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
