"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Upload,
  Loader,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  X,
  AlertTriangle,
  RefreshCw,
  Wallet,
  Coins,
  Smartphone,
  Building,
  LayoutGrid,
  Coffee,
  ShoppingBag,
  Zap,
  Receipt,
  Home,
  Clock,
  Calendar as CalendarIcon,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Portal, Overlay, GrabHandle, Z } from "@/components/overlay";
import { useFinanceStore } from "@/store/useFinanceStore";
import { getSystemDate, getSystemTime } from "@/lib/date";
import { EXPENSE_CATEGORIES, type CategoryDef } from "@/lib/categories";
import { overshootMessage, budgetAlertKeys, currentPeriod } from "@/lib/budget";
import { isoDay, monthGrid, monthYearLabel } from "@/lib/history";
import {
  matchWallet,
  findDuplicate,
  hashBlob,
  getCachedScan,
  setCachedScan,
  isScanResultUsable,
  lookupMerchantCategory,
  saveMerchantCategory,
  type ScanResult,
} from "@/lib/receipt";

/* ── Category list (expense + income) ── */
const EXPENSE_CATS: CategoryDef[] = EXPENSE_CATEGORIES;
const INCOME_CATS: CategoryDef[] = [
  { id: "Salary", label: "Salary", icon: Building },
  { id: "Other", label: "Other", icon: LayoutGrid },
];

const ICON_MAP: Record<string, React.ElementType> = {
  Building,
  Smartphone,
  Wallet,
  Coins,
  LayoutGrid,
  Coffee,
  ShoppingBag,
  Zap,
  Receipt,
  Home,
};

const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

/* ── Progress status messages ── */
const STATUS_MESSAGES = [
  "Preparing image…",
  "Reading receipt…",
  "Almost done…",
] as const;

/* ── Form state ── */
interface FormState {
  isExpense: boolean;
  amount: string; // raw digits
  merchant: string;
  walletId: string;
  categoryId: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  notes: string;
}

function defaultForm(): FormState {
  return {
    isExpense: true,
    amount: "",
    merchant: "",
    walletId: "",
    categoryId: "Other",
    date: getSystemDate(),
    time: getSystemTime(),
    notes: "",
  };
}

