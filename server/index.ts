import Elysia from "elysia";
import { openapi } from "@/server/openapi";
import { device } from "@/server/modules/devices";

export const app = new Elysia({ prefix: "/api" }).use(openapi).use(device);
