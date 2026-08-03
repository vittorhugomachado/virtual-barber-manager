import { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Shield,
  Eye,
  Trash2,
  Loader2,
  Pencil,
  CircleHelp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverDescription,
  PopoverHeader,
  PopoverTitle,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useBarbershopStore } from "@/store/barbershop.store";
import { useDeleteMember, useMembers, type Member } from "@/hooks/use-members";
import { CreateMemberModal } from "@/components/modals/manage-member/create-member-modal";
import { UpdateMemberModal } from "@/components/modals/manage-member/update-member-modal";
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

function getRoleLabel(role: "admin" | "reader") {
  return role === "admin" ? "Admin" : "Leitor";
}

function getRoleHelpText(role: "admin" | "reader") {
  return role === "admin"
    ? "Acesso total, com exceção das configurações."
    : "Acesso restrito apenas a agenda.";
}

function RoleHelpIcon({ role }: { role: "admin" | "reader" }) {
  const text = getRoleHelpText(role);

  return (
    <>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`Explicar permissao ${getRoleLabel(role)}`}
            className="hidden md:inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            <CircleHelp className="h-3.5 w-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-56 text-xs">
          {text}
        </TooltipContent>
      </Tooltip>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            aria-label={`Explicar permissao ${getRoleLabel(role)}`}
            className="inline-flex md:hidden h-5 w-5 items-center justify-center rounded-full text-muted-foreground/80 transition-colors hover:text-foreground"
          >
            <CircleHelp className="h-4 w-4" />
          </button>
        </PopoverTrigger>
        <PopoverContent className="w-64" align="end">
          <PopoverHeader>
            <PopoverTitle>{getRoleLabel(role)}</PopoverTitle>
            <PopoverDescription className="text-sm">{text}</PopoverDescription>
          </PopoverHeader>
        </PopoverContent>
      </Popover>
    </>
  );
}

export function UsersSection() {
  const { barbershop, memberRole } = useBarbershopStore();
  const {
    members,
    error: membersError,
    reload,
    removeLocal,
    addLocal,
    updateLocal,
  } = useMembers(barbershop?.id);
  const { deleteMember } = useDeleteMember();
  const [removingId, setRemovingId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<Member | null>(null);
  const [editMember, setEditMember] = useState<Member | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);

  async function handleRemoveMember(memberId: string) {
    if (memberRole !== "owner") {
      toast.error("Apenas o proprietario pode remover usuários.");
      return;
    }

    setRemovingId(memberId);
    try {
      await deleteMember(memberId);
      toast.success("Usuário removido.");
      removeLocal(memberId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível remover o usuário.",
      );
    } finally {
      setRemovingId(null);
    }
  }

  return (
    <Card className="bg-transparent border-none shadow-none">
      <div className="w-full max-w-180 h-full relative pb-16">
        <CardHeader>
          <div className="flex flex-col w-fit">
            <CardTitle className="font-semibold text-2xl">Usuários</CardTitle>
            <div className="w-4/5 h-px bg-[#0458EE] mt-1" />
          </div>
          <p className="text-sm text-muted-foreground">
            Gerencie quem tem acesso ao painel da sua barbearia.
          </p>
        </CardHeader>

        {memberRole !== "owner" && (
          <p className="px-3 text-sm text-muted-foreground">
            Apenas o proprietario da barbearia pode gerenciar usuários.
          </p>
        )}

        <div className="flex flex-col items-center gap-6">
          {members === null ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
              <Loader2 className="h-4 w-4 animate-spin" />
              Carregando...
            </div>
          ) : membersError ? (
            <div className="flex items-center gap-2 py-2 text-sm text-destructive">
              <span>{membersError}</span>
              <Button type="button" variant="link" size="sm" onClick={reload}>
                Tentar novamente
              </Button>
            </div>
          ) : members.length === 0 ? (
            <p className="text-sm text-muted-foreground py-2">
              Nenhum usuário adicionado ainda.
            </p>
          ) : (
            members.map(member => (
              <Card key={member.id}>
                <CardContent className="flex flex-col sm:flex-row sm:justify-between items-center justify-center px-5">
                  <div className="flex flex-col items-center sm:items-start gap-0.5 mb-2 sm:mb-0 min-w-0">
                    <span className="font-medium truncate">
                      @{member.username}
                    </span>
                  </div>
                  <div className="flex flex-col sm:flex-row items-center gap-3 shrink-0 ml-4">
                    <Badge
                      variant="secondary"
                      className="flex min-w-24 items-center justify-center gap-1 font-medium"
                    >
                      {member.role === "admin" ? (
                        <>
                          <Shield className="h-3 w-3" /> Admin
                        </>
                      ) : (
                        <>
                          <Eye className="h-3 w-3" /> Leitor
                        </>
                      )}
                      <RoleHelpIcon role={member.role} />
                    </Badge>
                    <div>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 cursor-pointer"
                        onClick={() => {
                          setEditMember(member);
                          setShowEditDialog(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive cursor-pointer"
                        disabled={removingId === member.id}
                        onClick={() => setConfirmRemove(member)}
                      >
                        {removingId === member.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>

        <Button
          variant="outline"
          className="w-fit cursor-pointer rounded-full"
          disabled={memberRole !== "owner"}
          onClick={() => setShowCreateDialog(true)}
        >
          <Plus className="h-4 w-4 mr-2" />
          Novo usuário
        </Button>

        <CreateMemberModal
          open={showCreateDialog}
          onOpenChange={setShowCreateDialog}
          onCreated={addLocal}
        />

        {editMember && (
          <UpdateMemberModal
            open={showEditDialog}
            member={editMember}
            onOpenChange={open => {
              setShowEditDialog(open);
              if (!open) setEditMember(null);
            }}
            onUpdated={updateLocal}
          />
        )}

        {/* Dialog de confirmação de remoção */}
        <AlertDialog
          open={!!confirmRemove}
          onOpenChange={open => {
            if (!open) setConfirmRemove(null);
          }}
        >
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remover usuário</AlertDialogTitle>
              <AlertDialogDescription>
                Tem certeza que deseja remover{" "}
                <strong>@{confirmRemove?.username}</strong>? Ele perderá o
                acesso ao painel imediatamente.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancelar</AlertDialogCancel>
              <AlertDialogAction
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                onClick={() => {
                  if (confirmRemove) {
                    handleRemoveMember(confirmRemove.id);
                    setConfirmRemove(null);
                  }
                }}
              >
                Remover
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </div>
    </Card>
  );
}
