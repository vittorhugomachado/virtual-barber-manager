import { useState, useMemo } from "react";
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
import {
  BadgeCheck,
  CalendarDays,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useAllCustomers } from "@/hooks/use-all-customers";
import { CustomersSkeleton } from "@/components/skeleton/customers-skeleton";
import { CreateCustomerModal } from "@/components/modals/customers/create-customer-modal";
import { CustomerHistoryModal } from "@/components/modals/customers/customer-history-modal";
import { UpdateCustomerModal } from "@/components/modals/customers/update-customer-modal";
import { Pencil } from "lucide-react";
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
  const { customers, setCustomers, loading } = useAllCustomers();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const filtered = useMemo(
    () =>
      customers.filter(
        c =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          (c.phone ?? "").includes(search),
      ),
    [customers, search],
  );

  if (loading) return <CustomersSkeleton />;

  return (
    <main className="w-full max-w-325 flex flex-col gap-6 px-4 md:px-12 pb-12 mx-auto mt-8">
      {/* Header */}
      <div className="flex flex-col flex-wrap md:flex-row items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <Users className="h-4 w-4" />
          {customers.length} cliente{customers.length !== 1 ? "s" : ""}{" "}
          cadastrado{customers.length !== 1 ? "s" : ""}
        </p>

        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone"
              className="pl-9"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            className="cursor-pointer shrink-0 rounded-full"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4" />
            Novo cliente
          </Button>
        </div>
      </div>

      {/* Tabela */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-20 text-muted-foreground">
          <Users className="h-10 w-10 opacity-20" />
          <span className="text-sm opacity-50 text-center">
            {search
              ? "Nenhum cliente encontrado."
              : "Nenhum cliente cadastrado ainda."}
          </span>
        </div>
      ) : (
        <div className="rounded-lg border overflow-x-clip [&_tr:last-child_td:first-child]:rounded-bl-md [&_tr:last-child_td:last-child]:rounded-br-md">
          <Table>
            <TableHeader className="bg-zinc-900">
              <TableRow>
                <TableHead className="w-full min-w-0 md:pl-6 rounded-tl-md">
                  Cliente
                </TableHead>
                <TableHead className="hidden text-center md:table-cell w-36">
                  Telefone
                </TableHead>
                <TableHead className="w-20 md:w-48 rounded-tr-md" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.map(customer => {
                const phoneDigits = getPhoneDigits(customer.phone);
                const hasPhone = phoneDigits.length > 0;
                const isManualCustomer = customer.source !== "customers_auth";

                return (
                  <TableRow key={customer.id}>
                    <TableCell className="md:pl-6 max-w-0">
                      <div className="flex flex-col md:flex-row md:items-center md:gap-3 min-w-0">
                        <p className="font-medium flex items-center gap-1.5 truncate">
                          {customer.name}
                          {customer.source === "customers_auth" && (
                            <span title="Cliente criado com verificacao de celular">
                              <BadgeCheck className="h-4 w-4 text-blue-500" />
                            </span>
                          )}
                        </p>
                        <span className="text-sm text-muted-foreground inline-flex items-center gap-1 md:hidden min-w-0">
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
                    <TableCell className="hidden md:table-cell text-muted-foreground">
                      {hasPhone ? (
                        <a
                          className="inline-flex items-center gap-1 cursor-pointer"
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
                          className="cursor-pointer rounded-full"
                          onClick={() =>
                            isManualCustomer && setEditCustomer(customer)
                          }
                          disabled={!isManualCustomer}
                          title={
                            isManualCustomer
                              ? "Editar cliente"
                              : "Clientes autenticados nao sao editados por este fluxo"
                          }
                        >
                          <Pencil className="h-3.5 w-3.5 lg:mr-2" />
                          <span className="hidden lg:inline">Editar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer rounded-full"
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

      <CustomerHistoryModal
        open={!!selectedCustomer}
        customer={selectedCustomer}
        onClose={() => setSelectedCustomer(null)}
      />
      <CreateCustomerModal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onCreated={customer => setCustomers(prev => [customer, ...prev])}
        onDeleted={id => setCustomers(prev => prev.filter(c => c.id !== id))}
        onEditExisting={customer => {
          setCreateOpen(false);
          setEditCustomer(customer);
        }}
      />
      <UpdateCustomerModal
        open={!!editCustomer}
        customer={editCustomer}
        onClose={() => setEditCustomer(null)}
        onUpdated={updated =>
          setCustomers(prev =>
            prev.map(c => (c.id === updated.id ? updated : c)),
          )
        }
        onDeleted={id => setCustomers(prev => prev.filter(c => c.id !== id))}
      />
    </main>
  );
}
