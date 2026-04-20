import { Logo } from "@/components/common/logo";
import { Mail, CheckCircle } from "lucide-react";

interface SuccessSignupPageProps {
  email?: string;
}

export function SuccessSignupPage({
  email = "seu e-mail",
}: SuccessSignupPageProps) {
  return (
    <main className="w-screen min-h-screen bg-zinc-100 dark:bg-transparent flex flex-col items-center justify-center px-4 lg:px-0 overflow-x-hidden">
      <Logo style="w-55 md:w-60 mb-8" />

      <div className="flex flex-col items-center justify-center max-w-md w-full mx-4 lg:mx-0">
        <div className="bg-white dark:bg-zinc-900 rounded-2xl shadow-xl p-8 text-center">
          <CheckCircle className="w-8 h-8 text-blue-600 mx-auto mb-4 dark:text-blue-400" />

          <h1 className="text-2xl font-bold mb-2">Verifique seu e-mail</h1>

          <p className="text-muted-foreground mb-6">
            Enviamos um link de confirmação para <br />
            <strong className="text-foreground">{email}</strong>
          </p>

          <div className="bg-blue-50 dark:bg-blue-950/30 rounded-lg p-4 mb-6">
            <p className="text-sm flex items-center justify-center gap-2 text-blue-700 dark:text-blue-300">
              <Mail /> Clique no link enviado para ativar sua conta
            </p>
          </div>

          <p className="text-sm text-muted-foreground">
            Não recebeu o e-mail? Verifique sua caixa de spam ou{" "}
            <button className="text-blue-600 hover:underline font-medium cursor-pointer">
              clique aqui para reenviar
            </button>
          </p>
        </div>
      </div>
    </main>
  );
}
