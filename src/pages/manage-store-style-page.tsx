import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { Spinner } from "@/components/ui/spinner";

type StoreStyle = {
  id?: string;
  text_color: string;
  primary_color: string;
  text_button_color: string;
  background_color: string;
};

const DEFAULT_STYLE: Omit<StoreStyle, "id"> = {
  text_color: "#FFFFFF",
  primary_color: "#000000",
  text_button_color: "#000000",
  background_color: "#09090B",
};

const PREVIEW_URL = "http://localhost:5174/barber?preview=true";
const PREVIEW_ORIGIN = "http://localhost:5174";

export function ManageStoreStylePage() {
  const { barbershop } = useBarbershopStore();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [storeStyleId, setStoreStyleId] = useState<string | null>(null);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [initialStyle, setInitialStyle] = useState(DEFAULT_STYLE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const hasChanges =
    style.text_color !== initialStyle.text_color ||
    style.primary_color !== initialStyle.primary_color ||
    style.text_button_color !== initialStyle.text_button_color ||
    style.background_color !== initialStyle.background_color;

  useEffect(() => {
    let cancelled = false;

    async function loadStoreStyle() {
      if (!barbershop?.id) {
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      const { data, error } = await supabase
        .from("store_style")
        .select("*")
        .eq("barbershop_id", barbershop.id)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error("Erro ao carregar estilo da loja:", error);
        toast.error("Nao foi possivel carregar o estilo da loja.");
      }

      if (data) {
        const loadedStyle = {
          text_color: data.text_color ?? DEFAULT_STYLE.text_color,
          primary_color: data.primary_color ?? DEFAULT_STYLE.primary_color,
          text_button_color:
            data.text_button_color ?? DEFAULT_STYLE.text_button_color,
          background_color:
            data.background_color ?? DEFAULT_STYLE.background_color,
        };

        setStoreStyleId(data.id);
        setStyle(loadedStyle);
        setInitialStyle(loadedStyle);
      } else {
        setStyle(DEFAULT_STYLE);
        setInitialStyle(DEFAULT_STYLE);
      }

      setIsLoading(false);
    }

    void loadStoreStyle();

    return () => {
      cancelled = true;
    };
  }, [barbershop?.id]);

  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "BARBERSHOP_PREVIEW_STYLE",
        style,
      },
      PREVIEW_ORIGIN,
    );
  }, [style]);

  function updateStyle<K extends keyof typeof DEFAULT_STYLE>(
    key: K,
    value: (typeof DEFAULT_STYLE)[K],
  ) {
    setStyle(current => ({ ...current, [key]: value }));
  }

  async function handleSave() {
    if (!barbershop?.id) {
      toast.error("Barbearia nao encontrada.");
      return;
    }

    setIsSaving(true);

    const payload = {
      ...style,
      barbershop_id: barbershop.id,
      updated_at: new Date().toISOString(),
    };

    const query = storeStyleId
      ? supabase.from("store_style").update(payload).eq("id", storeStyleId)
      : supabase.from("store_style").insert(payload).select("id").single();

    const { data, error } = await query;

    setIsSaving(false);

    if (error) {
      console.error("Erro ao salvar estilo da loja:", error);
      toast.error("Nao foi possivel salvar o estilo da loja.", {
        description: error.message,
      });
      return;
    }

    if (!storeStyleId && data && "id" in data) {
      setStoreStyleId(data.id as string);
    }

    setInitialStyle(style);
    toast.success("Estilo da loja salvo!", {
      description: "As alteracoes foram aplicadas no banco.",
    });
    setPreviewKey(current => current + 1);
  }

  function sendPreviewStyle() {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "BARBERSHOP_PREVIEW_STYLE",
        style,
      },
      PREVIEW_ORIGIN,
    );
  }

  return (
    <div
      className="relative h-full overflow-y-auto border"
      style={{ backgroundColor: style.background_color }}
    >
      <iframe
        key={previewKey}
        ref={iframeRef}
        title="Preview da loja"
        className="h-dvh w-full"
        src={PREVIEW_URL}
        onLoad={sendPreviewStyle}
      />

      <StyleControlBar
        style={style}
        isLoading={isLoading}
        isSaving={isSaving}
        hasChanges={hasChanges}
        onChange={updateStyle}
        onSave={handleSave}
      />
    </div>
  );
}

function StyleControlBar({
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

function ColorField({
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
