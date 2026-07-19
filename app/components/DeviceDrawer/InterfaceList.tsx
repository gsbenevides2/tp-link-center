import { VscAddCompact, VscEdit, VscTrash } from "react-icons/vsc";
import { Device, DeviceType } from "../RegisteredDevicesSection/useDevices";
import { useAddInterfaceModal } from "../AddInterfaceModal";
import {
  DeleteInterfaceModal,
  useDeleteInterfaceModal,
} from "./DeleteInterfaceModal";

export type Interface = Device["interfaces"][number];

interface Props {
  deviceId: string;
  deviceType: DeviceType;
  isController: boolean;
  interfaces: Interface[];
  onlineMacs: Set<string>;
  macToRouterInterface: Map<string, string>;
}

export function InterfaceList({
  interfaces,
  deviceId,
  deviceType,
  isController,
  onlineMacs,
  macToRouterInterface,
}: Props) {
  const addInterfaceModal = useAddInterfaceModal();
  const deleteInterfaceModal = useDeleteInterfaceModal(deviceId);
  const hasInterfaces = interfaces.length > 0;
  const isRouter = deviceType === "router";

  if (isRouter) {
    const iface = interfaces[0];
    if (!iface) {
      return (
        <div className="mb-4">
          <h3 className="mb-2 font-bold text-base">Interface</h3>
          <p className="text-base-content/60">Nenhuma interface configurada.</p>
          <button
            className="mt-2 btn btn-sm btn-primary"
            onClick={() =>
              addInterfaceModal?.open(
                deviceId,
                undefined,
                deviceType,
                isController,
              )
            }
          >
            Adicionar Interface
          </button>
        </div>
      );
    }

    const isOnline = onlineMacs.has(iface.mac.toLowerCase());

    return (
      <div className="mb-4">
        <h3 className="mb-2 font-bold text-base">Interface</h3>
        <div className="p-4 border border-base-content/5 rounded-box">
          <div className="gap-4 grid grid-cols-2">
            <div>
              <span className="text-xs text-base-content/60">Nome</span>
              <p className="font-medium">{iface.name}</p>
            </div>
            <div>
              <span className="text-xs text-base-content/60">MAC</span>
              <p className="font-medium">{iface.mac}</p>
            </div>
            <div>
              <span className="text-xs text-base-content/60">IP</span>
              <p className="font-medium">{iface.ip}</p>
            </div>
            <div>
              <span className="text-xs text-base-content/60">Status</span>
              <p>
                <span
                  className={`badge badge-sm ${isOnline ? "badge-success" : "badge-error"}`}
                >
                  {isOnline ? "Online" : "Offline"}
                </span>
              </p>
            </div>
            {!isController && (
              <div>
                <span className="text-xs text-base-content/60">
                  IP Reservado
                </span>
                <p className="font-medium">
                  {iface.reservedIp ? "Sim" : "Não"}
                </p>
              </div>
            )}
          </div>
          {!isController && (
            <div className="flex gap-2 mt-4">
              <button
                className="btn btn-sm btn-ghost"
                onClick={() =>
                  addInterfaceModal?.open(
                    deviceId,
                    iface,
                    deviceType,
                    isController,
                  )
                }
              >
                <VscEdit /> Editar
              </button>
            </div>
          )}
          {isController && (
            <p className="mt-4 text-xs text-base-content/50">
              Interface do controlador não pode ser editada.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <>
      <div className="flex justify-between items-center mb-2">
        <h3 className="font-bold text-base">Interfaces</h3>
        <button
          className="btn btn-sm btn-ghost"
          onClick={() =>
            addInterfaceModal?.open(
              deviceId,
              undefined,
              deviceType,
              isController,
            )
          }
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
                <th>Roteador</th>
                <th>Status</th>
                <th>IP Reservado</th>
                <th>Allow List</th>
                <th className="w-24">Ações</th>
              </tr>
            </thead>
            <tbody>
              {interfaces.map((iface) => {
                const isOnline = onlineMacs.has(iface.mac.toLowerCase());
                const routerInterface = macToRouterInterface.get(
                  iface.mac.toLowerCase(),
                );
                return (
                  <tr key={iface.id}>
                    <td>{iface.name}</td>
                    <td>{iface.mac}</td>
                    <td>{iface.ip}</td>
                    <td>
                      {isOnline && routerInterface ? (
                        <span className="text-sm">{routerInterface}</span>
                      ) : (
                        <span className="text-xs text-base-content/50">-</span>
                      )}
                    </td>
                    <td>
                      <span
                        className={`badge badge-sm ${isOnline ? "badge-success" : "badge-error"}`}
                      >
                        {isOnline ? "Online" : "Offline"}
                      </span>
                    </td>
                    <td>
                      {iface.reservedIp ? (
                        <span className="badge badge-sm badge-success">
                          Sim
                        </span>
                      ) : (
                        <span className="text-xs text-base-content/50">
                          Não
                        </span>
                      )}
                    </td>
                    <td>
                      {iface.allowList ? (
                        <span className="badge badge-sm badge-success">
                          Sim
                        </span>
                      ) : (
                        <span className="text-xs text-base-content/50">
                          Não
                        </span>
                      )}
                    </td>
                    <td className="w-24">
                      <div className="flex gap-1">
                        <button
                          className="btn btn-sm btn-ghost"
                          onClick={() =>
                            addInterfaceModal?.open(
                              deviceId,
                              iface,
                              deviceType,
                              isController,
                            )
                          }
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
