import { useEffect, useState } from "react";
import { Logo } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { CheckCircle, Mail, PencilLine } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/supabase";
import { useLocation } from "react-router";

interface PendingSignupData {
  email: string;
  userId: string;
  changeToken: string;
}

function isPendingSignupData(value: unknown): value is PendingSignupData {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;

  return (
    typeof candidate.email === "string" &&
    typeof candidate.userId === "string" &&
    typeof candidate.changeToken === "string"
  );
}

function readPendingSignupFromStorage() {
  const rawValue = sessionStorage.getItem("pending-signup");

  if (!rawValue) return null;

  try {
    const parsedValue = JSON.parse(rawValue);
    return isPendingSignupData(parsedValue) ? parsedValue : null;
  } catch {
    return null;
  }
}

export function SuccessSignupPage() {
  const location = useLocation();
  const [pendingSignup, setPendingSignup] = useState<PendingSignupData | null>(
    null,
  );
  const [newEmail, setNewEmail] = useState("");
  const [isEditingEmail, setIsEditingEmail] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const stateValue = isPendingSignupData(location.state)
      ? location.state
      : null;
    const storedValue = readPendingSignupFromStorage();
    const signupData = stateValue ?? storedValue;

    if (!signupData) return;

    setPendingSignup(signupData);
    setNewEmail(signupData.email);
    sessionStorage.setItem("pending-signup", JSON.stringify(signupData));
  }, [location.state]);

  async function handleEmailUpdate(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!pendingSignup || isSubmitting) return;

    const normalizedEmail = newEmail.trim().toLowerCase();

    if (!normalizedEmail) {
      toast.error("Digite um e-mail valido");
      return;
    }

    if (normalizedEmail === pendingSignup.email) {
      setIsEditingEmail(false);
      return;
    }

    setIsSubmitting(true);

    try {
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/update-signup-email`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            user_id: pendingSignup.userId,
            current_email: pendingSignup.email,
            new_email: normalizedEmail,
            change_token: pendingSignup.changeToken,
          }),
        },
      );

      const payload = (await response.json()) as { error?: string };

      if (!response.ok) {
        throw new Error(payload.error ?? "Nao foi possivel alterar o e-mail.");
      }

      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: normalizedEmail,
      });

      if (resendError) {
        throw new Error(resendError.message);
      }

      const updatedSignup = {
        ...pendingSignup,
        email: normalizedEmail,
      };

      setPendingSignup(updatedSignup);
      setNewEmail(normalizedEmail);
      setIsEditingEmail(false);
      sessionStorage.setItem("pending-signup", JSON.stringify(updatedSignup));
      toast.success("E-mail atualizado. Enviamos uma nova confirmacao.");
    } catch (error) {
      toast.error("Erro ao alterar e-mail", {
        description:
          error instanceof Error ? error.message : "Tente novamente.",
      });
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
      <Logo style="w-55 md:w-60 mb-8" />

      <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center w-full">
          <CheckCircle className="w-8 h-8 text-blue-600 mx-auto mb-4 dark:text-blue-400" />

          <h1 className="text-2xl font-bold mb-2">Verifique seu e-mail</h1>

          <p className="text-muted-foreground mb-6">
            Enviamos um link de confirmacao para <br />
            <strong className="text-foreground">
              {pendingSignup?.email ?? "seu e-mail"}
            </strong>
          </p>

          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mb-6">
            <p className="text-sm flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300">
              <Mail className="h-4 w-4" /> Clique no link enviado para ativar
              sua conta
            </p>
          </div>

          {pendingSignup ? (
            isEditingEmail ? (
              <form
                className="space-y-3 text-left"
                onSubmit={handleEmailUpdate}
              >
                <label
                  htmlFor="update-signup-email"
                  className="text-sm font-medium text-foreground"
                >
                  Alterar e-mail do cadastro
                </label>
                <Input
                  id="update-signup-email"
                  type="email"
                  value={newEmail}
                  onChange={event => setNewEmail(event.target.value)}
                  placeholder="novoemail@exemplo.com"
                  disabled={isSubmitting}
                />
                <div className="flex gap-3">
                  <Button
                    type="submit"
                    className="flex-1"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? "Salvando..." : "Salvar novo e-mail"}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="flex-1"
                    disabled={isSubmitting}
                    onClick={() => {
                      setNewEmail(pendingSignup.email);
                      setIsEditingEmail(false);
                    }}
                  >
                    Cancelar
                  </Button>
                </div>
              </form>
            ) : (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Digitou o e-mail errado? Voce pode alterar o endereco e
                  receber uma nova confirmacao.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setIsEditingEmail(true)}
                >
                  <PencilLine className="h-4 w-4" />
                  Alterar e-mail
                </Button>
              </div>
            )
          ) : (
            <p className="text-sm text-muted-foreground">
              Nao encontramos os dados deste cadastro. Se precisar trocar o
              e-mail, refaca o processo de cadastro.
            </p>
          )}
        </div>
      </div>
    </main>
  );
}
