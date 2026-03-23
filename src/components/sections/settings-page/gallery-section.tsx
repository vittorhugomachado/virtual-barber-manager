import { useEffect, useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabase/supabase";
import { useBarbershopStore } from "@/store/barbershop.store";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type GalleryImage = {
  id: string;
  url: string;
  order: number;
};

export function GallerySection() {
  const { barbershop } = useBarbershopStore();
  const [images, setImages] = useState<GalleryImage[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!barbershop?.id) return;

    supabase
      .from("barbershop_gallery")
      .select("id, url, order")
      .eq("barbershop_id", barbershop.id)
      .order("order", { ascending: true })
      .then(({ data, error }) => {
        if (!error && data) setImages(data);
        setLoading(false);
      });
  }, [barbershop?.id]);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length || !barbershop?.id) return;

    setUploading(true);
    let successCount = 0;

    for (const file of files) {
      const ext = file.name.split(".").pop();
      const fileName = `${barbershop.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

      const { error: storageError } = await supabase.storage
        .from("gallery")
        .upload(fileName, file, { upsert: false });

      if (storageError) {
        toast.error(`Erro ao enviar ${file.name}`);
        continue;
      }

      const { data: urlData } = supabase.storage
        .from("gallery")
        .getPublicUrl(fileName);

      const nextOrder = images.length + successCount;

      const { data: inserted, error: dbError } = await supabase
        .from("barbershop_gallery")
        .insert({
          barbershop_id: barbershop.id,
          url: urlData.publicUrl,
          order: nextOrder,
        })
        .select("id, url, order")
        .single();

      if (dbError) {
        toast.error(`Erro ao salvar ${file.name}`);
        await supabase.storage.from("gallery").remove([fileName]);
        continue;
      }

      setImages(prev => [...prev, inserted]);
      successCount++;
    }

    if (successCount > 0) {
      toast.success(
        successCount === 1
          ? "Imagem adicionada!"
          : `${successCount} imagens adicionadas!`,
      );
    }

    setUploading(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleDelete(image: GalleryImage) {
    if (!barbershop?.id) return;

    setDeletingId(image.id);

    // Extract storage path from public URL
    const url = new URL(image.url);
    const storagePath = url.pathname.split("/object/public/gallery/")[1];

    if (storagePath) {
      await supabase.storage.from("gallery").remove([storagePath]);
    }

    const { error } = await supabase
      .from("barbershop_gallery")
      .delete()
      .eq("id", image.id);

    if (error) {
      toast.error("Erro ao excluir imagem");
      setDeletingId(null);
      return;
    }

    setImages(prev => prev.filter(img => img.id !== image.id));
    toast.success("Imagem excluída");
    setDeletingId(null);
  }

  return (
    <div className="w-full max-w-180 md:px-16 flex flex-col gap-6 mb-6">
      <Card className="bg-transparent border-none">
        <CardHeader className="mt-3">
          <div className="flex flex-col w-fit">
            <CardTitle className="font-semibold text-2xl">Galeria</CardTitle>
            <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
          </div>
        </CardHeader>

        <CardContent className="flex flex-col gap-4">
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
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {images.map(image => (
                    <div
                      key={image.id}
                      className="relative group rounded-lg overflow-hidden border border-border aspect-square"
                    >
                      <img
                        src={image.url}
                        alt="Foto da galeria"
                        className="w-full h-full object-cover"
                      />
                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                        <Button
                          type="button"
                          variant="destructive"
                          size="icon"
                          disabled={deletingId === image.id}
                          onClick={() => handleDelete(image)}
                          className="h-8 w-8"
                        >
                          {deletingId === image.id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <Trash2 className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleUpload}
              />

              <Button
                type="button"
                variant="outline"
                disabled={uploading}
                onClick={() => fileInputRef.current?.click()}
                className="w-fit rounded-full"
              >
                {uploading ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    Enviando...
                  </>
                ) : (
                  <>
                    <ImagePlus className="h-4 w-4 mr-2" />
                    Adicionar fotos
                  </>
                )}
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
