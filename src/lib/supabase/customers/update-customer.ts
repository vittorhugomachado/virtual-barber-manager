import { supabase } from "../supabase";

type UpdateCustomerParams = {
  id: string;
  name: string;
  phone: string;
};

export async function updateCustomer({
  id,
  name,
  phone,
}: UpdateCustomerParams): Promise<boolean> {
  const { error } = await supabase
    .from("customers")
    .update({ name, phone, updated_at: new Date().toISOString() })
    .eq("id", id);

  return !error;
}
