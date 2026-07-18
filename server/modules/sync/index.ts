import { Elysia, status, StatusMap } from "elysia";
import { SyncModel } from "./model";
import { Sync } from "./service";

export const sync = new Elysia({
  prefix: "/sync",
  detail: {
    tags: ["Sync"],
  },
})
  .post(
    "/",
    async () => {
      const result = await Sync.syncAll();
      return status(StatusMap.OK, result);
    },
    {
      detail: {
        summary: "Sync Database to Router",
        description:
          "Synchronize DHCP reservations and firewall allow list from database to router. " +
          "Removes entries that no longer exist in DB and adds pending ones.",
      },
      response: {
        [StatusMap.OK]: SyncModel.syncResponse,
      },
    },
  );
