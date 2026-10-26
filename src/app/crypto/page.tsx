"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Search, TrendingUp, TrendingDown, Star, X } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { useCryptoStore } from "@/store/useCryptoStore";
import { fetchCoinMarkets, searchCoins, formatUSD, type CoinMarket, type CoinSearchResult } from "@/lib/crypto/api";

export default function CryptoPage() {
  const favorites = useCryptoStore((s) => s.favorites);
  const addFavorite = useCryptoStore((s) => s.addFavorite);
  const removeFavorite = useCryptoStore((s) => s.removeFavorite);

  const [markets, setMarkets] = useState<CoinMarket[]>([]);
  const [query, setQuery] = useState("");
  const [searchResults, setSearchResults] = useState<CoinSearchResult[]>([]);
  const [searchLoading, setSearchLoading] = useState(false);
  const [livePrices, setLivePrices] = useState<Record<string, number>>({});

  useEffect(() => {
    let active = true;
    const load = async () => {
      if (favorites.length === 0) {
        setMarkets([]);
        return;
      }
      try {
        const data = await fetchCoinMarkets(favorites.map(f => f.id));
        if (active) setMarkets(data);
      } catch {
        // keep stale
      }
    };
    load();
    return () => { active = false; };
  }, [favorites]);


  useEffect(() => {
    if (favorites.length === 0) return;
    let ws: WebSocket | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;
    let active = true;

    const connect = () => {
      if (!active) return;
      ws = new WebSocket(`wss://stream.binance.com:9443/ws/!miniTicker@arr`);
      ws.onmessage = (event) => {
        try {
          const arr = JSON.parse(event.data) as Array<{ s: string, c: string }>;
          if (Array.isArray(arr)) {
            const updates: Record<string, number> = {};
            arr.forEach(item => {
              const symbol = item.s.toLowerCase().replace("usdt", "");
              updates[symbol] = parseFloat(item.c);
            });
            setLivePrices(prev => ({ ...prev, ...updates }));
          }
        } catch { /* ignore */ }
      };
      ws.onclose = () => { if (active) timer = setTimeout(connect, 3000); };
    };
    connect();
    return () => { active = false; ws?.close(); if (timer) clearTimeout(timer); };
  }, [favorites]);

  useEffect(() => {
    if (!query.trim() || query.length < 2) {
      setSearchResults([]);
      return;
    }
    setSearchLoading(true);
    const controller = new AbortController();
    searchCoins(query, controller.signal).then(setSearchResults).finally(() => setSearchLoading(false));
    return () => controller.abort();
  }, [query]);

  return (
    <main className="relative min-h-screen bg-[#0b0d12] text-white pb-32 font-space">
      <PageHeader
        title="Crypto Watch"
        label="WATCHLIST"
        left={<Link href="/others" className="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center hover:bg-white/10 active:scale-95 transition shrink-0"><ArrowLeft className="w-5 h-5 text-white/80" /></Link>}
      />

      <div className="px-4 pt-4 space-y-4">
        <div className="flex items-center gap-2 bg-white/5 border border-white/10 rounded-2xl px-3.5 py-2.5">
          <Search className="w-4 h-4 text-white/40" />
          <input type="search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search coins..." className="w-full bg-transparent text-sm text-white placeholder:text-white/30 outline-none" />
          {query && <button onClick={() => setQuery("")}><X className="w-4 h-4" /></button>}
        </div>

        <div className="text-xs text-[#9aa3b2] px-1 text-right">{favorites.length}/30 Favorites</div>

        {query.length >= 2 ? (
          <div className="bg-[#151922] border border-[#232938] rounded-2xl divide-y divide-[#232938] overflow-hidden">
            {searchLoading ? <div className="p-8 text-center text-xs">Loading...</div> : searchResults.map(coin => {
              const isFav = favorites.some(f => f.id === coin.id);
              return (
                <div key={coin.id} className="flex items-center gap-3 p-3.5">
                  <Link href={`/crypto/${coin.id}`} className="flex items-center gap-3 flex-1 min-w-0">
                    <img src={coin.large || coin.thumb} alt={coin.name} className="w-8 h-8 rounded-full bg-white/5 object-cover" />
                    <div><p className="text-sm font-semibold">{coin.name}</p><p className="text-xs text-[#9aa3b2] uppercase">{coin.symbol}</p></div>
                  </Link>
                  <button onClick={() => isFav ? removeFavorite(coin.id) : addFavorite({ id: coin.id, name: coin.name, symbol: coin.symbol, large: coin.large, thumb: coin.thumb })}>
                    <Star className={cn("w-5 h-5", isFav ? "text-amber-300 fill-amber-300" : "text-white/40")} />
                  </button>
                </div>
              );
            })}
          </div>
        ) : favorites.length === 0 ? (
          <div className="bg-[#151922] border border-[#232938] rounded-3xl p-10 text-center space-y-4">
             <Star className="w-10 h-10 mx-auto text-white/30" />
             <h2 className="text-sm font-bold">No favorites yet</h2>
          </div>
        ) : (

          <div className="bg-[#151922] border border-[#232938] rounded-[20px] divide-y divide-[#232938] overflow-hidden">
            {favorites.map((fav) => {
              const market = markets.find(m => m.id === fav.id);
              const price = livePrices[fav.symbol.toLowerCase()] || market?.current_price || 0;
              return (
                <Link key={fav.id} href={`/crypto/${fav.id}`} className="flex items-center gap-3 py-3.5 px-4 block">
                  <img src={fav.large || fav.thumb} alt={fav.name} className="w-9 h-9 rounded-full" />
                  <div className="flex-1 min-w-0"><p className="text-sm font-semibold truncate">{fav.name}</p><p className="text-xs text-[#9aa3b2]">{fav.symbol.toUpperCase()}</p></div>
                  <div className="text-right">
                    <p className="text-sm font-bold font-numeric">{price ? formatUSD(price) : "—"}</p>
                    {market && (
                       <div className="flex items-center justify-end gap-1">
                          {market.price_change_percentage_24h > 0 ? <TrendingUp className="w-3 h-3 text-[#3ddc97]" /> : <TrendingDown className="w-3 h-3 text-[#ff6b7a]" />}
                          <span className={cn("text-xs font-semibold", market.price_change_percentage_24h > 0 ? "text-[#3ddc97]" : "text-[#ff6b7a]")}>
                            {market.price_change_percentage_24h.toFixed(2)}%
                          </span>
                       </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </main>
  );
}
