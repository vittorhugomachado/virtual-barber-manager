import { useEffect, useRef, useState, type PointerEvent } from "react";
import { ColorField } from "./color-field";
import { Button } from "../ui/button";
import { Spinner } from "../ui/spinner";
import type { StoreStyle } from "@/types/store-style";
import { BarbershopGallery } from "../common/barbershop-gallery";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "../ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../ui/alert-dialog";

type ColorKey =
  | "primary_color"
  | "text_color"
  | "text_button_color"
  | "background_color";

const COLOR_FIELDS: Array<{ key: ColorKey; label: string; className: string }> =
  [
    { key: "primary_color", label: "Primária", className: "w-14" },
    { key: "text_color", label: "Texto", className: "w-12" },
    { key: "text_button_color", label: "Texto botão", className: "w-16" },
    { key: "background_color", label: "Fundo", className: "w-12" },
  ];

function clamp(value: number, min = 0, max = 1) {
  return Math.min(max, Math.max(min, value));
}

function hexToRgb(hex: string) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16),
  };
}

function rgbToHex(r: number, g: number, b: number) {
  return `#${[r, g, b]
    .map(channel => Math.round(channel).toString(16).padStart(2, "0"))
    .join("")}`;
}

function hexToHsv(hex: string) {
  const { r, g, b } = hexToRgb(hex);
  const red = r / 255;
  const green = g / 255;
  const blue = b / 255;
  const max = Math.max(red, green, blue);
  const min = Math.min(red, green, blue);
  const delta = max - min;
  let h = 0;

  if (delta !== 0) {
    if (max === red) h = ((green - blue) / delta) % 6;
    else if (max === green) h = (blue - red) / delta + 2;
    else h = (red - green) / delta + 4;
    h *= 60;
  }

  if (h < 0) h += 360;

  return {
    h,
    s: max === 0 ? 0 : delta / max,
    v: max,
  };
}

function hsvToHex(h: number, s: number, v: number) {
  const chroma = v * s;
  const x = chroma * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - chroma;
  let r = 0;
  let g = 0;
  let b = 0;

  if (h < 60) [r, g, b] = [chroma, x, 0];
  else if (h < 120) [r, g, b] = [x, chroma, 0];
  else if (h < 180) [r, g, b] = [0, chroma, x];
  else if (h < 240) [r, g, b] = [0, x, chroma];
  else if (h < 300) [r, g, b] = [x, 0, chroma];
  else [r, g, b] = [chroma, 0, x];

  return rgbToHex((r + m) * 255, (g + m) * 255, (b + m) * 255);
}

