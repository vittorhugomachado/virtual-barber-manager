import { useState } from "react";
import { Images } from "lucide-react";
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
      <div className="fixed right-2 bottom-4 md:top-1/2 md:-translate-y-1/2 z-20 w-fit h-fit flex flex-col items-center gap-2">
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setGalleryOpen(true)}
          className="rounded-full shadow-lg"
        >
          <Images className="h-4 w-4" />
          Editar galeria
        </Button>
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

      <Dialog open={galleryOpen} onOpenChange={handleGalleryOpenChange}>
        <DialogContent
          className="max-h-[92vh] mb-12 overflow-y-auto sm:max-w-5xl"
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
            onSaved={() => setGalleryHasChanges(false)}
            inModal={true}
          />
        </DialogContent>
      </Dialog>

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
