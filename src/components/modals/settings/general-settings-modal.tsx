import { lazy, Suspense, useState } from "react";
import {
  AlertTriangle,
  Building2,
  Clock3,
  Images,
  Loader2,
  MapPin,
  ShieldCheck,
  Users,
} from "lucide-react";

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useSettingsAlerts } from "@/hooks/use-settings-alerts";

const BarbershopSettingsForm = lazy(() =>
  import("@/components/forms/barbershop-settings-form").then(module => ({
    default: module.BarbershopSettingsForm,
  })),
);
const SecuritySettingsForm = lazy(() =>
  import("@/components/forms/security-settings-form").then(module => ({
    default: module.SecuritySettingsForm,
  })),
);
const AddressForm = lazy(() =>
  import("@/components/forms/address-form").then(module => ({
    default: module.AddressForm,
  })),
);
const OpeningHoursSection = lazy(() =>
  import("@/components/common/opening-hours-section").then(module => ({
    default: module.OpeningHoursSection,
  })),
);
const BarbershopGallery = lazy(() =>
  import("@/components/common/barbershop-gallery").then(module => ({
    default: module.BarbershopGallery,
  })),
);
const UsersSection = lazy(() =>
  import("@/components/common/user-section").then(module => ({
    default: module.UsersSection,
  })),
);

const SETTINGS_SECTIONS = [
  { id: "barbearia", label: "Barbearia", icon: Building2 },
  { id: "seguranca", label: "Segurança", icon: ShieldCheck },
  { id: "endereco", label: "Endereço", icon: MapPin },
  { id: "horarios", label: "Horários", icon: Clock3 },
  { id: "galeria", label: "Galeria", icon: Images },
  { id: "usuarios", label: "Usuários", icon: Users },
] as const;

type SettingsSection = (typeof SETTINGS_SECTIONS)[number]["id"];

type GeneralSettingsModalProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function GeneralSettingsModal({
  open,
  onOpenChange,
}: GeneralSettingsModalProps) {
  const [activeSection, setActiveSection] =
    useState<SettingsSection>("barbearia");
  const {
    missingAddress,
    missingHours,
    markAddressComplete,
    markHoursComplete,
  } = useSettingsAlerts(open);

  function renderActiveSection() {
    switch (activeSection) {
      case "barbearia":
        return <BarbershopSettingsForm />;
      case "seguranca":
        return <SecuritySettingsForm />;
      case "endereco":
        return <AddressForm onSaved={markAddressComplete} />;
      case "horarios":
        return <OpeningHoursSection onSaved={markHoursComplete} />;
      case "galeria":
        return <BarbershopGallery />;
      case "usuarios":
        return <UsersSection />;
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="h-full max-h-[98vh] sm:max-h-[80vh] w-[calc(100vw-2rem)] max-w-200 overflow-hidden rounded-xl sm:max-w-200"
        style={{ padding: 0 }}
      >
        <DialogHeader className="sr-only">
          <DialogTitle>Configurações</DialogTitle>
          <DialogDescription>
            Gerencie as configurações da barbearia.
          </DialogDescription>
        </DialogHeader>

        <div className="flex h-full max-h-[80vh] min-h-0 flex-col overflow-hidden md:grid md:grid-cols-[190px_minmax(0,1fr)]">
          <aside className="shrink-0 border-b bg-muted/30 px-2 pt-5 md:min-h-0 md:overflow-y-auto md:border-r md:border-b-0 md:px-3 md:py-5">
            <h2 className="mb-4 px-2 pr-10 text-base font-semibold">
              Configurações
            </h2>
            <nav
              className="flex gap-1 overflow-x-auto pb-2 md:flex-col md:overflow-x-visible md:pb-0"
              aria-label="Configurações"
            >
              {SETTINGS_SECTIONS.map(section => {
                const Icon = section.icon;
                const hasAlert =
                  (section.id === "endereco" && missingAddress) ||
                  (section.id === "horarios" && missingHours);

                return (
                  <button
                    key={section.id}
                    type="button"
                    onClick={() => setActiveSection(section.id)}
                    className={`flex w-auto shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm transition-colors md:w-full ${
                      activeSection === section.id
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{section.label}</span>
                    {hasAlert && (
                      <AlertTriangle className="ml-auto h-3.5 w-3.5 shrink-0 text-yellow-500" />
                    )}
                  </button>
                );
              })}
            </nav>
          </aside>

          <main className="min-h-0 flex-1 overflow-y-auto md:max-h-[80vh]">
            <Suspense
              fallback={
                <div className="flex min-h-48 items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              }
            >
              {renderActiveSection()}
            </Suspense>
          </main>
        </div>
      </DialogContent>
    </Dialog>
  );
}
