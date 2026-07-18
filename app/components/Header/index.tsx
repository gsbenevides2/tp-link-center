"use client";

import { Logo } from "@/app/icons/logo";
import { useSyncRouter, useTriggerOnlineCheck } from "../RegisteredDevicesSection/useDevices";
import { VscSync, VscCheck } from "react-icons/vsc";

export function Header() {
  const { mutate: syncRouter, isPending } = useSyncRouter();
  const { mutate: triggerCheck, isPending: isTriggering } = useTriggerOnlineCheck();

  return (
    <header className="flex items-center justify-between bg-primary px-12 py-4 text-white">
      <div className="flex items-center">
        <Logo height={45} mode="white" />
        <h1 className="pl-12 font-semibold text-xl">
          Centro de Administração de Dispositivos
        </h1>
      </div>
      <div className="flex gap-2">
        <button
          className="btn btn-sm btn-ghost text-white"
          onClick={() => triggerCheck()}
          disabled={isTriggering}
        >
          {isTriggering ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <VscCheck />
          )}
          Verificar Dispositivos
        </button>
        <button
          className="btn btn-sm btn-ghost text-white"
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
      </div>
    </header>
  );
}
