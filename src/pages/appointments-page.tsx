import { HeaderPage } from "@/components/common/header-page";
import { AppointmentsMain } from "@/components/main/appointments-main";

export function AppointmentsPage() {
  return (
    <>
      <HeaderPage page="Agenda" />
      <AppointmentsMain />
    </>
  );
}
