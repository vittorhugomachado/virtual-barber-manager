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
  | { status: "error" };

export async function createCustomer({
  barbershopId,
  name,
  phone,
}: CreateCustomerParams): Promise<CreateCustomerResult> {
  const normalizedPhone = phone.replace(/\D/g, "");

  const { data, error } = await supabase
    .from("customers")
    .insert({ barbershop_id: barbershopId, name, phone: normalizedPhone })
    .select("*")
    .single();

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("customers")
        .select("*")
        .eq("barbershop_id", barbershopId)
        .eq("phone", normalizedPhone)
        .single();

      if (existing) return { status: "conflict", existing };
    }
    return { status: "error" };
  }

  return { status: "created", customer: data };
}
