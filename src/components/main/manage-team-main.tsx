import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AlertTriangle, Pencil, Plus } from "lucide-react";
import { useBarbershopStore } from "@/store/barbershop.store";
import { toggleActiveBarber } from "@/lib/supabase/barbers/toggle-active-barber";
import { useBarbers } from "@/hooks/use-barbers";
import { ManageTeamSkeleton } from "../skeleton/manage-team-skeleton";
import { useState } from "react";
import { CreateBarberModal } from "../modals/manage-team/create-barber-modal";
import { UpdateBarberModal } from "../modals/manage-team/update-barber-modal";
import type { Barber } from "@/types/barber";

const DASHBOARD_REFRESH_EVENT = "dashboard-refresh";

interface ManageTeamMainProps {
  fixedButtons?: boolean;
  onSaved?: () => void;
  onPrev?: () => void;
}

export function ManageTeamMain({
  fixedButtons = false,
  onSaved,
  onPrev,
}: ManageTeamMainProps) {
  const { barbershop } = useBarbershopStore();
  const { barbers, setBarbers, loading } = useBarbers();
  const [createOpen, setCreateOpen] = useState(false);
  const [editBarber, setEditBarber] = useState<Barber | null>(null);

  const activeCount = barbers.filter(b => b.is_active).length;

  function notifyDashboardRefresh() {
    window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
  }

  async function toggleActive(id: string) {
    const target = barbers.find(b => b.id === id);
    if (!target) return;

    const newStatus = !target.is_active;
    const success = await toggleActiveBarber(id, newStatus);
    if (success) {
      setBarbers(prev =>
        prev.map(b => (b.id === id ? { ...b, is_active: newStatus } : b)),
      );
      notifyDashboardRefresh();
    }
  }

  if (loading) return <ManageTeamSkeleton />;

  return (
    <main
      className={`w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 mx-auto mt-8 ${fixedButtons ? "pb-24" : "pb-12"}`}
    >
      {fixedButtons ? (
        <Card className="bg-transparent border-none shadow-none">
          <CardHeader className="mt-3">
            <div className="flex mx-auto flex-col w-fit">
              <CardTitle className="font-semibold text-2xl">
                Quem são os barbeiros?
              </CardTitle>
            </div>
          </CardHeader>
        </Card>
      ) : (
        <div className="flex flex-col items-start gap-1">
          <p className="text-sm text-muted-foreground ml-2">
            <span className="inline-flex items-center gap-1 mr-3">
              <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
              {activeCount} ativo{activeCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
              {barbers.length - activeCount} inativo
              {barbers.length - activeCount !== 1 ? "s" : ""}
            </span>
          </p>
          {activeCount === 0 && (
            <div className="mt-2 text-sm flex items-center gap-2 rounded-full border-yellow-500/60 bg-yellow-500/10 text-yellow-500 px-6 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Sem nenhum profissional ativo o agendamento fica indisponível
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        {barbers.map(barber => (
          <Card
            key={barber.id}
            className={`${!barber.is_active && "bg-zinc-950"} relative w-full max-w-80 mx-auto`}
          >
            <CardContent className="flex flex-col items-center gap-4 pt-8 pb-6">
              <Badge
                className={`${barber.is_active ? "bg-green-400" : "bg-red-500"} absolute top-3 right-3 cursor-pointer select-none`}
                variant={barber.is_active ? "default" : "secondary"}
                onClick={() => toggleActive(barber.id)}
              >
                {barber.is_active ? "Ativo" : "Inativo"}
              </Badge>

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

        <Card
          onClick={() => setCreateOpen(true)}
          className="w-50 border-dashed cursor-pointer bg-zinc-200 dark:bg-zinc-900 hover:border-primary transition-colors"
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
      </div>

      {fixedButtons && (
        <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-900 px-3 py-3 shadow-lg">
          <div className="flex justify-between w-full max-w-xl px-3">
            <Button
              type="button"
              variant="outline"
              className="w-20"
              onClick={onPrev}
            >
              Voltar
            </Button>
            <Button type="button" className="w-36 px-8" onClick={onSaved}>
              Próximo
            </Button>
          </div>
        </div>
      )}

      <CreateBarberModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={barber => {
          setBarbers(prev => [...prev, barber]);
          notifyDashboardRefresh();
        }}
      />
      <UpdateBarberModal
        open={!!editBarber}
        barber={editBarber}
        onClose={() => setEditBarber(null)}
        onUpdated={updated => {
          setBarbers(prev =>
            prev.map(b => (b.id === updated.id ? updated : b)),
          );
          notifyDashboardRefresh();
        }}
        onDeleted={id => {
          setBarbers(prev => prev.filter(b => b.id !== id));
          notifyDashboardRefresh();
        }}
      />
    </main>
  );
}
