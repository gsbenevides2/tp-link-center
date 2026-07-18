"use client";

import { Logo } from "@/app/icons/logo";
import { useSyncRouter } from "../RegisteredDevicesSection/useDevices";
import { VscSync } from "react-icons/vsc";

export function Header() {
  const { mutate: syncRouter, isPending } = useSyncRouter();

  return (
    <header className="flex items-center justify-between bg-primary px-12 py-4 text-white">
      <div className="flex items-center">
        <Logo height={45} mode="white" />
        <h1 className="pl-12 font-semibold text-xl">
          Centro de Administração de Dispositivos
        </h1>
      </div>
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
    </header>
  );
}
