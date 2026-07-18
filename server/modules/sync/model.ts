import { UnwrapSchema } from "elysia";
import z from "zod";

const syncResultSchema = z
  .object({
    added: z.number().meta({
      title: "Added",
      description: "Number of entries added.",
      example: 2,
    }),
    removed: z.number().meta({
      title: "Removed",
      description: "Number of entries removed.",
      example: 1,
    }),
    errors: z
      .array(z.string())
      .meta({
        title: "Errors",
        description: "List of errors encountered during sync.",
      }),
  })
  .meta({
    title: "Sync Result",
    description: "Result of a sync operation for a specific feature.",
  });

export const SyncModel = {
  syncResponse: z
    .object({
      dhcp: syncResultSchema.meta({
        title: "DHCP Sync Result",
        description: "Result of DHCP reservation sync.",
      }),
      firewall: syncResultSchema.meta({
        title: "Firewall Sync Result",
        description: "Result of firewall allow list sync.",
      }),
    })
    .meta({
      title: "Sync Response",
      description: "Result of the full synchronization.",
    }),
};

export type SyncModel = {
  [k in keyof typeof SyncModel]: UnwrapSchema<(typeof SyncModel)[k]>;
};
