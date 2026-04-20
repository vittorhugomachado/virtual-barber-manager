import { BarbershopDashboardMain } from "@/components/main/dashboard-main";
import { HeaderPage } from "@/components/common/header-page";

export function DashboardPage() {
  return (
    <>
      <HeaderPage page="Visão geral" />
      <BarbershopDashboardMain />
    </>
  );
}
