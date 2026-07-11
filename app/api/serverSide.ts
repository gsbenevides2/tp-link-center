import { treaty } from "@elysia/eden";
import { app } from "@/server";

export const serverSideApi = treaty(app).api;
