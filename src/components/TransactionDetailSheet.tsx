"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { X, Star, Copy, Pencil, Trash2, Camera, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Transaction } from "@/store/useFinanceStore";
import CategoryIcon from "@/components/CategoryIcon";
import { Overlay, Portal, Z, useBackEntry, useLockBody } from "@/components/overlay";
import { displayName } from "@/lib/history";
import Money from "@/components/Money";

interface Props {
  txn: Transaction | null;
  pocketName: string;
  onClose: () => void;
  onDelete: (t: Transaction) => void;
  onDuplicate: (t: Transaction) => void;
  onToggleStar: (t: Transaction) => void;
}

/**
 * Centered transaction detail modal on the shared Overlay primitive
 * (solid panel, dark backdrop, scroll lock, Escape/back handling in caller).
 * Notes/images render only when present.
 */
export default function TransactionDetailSheet({
  txn, pocketName, onClose, onDelete, onDuplicate, onToggleStar,
}: Props) {
  const router = useRouter();
  const [imgOpen, setImgOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);
  const [imgLoading, setImgLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setImgOpen(false);
    setImgFailed(false);
    setImgLoading(true);
    setCopied(false);
  }, [txn?.id]);

  // Non-overlay back entry for select mode is handled in riwayat page;
  // lightbox joins the same shared stack so back unwinds top-first.
  useBackEntry(imgOpen, () => setImgOpen(false));
  useLockBody(imgOpen);

  if (!txn) return null;

  const copyId = async () => {
    try {
      await navigator.clipboard.writeText(txn.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* clipboard unavailable — stay silent */
    }
  };

  return (
    <>
      <Overlay open={!!txn} onClose={onClose} z={Z.modal} label={`Transaction details, ${txn.category}`} variant="modal">
        {/* Header: star + close */}
        <div className="flex items-center justify-between px-5 pt-4 pb-1 shrink-0">
          <button
            type="button"
            onClick={() => onToggleStar(txn)}
            aria-pressed={!!txn.starred}
            aria-label={txn.starred ? "Remove star" : "Star this transaction"}
            className={cn(
              "w-10 h-10 rounded-full border flex items-center justify-center active:scale-90 transition",
              txn.starred
                ? "bg-amber-500/15 border-amber-500/40"
                : "bg-white/5 border-white/10"
            )}
          >
            <Star className={cn("w-4 h-4", txn.starred ? "text-amber-300 fill-amber-300" : "text-white/50")} />
          </button>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close details"
            className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-white/60 hover:text-white active:scale-90 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-y-auto px-5 pb-3">
          {/* Icon + type */}
          <div className="flex flex-col items-center">
            <CategoryIcon category={txn.category} />
            <p className="text-[11px] font-semibold uppercase tracking-widest text-white/40 mt-2">
              {txn.isExpense ? "Expense" : "Income"}
            </p>
            <p
              className={cn(
                "font-bold tracking-tight font-numeric break-all leading-tight text-center",
                "text-[2rem]",
                txn.isExpense ? "text-white" : "text-green-500"
              )}
            >
              <Money value={txn.amount} prefix={txn.isExpense ? "−" : "+"} />
            </p>
            <p className="text-xs text-white/40 mt-1">{txn.date} · {txn.time}</p>
          </div>

          {/* Rows */}
          <dl className="mt-4 rounded-2xl bg-white/5 border border-white/10 divide-y divide-white/5 overflow-hidden">
            <div className="flex items-center justify-between gap-3 p-3.5">
              <dt className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">Category</dt>
              <dd className="text-sm font-semibold truncate text-right">{txn.category}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 p-3.5">
              <dt className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">Wallet</dt>
              <dd className="text-sm font-semibold truncate text-right">{pocketName}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 p-3.5">
              <dt className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">Name</dt>
              <dd className="text-sm font-semibold truncate text-right">{displayName(txn)}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 p-3.5">
              <dt className="text-[10px] uppercase tracking-widest text-white/40 shrink-0">Transaction ID</dt>
              <dd className="min-w-0 flex items-center gap-1.5">
                <span className="text-xs font-mono text-white/60 truncate">{txn.id}</span>
                <button
                  type="button"
                  onClick={copyId}
                  aria-label="Copy transaction ID"
                  className="shrink-0 w-7 h-7 rounded-lg bg-white/5 flex items-center justify-center text-white/50 hover:text-white active:scale-90 transition"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                </button>
              </dd>
            </div>
          </dl>

          {/* Goal allocation badge — only when present */}
          {txn.goalAllocation && txn.goalAllocation.length > 0 ? (
            <div className="mt-3 rounded-2xl bg-green-500/10 border border-green-500/30 p-3.5">
              <p className="text-[10px] uppercase tracking-widest text-green-400 mb-1">Allocated to goal</p>
              {txn.goalAllocation.map((a, i) => (
                <div key={i} className="text-sm text-white/90">
                  {a.goalId} — <Money value={a.amount} prefix="Rp " />
                </div>
              ))}
            </div>
          ) : null}

          {/* Notes — only when present */}
          {txn.note?.trim() ? (
            <div className="mt-3 rounded-2xl bg-white/5 border border-white/10 p-3.5">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-1">Notes</p>
              <p className="text-sm text-white/85 leading-relaxed break-words whitespace-pre-wrap max-h-40 overflow-y-auto">
                {txn.note}
              </p>
            </div>
          ) : null}

          {/* Image — only when present */}
          {txn.image ? (
            <div className="mt-3 rounded-2xl bg-white/5 border border-white/10 p-3.5">
              <p className="text-[10px] uppercase tracking-widest text-white/40 mb-2">Attachment</p>
              {imgFailed ? (
                <div className="flex items-center gap-2.5 text-white/40">
                  <span className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center">
                    <Camera className="w-4 h-4" />
                  </span>
                  <p className="text-xs">Image could not be loaded.</p>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setImgOpen(true)}
                  aria-label="View image larger"
                  className="relative block w-full overflow-hidden rounded-xl border border-white/10 active:scale-[0.99] transition"
                >
                  {imgLoading && (
                    <span aria-hidden="true" className="block w-full h-40 bg-white/5 animate-pulse" />
                  )}
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={txn.image}
                    alt={`${txn.category} attachment`}
                    loading="lazy"
                    onLoad={() => setImgLoading(false)}
                    onError={() => { setImgFailed(true); setImgLoading(false); }}
                    className="w-full max-h-52 object-cover"
                  />
                </button>
              )}
            </div>
          ) : null}
        </div>

        {/* Actions — pinned, always visible */}
        <div className="grid grid-cols-3 gap-2 px-5 pt-2 pb-5 shrink-0 border-t border-white/5 bg-card">
          <button
            type="button"
            onClick={() => router.push(`/transaksi?edit=${encodeURIComponent(txn.id)}`)}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs font-semibold active:scale-95 transition min-h-[48px]"
          >
            <Pencil className="w-4 h-4" /> Edit
          </button>
          <button
            type="button"
            onClick={() => onDuplicate(txn)}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-white/5 border border-white/10 text-white/80 text-xs font-semibold active:scale-95 transition min-h-[48px]"
          >
            <Copy className="w-4 h-4" /> Duplicate
          </button>
          <button
            type="button"
            onClick={() => onDelete(txn)}
            className="flex items-center justify-center gap-1.5 py-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold active:scale-95 transition min-h-[48px]"
          >
            <Trash2 className="w-4 h-4" /> Delete
          </button>
        </div>
      </Overlay>

      {/* Image lightbox — portaled */}
      <Portal>
        {txn.image && !imgFailed && imgOpen && (
          <div
            className="fixed inset-0 isolate flex flex-col items-center justify-center p-4 bg-black/90"
            style={{ zIndex: Z.lightbox }}
            role="dialog"
            aria-modal="true"
            aria-label="Image preview"
            onClick={() => setImgOpen(false)}
          >
            <button
              type="button"
              onClick={() => setImgOpen(false)}
              aria-label="Close preview"
              className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-90 transition"
            >
              <X className="w-5 h-5" />
            </button>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={txn.image}
              alt={`${txn.category} attachment, full size`}
              onError={() => { setImgFailed(true); setImgOpen(false); }}
              onClick={(e) => e.stopPropagation()}
              className="max-w-full max-h-[80dvh] rounded-2xl object-contain"
            />
            <p className="text-xs text-white/50 mt-3">Tap outside to close</p>
          </div>
        )}
      </Portal>
    </>
  );
}
