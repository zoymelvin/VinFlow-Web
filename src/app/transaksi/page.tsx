"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import Link from "next/link";
import {
  Wallet, Coins, Smartphone, Building, LayoutGrid,
  Coffee, ShoppingBag, Zap, Receipt, Camera, ChevronDown, Check, Home, X, Plus
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useFinanceStore, type Transaction } from "@/store/useFinanceStore";
import { Overlay, Portal, GrabHandle, Z } from "@/components/overlay";
import Money from "@/components/Money";
import Toast from "@/components/Toast";
import { overshootMessage, budgetAlertKeys, currentPeriod } from "@/lib/budget";

const CATS = [
  { id: "makan", label: "Food", icon: Coffee },
  { id: "transport", label: "Transport", icon: Zap },
  { id: "belanja", label: "Shopping", icon: ShoppingBag },
  { id: "kost", label: "Rent", icon: Home },
  { id: "hobi", label: "Hobby", icon: Receipt },
  { id: "kuota", label: "Data Plan", icon: Zap },
  { id: "gaji", label: "Salary", icon: Building },
  { id: "lainnya", label: "Other", icon: LayoutGrid },
];

const ICON_MAP: Record<string, React.ElementType> = {
  Building, Smartphone, Wallet, Coins, LayoutGrid,
  Coffee, ShoppingBag, Zap, Receipt, Home,
};

