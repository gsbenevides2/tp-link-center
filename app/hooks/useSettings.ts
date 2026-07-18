import { clientSideApi } from "@/app/api/clientSide";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

export const SETTINGS_KEY = "settings" as const;

export function useSettingsQuery() {
  return useQuery({
    queryKey: [SETTINGS_KEY],
    queryFn: async () => {
      const response = await clientSideApi.settings.get();
      if (response.error) throw response.error;
      return response.data;
    },
  });
}

export function useUpdateSetting() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const response = await clientSideApi.settings({ key }).put({ value });
      if (response.error) throw response.error;
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [SETTINGS_KEY] });
    },
  });
}
