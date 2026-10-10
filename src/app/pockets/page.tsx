"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  Plus, Building, Smartphone, Wallet, Coins, CreditCard, LayoutGrid,
  Trash2, X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Overlay, GrabHandle, Z } from "@/components/overlay";
import { useFinanceStore, type Pocket } from "@/store/useFinanceStore";
import Money from "@/components/Money";

/* ── Data ────────────────────────────────────────────────── */
const AVAILABLE_CATEGORIES = [
  { id: "bank", name: "Bank", icon: Building },
  { id: "ewallet", name: "E-Wallet", icon: Smartphone },
  { id: "cash", name: "Cash", icon: Coins },
  { id: "other", name: "Other", icon: LayoutGrid },
];

const ICONS: Record<string, React.ElementType> = {
  Building, Smartphone, Wallet, Coins, CreditCard, LayoutGrid,
};

/* ── Page ────────────────────────────────────────────────── */
export default function PocketsPage() {
  const pockets = useFinanceStore((s) => s.pockets);
  const addPocket = useFinanceStore((s) => s.addPocket);
  const updatePocketBalance = useFinanceStore((s) => s.updatePocketBalance);
  const deletePocket = useFinanceStore((s) => s.deletePocket);

  const [hasMounted, setHasMounted] = useState(false);

  // Add drawer
  const [openAdd, setOpenAdd] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<typeof AVAILABLE_CATEGORIES[0] | null>(null);
  const [newName, setNewName] = useState("");
  const [newBalance, setNewBalance] = useState("");

  // Detail dialog
  const [openDetail, setOpenDetail] = useState(false);
  const [selectedPocket, setSelectedPocket] = useState<Pocket | null>(null);
  const [editBalance, setEditBalance] = useState("");

  useEffect(() => { setHasMounted(true); }, []);
  if (!hasMounted) return null;

  /* ── Handlers ── */
  const handleAddPocket = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCategory || !newName || !newBalance) return;
    const balanceNum = parseFloat(newBalance.replace(/\D/g, ""));
    const newPocket: Pocket = {
      id: `p-${Date.now()}`,
      name: newName,
      category: selectedCategory.name,
      balance: isNaN(balanceNum) ? 0 : balanceNum,
      iconName:
        selectedCategory.id === "bank" ? "Building" :
        selectedCategory.id === "ewallet" ? "Smartphone" :
        selectedCategory.id === "cash" ? "Coins" : "LayoutGrid",
    };
    addPocket(newPocket);
    setSelectedCategory(null);
    setNewName("");
    setNewBalance("");
    setOpenAdd(false);
  };

  const handleOpenDetail = (pocket: Pocket) => {
    setSelectedPocket(pocket);
    setEditBalance(new Intl.NumberFormat("id-ID").format(pocket.balance));
    setOpenDetail(true);
  };

  const handleUpdateBalance = () => {
    if (!selectedPocket || !editBalance) return;
    const balanceNum = parseFloat(editBalance.replace(/\D/g, ""));
    updatePocketBalance(selectedPocket.id, isNaN(balanceNum) ? 0 : balanceNum);
    setOpenDetail(false);
  };

  const handleDeletePocket = () => {
    if (!selectedPocket) return;
    deletePocket(selectedPocket.id);
    setOpenDetail(false);
  };

  return (
    <motion.main
      className="relative min-h-screen bg-background text-foreground pb-28 px-4 pt-4"
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3 }}
    >


      {/* Header */}
      <header className="relative mb-8">
        <h1 className="text-2xl font-bold tracking-tight text-white">My Wallets</h1>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-1 mb-2">
          {pockets.length} wallets
        </p>
        <div className="h-px bg-gradient-to-r from-blue-500/40 via-transparent to-transparent" />
      </header>

      {/* Pocket Grid */}
      <section className="relative">
        <div className="grid grid-cols-2 gap-3">
          {pockets.map((pocket, idx) => {
            const IconComponent = ICONS[pocket.iconName] || Wallet;
            return (
              <motion.button
                key={pocket.id}
                onClick={() => handleOpenDetail(pocket)}
                className="rounded-2xl bg-white/5 border border-white/10 p-4 flex flex-col justify-between h-36 text-left active:scale-[0.97] hover:bg-white/[0.07] transition-all outline-none"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 + idx * 0.05, duration: 0.3 }}
                whileTap={{ scale: 0.97 }}
              >
                <div className="w-10 h-10 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center">
                  <IconComponent className="w-5 h-5 text-blue-500" strokeWidth={2} />
                </div>

                <div className="mt-auto">
                  <p className="text-sm font-semibold text-white truncate">{pocket.name}</p>
                  <p className="text-[11px] text-white/40 uppercase tracking-widest mt-0.5">{pocket.category}</p>
                  <p className="text-base font-bold tracking-tight text-white mt-1.5">
                    <Money value={pocket.balance} className="text-xl font-bold text-white" />
                  </p>
                </div>
              </motion.button>
            );
          })}

          {/* Add Wallet card + sheet — unified opaque layer */}
          <button
            type="button"
            onClick={() => setOpenAdd(true)}
            aria-haspopup="dialog"
            className="rounded-2xl border-2 border-dashed border-white/15 h-36 flex flex-col items-center justify-center gap-2 hover:bg-white/5 active:scale-[0.98] transition-all outline-none"
          >
            <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
              <Plus className="w-5 h-5 text-white/50" strokeWidth={2} />
            </div>
            <span className="text-xs font-semibold text-white/50">Add Wallet</span>
          </button>
          <Overlay open={openAdd} onClose={() => setOpenAdd(false)} z={Z.sheet} label="Add new wallet">
            <GrabHandle />
            <div className="flex items-center justify-between px-5 pt-1 pb-3 shrink-0">
              <h3 className="text-base font-semibold text-white">Add New Wallet</h3>
              <button
                type="button"
                onClick={() => setOpenAdd(false)}
                aria-label="Close add wallet"
                className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleAddPocket} className="overflow-y-auto flex flex-col gap-5 px-5 pb-8 pt-1">
              {/* Category pills */}
              <div className="flex flex-wrap gap-2" role="group" aria-label="Wallet category">
                {AVAILABLE_CATEGORIES.map((cat) => {
                  const Icon = cat.icon;
                  const sel = selectedCategory?.id === cat.id;
                  return (
                    <button
                      key={cat.id}
                      type="button"
                      aria-pressed={sel}
                      onClick={() => setSelectedCategory(cat)}
                      className={cn(
                        "flex items-center gap-2 px-4 py-2.5 rounded-full border text-xs font-semibold transition-all min-h-[44px]",
                        sel
                          ? "bg-blue-500/15 border-blue-500/40 text-blue-400"
                          : "bg-white/5 border-white/10 text-white/50 hover:bg-white/10"
                      )}
                    >
                      <Icon className="w-4 h-4" />
                      {cat.name}
                    </button>
                  );
                })}
              </div>

              {/* Name */}
              <input
                type="text"
                placeholder="Wallet Name (e.g., BCA, Dana, etc.)"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                aria-label="Wallet name"
                className="w-full bg-white/5 border border-white/10 rounded-xl p-3.5 text-sm text-white outline-none placeholder:text-white/30 focus:border-blue-500/40 transition-all"
                required
              />

              {/* Balance */}
              <div>
                <label className="text-xs font-medium text-white/50 mb-2 block text-center">Initial Balance</label>
                <input
                  type="text"
                  inputMode="numeric"
                  placeholder="0"
                  value={newBalance}
                  onChange={(e) => setNewBalance(e.target.value.replace(/\D/g, ""))}
                  aria-label="Initial balance"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3.5 text-2xl font-bold text-center text-white outline-none placeholder:text-white/20 focus:border-blue-500/40 transition-all"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={!selectedCategory || !newName || !newBalance}
                className="w-full h-14 rounded-full bg-blue-600 text-white text-base font-semibold hover:bg-blue-500 disabled:opacity-30 disabled:grayscale transition-all"
              >
                Save Wallet
              </Button>
            </form>
          </Overlay>
        </div>
      </section>

      {/* Wallet detail — unified opaque centered modal */}
      <Overlay open={openDetail} onClose={() => setOpenDetail(false)} z={Z.modal} label="Wallet details" variant="modal">
        {selectedPocket && (() => {
          const Icon = ICONS[selectedPocket.iconName] || Wallet;
          return (
            <>
              <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
                <h3 className="text-base font-semibold text-white">Wallet Details</h3>
                <button
                  type="button"
                  onClick={() => setOpenDetail(false)}
                  aria-label="Close wallet details"
                  className="w-7 h-7 rounded-full bg-white/5 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="overflow-y-auto px-5 pb-5 flex flex-col items-center">
                <div className="w-16 h-16 rounded-2xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center mb-4">
                  <Icon className="w-8 h-8 text-blue-500" strokeWidth={1.8} />
                </div>
                <h2 className="text-xl font-bold tracking-tight text-white text-center">{selectedPocket.name}</h2>
                <p className="text-xs text-white/40 uppercase tracking-widest mt-1 mb-6">{selectedPocket.category}</p>

                <div className="w-full rounded-2xl bg-white/5 border border-white/10 p-4 mb-6">
                  <p className="text-xs font-semibold text-white/50 uppercase tracking-widest mb-2 text-center">Adjust Balance</p>
                  <div className="flex items-center justify-center gap-1">
                    <span className="text-white/40 text-2xl font-semibold">Rp</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={editBalance}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, "");
                        if (val) setEditBalance(new Intl.NumberFormat("id-ID").format(parseInt(val, 10)));
                        else setEditBalance("");
                      }}
                      aria-label="Wallet balance"
                      className="w-full max-w-[160px] bg-transparent outline-none text-3xl font-bold text-center text-white placeholder:text-white/20 caret-blue-500"
                      placeholder="0"
                    />
                  </div>
                </div>

                <div className="flex flex-col gap-3 w-full">
                  <Button
                    onClick={handleUpdateBalance}
                    disabled={!editBalance}
                    className="w-full h-12 rounded-full bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 disabled:opacity-30"
                  >
                    Save Changes
                  </Button>
                  <Button
                    onClick={handleDeletePocket}
                    variant="ghost"
                    className="w-full h-12 rounded-full text-red-400 hover:bg-red-500/10 text-sm font-semibold gap-2"
                  >
                    <Trash2 className="w-4 h-4" />
                    Delete Wallet
                  </Button>
                </div>
              </div>
            </>
          );
        })()}
      </Overlay>
    </motion.main>
  );
}
