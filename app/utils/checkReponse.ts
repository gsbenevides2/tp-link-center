import { Treaty } from "@elysia/eden";

export function checkResponse<T extends Record<number, unknown>>(
  response: Treaty.TreatyResponse<T>,
) {
  const { status, data, error } = response;
  const isSuccessResponse = status >= 200 && status <= 299;
  if (isSuccessResponse) return data;
  else throw error;
}
