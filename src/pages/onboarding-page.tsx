import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

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
];

export function OnboardingPage() {
  const [currentStep, setCurrentStep] = useState(1);

  function goToNext() {
    setCurrentStep(prev => Math.min(prev + 1, STEPS.length));
  }

  function goToPrev() {
    setCurrentStep(prev => Math.max(prev - 1, 1));
  }

  const step = STEPS[currentStep - 1];

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-6">
      <div className="w-full max-w-xl">
        {/* Cabeçalho */}
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Configure sua barbearia
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            Preencha as informações abaixo para começar a usar o sistema.
          </p>
        </div>

        {/* Indicador de passos */}
        <div className="flex items-center justify-between mb-10">
          {STEPS.map((s, index) => {
            const isCompleted = s.id < currentStep;
            const isActive = s.id === currentStep;

            return (
              <div key={s.id} className="flex items-center flex-1">
                <div className="flex flex-col items-center">
                  <div
                    className={cn(
                      "size-8 rounded-full flex items-center justify-center text-sm font-medium border-2 transition-colors",
                      isCompleted &&
                        "bg-primary border-primary text-primary-foreground",
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
                      isActive ? "text-foreground" : "text-muted-foreground/50",
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

        {/* Conteúdo do passo atual */}
        <div className="border rounded-xl p-6 bg-card min-h-64">
          <h2 className="text-lg font-medium mb-1">{step.label}</h2>
          <p className="text-muted-foreground text-sm mb-6">
            {step.description}
          </p>

          {/* TODO: renderizar o formulário de cada passo aqui */}
          <div className="h-32 flex items-center justify-center rounded-lg border border-dashed text-muted-foreground text-sm">
            Formulário de {step.label.toLowerCase()} em breve
          </div>
        </div>

        {/* Navegação */}
        <div className="flex justify-between mt-6">
          <button
            onClick={goToPrev}
            disabled={currentStep === 1}
            className="px-4 py-2 text-sm rounded-lg border disabled:opacity-30 disabled:cursor-not-allowed hover:bg-muted transition-colors"
          >
            Voltar
          </button>

          {currentStep < STEPS.length ? (
            <button
              onClick={goToNext}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Próximo
            </button>
          ) : (
            <button
              onClick={() => {
                // TODO: setar onboarding_completed = true e redirecionar para /painel
              }}
              className="px-4 py-2 text-sm rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              Concluir
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
