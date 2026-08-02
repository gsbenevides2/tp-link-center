"use client";

import { Logo } from "@/app/icons/logo";
import {
  useSyncRouter,
  useRestartNetwork,
} from "../RegisteredDevicesSection/useDevices";
import { VscSync, VscDebugRestart } from "react-icons/vsc";

export function Header() {
  const { mutate: syncRouter, isPending } = useSyncRouter();
  const { mutate: restartNetwork, isPending: isRestarting } =
    useRestartNetwork();

  return (
    <header className="flex justify-between items-center bg-primary px-12 py-4 text-white">
      <div className="flex items-center">
        <Logo height={45} mode="white" />
        <h1 className="pl-12 font-semibold text-xl">
          Centro de Administração de Dispositivos
        </h1>
      </div>
      <div className="flex gap-2">
        <button
          className="text-white btn btn-sm btn-ghost"
          onClick={() => syncRouter()}
          disabled={isPending}
        >
          {isPending ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <VscSync />
          )}
          Sincronizar
        </button>
        <button
          className="text-white btn btn-sm btn-ghost"
          onClick={() => restartNetwork()}
          disabled={isRestarting}
        >
          {isRestarting ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <VscDebugRestart />
          )}
          Reiniciar Rede
        </button>
      </div>
    </header>
  );
}
