"use client";

import { VscRefreshCompact, VscTrash } from "react-icons/vsc";
import { ErrorMessage } from "./ErroMessage";
import { LoadingMessage } from "./LoadingMessage";
import { useDevicesQuery, useRemoveDevice } from "./useDevices";
import { DeleteModal, useDeleteModal } from "./DeleteModal";

export function DeviceList() {
  const {
    data: devices,
    isLoading,
    error,
    isRefetching,
    refetch,
  } = useDevicesQuery();
  const { mutate: removeDevice, isPending, variables } = useRemoveDevice();

  const deleteModalState = useDeleteModal((id) => removeDevice(id));

  return (
    <section>
      <div className="flex justify-between items-center pb-4">
        <h2 className="font-semibold text-lg">Dispositivos Registrados:</h2>
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
