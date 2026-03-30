import { useMemo } from "react";
import { useCustomers } from "@/hooks/use-customers";
import { useCustomersAuthWithAppointments } from "@/hooks/use-customers-auth-with-appointments";

export function useAllCustomers() {
  const { customers, setCustomers, loading: loadingCustomers } = useCustomers();
  const {
    customersAuth,
    setCustomersAuth,
    loading: loadingCustomersAuth,
  } = useCustomersAuthWithAppointments();

  const allCustomers = useMemo(() => {
    const merged = [...customers, ...customersAuth];

    return merged.sort((left, right) => {
      const leftDate = left.created_at ?? "";
      const rightDate = right.created_at ?? "";
      return rightDate.localeCompare(leftDate);
    });
  }, [customers, customersAuth]);
  console.log(allCustomers);
  return {
    customers: allCustomers,
    loading: loadingCustomers || loadingCustomersAuth,
    setCustomers,
    setCustomersAuth,
  };
}
