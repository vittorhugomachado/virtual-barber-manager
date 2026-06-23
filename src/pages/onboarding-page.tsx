import { useState, useEffect } from "react";
import { useNavigate } from "react-router";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/common/logo";
import { AddressForm } from "@/components/forms/address-form";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";

type Step = {
  id: number;
  label: string;
  description: string;
};

const STEPS: Step[] = [
  {
    id: 1,
    label: "Endereço",
    description: "Onde sua barbearia fica localizada",
  },
  { id: 2, label: "Horários", description: "Dias e horários de funcionamento" },
  { id: 3, label: "Serviços", description: "O que você oferece e os preços" },
  { id: 4, label: "Barbeiros", description: "Sua equipe de profissionais" },
  {
    id: 5,
    label: "Página",
    description: "Personalize a aparência do seu site público",
  },
];

const WELCOME_TEXT = "Bem-vindo à Virtual Barber!";

// ─── Welcome ────────────────────────────────────────────────────────────────

function WelcomeScreen({
  onStart,
  leaving,
}: {
  onStart: () => void;
  leaving: boolean;
}) {
  const [logoVisible, setLogoVisible] = useState(false);
  const [typedCount, setTypedCount] = useState(0);
  const [showRest, setShowRest] = useState(false);

  const isTypingDone = typedCount >= WELCOME_TEXT.length;

  useEffect(() => {
    const t = setTimeout(() => setLogoVisible(true), 100);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (!logoVisible) return;
    if (typedCount >= WELCOME_TEXT.length) return;
    const delay = typedCount === 0 ? 700 : 45;
    const t = setTimeout(() => setTypedCount(c => c + 1), delay);
    return () => clearTimeout(t);
  }, [logoVisible, typedCount]);

  useEffect(() => {
    if (!isTypingDone) return;
    const t = setTimeout(() => setShowRest(true), 200);
    return () => clearTimeout(t);
  }, [isTypingDone]);

  return (
    <div className="w-full min-h-screen bg-background flex flex-col items-center justify-center p-6 overflow-hidden">
      <div className="w-full max-w-sm flex flex-col items-center text-center gap-6">
        {/* Logo — desliza para baixo e sai da tela ao clicar em começar */}
        <div
          style={{
            opacity: logoVisible ? 1 : 0,
            transform: leaving ? "translateY(110vh)" : "translateY(0)",
            transition: "opacity 1000ms, transform 550ms ease-in",
          }}
        >
          <Logo style="h-10" />
        </div>

        {/* Texto — some imediatamente ao sair */}
        <div
          className={cn(
            "flex flex-col gap-2 transition-opacity duration-100",
            leaving ? "opacity-0" : "opacity-100",
          )}
        >
          <h1 className="text-2xl font-semibold tracking-tight min-h-8">
            {WELCOME_TEXT.slice(0, typedCount)}
            {!isTypingDone && <span className="animate-pulse">|</span>}
          </h1>
          <p
            className={cn(
              "text-muted-foreground text-sm leading-relaxed transition-opacity duration-500",
              showRest && !leaving ? "opacity-100" : "opacity-0",
            )}
          >
            Antes de começar vamos configurar sua barbearia para ela ser única.
          </p>
        </div>

        <Button
          onClick={onStart}
          disabled={leaving}
          className={cn(
            "w-full transition-opacity duration-100",
            showRest && !leaving
              ? "opacity-100"
              : "opacity-0 pointer-events-none",
          )}
        >
          Começar configuração
        </Button>
      </div>
    </div>
  );
}

// ─── Steps ───────────────────────────────────────────────────────────────────

