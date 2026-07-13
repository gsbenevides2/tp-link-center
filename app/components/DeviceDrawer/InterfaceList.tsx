import { Device } from "../RegisteredDevicesSection/useDevices";

export type Interface = Device["interfaces"][number];

interface Props {
  interfaces: Interface[];
}

export function InterfaceList({ interfaces }: Props) {
  const hasInterfaces = interfaces.length > 0;

  if (hasInterfaces) {
    return (
      <>
        <h3 className="mb-2 font-bold text-base">Interfaces</h3>
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
      </>
    );
  }
  return (
    <>
      <h3 className="mb-2 font-bold text-base">Interfaces</h3>
      <p className="mb-4 text-base-content/60">Nenhuma interface encontrada.</p>
    </>
  );
}
