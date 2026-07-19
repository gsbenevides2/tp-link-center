import { clientSideApi } from "@/app/api/clientSide";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

type GetDeviceFunc = (typeof clientSideApi)["devices"]["get"];
export type GetDeviceFuncReturn = NonNullable<
  Awaited<ReturnType<GetDeviceFunc>>["data"]
>;

export type Device = GetDeviceFuncReturn[number];
export type DeviceType = Device["type"];

export const DEVICES_KEY = "devices" as const;
export const CHECKS_KEY = "checks" as const;

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

type GetCheckFunc = (typeof clientSideApi)["checks"]["latest"]["get"];
export type GetCheckFuncReturn = NonNullable<
  Awaited<ReturnType<GetCheckFunc>>["data"]
>;

export function useLatestCheckQuery() {
  return useQuery({
    queryKey: [CHECKS_KEY, "latest"],
    queryFn: async (): Promise<GetCheckFuncReturn> => {
      const response = await clientSideApi.checks.latest.get();
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

type AddDeviceParams = Parameters<typeof clientSideApi.devices.post>[0];

export function useAddDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (params: AddDeviceParams) => {
      const response = await clientSideApi.devices.post(params);
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });
}

type UpdateDeviceBody = Parameters<
  ReturnType<typeof clientSideApi.devices>["put"]
>[0];

export function useUpdateDevice() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deviceId,
      body,
    }: {
      deviceId: string;
      body: UpdateDeviceBody;
    }) => {
      await clientSideApi.devices({ id: deviceId }).put(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });
}

type AddInterfaceParams = Parameters<
  ReturnType<typeof clientSideApi.devices>["interface"]["post"]
>[0];

export function useAddInterface() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deviceId,
      body,
    }: {
      deviceId: string;
      body: AddInterfaceParams;
    }) => {
      await clientSideApi.devices({ id: deviceId }).interface.post(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });
}

type UpdateInterfaceBody = Parameters<
  ReturnType<ReturnType<typeof clientSideApi.devices>["interface"]>["put"]
>[0];

export function useUpdateInterface() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deviceId,
      interfaceId,
      body,
    }: {
      deviceId: string;
      interfaceId: string;
      body: UpdateInterfaceBody;
    }) => {
      await clientSideApi
        .devices({ id: deviceId })
        .interface({ interfaceId })
        .put(body);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });
}

export function useDeleteInterface() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      deviceId,
      interfaceId,
    }: {
      deviceId: string;
      interfaceId: string;
    }) => {
      await clientSideApi
        .devices({ id: deviceId })
        .interface({ interfaceId })
        .delete();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });
}

export function useSyncRouter() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await clientSideApi.sync.post();
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });
}

export function useTriggerOnlineCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async () => {
      const response = await clientSideApi.checks.trigger.post();
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [CHECKS_KEY, "latest"] });
      queryClient.invalidateQueries({ queryKey: [DEVICES_KEY] });
    },
  });
}
