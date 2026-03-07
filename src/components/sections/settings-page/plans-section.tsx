import { Check, Sparkles } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useBarbershopStore } from "@/store/barbershop.store";

// DADOS MOCADOS - SUBSTITUIR PELO BACKEND
type Plan = {
  id: string;
  name: string;
  price: string;
  priceLabel: string;
  benefits: string[];
  buttonLabel: string;
  highlighted?: boolean;
};

const plans: Plan[] = [
  {
    id: "gratuito",
    name: "Gratuito",
    price: "R$ 0",
    priceLabel: "/mês",
    buttonLabel: "Plano atual",
    benefits: [
      "Página da barbearia",
      "Gestão de agenda",
      "Gestão de serviços",
      "Relatórios",
      "Até 1 profissional",
      "Até 100 agendamentos/mês",
    ],
  },
  {
    id: "profissional",
    name: "Profissional",
    price: "R$ 40",
    priceLabel: "/mês",
    buttonLabel: "Assinar",
    highlighted: true,
    benefits: [
      "Página da barbearia",
      "Gestão de agenda",
      "Gestão de serviços",
      "Relatórios",
      "Até 10 profissionais",
      "Agendamentos ilimitados",
    ],
  },
  {
    id: "master",
    name: "Master",
    price: "R$ 80",
    priceLabel: "/mês",
    buttonLabel: "Assinar",
    benefits: [
      "Página da barbearia",
      "Site próprio",
      "Gestão de agenda",
      "Gestão de serviços",
      "Relatórios",
      "Profissionais ilimitados",
      "Agendamentos ilimitados",
    ],
  },
];

export function PlansSection() {
  const { barbershop } = useBarbershopStore();
  const currentPlan = barbershop?.plan ?? "gratuito";

  return (
    <div className="w-full max-w-180 mx-16 mt-2 mb-18 flex flex-col gap-6">
      <div>
        <h2 className="text-xl font-semibold">Planos</h2>
        <h3>DADOS MOCADOS !!</h3>
        <p className="text-sm text-muted-foreground">
          Escolha o plano ideal para a sua barbearia.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
        {plans.map(plan => {
          const isCurrentPlan = currentPlan === plan.id;

          return (
            <Card
              key={plan.id}
              className={`relative flex flex-col ${plan.highlighted ? "border-primary" : ""}`}
            >
              {plan.highlighted && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <Badge className="flex items-center gap-1 px-3 bg-[#ffffff]">
                    <Sparkles className="h-3 w-3" />
                    Popular
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{plan.name}</CardTitle>
                  {isCurrentPlan && (
                    <Badge variant="default" className="text-xs">
                      Atual
                    </Badge>
                  )}
                </div>
                <div className="flex items-baseline gap-1 mt-1">
                  <span className="text-2xl font-bold">{plan.price}</span>
                  {plan.priceLabel && (
                    <span className="text-sm text-muted-foreground">
                      {plan.priceLabel}
                    </span>
                  )}
                </div>
              </CardHeader>

              <Separator />

              <CardContent className="flex flex-col gap-4 pt-4 flex-1">
                <ul className="flex flex-col gap-2 flex-1">
                  {plan.benefits.map((benefit, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm">
                      <Check className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                      {benefit}
                    </li>
                  ))}
                </ul>

                <Button
                  className="w-full cursor-pointer mt-auto"
                  variant={
                    isCurrentPlan
                      ? "secondary"
                      : plan.highlighted
                        ? "default"
                        : "outline"
                  }
                  disabled={isCurrentPlan}
                >
                  {isCurrentPlan ? "Plano atual" : plan.buttonLabel}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
