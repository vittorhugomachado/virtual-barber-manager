import { useState } from "react";
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
  const [galleryKey, setGalleryKey] = useState(0);

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
        className={`fixed inset-x-2 z-20 flex items-end gap-2 md:inset-x-auto md:right-2 md:w-fit md:flex-col md:items-center ${
          compact
            ? "bottom-20 md:bottom-24"
            : "bottom-4 md:top-1/2 md:-translate-y-1/2"
        }`}
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
          <div className="mx-auto flex w-full max-w-76 items-center gap-0 overflow-x-auto rounded-xl border border-neutral-800 bg-neutral-950/95 px-2 py-2 md:py-3 text-neutral-50 shadow-2xl backdrop-blur md:w-full md:max-w-xl md:flex-col md:gap-4 md:overflow-visible md:px-2 md:pb-18 md:pt-6">
            <ColorField
              label="Primária"
              value={style.primary_color}
              onChange={value => onChange("primary_color", value)}
              className="w-14 flex-none md:w-full md:flex-1"
              labelClassName="text-[12px] md:text-xs"
            />
            <ColorField
              label="Texto"
              value={style.text_color}
              onChange={value => onChange("text_color", value)}
              className="w-12 flex-none md:w-full md:flex-1"
              labelClassName="text-[12px] md:text-xs"
            />
            <ColorField
              label="Texto botão"
              value={style.text_button_color}
              onChange={value => onChange("text_button_color", value)}
              className="w-16 flex-none md:w-full md:flex-1"
              labelClassName="text-[12px] md:text-xs"
            />
            <ColorField
              label="Fundo"
              value={style.background_color}
              onChange={value => onChange("background_color", value)}
              className="w-12 flex-none md:w-full md:flex-1"
              labelClassName="text-[12px] md:text-xs"
            />

            <Button
              type="button"
              className="h-10 w-13 shrink-0 rounded-md text-[13.5px] md:text-sm md:absolute md:bottom-0 ml-auto md:mx-0.5 px-1 md:mb-1 md:w-[95%] md:scale-90 md:px-2"
              disabled={isLoading || isSaving || !hasChanges}
              onClick={onSave}
            >
              {isSaving ? <Spinner /> : "Salvar"}
            </Button>
          </div>
        </div>
      </div>

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
