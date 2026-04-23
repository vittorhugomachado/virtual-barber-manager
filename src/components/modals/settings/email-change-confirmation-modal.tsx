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
import { Mail, CheckCircle } from "lucide-react";

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
          <div className="mx-auto w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <CheckCircle className="h-6 w-6 text-green-600" />
          </div>
          <DialogTitle className="text-xl font-semibold">
            Verifique seu email
          </DialogTitle>
        </DialogHeader>

        <DialogDescription className="text-center space-y-4">
          <div className="flex justify-center my-2">
            <Mail className="h-12 w-12 text-[#0458EE]" />
          </div>

          <p className="text-gray-600">
            Um link de confirmação foi enviado para:
          </p>

          <div className="bg-gray-100 p-3 rounded-lg">
            <p className="font-medium text-gray-900 break-all">{newEmail}</p>
          </div>

          <p className="text-sm text-gray-500">
            Para confirmar a alteração do seu email, acesse o link que enviamos
            para o endereço acima. O link expira em 24 horas.
          </p>

          <div className="bg-blue-50 p-3 rounded-lg text-left">
            <p className="text-sm text-blue-800 font-medium">📌 Importante:</p>
            <ul className="text-sm text-blue-700 mt-1 space-y-1">
              <li>• Verifique sua caixa de entrada e spam</li>
              <li>• Clique no link recebido para confirmar a alteração</li>
              <li>• Após confirmar, use o novo email para fazer login</li>
            </ul>
          </div>
        </DialogDescription>

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
