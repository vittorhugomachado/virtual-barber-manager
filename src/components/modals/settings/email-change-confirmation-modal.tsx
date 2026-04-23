// components/modals/settings/email-change-confirmation-modal.tsx
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail } from "lucide-react";

interface EmailChangeConfirmationModalProps {
  open: boolean;
  newEmail: string;
  onClose: () => void;
}

export function EmailChangeConfirmationModal({
  open,
  newEmail,
  onClose,
}: EmailChangeConfirmationModalProps) {
  return (
    <Dialog open={open} onOpenChange={o => !o && onClose()}>
      <DialogContent className="max-w-md w-[calc(100%-2rem)] text-center">
        <DialogHeader className="flex flex-col items-center">
          <DialogTitle className="text-xl font-semibold mt-2">
            Verifique seu email
          </DialogTitle>
        </DialogHeader>

        <DialogDescription className="text-center">
          Um link de confirmação foi enviado para o novo email
        </DialogDescription>

        <div className="flex justify-center my-2">
          <Mail className="h-12 w-12 text-[#0458EE]" />
        </div>

        <p className="text-gray-600">
          Um link de confirmação foi enviado para:
        </p>

        <div className="bg-transparent p-0.5 rounded-lg">
          <p className="font-medium text-gray-200 break-all">{newEmail}</p>
        </div>

        <p className="text-sm text-gray-500">
          Para confirmar a alteração do seu email, acesse o link que enviamos
          para o endereço acima. O link expira em 24 horas.
        </p>

        <DialogFooter className="mt-6">
          <Button
            onClick={onClose}
            className="w-full rounded-full bg-[#0458EE] hover:bg-[#0458EE]/90"
          >
            Entendi
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
