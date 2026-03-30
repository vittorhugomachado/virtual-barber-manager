import { supabase } from "../supabase";

type DeleteCustomerResult =
  | { status: "deleted" }
  | { status: "conflict" }
  | { status: "error" };

export async function deleteCustomer(id: string): Promise<DeleteCustomerResult> {
  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (!error) {
    return { status: "deleted" };
  }

  if (error.code === "23503") {
    return { status: "conflict" };
  }

  return { status: "error" };
}
