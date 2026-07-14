import { useState } from "react";
import {
  BadgeCheck,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Pencil,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAllCustomers } from "@/hooks/use-all-customers";
import { CustomersSkeleton } from "@/components/skeleton/customers-skeleton";
import { CreateCustomerModal } from "@/components/modals/customers/create-customer-modal";
import { CustomerHistoryModal } from "@/components/modals/customers/customer-history-modal";
import { UpdateCustomerModal } from "@/components/modals/customers/update-customer-modal";
import type { Customer } from "@/types/customer";

function getPhoneDigits(phone: string | null) {
  return (phone ?? "").replace(/\D/g, "").slice(0, 11);
}

function formatPhone(phone: string | null) {
  const digits = getPhoneDigits(phone);
  if (!digits) return "Sem telefone";
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export function CustomersMain() {
  const {
    customers,
    search,
    setSearch,
    page,
    setPage,
    total,
    totalPages,
    loading,
    error,
    reload,
    replaceCustomer,
    removeCustomer,
  } = useAllCustomers();
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );

  if (loading && customers.length === 0) return <CustomersSkeleton />;

  return (
    <main className="mx-auto mt-8 flex w-full max-w-325 flex-col gap-6 px-4 pb-12 md:px-12">
      <div className="flex flex-col flex-wrap items-center justify-between gap-3">
        <p className="inline-flex items-center gap-1 text-sm text-muted-foreground mr-auto">
          <Users className="h-4 w-4" />
          {total} cliente{total !== 1 ? "s" : ""} cadastrado
          {total !== 1 ? "s" : ""}
        </p>

        <div className="flex flex-col-reverse md:flex-row mt-3 w-full flex-wrap justify-center md:justify-between items-center gap-2">
          <div className="relative w-full md:max-w-92">
            <Search className="absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone"
              className="pl-9"
              value={search}
              onChange={event => setSearch(event.target.value)}
            />
          </div>
          <Button
            className="shrink-0 cursor-pointer rounded-full w-46"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      {error ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-center text-sm text-destructive">
          <span>Não foi possível carregar os clientes.</span>
          <Button variant="outline" onClick={reload}>
            Tentar novamente
          </Button>
        </div>
      ) : customers.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Users className="h-10 w-10 opacity-20" />
          <span className="text-center text-sm opacity-50">
            {search
              ? "Nenhum cliente encontrado."
              : "Nenhum cliente cadastrado ainda."}
          </span>
        </div>
      ) : (
        <div className="overflow-x-clip rounded-lg border [&_tr:last-child_td:first-child]:rounded-bl-md [&_tr:last-child_td:last-child]:rounded-br-md">
          <Table>
            <TableHeader className="bg-zinc-900">
              <TableRow>
                <TableHead className="w-full min-w-0 rounded-tl-md md:pl-6">
                  Cliente
                </TableHead>
                <TableHead className="hidden w-36 text-center md:table-cell">
                  Telefone
                </TableHead>
                <TableHead className="w-20 rounded-tr-md md:w-48" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {customers.map(customer => {
                const phoneDigits = getPhoneDigits(customer.phone);
                const hasPhone = phoneDigits.length > 0;
                const isManualCustomer = customer.source === "customers";

                return (
                  <TableRow key={`${customer.source}:${customer.id}`}>
                    <TableCell className="max-w-0 md:pl-6">
                      <div className="flex min-w-0 flex-col md:flex-row md:items-center md:gap-3">
                        <p className="flex items-center gap-1.5 truncate font-medium">
                          {customer.name}
                          {customer.source === "customers_auth" && (
                            <span title="Cliente com celular verificado">
                              <BadgeCheck className="h-4 w-4 text-blue-500" />
                            </span>
                          )}
                        </p>
                        <span className="inline-flex min-w-0 items-center gap-1 text-sm text-muted-foreground md:hidden">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {hasPhone ? (
                            <a
                              href={`https://wa.me/55${phoneDigits}`}
                              className="truncate"
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              {formatPhone(customer.phone)}
                            </a>
                          ) : (
                            <span className="truncate">
                              {formatPhone(customer.phone)}
                            </span>
                          )}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {hasPhone ? (
                        <a
                          className="inline-flex cursor-pointer items-center gap-1"
                          href={`https://wa.me/55${phoneDigits}`}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {formatPhone(customer.phone)}
                        </a>
                      ) : (
                        <span className="inline-flex items-center gap-1">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          {formatPhone(customer.phone)}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer rounded-full w-10 lg:w-30"
                          onClick={() => setEditCustomer(customer)}
                          disabled={!isManualCustomer}
                          title={
                            isManualCustomer
                              ? "Editar cliente"
                              : "Clientes autenticados não são editados por este fluxo"
                          }
                        >
                          <Pencil className="h-3.5 w-3.5 lg:mr-2" />
                          <span className="hidden lg:inline">Editar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer rounded-full w-10 lg:w-30"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <CalendarDays className="h-3.5 w-3.5 lg:mr-2" />
                          <span className="hidden lg:inline">Histórico</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {!error && totalPages > 1 && (
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">
            Página {page} de {totalPages}
          </span>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={page <= 1 || loading}
              onClick={() => setPage(current => Math.max(1, current - 1))}
            >
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="rounded-full"
              disabled={page >= totalPages || loading}
              onClick={() =>
                setPage(current => Math.min(totalPages, current + 1))
              }
            >
              Próxima
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      <CustomerHistoryModal
        open={!!selectedCustomer}
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={() => {
          setPage(1);
          reload();
        }}
        onDeleted={id => {
          removeCustomer(id);
          reload();
        }}
        onEditExisting={customer => {
          setCreateOpen(false);
          setEditCustomer(customer);
        }}
      />
      <UpdateCustomerModal
        open={!!editCustomer}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onUpdated={replaceCustomer}
        onDeleted={id => {
          removeCustomer(id);
          reload();
        }}
        onEditExisting={setEditCustomer}
      />
    </main>
  );
}
