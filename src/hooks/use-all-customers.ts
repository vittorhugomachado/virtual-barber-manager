import { useCustomers } from "@/hooks/use-customers";

/** Unified, paginated customer source backed by public.get_customers. */
export function useAllCustomers() {
  return useCustomers();
}
