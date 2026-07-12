import Elysia from "elysia";
import { openapi } from "@/server/openapi";
import { device } from "@/server/modules/devices";
import { router } from "@/server/modules/router";

export const app = new Elysia({ prefix: "/api" })
  .use(openapi)
  .use(device)
  .use(router);
