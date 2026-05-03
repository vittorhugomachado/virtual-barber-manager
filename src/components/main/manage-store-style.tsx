import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { StoreStyle } from "@/types/store-style";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { StyleControlBar } from "../manage-store-style/style-control-bar";

const DEFAULT_STYLE: Omit<StoreStyle, "id"> = {
  text_color: "#FFFFFF",
  primary_color: "#000000",
  text_button_color: "#000000",
  background_color: "#09090B",
};

const PREVIEW_URL = "http://localhost:5174/barber?preview=true";
const PREVIEW_ORIGIN = "http://localhost:5174";

export function ManagePageStyleMain() {
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

  function reloadPreview() {
    setPreviewKey(current => current + 1);
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
        onGallerySaved={reloadPreview}
      />
    </div>
  );
}
