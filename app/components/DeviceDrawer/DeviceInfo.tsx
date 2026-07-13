import { Device } from "../RegisteredDevicesSection/useDevices";

interface Props {
  device: Device;
}
export function DeviceInfo({ device }: Props) {
  return (
    <>
      <h2 className="mb-4 font-bold text-lg">Detalhes do Dispositivo</h2>
      <div className="mb-4">
        <p>
          <b>ID:</b> {device.id}
          <br />
          <b>Nome:</b> {device.name}
          <br />
          <b>Fabricante:</b> {device.brand}
        </p>
      </div>
    </>
  );
}
