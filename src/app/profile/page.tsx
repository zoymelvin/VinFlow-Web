"use client";

import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Camera, Download, Eye, EyeOff, RotateCcw, Trash2, Upload, X } from "lucide-react";
import { useFinanceStore } from "@/store/useFinanceStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { buildBackup, importBackupPayload, validateName, type ImportResult } from "@/lib/settings";
import { compressImageFile } from "@/lib/image";
import Avatar from "@/components/Avatar";
import { Overlay, Z } from "@/components/overlay";
import Toast from "@/components/Toast";
import PageHeader from "@/components/PageHeader";
import pkg from "../../../package.json";

export default function ProfilePage() {
  const [hasMounted, setHasMounted] = useState(false);
  const pockets = useFinanceStore((s) => s.pockets);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgets = useFinanceStore((s) => s.budgets);
  const goals = useFinanceStore((s) => s.goals);
  const goalSavings = useFinanceStore((s) => s.goalSavings);
  const setPockets = useFinanceStore((s) => s.setPockets);
  const setTransactions = useFinanceStore((s) => s.setTransactions);
  const setBudgets = useFinanceStore((s) => s.setBudgets);
  const setGoals = useFinanceStore((s) => s.setGoals);
  const setGoalSavings = useFinanceStore((s) => s.setGoalSavings);
  const profile = useSettingsStore((s) => s.profile);
  const hideBalance = useSettingsStore((s) => s.hideBalance);
  const updateProfile = useSettingsStore((s) => s.updateProfile);
  const setHideBalance = useSettingsStore((s) => s.setHideBalance);
  const applyImported = useSettingsStore((s) => s.applyImported);
  const resetSettings = useSettingsStore((s) => s.resetSettings);

  useEffect(() => { setHasMounted(true); }, []);

  const [editOpen, setEditOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState("");
  const [photoDraft, setPhotoDraft] = useState("");
  const [editError, setEditError] = useState("");
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const [toast, setToast] = useState<string | null>(null);
  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(null), 3000); };

  const [pendingImport, setPendingImport] = useState<(ImportResult & { ok: true }) | null>(null);
  const importFileRef = useRef<HTMLInputElement>(null);

  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0);

  if (!hasMounted) return null;

  /* ── Edit modal ── */
  const openEdit = () => {
    setNameDraft(profile.name);
    setPhotoDraft(profile.photo);
    setEditError("");
    setEditOpen(true);
  };
  const handlePhotoPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await compressImageFile(file, { max: 256, quality: 0.8, maxBytes: 150_000 });
      setPhotoDraft(dataUrl);
      setEditError("");
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to process image.");
    }
  };
  const handleSaveProfile = () => {
    const err = validateName(nameDraft);
    if (err) { setEditError(err); return; }
    setSaving(true);
    try {
      updateProfile({ name: nameDraft.trim(), photo: photoDraft });
      showToast("Profile saved");
      setEditOpen(false);
    } catch {
      setEditError("Could not save. Storage may be full.");
    } finally {
      setSaving(false);
    }
  };

  /* ── Export / Import ── */
  const handleExport = () => {
    const json = buildBackup(pockets, transactions, { profile, hideBalance }, budgets, goals, goalSavings);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `vinflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Backup exported");
  };
  const handleImportFile = async (file?: File) => {
    if (!file) return;
    let json: string;
    try { json = await file.text(); } catch { showToast("Could not read that file."); return; }
    const res = importBackupPayload(json);
    if (!res.ok) { showToast(res.error); return; }
    setPendingImport(res);
  };
  const confirmImport = () => {
    if (!pendingImport) return;
    setPockets(pendingImport.pockets);
    setTransactions(pendingImport.transactions);
    setBudgets(pendingImport.budgets);
    setGoals(pendingImport.goals);
    setGoalSavings(pendingImport.goalSavings);
    applyImported(pendingImport.settings);
    setPendingImport(null);
    showToast("Backup imported");
  };

  /* ── Reset App (two-step) ── */
  const doReset = () => {
    setPockets([]);
    setTransactions([]);
    resetSettings();
    setResetStep(0);
    showToast("App reset");
  };

  return (
    <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} className="pb-28">
      <PageHeader title="Profile" label="Account" />

      <main className="px-5 pt-4 space-y-4">
        {/* Profile card */}
        <section className="rounded-2xl bg-secondary border border-white/5 p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-4 min-w-0">
              <Avatar name={profile.name} photo={profile.photo} size="lg" />
              <p className="text-base font-semibold text-white truncate">{profile.name}</p>
            </div>
            <button
              onClick={openEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 text-white/70 text-sm font-medium hover:bg-white/10 active:bg-white/15 transition-colors shrink-0"
              aria-label="Edit profile"
            >
              <X className="w-4 h-4" strokeWidth={2.5} /> Edit
            </button>
          </div>
        </section>

        {/* Settings card */}
        <section className="rounded-2xl bg-secondary border border-white/5 overflow-hidden">
          {/* Hide Balances */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/5">
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-white/5 p-2 text-white/60">
                {hideBalance ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </span>
              <div>
                <p className="text-sm font-medium text-white">Hide Balances</p>
                <p className="text-[11px] text-white/40">Mask money across the app</p>
              </div>
            </div>
            <button
              role="switch"
              aria-checked={hideBalance}
              onClick={() => { setHideBalance(!hideBalance); showToast(hideBalance ? "Balances visible" : "Balances hidden"); }}
              className={`relative w-11 h-6 rounded-full transition-colors ${hideBalance ? "bg-blue-500" : "bg-white/10"}`}
            >
              <span
                className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-transform"
                style={{ transform: hideBalance ? "translateX(24px)" : "translateX(0)" }}
              />
            </button>
          </div>

          {/* Export Data */}
          <button
            onClick={handleExport}
            className="flex items-center justify-between w-full px-5 py-4 text-left border-b border-white/5 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-white/5 p-2 text-white/60"><Download className="w-5 h-5" /></span>
              <div>
                <p className="text-sm font-medium text-white">Export Data</p>
                <p className="text-[11px] text-white/40">Download a backup file</p>
              </div>
            </div>
            <span className="text-white/30 text-sm">→</span>
          </button>

          {/* Import Data */}
          <button
            onClick={() => importFileRef.current?.click()}
            className="flex items-center justify-between w-full px-5 py-4 text-left border-b border-white/5 hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-white/5 p-2 text-white/60"><Upload className="w-5 h-5" /></span>
              <div>
                <p className="text-sm font-medium text-white">Import Data</p>
                <p className="text-[11px] text-white/40">Replace current data from a backup</p>
              </div>
            </div>
            <span className="text-white/30 text-sm">→</span>
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => { handleImportFile(e.target.files?.[0]); e.target.value = ""; }}
          />

          {/* Reset App */}
          <button
            onClick={() => setResetStep(1)}
            className="flex items-center justify-between w-full px-5 py-4 text-left hover:bg-white/5 transition-colors"
          >
            <div className="flex items-center gap-3">
              <span className="rounded-lg bg-red-500/10 p-2"><RotateCcw className="w-5 h-5 text-red-400" /></span>
              <div>
                <p className="text-sm font-medium text-red-300">Reset App</p>
                <p className="text-[11px] text-white/40">Delete all data on this device</p>
              </div>
            </div>
            <span className="text-white/30 text-sm">→</span>
          </button>
        </section>

        {/* Version */}
        <p className="text-center text-[11px] text-white/25 mt-6">Version {pkg.version}</p>
      </main>

      {toast && <Toast message={toast} />}

      {/* Edit Profile */}
      <Overlay open={editOpen} onClose={() => setEditOpen(false)} label="Edit profile" variant="modal" z={Z.modal}>
        <div className="p-5 space-y-5 overflow-y-auto">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold text-white">Edit Profile</h2>
            <button onClick={() => setEditOpen(false)} className="p-1 rounded-lg hover:bg-white/5" aria-label="Close">
              <X className="w-5 h-5" strokeWidth={2.5} />
            </button>
          </div>

          <div className="flex flex-col items-center gap-3">
            <Avatar name={nameDraft} photo={photoDraft} size="lg" />
            <div className="flex items-center gap-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <Camera className="w-4 h-4 text-white/60" />
                <span className="text-sm text-white/70">Change photo</span>
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />
              </label>
              {photoDraft && (
                <button
                  type="button"
                  onClick={() => setPhotoDraft("")}
                  className="flex items-center gap-1.5 text-sm text-red-400 hover:text-red-300"
                >
                  <Trash2 className="w-3.5 h-3.5" /> Remove photo
                </button>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="profile-name" className="block text-xs font-medium text-white/60">Name</label>
            <input
              id="profile-name"
              type="text"
              maxLength={30}
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              className="w-full rounded-lg bg-white/5 border border-white/10 px-3 py-2.5 text-white placeholder:text-white/30 focus:border-blue-500 focus:outline-none"
              placeholder="Your name"
            />
            <p className="text-[11px] text-white/40">Changes show up in the Home greeting.</p>
            {editError && <p className="text-[11px] text-red-400">{editError}</p>}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setEditOpen(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5">
              Cancel
            </button>
            <button
              onClick={handleSaveProfile}
              disabled={saving}
              className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-400 disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
          </div>
        </div>
      </Overlay>

      {/* Import confirm */}
      <Overlay open={!!pendingImport} onClose={() => setPendingImport(null)} label="Import backup" variant="modal" z={Z.confirm}>
        <div className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-white">Import Backup?</h2>
          <p className="text-sm text-white/60">
            This replaces your current wallets, transactions, and settings with the backup file. This cannot be undone.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setPendingImport(null)} className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5">
              Cancel
            </button>
            <button onClick={confirmImport} className="px-4 py-2 rounded-lg bg-blue-500 text-white text-sm font-medium hover:bg-blue-400">
              Import
            </button>
          </div>
        </div>
      </Overlay>

      {/* Reset step 1 — offer export first */}
      <Overlay open={resetStep === 1} onClose={() => setResetStep(0)} label="Reset app" variant="modal" z={Z.confirm}>
        <div className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-white">Reset App?</h2>
          <p className="text-sm text-white/60">
            All wallets, transactions, and settings will be deleted from this device. This cannot be undone.
            Export your data first if you might need it later.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setResetStep(0)} className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5">
              Cancel
            </button>
            <button onClick={handleExport} className="px-4 py-2 rounded-lg bg-white/10 text-white text-sm font-medium hover:bg-white/15">
              Export first
            </button>
            <button onClick={() => setResetStep(2)} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-400">
              Continue
            </button>
          </div>
        </div>
      </Overlay>

      {/* Reset step 2 — final confirm */}
      <Overlay open={resetStep === 2} onClose={() => setResetStep(0)} label="Delete everything" variant="modal" z={Z.confirm}>
        <div className="p-5 space-y-4">
          <h2 className="text-base font-semibold text-red-300">Delete Everything?</h2>
          <p className="text-sm text-white/60">
            All wallets, transactions, and settings will be permanently removed from this device.
          </p>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setResetStep(0)} className="px-4 py-2 rounded-lg text-sm font-medium text-white/70 hover:bg-white/5">
              Cancel
            </button>
            <button onClick={doReset} className="px-4 py-2 rounded-lg bg-red-500 text-white text-sm font-medium hover:bg-red-400">
              Delete everything
            </button>
          </div>
        </div>
      </Overlay>
    </motion.div>
  );
}
