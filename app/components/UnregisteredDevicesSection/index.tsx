"use client";

import { useMemo, useState, useCallback } from "react";
import { VscLink, VscAdd, VscRefreshCompact } from "react-icons/vsc";
import {
  useDevicesQuery,
  useLatestCheckQuery,
  useAddDevice,
  useAddInterface,
} from "../RegisteredDevicesSection/useDevices";

export function UnregisteredDevicesSection() {
  const { data: devices, isLoading: devicesLoading } = useDevicesQuery();
  const {
    data: latestCheck,
    isLoading: checksLoading,
    isRefetching,
    refetch,
  } = useLatestCheckQuery();

  const { mutateAsync: addDevice } = useAddDevice();
  const { mutateAsync: addInterface } = useAddInterface();

  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [selectedMac, setSelectedMac] = useState("");
  const [selectedIp, setSelectedIp] = useState("");
  const [selectedDeviceId, setSelectedDeviceId] = useState("");
  const [interfaceName, setInterfaceName] = useState("");
  const [deviceName, setDeviceName] = useState("");
  const [deviceBrand, setDeviceBrand] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const registeredMacs = useMemo(() => {
    const macs = new Set<string>();
    for (const device of devices ?? []) {
      for (const iface of device.interfaces) {
        macs.add(iface.mac.toLowerCase());
      }
    }
    return macs;
  }, [devices]);

  const unregisteredDevices = useMemo(() => {
    return (
      latestCheck?.devices.filter(
        (d) => !registeredMacs.has(d.mac.toLowerCase()),
      ) ?? []
    );
  }, [latestCheck, registeredMacs]);

  const isLoading = devicesLoading || checksLoading;
  const isEmpty = !isLoading && unregisteredDevices.length === 0;

  const openLinkModal = useCallback((mac: string, ip: string) => {
    setSelectedMac(mac);
    setSelectedIp(ip);
    setSelectedDeviceId("");
    setInterfaceName("");
    setLinkModalOpen(true);
  }, []);

  const openCreateModal = useCallback((mac: string, ip: string, name: string, vendor: string) => {
    setSelectedMac(mac);
    setSelectedIp(ip);
    setDeviceName(name);
    setDeviceBrand(vendor);
    setInterfaceName("");
    setCreateModalOpen(true);
  }, []);

  const handleLinkSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!selectedDeviceId || !interfaceName) return;
      setSubmitting(true);
      try {
        await addInterface({
          deviceId: selectedDeviceId,
          body: { name: interfaceName, mac: selectedMac, ip: selectedIp },
        });
        setLinkModalOpen(false);
      } finally {
        setSubmitting(false);
      }
    },
    [selectedDeviceId, interfaceName, selectedMac, selectedIp, addInterface],
  );

  const handleCreateSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!deviceName || !deviceBrand || !interfaceName) return;
      setSubmitting(true);
      try {
        const result = await addDevice({ name: deviceName, brand: deviceBrand });
        const newDeviceId = (result as { id: string }).id;
        await addInterface({
          deviceId: newDeviceId,
          body: { name: interfaceName, mac: selectedMac, ip: selectedIp },
        });
        setCreateModalOpen(false);
      } finally {
        setSubmitting(false);
      }
    },
    [deviceName, deviceBrand, interfaceName, selectedMac, selectedIp, addDevice, addInterface],
  );

  return (
    <section className="mt-8">
      <div className="flex justify-between items-center pb-4">
        <h2 className="font-semibold text-lg">Dispositivos Não Registrados:</h2>
        <button className="btn btn-sm btn-ghost" onClick={() => refetch()}>
          {isRefetching ? (
            <span className="loading loading-spinner loading-sm"></span>
          ) : (
            <VscRefreshCompact />
          )}
        </button>
      </div>
      <div className="border border-base-content/5 rounded-box overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Fabricante</th>
              <th>MAC</th>
              <th>IP</th>
              <th>Roteador</th>
              <th className="w-48">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} className="text-center">
                  <span className="loading loading-spinner loading-sm"></span>
                </td>
              </tr>
            ) : null}
            {isEmpty ? (
              <tr>
                <td colSpan={6} className="text-center text-base-content/60">
                  Todos os dispositivos estão registrados.
                </td>
              </tr>
            ) : null}
            {unregisteredDevices.map((device) => (
              <tr key={device.id}>
                <td>{device.name}</td>
                <td>{device.vendor}</td>
                <td>{device.mac}</td>
                <td>{device.ip}</td>
                <td>
                  {device.routerInterface ? (
                    <span className="text-sm">{device.routerInterface}</span>
                  ) : (
                    <span className="text-xs text-base-content/50">-</span>
                  )}
                </td>
                <td className="w-48">
                  <div className="flex gap-1">
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => openLinkModal(device.mac, device.ip)}
                      title="Vincular a dispositivo existente"
                    >
                      <VscLink />
                    </button>
                    <button
                      className="btn btn-sm btn-ghost"
                      onClick={() => openCreateModal(device.mac, device.ip, device.name, device.vendor)}
                      title="Criar novo dispositivo"
                    >
                      <VscAdd />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Link to existing device modal */}
      <dialog
        className={`modal ${linkModalOpen ? "modal-open" : ""}`}
        onClose={() => setLinkModalOpen(false)}
      >
        <div className="max-w-100 modal-box">
          <h3 className="font-bold text-lg">Vincular a Dispositivo</h3>
          <form className="flex flex-col gap-2 py-4" onSubmit={handleLinkSubmit}>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">MAC</label>
              <input
                className="input input-bordered input-sm"
                value={selectedMac}
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">IP</label>
              <input
                className="input input-bordered input-sm"
                value={selectedIp}
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Dispositivo</label>
              <select
                className="select select-bordered select-sm"
                value={selectedDeviceId}
                onChange={(e) => setSelectedDeviceId(e.target.value)}
                required
              >
                <option value="" disabled>
                  Selecione um dispositivo
                </option>
                {devices?.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.brand})
                  </option>
                ))}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Nome da Interface</label>
              <input
                className="input input-bordered input-sm"
                placeholder="Ex: Wi-Fi, Ethernet..."
                value={interfaceName}
                onChange={(e) => setInterfaceName(e.target.value)}
                required
              />
            </div>
            <div className="modal-action">
              <button
                className="btn"
                type="button"
                onClick={() => setLinkModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Vincular"
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setLinkModalOpen(false)}>close</button>
        </form>
      </dialog>

      {/* Create new device modal */}
      <dialog
        className={`modal ${createModalOpen ? "modal-open" : ""}`}
        onClose={() => setCreateModalOpen(false)}
      >
        <div className="max-w-100 modal-box">
          <h3 className="font-bold text-lg">Criar Novo Dispositivo</h3>
          <form
            className="flex flex-col gap-2 py-4"
            onSubmit={handleCreateSubmit}
          >
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">MAC</label>
              <input
                className="input input-bordered input-sm"
                value={selectedMac}
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">IP</label>
              <input
                className="input input-bordered input-sm"
                value={selectedIp}
                readOnly
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Nome do Dispositivo
              </label>
              <input
                className="input input-bordered input-sm"
                placeholder="Digite o nome do dispositivo:"
                value={deviceName}
                onChange={(e) => setDeviceName(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">
                Fabricante do Dispositivo
              </label>
              <input
                className="input input-bordered input-sm"
                placeholder="Digite o fabricante do dispositivo:"
                value={deviceBrand}
                onChange={(e) => setDeviceBrand(e.target.value)}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-sm font-medium">Nome da Interface</label>
              <input
                className="input input-bordered input-sm"
                placeholder="Ex: Wi-Fi, Ethernet..."
                value={interfaceName}
                onChange={(e) => setInterfaceName(e.target.value)}
                required
              />
            </div>
            <div className="modal-action">
              <button
                className="btn"
                type="button"
                onClick={() => setCreateModalOpen(false)}
              >
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <span className="loading loading-spinner loading-sm"></span>
                ) : (
                  "Criar"
                )}
              </button>
            </div>
          </form>
        </div>
        <form method="dialog" className="modal-backdrop">
          <button onClick={() => setCreateModalOpen(false)}>close</button>
        </form>
      </dialog>
    </section>
  );
}
