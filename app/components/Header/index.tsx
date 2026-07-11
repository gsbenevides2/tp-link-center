import { Logo } from "@/app/icons/logo";

export function Header() {
  return (
    <header className="flex items-center bg-primary px-12 py-4 text-white">
      <Logo height={45} mode="white" />
      <h1 className="pl-12 font-semibold text-xl">
        Centro de Administração de Dispositivos
      </h1>
    </header>
  );
}
