import { create } from "zustand";
import { persist } from "zustand/middleware";
import { DEFAULT_SETTINGS, migrateSettings, type AppSettingsState } from "@/lib/settings";

type SettingsState = AppSettingsState & {
  revealed: boolean;
  updateProfile: (patch: Partial<{ name: string; photo: string }>) => void;
  setHideBalance: (v: boolean) => void;
  /** Tap-to-peek: reveal hidden amounts briefly, then re-mask. */
  toggleRevealed: () => void;
  /** Apply settings from an imported backup (sanitized). */
  applyImported: (next: unknown) => void;
  resetSettings: () => void;
};

let reMaskTimer: ReturnType<typeof setTimeout> | null = null;

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      ...DEFAULT_SETTINGS,
      revealed: false,
      updateProfile: (patch) =>
        set((s) => ({
          profile: {
            name: typeof patch.name === "string" ? patch.name.slice(0, 30) : s.profile.name,
            photo: typeof patch.photo === "string" ? patch.photo : s.profile.photo,
          },
        })),
      setHideBalance: (v) => set({ hideBalance: v }),
      toggleRevealed: () => {
        const next = !get().revealed;
        set({ revealed: next });
        if (reMaskTimer) clearTimeout(reMaskTimer);
        if (next) reMaskTimer = setTimeout(() => set({ revealed: false }), 8000);
      },
      applyImported: (next) => {
        const migrated = migrateSettings(next);
        set({ profile: migrated.profile, hideBalance: migrated.hideBalance });
      },
      resetSettings: () => {
        if (reMaskTimer) clearTimeout(reMaskTimer);
        set({ ...DEFAULT_SETTINGS, revealed: false });
      },
    }),
    {
      name: "vinflow-settings",
      version: 2,
      partialize: (s) => ({ profile: s.profile, hideBalance: s.hideBalance }),
      migrate: (persisted) => migrateSettings(persisted),
    }
  )
);
