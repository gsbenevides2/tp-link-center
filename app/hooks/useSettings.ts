import { clientSideApi } from "@/app/api/clientSide";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const SETTINGS_KEY = "settings" as const;

type GetSettingsFunc = (typeof clientSideApi)["settings"]["get"];
export type GetSettingsFuncReturn = NonNullable<
  Awaited<ReturnType<GetSettingsFunc>>["data"]
>;

type UpdateSettingBody = Parameters<
  ReturnType<typeof clientSideApi.settings>["put"]
>[0];

export function useSettingsQuery() {
  return useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: async (): Promise<GetSettingsFuncReturn> => {
      const response = await clientSideApi.settings.get();
      if (response.error) throw response.error;
      return response.data;
    },
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      key,
      body,
    }: {
      key: string;
      body: UpdateSettingBody;
    }) => {
      const response = await clientSideApi.settings({ key }).put(body);
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] });
    },
  });
}
