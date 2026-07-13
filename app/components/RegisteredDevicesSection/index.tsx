"use client";

import {
  VscAddCompact,
  VscEdit,
  VscOpenInWindow,
  VscRefreshCompact,
  VscTrash,
} from "react-icons/vsc";
import { ErrorMessage } from "./ErroMessage";
import { LoadingMessage } from "./LoadingMessage";
import {
  useDevicesQuery,
  useLatestCheckQuery,
  useRemoveDevice,
} from "./useDevices";
import { DeleteModal, useDeleteModal } from "./DeleteModal";
import { EmptyMessage } from "./EmptyMessage";
import { useAddDeviceModal } from "../AddDeviceModal";
import { useDeviceDrawer } from "../DeviceDrawer";

export function RegisteredDevicesSection() {
  const {
    data: devices,
    isLoading,
    error,
    isRefetching,
    refetch,
  } = useDevicesQuery();
  const { data: latestCheck } = useLatestCheckQuery();
  const { mutate: removeDevice, isPending, variables } = useRemoveDevice();
  const addDeviceModal = useAddDeviceModal();
  const deleteModalState = useDeleteModal((id) => removeDevice(id));
  const deviceDrawer = useDeviceDrawer();
  const isEmpty = !isLoading && !isRefetching && devices?.length === 0;

  const onlineMacs = new Set(
    latestCheck?.devices.map((d) => d.mac.toLowerCase()) ?? [],
  );

  function isDeviceOnline(device: NonNullable<typeof devices>[number]) {
    return device.interfaces.some((iface) =>
      onlineMacs.has(iface.mac.toLowerCase()),
    );
  }

  return (
    <section>
      <div className="flex justify-between items-center pb-4">
        <h2 className="font-semibold text-lg">Dispositivos Registrados:</h2>
        <div className="flex gap-1">
          <button
            className="btn btn-sm btn-ghost"
            onClick={() => addDeviceModal?.open()}
          >
            <VscAddCompact />
          </button>
          <button className="btn btn-sm btn-ghost" onClick={() => refetch()}>
            {isRefetching ? (
              <span className="loading loading-spinner loading-sm"></span>
            ) : (
              <VscRefreshCompact />
            )}
          </button>
        </div>
      </div>
      <div className="border border-base-content/5 rounded-box overflow-x-auto">
        <table className="table">
          <thead>
            <tr>
              <th className="w-94">ID</th>
              <th>Nome</th>
              <th>Fabricante</th>
              <th>Status</th>
              <th className="w-68">Ações</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? <LoadingMessage /> : null}
            {error ? <ErrorMessage /> : null}
            {isEmpty ? <EmptyMessage /> : null}
            {devices?.map((device) => {
              const online = isDeviceOnline(device);
              return (
                <tr key={device.id}>
                  <th className="w-94">{device.id}</th>
                  <td>{device.name}</td>
                  <td>{device.brand}</td>
                  <td>
                    {online ? (
                      <span className="badge badge-success badge-sm">
                        Conectado
                      </span>
                    ) : (
                      <span className="badge badge-error badge-sm">
                        Desconectado
                      </span>
                    )}
                  </td>
                  <td className="w-68">
                    <div className="flex gap-1">
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => addDeviceModal?.open(device)}
                      >
                        <VscEdit />
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => deleteModalState.open(device)}
                      >
                        {isPending && variables === device.id ? (
                          <span className="loading loading-spinner loading-sm"></span>
                        ) : (
                          <VscTrash />
                        )}
                      </button>
                      <button
                        className="btn btn-sm btn-ghost"
                        onClick={() => {
                          deviceDrawer?.open(device.id);
                        }}
                      >
                        <VscOpenInWindow />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <DeleteModal {...deleteModalState.props} />
    </section>
  );
}
