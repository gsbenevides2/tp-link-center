"use client";

import {
  VscAddCompact,
  VscOpenInWindow,
  VscRefreshCompact,
  VscTrash,
} from "react-icons/vsc";
import { ErrorMessage } from "./ErroMessage";
import { LoadingMessage } from "./LoadingMessage";
import { useDevicesQuery, useRemoveDevice } from "./useDevices";
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
  const { mutate: removeDevice, isPending, variables } = useRemoveDevice();
  const addDeviceModal = useAddDeviceModal();
  const deleteModalState = useDeleteModal((id) => removeDevice(id));
  const deviceDrawer = useDeviceDrawer();
  const isEmpty = !isLoading && !isRefetching && devices?.length === 0;

  return (
    <section>
      <div className="flex justify-between items-center pb-4">
        <h2 className="font-semibold text-lg">Dispositivos Registrados:</h2>
        <div className="flex gap-1">
          <button
            className="btn btn-sm btn-ghost"
            onClick={addDeviceModal?.open}
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
            {devices?.map((device) => (
              <tr key={device.id}>
                <th className="w-94">{device.id}</th>
                <td>{device.name}</td>
                <td>{device.brand}</td>
                <td>Connectado</td>
                <td className="w-68">
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
                    className="ml-1 btn btn-sm btn-ghost"
                    onClick={() => {
                      console.log(deviceDrawer);
                      deviceDrawer?.open(device.id);
                    }}
                  >
                    <VscOpenInWindow />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <DeleteModal {...deleteModalState.props} />
    </section>
  );
}
