import { Input } from "../ui/input";
import { Label } from "../ui/label";

export function ColorField({
  label,
  value,
  onChange,
  className = "",
  labelClassName = "",
  inputClassName = "",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  className?: string;
  labelClassName?: string;
  inputClassName?: string;
}) {
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center space-y-1 ${className}`}
    >
      <Label
        className={`whitespace-nowrap text-xs leading-none text-neutral-500 ${labelClassName}`}
      >
        {label}
      </Label>
      <Input
        type="color"
        value={value}
        onChange={event => onChange(event.target.value)}
        className={`h-8 w-8 shrink-0 cursor-pointer rounded-full p-1 ${inputClassName}`}
      />
    </div>
  );
}
