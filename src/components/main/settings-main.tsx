import { BarbershopSettingsForm } from "../forms/barbershop-settings-form";
import { UsersSection } from "../common/user-section";
// import { PlansSection } from "../sections/settings-page/plans-section";
import { Separator } from "@/components/ui/separator";
import { OpeningHoursSection } from "../common/opening-hours-section";
import { AddressForm } from "../forms/address-form";
import { BarbershopGallery } from "../common/barbershop-gallery";

export function SettingsMain() {
  return (
    <div className="w-full flex flex-col items-center overflow-y-auto overflow-x-hidden">
      <BarbershopSettingsForm />
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <AddressForm />
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <OpeningHoursSection />
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <BarbershopGallery />
      <Separator className="my-4 max-w-180 px-6 md:px-16" />
      <UsersSection />
      {/* <Separator className="my-4 max-w-180 mx-16" />
      <PlansSection /> */}
    </div>
  );
}
