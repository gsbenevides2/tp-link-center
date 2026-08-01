"use client";

import { useRouterStatusQuery } from "../RegisteredDevicesSection/useDevices";
import {
  VscGlobe,
  VscClockface,
  VscServer,
  VscArrowDown,
  VscArrowUp,
  VscRefresh,
  VscGear,
} from "react-icons/vsc";

function StatusCard({
  icon,
  label,
  value,
  subValue,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subValue?: string | null;
}) {
  return (
    <div className="bg-base-200 shadow-sm card">
      <div className="p-4 card-body">
        <div className="flex items-center gap-2 text-base-content/60">
          {icon}
          <span className="font-medium text-xs uppercase">{label}</span>
        </div>
        <div className="font-semibold text-lg">{value}</div>
        {subValue && (
          <div className="text-xs text-base-content/50">{subValue}</div>
        )}
      </div>
    </div>
  );
}

function MetricBar({ label, value }: { label: string; value: number | null }) {
  if (value === null) return null;
  return (
    <div>
      <div className="flex justify-between mb-1 text-xs">
        <span>{label}</span>
        <span>{value}%</span>
      </div>
      <progress
        className={`progress w-full ${value > 80 ? "progress-error" : value > 60 ? "progress-warning" : "progress-primary"}`}
        value={value}
        max="100"
      ></progress>
    </div>
  );
}

export function RouterStatus() {
  const { data, isLoading, error, refetch, isRefetching } =
    useRouterStatusQuery();

  if (isLoading) {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Status do Roteador</h2>
        </div>
        <div className="gap-3 grid grid-cols-2 md:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-base-200 shadow-sm card">
              <div className="p-4 card-body">
                <div className="mb-2 w-20 h-4 skeleton"></div>
                <div className="w-28 h-6 skeleton"></div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="mb-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="font-semibold text-lg">Status do Roteador</h2>
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => refetch()}
            disabled={isRefetching}
          >
            <VscRefresh />
            Tentar novamente
          </button>
        </div>
        <div className="alert alert-error">
          <span>Erro ao carregar status do roteador</span>
        </div>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="mb-6">
      <div className="flex justify-between items-center mb-4">
        <h2 className="font-semibold text-lg">Status do Roteador</h2>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => refetch()}
          disabled={isRefetching}
        >
          {isRefetching ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <VscRefresh />
          )}
          Atualizar
        </button>
      </div>

      <div className="gap-3 grid grid-cols-2 md:grid-cols-4 mb-4">
        <StatusCard
          icon={<VscGlobe />}
          label="IP Público"
          value={data.wanIp}
          subValue={data.connectionStatus}
        />
        <StatusCard
          icon={<VscClockface />}
          label="Uptime Conexão"
          value={data.connectionUptime}
        />
        <StatusCard
          icon={<VscServer />}
          label="Uptime Roteador"
          value={data.routerUptime}
        />
        <StatusCard
          icon={<VscGear />}
          label="Firmware"
          value={data.firmwareVersion}
          subValue={data.hardwareVersion}
        />
      </div>

      <div className="gap-3 grid grid-cols-2 md:grid-cols-4">
        {data.totalDownload && (
          <StatusCard
            icon={<VscArrowDown />}
            label="Total Download"
            value={data.totalDownload}
          />
        )}
        {data.totalUpload && (
          <StatusCard
            icon={<VscArrowUp />}
            label="Total Upload"
            value={data.totalUpload}
          />
        )}
        {(data.cpuUsage !== null || data.memoryUsage !== null) && (
          <div className="col-span-2 bg-base-200 shadow-sm card">
            <div className="gap-3 p-4 card-body">
              <MetricBar label="CPU" value={data.cpuUsage} />
              <MetricBar label="Memória" value={data.memoryUsage} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
