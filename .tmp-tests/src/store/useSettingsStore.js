"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.useSettingsStore = void 0;
const zustand_1 = require("zustand");
const middleware_1 = require("zustand/middleware");
const settings_1 = require("@/lib/settings");
let reMaskTimer = null;
exports.useSettingsStore = (0, zustand_1.create)()((0, middleware_1.persist)((set, get) => ({
    ...settings_1.DEFAULT_SETTINGS,
    revealed: false,
    updateProfile: (patch) => set((s) => ({
        profile: {
            name: typeof patch.name === "string" ? patch.name.slice(0, 30) : s.profile.name,
            photo: typeof patch.photo === "string" ? patch.photo : s.profile.photo,
        },
    })),
    setHideBalance: (v) => set({ hideBalance: v }),
    toggleRevealed: () => {
        const next = !get().revealed;
        set({ revealed: next });
        if (reMaskTimer)
            clearTimeout(reMaskTimer);
        if (next)
            reMaskTimer = setTimeout(() => set({ revealed: false }), 8000);
    },
    applyImported: (next) => {
        const migrated = (0, settings_1.migrateSettings)(next);
        set({ profile: migrated.profile, hideBalance: migrated.hideBalance });
    },
    resetSettings: () => {
        if (reMaskTimer)
            clearTimeout(reMaskTimer);
        set({ ...settings_1.DEFAULT_SETTINGS, revealed: false });
    },
}), {
    name: "vinflow-settings",
    version: 2,
    partialize: (s) => ({ profile: s.profile, hideBalance: s.hideBalance }),
    migrate: (persisted) => (0, settings_1.migrateSettings)(persisted),
}));
