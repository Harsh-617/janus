"use client";

import { cn } from "@/lib/utils";
import type { SSEEvent } from "@/lib/types";
import { AGENT_DISPLAY_NAMES } from "@/lib/constants";
import { StatusIndicator } from "@/components/shared/status-indicator";
import { ScoreBadge } from "@/components/shared/score-badge";
import {
  Activity,
  AlertCircle,
  CheckCircle,
  Clock,
  AlertTriangle,
  Zap,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface DecisionFeedProps {
  events: SSEEvent[];
  connected: boolean;
}

export function DecisionFeed({ events, connected }: DecisionFeedProps) {
  const getEventIcon = (type: string) => {
    switch (type) {
      case "cycle_start":
        return <Zap className="h-4 w-4 text-[var(--janus-blue)]" />;
      case "agent_thinking":
        return <Activity className="h-4 w-4 text-[var(--janus-warning)]" />;
      case "cycle_complete":
        return <CheckCircle className="h-4 w-4 text-[var(--janus-success)]" />;
      case "cycle_error":
        return <AlertCircle className="h-4 w-4 text-[var(--janus-danger)]" />;
      case "circuit_breaker_activated":
        return <AlertTriangle className="h-4 w-4 text-[var(--janus-danger)]" />;
      case "trade_executed":
        return <Activity className="h-4 w-4 text-[#C9A84C]" />;
      default:
        return <Clock className="h-4 w-4 text-[var(--janus-text-muted)]" />;
    }
  };

  const formatTimestamp = (timestamp: string) => {
    try {
      return formatDistanceToNow(new Date(timestamp), { addSuffix: true });
    } catch {
      return "just now";
    }
  };

  const truncateText = (text: string, maxLength: number) => {
    if (text.length <= maxLength) return text;
    return text.substring(0, maxLength) + "...";
  };

  const renderEventContent = (event: SSEEvent) => {
    switch (event.type as string) {
      case "trade_executed": {
        const d = (event as any).data;
        return (
          <div>
            <div className="text-sm font-medium text-[var(--janus-text-primary)]">
              {d.direction} {Number(d.quantity).toFixed(1)} {d.ticker} @ ${Number(d.price).toFixed(2)}
            </div>
            {d.rationale && (
              <div className="text-xs text-[var(--janus-text-muted)] mt-1">
                {truncateText(d.rationale, 80)}
              </div>
            )}
          </div>
        );
      }

      case "cycle_start":
        return (
          <div>
            <div className="text-sm font-medium text-[var(--janus-text-primary)]">
              Starting cycle #{event.data.cycle_number}
            </div>
            {event.data.message && (
              <div className="text-xs text-[var(--janus-text-muted)] mt-1">
                {event.data.message}
              </div>
            )}
          </div>
        );

      case "agent_thinking":
        return (
          <div className="flex items-center gap-2">
            <div className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[var(--janus-warning)] opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-[var(--janus-warning)]"></span>
            </div>
            <span className="text-sm text-[var(--janus-text-primary)]">
              <span className="font-semibold">
                {AGENT_DISPLAY_NAMES[event.data.agent]}
              </span>{" "}
              is analyzing...
            </span>
          </div>
        );

      case "cycle_complete":
        return (
          <div className="space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <StatusIndicator status={event.data.final_decision} />
              <ScoreBadge score={event.data.judge_score} size="sm" />
              <span className="text-xs text-[var(--janus-text-muted)]">
                {event.data.trades_executed} trade
                {event.data.trades_executed !== 1 ? "s" : ""}
              </span>
              {event.data.learning_event && (
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--janus-warning)]/20 text-[var(--janus-warning)] border border-[var(--janus-warning)]/30">
                  Learning Event
                </span>
              )}
              {event.data.circuit_breaker && (
                <span className="text-xs px-2 py-0.5 rounded bg-[var(--janus-danger)]/20 text-[var(--janus-danger)] border border-[var(--janus-danger)]/30">
                  Circuit Breaker
                </span>
              )}
            </div>
            {event.data.critical_finding && (
              <div className="text-xs text-[var(--janus-text-secondary)] mt-2">
                {truncateText(event.data.critical_finding, 100)}
              </div>
            )}
          </div>
        );

      case "cycle_error":
        return (
          <div>
            <div className="text-sm font-medium text-[var(--janus-danger)]">
              Cycle Error
            </div>
            <div className="text-xs text-[var(--janus-text-secondary)] mt-1">
              {truncateText(event.data.error, 100)}
            </div>
          </div>
        );

      case "circuit_breaker_activated":
        return (
          <div className="space-y-1">
            <div className="text-sm font-semibold text-[var(--janus-danger)]">
              Circuit Breaker Activated
            </div>
            <div className="text-xs text-[var(--janus-text-secondary)]">
              {event.data.reason}
            </div>
            <div className="text-xs text-[var(--janus-text-muted)]">
              Cooldown: {event.data.cooldown_minutes} minutes
            </div>
          </div>
        );

      case "connected":
        return (
          <div className="text-sm text-[var(--janus-success)]">
            Connected to event stream
          </div>
        );

      case "ping":
        return null; // Don't show ping events

      default:
        return (
          <div className="text-sm text-[var(--janus-text-muted)]">
            {event.type}
          </div>
        );
    }
  };

  // Filter out ping events and take last 20
  const displayEvents = events.filter((e) => e.type !== "ping").slice(0, 20);

  return (
    <div className="bg-[var(--janus-surface)] border border-[var(--janus-border)] rounded-lg p-6 h-full flex flex-col">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-[var(--janus-text-primary)] uppercase tracking-wide">
          Decision Feed
        </h2>
        <div className="flex items-center gap-2">
          <div
            className={cn(
              "w-2 h-2 rounded-full",
              connected ? "bg-[var(--janus-success)]" : "bg-[var(--janus-danger)]"
            )}
          />
          <span className="text-xs text-[var(--janus-text-muted)]">
            {connected ? "Live" : "Disconnected"}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3">
        {displayEvents.length === 0 ? (
          <div className="flex items-center justify-center h-full text-[var(--janus-text-muted)] text-sm">
            No events yet. Waiting for activity...
          </div>
        ) : (
          displayEvents.map((event, index) => {
            const content = renderEventContent(event);
            if (!content) return null;

            return (
              <div
                key={`${event.type}-${event.timestamp}-${index}`}
                className="p-3 rounded-lg bg-[var(--janus-background)] border border-[var(--janus-border)] hover:border-[var(--janus-gold)]/30 transition-colors"
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5">{getEventIcon(event.type)}</div>
                  <div className="flex-1 min-w-0">
                    {content}
                    <div className="text-xs text-[var(--janus-text-muted)] mt-2">
                      {formatTimestamp(event.timestamp)}
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
