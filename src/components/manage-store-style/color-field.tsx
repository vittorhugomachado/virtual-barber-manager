import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function ColorField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="min-w-0 flex-1 flex flex-col items-center space-y-1">
      <Label className="text-xs text-neutral-500">{label}</Label>
      <Input
        type="color"
        value={value}
        onChange={event => onChange(event.target.value)}
        className="h-8 w-8 shrink-0 cursor-pointer p-1 rounded-full"
      />
    </div>
  );
}
