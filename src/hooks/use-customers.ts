import { useCallback, useEffect, useState } from "react";
import { getCustomers } from "@/lib/supabase/customers/get-customers";
import { useBarbershopStore } from "@/store/barbershop.store";
import type { Customer } from "@/types/customer";

const DEFAULT_PAGE_SIZE = 20;

export function useCustomers() {
  const barbershopId = useBarbershopStore(state => state.barbershop?.id);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearchValue] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);

  const setSearch = useCallback((value: string) => {
    setSearchValue(value);
    setPage(1);
  }, []);

  const reload = useCallback(() => {
    setReloadToken(current => current + 1);
  }, []);

  const replaceCustomer = useCallback((customer: Customer) => {
    setCustomers(current =>
      current.map(item => (item.id === customer.id ? customer : item)),
    );
  }, []);

  const removeCustomer = useCallback((customerId: string) => {
    setCustomers(current => current.filter(item => item.id !== customerId));
    setTotal(current => Math.max(0, current - 1));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDebouncedSearch(search.trim());
    }, 300);

    return () => window.clearTimeout(timeout);
  }, [search]);

  useEffect(() => {
    if (!barbershopId) return;

    let active = true;

    async function loadCustomers() {
      setLoading(true);
      setError(null);

      try {
        const result = await getCustomers({
          barbershopId: barbershopId!,
          search: debouncedSearch,
          page,
          pageSize: DEFAULT_PAGE_SIZE,
        });
        if (!active) return;
        setCustomers(result.items);
        setTotal(result.total);
        setTotalPages(result.total_pages);

        if (result.total_pages > 0 && page > result.total_pages) {
          setPage(result.total_pages);
        }
      } catch (cause) {
        if (!active) return;
        setCustomers([]);
        setTotal(0);
        setTotalPages(0);
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível carregar os clientes.",
        );
      } finally {
        if (active) setLoading(false);
      }
    }

    void loadCustomers();

    return () => {
      active = false;
    };
  }, [barbershopId, debouncedSearch, page, reloadToken]);

  return {
    customers: barbershopId ? customers : [],
    search,
    setSearch,
    page,
    setPage,
    pageSize: DEFAULT_PAGE_SIZE,
    total: barbershopId ? total : 0,
    totalPages: barbershopId ? totalPages : 0,
    loading: barbershopId ? loading : false,
    error: barbershopId ? error : null,
    reload,
    replaceCustomer,
    removeCustomer,
  };
}
