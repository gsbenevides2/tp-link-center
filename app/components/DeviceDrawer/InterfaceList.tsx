import { VscAddCompact, VscEdit, VscTrash } from "react-icons/vsc";
import { Device } from "../RegisteredDevicesSection/useDevices";
import { useAddInterfaceModal } from "../AddInterfaceModal";
import {
  DeleteInterfaceModal,
  useDeleteInterfaceModal,
} from "./DeleteInterfaceModal";

export type Interface = Device["interfaces"][number];

interface Props {
  deviceId: string;
  interfaces: Interface[];
  onlineMacs: Set<string>;
}

export function InterfaceList({ interfaces, deviceId, onlineMacs }: Props) {
  const addInterfaceModal = useAddInterfaceModal();
  const deleteInterfaceModal = useDeleteInterfaceModal(deviceId);
  const hasInterfaces = interfaces.length > 0;

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-base">Interfaces</h3>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() => addInterfaceModal?.open(deviceId)}
        >
          <VscAddCompact />
        </button>
      </div>
      {hasInterfaces ? (
        <div className="mb-4 border border-base-content/5 rounded-box overflow-x-auto">
          <table className="table">
            <thead>
              <tr>
                <th>Nome</th>
                <th>MAC</th>
                <th>IP</th>
                <th>Status</th>
                <th className="w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map((iface) => {
                const isOnline = onlineMacs.has(iface.mac.toLowerCase());
                return (
                  <tr key={iface.id}>
                    <td>{iface.name}</td>
                    <td>{iface.mac}</td>
                    <td>{iface.ip}</td>
                    <td>
                      <span
                        className={`badge badge-sm ${isOnline ? "badge-success" : "badge-ghost"}`}
                      >
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td className="w-24">
                      <div className="flex gap-1">
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => addInterfaceModal?.open(deviceId, iface)}
                        >
                          <VscEdit />
                        </button>
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() => deleteInterfaceModal.open(iface)}
                        >
                          <VscTrash />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-4 text-base-content/60">
          Nenhuma interface encontrada.
        </p>
      )}
      <DeleteInterfaceModal {...deleteInterfaceModal.props} />
    </>
  );
}
