import { Logo } from "@/components/common/logo";
import { LoginForm } from "@/components/forms/login-form";

export function LoginPage() {
  return (
    <main className="w-full min-h-screen bg-zinc-100 dark:bg-transparent flex items-center justify-center px-4 py-18 lg:py-0 lg:justify-between lg:px-0">
      <Logo style="w-55 md:w-80 absolute lg:fixed top-8 lg:left-8" />
      <div className="hidden lg:block antonio text-5xl leading-snug max-w-xs">
        <h3 className="absolute lg:fixed bottom-8 left-4">
          Bem vindo a <strong className="text-[#0458EE]">Virtual</strong>!{" "}
          <br /> Gestão inteligente, <br />
          resultados reais
        </h3>
      </div>
      <LoginForm />
    </main>
  );
}
