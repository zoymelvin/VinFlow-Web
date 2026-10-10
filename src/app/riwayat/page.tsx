"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowLeft, SlidersHorizontal, Star, X,
  Check, Trash2, Download, ChevronDown, NotebookPen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceStore, type Pocket, type Transaction } from "@/store/useFinanceStore";
import DateRangeSheet, { type DateRangeISO } from "@/components/DateRangeSheet";
import CategoryIcon, { POCKET_ICONS } from "@/components/CategoryIcon";
import TransactionDetailSheet from "@/components/TransactionDetailSheet";
import { Overlay, Portal, GrabHandle, Z, useBackEntry, useLockBody } from "@/components/overlay";
import Money, { useMoneyDisplay } from "@/components/Money";
import {
  DEFAULT_HISTORY_FILTERS,
  activeChips,
  displayName,
  filterTransactions,
  groupByDay,
  sortTransactions,
  toCSV,
  type HistoryFilters,
  type SortKey,
  type TypeFilter,
} from "@/lib/history";

const SORT_OPTIONS: { id: SortKey; label: string }[] = [
  { id: "newest", label: "Newest" },
  { id: "oldest", label: "Oldest" },
  { id: "amount-desc", label: "Highest amount" },
  { id: "amount-asc", label: "Lowest amount" },
];

const PAGE_SIZE = 60;
const LONG_PRESS_MS = 550;

const pocketNameOf = (pockets: Pocket[], id: string) =>
  pockets.find((p) => p.id === id)?.name ?? "Deleted wallet";

