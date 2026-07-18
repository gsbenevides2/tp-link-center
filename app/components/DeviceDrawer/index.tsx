"use client";
import { useCallback, useEffect, useState } from "react";
import {
  useDevicesQuery,
  useLatestCheckQuery,
} from "../RegisteredDevicesSection/useDevices";
import { ConnectionHistory } from "./ConnectionHistory";
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
  const { data: latestCheck } = useLatestCheckQuery();
  const selectedDevice = data?.find((d) => d.id === openedDeviceId);
  const onlineMacs = new Set(
    latestCheck?.devices.map((d) => d.mac.toLowerCase()) ?? [],
  );

  const macToRouterInterface = new Map(
    latestCheck?.devices
      .filter((d): d is typeof d & { routerInterface: string } => d.routerInterface != null)
      .map((d) => [d.mac.toLowerCase(), d.routerInterface]) ?? [],
  );

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
        <div className="bg-white p-4 w-200 min-h-full">
          {selectedDevice ? <DeviceInfo device={selectedDevice} /> : null}

          {selectedDevice ? (
            <InterfaceList
              deviceId={selectedDevice.id}
              deviceType={selectedDevice.type}
              interfaces={selectedDevice.interfaces}
              onlineMacs={onlineMacs}
              macToRouterInterface={macToRouterInterface}
            />
          ) : null}

          {selectedDevice ? (
            <ConnectionHistory deviceId={selectedDevice.id} />
          ) : null}
        </div>
      </div>
    </div>
  );
}

export function useDeviceDrawer() {
  return typeof window !== "undefined" ? window.deviceDrawer : undefined;
}
