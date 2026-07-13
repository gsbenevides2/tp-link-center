import { VscErrorCompact } from "react-icons/vsc";

export function ErrorMessage() {
  return (
    <tr>
      <th colSpan={5} className="text-center">
        <VscErrorCompact className="inline mb-2 w-6 h-6" />
        <br></br>
        <span>
          Ocorreu um erro ao Carregar! Vamos tentar novamente em Breve...
        </span>
      </th>
    </tr>
  );
}
