import { useEffect, useRef, useState } from "react";
import { Palette, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";

type StoreStyle = {
  id?: string;
  text_color: string;
  theme_is_dark: boolean;
  primary_color: string;
  text_button_color: string;
};

const DEFAULT_STYLE: Omit<StoreStyle, "id"> = {
  text_color: "#FFFFFF",
  theme_is_dark: true,
  primary_color: "#000000",
  text_button_color: "#000000",
};

const PREVIEW_URL = "http://localhost:5174/barber?preview=true";
const PREVIEW_ORIGIN = "http://localhost:5174";

export function ManageStoreStylePage() {
  const { barbershop } = useBarbershopStore();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [iframeHeight, setIframeHeight] = useState(800);
  const [storeStyleId, setStoreStyleId] = useState<string | null>(null);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [initialStyle, setInitialStyle] = useState(DEFAULT_STYLE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const hasChanges =
    style.text_color !== initialStyle.text_color ||
    style.theme_is_dark !== initialStyle.theme_is_dark ||
    style.primary_color !== initialStyle.primary_color ||
    style.text_button_color !== initialStyle.text_button_color;

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.data?.type !== "BARBERSHOP_PREVIEW_HEIGHT") return;

      setIframeHeight(event.data.height);
    };

    window.addEventListener("message", handleMessage);

    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, []);

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
          theme_is_dark: data.theme_is_dark ?? DEFAULT_STYLE.theme_is_dark,
          primary_color: data.primary_color ?? DEFAULT_STYLE.primary_color,
          text_button_color:
            data.text_button_color ?? DEFAULT_STYLE.text_button_color,
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
    <div className="relative h-full overflow-y-auto border bg-background pb-36">
      <iframe
        key={previewKey}
        ref={iframeRef}
        title="Preview da loja"
        className="w-full pointer-events-none"
        src={PREVIEW_URL}
        style={{ height: iframeHeight }}
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
  return (
    <div className="fixed right-0 bottom-4 left-0 z-50 px-3">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-4 rounded-2xl border border-neutral-200 bg-white/95 p-4 text-neutral-950 shadow-2xl backdrop-blur dark:border-neutral-800 dark:bg-neutral-950/95 dark:text-neutral-50 md:flex-row md:items-end">
        <div className="flex items-center gap-2 md:w-40">
          <Palette className="h-5 w-5 text-neutral-500" />
          <div className="flex flex-col">
            <span className="text-sm font-semibold">Aparencia</span>
            <span className="text-xs text-neutral-500">Preview da loja</span>
          </div>
        </div>

        <ColorField
          label="Primaria"
          value={style.primary_color}
          onChange={value => onChange("primary_color", value)}
        />
        <ColorField
          label="Texto"
          value={style.text_color}
          onChange={value => onChange("text_color", value)}
        />
        <ColorField
          label="Texto botao"
          value={style.text_button_color}
          onChange={value => onChange("text_button_color", value)}
        />

        <div className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2 md:h-17 md:w-34 md:flex-col md:items-start">
          <Label className="text-xs text-neutral-500">Tema escuro</Label>
          <Switch
            checked={style.theme_is_dark}
            disabled={isLoading || isSaving}
            onCheckedChange={checked => onChange("theme_is_dark", checked)}
          />
        </div>

        <Button
          type="button"
          className="h-10 shrink-0 rounded-full md:mb-1"
          disabled={isLoading || isSaving || !hasChanges}
          onClick={onSave}
        >
          <Save className="h-4 w-4" />
          {isSaving ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </div>
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
    <div className="min-w-0 flex-1 space-y-1">
      <Label className="text-xs text-neutral-500">{label}</Label>
      <div className="flex gap-2">
        <Input
          type="color"
          value={value}
          onChange={event => onChange(event.target.value)}
          className="h-10 w-12 shrink-0 cursor-pointer p-1"
        />
        <Input
          value={value}
          maxLength={7}
          onChange={event => onChange(event.target.value)}
          className="h-10 font-mono uppercase"
        />
      </div>
    </div>
  );
}
