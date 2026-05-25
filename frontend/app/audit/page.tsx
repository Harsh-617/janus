"use client";

import { useState, useEffect, useMemo } from "react";
import { LayoutWrapper } from "@/components/layout/layout-wrapper";
import { AuditTable } from "@/components/audit/audit-table";
import { Button } from "@/components/ui/button";
import { fetchCycles } from "@/lib/api";
import type { DecisionCycle } from "@/lib/types";
import { Search, Filter, Loader2, RefreshCw } from "lucide-react";

export default function AuditPage() {
  const [cycles, setCycles] = useState<DecisionCycle[]>([]);
  const [loading, setLoading] = useState(true);
  const [limit, setLimit] = useState(50);
  const [loadingMore, setLoadingMore] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [decisionFilter, setDecisionFilter] = useState<
    "ALL" | "EXECUTE" | "HOLD" | "HALT"
  >("ALL");
  const [showLearningOnly, setShowLearningOnly] = useState(false);
  const [cycleLimit, setCycleLimit] = useState<10 | 20 | 50 | 100>(50);

  const fetchData = async (newLimit?: number) => {
    try {
      if (newLimit) {
        setLoadingMore(true);
      } else {
        setLoading(true);
      }

      const raw = await fetchCycles(newLimit || limit);
      const rawCycles = Array.isArray(raw) ? raw : (raw as any).cycles || [];
      const sorted = [...rawCycles].sort((a, b) => {
        const getTime = (c: any) => {
          const t = c.timestamp || c.created_at;
          if (!t) return 0;
          if (typeof t === "string") return new Date(t).getTime();
          if (typeof t === "number") return t;
          if (t._seconds) return t._seconds * 1000;
          if (t.seconds) return t.seconds * 1000;
          return new Date(t).getTime();
        };
        return getTime(b) - getTime(a);
      });
      setCycles(sorted);
      if (newLimit) setLimit(newLimit);
    } catch (error) {
      console.error("Failed to fetch cycles:", error);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [limit]);

  useEffect(() => {
    fetchData(cycleLimit);
  }, [cycleLimit]);

  const filteredCycles = useMemo(() => {
    if (!Array.isArray(cycles)) return [];
    return cycles.filter((cycle) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        const matchesId = cycle.cycle_id.toLowerCase().includes(query);
        const matchesFinding = cycle.critical_finding
          .toLowerCase()
          .includes(query);
        if (!matchesId && !matchesFinding) return false;
      }

      // Decision filter
      if (decisionFilter !== "ALL" && cycle.final_decision !== decisionFilter) {
        return false;
      }

      // Learning events filter
      if (showLearningOnly && !cycle.learning_event) {
        return false;
      }

      return true;
    });
  }, [cycles, searchQuery, decisionFilter, showLearningOnly]);

  const handleLoadMore = () => {
    const newLimit = limit + 50;
    fetchData(newLimit);
  };

  return (
    <LayoutWrapper>
      <div className="space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-[var(--janus-text-primary)] mb-2">
            Audit Log
          </h1>
          <p className="text-sm text-[var(--janus-text-muted)]">
            Complete history of all decision cycles
          </p>
        </div>

        {/* Filter Controls */}
        <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Filter className="h-4 w-4 text-[var(--janus-text-muted)]" />
            <span className="text-xs text-[var(--janus-text-muted)] uppercase tracking-wide">
              Filters
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {/* Search */}
            <div>
              <label className="text-xs text-[var(--janus-text-muted)] mb-2 block">
                Search
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[var(--janus-text-muted)]" />
                <input
                  type="text"
                  placeholder="Cycle ID or finding..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-3 py-2 bg-[var(--janus-background)] border border-[var(--janus-border)] rounded text-sm text-[var(--janus-text-primary)] placeholder:text-[var(--janus-text-muted)] focus:outline-none focus:ring-2 focus:ring-[var(--janus-gold)]"
                />
              </div>
            </div>

            {/* Decision Filter */}
            <div>
              <label className="text-xs text-[var(--janus-text-muted)] mb-2 block">
                Decision
              </label>
              <select
                value={decisionFilter}
                onChange={(e) =>
                  setDecisionFilter(
                    e.target.value as "ALL" | "EXECUTE" | "HOLD" | "HALT"
                  )
                }
                className="w-full px-3 py-2 bg-[var(--janus-background)] border border-[var(--janus-border)] rounded text-sm text-[var(--janus-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--janus-gold)]"
              >
                <option value="ALL">All Decisions</option>
                <option value="EXECUTE">EXECUTE</option>
                <option value="HOLD">HOLD</option>
                <option value="HALT">HALT</option>
              </select>
            </div>

            {/* Cycle Limit */}
            <div>
              <label className="text-xs text-[var(--janus-text-muted)] mb-2 block">
                Show Last
              </label>
              <select
                value={cycleLimit}
                onChange={(e) =>
                  setCycleLimit(Number(e.target.value) as 10 | 20 | 50 | 100)
                }
                className="w-full px-3 py-2 bg-[var(--janus-background)] border border-[var(--janus-border)] rounded text-sm text-[var(--janus-text-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--janus-gold)]"
              >
                <option value={10}>10 cycles</option>
                <option value={20}>20 cycles</option>
                <option value={50}>50 cycles</option>
                <option value={100}>100 cycles</option>
              </select>
            </div>

            {/* Learning Events Only */}
            <div>
              <label className="text-xs text-[var(--janus-text-muted)] mb-2 block">
                Options
              </label>
              <label className="flex items-center gap-2 px-3 py-2 bg-[var(--janus-background)] border border-[var(--janus-border)] rounded cursor-pointer hover:bg-[var(--janus-border)] transition-colors">
                <input
                  type="checkbox"
                  checked={showLearningOnly}
                  onChange={(e) => setShowLearningOnly(e.target.checked)}
                  className="w-4 h-4 rounded border-[var(--janus-border)] text-[var(--janus-gold)] focus:ring-[var(--janus-gold)]"
                />
                <span className="text-sm text-[var(--janus-text-primary)]">
                  Learning events only
                </span>
              </label>
            </div>
          </div>

          {/* Results count */}
          <div className="mt-4 pt-4 border-t border-[var(--janus-border)] flex items-center justify-between">
            <span className="text-xs text-[var(--janus-text-muted)]">
              Showing {filteredCycles.length} of {cycles.length} cycles
            </span>
            <Button
              onClick={() => fetchData()}
              variant="outline"
              size="sm"
              className="border-[var(--janus-border)] h-7 px-2 text-xs gap-1.5"
            >
              <RefreshCw className="h-3 w-3" />
              Refresh
            </Button>
          </div>
        </div>

        {/* Audit Table */}
        <AuditTable cycles={filteredCycles} loading={loading} />

        {/* Load More Button */}
        {!loading && cycles.length > 0 && cycles.length >= limit && (
          <div className="flex justify-center">
            <Button
              onClick={handleLoadMore}
              disabled={loadingMore}
              variant="outline"
              className="border-[var(--janus-border)]"
            >
              {loadingMore ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Loading...
                </>
              ) : (
                `Load More (showing ${limit})`
              )}
            </Button>
          </div>
        )}
      </div>
    </LayoutWrapper>
  );
}
