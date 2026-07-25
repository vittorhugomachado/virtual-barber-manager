import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { EmailChangeConfirmationModal } from "@/components/modals/settings/email-change-confirmation-modal";
import { PasswordConfirmModal } from "@/components/modals/password/password-confirm-modal";
import { useSecuritySettings } from "@/hooks/use-security-settings";

export function SecuritySettingsForm() {
  const security = useSecuritySettings();
  const passwordModalDescription =
    security.pendingAction === "password"
      ? "Digite sua senha atual para confirmar a alteração da senha"
      : `Digite sua senha para confirmar a alteração do email de ${security.currentEmail} para ${security.newEmail}`;

  return (
    <>
      <div className="w-full max-w-180 h-full relative">
        <Card className="bg-transparent border-none">
          <CardHeader>
            <div className="flex flex-col w-fit">
              <CardTitle className="font-semibold text-2xl">
                Segurança
              </CardTitle>
              <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
            </div>
          </CardHeader>

          <CardContent>
            <form
              onSubmit={security.handleEmailChange}
              className="flex flex-col items-center gap-6"
            >
              <FieldGroup className="gap-3 max-w-106">
                <Field>
                  <FieldLabel htmlFor="settings-security-current-email">
                    Email atual
                  </FieldLabel>
                  <Input
                    id="settings-security-current-email"
                    type="email"
                    value={security.currentEmail}
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
                    value={security.newEmail}
                    onChange={event => security.setNewEmail(event.target.value)}
                    placeholder="novo@email.com"
                    autoComplete="email"
                    disabled={
                      security.isCheckingEmail || security.isVerifyingPassword
                    }
                  />
                  <p className="text-xs text-gray-500">
                    Você receberá um link de confirmação no novo email
                  </p>
                </Field>
              </FieldGroup>

              <Button
                type="submit"
                disabled={
                  security.isCheckingEmail ||
                  security.isVerifyingPassword ||
                  !security.newEmail
                }
                className="w-60 mx-auto rounded-full"
              >
                {security.isCheckingEmail ? "Verificando..." : "Alterar email"}
              </Button>
            </form>
          </CardContent>
        </Card>

        <Card className="bg-transparent border-none">
          <CardContent>
            <form
              onSubmit={security.handlePasswordChange}
              className="flex flex-col items-center gap-6"
            >
              <FieldGroup className="gap-3 max-w-106">
                <PasswordField
                  id="settings-security-new-password"
                  label="Nova senha"
                  value={security.newPassword}
                  placeholder="Digite a nova senha"
                  showPassword={security.showPassword}
                  disabled={security.isVerifyingPassword}
                  onChange={security.setNewPassword}
                  onToggle={() => security.setShowPassword(value => !value)}
                />
                <p className="-mt-2 text-xs text-gray-500">
                  Use pelo menos 6 caracteres
                </p>

                <PasswordField
                  id="settings-security-confirm-new-password"
                  label="Confirmar nova senha"
                  value={security.confirmNewPassword}
                  placeholder="Repita a nova senha"
                  showPassword={security.showPassword}
                  disabled={security.isVerifyingPassword}
                  onChange={security.setConfirmNewPassword}
                  onToggle={() => security.setShowPassword(value => !value)}
                />
              </FieldGroup>

              <Button
                type="submit"
                disabled={
                  security.isVerifyingPassword ||
                  !security.newPassword ||
                  !security.confirmNewPassword
                }
                className="w-60 mx-auto rounded-full"
              >
                Alterar senha
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>

      <PasswordConfirmModal
        key={security.pendingAction ?? "security-action"}
        open={security.showPasswordModal}
        onClose={security.closePasswordModal}
        onConfirm={security.handlePasswordConfirm}
        onClearError={security.clearPasswordError}
        title={
          security.pendingAction === "password"
            ? "Confirmar alteração de senha"
            : "Confirmar alteração de email"
        }
        description={passwordModalDescription}
        isLoading={security.isVerifyingPassword}
        errorMessage={security.passwordError}
      />

      <EmailChangeConfirmationModal
        open={security.showConfirmationModal}
        newEmail={security.emailToConfirm}
        onClose={security.closeConfirmationModal}
      />
    </>
  );
}

type PasswordFieldProps = {
  id: string;
  label: string;
  value: string;
  placeholder: string;
  showPassword: boolean;
  disabled: boolean;
  onChange: (value: string) => void;
  onToggle: () => void;
};

function PasswordField({
  id,
  label,
  value,
  placeholder,
  showPassword,
  disabled,
  onChange,
  onToggle,
}: PasswordFieldProps) {
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <div className="relative">
        <Input
          id={id}
          type={showPassword ? "text" : "password"}
          value={value}
          onChange={event => onChange(event.target.value)}
          placeholder={placeholder}
          autoComplete="new-password"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onToggle}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          tabIndex={-1}
        >
          {showPassword ? (
            <EyeOff className="h-4 w-4" />
          ) : (
            <Eye className="h-4 w-4" />
          )}
        </button>
      </div>
    </Field>
  );
}
