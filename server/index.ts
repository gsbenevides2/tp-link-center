import Elysia from "elysia";
import { openapi } from "@/server/openapi";
import { device } from "@/server/modules/devices";
import { router } from "@/server/modules/router";
import { checks } from "@/server/modules/checks";
import { sync } from "@/server/modules/sync";

export const app = new Elysia({ prefix: "/api" })
  .use(openapi)
  .use(device)
  .use(router)
  .use(checks)
  .use(sync);
