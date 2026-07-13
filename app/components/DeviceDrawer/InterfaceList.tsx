import { VscAddCompact } from "react-icons/vsc";
import { Device } from "../RegisteredDevicesSection/useDevices";
import { useAddInterfaceModal } from "../AddInterfaceModal";

export type Interface = Device["interfaces"][number];

interface Props {
  deviceId: string;
  interfaces: Interface[];
}

export function InterfaceList({ interfaces, deviceId }: Props) {
  const addInterfaceModal = useAddInterfaceModal();
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
              </tr>
            </thead>
            <tbody>
              {interfaces.map((iface) => (
                <tr key={iface.id}>
                  <td>{iface.name}</td>
                  <td>{iface.mac}</td>
                  <td>{iface.ip}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="mb-4 text-base-content/60">
          Nenhuma interface encontrada.
        </p>
      )}
    </>
  );
}
