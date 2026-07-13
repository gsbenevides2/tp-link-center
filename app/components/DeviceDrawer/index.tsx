"use client";
import { useCallback, useEffect, useLayoutEffect, useState } from "react";
import { useDevicesQuery } from "../RegisteredDevicesSection/useDevices";

interface Context {
  open: (deviceId: string) => void;
}

declare global {
  interface Window {
    deviceDrawer: Context;
  }
}

export function DeviceDrawer() {
  const [openedDeviceId, setOpenedDeviceId] = useState<string>();
  const { data } = useDevicesQuery();
  const selectedDevice = data?.find((d) => d.id === openedDeviceId);

  const openDeviceDrawer = useCallback((deviceId: string) => {
    setOpenedDeviceId(deviceId);
  }, []);

  useEffect(() => {
    window.deviceDrawer = {
      open: openDeviceDrawer,
    };
  }, [openDeviceDrawer]);

  return (
    <div className="drawer drawer-end">
      <input
        id="my-drawer-5"
        type="checkbox"
        className="drawer-toggle"
        checked={Boolean(openedDeviceId)}
        onChange={() => setOpenedDeviceId(undefined)}
      />
      <div className="drawer-side">
        <label
          htmlFor="my-drawer-5"
          aria-label="close sidebar"
          className="drawer-overlay"
        ></label>
        <ul className="bg-white p-4 w-100 min-h-full">
          <h2>Detalhes do Dispositívo</h2>
          <div>
            <p>
              <b>ID:</b> {selectedDevice?.id}
              <br />
              <b>Nome do Dispositivo:</b> {selectedDevice?.name}
              <br />
            </p>
          </div>
          <h3>Interfaces</h3>
          <h3>Histórico de Conexão</h3>
        </ul>
      </div>
    </div>
  );
}

export function useDeviceDrawer() {
  return typeof window !== "undefined" ? window.deviceDrawer : undefined;
}
