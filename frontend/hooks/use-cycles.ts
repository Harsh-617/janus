"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchCycles } from "@/lib/api";
import type { DecisionCycle } from "@/lib/types";

export function useCycles(limit: number = 20) {
  const [cycles, setCycles] = useState<DecisionCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchCycles(limit);
      setCycles(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch cycles");
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    refetch();

    const interval = setInterval(() => {
      refetch();
    }, 30000);

    return () => clearInterval(interval);
  }, [refetch]);

  return { cycles, loading, error, refetch };
}
