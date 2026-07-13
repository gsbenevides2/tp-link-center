import { ZodStringFormat } from "zod";

export function getRegexOfZod(schema: ZodStringFormat): string | undefined {
  return schema.def.pattern?.source;
}
