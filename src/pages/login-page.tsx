import { Logo } from "@/components/common/logo";
import { LoginForm } from "@/components/forms/login-form";

export const LoginPage = () => {
  return (
    <main className="w-full h-screen bg-zinc-100 flex items-center justify-center px-4 lg:justify-between lg:px-0">
      <Logo style="w-55 md:w-80 absolute top-8 lg:left-8" />
      <div className="hidden lg:block antonio text-5xl leading-snug max-w-xs">
        <h3 className="absolute bottom-8 left-4">
          Bem vindo a <strong className="text-[#0458EE]">Virtual</strong>!{" "}
          <br /> Gestão inteligente, <br />
          resultados reais
        </h3>
      </div>
      <LoginForm />
    </main>
  );
};