export default function ScanPage() {
  /* ── 1. All hooks unconditionally called at the top ── */
  const router = useRouter();
  const pockets = useFinanceStore((s) => s.pockets);
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updatePocketBalance = useFinanceStore((s) => s.updatePocketBalance);
  const budgets = useFinanceStore((s) => s.budgets);
  const addBudgetAlert = useFinanceStore((s) => s.addBudgetAlert);

  // Hydration state
  const [mounted, setMounted] = useState(false);

  // Image state
  const [previewUrl, setPreviewUrl] = useState("");
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);

  // Scan status
  const [loading, setLoading] = useState(false);
  const [statusIndex, setStatusIndex] = useState(0);
  const [scanDone, setScanDone] = useState(false);
  const [error, setError] = useState("");

  // Form state
  const [form, setForm] = useState<FormState>(defaultForm);
  const [touchedFields, setTouchedFields] = useState<Set<keyof FormState>>(new Set());
  const [warnings, setWarnings] = useState<Set<keyof FormState>>(new Set());

  // Overlays
  const [walletOpen, setWalletOpen] = useState(false);
  const [catOpen, setCatOpen] = useState(false);
  const [dateOpen, setDateOpen] = useState(false);

  // Calendar month view
  const [calYear, setCalYear] = useState(() => new Date().getFullYear());
  const [calMonth, setCalMonth] = useState(() => new Date().getMonth());

  // Saved state
  const [saved, setSaved] = useState(false);

  // Refs for stable callback access without stale closures
  const fileRef = useRef<HTMLInputElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const scanningRef = useRef(false);
  const touchedFieldsRef = useRef<Set<keyof FormState>>(new Set());

  // Keep touchedFieldsRef in sync
  useEffect(() => {
    touchedFieldsRef.current = touchedFields;
  }, [touchedFields]);

  // Mount effect
  useEffect(() => {
    setMounted(true);
  }, []);

  // Cleanup effect
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ── Form patch helper ── */
  const patch = useCallback(
    (updates: Partial<FormState>, markTouched?: (keyof FormState)[]) => {
      setForm((prev) => ({ ...prev, ...updates }));
      if (markTouched && markTouched.length > 0) {
        setTouchedFields((prev) => {
          const next = new Set(prev);
          for (const k of markTouched) next.add(k);
          touchedFieldsRef.current = next;
          return next;
        });
      }
    },
    []
  );

  /* ── Apply scan result to form (guaranteed stable callback) ── */
  const applyScanResult = useCallback(
    (result: ScanResult) => {
      setForm((prevForm) => {
        const next = { ...prevForm };
        const touched = touchedFieldsRef.current;

        // 1. Expense/Income
        if (!touched.has("isExpense") && result.type) {
          next.isExpense = result.type === "expense";
        }

        // 2. Amount (pure integer IDR)
        if (!touched.has("amount") && result.amount > 0) {
          next.amount = String(result.amount);
        }

        // 3. Merchant / Name
        if (!touched.has("merchant") && result.purpose) {
          next.merchant = result.purpose;
        }

        // 4. Date
        if (!touched.has("date") && result.date) {
          next.date = result.date;
        }

        // 5. Time
        if (!touched.has("time") && result.time) {
          next.time = result.time;
        }

        // 6. Reference note
        if (!touched.has("notes") && result.reference) {
          next.notes = `Ref: ${result.reference}`;
        }

        // 7. Wallet matching
        if (!touched.has("walletId") && result.sourceWallet) {
          const matched = matchWallet(
            result.sourceWallet,
            pockets.map((p) => p.name)
          );
          if (matched) {
            const pocket = pockets.find((p) => p.name === matched);
            if (pocket) next.walletId = pocket.id;
          }
        }

        // 8. Category: merchant learning or default "Other"
        if (!touched.has("categoryId")) {
          const isExpense =
            result.type === "expense" || (!result.type && prevForm.isExpense);
          const cats = isExpense ? EXPENSE_CATS : INCOME_CATS;

          let categoryToSet = "Other";
          if (result.purpose) {
            const learned = lookupMerchantCategory(result.purpose);
            if (learned && cats.some((c) => c.id === learned)) {
              categoryToSet = learned;
            }
          }
          if (cats.some((c) => c.id === categoryToSet)) {
            next.categoryId = categoryToSet;
          } else if (cats[0]) {
            next.categoryId = cats[0].id;
          }
        }

        return next;
      });

      // Low confidence warnings
      const w = new Set<keyof FormState>();
      if (!result.date) w.add("date");
      if (!result.time) w.add("time");
      if (result.amount <= 0) w.add("amount");
      if (result.confidence?.amount !== undefined && result.confidence.amount < 0.7) {
        w.add("amount");
      }
      setWarnings(w);
    },
    [pockets]
  );

  /* ── Compress image ── */
  const compressImage = useCallback(async (file: File): Promise<Blob | null> => {
    return new Promise((resolve) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        const maxSide = 1280;
        const scale = Math.min(1, maxSide / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement("canvas");
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext("2d");
        if (!ctx) {
          resolve(null);
          return;
        }
        ctx.drawImage(img, 0, 0, w, h);
        canvas.toBlob(
          (blob) => {
            resolve(blob);
          },
          "image/jpeg",
          0.75
        );
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        resolve(null);
      };
      img.src = url;
    });
  }, []);

  /* ── Scan API execution ── */
  const scan = useCallback(
    async (blob: Blob) => {
      if (scanningRef.current) return;
      scanningRef.current = true;
      setStatusIndex(0);

      const statusTimer = setInterval(() => {
        setStatusIndex((prev) => Math.min(prev + 1, STATUS_MESSAGES.length - 1));
      }, 1500);

      try {
        // Cache lookup first
        const imgHash = await hashBlob(blob);
        const cached = getCachedScan(imgHash);
        if (cached && isScanResultUsable(cached)) {
          applyScanResult(cached);
          setScanDone(true);
          setLoading(false);
          clearInterval(statusTimer);
          scanningRef.current = false;
          return;
        }

        const controller = new AbortController();
        abortRef.current = controller;
        const timeoutId = setTimeout(() => controller.abort(), 12000);

        setStatusIndex(1);

        const formData = new FormData();
        formData.append("image", blob, "receipt.jpg");

        const res = await fetch("/api/scan", {
          method: "POST",
          body: formData,
          signal: controller.signal,
        });

        clearTimeout(timeoutId);
        const data = await res.json();

        if (!res.ok) {
          // Retry once on 429 or 5xx
          if ((res.status === 429 || res.status >= 500) && !controller.signal.aborted) {
            await new Promise((r) => setTimeout(r, 1000));
            const retryFormData = new FormData();
            retryFormData.append("image", blob, "receipt.jpg");
            const retry = await fetch("/api/scan", {
              method: "POST",
              body: retryFormData,
              signal: controller.signal,
            });
            const retryData = await retry.json();
            if (retry.ok && isScanResultUsable(retryData)) {
              setCachedScan(imgHash, retryData as ScanResult);
              applyScanResult(retryData as ScanResult);
              setScanDone(true);
              setError("");
              setLoading(false);
              clearInterval(statusTimer);
              scanningRef.current = false;
              return;
            }
            setError(
              retryData.error ||
                data.error ||
                "We couldn't read this receipt. Please fill in the details manually."
            );
          } else {
            setError(
              data.error ||
                "We couldn't read this receipt. Please fill in the details manually."
            );
          }
          setLoading(false);
          clearInterval(statusTimer);
          scanningRef.current = false;
          return;
        }

        if (isScanResultUsable(data)) {
          setCachedScan(imgHash, data as ScanResult);
          applyScanResult(data as ScanResult);
          setScanDone(true);
          setError("");
        } else {
          setError(
            "We couldn't read the receipt details clearly. Please fill in the details manually."
          );
          setScanDone(false);
        }
        setLoading(false);
      } catch (e) {
        if (e instanceof Error && e.name === "AbortError") {
          // User or timeout aborted
        } else {
          setError("Network issue. Please check your connection and try again.");
        }
        setLoading(false);
      } finally {
        clearInterval(statusTimer);
        scanningRef.current = false;
      }
    },
    [applyScanResult]
  );

  /* ── File selection handler ── */
  const handleFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;

      abortRef.current?.abort();
      setError("");
      setScanDone(false);
      setForm(defaultForm());
      touchedFieldsRef.current = new Set();
      setTouchedFields(new Set());
      setWarnings(new Set());

      let sourceFile = file;
      const isHeic =
        file.type.includes("heic") ||
        file.type.includes("heif") ||
        file.name.toLowerCase().endsWith(".heic") ||
        file.name.toLowerCase().endsWith(".heif");

      if (isHeic) {
        try {
          const heic2any = (await import("heic2any")).default;
          const result = await heic2any({
            blob: file,
            toType: "image/jpeg",
            quality: 0.75,
          });
          sourceFile = new File(
            [Array.isArray(result) ? result[0] : result],
            file.name.replace(/\.hei[cf]$/i, ".jpg"),
            { type: "image/jpeg" }
          );
        } catch {
          setError("Could not process HEIC image. Please use a JPG or PNG.");
          return;
        }
      }

      const rawPreview = URL.createObjectURL(sourceFile);
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      setPreviewUrl(rawPreview);

      setLoading(true);
      setStatusIndex(0);

      try {
        const compressed = await compressImage(sourceFile);
        if (!compressed) {
          setError("Could not process image.");
          setLoading(false);
          return;
        }
        setImageBlob(compressed);
        await scan(compressed);
      } catch {
        setError("Could not process image.");
        setLoading(false);
      }
    },
    [previewUrl, compressImage, scan]
  );

  /* ── Retry handler ── */
  const handleRetry = useCallback(async () => {
    if (!imageBlob) return;
    setError("");
    setScanDone(false);
    setLoading(true);
    setForm(defaultForm());
    touchedFieldsRef.current = new Set();
    setTouchedFields(new Set());
    setWarnings(new Set());
    await scan(imageBlob);
  }, [imageBlob, scan]);

  /* ── Discard handler ── */
  const handleDiscard = useCallback(() => {
    abortRef.current?.abort();
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl("");
    setImageBlob(null);
    setLoading(false);
    setScanDone(false);
    setError("");
    setForm(defaultForm());
    touchedFieldsRef.current = new Set();
    setTouchedFields(new Set());
    setWarnings(new Set());
    if (fileRef.current) fileRef.current.value = "";
  }, [previewUrl]);

  /* ── Open custom calendar ── */
  const handleOpenDate = useCallback(() => {
    if (form.date) {
      const parts = form.date.split("-").map(Number);
      if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1])) {
        setCalYear(parts[0]);
        setCalMonth(parts[1] - 1);
      }
    }
    setDateOpen(true);
  }, [form.date]);

  /* ── Shift month in calendar ── */
  const shiftCalMonth = useCallback((delta: number) => {
    setCalMonth((prev) => {
      let nextMonth = prev + delta;
      let nextYear = calYear;
      if (nextMonth > 11) {
        nextMonth = 0;
        nextYear += 1;
      } else if (nextMonth < 0) {
        nextMonth = 11;
        nextYear -= 1;
      }
      setCalYear(nextYear);
      return nextMonth;
    });
  }, [calYear]);

  /* ── Save handler ── */
  const handleSave = useCallback(() => {
    const amount = parseInt(form.amount, 10) || 0;
    if (amount <= 0) {
      setError("Please enter a valid amount.");
      return;
    }
    if (!form.merchant.trim()) {
      setError("Please enter a merchant or description.");
      return;
    }

    const pocket = pockets.find((p) => p.id === form.walletId) ?? pockets[0];
    if (!pocket) {
      setError("Please select a wallet.");
      return;
    }

    if (
      findDuplicate(transactions, {
        amount,
        date: form.date,
        isExpense: form.isExpense,
        pocketId: pocket.id,
      })
    ) {
      setError("A similar transaction already exists for this date and wallet.");
      return;
    }

    // Learn category for merchant
    if (form.merchant.trim() && form.categoryId) {
      saveMerchantCategory(form.merchant, form.categoryId);
    }

    const txn = {
      id: `txn-${Date.now()}`,
      name: form.merchant.trim(),
      category: form.categoryId || "Other",
      amount,
      isExpense: form.isExpense,
      pocketId: pocket.id,
      time: form.time || getSystemTime(),
      date: form.date || getSystemDate(),
      note: form.notes.trim() || undefined,
      image: previewUrl || undefined,
    };

    addTransaction(txn);
    updatePocketBalance(
      pocket.id,
      form.isExpense ? pocket.balance - amount : pocket.balance + amount
    );

    // Budget checks
    if (form.isExpense) {
      try {
        const txns = useFinanceStore.getState().transactions;
        const msg = overshootMessage(
          budgets,
          txns,
          [...txns, txn],
          form.categoryId,
          currentPeriod()
        );
        if (msg) {
          /* budget overshoot handled via notification alerts */
        }
        const keys = budgetAlertKeys(budgets, [...txns, txn], currentPeriod());
        for (const k of keys) addBudgetAlert(k);
      } catch {
        /* ignore */
      }
    }

    setSaved(true);
    setTimeout(() => {
      router.push("/");
    }, 900);
  }, [
    form,
    pockets,
    transactions,
    previewUrl,
    budgets,
    addTransaction,
    updatePocketBalance,
    addBudgetAlert,
    router,
  ]);

  /* ── 2. Guard against hydration mismatch (AFTER all hooks have executed) ── */
  if (!mounted) {
    return null;
  }

  /* ── 3. Derived variables for UI ── */
  const catsForType = form.isExpense ? EXPENSE_CATS : INCOME_CATS;
  const selectedCat =
    catsForType.find((c) => c.id === form.categoryId) ??
    catsForType.find((c) => c.id === "Other") ??
    catsForType[0];

  const selectedPocket = pockets.find((p) => p.id === form.walletId) ?? null;
  const hasImage = previewUrl.length > 0;
  const canSave =
    (parseInt(form.amount, 10) || 0) > 0 &&
    form.merchant.trim().length > 0 &&
    !!selectedPocket;

  const formattedAmount = form.amount
    ? new Intl.NumberFormat("id-ID").format(parseInt(form.amount, 10) || 0)
    : "";

  const calendarDays = monthGrid(calYear, calMonth);

  return (
    <motion.main
      className="relative min-h-screen bg-background text-foreground pb-28 px-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
      {/* Header */}
      <header className="relative mb-6">
        <div className="flex items-center gap-3 mb-4">
          <Link
            href="/transaksi"
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 transition"
            aria-label="Back to Add"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-white">
              Scan Receipt
            </h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1">
              Auto-fill from photo
            </p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
      </header>

      {/* Upload area */}
      <section className="relative mb-6">
        {!hasImage && (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="w-full p-8 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center gap-3 hover:border-white/40 transition active:scale-[0.98] focus:outline-none"
          >
            <div className="w-12 h-12 rounded-full bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
              <Upload className="w-6 h-6 text-blue-400" />
            </div>
            <div className="text-center">
              <span className="text-sm font-semibold text-white/80 block">
                Tap to upload receipt
              </span>
              <span className="text-[11px] text-white/40 mt-0.5 block">
                ShopeePay, BCA, DANA, GoPay screenshots (JPG, PNG, HEIC)
              </span>
            </div>
          </button>
        )}

        {hasImage && (
          <div className="space-y-4">
            {/* Image preview & progress overlay */}
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-black/40">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewUrl}
                alt="Receipt"
                className="w-full max-h-64 object-contain"
              />
              {loading && (
                <div className="absolute inset-0 bg-black/70 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-4 text-center">
                  <Loader className="w-6 h-6 animate-spin text-blue-400" />
                  <span className="text-xs font-semibold text-white/90">
                    {STATUS_MESSAGES[statusIndex]}
                  </span>
                  <div className="w-32 h-1.5 rounded-full bg-white/10 overflow-hidden mt-1">
                    <motion.div
                      className="h-full bg-blue-500 rounded-full"
                      initial={{ x: "-100%" }}
                      animate={{ x: "100%" }}
                      transition={{
                        repeat: Infinity,
                        duration: 1.2,
                        ease: "easeInOut",
                      }}
                    />
                  </div>
                  <span className="text-[11px] text-white/40 mt-1">
                    You can start editing below while scanning
                  </span>
                </div>
              )}
            </div>

            {/* Status note */}
            <div className="flex items-center justify-between text-xs text-white/50 px-1">
              <span>
                {loading
                  ? "Scanning receipt…"
                  : scanDone
                  ? "Receipt read. Review and tap Save."
                  : "Fill in manually or tap Try again."}
              </span>
              {hasImage && (
                <button
                  type="button"
                  onClick={handleDiscard}
                  className="text-white/40 hover:text-white/70 transition text-[11px]"
                >
                  Change photo
                </button>
              )}
            </div>

            {/* Confirmation Card */}
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-4">
              {/* Expense / Income selector */}
              <div className="flex rounded-xl bg-black/30 p-1">
                {(["expense", "income"] as const).map((mode) => {
                  const isCur = form.isExpense === (mode === "expense");
                  return (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => {
                        const isExp = mode === "expense";
                        patch(
                          {
                            isExpense: isExp,
                            categoryId: touchedFields.has("categoryId")
                              ? form.categoryId
                              : "Other",
                          },
                          ["isExpense"]
                        );
                      }}
                      className={cn(
                        "flex-1 py-2 rounded-lg text-xs font-semibold transition",
                        isCur
                          ? mode === "expense"
                            ? "bg-red-500/15 text-red-300 border border-red-500/30"
                            : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                          : "text-white/50 border border-transparent hover:text-white/70"
                      )}
                    >
                      {mode === "expense" ? "Expense" : "Income"}
                    </button>
                  );
                })}
              </div>

              {/* Amount */}
              <div>
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between">
                  <span>Amount</span>
                  {warnings.has("amount") && (
                    <span className="text-amber-400 text-[10px] normal-case font-normal flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Please check
                    </span>
                  )}
                </label>
                <div className="relative mt-1">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/40 text-sm font-medium">
                    Rp
                  </span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={formattedAmount}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/\D/g, "");
                      patch({ amount: raw }, ["amount"]);
                    }}
                    placeholder="0"
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-11 pr-3 py-2.5 text-white font-medium text-base focus:outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Merchant / Purpose */}
              <div>
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block">
                  Merchant / Name
                </label>
                <input
                  type="text"
                  value={form.merchant}
                  onChange={(e) =>
                    patch({ merchant: e.target.value }, ["merchant"])
                  }
                  placeholder="e.g. COSAN COFFEE SETURAN"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-sm mt-1 focus:outline-none focus:border-blue-500/50"
                />
              </div>

              {/* Wallet Picker */}
              <div>
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block">
                  Wallet
                </label>
                <button
                  type="button"
                  onClick={() => setWalletOpen(true)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 mt-1 flex items-center justify-between text-left min-h-[44px] hover:bg-white/10 transition"
                >
                  {selectedPocket ? (
                    <div className="flex items-center gap-2.5">
                      {(() => {
                        const Icon = ICON_MAP[selectedPocket.iconName] || Wallet;
                        return <Icon className="w-4 h-4 text-blue-400 shrink-0" />;
                      })()}
                      <span className="text-white text-sm font-medium">
                        {selectedPocket.name}
                      </span>
                    </div>
                  ) : (
                    <span className="text-white/40 text-sm">Select wallet</span>
                  )}
                  <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                </button>
              </div>

              {/* Category Picker */}
              <div>
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block">
                  Category
                </label>
                <button
                  type="button"
                  onClick={() => setCatOpen(true)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 mt-1 flex items-center justify-between text-left min-h-[44px] hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-2.5">
                    {(() => {
                      const Icon = selectedCat.icon;
                      return <Icon className="w-4 h-4 text-blue-400 shrink-0" />;
                    })()}
                    <span className="text-white text-sm font-medium">
                      {selectedCat.label}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                </button>
              </div>

              {/* Date & Time Picker */}
              <div>
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center justify-between">
                  <span>Date & Time</span>
                  {(warnings.has("date") || warnings.has("time")) && (
                    <span className="text-amber-400 text-[10px] normal-case font-normal flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3" /> Please check
                    </span>
                  )}
                </label>
                <button
                  type="button"
                  onClick={handleOpenDate}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 mt-1 flex items-center justify-between text-left min-h-[44px] hover:bg-white/10 transition"
                >
                  <div className="flex items-center gap-2.5">
                    <CalendarIcon className="w-4 h-4 text-blue-400 shrink-0" />
                    <span className="text-white text-sm font-medium">
                      {form.date
                        ? new Date(form.date + "T00:00:00").toLocaleDateString(
                            "en-US",
                            {
                              weekday: "short",
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                            }
                          )
                        : "Select date"}
                      {form.time ? ` · ${form.time}` : ""}
                    </span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-white/40 shrink-0" />
                </button>
              </div>

              {/* Notes */}
              <div>
                <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider block">
                  Notes
                </label>
                <textarea
                  value={form.notes}
                  onChange={(e) =>
                    patch({ notes: e.target.value }, ["notes"])
                  }
                  placeholder="Optional reference or note"
                  rows={2}
                  className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-white text-sm mt-1 resize-none focus:outline-none focus:border-blue-500/50"
                />
              </div>
            </div>

            {/* Error display */}
            {error && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs flex items-center gap-2"
              >
                <AlertTriangle className="w-4 h-4 shrink-0 text-red-400" />
                <span>{error}</span>
              </div>
            )}

            {/* Action buttons */}
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saved || !canSave}
              className="w-full h-12 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-500 transition disabled:opacity-40 active:scale-[0.98] shadow-lg shadow-blue-600/20"
            >
              Save Transaction
            </button>

            <div className="flex gap-2">
              {error && (
                <button
                  type="button"
                  onClick={handleRetry}
                  disabled={loading}
                  className="flex-1 h-11 rounded-full bg-white/5 border border-white/10 text-white/80 text-xs font-semibold hover:bg-white/10 transition flex items-center justify-center gap-2 active:scale-[0.98]"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  Try again
                </button>
              )}
              <button
                type="button"
                onClick={handleDiscard}
                className={cn(
                  "h-11 rounded-full bg-white/5 border border-white/10 text-white/60 text-xs font-semibold hover:bg-white/10 transition active:scale-[0.98]",
                  error ? "flex-1" : "w-full"
                )}
              >
                Discard
              </button>
            </div>
          </div>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />
      </section>

      {/* ── Custom Wallet Picker Overlay ── */}
      <Overlay
        open={walletOpen}
        onClose={() => setWalletOpen(false)}
        z={Z.sheet}
        label="Select wallet"
      >
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
        <div
          className="overflow-y-auto px-4 pb-6 flex flex-col gap-1 max-h-[60vh]"
          role="listbox"
          aria-label="Wallets"
        >
          {pockets.map((p) => {
            const Icon = ICON_MAP[p.iconName] || Wallet;
            const active = form.walletId === p.id;
            return (
              <button
                key={p.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  patch({ walletId: p.id }, ["walletId"]);
                  setWalletOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-left min-h-[52px] w-full",
                  active ? "bg-blue-600/15 border border-blue-500/30" : "hover:bg-white/5 border border-transparent"
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0",
                    active
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                      : "bg-white/5 border-white/5 text-white/60"
                  )}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <div className="flex-1 min-w-0">
                  <span
                    className={cn(
                      "text-sm font-medium block",
                      active ? "text-white" : "text-white/80"
                    )}
                  >
                    {p.name}
                  </span>
                  <span className="text-[11px] text-white/40">
                    Rp {p.balance.toLocaleString("id-ID")}
                  </span>
                </div>
                {active && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </Overlay>

      {/* ── Custom Category Picker Overlay ── */}
      <Overlay
        open={catOpen}
        onClose={() => setCatOpen(false)}
        z={Z.sheet}
        label="Select category"
      >
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-white">Select Category</h3>
          <button
            type="button"
            onClick={() => setCatOpen(false)}
            aria-label="Close category picker"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div
          className="overflow-y-auto px-4 pb-6 flex flex-col gap-1 max-h-[60vh]"
          role="listbox"
          aria-label="Categories"
        >
          {catsForType.map((c) => {
            const Icon = c.icon;
            const active = form.categoryId === c.id;
            return (
              <button
                key={c.id}
                type="button"
                role="option"
                aria-selected={active}
                onClick={() => {
                  patch({ categoryId: c.id }, ["categoryId"]);
                  setCatOpen(false);
                }}
                className={cn(
                  "flex items-center gap-3 px-3.5 py-3 rounded-xl transition-all text-left min-h-[52px] w-full",
                  active ? "bg-blue-600/15 border border-blue-500/30" : "hover:bg-white/5 border border-transparent"
                )}
              >
                <div
                  className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0",
                    active
                      ? "bg-blue-500/20 border-blue-500/40 text-blue-400"
                      : "bg-white/5 border-white/5 text-white/60"
                  )}
                >
                  <Icon className="w-4 h-4" strokeWidth={2} />
                </div>
                <span
                  className={cn(
                    "text-sm font-medium flex-1 text-left",
                    active ? "text-white" : "text-white/80"
                  )}
                >
                  {c.label}
                </span>
                {active && <Check className="w-4 h-4 text-blue-400 shrink-0" />}
              </button>
            );
          })}
        </div>
      </Overlay>

      {/* ── Custom Date & Time Picker Overlay (NO native date/time or select inputs) ── */}
      <Overlay
        open={dateOpen}
        onClose={() => setDateOpen(false)}
        z={Z.sheet}
        label="Select date and time"
      >
        <GrabHandle />
        <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
          <h3 className="text-base font-semibold text-white">Date & Time</h3>
          <button
            type="button"
            onClick={() => setDateOpen(false)}
            aria-label="Close date picker"
            className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-6 space-y-4 max-h-[70vh]">
          {/* Calendar Month Navigation */}
          <div className="flex items-center justify-between">
            <button
              type="button"
              onClick={() => shiftCalMonth(-1)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
              aria-label="Previous month"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-sm font-semibold text-white">
              {monthYearLabel(calYear, calMonth)}
            </span>
            <button
              type="button"
              onClick={() => shiftCalMonth(1)}
              className="w-8 h-8 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-white/70 hover:text-white transition"
              aria-label="Next month"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* Weekday headers */}
          <div className="grid grid-cols-7 gap-1 text-center">
            {WEEKDAYS.map((w) => (
              <span
                key={w}
                className="text-[11px] font-semibold text-white/40 py-1"
              >
                {w}
              </span>
            ))}
          </div>

          {/* Days Grid */}
          <div className="grid grid-cols-7 gap-1">
            {calendarDays.map((d, idx) => {
              const dayIso = isoDay(d);
              const isSelected = form.date === dayIso;
              const isCurrentMonth = d.getMonth() === calMonth;
              const isToday = dayIso === getSystemDate();

              return (
                <button
                  key={`${dayIso}-${idx}`}
                  type="button"
                  onClick={() => patch({ date: dayIso }, ["date"])}
                  className={cn(
                    "h-9 rounded-lg text-xs font-medium transition flex items-center justify-center relative",
                    isSelected
                      ? "bg-blue-600 text-white font-semibold"
                      : isCurrentMonth
                      ? "text-white/80 hover:bg-white/10"
                      : "text-white/20 hover:bg-white/5",
                    isToday && !isSelected && "border border-blue-500/40 text-blue-400"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>

          {/* Custom Time Selector (NO native input type="time" or select) */}
          <div className="pt-2 border-t border-white/10">
            <div className="flex items-center justify-between mb-2">
              <label className="text-[11px] font-semibold text-white/50 uppercase tracking-wider flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-blue-400" />
                Time (HH:mm)
              </label>
              <button
                type="button"
                onClick={() => patch({ time: getSystemTime() }, ["time"])}
                className="text-[11px] text-blue-400 font-medium hover:underline"
              >
                Set to current time
              </button>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="text"
                maxLength={5}
                value={form.time}
                onChange={(e) => {
                  let v = e.target.value.replace(/[^0-9:]/g, "");
                  if (v.length === 2 && !v.includes(":") && e.target.value.length > form.time.length) {
                    v = `${v}:`;
                  }
                  patch({ time: v }, ["time"]);
                }}
                placeholder="14:30"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 text-white font-mono text-center text-sm focus:outline-none focus:border-blue-500/50"
              />
            </div>
          </div>

          <button
            type="button"
            onClick={() => setDateOpen(false)}
            className="w-full py-3 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 transition active:scale-[0.98]"
          >
            Done
          </button>
        </div>
      </Overlay>

      {/* ── Success Celebration Overlay ── */}
      <Portal>
        <AnimatePresence>
          {saved && (
            <motion.div
              className="fixed inset-0 isolate flex items-center justify-center bg-black/80"
              style={{ zIndex: Z.modal }}
              role="status"
              aria-label="Transaction saved"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <motion.div
                className="flex flex-col items-center gap-4"
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 20,
                  duration: 0.5,
                }}
              >
                <motion.div
                  className="w-24 h-24 rounded-full bg-blue-600/15 border border-blue-500/40 flex items-center justify-center shadow-2xl shadow-blue-500/20"
                  animate={{
                    scale: [1, 1.15, 1],
                  }}
                  transition={{ duration: 1.2, times: [0, 0.5, 1] }}
                >
                  <motion.div
                    animate={{ scale: [0.8, 1.1, 1], rotate: [0, 10, 0] }}
                    transition={{ duration: 0.6, times: [0, 0.5, 1] }}
                  >
                    <Check
                      className="w-12 h-12 text-blue-400"
                      strokeWidth={2.5}
                    />
                  </motion.div>
                </motion.div>
                <div className="text-center">
                  <h3 className="text-2xl font-bold text-white tracking-tight mb-1">
                    Success!
                  </h3>
                  <p className="text-xs font-medium text-white/60">
                    Transaction saved to history
                  </p>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </motion.main>
  );
}