export default function TransaksiPage() {
  const pockets = useFinanceStore((s) => s.pockets);
  const budgets = useFinanceStore((s) => s.budgets);
  const goals = useFinanceStore((s) => s.goals);
  const goalSavings = useFinanceStore((s) => s.goalSavings);
  const addBudgetAlert = useFinanceStore((s) => s.addBudgetAlert);
  const addTransaction = useFinanceStore((s) => s.addTransaction);
  const addGoalSaving = useFinanceStore((s) => s.addGoalSaving);
  const deleteGoalSaving = useFinanceStore((s) => s.deleteGoalSaving);
  const updatePocketBalance = useFinanceStore((s) => s.updatePocketBalance);
  const updateTransaction = useFinanceStore((s) => s.updateTransaction);

  const [isExpense, setIsExpense] = useState(true);
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [selPocket, setSelPocket] = useState("p2");
  const [selCat, setSelCat] = useState("belanja");
  const [catOpen, setCatOpen] = useState(false);
  const [saved, setSaved] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);
  const [image, setImage] = useState<string | undefined>(undefined);
  const [photoError, setPhotoError] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [allocOpen, setAllocOpen] = useState(false);
  const [allocGoalId, setAllocGoalId] = useState("");
  const [allocRaw, setAllocRaw] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const activeGoals = goals.filter((g) => g.status === "active" || g.status === "paused");

  useEffect(() => {
    setMounted(true);
    const params = new URLSearchParams(window.location.search);
    const id = params.get("edit");
    const catParam = params.get("cat");
    if (catParam) {
      const preset = CATS.find((c) => c.label === catParam);
      if (preset) setSelCat(preset.id);
    }
    if (!id) return;
    const orig = useFinanceStore.getState().transactions.find((t) => t.id === id);
    if (!orig) return;
    setEditId(id);
    setIsExpense(orig.isExpense);
    setAmount(String(Math.round(orig.amount)));
    setNote(orig.note ?? "");
    setSelPocket(orig.pocketId);
    setImage(orig.image);
    const cat = CATS.find((c) => c.label === orig.category);
    if (cat) setSelCat(cat.id);
    const gAlloc = orig.goalAllocation?.[0];
    if (gAlloc) {
      setAllocOpen(true);
      setAllocGoalId(gAlloc.goalId);
      setAllocRaw(String(gAlloc.amount));
    }
  }, []);
  if (!mounted) return null;

  const pocket = pockets.find((p) => p.id === selPocket) || pockets[0];
  const catObj = CATS.find((c) => c.id === selCat) || CATS[1];

  const handleAmount = (val: string) => {
    const raw = val.replace(/\D/g, "");
    setAmount(raw);
  };

  const fmt = (n: number) => <Money value={n} />;

  const incomeAmount = parseInt(amount, 10) || 0;

  const calcAllocAmount = (): number => {
    const income = parseFloat(amount) || 0;
    const alloc = parseInt(allocRaw.replace(/\D/g, ""), 10) || 0;
    if (alloc > income) return income;
    if (allocGoalId) {
      const g = goals.find((x) => x.id === allocGoalId);
      if (g) {
        const saved = goalSavings
          .filter((s) => s.goalId === g.id && s.amount > 0)
          .reduce((sum, s) => sum + s.amount, 0);
        const remaining = Math.max(0, g.target - saved);
        if (alloc > remaining) return remaining;
      }
    }
    return alloc;
  };

  const handleSave = () => {
    const rawAmount = parseFloat(amount) || 0;
    const allocAmount = calcAllocAmount();
    if (!rawAmount || !pocket) return;
    const cleanNote = note.trim();

    if (image) {
      try {
        const probe = "vinflow-quota-probe";
        localStorage.setItem(probe, image);
        localStorage.removeItem(probe);
      } catch {
        setPhotoError("Photo is too large for storage. Remove it, then save.");
        return;
      }
    }

    const txn: Transaction = {
      id: editId || `txn-${Date.now()}`,
      name: cleanNote || "Transaction",
      category: catObj.label,
      amount: rawAmount,
      isExpense,
      pocketId: pocket.id,
      time: new Date().toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
      date: new Date().toLocaleDateString("en-US", { month: "long", day: "numeric" }),
      note: cleanNote || undefined,
      image,
      goalAllocation: !isExpense && allocGoalId && allocAmount > 0 ? [{ goalId: allocGoalId, amount: allocAmount }] : undefined,
    };

    if (editId) {
      const orig = useFinanceStore.getState().transactions.find((t) => t.id === editId);
      if (!orig) return;
      const oldAlloc = orig.goalAllocation?.[0];
      if (oldAlloc) {
        const linked = useFinanceStore.getState().goalSavings.find((s) => s.transactionId === orig.id);
        if (linked) deleteGoalSaving(linked.id);
      }
      updateTransaction(editId, {
        name: cleanNote || "Transaction",
        category: catObj.label,
        amount: rawAmount,
        isExpense,
        pocketId: pocket.id,
        note: cleanNote || undefined,
        image,
        goalAllocation: !isExpense && allocGoalId && allocAmount > 0 ? [{ goalId: allocGoalId, amount: allocAmount }] : undefined,
      });
      if (orig.pocketId === pocket.id) {
        const delta = (orig.isExpense ? orig.amount : -orig.amount) + (isExpense ? -rawAmount : rawAmount);
        if (delta !== 0) updatePocketBalance(pocket.id, pocket.balance + delta);
      } else {
        const oldPocket = pockets.find((p) => p.id === orig.pocketId);
        if (oldPocket) {
          updatePocketBalance(oldPocket.id, oldPocket.balance + (orig.isExpense ? orig.amount : -orig.amount));
        }
        updatePocketBalance(pocket.id, pocket.balance + (isExpense ? -rawAmount : rawAmount));
      }
      if (!isExpense && allocGoalId && allocAmount > 0) {
        addGoalSaving({
          id: `gs-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          goalId: allocGoalId,
          amount: allocAmount,
          pocketId: pocket.id,
          date: new Date().toISOString().slice(0, 10),
          note: `From income: ${cleanNote || "Income"}`,
          transactionId: txn.id,
        });
      }
    } else {
      updatePocketBalance(pocket.id, isExpense ? pocket.balance - rawAmount : pocket.balance + rawAmount);
      addTransaction(txn);
      if (!isExpense && allocGoalId && allocAmount > 0) {
        addGoalSaving({
          id: `gs-${Date.now()}-${Math.floor(Math.random() * 1e6)}`,
          goalId: allocGoalId,
          amount: allocAmount,
          pocketId: pocket.id,
          date: new Date().toISOString().slice(0, 10),
          note: `From income: ${cleanNote || "Income"}`,
          transactionId: txn.id,
        });
      }
    }

    if (isExpense) {
      const before = useFinanceStore.getState().transactions;
      const msg = overshootMessage(budgets, before, [...before, txn], catObj.label, currentPeriod());
      if (msg) setToast(msg);
      const keys = budgetAlertKeys(budgets, [...before, txn], currentPeriod());
      for (const k of keys) addBudgetAlert(k);
    }

    setSaved(true);
    setTimeout(() => { window.location.href = "/"; }, 1500);
  };

  const handlePhoto = (file: File | undefined) => {
    setPhotoError("");
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("File must be an image.");
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      const max = 800;
      const scale = Math.min(1, max / Math.max(img.width, img.height));
      const w = Math.max(1, Math.round(img.width * scale));
      const h = Math.max(1, Math.round(img.height * scale));
      const canvas = document.createElement("canvas");
      canvas.width = w;
      canvas.height = h;
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        setPhotoError("Could not process the photo.");
        return;
      }
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);
      ctx.drawImage(img, 0, 0, w, h);
      const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
      if (dataUrl.length > 400_000) {
        setPhotoError("Photo is still too large. Try another photo.");
        return;
      }
      setImage(dataUrl);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setPhotoError("Photo could not be read.");
    };
    img.src = url;
  };

  return (
    <motion.main
      className="relative min-h-[100dvh] bg-background text-foreground pb-24 overflow-y-auto px-4 pt-4 flex flex-col justify-between"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: "easeOut" }}
    >
      {/* Ambient Mesh */}

      <div className="relative flex-1 flex flex-col gap-4">
        {/* Header */}
        <motion.header
          className="relative animate-fade-in py-1"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.3, ease: "easeOut" }}
        >
          <div className="flex items-start justify-between">
            <div>
              <h1 className="text-2xl font-bold tracking-tight text-foreground leading-none">
                {editId ? "Edit Transaction" : "Add Transaction"}
              </h1>
              <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1 mb-2">
                {editId ? "Edit entry" : "New entry"}
              </p>
            </div>
            {!editId && (
              <Link href="/scan" className="p-2.5 rounded-full bg-blue-600/10 text-blue-400 border border-blue-500/20 hover:bg-blue-600/20 transition-all active:scale-95">
                <Camera className="w-5 h-5" />
              </Link>
            )}
          </div>
          <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
        </motion.header>

        {/* Toggle */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.3, ease: "easeOut" }}
        >
          <div className="flex rounded-2xl glass-card p-1 shadow-card">
            <button
              onClick={() => setIsExpense(true)}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300",
                isExpense
                  ? "bg-[#FF453A]/12 text-[#FF453A] border border-[#FF453A]/30"
                  : "text-muted-foreground border border-transparent hover:text-foreground"
              )}
            >
              Expense
            </button>
            <button
              onClick={() => setIsExpense(false)}
              className={cn(
                "flex-1 py-3 rounded-xl text-sm font-semibold transition-all duration-300",
                !isExpense
                  ? "bg-[#007AFF]/12 text-[#007AFF] border border-[#007AFF]/30"
                  : "text-muted-foreground border border-transparent hover:text-foreground"
              )}
            >
              Income
            </button>
          </div>
        </motion.section>

        {/* Nominal */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.3, ease: "easeOut" }}
        >
          <div className="glass-card p-5 shadow-card">
            <label className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2 block">
              Transaction Amount
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={amount ? new Intl.NumberFormat("id-ID").format(parseInt(amount, 10)) : ""}
              onChange={(e) => handleAmount(e.target.value)}
              placeholder="0"
              className="w-full bg-transparent text-[2.75rem] font-semibold tracking-tighter font-numeric outline-none ring-0 border-none text-foreground placeholder:text-muted-foreground/30 caret-[#007AFF] leading-none"
            />
          </div>
        </motion.section>

        {/* Allocate to goal — income only */}
        {!isExpense && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35, duration: 0.3, ease: "easeOut" }}
          >
            <div className="glass-card p-4 shadow-card">
              <button
                type="button"
                onClick={() => setAllocOpen(!allocOpen)}
                className="w-full flex items-center justify-between text-left"
                aria-expanded={allocOpen}
              >
                <div className="flex items-center gap-2">
                  <Plus className="w-4 h-4 text-green-400" />
                  <span className="text-sm font-semibold text-foreground">Allocate to goal</span>
                </div>
                <ChevronDown className={cn("w-4 h-4 text-muted-foreground transition-transform", allocOpen && "rotate-180")} />
              </button>

              {allocOpen && (
                <div className="mt-3 space-y-3">
                  {activeGoals.length === 0 ? (
                    <div className="text-center py-3">
                      <p className="text-xs text-white/50 mb-2">No active goals</p>
                      <Link href="/goals" className="text-xs font-semibold text-blue-400 hover:text-blue-300">Create a goal</Link>
                    </div>
                  ) : (
                    <>
                      <div>
                        <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Goal</label>
                        <select
                          value={allocGoalId}
                          onChange={(e) => setAllocGoalId(e.target.value)}
                          className="w-full bg-white/5 border border-white/10 rounded-xl p-3 text-sm text-foreground min-h-[48px]"
                        >
                          <option value="">Select a goal</option>
                          {activeGoals.map((g) => {
                            const saved = goalSavings
                              .filter((s) => s.goalId === g.id && s.amount > 0)
                              .reduce((sum, s) => sum + s.amount, 0);
                            const remaining = Math.max(0, g.target - saved);
                            return (
                              <option key={g.id} value={g.id}>
                                {g.name} — {Math.round((saved / g.target) * 100)}% · Rp {remaining.toLocaleString("id-ID")} left
                              </option>
                            );
                          })}
                        </select>
                      </div>

                      {allocGoalId && (
                        <>
                          <div>
                            <label className="text-[10px] text-muted-foreground uppercase tracking-widest block mb-1">Allocation amount</label>
                            <div className="relative">
                              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-white/40 text-sm">Rp</span>
                              <input
                                type="text"
                                inputMode="numeric"
                                value={allocRaw ? new Intl.NumberFormat("id-ID").format(parseInt(allocRaw, 10)) : ""}
                                onChange={(e) => {
                                  const raw = e.target.value.replace(/\D/g, "");
                                  setAllocRaw(raw);
                                }}
                                placeholder="0"
                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-3 py-3 text-foreground min-h-[48px]"
                              />
                            </div>
                          </div>

                          <div className="flex gap-2 flex-wrap">
                            <button type="button" onClick={() => setAllocRaw(amount)} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">All</button>
                            <button type="button" onClick={() => setAllocRaw(String(Math.round((parseInt(amount) || 0) * 0.1)))} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">10%</button>
                            <button type="button" onClick={() => setAllocRaw(String(Math.round((parseInt(amount) || 0) * 0.25)))} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">25%</button>
                            <button type="button" onClick={() => setAllocRaw(String(Math.round((parseInt(amount) || 0) * 0.5)))} className="px-3 py-1.5 rounded-lg bg-white/5 border border-white/10 text-xs font-semibold hover:bg-white/10">50%</button>
                          </div>

                          {allocRaw && (parseInt(allocRaw) || 0) > incomeAmount && (
                            <p className="text-xs text-amber-400">Allocation exceeds income amount. Capped to income.</p>
                          )}
                          {allocRaw && (parseInt(allocRaw) || 0) <= incomeAmount && allocGoalId && (() => {
                            const g = activeGoals.find((x) => x.id === allocGoalId);
                            if (!g) return null;
                            const saved = goalSavings
                              .filter((s) => s.goalId === g.id && s.amount > 0)
                              .reduce((sum, s) => sum + s.amount, 0);
                            const remaining = Math.max(0, g.target - saved);
                            if ((parseInt(allocRaw) || 0) > remaining) {
                              return <p className="text-xs text-amber-400">Exceeds goal remaining (Rp {remaining.toLocaleString("id-ID")}). Capped.</p>;
                            }
                            return (
                              <p className="text-xs text-white/40">
                                Rp {(incomeAmount - (parseInt(allocRaw) || 0)).toLocaleString("id-ID")} stays in wallet
                              </p>
                            );
                          })()}
                        </>
                      )}
                    </>
                  )}
                </div>
              )}
            </div>
          </motion.section>
        )}

        {/* Wallets */}
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.3, ease: "easeOut" }}
        >
          <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-2">
            Select Wallet
          </h2>
          <div className="flex overflow-x-auto gap-3 pb-2">
            {pockets.map((p) => {
              const IconComp = ICON_MAP[p.iconName] || Wallet;
              const active = selPocket === p.id;
              return (
                <motion.button
                  key={p.id}
                  onClick={() => setSelPocket(p.id)}
                  className={cn(
                    "min-w-[100px] p-3 rounded-2xl glass-card flex flex-col items-center justify-center gap-2 transition-all duration-200 shadow-card",
                    active
                      ? "border-[#007AFF] bg-[#007AFF]/10"
                      : "hover:border-white/15 hover:bg-white/5"
                  )}
                  whileTap={{ scale: 0.95 }}
                  whileHover={!active ? { scale: 1.02 } : {}}
                  transition={{ type: "spring", stiffness: 300, damping: 20 }}
                >
                  <IconComp className={cn("w-5 h-5", active ? "text-[#007AFF]" : "text-muted-foreground")} strokeWidth={2} />
                  <span className={cn("text-xs font-semibold text-center leading-tight", active ? "text-foreground" : "text-muted-foreground")}>{p.name}</span>
                  <span className={cn("text-[10px] font-numeric", active ? "text-[#007AFF]/70" : "text-muted-foreground/50")}>{fmt(p.balance)}</span>
                </motion.button>
              );
            })}
          </div>
        </motion.section>

        {/* Category + photo side by side */}
        <motion.section
          className="flex gap-3 w-full"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.3, ease: "easeOut" }}
        >
          {/* Category trigger + sheet */}
          <button
            type="button"
            onClick={() => setCatOpen(true)}
            aria-haspopup="dialog"
            className="flex-1 glass-card rounded-2xl p-4 flex items-center justify-between active:scale-[0.98] transition-all cursor-pointer shadow-card text-left"
          >
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-[#007AFF]/12 border border-[#007AFF]/20 flex items-center justify-center">
                {(() => {
                  const Icon = catObj.icon;
                  return <Icon className="w-4 h-4 text-[#007AFF]" strokeWidth={2} />;
                })()}
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase tracking-widest">Category</p>
                <p className="text-sm font-semibold text-foreground truncate">{catObj.label}</p>
              </div>
            </div>
            <ChevronDown className="w-4 h-4 text-muted-foreground" />
          </button>
          <Overlay open={catOpen} onClose={() => setCatOpen(false)} z={Z.sheet} label="Select category">
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
            <div className="overflow-y-auto px-4 pb-6 flex flex-col gap-1" role="listbox" aria-label="Categories">
              {CATS.map((c) => {
                const IconComp = c.icon;
                const active = selCat === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onClick={() => { setSelCat(c.id); setCatOpen(false); }}
                    className={cn(
                      "flex items-center gap-3 px-3 py-3 rounded-xl transition-all text-left min-h-[52px] w-full",
                      active ? "bg-[#007AFF]/12" : "hover:bg-white/5"
                    )}
                  >
                    <div className={cn(
                      "w-9 h-9 rounded-xl flex items-center justify-center border shrink-0",
                      active ? "bg-[#007AFF]/12 border-[#007AFF]/30" : "bg-white/5 border-white/5"
                    )}>
                      <IconComp className={cn("w-4 h-4", active ? "text-[#007AFF]" : "text-muted-foreground")} strokeWidth={2} />
                    </div>
                    <span className={cn("text-sm font-medium flex-1 text-left", active ? "text-foreground" : "text-muted-foreground")}>{c.label}</span>
                    {active && <Check className="w-4 h-4 text-[#007AFF]" />}
                  </button>
                );
              })}
            </div>
          </Overlay>

          {/* Photo */}
          <motion.button
            onClick={() => fileRef.current?.click()}
            aria-label="Attach photo"
            className="w-16 h-16 shrink-0 glass-card flex flex-col items-center justify-center gap-1.5 active:scale-[0.98] transition-all aspect-square shadow-card"
            whileTap={{ scale: 0.95 }}
          >
            <Camera className="w-5 h-5 text-muted-foreground" strokeWidth={2} />
            <span className="text-[10px] text-muted-foreground font-medium">Photo</span>
          </motion.button>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => handlePhoto(e.target.files?.[0])}
          />
        </motion.section>
        {/* Photo preview */}
        {(image || photoError) && (
          <motion.section
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="glass-card p-3 flex items-center gap-3"
          >
            {image && !photoError && (
              <>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={image} alt="Attachment preview" className="w-14 h-14 rounded-xl object-cover border border-white/10" />
                <p className="text-xs text-white/50 flex-1">Photo attached. Stored compressed.</p>
                <button
                  type="button"
                  onClick={() => { setImage(undefined); if (fileRef.current) fileRef.current.value = ""; }}
                  className="text-xs font-semibold text-red-300 px-3 py-2 rounded-xl bg-red-500/10 border border-red-500/30 min-h-[44px]"
                >
                  Remove
                </button>
              </>
            )}
            {photoError && <p role="alert" className="text-xs text-red-300">{photoError}</p>}
          </motion.section>
        )}

        {/* Note */}
        <motion.section
          className="flex-1 flex flex-col min-h-[90px]"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.6, duration: 0.3, ease: "easeOut" }}
        >
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Additional notes (optional)"
            className="w-full glass-card p-4 text-sm text-foreground placeholder:text-muted-foreground/30 outline-none focus:border-[#007AFF]/40 transition-all resize-none flex-1 min-h-[90px] shadow-card"
          />
        </motion.section>
      </div>

      {/* Save */}
      <div className="relative pt-4 pb-2">
        <button
          onClick={handleSave}
          disabled={!amount || parseFloat(amount) <= 0}
          className="w-full h-14 rounded-full surface-primary text-white text-base font-semibold hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-30 disabled:grayscale shadow-diffused-lg"
        >
          Save {editId ? "Changes" : "Transaction"}
        </button>
      </div>

      {toast && <Toast message={toast} />}

      {/* Success — portaled */}
      <Portal>
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
                className="w-24 h-24 rounded-full bg-[#007AFF]/12 border border-[#007AFF]/30 flex items-center justify-center"
                animate={{
                  scale: [1, 1.15, 1],
                  boxShadow: [
                    "0 0 0 0 rgba(0, 122, 255, 0.1)",
                    "0 0 0 20px rgba(0, 122, 255, 0)",
                  ],
                }}
                transition={{ duration: 1.2, times: [0, 0.5, 1] }}
              >
                <motion.div
                  animate={{ scale: [0.8, 1.1, 1], rotate: [0, 10, 0] }}
                  transition={{ duration: 0.6, times: [0, 0.5, 1] }}
                >
                  <Check className="w-12 h-12 text-[#007AFF]" strokeWidth={2.5} />
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
                  className="text-sm text-muted-foreground"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.35, duration: 0.3 }}
                >
                  {isExpense ? "Expense" : "Income"} transaction saved
                </motion.p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </Portal>
    </motion.main>
  );
}