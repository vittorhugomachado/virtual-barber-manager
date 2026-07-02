import { useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertTriangle, Clock, Pencil, Plus, Scissors } from "lucide-react";
import { useServices } from "@/hooks/use-service";
import { toggleActiveService } from "@/lib/supabase/services/toggle-active-service";
import { ServicesSkeleton } from "../skeleton/services-skeleton";
import type { Service } from "@/types/services";
import { CreateServiceModal } from "../modals/manage-services/create-service-modal";
import { UpdateServiceModal } from "../modals/manage-services/update-service-modal";

const DASHBOARD_REFRESH_EVENT = "dashboard-refresh";

interface ManageServicesMainProps {
  fixedButtons?: boolean;
  onSaved?: () => void;
  onPrev?: () => void;
}

export function ManageServicesMain({
  fixedButtons = false,
  onSaved,
  onPrev,
}: ManageServicesMainProps) {
  const { services, setServices, loading } = useServices();
  const [createOpen, setCreateOpen] = useState(false);
  const [editService, setEditService] = useState<Service | null>(null);

  const displayServices = fixedButtons
    ? services.map(service => ({ ...service, is_active: true }))
    : services;

  const activeCount = displayServices.filter(s => s.is_active).length;

  function notifyDashboardRefresh() {
    window.dispatchEvent(new Event(DASHBOARD_REFRESH_EVENT));
  }

  async function toggleActive(id: string) {
    if (fixedButtons) return;

    const target = services.find(s => s.id === id);
    if (!target) return;

    const newStatus = !target.is_active;
    const success = await toggleActiveService(id, newStatus);

    if (success) {
      setServices(prev =>
        prev.map(s => (s.id === id ? { ...s, is_active: newStatus } : s)),
      );
      notifyDashboardRefresh();
    }
  }

  if (loading) return <ServicesSkeleton />;

  return (
    <main
      className={`w-full max-w-325 flex flex-col gap-6 px-6 md:px-12 mx-auto mt-4 ${fixedButtons ? "pb-24" : "pb-12"}`}
    >
      {fixedButtons ? (
        <div className="flex flex-col items-center gap-1 mt-2">
          <h2 className="font-semibold text-2xl text-center">
            Quais servicos voce oferece?
          </h2>
        </div>
      ) : (
        <div className="flex flex-col items-start gap-1">
          <p className="text-sm text-muted-foreground ml-2">
            <span className="inline-flex items-center gap-1 mr-3">
              <span className="h-2 w-2 rounded-full bg-green-400 inline-block" />
              {activeCount} ativo{activeCount !== 1 ? "s" : ""}
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
              {displayServices.length - activeCount} inativo
              {displayServices.length - activeCount !== 1 ? "s" : ""}
            </span>
          </p>
          {activeCount === 0 && (
            <div className="mt-2 text-sm flex items-center gap-2 rounded-full border-yellow-500/60 bg-yellow-500/10 text-yellow-500 px-6 py-2">
              <AlertTriangle className="h-4 w-4 shrink-0" />
              <span>
                Sem nenhum servico ativo o agendamento fica indisponivel
              </span>
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
        <Card
          onClick={() => setCreateOpen(true)}
          className="border-dashed cursor-pointer hover:border-primary hover:bg-muted/50 transition-colors"
        >
          <CardContent className="flex flex-col items-center justify-center gap-3 pt-8 pb-6 h-full min-h-52">
            <Button className="h-12 w-12 rounded-full flex items-center justify-center">
              <Plus className="h-5 w-5" />
            </Button>
            <span className="text-sm text-muted-foreground font-medium">
              Novo servico
            </span>
          </CardContent>
        </Card>

        {displayServices.map(service => {
          const isActive = fixedButtons ? true : service.is_active;

          return (
            <Card
              key={service.id}
              className={`${!isActive && "bg-zinc-950"} relative pt-0 h-full`}
            >
              <CardContent className="flex flex-col gap-3 p-0 pb-4 h-full">
                {!fixedButtons && (
                  <Badge
                    className={`${isActive ? "bg-green-400" : "bg-red-500 text-white"} absolute top-3 right-3 cursor-pointer select-none z-10`}
                    onClick={() => toggleActive(service.id)}
                  >
                    {isActive ? "Ativo" : "Inativo"}
                  </Badge>
                )}

                <div
                  className={`${!isActive && "opacity-30"} flex flex-col gap-3 h-full`}
                >
                  <div className="h-36 w-full rounded-t-lg bg-muted overflow-hidden">
                    {service.image_url ? (
                      <img
                        src={service.image_url}
                        alt={service.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Scissors className="h-8 w-8 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  <div className="flex flex-col flex-1 justify-between px-4 pb-0">
                    <div className="flex flex-col gap-1">
                      <span className="font-semibold truncate">
                        {service.name}
                      </span>
                      {service.description && (
                        <span className="text-xs text-muted-foreground line-clamp-2">
                          {service.description}
                        </span>
                      )}
                      <div className="flex items-center gap-3 text-sm text-muted-foreground">
                        {service.duration_min && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3.5 w-3.5" />
                            {service.duration_min} min
                          </span>
                        )}
                        {service.price !== null && (
                          <span className="flex items-center gap-1 font-medium text-foreground">
                            R${" "}
                            {Number(service.price).toFixed(2).replace(".", ",")}
                          </span>
                        )}
                      </div>
                    </div>

                    <Button
                      size="sm"
                      variant="outline"
                      className="w-full cursor-pointer mt-3 rounded-full"
                      onClick={() => setEditService(service)}
                    >
                      <Pencil className="h-3.5 w-3.5 mr-2" />
                      Editar
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
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
              Proximo
            </Button>
          </div>
        </div>
      )}

      <CreateServiceModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={service => {
          setServices(prev => [...prev, service]);
          notifyDashboardRefresh();
        }}
      />
      <UpdateServiceModal
        open={!!editService}
        service={editService}
        onClose={() => setEditService(null)}
        onUpdated={updated => {
          setServices(prev =>
            prev.map(s => (s.id === updated.id ? updated : s)),
          );
          notifyDashboardRefresh();
        }}
        onDeleted={id => {
          setServices(prev => prev.filter(s => s.id !== id));
          notifyDashboardRefresh();
        }}
      />
    </main>
  );
}
