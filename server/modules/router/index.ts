import { Elysia, status, StatusMap } from "elysia";
import z from "zod";
import { Router } from "./service";

export const router = new Elysia({
  prefix: "/router",
  detail: {
    tags: ["Router"],
  },
})
  .post(
    "/sync",
    async () => {
      await Router.syncSettings();
      return status(StatusMap["No Content"]);
    },
    {
      detail: {
        summary: "Sync Router Settings",
        description:
          "This call scrapping in router web interface to get connected devices.",
      },
      response: {
        [StatusMap["No Content"]]: z.void(),
      },
    },
  )
  .post(
    "/restart-network",
    async () => {
      await Router.restartNetwork();
      return status(StatusMap.OK, { success: true });
    },
    {
      detail: {
        summary: "Restart Network",
        description:
          "Restart all routers in the network. Agents are restarted first, then the controller.",
      },
      response: {
        [StatusMap.OK]: z.object({
          success: z.boolean().meta({
            title: "Success",
            description: "Whether the restart was successful.",
          }),
        }),
      },
    },
  );