function StepsScreen({
  currentStep,
  onNext,
  onPrev,
  onComplete,
}: {
  currentStep: number;
  onNext: () => void;
  onPrev: () => void;
  onComplete: () => void;
}) {
  const [logoReady, setLogoReady] = useState(false);

  // Logo desliza do topo para a posição final ao montar
  useEffect(() => {
    const t = setTimeout(() => setLogoReady(true), 50);
    return () => clearTimeout(t);
  }, []);

  const step = STEPS[currentStep - 1];

  return (
    <div className="w-full min-h-screen bg-background flex flex-col px-6">
      {/* Logo desce do topo até a posição — simula continuidade do scroll */}
      <div className="flex justify-center pt-8 pb-6">
        <div
          style={{
            opacity: logoReady ? 1 : 0,
            transform: logoReady ? "translateY(0)" : "translateY(-80px)",
            transition:
              "transform 500ms cubic-bezier(0.25, 0.46, 0.45, 0.94), opacity 300ms",
          }}
        >
          <Logo style="h-8" />
        </div>
      </div>

      {/* Conteúdo dos passos */}
      <div className="w-full mx-auto flex-1 flex flex-col items-center justify-center">
        <div className="w-full max-w-xl">
          {/* Indicador de passos */}
          <div className="flex items-center justify-center gap-4 mb-10">
            {STEPS.map((s, index) => {
              const isCompleted = s.id < currentStep;
              const isActive = s.id === currentStep;

              return (
                <div key={s.id} className="flex items-center">
                  <div className="flex flex-col items-center">
                    <div
                      className={cn(
                        "size-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                        isCompleted &&
                          "bg-[#0458EE] border-[#0458EE] text-primary-foreground",
                        isActive && "border-primary text-primary bg-background",
                        !isCompleted &&
                          !isActive &&
                          "border-muted-foreground/30 text-muted-foreground/50 bg-background",
                      )}
                    >
                      {isCompleted ? <Check className="size-4" /> : s.id}
                    </div>
                    <span
                      className={cn(
                        "text-xs mt-1.5 font-medium",
                        isActive
                          ? "text-foreground"
                          : "text-muted-foreground/50",
                      )}
                    >
                      {s.label}
                    </span>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={cn(
                        "h-px flex-1 mx-2 mb-5 transition-colors",
                        isCompleted ? "bg-primary" : "bg-muted-foreground/20",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </div>

          {/* Formulário do passo atual */}
          {currentStep === 1 ? (
            <>
              <AddressForm onSaved={onNext} fixedButtons />
              <Button
                type="submit"
                form="address-form"
                className="fixed bottom-6 left-1/2 -translate-x-1/2 rounded-full shadow-lg px-8"
              >
                Salvar endereço
              </Button>
            </>
          ) : (
            <div className="border rounded-xl p-6 bg-card min-h-64">
              <h2 className="text-lg font-medium mb-1">{step.label}</h2>
              <p className="text-muted-foreground text-sm mb-6">
                {step.description}
              </p>
              <div className="h-32 flex items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
                Formulário de {step.label.toLowerCase()} em breve
              </div>
            </div>
          )}

          {/* Navegação — oculta no step 1 (o AddressForm tem seu próprio botão) */}
          {currentStep > 1 && (
            <div className="flex justify-between mt-6">
              <button
                onClick={onPrev}
                className="px-4 py-2 text-sm rounded-lg border hover:bg-muted transition-colors"
              >
                Voltar
              </button>
              {currentStep < STEPS.length ? (
                <Button onClick={onNext} className="w-26">
                  Próximo
                </Button>
              ) : (
                <Button onClick={onComplete}>
                  Concluir
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export function OnboardingPage() {
  const navigate = useNavigate();
  const { barbershop, setBarbershop } = useBarbershopStore();

  const savedStep = barbershop?.onboarding_step ?? 1;
  const [phase, setPhase] = useState<"welcome" | "steps">(
    savedStep > 1 ? "steps" : "welcome",
  );
  const [welcomeLeaving, setWelcomeLeaving] = useState(false);
  const [currentStep, setCurrentStep] = useState(savedStep);

  function handleStart() {
    setWelcomeLeaving(true);
    setTimeout(() => setPhase("steps"), 600);
  }

  async function goToNext() {
    const nextStep = Math.min(currentStep + 1, STEPS.length);
    if (barbershop && nextStep > (barbershop.onboarding_step ?? 1)) {
      await supabase
        .from("barbershops")
        .update({ onboarding_step: nextStep })
        .eq("id", barbershop.id);
      setBarbershop({ ...barbershop, onboarding_step: nextStep });
    }
    setCurrentStep(nextStep);
  }

  function goToPrev() {
    if (currentStep === 1) {
      setPhase("welcome");
      setWelcomeLeaving(false);
    } else {
      setCurrentStep(prev => prev - 1);
    }
  }

  async function handleComplete() {
    if (!barbershop) return;
    await supabase
      .from("barbershops")
      .update({ onboarding_completed: true, onboarding_step: STEPS.length })
      .eq("id", barbershop.id);
    setBarbershop({ ...barbershop, onboarding_completed: true });
    navigate("/painel");
  }

  if (phase === "welcome") {
    return <WelcomeScreen onStart={handleStart} leaving={welcomeLeaving} />;
  }

  return (
    <StepsScreen
      currentStep={currentStep}
      onNext={goToNext}
      onPrev={goToPrev}
      onComplete={handleComplete}
    />
  );
}
