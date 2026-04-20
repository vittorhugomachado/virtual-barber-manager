import { Toaster as Sonner } from "sonner";

export function Toaster() {
  return (
    <Sonner
      theme="system"
      position="bottom-right"
      toastOptions={{
        classNames: {
          error: "!bg-red-500 !text-white !border-red-600",
          success: "!bg-green-500 !text-white !border-green-600",
        },
      }}
    />
  );
}
