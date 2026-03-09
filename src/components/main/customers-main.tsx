import { useState } from "react";
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
  CalendarDays,
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  Phone,
  Plus,
  Search,
  Users,
} from "lucide-react";
import { useCustomers } from "@/hooks/use-customers";
import { CustomersSkeleton } from "@/components/skeleton/customers-skeleton";
import { CreateCustomerModal } from "@/components/modals/customers/create-customer-modal";
import { CustomerHistoryModal } from "@/components/modals/customers/customer-history-modal";
import { UpdateCustomerModal } from "@/components/modals/customers/update-customer-modal";
import { Pencil } from "lucide-react";
import type { Customer } from "@/types/customer";

type SortField = "last_appointment" | "total_appointments" | null;
type SortDir = "asc" | "desc";

function SortIcon({
  field,
  sortField,
  sortDir,
}: {
  field: SortField;
  sortField: SortField;
  sortDir: SortDir;
}) {
  if (sortField !== field)
    return <ChevronsUpDown className="h-3.5 w-3.5 ml-1 opacity-40" />;
  return sortDir === "asc" ? (
    <ChevronUp className="h-3.5 w-3.5 ml-1" />
  ) : (
    <ChevronDown className="h-3.5 w-3.5 ml-1" />
  );
}

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, "($1) $2-$3");
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, "($1) $2-$3");
}

export function CustomersMain() {
  const { customers, setCustomers, loading } = useCustomers();
  const [search, setSearch] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [editCustomer, setEditCustomer] = useState<Customer | null>(null);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(
    null,
  );
  const [sortField, setSortField] = useState<SortField>(null);
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Solução correta para problemas de hidratação - sem setState no useEffect
  const [mounted] = useState(() => {
    if (typeof window !== "undefined") {
      return true;
    }
    return false;
  });

  function handleSort(field: SortField) {
    if (sortField === field) {
      setSortDir(d => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  }

  const filtered = customers
    .filter(
      c =>
        c.name.toLowerCase().includes(search.toLowerCase()) ||
        c.phone.includes(search),
    )
    .sort((a, b) => {
      if (!sortField) return 0;
      const dir = sortDir === "asc" ? 1 : -1;

      if (sortField === "total_appointments") {
        return (
          ((a.total_appointments ?? 0) - (b.total_appointments ?? 0)) * dir
        );
      }
      if (sortField === "last_appointment") {
        const dateA = a.last_appointment
          ? new Date(a.last_appointment).getTime()
          : 0;
        const dateB = b.last_appointment
          ? new Date(b.last_appointment).getTime()
          : 0;
        return (dateA - dateB) * dir;
      }
      return 0;
    });

  // Mostra skeleton durante o carregamento ou antes da hidratação
  if (loading || !mounted) return <CustomersSkeleton />;

  return (
    <main className="w-full max-w-7xl flex flex-col gap-6 px-4 sm:px-6 lg:px-8 pb-12 mx-auto mt-8">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground inline-flex items-center gap-1">
          <Users className="h-4 w-4" />
          {customers.length} cliente{customers.length !== 1 ? "s" : ""}{" "}
          cadastrado{customers.length !== 1 ? "s" : ""}
        </p>

        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 w-full sm:w-auto">
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome ou telefone"
              className="pl-9 w-full"
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
          <Button
            className="cursor-pointer w-full sm:w-auto"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="h-4 w-4 mr-2" />
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
        <div className="rounded-lg border overflow-hidden">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader className="bg-zinc-900">
                <TableRow>
                  <TableHead className="min-w-50 md:pl-6">Cliente</TableHead>
                  <TableHead className="hidden md:table-cell min-w-37.5">
                    Telefone
                  </TableHead>
                  <TableHead className="hidden lg:table-cell min-w-30 cursor-pointer select-none">
                    <button
                      className="inline-flex items-center w-full"
                      onClick={() => handleSort("total_appointments")}
                    >
                      Agendamentos
                      <SortIcon
                        field="total_appointments"
                        sortField={sortField}
                        sortDir={sortDir}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="hidden lg:table-cell min-w-30 cursor-pointer select-none">
                    <button
                      className="inline-flex items-center w-full"
                      onClick={() => handleSort("last_appointment")}
                    >
                      Última visita
                      <SortIcon
                        field="last_appointment"
                        sortField={sortField}
                        sortDir={sortDir}
                      />
                    </button>
                  </TableHead>
                  <TableHead className="min-w-30 text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map(customer => (
                  <TableRow key={customer.id}>
                    <TableCell className="md:pl-6">
                      <div className="flex flex-col min-w-0">
                        <span className="font-medium truncate">
                          {customer.name}
                        </span>
                        {/* Telefone visível apenas em mobile */}
                        <span className="text-sm text-muted-foreground inline-flex items-center gap-1 md:hidden">
                          <Phone className="h-3.5 w-3.5 shrink-0" />
                          <a
                            href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}`}
                            className="truncate"
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {formatPhone(customer.phone)}
                          </a>
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="hidden md:table-cell">
                      <a
                        className="inline-flex items-center gap-1 hover:underline"
                        href={`https://wa.me/55${customer.phone.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        <Phone className="h-3.5 w-3.5 shrink-0" />
                        {formatPhone(customer.phone)}
                      </a>
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {customer.total_appointments ?? "—"}
                    </TableCell>
                    <TableCell className="hidden lg:table-cell">
                      {customer.last_appointment
                        ? new Date(
                            customer.last_appointment,
                          ).toLocaleDateString("pt-BR")
                        : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => setEditCustomer(customer)}
                        >
                          <Pencil className="h-3.5 w-3.5 sm:mr-2" />
                          <span className="hidden sm:inline">Editar</span>
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="cursor-pointer"
                          onClick={() => setSelectedCustomer(customer)}
                        >
                          <CalendarDays className="h-3.5 w-3.5 sm:mr-2" />
                          <span className="hidden sm:inline">Histórico</span>
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
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
        onCreated={customer => setCustomers(prev => [customer, ...prev])}
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
