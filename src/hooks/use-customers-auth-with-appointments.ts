import { useMemo } from "react";
import { useCustomers } from "@/hooks/use-customers";

/**
 * Compatibility selector. New customer screens should use useAllCustomers so
 * manual and authenticated customers share one server-side query.
 */
export function useCustomersAuthWithAppointments() {
  const result = useCustomers();
  const customersAuth = useMemo(
    () =>
      result.customers.filter(customer => customer.source === "customers_auth"),
    [result.customers],
  );

  return {
    customersAuth,
    loading: result.loading,
    error: result.error,
    reload: result.reload,
  };
}
