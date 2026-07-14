import { supabase } from "../supabase";
import type { CustomerHistoryPage, CustomerSource } from "@/types/customer";

type GetCustomerHistoryParams = {
  barbershopId: string;
  customerId: string;
  source: CustomerSource;
  page?: number;
  pageSize?: number;
};

type CustomerHistoryResult =
  | CustomerHistoryPage
  | { status: "invalid" | "not_found" };

export async function getCustomerHistory({
  barbershopId,
  customerId,
  source,
  page = 1,
  pageSize = 10,
}: GetCustomerHistoryParams): Promise<CustomerHistoryResult> {
  const { data, error } = await supabase.rpc("get_customer_history", {
    p_barbershop_id: barbershopId,
    p_customer_id: customerId,
    p_source: source,
    p_page: page,
    p_page_size: pageSize,
  });

  if (error) throw error;
  return data as CustomerHistoryResult;
}
