import type { SupabaseClient } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export function getSupabaseClient() {
  return Promise.resolve<SupabaseClient>(supabase);
}
