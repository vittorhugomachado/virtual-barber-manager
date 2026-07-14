import { supabase } from "../supabase";
import type { CustomersPage } from "@/types/customer";

type GetCustomersParams = {
  barbershopId: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export async function getCustomers({
  barbershopId,
  search = "",
  page = 1,
  pageSize = 20,
}: GetCustomersParams): Promise<CustomersPage> {
  const { data, error } = await supabase.rpc("get_customers", {
    p_barbershop_id: barbershopId,
    p_search: search,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw error;
  return data as CustomersPage;
}
