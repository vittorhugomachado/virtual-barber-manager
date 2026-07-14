import { supabase } from "../supabase";

type DeleteCustomerResult =
  | { status: "deleted"; customer_id: string }
  | {
      status: "conflict";
      reason: "future_appointments";
      future_appointments: number;
    }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function deleteCustomer(
  barbershopId: string,
  id: string,
): Promise<DeleteCustomerResult> {
  const { data, error } = await supabase.rpc("delete_customer", {
    p_barbershop_id: barbershopId,
    p_customer_id: id,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return data as DeleteCustomerResult;
}
