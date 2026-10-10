"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, ChevronDown, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { Overlay, GrabHandle, Z } from "@/components/overlay";
import { isoDay, monthGrid, monthYearLabel } from "@/lib/history";

export interface DateRangeISO {
  start: string;
  end: string;
}

type Shortcut = "today" | "last7" | "this_month" | "last_month" | "all";

const fmt = (d: Date) => isoDay(d);

/** Compute a shortcut range without touching global state. */
export function shortcutRange(type: Exclude<Shortcut, "all">): DateRangeISO {
  const now = new Date();
  if (type === "today") {
    const s = fmt(now);
    return { start: s, end: s };
  }
  if (type === "last7") {
    const start = new Date(now);
    start.setDate(now.getDate() - 6);
    return { start: fmt(start), end: fmt(now) };
  }
  if (type === "this_month") {
    const first = new Date(now.getFullYear(), now.getMonth(), 1);
    const last = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { start: fmt(first), end: fmt(last) };
  }
  const first = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const last = new Date(now.getFullYear(), now.getMonth(), 0);
  return { start: fmt(first), end: fmt(last) };
}

const SHORTCUTS: { id: Shortcut; label: string }[] = [
  { id: "today", label: "Today" },
  { id: "last7", label: "7 days" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "all", label: "All time" },
];

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

interface Props {
  value: DateRangeISO | null;
  onChange: (range: DateRangeISO | null) => void;
  /** YYYY-MM-DD keys of days that have transactions → dot marker. */
  markedDays?: Set<string>;
}

