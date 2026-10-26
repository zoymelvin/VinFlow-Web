import { create } from "zustand";
import { persist } from "zustand/middleware";

interface FavoriteCoin {
  id: string;
  name: string;
  symbol: string;
  large: string;
  thumb: string;
}

interface CryptoSettings {
  favorites: FavoriteCoin[];
}

interface CryptoStore extends CryptoSettings {
  addFavorite: (coin: FavoriteCoin) => void;
  removeFavorite: (id: string) => void;
}

export const useCryptoStore = create<CryptoStore>()(
  persist(
    (set) => ({
      favorites: [],
      addFavorite: (coin) =>
        set((state) => {
          if (state.favorites.length >= 30 || state.favorites.find(f => f.id === coin.id)) return state;
          return { favorites: [coin, ...state.favorites] };
        }),
      removeFavorite: (id) =>
        set((state) => ({ favorites: state.favorites.filter((f) => f.id !== id) })),
    }),
    {
      name: "vinflow-crypto-favorites",
      version: 2,
      migrate: (persistedState: unknown, version: number) => {
        if (version === 0 || version === 1) {
          const state = persistedState as { favorites?: FavoriteCoin[] };
          return {
            ...state,
            favorites: (state.favorites || []).map((fav: FavoriteCoin | string) => (
              typeof fav === 'string' ? { id: fav, name: fav, symbol: fav, large: '', thumb: '' } : { ...fav, large: fav.large || fav.thumb || '' }
            ))
          };
        }
        return persistedState;
      }
    }
  )
);
