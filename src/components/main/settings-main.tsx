import { SettingsForm } from "../forms/barbershop-settings-form";
import { UsersSection } from "../sections/settings-page/user-section";
import { PlansSection } from "../sections/settings-page/plans-section";
import { Separator } from "@/components/ui/separator";

export function SettingsMain() {
  return (
    <div className="w-full flex flex-col items-center overflow-y-auto">
      <SettingsForm />
      <Separator className="my-4 max-w-180 mx-16" />
      <UsersSection />
      <Separator className="my-4 max-w-180 mx-16" />
      <PlansSection />
    </div>
  );
}
