"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Upload, Loader, Check } from "lucide-react";
import { Portal, Z } from "@/components/overlay";
import { useFinanceStore } from "@/store/useFinanceStore";
import {
  normalizeRupiah,
  matchWallet,
  validateAIOutput,
  findDuplicate,
  type ReceiptData,
} from "@/lib/receipt";

const blankReceipt = (): ReceiptData => ({
  amount: 0,
  isExpense: true,
  date: new Date().toISOString().slice(0, 10),
  merchant: "",
  walletName: "",
  note: "",
  confidence: {},
});

export default function ScanPage() {
  const router = useRouter();
  const pockets = useFinanceStore((s) => s.pockets);
  const transactions = useFinanceStore((s) => s.transactions);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const updatePocketBalance = useFinanceStore((s) => s.updatePocketBalance);

  const [mounted, setMounted] = useState(false);
  const [image, setImage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [aiOk, setAiOk] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");
  const [edited, setEdited] = useState<ReceiptData | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    setError("");

    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const canvas = document.createElement("canvas");
      const scale = Math.min(1, 600 / Math.max(img.width, img.height));
      canvas.width = Math.round(img.width * scale);
      canvas.height = Math.round(img.height * scale);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setError("Could not process image.");
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.68);
      setImage(dataUrl);
      scan(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      const isHeic = file.type.includes("heic") || file.name.toLowerCase().endsWith(".heic");
      if (isHeic) {
        setError("HEIC format is not supported by your browser. Please take a screenshot or use JPG.");
      } else {
        setError("Could not read image.");
      }
    };
    img.src = url;
  };

  const scan = async (dataUrl: string) => {
    setLoading(true);
    setAiOk(false);
    setEdited(blankReceipt());
    try {
      const res = await fetch("/api/scan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image: dataUrl }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data?.error || `Scan failed (${res.status})`);
        return;
      }
      const valid = validateAIOutput(data);
      if (!valid) {
        setError("AI returned invalid format. Please fill it in below.");
        return;
      }
      const pocketName = matchWallet(valid.merchant, pockets.map((p) => p.name));
      if (pocketName) valid.walletName = pocketName;
      setEdited(valid);
      setAiOk(true);
      setError("");
    } catch {
      setError("Network error. Check your connection.");
    }
    setLoading(false);
  };

  const save = () => {
    if (!edited) return;
    if (!edited.merchant.trim() || edited.amount <= 0) {
      setError("Amount and merchant are required.");
      return;
    }
    const pocket = pockets.find((p) => p.name === edited.walletName);
    if (!pocket) {
      setError("Select a valid wallet.");
      return;
    }
    if (findDuplicate(transactions, { ...edited, pocketId: pocket.id })) {
      setError("This transaction already exists.");
      return;
    }
    const txn = {
      id: `txn-${Date.now()}`,
      name: edited.merchant.trim(),
      category: "Other",
      amount: edited.amount,
      isExpense: edited.isExpense,
      pocketId: pocket.id,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      date: edited.date,
      note: edited.note.trim() || undefined,
      image: image || undefined,
    };
    addTransaction(txn);
    updatePocketBalance(
      pocket.id,
      edited.isExpense ? pocket.balance - edited.amount : pocket.balance + edited.amount
    );
    setSaved(true);
    setTimeout(() => router.push("/"), 900);
  };

  const set = (patch: Partial<ReceiptData>) =>
    setEdited((prev) => (prev ? { ...prev, ...patch } : prev));

  return (
    <motion.main
      className="relative min-h-screen bg-background text-foreground pb-28 px-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >
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
            <h1 className="text-2xl font-bold tracking-tight text-white">Scan Receipt</h1>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1">
              Auto-fill form
            </p>
          </div>
        </div>
        <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
      </header>

      <section className="relative mb-6">
        {!image && (
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full p-8 rounded-2xl border-2 border-dashed border-white/20 flex flex-col items-center gap-3 hover:border-white/40 transition"
          >
            <Upload className="w-8 h-8 text-white/40" />
            <span className="text-sm font-semibold text-white/60">Tap to select receipt</span>
          </button>
        )}
        {image && edited && (
          <div className="space-y-4">
            <div className="relative">
              <img src={image} alt="Receipt" className="w-full max-h-64 object-contain rounded-xl border border-white/10" />
          {loading && (
            <div className="absolute inset-0 rounded-xl bg-black/60 backdrop-blur-[1px] flex flex-col items-center justify-center gap-2">
              <Loader className="w-5 h-5 animate-spin text-blue-400" />
              <span className="text-xs font-semibold text-white/80">Analyzing receipt…</span>
              <div className="w-24 h-1 rounded-full bg-white/10 overflow-hidden mt-1">
                <motion.div
                  className="h-full bg-blue-500"
                  initial={{ x: "-100%" }}
                  animate={{ x: "100%" }}
                  transition={{ repeat: Infinity, duration: 0.5, ease: "linear" }}
                />
              </div>
            </div>
          )}
            </div>
            <p className="text-xs text-white/40">
              {loading ? "Reading… you can edit while we wait." : aiOk ? "Review the details, then save." : "We couldn't read it — fill it in manually."}
            </p>
            <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
              <div className="flex rounded-xl bg-black/30 p-1">
                {(["expense", "income"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => set({ isExpense: mode === "expense" })}
                    className={
                      "flex-1 py-2 rounded-lg text-xs font-semibold transition " +
                      (edited.isExpense === (mode === "expense")
                        ? mode === "expense"
                          ? "bg-red-500/15 text-red-300 border border-red-500/30"
                          : "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                        : "text-white/50 border border-transparent")
                    }
                  >
                    {mode === "expense" ? "Expense" : "Income"}
                  </button>
                ))}
              </div>
              <div>
                <label className="text-xs font-semibold text-white/40 uppercase">Amount</label>
                <input
                  type="text"
                  inputMode="numeric"
                  value={edited.amount ? new Intl.NumberFormat("id-ID").format(edited.amount) : ""}
                  onChange={(e) => set({ amount: normalizeRupiah(e.target.value) })}
                  placeholder="0"
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/40 uppercase">Merchant / name</label>
                <input
                  type="text"
                  value={edited.merchant}
                  onChange={(e) => set({ merchant: e.target.value })}
                  placeholder="e.g. ShopeePay, Grab, BCA Transfer"
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/40 uppercase">Wallet</label>
                <select
                  value={edited.walletName}
                  onChange={(e) => set({ walletName: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white mt-1"
                >
                  <option value="">Select wallet</option>
                  {pockets.map((p) => (
                    <option key={p.id} value={p.name}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="text-xs font-semibold text-white/40 uppercase">Date</label>
                <input
                  type="date"
                  value={edited.date}
                  onChange={(e) => set({ date: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white mt-1"
                />
              </div>
              <div>
                <label className="text-xs font-semibold text-white/40 uppercase">Notes</label>
                <textarea
                  value={edited.note}
                  onChange={(e) => set({ note: e.target.value })}
                  placeholder="Optional"
                  className="w-full bg-white/5 border border-white/10 rounded-lg p-2 text-white mt-1 min-h-16"
                />
              </div>
            </div>
            <button
              onClick={save}
              disabled={loading || saved}
              className="w-full h-12 rounded-full bg-blue-600 text-white font-semibold hover:bg-blue-500 transition disabled:opacity-50"
            >
              Save Transaction
            </button>
            <button
              onClick={() => { setImage(""); setEdited(null); setAiOk(false); setError(""); }}
              className="w-full h-12 rounded-full bg-white/5 border border-white/10 text-white/70 font-semibold hover:bg-white/10 transition"
            >
              Discard & scan another
            </button>
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

      {error && (
        <div role="alert" className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-sm">
          {error}
        </div>
      )}

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
                transition={{ type: "spring", stiffness: 200, damping: 20, duration: 0.5 }}
              >
                <motion.div
                  className="w-24 h-24 rounded-full bg-blue-600/12 border border-blue-500/30 flex items-center justify-center"
                  animate={{
                    scale: [1, 1.15, 1],
                    boxShadow: [
                      "0 0 0 0 rgba(59, 130, 246, 0.15)",
                      "0 0 0 20px rgba(59, 130, 246, 0)",
                    ],
                  }}
                  transition={{ duration: 1.2, times: [0, 0.5, 1] }}
                >
                  <motion.div
                    animate={{ scale: [0.8, 1.1, 1], rotate: [0, 10, 0] }}
                    transition={{ duration: 0.6, times: [0, 0.5, 1] }}
                  >
                    <Check className="w-12 h-12 text-blue-400" strokeWidth={2.5} />
                  </motion.div>
                </motion.div>
                <motion.div
                  className="text-center"
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.15, duration: 0.4 }}
                >
                  <motion.h3
                    className="text-2xl font-bold text-foreground tracking-tighter mb-1"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.25, duration: 0.3 }}
                  >
                    Success!
                  </motion.h3>
                  <motion.p
                    className="text-xs font-medium text-white/60"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.35, duration: 0.3 }}
                  >
                    Transaction saved
                  </motion.p>
                </motion.div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </Portal>
    </motion.main>
  );
}
