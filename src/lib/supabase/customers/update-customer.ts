import { supabase } from "../supabase";
import type { Customer } from "@/types/customer";

type UpdateCustomerParams = {
  id: string;
  barbershopId: string;
  name: string;
  phone: string;
};

type UpdateCustomerResult =
  | { status: "updated" }
  | { status: "conflict"; existing: Customer }
  | { status: "error" };

export async function updateCustomer({
  id,
  barbershopId,
  name,
  phone,
}: UpdateCustomerParams): Promise<UpdateCustomerResult> {
  const normalizedPhone = phone.replace(/\D/g, "");

  const { data: existingCustomer, error: existingError } = await supabase
    .from("customers")
    .select("*")
    .eq("barbershop_id", barbershopId)
    .eq("phone", normalizedPhone)
    .neq("id", id)
    .maybeSingle();

  if (existingError) {
    return { status: "error" };
  }

  if (existingCustomer) {
    return { status: "conflict", existing: existingCustomer };
  }

  const { error } = await supabase
    .from("customers")
    .update({
      name,
      phone: normalizedPhone,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) {
    if (error.code === "23505") {
      const { data: existing } = await supabase
        .from("customers")
        .select("*")
        .eq("barbershop_id", barbershopId)
        .eq("phone", normalizedPhone)
        .neq("id", id)
        .single();

      if (existing) return { status: "conflict", existing };
    }
    return { status: "error" };
  }

  return { status: "updated" };
}