export default function RiwayatPage() {
  const transactions = useFinanceStore((s) => s.transactions);
  const pockets = useFinanceStore((s) => s.pockets);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updatePocketBalance = useFinanceStore((s) => s.updatePocketBalance);
  const deleteTransaction = useFinanceStore((s) => s.deleteTransaction);
  const toggleStar = useFinanceStore((s) => s.toggleStar);

  const { text: moneyText } = useMoneyDisplay();
  const [hasMounted, setHasMounted] = useState(false);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<HistoryFilters>(DEFAULT_HISTORY_FILTERS);
  const [range, setRange] = useState<DateRangeISO | null>(null);
  const [sort, setSort] = useState<SortKey>("newest");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [walletOpen, setWalletOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [selectMode, setSelectMode] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [detailId, setDetailId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string[] | null>(null);
  const [toast, setToast] = useState("");
  const sentinelRef = useRef<HTMLDivElement>(null);
  const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pressMoved = useRef(false);

  useEffect(() => {
    setHasMounted(true);
    const t = setTimeout(() => setLoading(false), 280);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [filters, range, sort]);

  const markedDays = useMemo(() => {
    const set = new Set<string>();
    transactions.forEach((t) => {
      const m = t.date.match(/(\d{4})-(\d{2})-(\d{2})/);
      if (m) set.add(`${m[1]}-${m[2]}-${m[3]}`);
    });
    return set;
  }, [transactions]);

  const filtered = useMemo(
    () => filterTransactions(transactions, filters, range),
    [transactions, filters, range]
  );
  const sorted = useMemo(() => sortTransactions(filtered, sort), [filtered, sort]);
  const groups = useMemo(() => groupByDay(sorted, sort), [sorted, sort]);
  const chips = useMemo(
    () => activeChips(filters, range, sort, (id) => pocketNameOf(pockets, id)),
    [filters, range, sort, pockets]
  );

  const visibleGroups = useMemo(() => {
    let used = 0;
    const out: typeof groups = [];
    groups.forEach((g) => {
      if (used >= visibleCount) return;
      const rest = visibleCount - used;
      out.push({ ...g, items: g.items.slice(0, rest) });
      used += g.items.length;
    });
    return out;
  }, [groups, visibleCount]);

  // Incremental loading
  useEffect(() => {
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          setVisibleCount((c) => (c < sorted.length ? c + PAGE_SIZE : c));
        }
      },
      { rootMargin: "600px" }
    );
    io.observe(el);
    return () => io.disconnect();
  }, [sorted.length]);

  const exitSelectMode = useCallback(() => {
    setSelectMode(false);
    setSelected([]);
  }, []);

  // Hardware back exits select mode first — unified with overlay stack
  useBackEntry(selectMode, exitSelectMode);
  // Lock background scroll while select mode or delete confirm is active
  useLockBody(selectMode || !!confirmDelete);
  // Back/Escape for delete confirm uses the same shared stack
  useBackEntry(!!confirmDelete, () => setConfirmDelete(null));

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2400);
  };

  const setF = (patch: Partial<HistoryFilters>) =>
    setFilters((f) => ({ ...f, ...patch }));

  const removeChip = (key: string) => {
    if (key === "range") setRange(null);
    else if (key === "type") setF({ type: "all" });
    else if (key === "pocket") setF({ pocketId: "" });
    else if (key === "starred") setF({ onlyStarred: false });
    else if (key === "sort") setSort("newest");
  };

  const resetAll = () => {
    setFilters(DEFAULT_HISTORY_FILTERS);
    setRange(null);
    setSort("newest");
    exitSelectMode();
  };

  // Auto-exit select mode when the last item is deselected
  useEffect(() => {
    if (selectMode && selected.length === 0) setSelectMode(false);
  }, [selectMode, selected.length]);

  const toggleSelect = (id: string) =>
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : prev.concat([id])
    );

  const enterSelectMode = (id: string) => {
    if (navigator.vibrate) {
      try { navigator.vibrate(12); } catch { /* unsupported */ }
    }
    setSelectMode(true);
    setSelected([id]);
  };

  /* Long-press: movement or early release cancels; also suppresses the
     browser context menu and text selection during the press. */
  const bindPress = (id: string) => ({
    onPointerDown: () => {
      pressMoved.current = false;
      if (pressTimer.current) clearTimeout(pressTimer.current);
      pressTimer.current = setTimeout(() => {
        if (!pressMoved.current) enterSelectMode(id);
      }, LONG_PRESS_MS);
    },
    onPointerMove: () => {
      pressMoved.current = true;
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    onPointerUp: () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    onPointerLeave: () => {
      if (pressTimer.current) clearTimeout(pressTimer.current);
    },
    onContextMenu: (e: React.SyntheticEvent) => e.preventDefault(),
  });

  const confirmAndDelete = (ids: string[]) => setConfirmDelete(ids);

  const doDelete = () => {
    if (!confirmDelete) return;
    confirmDelete.forEach((id) => deleteTransaction(id));
    setConfirmDelete(null);
    exitSelectMode();
    setDetailId(null);
    showToast(
      confirmDelete.length === 1
        ? "Transaction deleted"
        : `${confirmDelete.length} transactions deleted`
    );
  };

  const handleDuplicate = (t: Transaction) => {
    const pocket = pockets.find((p) => p.id === t.pocketId);
    addTransaction({
      ...t,
      id: `txn-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
      date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }),
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    });
    if (pocket) {
      updatePocketBalance(
        pocket.id,
        pocket.balance + (t.isExpense ? -t.amount : t.amount)
      );
    }
    setDetailId(null);
    showToast("Transaction duplicated");
  };

  const handleExport = () => {
    const csv = toCSV(sorted, (id) => pocketNameOf(pockets, id));
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `transaction-history-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast(`${sorted.length} rows exported to CSV`);
  };

  const detailTxn = detailId ? transactions.find((t) => t.id === detailId) ?? null : null;
  const activeWallet = filters.pocketId
    ? pockets.find((p) => p.id === filters.pocketId) ?? null
    : null;
  const activeSortLabel = SORT_OPTIONS.find((o) => o.id === sort)?.label ?? "Newest";

  if (!hasMounted) return null;

  const hasActiveFilter = chips.length > 0;
  const allVisibleIds = sorted.map((t) => t.id);
  const allSelected = selectMode && selected.length > 0 && selected.length === allVisibleIds.length;

  return (
    <motion.main
      className="relative min-h-screen bg-background text-foreground pb-28 px-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >


      {/* Header: back + title only (+ working export) */}
      <header className="relative flex items-center gap-3 mb-5">
        <Link
          href="/"
          aria-label="Back to home"
          className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition shrink-0"
        >
          <ArrowLeft className="w-5 h-5 text-white/80" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-white leading-tight">
            {selectMode ? `${selected.length} selected` : "Transaction History"}
          </h1>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1 mb-2">Log</p>
          <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
        </div>
        {selectMode ? (
          <button
            type="button"
            onClick={exitSelectMode}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 min-h-[44px] px-2"
          >
            Cancel
          </button>
        ) : (
          sorted.length > 0 && (
            <button
              type="button"
              onClick={handleExport}
              aria-label="Export to CSV"
              className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition shrink-0"
            >
              <Download className="w-5 h-5 text-white/70" />
            </button>
          )
        )}
      </header>

      {/* Filter row: single row — filter toggle + select-all lives in select bar */}
      <div className="relative mb-3">
        <button
          type="button"
          onClick={() => setFiltersOpen((v) => !v)}
          aria-expanded={filtersOpen}
          aria-label="Toggle filters"
          className={cn(
            "w-full px-4 py-3 rounded-2xl border text-sm font-semibold flex items-center gap-2 active:scale-[0.99] transition",
            hasActiveFilter || filtersOpen
              ? "bg-blue-600/15 border-blue-500/40 text-white"
              : "bg-white/5 border-white/10 text-white/70"
          )}
        >
          <SlidersHorizontal className="w-4 h-4" />
          Filters
          {chips.length > 0 && (
            <span className="min-w-5 h-5 px-1.5 rounded-full bg-blue-500 text-white text-[11px] font-bold flex items-center justify-center">
              {chips.length}
            </span>
          )}
          <ChevronDown className={cn("w-4 h-4 ml-auto transition-transform", filtersOpen && "rotate-180")} />
        </button>
      </div>

      {/* Filter panel — roomy, no overlaps */}
      {filtersOpen && (
        <section aria-label="Filters" className="relative rounded-2xl bg-white/5 border border-white/10 p-4 mb-3 space-y-5">
          <div>
            <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Type</p>
            <div className="grid grid-cols-3 gap-1.5 p-1 rounded-xl bg-black/30 border border-white/5" role="tablist" aria-label="Transaction type filter">
              {(["all", "expense", "income", "transfer"] as TypeFilter[]).map((v) => (
                <button
                  key={v}
                  role="tab"
                  aria-selected={filters.type === v}
                  type="button"
                  onClick={() => setF({ type: v })}
                  className={cn(
                    "py-2.5 rounded-lg text-xs font-semibold transition min-h-[44px]",
                    filters.type === v
                      ? v === "income"
                        ? "bg-emerald-500/20 text-emerald-300 border border-emerald-500/40"
                        : v === "expense"
                        ? "bg-red-500/15 text-red-300 border border-red-500/30"
                        : "bg-blue-600/20 text-white border border-blue-500/40"
                      : "text-white/50 border border-transparent"
                  )}
                >
                  {v === "all" ? "All" : v === "expense" ? "Expense" : "Income"}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Date</p>
              <DateRangeSheet value={range} onChange={setRange} markedDays={markedDays} />
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Wallet</p>
              <button
                type="button"
                onClick={() => setWalletOpen(true)}
                aria-haspopup="dialog"
                className="w-full flex items-center gap-1.5 text-xs px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 active:scale-[0.98] transition-all font-medium"
              >
                <span className="truncate flex-1 text-left">
                  {activeWallet ? activeWallet.name : "All wallets"}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" />
              </button>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Sort</p>
              <button
                type="button"
                onClick={() => setSortOpen(true)}
                aria-haspopup="dialog"
                className="w-full flex items-center gap-1.5 text-xs px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-white/80 hover:bg-white/10 active:scale-[0.98] transition-all font-medium"
              >
                <span className="truncate flex-1 text-left">{activeSortLabel}</span>
                <ChevronDown className="w-3.5 h-3.5 text-white/40 shrink-0" />
              </button>
            </div>
            <div>
              <p className="text-[11px] font-semibold text-white/40 uppercase tracking-widest mb-2">Other</p>
              <button
                type="button"
                onClick={() => setF({ onlyStarred: !filters.onlyStarred })}
                aria-pressed={filters.onlyStarred}
                className={cn(
                  "w-full px-3 py-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 transition active:scale-[0.98] min-h-[42px]",
                  filters.onlyStarred
                    ? "bg-amber-500/15 border-amber-500/40 text-amber-300"
                    : "bg-white/5 border-white/10 text-white/60"
                )}
              >
                <Star className={cn("w-3.5 h-3.5", filters.onlyStarred && "fill-amber-300")} />
                Starred
              </button>
            </div>
          </div>
        </section>
      )}

      {/* Active chips — padded clear of screen edges */}
      {chips.length > 0 && (
        <div className="relative flex flex-wrap items-center gap-2 mb-4 px-0.5">
          {chips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => removeChip(c.key)}
              aria-label={`Remove ${c.label} filter`}
              className="flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-full text-[11px] font-medium bg-blue-600/20 border border-blue-500/40 text-white/90 active:scale-95 transition"
            >
              {c.label}
              <X className="w-3 h-3" />
            </button>
          ))}
          <button
            type="button"
            onClick={resetAll}
            className="px-3 py-1.5 rounded-full text-[11px] font-semibold text-white/50 underline underline-offset-2 min-h-[32px]"
          >
            Reset all
          </button>
        </div>
      )}

      {/* Select-mode action bar */}
      {selectMode && (
        <div className="relative sticky top-2 mb-3 flex items-center gap-2 p-2.5 pl-4 rounded-2xl bg-secondary border border-white/10 shadow-xl">
          <button
            type="button"
            onClick={() => setSelected(allSelected ? [] : allVisibleIds)}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 min-h-[44px]"
          >
            {allSelected ? "Deselect all" : "Select all"}
          </button>
          <span className="text-xs text-white/40 flex-1 text-center" aria-live="polite">
            {selected.length} of {sorted.length}
          </span>
          <button
            type="button"
            onClick={() => confirmAndDelete(selected)}
            disabled={selected.length === 0}
            className="px-4 py-2.5 rounded-xl text-xs font-semibold bg-red-500/15 border border-red-500/30 text-red-300 active:scale-95 transition flex items-center gap-1.5 disabled:opacity-40 min-h-[44px]"
          >
            <Trash2 className="w-3.5 h-3.5" /> Delete
          </button>
        </div>
      )}

      {/* List */}
      <div className="relative space-y-5" aria-live="polite">
        {loading ? (
          <HistorySkeleton />
        ) : groups.length === 0 ? (
          <div className="rounded-3xl bg-white/5 border border-white/10 p-8 text-center">
            <div className="w-14 h-14 mx-auto mb-3 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center">
              <NotebookPen className="w-6 h-6 text-white/30" />
            </div>
            <h2 className="text-sm font-bold text-white mb-1">
              {transactions.length === 0 ? "No transactions yet" : "No results"}
            </h2>
            <p className="text-xs text-white/40 mb-4 leading-relaxed">
              {transactions.length === 0
                ? "Record your first transaction with the + button below."
                : "Try adjusting the active filters."}
            </p>
            {transactions.length > 0 && (
              <button
                type="button"
                onClick={resetAll}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold bg-blue-600 text-white hover:bg-blue-500 active:scale-95 transition min-h-[44px]"
              >
                Reset filters
              </button>
            )}
          </div>
        ) : (
          visibleGroups.map((g) => (
            <section key={g.key} aria-label={g.dateLabel || g.label}>
              <div className="sticky top-0 z-10 -mx-4 px-4 py-1.5 bg-background/90 backdrop-blur-md">
                <div className="flex items-center justify-between">
                  <h2 className="text-xs font-bold text-white/70">{g.label}</h2>
                  <span
                    className={cn(
                      "text-[11px] font-semibold font-numeric",
                      g.total >= 0 ? "text-emerald-400/80" : "text-red-400/80"
                    )}
                  >
                    {g.total >= 0 ? "+" : "−"}<Money value={Math.abs(g.total)} />
                  </span>
                </div>
              </div>
              <ul className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/5 overflow-hidden">
                {g.items.map((t) => {
                  const checked = selected.includes(t.id);
                  const press = bindPress(t.id);
                  return (
                    <li key={t.id}>
                      <button
                        type="button"
                        {...press}
                        onClick={() => (selectMode ? toggleSelect(t.id) : setDetailId(t.id))}
                        aria-label={`${t.isExpense ? "Expense" : "Income"} ${t.category} ${moneyText(t.amount)}`}
                        aria-pressed={selectMode ? checked : undefined}
                        className="w-full flex items-center gap-3 p-3.5 text-left transition min-h-[64px] select-none touch-pan-y outline-none focus-visible:ring-2 focus-visible:ring-blue-500/60 focus-visible:ring-inset active:bg-white/5"
                        style={{ WebkitTapHighlightColor: "transparent", WebkitTouchCallout: "none" }}
                      >
                        {selectMode && (
                          <span
                            className={cn(
                              "w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 transition",
                              checked ? "bg-blue-500 border-blue-500" : "border-white/25"
                            )}
                            aria-hidden="true"
                          >
                            {checked && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
                          </span>
                        )}
                        <CategoryIcon category={t.category} />
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5">
                            <span className="text-sm font-semibold truncate">{displayName(t)}</span>
                            {t.starred && (
                              <Star className="w-3 h-3 text-amber-300 fill-amber-300 shrink-0" aria-label="Starred transaction" />
                            )}
                          </span>
                             <span className="text-xs text-white/40 truncate block">
                               {t.category} · {t.time}
                               {t.note ? " · has note" : ""}
                               {t.image ? " · has photo" : ""}
                               {t.goalAllocation && t.goalAllocation.length > 0 && (
                                 <span className="ml-1 inline-flex h-2 w-2 items-center justify-center rounded-full bg-green-400" />
                               )}
                             </span>
                        </span>
                        <span
                          className={cn(
                            "text-sm font-bold font-numeric shrink-0 max-w-[45%] truncate",
                            t.isExpense ? "text-white" : "text-green-500"
                          )}
                        >
                          {t.isExpense ? "−" : "+"}<Money value={t.amount} />
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))
        )}
        <div ref={sentinelRef} aria-hidden="true" className="h-1" />
      </div>

      {/* Wallet picker — in-frame bottom sheet */}
      <Overlay open={walletOpen} onClose={() => setWalletOpen(false)} z={Z.sheet} label="Select wallet">
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-white">Select Wallet</h3>
          <button
            type="button"
            onClick={() => setWalletOpen(false)}
            aria-label="Close wallet picker"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-5 space-y-2" role="listbox" aria-label="Wallets">
          <WalletRow
            selected={filters.pocketId === ""}
            name="All Wallets"
            sub="Show everything"
            iconName={null}
            onPick={() => { setF({ pocketId: "" }); setWalletOpen(false); }}
          />
          {pockets.map((p) => (
            <WalletRow
              key={p.id}
              selected={filters.pocketId === p.id}
              name={p.name}
              sub={`${p.category} · ${moneyText(p.balance)}`}
              iconName={p.iconName}
              onPick={() => { setF({ pocketId: p.id }); setWalletOpen(false); }}
            />
          ))}
        </div>
      </Overlay>

      {/* Sort picker — same pattern, no native dropdown left */}
      <Overlay open={sortOpen} onClose={() => setSortOpen(false)} z={Z.sheet} label="Sort transactions">
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-white">Sort By</h3>
          <button
            type="button"
            onClick={() => setSortOpen(false)}
            aria-label="Close sort picker"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-5 space-y-2" role="listbox" aria-label="Sort options">
          {SORT_OPTIONS.map((o) => (
            <button
              key={o.id}
              type="button"
              role="option"
              aria-selected={sort === o.id}
              onClick={() => { setSort(o.id); setSortOpen(false); }}
              className={cn(
                "w-full flex items-center justify-between p-3.5 rounded-2xl border transition-all text-left min-h-[52px]",
                sort === o.id
                  ? "bg-blue-600/20 border-blue-500/50 text-white"
                  : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
              )}
            >
              <span className="font-medium text-sm">{o.label}</span>
              {sort === o.id && <Check className="w-4 h-4 text-blue-400" />}
            </button>
          ))}
        </div>
      </Overlay>

      {/* Detail modal */}
      <TransactionDetailSheet
        txn={detailTxn}
        pocketName={detailTxn ? pocketNameOf(pockets, detailTxn.pocketId) : ""}
        onClose={() => setDetailId(null)}
        onDelete={(t) => confirmAndDelete([t.id])}
        onDuplicate={handleDuplicate}
        onToggleStar={(t) => toggleStar(t.id)}
      />

      {/* Delete confirmation — portaled so page stacking can't cover it */}
      <Portal>
        {confirmDelete && (
          <div
            className="fixed inset-0 isolate flex items-center justify-center p-6"
            style={{ zIndex: Z.confirm }}
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
          >
            <div className="absolute inset-0 bg-black/80" onClick={() => setConfirmDelete(null)} />
            <div className="relative w-full max-w-xs rounded-3xl bg-secondary border border-white/10 p-5 shadow-2xl">
              <h3 className="text-sm font-bold text-white mb-1.5">
                Delete {confirmDelete.length === 1 ? "transaction" : `${confirmDelete.length} transactions`}?
              </h3>
              <p className="text-xs text-white/50 leading-relaxed mb-4">
                {confirmDelete.length === 1
                  ? "This transaction will be removed and the wallet balance restored. This cannot be undone."
                  : `${confirmDelete.length} transactions will be removed and wallet balances restored. This cannot be undone.`}
              </p>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setConfirmDelete(null)}
                  className="flex-1 py-3 rounded-xl text-xs font-semibold bg-white/10 text-white/70 active:scale-95 transition min-h-[48px]"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={doDelete}
                  className="flex-1 py-3 rounded-xl text-xs font-semibold bg-red-500 text-white active:scale-95 transition min-h-[48px]"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        )}
      </Portal>

      {/* Toast */}
      <Portal>
        {toast && (
          <div
            className="fixed bottom-28 left-1/2 -translate-x-1/2 px-4 py-2.5 rounded-full bg-white text-black text-xs font-semibold shadow-2xl whitespace-nowrap"
            style={{ zIndex: Z.toast }}
            role="status"
          >
            {toast}
          </div>
        )}
      </Portal>
    </motion.main>
  );
}

function WalletRow({ selected, name, sub, iconName, onPick }: {
  selected: boolean;
  name: string;
  sub: string;
  iconName: string | null;
  onPick: () => void;
}) {
  const Icon = (iconName && POCKET_ICONS[iconName]) || POCKET_ICONS.Wallet;
  return (
    <button
      type="button"
      role="option"
      aria-selected={selected}
      onClick={onPick}
      className={cn(
        "w-full flex items-center gap-3 p-3.5 rounded-2xl border transition-all text-left min-h-[60px]",
        selected
          ? "bg-blue-600/20 border-blue-500/50 text-white"
          : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10"
      )}
    >
      <span className={cn(
        "w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0",
        selected ? "bg-blue-600/20 border-blue-500/40" : "bg-white/5 border-white/10"
      )}>
        <Icon className={cn("w-5 h-5", selected ? "text-blue-400" : "text-white/50")} />
      </span>
      <span className="flex-1 min-w-0">
        <span className="block font-medium text-sm text-white truncate">{name}</span>
        <span className="block text-xs text-white/40 font-numeric truncate">{sub}</span>
      </span>
      {selected && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
    </button>
  );
}

function HistorySkeleton() {
  return (
    <div className="space-y-5" aria-label="Loading history">
      {[0, 1].map((g) => (
        <div key={g}>
          <div className="h-3 w-28 rounded bg-white/10 mb-2 animate-pulse" />
          <div className="rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/5 overflow-hidden">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-center gap-3 p-3.5">
                <div className="w-10 h-10 rounded-2xl bg-white/10 animate-pulse shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <div className="h-3 w-2/3 rounded bg-white/10 animate-pulse" />
                  <div className="h-2.5 w-1/3 rounded bg-white/5 animate-pulse" />
                </div>
                <div className="h-3.5 w-20 rounded bg-white/10 animate-pulse" />
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
