import { ManageServicesMain } from "@/components/main/manage-services-main";
import { HeaderPage } from "@/components/common/header-page";

export function ManageServicePage() {
  return (
    <>
      <HeaderPage page="Serviços" />
      <ManageServicesMain />
    </>
  );
}
