import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/context/AuthContext";
import type { TokenTransaction } from "@/types";

export function useTokenBalance() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["token-balance", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_transactions")
        .select("tokens")
        .eq("user_id", user!.id)
        .eq("status", "confirmed");
      if (error) throw error;
      return data.reduce((sum, t) => sum + Number(t.tokens), 0);
    },
  });
}

export function useTokenTransactions() {
  const { user } = useAuth();
  return useQuery({
    queryKey: ["token-transactions", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("token_transactions")
        .select("*")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as TokenTransaction[];
    },
  });
}
