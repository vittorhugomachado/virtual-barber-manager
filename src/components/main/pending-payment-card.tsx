import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type PendingPaymentCardProps = {
  // true depois de ~2 min sem confirmação: oferece recomeçar a escolha.
  timedOut: boolean;
  onRestart: () => void;
};

export function PendingPaymentCard({
  timedOut,
  onRestart,
}: PendingPaymentCardProps) {
  return (
    <main className="min-h-screen bg-zinc-100 px-4 py-8 text-zinc-950 dark:bg-zinc-950 dark:text-zinc-50">
      <div className="mx-auto flex w-full max-w-lg flex-col">
        <div
          className={cn(
            "flex min-h-72 flex-col items-center justify-center gap-4 rounded-2xl border p-8 text-center shadow-sm",
            timedOut
              ? "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200"
              : "border-blue-200 bg-blue-50 text-blue-900 dark:border-blue-900 dark:bg-blue-950/30 dark:text-blue-200",
          )}
        >
          {timedOut ? (
            <>
              <div className="flex size-12 items-center justify-center rounded-full bg-amber-500 text-white">
                !
              </div>
              <div>
                <h1 className="text-xl font-semibold">
                  Nao identificamos seu pagamento
                </h1>
                <p className="mt-2 text-sm">
                  Nao recebemos a confirmacao. Se ja pagou, aguarde mais um
                  pouco e atualize a pagina. Caso contrario, escolha novamente
                  como deseja pagar.
                </p>
              </div>
              <Button type="button" size="lg" onClick={onRestart}>
                Escolher novamente
              </Button>
            </>
          ) : (
            <>
              <Loader2 className="size-10 animate-spin" />
              <div>
                <h1 className="text-xl font-semibold">
                  Seu pagamento esta sendo processado
                </h1>
                <p className="mt-2 text-sm">
                  Estamos aguardando a confirmacao do Asaas. O acesso e liberado
                  automaticamente assim que o pagamento for confirmado.
                </p>
              </div>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
