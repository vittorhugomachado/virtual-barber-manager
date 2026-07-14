import { useEffect, useState, type FormEvent } from "react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { checkEmailExists } from "@/utils/check-email-exist";
import { verifyPassword } from "@/utils/verify-password";

type PendingSecurityAction = "email" | "password" | null;

export function useSecuritySettings() {
  const barbershopEmail = useBarbershopStore(state => state.barbershop?.email);
  const [currentEmail, setCurrentEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [emailToConfirm, setEmailToConfirm] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isVerifyingPassword, setIsVerifyingPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);
  const [pendingAction, setPendingAction] =
    useState<PendingSecurityAction>(null);

  useEffect(() => {
    let active = true;

    async function fetchCurrentEmail() {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!active) return;
      setCurrentEmail(user?.email ?? barbershopEmail ?? "");
    }

    void fetchCurrentEmail();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "USER_UPDATED" && session?.user?.email) {
        setCurrentEmail(session.user.email);
      }
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [barbershopEmail]);

  async function handleEmailChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextEmail = newEmail.toLowerCase().trim();

    if (!nextEmail || nextEmail === currentEmail.toLowerCase()) {
      toast.error("Por favor, insira um email diferente do atual");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(nextEmail)) {
      toast.error("Por favor, insira um email válido");
      return;
    }

    setIsCheckingEmail(true);
    try {
      if (await checkEmailExists(nextEmail)) {
        toast.error("Este email já está em uso. Por favor, use outro email.");
        return;
      }
      setNewEmail(nextEmail);
      setPasswordError(null);
      setPendingAction("email");
      setShowPasswordModal(true);
    } catch {
      toast.error(
        "Erro ao verificar disponibilidade do email. Tente novamente.",
      );
    } finally {
      setIsCheckingEmail(false);
    }
  }

  function handlePasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (newPassword.length < 6) {
      toast.error("A nova senha deve ter pelo menos 6 caracteres");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      toast.error("As senhas não coincidem");
      return;
    }
    setPasswordError(null);
    setPendingAction("password");
    setShowPasswordModal(true);
  }

  async function updateEmail() {
    const { error } = await supabase.auth.updateUser(
      { email: newEmail },
      {
        emailRedirectTo: `${window.location.origin}/auth/email-change-confirmed`,
      },
    );
    if (error) {
      if (error.message.includes("already been registered")) {
        toast.error("Este email já está registrado em outra conta.");
      } else {
        toast.error("Não foi possível solicitar a alteração do email.");
      }
      throw new Error("email_update_failed");
    }

    setEmailToConfirm(newEmail);
    setShowConfirmationModal(true);
    setNewEmail("");
    toast.success("Link de confirmação enviado! Verifique seu novo email.");
  }

  async function updatePassword() {
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    if (error) {
      if (error.message.includes("New password should be different")) {
        toast.error("A nova senha precisa ser diferente da senha atual");
      } else {
        toast.error("Não foi possível alterar a senha.");
      }
      throw new Error("password_update_failed");
    }

    setNewPassword("");
    setConfirmNewPassword("");
    toast.success("Senha alterada com sucesso!");
  }

  async function handlePasswordConfirm(password: string) {
    setIsVerifyingPassword(true);
    setPasswordError(null);
    try {
      if (!(await verifyPassword(password))) {
        setPasswordError("Senha incorreta. Tente novamente.");
        throw new Error("invalid_password");
      }

      if (pendingAction === "password") await updatePassword();
      if (pendingAction === "email") await updateEmail();
      setShowPasswordModal(false);
      setPendingAction(null);
    } catch (error) {
      if (error instanceof Error && error.message === "invalid_password") {
        throw error;
      }
      if (
        !(error instanceof Error) ||
        !["email_update_failed", "password_update_failed"].includes(
          error.message,
        )
      ) {
        toast.error("Ocorreu um erro inesperado. Tente novamente.");
      }
      throw error;
    } finally {
      setIsVerifyingPassword(false);
    }
  }

  function closePasswordModal() {
    setShowPasswordModal(false);
    setPasswordError(null);
    setPendingAction(null);
  }

  function closeConfirmationModal() {
    setShowConfirmationModal(false);
    setEmailToConfirm("");
  }

  return {
    currentEmail,
    newEmail,
    setNewEmail,
    newPassword,
    setNewPassword,
    confirmNewPassword,
    setConfirmNewPassword,
    isCheckingEmail,
    showPasswordModal,
    showConfirmationModal,
    emailToConfirm,
    showPassword,
    setShowPassword,
    isVerifyingPassword,
    passwordError,
    pendingAction,
    handleEmailChange,
    handlePasswordChange,
    handlePasswordConfirm,
    clearPasswordError: () => setPasswordError(null),
    closePasswordModal,
    closeConfirmationModal,
  };
}
