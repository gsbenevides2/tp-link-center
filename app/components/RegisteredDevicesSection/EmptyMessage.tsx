import { VscInfo } from "react-icons/vsc";

export function EmptyMessage() {
  return (
    <tr>
      <th colSpan={5} className="text-center">
        <VscInfo className="inline mb-2 w-6 h-6" />
        <br></br>
        <span>Você não possuí dispositivos registrados.</span>
      </th>
    </tr>
  );
}
