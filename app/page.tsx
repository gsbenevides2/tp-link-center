import { RegisteredDevicesSection } from "@/app/components/RegisteredDevicesSection";
import { UnregisteredDevicesSection } from "@/app/components/UnregisteredDevicesSection";
import { RouterStatus } from "@/app/components/RouterStatus";

export default function Home() {
  return (
    <>
      <RouterStatus />
      <RegisteredDevicesSection />
      <UnregisteredDevicesSection />
    </>
  );
}
