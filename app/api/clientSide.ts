import { treaty } from "@elysia/eden";
import type { app } from "@/server";

export const clientSideApi = treaty<typeof app>("", {
  keepDomain: true,
}).api;
