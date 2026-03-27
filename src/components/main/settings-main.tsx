import { lazy, Suspense, useEffect, useRef, useState } from "react";
import { BarbershopSettingsForm } from "../forms/barbershop-settings-form";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
// import { PlansSection } from "../sections/settings-page/plans-section";

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

export function SettingsMain() {
  return (
    <div className="w-full flex flex-col items-center overflow-y-auto overflow-x-hidden">
      <BarbershopSettingsForm />
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <DeferredSection fallback={<FormSectionSkeleton />}>
        <AddressForm />
      </DeferredSection>
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <DeferredSection fallback={<HoursSectionSkeleton />}>
        <OpeningHoursSection />
      </DeferredSection>
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <DeferredSection fallback={<GallerySectionSkeleton />}>
        <BarbershopGallery />
      </DeferredSection>
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <DeferredSection fallback={<UsersSectionSkeleton />}>
        <UsersSection />
      </DeferredSection>
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
      {shouldRender ? <Suspense fallback={fallback}>{children}</Suspense> : fallback}
    </div>
  );
}

function FormSectionSkeleton() {
  return (
    <div className="w-full max-w-180 md:px-16 flex flex-col gap-6 mb-6">
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
    <div className="w-full max-w-180 md:px-16 flex flex-col gap-6 mb-6">
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
    <div className="w-full max-w-180 mx-16 mt-2 mb-8 px-3 flex flex-col gap-4">
      <div className="px-3 space-y-2">
        <Skeleton className="h-7 w-32" />
        <Skeleton className="h-4 w-full max-w-96" />
      </div>
      <div className="space-y-2">
        {Array.from({ length: 2 }).map((_, index) => (
          <div key={index} className="border rounded-xl p-5 flex justify-between items-center gap-4">
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
