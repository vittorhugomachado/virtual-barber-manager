import { supabase } from "../supabase";

type CreateCustomerParams = {
  barbershopId: string;
  name: string;
  phone: string;
};

export async function createCustomer({
  barbershopId,
  name,
  phone,
}: CreateCustomerParams): Promise<{ id: string } | null> {
  const { data, error } = await supabase
    .from("customers")
    .insert({
      barbershop_id: barbershopId,
      name,
      phone,
    })
    .select("id")
    .single();

  if (error) return null;
  return data;
}
