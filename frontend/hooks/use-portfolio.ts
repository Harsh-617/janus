"use client";

import { useState, useEffect, useCallback } from "react";
import { fetchPortfolio } from "@/lib/api";
import type { Portfolio } from "@/lib/types";

export function usePortfolio() {
  const [portfolio, setPortfolio] = useState<Portfolio | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    try {
      setError(null);
      const data = await fetchPortfolio();
      setPortfolio(data);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to fetch portfolio");
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refetch();

    const interval = setInterval(() => {
      refetch();
    }, 10000);

    return () => clearInterval(interval);
  }, [refetch]);

  return { portfolio, loading, error, refetch };
}
