import { useBarbershopStore } from "@/store/barbershop.store";

export function BarbershopSettingsServicesMain() {
  const { barbershop } = useBarbershopStore();

  return (
    <main className="w-full flex flex-col items-center">
      <h3 className="w-full max-w-screen text-3xl text-center mx-8 mt-12 md:text-start md:mt-3 md:ml-33">
        {barbershop?.name} |{" "}
        <span className="text-xl font-extralight">Serviços</span>
      </h3>
      <main>
        <h1>Em construção</h1>
      </main>
    </main>
  );
}
