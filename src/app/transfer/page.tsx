"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  ArrowLeft, ArrowLeftRight, ArrowUpDown, Check, ChevronDown, Wallet, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceStore, type Pocket } from "@/store/useFinanceStore";
import Money, { useMoneyDisplay } from "@/components/Money";
import { Overlay, GrabHandle, Z } from "@/components/overlay";
import { POCKET_ICONS } from "@/components/CategoryIcon";
import { getSystemDate } from "@/lib/date";
import { formatIDR } from "@/lib/settings";
import {
  MAX_AMOUNT,
  clampAddedAmount,
  computeBalancesAfter,
  formatAmountGrouped,
  parseAmountToInteger,
  parseTransferRouteParams,
  resolveInitialSelection,
  sanitizeAmountInput,
  transferButtonLabel,
  validateAmountForBalance,
} from "@/lib/transfer";

/**
 * Text-digits input rendered with id-ID thousand grouping. Keeps a stable
 * caret: counts the digits before the caret in the raw value, then restores
 * the caret to the same digit position in the formatted value.
 */
function useFormattedDigitsInput() {
  const [digits, setDigits] = useState("");
  const ref = useRef<HTMLInputElement>(null);
  const caretRef = useRef<number | null>(null);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const el = e.currentTarget;
    const raw = el.value;
    const clean = sanitizeAmountInput(raw);
    const caretPos = typeof el.selectionStart === "number" ? el.selectionStart : raw.length;
    let before = 0;
    for (let i = 0; i < caretPos && i < raw.length; i += 1) {
      if (/\d/.test(raw.charAt(i))) before += 1;
    }
    caretRef.current = before;
    setDigits(clean);
  };

  useEffect(() => {
    const el = ref.current;
    const want = caretRef.current;
    if (!el || want === null) return;
    caretRef.current = null;
    const formatted = formatAmountGrouped(digits);
    let seen = 0;
    let pos = 0;
    while (pos < formatted.length && seen < want) {
      if (/\d/.test(formatted.charAt(pos))) seen += 1;
      pos += 1;
    }
    try {
      el.setSelectionRange(pos, pos);
    } catch {
      // selection API unsupported here — the value is still correct
    }
  }, [digits]);

  return { digits, setDigits, value: formatAmountGrouped(digits), ref, handleChange };
}

