"use client";
import { useCallback, useEffect, useState } from "react";
import { useDevicesQuery } from "../RegisteredDevicesSection/useDevices";
import { DeviceInfo } from "./DeviceInfo";
import { InterfaceList } from "./InterfaceList";

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
        <div className="bg-white p-4 w-180 min-h-full">
          {selectedDevice ? <DeviceInfo device={selectedDevice} /> : null}

          {selectedDevice ? (
            <InterfaceList
              deviceId={selectedDevice.id}
              interfaces={selectedDevice.interfaces}
            />
          ) : null}

          <h3 className="mb-2 font-bold text-base">Histórico de Conexão</h3>
        </div>
      </div>
    </div>
  );
}

export function useDeviceDrawer() {
  return typeof window !== "undefined" ? window.deviceDrawer : undefined;
}
