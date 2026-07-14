import { supabase } from "../supabase";
import type { Customer } from "@/types/customer";

type CreateCustomerParams = {
  barbershopId: string;
  name: string;
  phone: string;
};

type CreateCustomerResult =
  | { status: "created"; customer: Customer }
  | { status: "conflict"; existing: Customer }
  | { status: "invalid"; field: "name" | "phone" }
  | { status: "error"; message: string };

export async function createCustomer({
  barbershopId,
  name,
  phone,
}: CreateCustomerParams): Promise<CreateCustomerResult> {
  const { data, error } = await supabase.rpc("create_customer", {
    p_barbershop_id: barbershopId,
    p_name: name,
    p_phone: phone,
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return data as CreateCustomerResult;
}
