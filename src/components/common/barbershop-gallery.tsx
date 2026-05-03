import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronLeft,
  ChevronRight,
  GripVertical,
  ImagePlus,
  Loader2,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type GalleryImage = {
  id: string;
  url: string;
  order: number;
  file?: File;
  isNew?: boolean;
};

type BarbershopGalleryProps = {
  className?: string;
  onDirtyChange?: (dirty: boolean) => void;
  onSaved?: () => void;
  inModal?: boolean;
};

function getStoragePath(url: string) {
  const storagePath = url.split("/object/public/gallery/")[1];
  return storagePath ? decodeURIComponent(storagePath) : null;
}

function normalizeOrder(images: GalleryImage[]) {
  return images.map((image, index) => ({ ...image, order: index }));
}

export function BarbershopGallery({
  className,
  onDirtyChange,
  onSaved,
  inModal = false,
}: BarbershopGalleryProps) {
  const { barbershop } = useBarbershopStore();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [removedImages, setRemovedImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [addingFiles, setAddingFiles] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<GalleryImage | null>(null);
  const [savedSignature, setSavedSignature] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const imagesRef = useRef<GalleryImage[]>([]);

  const hasUnsavedChanges = useMemo(
    () =>
      images.map(image => image.id).join("|") !== savedSignature ||
      removedImages.length > 0,
    [images, removedImages.length, savedSignature],
  );

  useEffect(() => {
    onDirtyChange?.(hasUnsavedChanges);
  }, [hasUnsavedChanges, onDirtyChange]);

  useEffect(() => {
    if (!barbershop?.id) {
      setLoading(false);
      return;
    }

    let mounted = true;
    setLoading(true);

    supabase
      .from("barbershop_gallery")
      .select("id, url, order")
      .eq("barbershop_id", barbershop.id)
      .order("order", { ascending: true })
      .then(({ data, error }) => {
        if (!mounted) return;
        if (error) {
          toast.error("Nao foi possivel carregar a galeria");
        } else {
          const loadedImages = data ?? [];
          setImages(loadedImages);
          setRemovedImages([]);
          setSavedSignature(loadedImages.map(image => image.id).join("|"));
        }
        setLoading(false);
      });

    return () => {
      mounted = false;
    };
  }, [barbershop?.id]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(
    () => () => {
      imagesRef.current.forEach(image => {
        if (image.isNew) URL.revokeObjectURL(image.url);
      });
    },
    [],
  );

  function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;

    setAddingFiles(true);

    const validImages = files.filter(file => {
      if (!file.type.startsWith("image/")) {
        toast.error(`${file.name} nao e uma imagem valida`);
        return false;
      }
      return true;
    });

    if (validImages.length) {
      setImages(prev =>
        normalizeOrder([
          ...prev,
          ...validImages.map((file, index) => ({
            id: `local-${Date.now()}-${index}-${Math.random()
              .toString(36)
              .slice(2)}`,
            url: URL.createObjectURL(file),
            order: prev.length + index,
            file,
            isNew: true,
          })),
        ]),
      );
    }

    setAddingFiles(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleDelete(image: GalleryImage) {
    setImages(prev => normalizeOrder(prev.filter(img => img.id !== image.id)));

    if (image.isNew) {
      URL.revokeObjectURL(image.url);
      return;
    }

    setRemovedImages(prev => [...prev, image]);
  }

  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  const displayedImages = useMemo(() => {
    if (!draggedId || !dragOverId || draggedId === dragOverId) return images;
    const from = images.findIndex(img => img.id === draggedId);
    const to = images.findIndex(img => img.id === dragOverId);
    if (from === -1 || to === -1) return images;
    const reordered = [...images];
    const [moved] = reordered.splice(from, 1);
    reordered.splice(to, 0, moved);
    return normalizeOrder(reordered);
  }, [images, draggedId, dragOverId]);

  function handleDragStart(e: React.DragEvent, id: string) {
    setDraggedId(id);
    const el = e.currentTarget as HTMLElement;
    const clone = el.cloneNode(true) as HTMLElement;
    clone.style.cssText = `position:fixed;top:-9999px;width:${el.offsetWidth}px;height:${el.offsetHeight}px;border-radius:8px;overflow:hidden;`;
    document.body.appendChild(clone);
    e.dataTransfer.setDragImage(clone, el.offsetWidth / 2, el.offsetHeight / 2);
    setTimeout(() => document.body.removeChild(clone), 0);
  }

  function handleDragEnter(id: string) {
    if (dragOverId !== id) setDragOverId(id);
  }

  function handleDrop() {
    if (draggedId && dragOverId && draggedId !== dragOverId) {
      setImages(displayedImages);
    }
    setDraggedId(null);
    setDragOverId(null);
  }

  async function saveImages() {
    if (!barbershop?.id) {
      toast.error("Barbearia nao encontrada.");
      return;
    }

    setSaving(true);

    const uploadedStoragePaths: string[] = [];

    try {
      for (const image of removedImages) {
        const storagePath = getStoragePath(image.url);
        if (storagePath) {
          await supabase.storage.from("gallery").remove([storagePath]);
        }

        const { error } = await supabase
          .from("barbershop_gallery")
          .delete()
          .eq("id", image.id);

        if (error) throw error;
      }

      const savedImages: GalleryImage[] = [];

      for (const [index, image] of images.entries()) {
        if (!image.isNew) {
          const { error } = await supabase
            .from("barbershop_gallery")
            .update({ order: index })
            .eq("id", image.id);

          if (error) throw error;
          savedImages.push({ ...image, order: index });
          continue;
        }

        if (!image.file) continue;

        const ext = image.file.name.split(".").pop() || "jpg";
        const fileName = `${barbershop.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2)}.${ext}`;

        const { error: storageError } = await supabase.storage
          .from("gallery")
          .upload(fileName, image.file, { upsert: false });

        if (storageError) throw storageError;
        uploadedStoragePaths.push(fileName);

        const { data: urlData } = supabase.storage
          .from("gallery")
          .getPublicUrl(fileName);

        const { data: inserted, error: dbError } = await supabase
          .from("barbershop_gallery")
          .insert({
            barbershop_id: barbershop.id,
            url: urlData.publicUrl,
            order: index,
          })
          .select("id, url, order")
          .single();

        if (dbError) throw dbError;

        URL.revokeObjectURL(image.url);
        savedImages.push(inserted);
      }

      setImages(normalizeOrder(savedImages));
      setSavedSignature(savedImages.map(image => image.id).join("|"));
      setRemovedImages([]);
      toast.success("Imagens salvas!");
      onSaved?.();
    } catch (error) {
      console.error("Erro ao salvar galeria:", error);
      if (uploadedStoragePaths.length) {
        await supabase.storage.from("gallery").remove(uploadedStoragePaths);
      }
      toast.error("Nao foi possivel salvar as imagens.");
    } finally {
      setSaving(false);
    }
  }

  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const openLightbox = useCallback((i: number) => setLightboxIndex(i), []);

  useEffect(() => {
    if (lightboxIndex === null) return;
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setLightboxIndex(null);
      if (e.key === "ArrowLeft")
        setLightboxIndex(i => (i! > 0 ? i! - 1 : displayedImages.length - 1));
      if (e.key === "ArrowRight")
        setLightboxIndex(i => (i! < displayedImages.length - 1 ? i! + 1 : 0));
    }
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [lightboxIndex, displayedImages.length]);

  useEffect(() => {
    document.body.style.overflow = lightboxIndex !== null ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [lightboxIndex]);

  return (
    <div
      className={[
        "w-full max-w-180 lg:mx-auto flex flex-col gap-6 mb-6",
        className ?? "",
      ].join(" ")}
    >
      <Card className="bg-transparent border-none">
        <CardHeader className="mt-3">
          <div className="flex flex-col w-fit">
            <CardTitle className="font-semibold text-2xl">Galeria</CardTitle>
            <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
          </div>
          <p className="text-sm text-muted-foreground">
            As imagens da galeria aparecem na pagina de agendamento do seu site
          </p>
        </CardHeader>

        <CardContent className="flex px-3 flex-col gap-4">
          {loading ? (
            <div className="flex items-center gap-2 text-muted-foreground text-sm">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : (
            <>
              {images.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhuma imagem na galeria ainda.
                </p>
              ) : (
                <>
                  {images.length > 1 && (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <GripVertical className="h-3 w-3" />
                      Arraste as imagens para reordenar
                    </p>
                  )}
                  <div
                    className="grid grid-cols-2 sm:grid-cols-3 gap-3"
                    onDragOver={e => e.preventDefault()}
                    onDrop={handleDrop}
                  >
                    {images.map((image, idx) => (
                      <div
                        key={image.id}
                        draggable
                        onDragStart={e => handleDragStart(e, image.id)}
                        onDragEnter={() => handleDragEnter(image.id)}
                        onDragEnd={() => {
                          setDraggedId(null);
                          setDragOverId(null);
                        }}
                        className={[
                          "relative group rounded-lg overflow-hidden border aspect-square select-none transition-all duration-150",
                          draggedId === image.id
                            ? "opacity-40 scale-95 border-dashed border-border"
                            : "border-border",
                          dragOverId === image.id && draggedId !== image.id
                            ? "ring-2 ring-blue-500 scale-[1.02]"
                            : "",
                        ].join(" ")}
                      >
                        <img
                          src={image.url}
                          alt={`Foto ${idx + 1}`}
                          className="w-full h-full object-cover pointer-events-none cursor-pointer"
                        />

                        <span className="absolute top-1.5 left-1.5 bg-black/50 text-white text-xs font-medium rounded-md px-1.5 py-0.5">
                          {idx + 1}
                        </span>

                        {image.isNew && (
                          <span className="absolute bottom-1.5 left-1.5 bg-primary text-primary-foreground text-xs font-medium rounded-md px-1.5 py-0.5">
                            Nova
                          </span>
                        )}

                        <div className="absolute top-1.5 right-1.5 opacity-0 group-hover:opacity-100 transition-opacity bg-black/50 rounded-md p-0.5 cursor-pointer">
                          <GripVertical className="h-4 w-4 text-white" />
                        </div>

                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3 cursor-pointer">
                          <Button
                            type="button"
                            variant="destructive"
                            size="icon"
                            disabled={saving}
                            onClick={() => setConfirmDelete(image)}
                            className="h-8 w-8"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {hasUnsavedChanges && (
                <p className="text-xs text-amber-600">
                  Existem imagens nao salvas. Clique em Salvar imagens para
                  enviar as mudancas ao banco de dados.
                </p>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUpload}
              />

              <div
                className={`${inModal && "fixed bottom-2 left-1/2 -translate-x-1/2"} flex flex-col sm:flex-row gap-2`}
              >
                <Button
                  type="button"
                  variant="outline"
                  disabled={addingFiles || saving}
                  onClick={() => fileInputRef.current?.click()}
                  className="w-fit rounded-full"
                >
                  {addingFiles ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Adicionando...
                    </>
                  ) : (
                    <>
                      <ImagePlus className="h-4 w-4 mr-2" />
                      Adicionar imagens
                    </>
                  )}
                </Button>

                <Button
                  type="button"
                  disabled={loading || saving || !hasUnsavedChanges}
                  onClick={saveImages}
                  className="w-fit rounded-full"
                >
                  {saving ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                      Salvando...
                    </>
                  ) : (
                    "Salvar imagens"
                  )}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      {displayedImages.length > 0 && (
        <Card className="bg-transparent border-none">
          <CardHeader className="mt-3">
            <div className="flex flex-col w-fit">
              <CardTitle className="font-semibold text-2xl">
                Pré-visualização
              </CardTitle>
              <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
            </div>
            <p className="text-sm text-muted-foreground">
              Como vai aparecer no seu site
            </p>
          </CardHeader>
          <CardContent className="px-3">
            <div className="rounded-2xl overflow-hidden">
              {displayedImages.length === 1 && (
                <div
                  className="group relative h-full cursor-pointer overflow-hidden rounded-2xl"
                  onClick={() => openLightbox(0)}
                >
                  <img
                    src={displayedImages[0].url}
                    alt="preview 1"
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                </div>
              )}

              {displayedImages.length === 2 && (
                <div className="grid h-full grid-cols-2 gap-2">
                  {displayedImages.map((img, i) => (
                    <div
                      key={img.id}
                      className={`group relative cursor-pointer overflow-hidden ${i === 0 ? "rounded-l-2xl" : "rounded-r-2xl"}`}
                      onClick={() => openLightbox(i)}
                    >
                      <img
                        src={img.url}
                        alt={`preview ${i + 1}`}
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                    </div>
                  ))}
                </div>
              )}

              {displayedImages.length === 3 && (
                <div className="grid h-full grid-cols-[2fr_1fr] gap-2">
                  <div
                    className="group relative cursor-pointer overflow-hidden rounded-l-2xl"
                    onClick={() => openLightbox(0)}
                  >
                    <img
                      src={displayedImages[0].url}
                      alt="preview 1"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {[1, 2].map(i => (
                      <div
                        key={displayedImages[i].id}
                        className={`group relative h-1/2 cursor-pointer overflow-hidden ${i === 1 ? "rounded-tr-2xl" : "rounded-br-2xl"}`}
                        onClick={() => openLightbox(i)}
                      >
                        <img
                          src={displayedImages[i].url}
                          alt={`preview ${i + 1}`}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {displayedImages.length === 4 && (
                <div className="grid h-full grid-cols-[2fr_1fr] gap-2">
                  <div
                    className="group relative cursor-pointer overflow-hidden rounded-l-2xl"
                    onClick={() => openLightbox(0)}
                  >
                    <img
                      src={displayedImages[0].url}
                      alt="preview 1"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {[1, 2, 3].map((i, idx) => (
                      <div
                        key={displayedImages[i].id}
                        className={`group relative cursor-pointer overflow-hidden ${idx === 0 ? "rounded-tr-2xl" : idx === 2 ? "rounded-br-2xl" : ""}`}
                        style={{ height: "33.33%" }}
                        onClick={() => openLightbox(i)}
                      >
                        <img
                          src={displayedImages[i].url}
                          alt={`preview ${i + 1}`}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {displayedImages.length >= 5 && (
                <div className="grid h-full grid-cols-[2fr_1fr_1fr] gap-2">
                  <div
                    className="group relative cursor-pointer overflow-hidden rounded-l-2xl"
                    onClick={() => openLightbox(0)}
                  >
                    <img
                      src={displayedImages[0].url}
                      alt="preview 1"
                      className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    />
                    <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                  </div>
                  <div className="flex flex-col gap-2">
                    {[1, 2].map(i => (
                      <div
                        key={displayedImages[i].id}
                        className="group relative h-1/2 cursor-pointer overflow-hidden"
                        onClick={() => openLightbox(i)}
                      >
                        <img
                          src={displayedImages[i].url}
                          alt={`preview ${i + 1}`}
                          className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                        <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                      </div>
                    ))}
                  </div>
                  <div className="flex flex-col gap-2">
                    <div
                      className="group relative h-1/2 cursor-pointer overflow-hidden rounded-tr-2xl"
                      onClick={() => openLightbox(3)}
                    >
                      <img
                        src={displayedImages[3].url}
                        alt="preview 4"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                    </div>
                    <div
                      className="group relative h-1/2 cursor-pointer overflow-hidden rounded-br-2xl"
                      onClick={() => openLightbox(4)}
                    >
                      <img
                        src={displayedImages[4].url}
                        alt="preview 5"
                        className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-black/0 transition-colors group-hover:bg-black/10" />
                      {displayedImages.length > 5 && (
                        <div className="absolute inset-0 flex items-end justify-end bg-black/30 p-3">
                          <span className="rounded-md border border-neutral-300 bg-white/90 px-3 py-1.5 text-sm font-medium text-neutral-900 shadow-sm">
                            Ver todas as imagens
                          </span>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {lightboxIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={() => setLightboxIndex(null)}
        >
          <div
            className="flex h-14 shrink-0 items-center justify-between px-4"
            onClick={e => e.stopPropagation()}
          >
            <span className="text-sm text-white/60">
              {lightboxIndex + 1} / {displayedImages.length}
            </span>
            <button
              type="button"
              onClick={() => setLightboxIndex(null)}
              className="rounded-full p-2 text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={22} />
            </button>
          </div>
          <div
            className="relative flex flex-1 items-center justify-center"
            onClick={e => e.stopPropagation()}
          >
            <img
              src={displayedImages[lightboxIndex].url}
              alt={`preview ${lightboxIndex + 1}`}
              className="max-h-[80vh] max-w-full object-contain px-16"
            />
            {displayedImages.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex(i =>
                      i! > 0 ? i! - 1 : displayedImages.length - 1,
                    )
                  }
                  className="absolute left-2 rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20"
                >
                  <ChevronLeft size={20} />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setLightboxIndex(i =>
                      i! < displayedImages.length - 1 ? i! + 1 : 0,
                    )
                  }
                  className="absolute right-2 rounded-full border border-white/20 bg-white/10 p-2 text-white hover:bg-white/20"
                >
                  <ChevronRight size={20} />
                </button>
              </>
            )}
          </div>
        </div>
      )}

      <AlertDialog
        open={!!confirmDelete}
        onOpenChange={open => {
          if (!open) setConfirmDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover imagem</AlertDialogTitle>
            <AlertDialogDescription>
              A imagem será removida localmente agora e só será excluida da
              página ao clicar em salvar imagens.
            </AlertDialogDescription>
          </AlertDialogHeader>
          {confirmDelete && (
            <img
              src={confirmDelete.url}
              alt="Imagem a remover"
              className="w-full h-40 object-cover rounded-lg"
            />
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => {
                if (confirmDelete) {
                  handleDelete(confirmDelete);
                  setConfirmDelete(null);
                }
              }}
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