export default function TransferPage() {
  const router = useRouter();
  const pockets = useFinanceStore((s) => s.pockets);
  const addTransfer = useFinanceStore((s) => s.addTransfer);
  const { text: moneyText } = useMoneyDisplay();

  const [hasMounted, setHasMounted] = useState(false);
  const [routeParams, setRouteParams] = useState<{ fromId?: string; toId?: string; amount?: number }>({});
  const [selectionInit, setSelectionInit] = useState(false);
  const [fromId, setFromId] = useState<string | null>(null);
  const [toId, setToId] = useState<string | null>(null);
  const [pickerSide, setPickerSide] = useState<"from" | "to" | null>(null);
  const [feeOpen, setFeeOpen] = useState(false);
  const [msg, setMsg] = useState("");
  const [sending, setSending] = useState(false);
  const [succeeded, setSucceeded] = useState(false);
  const [keyboardLift, setKeyboardLift] = useState(0);

  const amountInput = useFormattedDigitsInput();
  const feeInput = useFormattedDigitsInput();
  const { setDigits: setAmountDigits } = amountInput;
  const keyRef = useRef<string | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const mountedRef = useRef(false);

  useEffect(() => {
    setHasMounted(true);
    setRouteParams(parseTransferRouteParams(window.location.search));
  }, []);

  // Initial From/To: route params when they point at real wallets, else the
  // largest-balance wallet. From == To is auto-repaired to a different To.
  useEffect(() => {
    if (!hasMounted || selectionInit) return;
    const resolved = resolveInitialSelection(pockets, routeParams);
    if (!resolved) return;
    setFromId(resolved.from);
    setToId(resolved.to);
    if (routeParams.amount) setAmountDigits(String(routeParams.amount));
    setSelectionInit(true);
  }, [hasMounted, selectionInit, pockets, routeParams, setAmountDigits]);

  // Repair the selection if a wallet was deleted elsewhere while open.
  useEffect(() => {
    if (!selectionInit || pockets.length < 2) return;
    const fromOk = pockets.some((p) => p.id === fromId);
    const toOk = pockets.some((p) => p.id === toId);
    if (!fromOk || !toOk || fromId === toId) {
      const resolved = resolveInitialSelection(pockets, {});
      if (resolved) {
        setFromId(resolved.from);
        setToId(resolved.to);
      }
    }
  }, [pockets, selectionInit, fromId, toId]);

  // Store errors are transient: clear the line as soon as the user edits.
  useEffect(() => {
    setMsg("");
  }, [amountInput.digits, feeInput.digits, fromId, toId]);

  // Keep the pinned send button above the on-screen keyboard (iOS Safari
  // keeps innerHeight fixed, so visualViewport shrinkage is the signal; on
  // Android the viewport resizes and the fixed button follows on its own).
  useEffect(() => {
    if (!hasMounted) return;
    const vv = window.visualViewport;
    if (!vv) return;
    const update = () => {
      const hidden = window.innerHeight - Math.round(vv.height);
      setKeyboardLift(hidden > 40 ? hidden : 0);
    };
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    update();
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, [hasMounted]);

  // Cancel pending navigation if the user leaves mid-send.
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      timersRef.current.forEach((t) => clearTimeout(t));
      timersRef.current = [];
    };
  }, []);

  /* ── Derived state ── */
  const fromPocket = pockets.find((p) => p.id === fromId) ?? null;
  const toPocket = pockets.find((p) => p.id === toId) ?? null;
  const amountInt = parseAmountToInteger(amountInput.digits);
  const feeInt = parseAmountToInteger(feeInput.digits);
  const fromBalance = fromPocket?.balance ?? 0;
  const toBalance = toPocket?.balance ?? 0;
  const { ok: fundsOk, available } = validateAmountForBalance({
    amount: amountInt,
    adminFee: feeInt,
    fromBalance,
  });
  const insufficientMsg =
    amountInt > 0 && !fundsOk
      ? `Not enough balance in ${fromPocket?.name ?? "wallet"}. Available: ${formatIDR(Math.max(0, available))}.`
      : "";
  const displayedMsg = msg || insufficientMsg;
  const { fromAfter, toAfter } = computeBalancesAfter({
    fromBalance,
    toBalance,
    amount: amountInt,
    adminFee: feeInt,
  });
  const canSend = !sending && !succeeded && !!fromPocket && !!toPocket && amountInt > 0 && fundsOk;

  /* ── Handlers ── */
  const handleSwap = () => {
    if (!fromId || !toId || fromId === toId) return;
    setFromId(toId);
    setToId(fromId);
  };

  const quickAddAllowance = () => Math.max(0, fromBalance - feeInt);

  const handleQuickAdd = (add: number) => {
    const next = clampAddedAmount(parseAmountToInteger(amountInput.digits), add, quickAddAllowance());
    amountInput.setDigits(next > 0 ? String(next) : "");
  };

  const handleMax = () => {
    const next = Math.min(quickAddAllowance(), MAX_AMOUNT);
    amountInput.setDigits(next > 0 ? String(next) : "");
  };

  const pickWallet = (id: string) => {
    if (pickerSide === "from") setFromId(id);
    else if (pickerSide === "to") setToId(id);
    setPickerSide(null);
  };

  const handleSend = () => {
    if (!canSend || !fromPocket || !toPocket) return;
    setSending(true);
    setMsg("");
    // One idempotency key per send attempt — reused on repeated taps,
    // cleared only after success, so a double tap can never duplicate.
    if (!keyRef.current) {
      keyRef.current = `tr-${Date.now()}-${Math.floor(Math.random() * 1e6)}`;
    }
    const res = addTransfer({
      fromPocketId: fromPocket.id,
      toPocketId: toPocket.id,
      amount: amountInt,
      adminFee: feeInt,
      date: getSystemDate(),
      key: keyRef.current,
    });
    if (res.ok) {
      keyRef.current = null;
      setSucceeded(true);
      const t = setTimeout(() => {
        if (mountedRef.current) router.back();
      }, 240);
      timersRef.current.push(t);
    } else {
      // The store is the authority; keep every input untouched, re-arm.
      setSending(false);
      setMsg(res.error);
    }
  };

  if (!hasMounted) return null;

  const backButton = (
    <Link
      href="/pockets"
      aria-label="Back to wallets"
      className="flex w-11 h-11 items-center justify-center rounded-full outline-none"
    >
      <span className="w-10 h-10 rounded-full bg-[#151922] border border-[#232938] flex items-center justify-center text-white/80">
        <ArrowLeft className="w-5 h-5" aria-hidden="true" />
      </span>
    </Link>
  );

  /* ── Friendly empty state: direct visit with < 2 wallets ── */
  if (pockets.length < 2) {
    return (
      <main className="relative min-h-screen bg-background text-foreground px-4 pb-28">
        <header className="pt-[max(12px,env(safe-area-inset-top))] pb-2">
          <div className="flex items-center gap-3">
            {backButton}
            <div className="min-w-0">
              <h1 className="text-[22px] font-bold tracking-tight text-white leading-tight">Transfer</h1>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9aa3b2] mt-0.5">
                MOVE MONEY
              </p>
            </div>
          </div>
          <div className="h-px w-[150px] bg-gradient-to-r from-blue-500/40 to-transparent mt-2.5" />
        </header>
        <div className="flex flex-col items-center text-center pt-16 px-6">
          <span className="w-14 h-14 rounded-2xl bg-[#6ea4ff]/10 border border-[#6ea4ff]/25 flex items-center justify-center mb-4">
            <ArrowLeftRight className="w-6 h-6 text-[#6ea4ff]" strokeWidth={1.8} aria-hidden="true" />
          </span>
          <h2 className="text-base font-bold text-white mb-1.5">You need at least two wallets to transfer</h2>
          <p className="text-xs text-white/40 leading-relaxed mb-6">
            Transfers move money between wallets without counting as income or expense.
          </p>
          <Link
            href="/pockets"
            className="px-5 py-3 rounded-full bg-blue-600 text-white text-sm font-semibold active:scale-[0.95] transition min-h-[44px] flex items-center"
          >
            Add wallet
          </Link>
        </div>
      </main>
    );
  }

  if (!selectionInit || !fromPocket || !toPocket) return null;

  const pocketIcon = (p: Pocket) => (p.iconName && POCKET_ICONS[p.iconName]) || Wallet;

  const walletRow = (p: Pocket, side: "from" | "to") => {
    const oppositeId = side === "from" ? toId : fromId;
    const isOpposite = p.id === oppositeId;
    const selected = p.id === (side === "from" ? fromId : toId);
    // A zero/negative wallet is a poor source (dimmed, flagged) but stays
    // selectable as a destination.
    const noBalance = side === "from" && p.balance <= 0;
    const Icon = (p.iconName && POCKET_ICONS[p.iconName]) || Wallet;
    return (
      <button
        key={p.id}
        type="button"
        role="option"
        aria-selected={selected}
        aria-disabled={isOpposite || undefined}
        disabled={isOpposite}
        onClick={() => pickWallet(p.id)}
        className={cn(
          "w-full flex items-center gap-3 p-3.5 rounded-2xl border text-left min-h-[60px] transition-all",
          selected
            ? "bg-blue-600/20 border-blue-500/50 text-white"
            : "bg-white/5 border-white/5 text-white/70 hover:bg-white/10",
          isOpposite && "opacity-40 cursor-default",
          noBalance && "opacity-50"
        )}
      >
        <span className={cn(
          "w-10 h-10 rounded-2xl flex items-center justify-center border shrink-0",
          selected ? "bg-blue-600/20 border-blue-500/40" : "bg-white/5 border-white/10"
        )}>
          <Icon className={cn("w-5 h-5", selected ? "text-blue-400" : "text-white/50")} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0">
          <span className="block font-medium text-sm text-white truncate">{p.name}</span>
          <span className="block text-xs text-white/40 font-numeric truncate">
            {p.category} · {moneyText(p.balance)}
            {noBalance ? " · No balance" : ""}
          </span>
        </span>
        {selected && <Check className="w-4 h-4 text-blue-400 shrink-0" aria-hidden="true" />}
      </button>
    );
  };

  const sideCard = (side: "from" | "to") => {
    const pocket = side === "from" ? fromPocket : toPocket;
    const Icon = pocketIcon(pocket);
    const label = side === "from" ? "From" : "To";
    return (
      <button
        type="button"
        onClick={() => setPickerSide(side)}
        aria-label={`Choose ${label} wallet`}
        className="w-full rounded-[20px] bg-[#151922] border border-[#232938] p-4 flex items-center gap-3 text-left active:scale-[0.98] transition-transform"
      >
        <span className="w-10 h-10 rounded-[13px] bg-[#6ea4ff]/[0.14] border border-[#6ea4ff]/25 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-[#6ea4ff]" strokeWidth={1.8} aria-hidden="true" />
        </span>
        <span className="flex-1 min-w-0 text-left">
          <span className="block text-[11px] font-semibold uppercase tracking-widest text-[#9aa3b2]">{label}</span>
          <span className="block text-base font-semibold text-white truncate">{pocket.name}</span>
          <span className="block text-xs text-[#9aa3b2] font-numeric truncate">
            {pocket.category} · {moneyText(pocket.balance)}
          </span>
        </span>
        <ChevronDown className="w-4 h-4 text-white/40 shrink-0" aria-hidden="true" />
      </button>
    );
  };

  const quickChips = [
    { label: "+50K", add: 50_000 },
    { label: "+100K", add: 100_000 },
    { label: "+500K", add: 500_000 },
  ];

  return (
    <main className="relative min-h-screen bg-background text-foreground px-4 pb-40">
      <header className="pt-[max(12px,env(safe-area-inset-top))] pb-2">
        <div className="flex items-center gap-3">
          {backButton}
          <div className="min-w-0">
            <h1 className="text-[22px] font-bold tracking-tight text-white leading-tight">Transfer</h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9aa3b2] mt-0.5">
              MOVE MONEY
            </p>
          </div>
        </div>
        <div className="h-px w-[150px] bg-gradient-to-r from-blue-500/40 to-transparent mt-2.5" />
      </header>

      {/* From card — 20px below the header */}
      <div className="mt-5">{sideCard("from")}</div>

      {/* Swap — straddles the 12px gap between the cards */}
      <div className="relative z-10 flex justify-center -my-2 h-0 pointer-events-none">
        <button
          type="button"
          onClick={handleSwap}
          aria-label="Swap wallets"
          className="pointer-events-auto w-11 h-11 rounded-full bg-[#1a2a4f] border border-[#2c4a8a] flex items-center justify-center active:scale-90 transition-transform"
        >
          <ArrowUpDown className="w-5 h-5 text-[#9cc0ff]" strokeWidth={1.8} aria-hidden="true" />
        </button>
      </div>

      {/* To card */}
      <div className="mt-3">{sideCard("to")}</div>

      {/* Amount */}
      <section aria-label="Amount" className="mt-3 rounded-[20px] bg-[#151922] border border-[#232938] p-4">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#9aa3b2] mb-1.5">AMOUNT</p>
        <div className="flex items-baseline gap-2">
          <span className="text-[34px] font-bold tracking-tight text-white/60 font-numeric" aria-hidden="true">Rp</span>
          <input
            ref={amountInput.ref}
            value={amountInput.value}
            onChange={amountInput.handleChange}
            inputMode="numeric"
            autoComplete="off"
            placeholder="0"
            aria-label="Amount"
            className="w-full min-w-0 bg-transparent text-[34px] font-bold tracking-tight font-numeric text-white outline-none caret-[#007AFF] placeholder:text-white/20"
          />
        </div>
        <div className="grid grid-cols-4 gap-2 mt-3">
          {quickChips.map((chip) => (
            <button
              key={chip.label}
              type="button"
              aria-label={`Add ${chip.label.slice(1)} rupiah`}
              onClick={() => handleQuickAdd(chip.add)}
              className="min-h-[44px] rounded-xl bg-[#0f121a] border border-[#232938] text-[#6ea4ff] text-[13px] font-semibold active:scale-[0.97] transition-transform"
            >
              {chip.label}
            </button>
          ))}
          <button
            type="button"
            aria-label="Maximum amount"
            onClick={handleMax}
            className="min-h-[44px] rounded-xl bg-[#0f121a] border border-[#232938] text-[#6ea4ff] text-[13px] font-semibold active:scale-[0.97] transition-transform"
          >
            Max
          </button>
        </div>
      </section>

      {/* Message line — reserved height so no layout jump */}
      <p aria-live="polite" className="min-h-4 text-xs text-[#ff6b7a] mt-2 px-1">
        {displayedMsg}
      </p>

      {/* Summary */}
      <section aria-label="Summary" className="mt-3 rounded-[20px] bg-[#151922] border border-[#232938]">
        <dl className="divide-y divide-[#232938]">
          <div className="flex items-center justify-between gap-3 p-4">
            <dt className="text-xs text-white/40 truncate">{fromPocket.name} after</dt>
            <dd className="text-sm font-bold font-numeric text-white"><Money value={fromAfter} /></dd>
          </div>
          <div className="flex items-center justify-between gap-3 p-4">
            <dt className="text-xs text-white/40 truncate">{toPocket.name} after</dt>
            <dd className="text-sm font-bold font-numeric text-[#3ddc97]"><Money value={toAfter} /></dd>
          </div>
          <div>
            <button
              type="button"
              onClick={() => setFeeOpen(true)}
              aria-label="Set optional admin fee"
              className="w-full flex items-center justify-between gap-3 p-4 text-left min-h-[44px] active:bg-white/5 transition-colors"
            >
              <span className="text-xs text-white/40">Admin fee (optional)</span>
              <span className="text-sm font-semibold font-numeric text-white/70 flex items-center gap-1.5">
                <Money value={feeInt} />
                <ChevronDown className="w-3.5 h-3.5 text-white/30" aria-hidden="true" />
              </span>
            </button>
          </div>
        </dl>
      </section>

      <p className="text-xs text-white/40 mt-4 px-1">Transfers don&apos;t count as income or expense.</p>

      {/* Wallet picker sheet — solid bottom sheet via the shared Overlay */}
      <Overlay
        open={pickerSide !== null}
        onClose={() => setPickerSide(null)}
        z={Z.sheet}
        label={pickerSide === "from" ? "Select From wallet" : "Select To wallet"}
      >
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-white">
            {pickerSide === "from" ? "From wallet" : "To wallet"}
          </h3>
          <button
            type="button"
            onClick={() => setPickerSide(null)}
            aria-label="Close wallet picker"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="overflow-y-auto px-4 pb-5 space-y-2" role="listbox" aria-label="Wallets">
          {pockets.map((p) => walletRow(p, pickerSide ?? "from"))}
        </div>
      </Overlay>

      {/* Admin fee sheet */}
      <Overlay open={feeOpen} onClose={() => setFeeOpen(false)} z={Z.sheet} label="Set admin fee">
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-white">Admin fee</h3>
          <button
            type="button"
            onClick={() => setFeeOpen(false)}
            aria-label="Close admin fee"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>
        <div className="px-5 pb-8 space-y-4">
          <p className="text-xs text-white/40 leading-relaxed">
            Optional fee paid from the From wallet. It is recorded as a normal expense and does not change what arrives.
          </p>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-bold text-white/60 font-numeric" aria-hidden="true">Rp</span>
            <input
              ref={feeInput.ref}
              value={feeInput.value}
              onChange={feeInput.handleChange}
              inputMode="numeric"
              autoComplete="off"
              placeholder="0"
              aria-label="Admin fee"
              className="w-full min-w-0 bg-transparent text-3xl font-bold font-numeric text-white outline-none caret-[#007AFF] placeholder:text-white/20"
            />
          </div>
          <button
            type="button"
            onClick={() => setFeeOpen(false)}
            className="w-full py-3 rounded-full bg-blue-600 text-white text-sm font-semibold active:scale-[0.98] transition min-h-[48px]"
          >
            Done
          </button>
        </div>
      </Overlay>

      {/* Send button — pinned to the viewport bottom, lifted above the
          on-screen keyboard with a transform only (no layout shift). */}
      <div
        className="fixed inset-x-0 bottom-0 z-10 px-4"
        style={{
          paddingBottom: "calc(0.75rem + env(safe-area-inset-bottom))",
          transform: keyboardLift > 0 ? `translateY(${-keyboardLift}px)` : "none",
          transition: "transform 150ms ease-out",
        }}
      >
        <button
          type="button"
          onClick={handleSend}
          disabled={!canSend}
          aria-live="polite"
          className={cn(
            "w-full h-14 rounded-full text-base font-bold max-w-lg mx-auto flex items-center justify-center",
            "transition-[background-color,color,opacity] duration-150",
            canSend
              ? "bg-[#2563eb] text-white active:scale-[0.98]"
              : "bg-[#1b1f29] text-[#6d7686] cursor-not-allowed"
          )}
        >
          <span className="inline-flex items-center gap-2">
            {succeeded ? (
              <>
                <Check className="w-5 h-5" strokeWidth={3} aria-hidden="true" /> Moved
              </>
            ) : sending ? (
              "Moving…"
            ) : (
              transferButtonLabel(amountInput.digits)
            )}
          </span>
        </button>
      </div>
    </main>
  );
}
