import { UnwrapSchema } from "elysia";

export const RouterModel = {};

export type RouterModel = {
  [k in keyof typeof RouterModel]: UnwrapSchema<(typeof RouterModel)[k]>;
};
