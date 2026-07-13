import { createContext, ReactNode } from "react";

export const DeviceContext = createContext(null);

interface Props {
  children: ReactNode;
}
export function DeviceProvider({ children }: Props) {
  return (
    <DeviceContext.Provider value={null}>{children}</DeviceContext.Provider>
  );
}
