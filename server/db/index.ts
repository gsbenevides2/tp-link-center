import { drizzle } from "drizzle-orm/bun-sqlite";
import { relations } from "./schema";

export const db = drizzle({
  connection: { source: process.env.DB_FILE_NAME! },
  relations,
});
