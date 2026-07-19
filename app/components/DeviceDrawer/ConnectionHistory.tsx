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
        <div className="flex justify-center items-center py-8">
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
        <p className="text-gray-500 text-sm">
          Nenhum registro nas últimas 24 horas
        </p>
      </div>
    );
  }

  const onlineChecks = data.filter((c) => c.online).length;
  const totalChecks = data.length;
  const uptime =
    totalChecks > 0 ? Math.round((onlineChecks / totalChecks) * 100) : 0;

  return (
    <div className="mt-4">
      <h3 className="mb-2 font-bold text-base">Histórico de Conexão</h3>

      <div className="gap-2 grid grid-cols-3 mb-4 text-center">
        <div className="bg-base-100 p-2 border border-base-300 rounded">
          <div className="font-bold text-lg">{uptime}%</div>
          <div className="text-xs text-base-content/60">Uptime</div>
        </div>
        <div className="bg-success/10 p-2 border border-success/30 rounded">
          <div className="font-bold text-success text-lg">{onlineChecks}</div>
          <div className="text-success/80 text-xs">Online</div>
        </div>
        <div className="bg-error/10 p-2 border border-error/30 rounded">
          <div className="font-bold text-error text-lg">
            {totalChecks - onlineChecks}
          </div>
          <div className="text-error/80 text-xs">Offline</div>
        </div>
      </div>

      <div className="max-h-64 overflow-y-auto">
        <table className="table table-xs w-full">
          <thead>
            <tr>
              <th>Data/Hora</th>
              <th>Status</th>
              <th>Interfaces</th>
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
                <td>
                  {check.interfaces.length > 0 ? (
                    <div className="flex flex-wrap gap-1">
                      {check.interfaces.map((iface) => (
                        <span key={iface.mac} className="text-sm">
                          {iface.name}
                          {iface.routerInterface ? (
                            <span className="ml-1 text-xs text-base-content/50">
                              ({iface.routerInterface})
                            </span>
                          ) : null}
                        </span>
                      ))}
                    </div>
                  ) : (
                    <span className="text-xs text-base-content/50">-</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
