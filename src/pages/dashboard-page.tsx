// import { BarbershopDashboardMain } from "@/components/main/dashboard-main";
import { HeaderPage } from "@/components/common/header-page";
import { SettingsWhatsappMain } from "@/components/main/settings-whatsapp-main";

export function DashboardPage() {
  return (
    <>
      <HeaderPage page="Visão geral" />
      {/* <BarbershopDashboardMain /> */}
      <SettingsWhatsappMain />
    </>
  );
}
