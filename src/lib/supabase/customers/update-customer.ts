import { supabase } from "../supabase";
import type { Customer } from "@/types/customer";

type UpdateCustomerParams = {
  id: string;
  barbershopId: string;
  name: string;
  phone: string;
};

type UpdateCustomerResult =
  | { status: "updated"; customer: Customer }
  | { status: "conflict"; existing: Customer }
  | { status: "conflict"; existing?: undefined }
  | { status: "invalid"; field: "name" | "phone" }
  | { status: "not_found" }
  | { status: "error"; message: string };

export async function updateCustomer({
  id,
  barbershopId,
  name,
  phone,
}: UpdateCustomerParams): Promise<UpdateCustomerResult> {
  const { data, error } = await supabase.rpc("update_customer", {
    p_barbershop_id: barbershopId,
    p_customer_id: id,
    p_name: name,
    p_phone: phone,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return data as UpdateCustomerResult;
}
