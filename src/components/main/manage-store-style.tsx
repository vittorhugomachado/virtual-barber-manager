import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { StoreStyle } from "@/types/store-style";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { StyleControlBar } from "../manage-store-style/style-control-bar";
import { Button } from "../ui/button";

const DEFAULT_STYLE: Omit<StoreStyle, "id"> = {
  text_color: "#FFFFFF",
  primary_color: "#000000",
  text_button_color: "#000000",
  background_color: "#09090B",
  title_font: "inter",
};

const previewOrigin = import.meta.env.VITE_PREVIEW_ORIGIN;

const getPreviewUrl = (slug: string) => {
  return `${previewOrigin}/${slug}?preview=true`;
};

type ManagePageStyleMainProps = {
  fixedButtons?: boolean;
  onSaved?: () => void;
  onPrev?: () => void;
};

export function ManagePageStyleMain({
  fixedButtons = false,
  onSaved,
  onPrev,
}: ManagePageStyleMainProps) {
  const { barbershop } = useBarbershopStore();
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const [storeStyleId, setStoreStyleId] = useState<string | null>(null);
  const [style, setStyle] = useState(DEFAULT_STYLE);
  const [initialStyle, setInitialStyle] = useState(DEFAULT_STYLE);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [previewKey, setPreviewKey] = useState(0);
  const isStyleLoading = barbershop?.id ? isLoading : false;
  const hasChanges =
    style.text_color !== initialStyle.text_color ||
    style.primary_color !== initialStyle.primary_color ||
    style.text_button_color !== initialStyle.text_button_color ||
    style.background_color !== initialStyle.background_color ||
    style.title_font !== initialStyle.title_font;

  const previewUrl = getPreviewUrl(barbershop?.slug ?? "");

  useEffect(() => {
    let cancelled = false;

    async function loadStoreStyle() {
      if (!barbershop?.id) {
        return;
      }

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
        const loadedStyle: Omit<StoreStyle, "id"> = {
          text_color: data.text_color ?? DEFAULT_STYLE.text_color,
          primary_color: data.primary_color ?? DEFAULT_STYLE.primary_color,
          text_button_color:
            data.text_button_color ?? DEFAULT_STYLE.text_button_color,
          background_color:
            data.background_color ?? DEFAULT_STYLE.background_color,
          title_font: data.title_font ?? DEFAULT_STYLE.title_font,
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
        transparentScrollbars: true,
      },
      previewOrigin,
    );
  }, [style]);

  function updateStyle<K extends keyof typeof DEFAULT_STYLE>(
    key: K,
    value: (typeof DEFAULT_STYLE)[K],
  ) {
    setStyle(current => ({ ...current, [key]: value }));
  }

  async function handleSave({ showToast = true } = {}) {
    if (!barbershop?.id) {
      if (showToast) toast.error("Barbearia nao encontrada.");
      return false;
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
      if (showToast) {
        toast.error("Nao foi possivel salvar o estilo da loja.", {
          description: error.message,
        });
      }
      return false;
    }

    if (!storeStyleId && data && "id" in data) {
      setStoreStyleId(data.id as string);
    }

    setInitialStyle(style);
    if (showToast) {
      toast.success("Estilo da loja salvo!", {
        description: "As alterações foram aplicadas no banco.",
      });
    }
    setPreviewKey(current => current + 1);
    return true;
  }

  async function handleFinishOnboarding() {
    if (hasChanges) {
      const saved = await handleSave({ showToast: false });
      if (!saved) return;
    }

    onSaved?.();
  }

  function sendPreviewStyle() {
    iframeRef.current?.contentWindow?.postMessage(
      {
        type: "BARBERSHOP_PREVIEW_STYLE",
        style,
        transparentScrollbars: true,
      },
      previewOrigin,
    );
    hidePreviewScrollbars();
  }

  function hidePreviewScrollbars() {
    let doc: Document | null = null;

    try {
      doc = iframeRef.current?.contentDocument ?? null;
    } catch {
      return;
    }

    if (!doc) return;

    let scrollbarStyle = doc.getElementById("virtual-preview-scrollbar-style");
    if (!scrollbarStyle) {
      scrollbarStyle = doc.createElement("style");
      scrollbarStyle.id = "virtual-preview-scrollbar-style";
      doc.head.appendChild(scrollbarStyle);
    }

    scrollbarStyle.textContent = `
      html,
      body,
      [class*="overflow-x"],
      [class*="overflow-auto"] {
        scrollbar-width: auto;
        scrollbar-color: transparent transparent;
      }

      html::-webkit-scrollbar,
      body::-webkit-scrollbar,
      *::-webkit-scrollbar {
        width: 10px !important;
        height: 10px !important;
        background: transparent !important;
      }

      html::-webkit-scrollbar-track,
      body::-webkit-scrollbar-track,
      *::-webkit-scrollbar-track,
      html::-webkit-scrollbar-thumb,
      body::-webkit-scrollbar-thumb,
      *::-webkit-scrollbar-thumb,
      html::-webkit-scrollbar-button,
      body::-webkit-scrollbar-button,
      *::-webkit-scrollbar-button,
      html::-webkit-scrollbar-corner,
      body::-webkit-scrollbar-corner,
      *::-webkit-scrollbar-corner {
        background: transparent !important;
        border-color: transparent !important;
      }
    `;

    doc.querySelectorAll<HTMLElement>("*").forEach(element => {
      const hasHorizontalScroll = element.scrollWidth > element.clientWidth;
      const hasVerticalScroll = element.scrollHeight > element.clientHeight;

      if (hasHorizontalScroll || hasVerticalScroll) {
        element.style.scrollbarColor = "transparent transparent";
      }
    });
  }

  function reloadPreview() {
    setPreviewKey(current => current + 1);
  }

  return (
    <div
      className={`relative h-full min-h-[70vh] overflow-hidden border`}
      style={{ backgroundColor: style.background_color }}
    >
      <div
        className={
          fixedButtons
            ? "h-screen w-full overflow-hidden pb-15"
            : "h-dvh w-full overflow-hidden"
        }
      >
        <iframe
          key={previewKey}
          ref={iframeRef}
          title="Preview da loja"
          className="h-[calc(100%+18px)] w-[calc(100%+18px)] border-0"
          src={previewUrl}
          onLoad={sendPreviewStyle}
        />
      </div>

      <StyleControlBar
        style={style}
        isLoading={isStyleLoading}
        isSaving={isSaving}
        hasChanges={hasChanges}
        onChange={updateStyle}
        onSave={handleSave}
        onGallerySaved={reloadPreview}
        showGalleryButton={!fixedButtons}
        compact={fixedButtons}
      />

      {fixedButtons && (
        <div className="fixed bottom-0 left-0 right-0 flex items-center justify-center gap-2 bg-zinc-200 dark:bg-zinc-900 px-3 py-3 shadow-lg">
          <div className="flex justify-between w-full max-w-xl px-3">
            <Button
              type="button"
              variant="outline"
              className="w-20"
              onClick={onPrev}
            >
              Voltar
            </Button>
            <Button
              type="button"
              className="w-36 px-8"
              disabled={isSaving || isStyleLoading}
              onClick={handleFinishOnboarding}
            >
              Concluir
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
