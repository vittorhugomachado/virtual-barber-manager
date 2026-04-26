// components/settings/security-settings-form.tsx
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { useBarbershopStore } from "@/store/barbershop.store";
import { Button } from "../ui/button";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/supabase";
import { EmailChangeConfirmationModal } from "../modals/settings/email-change-confirmation-modal";
import { PasswordConfirmModal } from "../modals/password/password-confirm-modal";
import { checkEmailExists } from "@/utils/check-email-exist";
import { verifyPassword } from "@/utils/verify-password";
import { toast } from "sonner";

export function SecuritySettingsForm() {
  const { barbershop } = useBarbershopStore();
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [emailToConfirm, setEmailToConfirm] = useState("");
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const handleClearPasswordError = () => {
    setPasswordError(null);
  };

  // Buscar o email atual diretamente do usuário logado
  useEffect(() => {
    const fetchCurrentEmail = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentEmail(user.email);
      } else if (barbershop?.email) {
        setCurrentEmail(barbershop.email);
      }
    };

    fetchCurrentEmail();

    // Escutar mudanças no usuário (importante para quando o email for confirmado)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "USER_UPDATED" && session?.user?.email) {
        setCurrentEmail(session.user.email);
      }
    });

    return () => subscription.unsubscribe();
  }, [barbershop?.email]);

  const handleEmailChange = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!newEmail || newEmail === currentEmail) {
      toast.error("Por favor, insira um email diferente do atual");
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(newEmail)) {
      toast.error("Por favor, insira um email válido");
      return;
    }

    setIsLoading(true);

    try {
      const emailExists = await checkEmailExists(newEmail);

      if (emailExists) {
        toast.error("Este email já está em uso. Por favor, use outro email.");
        setIsLoading(false);
        return;
      }

      setPasswordError(null);
      setShowPasswordModal(true);
      setIsLoading(false);
    } catch (error) {
      console.error("Erro ao verificar email:", error);
      toast.error(
        "Erro ao verificar disponibilidade do email. Tente novamente.",
      );
      setIsLoading(false);
    }
  };

  const handlePasswordConfirm = async (password: string) => {
    setIsVerifyingPassword(true);
    setPasswordError(null);

    try {
      const isPasswordValid = await verifyPassword(password);

      if (!isPasswordValid) {
        setPasswordError("Senha incorreta. Tente novamente.");
        setIsVerifyingPassword(false);
        return;
      }

      const { error } = await supabase.auth.updateUser(
        { email: newEmail },
        {
          emailRedirectTo: `${window.location.origin}/auth/email-change-confirmed`,
        },
      );

      if (error) {
        console.error("Erro ao solicitar alteração de email:", error.message);

        if (error.message.includes("already been registered")) {
          toast.error("Este email já está registrado em outra conta.");
        } else {
          toast.error(`Erro: ${error.message}`);
        }

        setIsVerifyingPassword(false);
        setShowPasswordModal(false);
        return;
      }

      setEmailToConfirm(newEmail);
      setShowConfirmationModal(true);
      setShowPasswordModal(false);
      setNewEmail("");
      toast.success("Link de confirmação enviado! Verifique seu novo email.");
    } catch (error) {
      console.error("Erro inesperado:", error);
      toast.error("Ocorreu um erro inesperado. Tente novamente.");
    } finally {
      setIsVerifyingPassword(false);
    }
  };

  const handleClosePasswordModal = () => {
    setShowPasswordModal(false);
    setPasswordError(null);
    setIsLoading(false);
  };

  const handleCloseConfirmationModal = () => {
    setShowConfirmationModal(false);
    setEmailToConfirm("");

    // Recarregar o email atual após confirmação
    const refreshCurrentEmail = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user?.email) {
        setCurrentEmail(user.email);
      }
    };
    refreshCurrentEmail();
  };

  return (
    <>
      <form
        onSubmit={handleEmailChange}
        className="w-full max-w-180 mx-auto md:px-16 mt-2 mb-18 flex flex-col"
      >
        <Card className="bg-transparent border-none">
          <CardHeader className="mt-3">
            <div className="flex flex-col w-fit">
              <CardTitle className="font-semibold text-2xl">
                Segurança
              </CardTitle>
              <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
            </div>
          </CardHeader>

          <CardContent>
            <FieldGroup className="gap-3">
              <Field>
                <FieldLabel htmlFor="settings-security-email">
                  Email atual
                </FieldLabel>
                <Input
                  id="settings-security-current-email"
                  type="email"
                  value={currentEmail}
                  disabled
                  className="bg-gray-50"
                />
                <p className="text-xs text-gray-500">
                  Seu email atual cadastrado
                </p>
              </Field>

              <Field>
                <FieldLabel htmlFor="settings-security-new-email">
                  Novo email
                </FieldLabel>
                <Input
                  id="settings-security-new-email"
                  type="email"
                  value={newEmail}
                  onChange={e => setNewEmail(e.target.value)}
                  placeholder="novo@email.com"
                  disabled={isLoading}
                />
                <p className="text-xs text-gray-500">
                  Você receberá um link de confirmação no novo email
                </p>
              </Field>
            </FieldGroup>
          </CardContent>
        </Card>

        <Button
          type="submit"
          disabled={isLoading || !newEmail}
          className="w-60 mx-auto rounded-full"
        >
          {isLoading ? "Verificando..." : "Alterar email"}
        </Button>
      </form>

      <PasswordConfirmModal
        open={showPasswordModal}
        onClose={handleClosePasswordModal}
        onConfirm={handlePasswordConfirm}
        onClearError={handleClearPasswordError} // Adicione esta linha
        title="Confirmar alteração de email"
        description={`Digite sua senha para confirmar a alteração do email de ${currentEmail} para ${newEmail}`}
        isLoading={isVerifyingPassword}
        errorMessage={passwordError}
      />

      <EmailChangeConfirmationModal
        open={showConfirmationModal}
        newEmail={emailToConfirm}
        onClose={handleCloseConfirmationModal}
      />
    </>
  );
}
