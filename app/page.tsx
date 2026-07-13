import { RegisteredDevicesSection } from "@/app/components/RegisteredDevicesSection";
import { UnregisteredDevicesSection } from "@/app/components/UnregisteredDevicesSection";

export default function Home() {
  return (
    <>
      <RegisteredDevicesSection />
      <UnregisteredDevicesSection />
    </>
  );
}