function pretty(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function DateRangeSheet({ value, onChange, markedDays }: Props) {
  const [open, setOpen] = useState(false);
  const [tmpStart, setTmpStart] = useState("");
  const [tmpEnd, setTmpEnd] = useState("");
  const [active, setActive] = useState<Shortcut | "custom">("all");
  const [error, setError] = useState("");
  const today = useMemo(() => new Date(), []);
  const [viewYear, setViewYear] = useState(today.getFullYear());
  const [viewMonth, setViewMonth] = useState(today.getMonth());

  useEffect(() => {
    if (!open) return;
    setTmpStart(value?.start ?? "");
    setTmpEnd(value?.end ?? "");
    setError("");
    setActive(value ? "custom" : "all");
    const anchor = value?.start ? new Date(value.start) : today;
    setViewYear(anchor.getFullYear());
    setViewMonth(anchor.getMonth());
  }, [open, value, today]);

  const pick = (id: Shortcut) => {
    setActive(id);
    setError("");
    if (id === "all") {
      onChange(null);
      setOpen(false);
      return;
    }
    const r = shortcutRange(id);
    setTmpStart(r.start);
    setTmpEnd(r.end);
    onChange(r);
    setOpen(false);
  };

  const tapDay = (iso: string) => {
    setError("");
    setActive("custom");
    if (!tmpStart || (tmpStart && tmpEnd)) {
      setTmpStart(iso);
      setTmpEnd("");
    } else if (iso < tmpStart) {
      setTmpEnd(tmpStart);
      setTmpStart(iso);
    } else {
      setTmpEnd(iso);
    }
  };

  const applyCustom = () => {
    if (!tmpStart || !tmpEnd) {
      setError("Pick a start and an end date.");
      return;
    }
    if (tmpEnd < tmpStart) {
      setError("End date is before start date. Please check the range.");
      return;
    }
    onChange({ start: tmpStart, end: tmpEnd });
    setOpen(false);
  };

  const shiftMonth = (delta: number) => {
    const d = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
  };

  const days = useMemo(() => monthGrid(viewYear, viewMonth), [viewYear, viewMonth]);
  const buttonLabel = !value
    ? "All dates"
    : active === "today"
    ? "Today"
    : `${pretty(value.start)} – ${pretty(value.end)}`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Select date range"
        className="w-full flex items-center gap-1.5 text-xs px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 active:scale-[0.98] transition-all font-medium"
      >
        <span className="flex items-center gap-1.5 min-w-0 flex-1">
          <Calendar className="w-4 h-4 text-blue-400 shrink-0" strokeWidth={2} />
          <span className="truncate">{buttonLabel}</span>
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" />
      </button>

      <Overlay open={open} onClose={() => setOpen(false)} z={Z.sheet} label="Select date range">
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-2 shrink-0">
          <h3 className="text-base font-semibold text-white">Select Date Range</h3>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close date picker"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-5 space-y-4">
          <div>
            <p className="text-[11px] font-medium text-white/40 mb-2 uppercase tracking-wider">Quick</p>
            <div className="grid grid-cols-5 gap-1.5">
              {SHORTCUTS.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pick(s.id)}
                  aria-pressed={active === s.id}
                  className={cn(
                    "py-2 px-1 text-xs font-medium rounded-xl border transition-all text-center active:scale-95",
                    active === s.id
                      ? "bg-blue-600/20 border-blue-500/40 text-white"
                      : "bg-white/5 border-white/5 text-white/80 hover:bg-white/10"
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>

          {/* Custom calendar — replaces the raw mm/dd/yyyy browser inputs */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <button
                type="button"
                onClick={() => shiftMonth(-1)}
                aria-label="Previous month"
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <p className="text-sm font-semibold text-white" aria-live="polite">
                {monthYearLabel(viewYear, viewMonth)}
              </p>
              <button
                type="button"
                onClick={() => shiftMonth(1)}
                aria-label="Next month"
                className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-7 gap-1 mb-1">
              {WEEKDAYS.map((w) => (
                <span key={w} className="text-center text-[10px] font-semibold text-white/30 py-1">
                  {w}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-1" role="group" aria-label="Pick start and end dates">
              {days.map((d) => {
                const iso = isoDay(d);
                const inMonth = d.getMonth() === viewMonth;
                const isStart = tmpStart === iso;
                const isEnd = tmpEnd === iso;
                const inRange = tmpStart && tmpEnd && iso > tmpStart && iso < tmpEnd;
                const marked = markedDays?.has(iso);
                return (
                  <button
                    key={iso}
                    type="button"
                    onClick={() => tapDay(iso)}
                    aria-label={iso}
                    aria-pressed={isStart || isEnd}
                    className={cn(
                      "relative aspect-square rounded-lg text-xs font-medium transition active:scale-90 flex flex-col items-center justify-center gap-0.5",
                      !inMonth && "opacity-25",
                      isStart || isEnd
                        ? "bg-blue-600 text-white font-bold"
                        : inRange
                        ? "bg-blue-600/20 text-white"
                        : "text-white/80 hover:bg-white/10"
                    )}
                  >
                    {d.getDate()}
                    {marked && !(isStart || isEnd) && (
                      <span aria-hidden="true" className="w-1 h-1 rounded-full bg-blue-400" />
                    )}
                  </button>
                );
              })}
            </div>
            {markedDays && markedDays.size > 0 && (
              <p className="text-[11px] text-white/40 mt-2">
                <span aria-hidden="true" className="inline-block w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 align-middle" />
                {markedDays.size} days with transactions
              </p>
            )}
          </div>

          {tmpStart && (
            <p className="text-xs text-white/60 text-center" aria-live="polite">
              {pretty(tmpStart)}{tmpEnd ? ` – ${pretty(tmpEnd)}` : " – pick an end date"}
            </p>
          )}
          {error && (
            <p role="alert" className="text-xs text-red-400 bg-red-500/10 border border-red-500/25 rounded-xl px-3 py-2">
              {error}
            </p>
          )}

          <div className="flex gap-2.5">
            <button
              type="button"
              onClick={() => { onChange(null); setOpen(false); }}
              className="flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-white/10 text-white/60 hover:bg-white/15 active:scale-[0.98] transition-colors min-h-[44px]"
            >
              Reset
            </button>
            <button
              type="button"
              onClick={applyCustom}
              disabled={!tmpStart || !tmpEnd}
              className="flex-1 py-2.5 text-xs sm:text-sm font-semibold rounded-xl bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-40 active:scale-[0.98] transition-colors min-h-[44px]"
            >
              Apply
            </button>
          </div>
        </div>
      </Overlay>
    </>
  );
}
