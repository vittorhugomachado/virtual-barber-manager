import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Pencil, Plus, Lock } from "lucide-react";
import { useBarbershopStore } from "@/store/barbershop.store";
import { toggleActiveBarber } from "@/lib/supabase/barbers/toggle-active-barber";
import { useBarbers } from "@/hooks/use-barbers";
import { ManageTeamSkeleton } from "../skeleton/manage-team-skeleton";
import { useState } from "react";
import { CreateBarberModal } from "../modals/manage-team/create-barber-modal";
import { UpdateBarberModal } from "../modals/manage-team/update-barber-modal";
import { PlansModal } from "../modals/plans/plans-modal";
import type { Barber } from "@/types/barber";

const planLimits: Record<string, number> = {
  iniciante: 1,
  profissional: 5,
  master: Infinity,
};

const planLabels: Record<string, string> = {
  iniciante: "Iniciante",
  profissional: "Profissional",
  master: "Master",
};

export function ManageTeamMain() {
  const { barbershop } = useBarbershopStore();
  const { barbers, setBarbers, loading } = useBarbers();
  const [plansOpen, setPlansOpen] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [editBarber, setEditBarber] = useState<Barber | null>(null);

  const plan = barbershop?.plan ?? "iniciante";
  const limit = planLimits[plan];
  const activeCount = barbers.filter(b => b.is_active).length;
  const canAddMore = activeCount < limit;

  async function toggleActive(id: string) {
    const target = barbers.find(b => b.id === id);
    if (!target) return;

    const newStatus = !target.is_active;

    if (newStatus && activeCount >= limit && limit !== Infinity) {
      const firstActive = barbers.find(b => b.is_active);

      if (firstActive) {
        const deactivated = await toggleActiveBarber(firstActive.id, false);
        if (!deactivated) return;

        const activated = await toggleActiveBarber(id, true);
        if (!activated) return;

        setBarbers(prev =>
          prev.map(b => {
            if (b.id === id) return { ...b, is_active: true };
            if (b.id === firstActive.id) return { ...b, is_active: false };
            return b;
          }),
        );
      }
      return;
    }

    const success = await toggleActiveBarber(id, newStatus);
    if (success) {
      setBarbers(prev =>
        prev.map(b => (b.id === id ? { ...b, is_active: newStatus } : b)),
      );
    }
  }

  if (loading) return <ManageTeamSkeleton />;

  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 pb-12 mx-auto mt-8">
      <div className="flex flex-col md:flex-row items-center justify-center md:justify-between">
        <div className="flex flex-col items-center md:items-start gap-1">
          <Button
            onClick={() => setPlansOpen(true)}
            variant="secondary"
            className="w-fit px-4 py-1 text-md rounded-full"
          >
            Plano {planLabels[plan]}
          </Button>
          <p className="text-sm text-muted-foreground text-center md:text-start ml-2">
            O seu plano atual permite{" "}
            {limit === Infinity
              ? "barbeiros ilimitados"
              : `${limit} barbeiro${limit !== 1 ? "s" : ""}`}{" "}
            <br />
            <span className="inline-flex items-center gap-1 mr-3">
              <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
              {activeCount} ativo{activeCount !== 1 ? "s" : ""}
            </span>{" "}
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
              {barbers.length - activeCount} inativo
              {barbers.length - activeCount !== 1 ? "s" : ""}
            </span>
          </p>
          {activeCount === 0 && (
            <div className="mt-2 w-full flex justify-center items-center gap-2 rounded-full border-yellow-500/60 bg-yellow-500/10 text-yellow-500 px-6 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span className="whitespace-normal text-left">
                Sem nenhum profissional ativo o agendamento na sua barbearia
                fica indisponível
              </span>
            </div>
          )}
        </div>
        {!canAddMore && limit !== Infinity && (
          <Button
            onClick={() => setPlansOpen(true)}
            variant="secondary"
            className="flex items-center rounded-full gap-1 bg-orange-600 hover:bg-orange-500 mt-4 py-2 md:mt-0 text-sm"
          >
            <Lock className="h-3 w-3" />
            Limite atingido — faça upgrade
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {barbers.map(barber => (
          <Card
            key={barber.id}
            className={`${!barber.is_active && "bg-zinc-950"} relative w-full max-w-80 mx-auto`}
          >
            <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
              {/* Badge sem opacidade */}
              <Badge
                className={`${barber.is_active ? "bg-green-400" : "bg-red-500"} absolute top-3 right-3 cursor-pointer select-none`}
                variant={barber.is_active ? "default" : "secondary"}
                onClick={() => toggleActive(barber.id)}
              >
                {barber.is_active ? "Ativo" : "Inativo"}
              </Badge>

              {/* Resto com opacidade quando inativo */}
              <div className="flex flex-col items-center gap-4 w-full">
                <div
                  className={`${!barber.is_active && "opacity-30"} flex flex-col items-center gap-4 w-full`}
                >
                  <Avatar className="h-23 w-23 md:h-35 md:w-35">
                    <AvatarImage src={barber.avatar_url ?? undefined} />
                    <AvatarFallback className="text-xl">
                      {barber.name.slice(0, 2).toUpperCase()}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex flex-col items-center gap-1 text-center">
                    <span className="font-semibold">{barber.name}</span>
                    <span className="text-sm text-muted-foreground line-clamp-2">
                      {barber.description}
                    </span>
                  </div>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  className="w-full cursor-pointer rounded-full"
                  onClick={() => setEditBarber(barber)}
                >
                  <Pencil className="h-3.5 w-3.5 mr-2" />
                  Editar
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}

        {canAddMore ? (
          <Card
            onClick={() => setCreateOpen(true)}
            className="border-dashed cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
          >
            <CardContent className="flex flex-col items-center justify-center gap-3 pt-8 pb-6 h-full min-h-52">
              <Button className="h-12 w-12 rounded-full flex items-center justify-center">
                <Plus className="h-5 w-5" />
              </Button>
              <span className="text-sm text-muted-foreground font-medium">
                Novo barbeiro
              </span>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-dashed bg-transparent">
            <CardContent className="flex flex-col items-center justify-center gap-3 pt-8 pb-6 h-full min-h-52">
              <div className="h-12 w-12 opacity-50 rounded-full border-2 border-dashed border-muted-foreground/30 flex items-center justify-center">
                <Lock className="h-5 w-5 text-muted-foreground" />
              </div>
              <span className="text-sm opacity-50 text-muted-foreground font-medium text-center">
                Faça upgrade para adicionar mais barbeiros
              </span>
              <Button
                onClick={() => setPlansOpen(true)}
                className="opacity-100 rounded-full"
              >
                Conhecer planos
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
      <PlansModal open={plansOpen} onClose={() => setPlansOpen(false)} />
      <CreateBarberModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={barber => setBarbers(prev => [...prev, barber])}
      />
      <UpdateBarberModal
        open={!!editBarber}
        barber={editBarber}
        onClose={() => setEditBarber(null)}
        onUpdated={updated =>
          setBarbers(prev => prev.map(b => (b.id === updated.id ? updated : b)))
        }
        onDeleted={id => setBarbers(prev => prev.filter(b => b.id !== id))}
      />
    </main>
  );
}
