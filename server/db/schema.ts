import { defineRelations } from "drizzle-orm";
import { sqliteTable, text } from "drizzle-orm/sqlite-core";

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

export const relations = defineRelations({ devices, interfaces }, (r) => ({
  interfaces: {
    devices: r.one.devices({
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
}));
