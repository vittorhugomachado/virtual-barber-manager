import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { BellRing, Bot, CheckCircle2, Phone, WifiOff } from "lucide-react";
import { PlansModal } from "../modals/plans/plans-modal";
import { useState } from "react";
import { useBarbershopStore } from "@/store/barbershop.store";
import { supabase } from "@/lib/supabase/supabase";
import { toast } from "sonner";
import { maskPhone } from "@/utils/masked-input-phone";
import type { Barbershop } from "@/types/barbershop";

export function SettingsWhatsappMain() {
  const { barbershop, setBarbershop } = useBarbershopStore();

  if (!barbershop) return null;

  const resetKey = [
    barbershop.id,
    barbershop.whatsapp_number ?? "",
    barbershop.auto_reply_enabled,
    barbershop.reminders_enabled,
    barbershop.plan,
  ].join(":");

  return (
    <SettingsWhatsappContent
      key={resetKey}
      barbershop={barbershop}
      setBarbershop={setBarbershop}
    />
  );
}

function SettingsWhatsappContent({
  barbershop,
  setBarbershop,
}: {
  barbershop: Barbershop;
  setBarbershop: (data: Barbershop) => void;
}) {
  const [plansOpen, setPlansOpen] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(() =>
    maskPhone(String(barbershop.whatsapp_number ?? "")),
  );
  const [autoReplyEnabled, setAutoReplyEnabled] = useState(
    Boolean(barbershop.auto_reply_enabled),
  );
  const [remindersEnabled, setRemindersEnabled] = useState(
    Boolean(barbershop.reminders_enabled),
  );
  const [isSaving, setIsSaving] = useState(false);
  const isStarterPlan = barbershop.plan === "iniciante";
  const effectiveAutoReplyEnabled = isStarterPlan ? false : autoReplyEnabled;
  const effectiveRemindersEnabled = isStarterPlan ? false : remindersEnabled;
  const isDirty =
    !isStarterPlan &&
    (whatsappNumber.replace(/\D/g, "") !==
      String(barbershop.whatsapp_number ?? "").replace(/\D/g, "") ||
      autoReplyEnabled !== Boolean(barbershop.auto_reply_enabled) ||
      remindersEnabled !== Boolean(barbershop.reminders_enabled));
  const disabledCardClass = isStarterPlan ? "opacity-50 grayscale" : "";

  async function handleSaveSettings() {
    if (isStarterPlan) return;

    const rawWhatsappNumber = whatsappNumber.replace(/\D/g, "");

    if (rawWhatsappNumber && rawWhatsappNumber.length !== 11) {
      toast.error("Digite um número de WhatsApp válido");
      return;
    }

    setIsSaving(true);

    const { error } = await supabase
      .from("barbershops")
      .update({
        whatsapp_number: rawWhatsappNumber || null,
        auto_reply_enabled: autoReplyEnabled,
        reminders_enabled: remindersEnabled,
        updated_at: new Date().toISOString(),
      })
      .eq("id", barbershop.id);

    setIsSaving(false);

    if (error) {
      toast.error("Erro ao salvar configurações do WhatsApp");
      return;
    }

    setBarbershop({
      ...barbershop,
      whatsapp_number: rawWhatsappNumber || null,
      auto_reply_enabled: autoReplyEnabled,
      reminders_enabled: remindersEnabled,
    });
    toast.success("Configurações salvas!");
  }

  return (
    <main className="w-full max-w-325 flex flex-col items-center gap-6 px-6 md:px-12 pb-12 mx-auto mt-8">
      {isStarterPlan && (
        <div className="w-full flex flex-col md:items-start gap-1">
          <p className="text-xl font-bold">Plano {barbershop?.plan}</p>
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
              <span className="text-sm text-muted-foreground">
                Número conectado
              </span>
              <Input
                id="settings-whatsapp-number"
                type="tel"
                inputMode="numeric"
                value={whatsappNumber}
                onChange={event =>
                  setWhatsappNumber(maskPhone(event.target.value))
                }
                placeholder="(00) 00000-0000"
                disabled={isStarterPlan || isSaving}
                className="h-9 text-center font-semibold"
              />
            </div>
          </CardContent>
        </Card>

        <Card className={`aspect-square w-full max-w-66 ${disabledCardClass}`}>
          <CardContent className="h-full flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div
              className={`h-12 w-12 rounded-full flex items-center justify-center ${
                barbershop?.whatsapp_connected && !isStarterPlan
                  ? "bg-green-500/10"
                  : "bg-muted"
              }`}
            >
              {barbershop?.whatsapp_connected && !isStarterPlan ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <WifiOff className="h-5 w-5 text-muted-foreground" />
              )}
            </div>
            <div className="flex flex-col gap-2">
              <span className="text-sm text-muted-foreground">Status</span>
              <strong
                className={`text-lg font-semibold ${
                  barbershop?.whatsapp_connected && !isStarterPlan
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              >
                {barbershop?.whatsapp_connected && !isStarterPlan
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
              <div className="grid grid-cols-[2rem_5.5rem] items-center gap-3">
                <Switch
                  id="settings-whatsapp-automatic-service"
                  checked={effectiveAutoReplyEnabled}
                  disabled={isStarterPlan}
                  onCheckedChange={setAutoReplyEnabled}
                />
                <strong className="text-sm font-semibold text-left">
                  {effectiveAutoReplyEnabled ? "Ativado" : "Desativado"}
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
                effectiveRemindersEnabled ? "bg-green-500/10" : "bg-muted"
              }`}
            >
              <BellRing
                className={`h-5 w-5 ${
                  effectiveRemindersEnabled
                    ? "text-green-500"
                    : "text-muted-foreground"
                }`}
              />
            </div>
            <div className="flex flex-col items-center gap-3">
              <span className="text-sm text-muted-foreground">
                Lembretes de agendamento
              </span>
              <div className="grid grid-cols-[2rem_5.5rem] items-center gap-3">
                <Switch
                  id="settings-whatsapp-appointment-reminders"
                  checked={effectiveRemindersEnabled}
                  disabled={isStarterPlan}
                  onCheckedChange={setRemindersEnabled}
                />
                <strong className="text-sm font-semibold text-left">
                  {effectiveRemindersEnabled ? "Ativado" : "Desativado"}
                </strong>
              </div>
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
        disabled={isStarterPlan || isSaving || !isDirty}
        onClick={handleSaveSettings}
        className="w-60 mx-auto rounded-full"
      >
        {isSaving ? "Salvando..." : "Salvar configurações"}
      </Button>
      <PlansModal open={plansOpen} onClose={() => setPlansOpen(false)} />
    </main>
  );
}
