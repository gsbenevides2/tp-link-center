"use client";
import { useQuery } from "@tanstack/react-query";
import { clientSideApi } from "@/app/api/clientSide";

interface Props {
  deviceId: string;
}

export function ConnectionHistory({ deviceId }: Props) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["devices", deviceId, "history"],
    queryFn: async () => {
      const now = Date.now();
      const from = now - 24 * 60 * 60 * 1000;
      const response = await clientSideApi
        .devices({ id: deviceId })
        .history.get({ query: { from, to: now } });
      if (response.error) throw response.error;
      return response.data;
    },
    enabled: Boolean(deviceId),
    refetchInterval: 30000,
  });

  if (isLoading) {
    return (
      <div className="mt-4">
        <h3 className="mb-2 font-bold text-base">Histórico de Conexão</h3>
        <div className="flex items-center justify-center py-8">
          <span className="loading loading-spinner loading-sm"></span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mt-4">
        <h3 className="mb-2 font-bold text-base">Histórico de Conexão</h3>
        <div className="alert alert-error">
          <span>Erro ao carregar histórico</span>
        </div>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="mt-4">
        <h3 className="mb-2 font-bold text-base">Histórico de Conexão</h3>
        <p className="text-sm text-gray-500">
          Nenhum registro nas últimas 24 horas
        </p>
      </div>
    );
  }

  const onlineChecks = data.filter((c) => c.online).length;
  const totalChecks = data.length;
  const uptime = totalChecks > 0 ? Math.round((onlineChecks / totalChecks) * 100) : 0;

  return (
    <div className="mt-4">
      <h3 className="mb-2 font-bold text-base">Histórico de Conexão</h3>

      <div className="mb-4 grid grid-cols-3 gap-2 text-center">
        <div className="rounded bg-base-200 p-2">
          <div className="text-lg font-bold">{uptime}%</div>
          <div className="text-xs">Uptime</div>
        </div>
        <div className="rounded bg-success/20 p-2">
          <div className="text-lg font-bold text-success">{onlineChecks}</div>
          <div className="text-xs">Online</div>
        </div>
        <div className="rounded bg-error/20 p-2">
          <div className="text-lg font-bold text-error">{totalChecks - onlineChecks}</div>
          <div className="text-xs">Offline</div>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        <table className="table table-xs w-full">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((check) => (
              <tr key={check.checkId}>
                <td>
                  {new Date(check.createdAt).toLocaleString("pt-BR", {
                    day: "2-digit",
                    month: "2-digit",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </td>
                <td>
                  <span
                    className={`badge badge-sm ${check.online ? "badge-success" : "badge-error"}`}
                  >
                    {check.online ? "Online" : "Offline"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
