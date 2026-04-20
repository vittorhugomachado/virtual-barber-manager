import { supabase } from "../supabase";

type DeleteCustomerResult =
  | { status: "deleted" }
  | { status: "conflict" }
  | { status: "error" };

export async function deleteCustomer(
  id: string,
): Promise<DeleteCustomerResult> {
  // Desvincula agendamentos passados antes de deletar (snapshots preservam os dados)
  const { error: unlinkError } = await supabase
    .from("appointments")
    .update({ manual_customer_id: null })
    .eq("manual_customer_id", id);

  if (unlinkError) {
    return { status: "error" };
  }

  const { error } = await supabase.from("customers").delete().eq("id", id);

  if (!error) {
    return { status: "deleted" };
  }

  if (error.code === "23503") {
    return { status: "conflict" };
  }

  return { status: "error" };
}
