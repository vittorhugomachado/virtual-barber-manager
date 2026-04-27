import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { BellRing, Bot, CheckCircle2, Phone, WifiOff } from "lucide-react";
import { PlansModal } from "../modals/plans/plans-modal";
import { useState } from "react";
import { useBarbershopStore } from "@/store/barbershop.store";

type WhatsappPlan = "iniciante" | "profissional" | "master";

type WhatsappSettingsMock = {
  plan: WhatsappPlan;
  connectedNumber: string;
  status: "conectado" | "desconectado";
  automaticService: boolean;
  appointmentReminders: boolean;
};

const whatsappSettingsMock: WhatsappSettingsMock = {
  plan: "master",
  connectedNumber: "(51) 99999-9999",
  status: "conectado",
  automaticService: true,
  appointmentReminders: true,
};

export function SettingsWhatsappMain() {
  const { barbershop } = useBarbershopStore();
  const [plansOpen, setPlansOpen] = useState(false);
  const isStarterPlan = barbershop?.plan === "iniciante";
  const settings = {
    ...whatsappSettingsMock,
    status: isStarterPlan ? "desconectado" : whatsappSettingsMock.status,
    automaticService: isStarterPlan
      ? false
      : whatsappSettingsMock.automaticService,
    appointmentReminders: isStarterPlan
      ? false
      : whatsappSettingsMock.appointmentReminders,
  };
  const disabledCardClass = isStarterPlan ? "opacity-50 grayscale" : "";

  console.log(barbershop);
  return (
    <main className="w-full max-w-325 flex flex-col items-center gap-6 px-6 md:px-12 pb-12 mx-auto mt-8">
      {isStarterPlan && (
        <div className="w-full flex flex-col md:items-start gap-1">
          <p className="text-xl font-bold">Plano {whatsappSettingsMock.plan}</p>
          <p className="text-sm text-muted-foreground md:text-start">
            O plano iniciante não inclui mensagens automáticas no whatsapp
          </p>
          <Button
            onClick={() => setPlansOpen(true)}
            variant="secondary"
            className="w-fit px-4 py-1 mt-2 text-md rounded-full bg-[#0458EE]
          "
          >
            Ver planos
          </Button>
        </div>
      )}
      <div className="w-full max-w-285 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 justify-items-center">
        <Card className={`aspect-square w-full max-w-66 ${disabledCardClass}`}>
          <CardContent className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Phone className="h-5 w-5 text-[#0458EE]" />
            </div>
            <div className="flex flex-col gap-1">
              {barbershop?.whatsapp_number && (
                <span className="text-sm text-muted-foreground">
                  Número conectado
                </span>
              )}
              <strong className="text-lg font-semibold">
                {barbershop?.whatsapp_number || "Nenhum número conectado"}
              </strong>
            </div>
          </CardContent>
        </Card>

        <Card className={`aspect-square w-full max-w-66 ${disabledCardClass}`}>
          <CardContent className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                settings.status === "conectado" ? "bg-green-500/10" : "bg-muted"
              }`}
            >
              {barbershop?.whatsapp_connected == true ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <strong
                className={`text-lg font-semibold ${
                  barbershop?.whatsapp_connected == true
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              >
                {barbershop?.whatsapp_connected == true
                  ? "Conectado à API"
                  : "Desconectado"}
              </strong>
              {isStarterPlan && (
                <p className="text-xs text-muted-foreground">
                  Seu plano atual não permite conexão com a API.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`aspect-square w-full max-w-66 ${disabledCardClass}`}>
          <CardContent className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="h-12 w-12 rounded-full bg-muted flex items-center justify-center">
              <Bot className="h-5 w-5 text-[#0458EE]" />
            </div>
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Atendimento automático
              </span>
              <div className="flex items-center gap-3">
                <Switch
                  id="settings-whatsapp-automatic-service"
                  checked={barbershop?.auto_reply_enabled || false}
                  disabled={isStarterPlan}
                />
                <strong className="text-sm font-semibold">
                  {barbershop?.auto_reply_enabled ? "Ativado" : "Desativado"}
                </strong>
              </div>
              {isStarterPlan && (
                <p className="text-xs text-muted-foreground">
                  Seu plano atual não permite atendimento automático.
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        <Card className={`aspect-square w-full max-w-66 ${disabledCardClass}`}>
          <CardContent className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                settings.appointmentReminders ? "bg-green-500/10" : "bg-muted"
              }`}
            >
              <BellRing
                className={`h-5 w-5 ${
                  settings.appointmentReminders
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              />
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">
                Lembretes de agendamento
              </span>
              <strong
                className={`text-lg font-semibold ${
                  settings.appointmentReminders
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              >
                {settings.appointmentReminders
                  ? "Sempre ativos"
                  : "Desativados"}
              </strong>
              {isStarterPlan && (
                <p className="text-xs text-muted-foreground">
                  Seu plano atual não permite lembretes de agendamento.
                </p>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      <Button
        type="button"
        disabled={isStarterPlan}
        className="w-60 mx-auto rounded-full"
      >
        Salvar configurações
      </Button>
      <PlansModal open={plansOpen} onClose={() => setPlansOpen(false)} />
    </main>
  );
}
