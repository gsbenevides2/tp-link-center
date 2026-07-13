import { Elysia, status, StatusMap } from "elysia";
import { CheckModel } from "@/server/modules/checks/model";
import { Check } from "@/server/modules/checks/service";

export const checks = new Elysia({
  prefix: "/checks",
  detail: {
    tags: ["Checks"],
  },
})
  .get(
    "/latest",
    async () => {
      return status(StatusMap.OK, await Check.getLatest());
    },
    {
      detail: {
        summary: "Get Latest Check",
        description:
          "Returns the most recent online check with the list of devices that were online.",
      },
      response: {
        [StatusMap.OK]: CheckModel.getLatestCheckResponse,
      },
    },
  );
