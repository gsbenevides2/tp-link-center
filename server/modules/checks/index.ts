import { Elysia, status, StatusMap } from "elysia";
import { CheckModel } from "@/server/modules/checks/model";
import { Check } from "@/server/modules/checks/service";
import { performOnlineCheck } from "@/server/cron";

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
  )
  .post(
    "/trigger",
    async () => {
      await performOnlineCheck();
      return status(StatusMap.OK, { success: true });
    },
    {
      detail: {
        summary: "Trigger Online Check",
        description:
          "Manually triggers an online check to detect connected devices on the router.",
      },
      response: {
        [StatusMap.OK]: CheckModel.triggerCheckResponse,
      },
    },
  );
