import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BarbershopSettingsForm } from "../forms/barbershop-settings-form";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { AlertTriangle } from "lucide-react";
import { useSettingsAlerts } from "@/hooks/use-settings-alerts";
import { useLocation } from "react-router";

const SECTIONS = [
  { id: "dados-barbearia", label: "Barbearia" },
  { id: "seguranca", label: "Segurança" },
  { id: "endereco", label: "Endereço" },
  { id: "horarios", label: "Horários" },
  { id: "galeria", label: "Galeria" },
  { id: "usuários", label: "Usuários" },
] as const;

function SettingsNav({
  missingAddress,
  missingHours,
}: {
  missingAddress: boolean;
  missingHours: boolean;
}) {
  const [active, setActive] = useState<string>("barbershop");

  useEffect(() => {
    const observers: IntersectionObserver[] = [];

    SECTIONS.forEach(({ id }) => {
      const el = document.getElementById(`${id}`);
      if (!el) return;
      const obs = new IntersectionObserver(
        ([entry]) => {
          if (entry.isIntersecting) setActive(id);
        },
        { rootMargin: "-40% 0px -55% 0px" },
      );
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, []);

  function scrollTo(id: string) {
    document
      .getElementById(`${id}`)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <div className="sticky top-2 z-10 bg-background/90 backdrop-blur border-b px-4 md:px-12 py-2.5 flex flex-wrap gap-2">
      {SECTIONS.map(({ id, label }) => {
        const hasAlert =
          (id === "horarios" && missingHours) ||
          (id === "endereco" && missingAddress);
        return (
          <button
            key={id}
            onClick={() => scrollTo(id)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-colors cursor-pointer border ${
              active === id
                ? "bg-primary text-primary-foreground border-primary"
                : hasAlert
                  ? "bg-transparent text-yellow-500 border-yellow-500/60 hover:border-yellow-500"
                  : "bg-transparent text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
            }`}
          >
            {hasAlert && <AlertTriangle className="h-3.5 w-3.5 shrink-0" />}
            {label}
          </button>
        );
      })}
    </div>
  );
}

const AddressForm = lazy(() =>
  import("../forms/address-form").then(module => ({
    default: module.AddressForm,
  })),
);
const OpeningHoursSection = lazy(() =>
  import("../common/opening-hours-section").then(module => ({
    default: module.OpeningHoursSection,
  })),
);
const BarbershopGallery = lazy(() =>
  import("../common/barbershop-gallery").then(module => ({
    default: module.BarbershopGallery,
  })),
);
const UsersSection = lazy(() =>
  import("../common/user-section").then(module => ({
    default: module.UsersSection,
  })),
);
const SecuritySettingsForm = lazy(() =>
  import("../forms/security-settings-form").then(module => ({
    default: module.SecuritySettingsForm,
  })),
);

export function SettingsMain() {
  const { missingAddress, missingHours, refetch } = useSettingsAlerts();
  const location = useLocation();

  useEffect(() => {
    const hash = location.hash.replace("#", "");
    if (hash) {
      document
        .getElementById(hash)
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  return (
    <div className="w-full flex flex-col items-center overflow-x-hidden">
      <SettingsNav
        missingAddress={missingAddress}
        missingHours={missingHours}
      />
      <div id="dados-barbearia" className="w-full scroll-mt-14">
        <BarbershopSettingsForm />
      </div>
      <div id="seguranca" className="w-full scroll-mt-14">
        <DeferredSection fallback={<SecuritySectionSkeleton />}>
          <SecuritySettingsForm />
        </DeferredSection>
      </div>
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <div id="endereco" className="w-full scroll-mt-14">
        <DeferredSection fallback={<FormSectionSkeleton />}>
          <AddressForm onSaved={refetch} />
        </DeferredSection>
      </div>
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <div id="horarios" className="w-full scroll-mt-14">
        <DeferredSection fallback={<HoursSectionSkeleton />}>
          <OpeningHoursSection onSaved={refetch} />
        </DeferredSection>
      </div>
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <div id="galeria" className="w-full scroll-mt-14">
        <DeferredSection fallback={<GallerySectionSkeleton />}>
          <BarbershopGallery />
        </DeferredSection>
      </div>
      <Separator className="my-4 max-w-180 px-6 sm:mx-auto md:px-16" />
      <div id="usuários" className="w-full scroll-mt-14">
        <DeferredSection fallback={<UsersSectionSkeleton />}>
          <UsersSection />
        </DeferredSection>
      </div>
      <Separator className="my-4 max-w-180 px-6 sm:mx-auto md:px-16" />
      {/* <Separator className="my-4 max-w-180 mx-16" />
      <PlansSection /> */}
    </div>
  );
}

function DeferredSection({
  children,
  fallback,
}: {
  children: React.ReactNode;
  fallback: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender) return;

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin: "300px 0px" },
    );

    if (ref.current) {
      observer.observe(ref.current);
    }

    return () => observer.disconnect();
  }, [shouldRender]);

  return (
    <div ref={ref} className="w-full">
      {shouldRender ? (
        <Suspense fallback={fallback}>{children}</Suspense>
      ) : (
        fallback
      )}
    </div>
  );
}

function FormSectionSkeleton() {
  return (
    <div className="w-full max-w-180 sm:mx-auto md:px-16 flex flex-col gap-6 mb-6">
      <div className="px-3 mt-3 space-y-2">
        <Skeleton className="h-8 w-40" />
        <Skeleton className="h-4 w-full max-w-96" />
      </div>
      <div className="px-3 space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-10 w-full" />
        <div className="flex gap-3">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 flex-1" />
        </div>
        <div className="flex gap-3">
          <Skeleton className="h-10 flex-1" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>
      <Skeleton className="h-56 mx-3 rounded-lg" />
      <Skeleton className="h-10 w-60 mx-auto rounded-full" />
    </div>
  );
}

function HoursSectionSkeleton() {
  return (
    <div className="w-full max-w-180 px-3 md:px-16 mx-auto flex flex-col gap-6 mb-18">
      <div className="px-3 mt-3 space-y-2">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-4 w-full max-w-xl" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 3 }).map((_, index) => (
          <div key={index} className="p-4 rounded-lg border space-y-4">
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-10 rounded-full" />
              <Skeleton className="h-5 w-28" />
            </div>
            <Skeleton className="h-10 w-full max-w-95 ml-6" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-44 mx-auto rounded-full" />
    </div>
  );
}

function GallerySectionSkeleton() {
  return (
    <div className="w-full max-w-180 sm:mx-auto md:px-16 flex flex-col gap-6 mb-6">
      <div className="px-3 mt-3 space-y-2">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-4 w-52" />
      </div>
      <div className="px-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
        {Array.from({ length: 6 }).map((_, index) => (
          <Skeleton key={index} className="aspect-square rounded-lg" />
        ))}
      </div>
      <Skeleton className="h-10 w-40 ml-3 rounded-full" />
    </div>
  );
}

function UsersSectionSkeleton() {
  return (
    <div className="w-full max-w-180 sm:mx-auto mt-2 mb-8 px-3 flex flex-col gap-4">
      <div className="px-3 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full max-w-96" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div
            key={index}
            className="border rounded-xl p-5 flex justify-between items-center gap-4"
          >
            <Skeleton className="h-5 w-28" />
            <div className="flex items-center gap-3">
              <Skeleton className="h-6 w-24 rounded-full" />
              <Skeleton className="h-8 w-8 rounded-md" />
            </div>
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-36 rounded-full" />
    </div>
  );
}

function SecuritySectionSkeleton() {
  return (
    <div className="w-full max-w-180 sm:mx-auto md:px-16 flex flex-col gap-6 mb-18">
      <div className="px-3 mt-3 space-y-2">
        <Skeleton className="h-8 w-36" />
        <Skeleton className="h-4 w-full max-w-72" />
      </div>
      <div className="px-3">
        <Skeleton className="h-10 w-full" />
      </div>
    </div>
  );
}
