import { clientSideApi } from "@/app/api/clientSide";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type GetDeviceFunc = (typeof clientSideApi)["devices"]["get"];
export type GetDeviceFuncReturn = NonNullable<
  Awaited<ReturnType<GetDeviceFunc>>["data"]
>;

export type Device = GetDeviceFuncReturn[number];

export const DEVICES_KEY = "devices" as const;

export function useDevicesQuery() {
  return useQuery({
    queryKey: [DEVICES_KEY],
    queryFn: async (): Promise<GetDeviceFuncReturn> => {
      const response = await clientSideApi.devices.get();
      if (response.error) throw response.error;
      return response.data;
    },
  });
}

export function useRemoveDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (deviceId: string) => {
      await clientSideApi.devices({ id: deviceId }).delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });
}
