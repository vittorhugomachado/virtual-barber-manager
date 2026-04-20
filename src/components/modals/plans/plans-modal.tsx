// src/components/modals/plans-modal.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface PlansModalProps {
  open: boolean;
  onClose: () => void;
}

export function PlansModal({ open, onClose }: PlansModalProps) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-3xl w-[calc(100%-2rem)]">
        <DialogHeader>
          <DialogTitle>Planos</DialogTitle>
        </DialogHeader>

        <div className="flex items-center justify-center h-40 text-muted-foreground text-sm">
          Tabela de planos em breve...
        </div>
      </DialogContent>
    </Dialog>
  );
}