function MobileColorPicker({
  label,
  value,
  onChange,
  onClose,
  compact,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  onClose: () => void;
  compact: boolean;
}) {
  const pickerRef = useRef<HTMLDivElement | null>(null);
  const [hexInput, setHexInput] = useState(value.toUpperCase());
  const { h, s, v } = hexToHsv(value);
  const pickerBottom = compact ? "bottom-[150px]" : "bottom-[88px]";

  useEffect(() => {
    setHexInput(value.toUpperCase());
  }, [value]);

  useEffect(() => {
    function handlePointerDown(event: globalThis.PointerEvent) {
      if (!pickerRef.current) return;
      if (pickerRef.current.contains(event.target as Node)) return;
      onClose();
    }

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [onClose]);

  function updateSaturationValue(event: PointerEvent<HTMLDivElement>) {
    const rect = event.currentTarget.getBoundingClientRect();
    const nextS = clamp((event.clientX - rect.left) / rect.width);
    const nextV = 1 - clamp((event.clientY - rect.top) / rect.height);
    onChange(hsvToHex(h, nextS, nextV));
  }

  return (
    <>
      <div
        className="fixed inset-0 z-20 bg-transparent md:hidden"
        onPointerDown={onClose}
      />
      <div
        ref={pickerRef}
        className={`fixed left-3 right-3 z-30 rounded-xl border border-neutral-800 bg-neutral-950 p-3 text-neutral-50 shadow-2xl md:hidden ${pickerBottom}`}
      >
      <div className="mb-2 flex items-center justify-between gap-3">
        <span className="text-sm font-medium">{label}</span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-md px-2 py-1 text-xs text-neutral-300 hover:bg-neutral-800"
        >
          Fechar
        </button>
      </div>

      <div
        className="relative h-36 touch-none overflow-hidden rounded-lg"
        style={{ backgroundColor: `hsl(${h} 100% 50%)` }}
        onPointerDown={event => {
          event.currentTarget.setPointerCapture(event.pointerId);
          updateSaturationValue(event);
        }}
        onPointerMove={event => {
          if (event.buttons !== 1) return;
          updateSaturationValue(event);
        }}
      >
        <div className="absolute inset-0 bg-linear-to-r from-white to-transparent" />
        <div className="absolute inset-0 bg-linear-to-t from-black to-transparent" />
        <div
          className="absolute size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow"
          style={{ left: `${s * 100}%`, top: `${(1 - v) * 100}%` }}
        />
      </div>

      <input
        type="range"
        min={0}
        max={360}
        value={Math.round(h)}
        onChange={event => onChange(hsvToHex(Number(event.target.value), s, v))}
        className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full accent-white"
        style={{
          background:
            "linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)",
        }}
      />

      <div className="mt-3 flex items-center gap-2">
        <span
          className="size-8 rounded-full border border-neutral-700"
          style={{ backgroundColor: value }}
        />
        <input
          value={hexInput}
          onChange={event => {
            const next = event.target.value.toUpperCase();
            setHexInput(next);
            if (/^#[0-9A-F]{6}$/.test(next)) onChange(next);
          }}
          onBlur={() => {
            if (!/^#[0-9A-F]{6}$/.test(hexInput)) {
              setHexInput(value.toUpperCase());
            }
          }}
          className="h-9 min-w-0 flex-1 rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm uppercase"
        />
      </div>
      </div>
    </>
  );
}

export function StyleControlBar({
  style,
  isLoading,
  isSaving,
  hasChanges,
  onChange,
  onSave,
  onGallerySaved,
  showGalleryButton = true,
  compact = false,
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
  onGallerySaved?: () => void;
  showGalleryButton?: boolean;
  compact?: boolean;
}) {
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [galleryHasChanges, setGalleryHasChanges] = useState(false);
  const [discardWarningOpen, setDiscardWarningOpen] = useState(false);
  const [activeColorKey, setActiveColorKey] = useState<ColorKey | null>(null);
  const [galleryKey, setGalleryKey] = useState(0);
  const toolbarPosition = compact
    ? "bottom-20 md:bottom-24"
    : "bottom-4 md:top-1/2 md:-translate-y-1/2";
  const activeColor = COLOR_FIELDS.find(field => field.key === activeColorKey);

  function handleGalleryOpenChange(open: boolean) {
    if (!open && galleryHasChanges) {
      setDiscardWarningOpen(true);
      return;
    }

    setGalleryOpen(open);
  }

  function discardGalleryChanges() {
    setGalleryHasChanges(false);
    setDiscardWarningOpen(false);
    setGalleryOpen(false);
    setGalleryKey(current => current + 1);
  }

  return (
    <>
      <div
        className={`fixed inset-x-2 z-20 flex items-end gap-2 md:inset-x-auto md:right-2 md:w-fit md:flex-col md:items-center ${toolbarPosition}`}
      >
        {showGalleryButton && (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setGalleryOpen(true)}
            className="h-12 w-24 shrink-0 rounded-full py-2 text-center shadow-lg whitespace-normal wrap-break-word md:h-auto md:w-20"
          >
            <span className="leading-tight">Editar galeria</span>
          </Button>
        )}
        <div className="min-w-0 flex-1 md:flex-none">
          <div className="mx-auto flex w-full max-w-76 items-center gap-0 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/95 px-2 py-2 text-neutral-50 shadow-2xl backdrop-blur md:w-full md:max-w-xl md:flex-col md:gap-4 md:overflow-visible md:px-2 md:pb-18 md:pt-6 md:py-3">
            {COLOR_FIELDS.map(field => (
              <ColorField
                key={field.key}
                label={field.label}
                value={style[field.key]}
                onChange={value => onChange(field.key, value)}
                onMobileOpen={() => setActiveColorKey(field.key)}
                className={`${field.className} flex-none md:w-full md:flex-1`}
                labelClassName="text-[12px] md:text-xs"
              />
            ))}

            <Button
              type="button"
              className="ml-auto h-10 w-13 shrink-0 rounded-md px-1 text-[13.5px] md:absolute md:bottom-0 md:mx-0.5 md:mb-1 md:w-[95%] md:scale-90 md:px-2 md:text-sm"
              disabled={isLoading || isSaving || !hasChanges}
              onClick={onSave}
            >
              {isSaving ? <Spinner /> : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

      {activeColor && (
        <MobileColorPicker
          label={activeColor.label}
          value={style[activeColor.key]}
          onChange={value => onChange(activeColor.key, value)}
          onClose={() => setActiveColorKey(null)}
          compact={compact}
        />
      )}

      {showGalleryButton && (
        <Dialog open={galleryOpen} onOpenChange={handleGalleryOpenChange}>
          <DialogContent
            className="max-h-[92vh] mb-12 mt-2 overflow-y-auto sm:max-w-5xl"
            onEscapeKeyDown={event => {
              event.preventDefault();
              handleGalleryOpenChange(false);
            }}
            onInteractOutside={event => {
              event.preventDefault();
              handleGalleryOpenChange(false);
            }}
          >
            <DialogHeader className="pr-10">
              <DialogTitle>Editar galeria</DialogTitle>
              <DialogDescription>
                As alterações ficam locais até você clicar em salvar imagens.
              </DialogDescription>
            </DialogHeader>
            <BarbershopGallery
              key={galleryKey}
              className="mb-0 max-w-none"
              onDirtyChange={setGalleryHasChanges}
              onSaved={() => {
                setGalleryHasChanges(false);
                onGallerySaved?.();
              }}
              inModal={true}
            />
          </DialogContent>
        </Dialog>
      )}

      <AlertDialog
        open={discardWarningOpen}
        onOpenChange={setDiscardWarningOpen}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Imagens não salvas</AlertDialogTitle>
            <AlertDialogDescription>
              Existem mudanças na galeria que ainda não foram salvas. Quer mesmo
              sair sem salvar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Continuar editando</AlertDialogCancel>
            <AlertDialogAction onClick={discardGalleryChanges}>
              Sair sem salvar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
