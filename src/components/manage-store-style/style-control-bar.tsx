import { useState } from "react";
import { ColorField } from "./color-field";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import type { StoreStyle } from "@/types/store-style";

export function StyleControlBar({
  style,
  isLoading,
  isSaving,
  hasChanges,
  onChange,
  onSave,
}: {
  style: Omit<StoreStyle, "id">;
  isLoading: boolean;
  isSaving: boolean;
  hasChanges: boolean;
  onChange: <K extends keyof Omit<StoreStyle, "id">>(
    key: K,
    value: Omit<StoreStyle, "id">[K],
  ) => void;
  onSave: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div className="fixed right-2 bottom-4 md:top-1/2 md:-translate-y-1/2 z-20 w-fit h-fit flex flex-col items-center gap-2">
        <div
          className={`${isOpen ? "translate-x-0 opacity-100" : "translate-x-full opacity-0 hidden md:block"}  transition-all duration-300 md:translate-x-0 md:opacity-100`}
        >
          <div className="mx-auto flex flex-col items-center w-full max-w-xl gap-4 rounded-xl border pt-6 px-0.5 shadow-2xl backdrop-blur border-neutral-800 bg-neutral-950/95 text-neutral-50 pb-18">
            <ColorField
              label="Primária"
              value={style.primary_color}
              onChange={value => onChange("primary_color", value)}
            />
            <ColorField
              label="Texto"
              value={style.text_color}
              onChange={value => onChange("text_color", value)}
            />
            <ColorField
              label="Texto botão"
              value={style.text_button_color}
              onChange={value => onChange("text_button_color", value)}
            />

            <ColorField
              label="Fundo"
              value={style.background_color}
              onChange={value => onChange("background_color", value)}
            />

            <Button
              type="button"
              className="h-10 w-[95%] mx-0.5 scale-90 shrink-0 rounded-md md:mb-1 absolute bottom-1 md:bottom-0"
              disabled={isLoading || isSaving || !hasChanges}
              onClick={onSave}
            >
              {isSaving ? <Spinner /> : "Salvar"}
            </Button>
          </div>
        </div>
        <button
          onClick={() => setIsOpen(prev => !prev)}
          className="bottom-4 text-sm right-4 min-w-10 h-10 z-30 flex items-center justify-center md:hidden bg-linear-to-br from-red-600 via-green-600 to-purple-700 text-black font-semibold p-3 rounded-full shadow-lg"
        >
          {isOpen ? "✕" : "Editar cores"}
        </button>
      </div>
    </>
  );
}
