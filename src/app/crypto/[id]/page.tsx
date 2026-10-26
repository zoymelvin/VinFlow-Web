"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Star, TrendingUp, TrendingDown, RefreshCw, Copy, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import PageHeader from "@/components/PageHeader";
import { useCryptoStore } from "@/store/useCryptoStore";
import { fetchCoinDetail, formatUSD, formatCompactUSD, cleanHtml } from "@/lib/crypto/api";

export default function CryptoDetailPage() {
  const params = useParams();
  const id = params.id as string;
  const favorites = useCryptoStore((s) => s.favorites);
  const addFavorite = useCryptoStore((s) => s.addFavorite);
  const removeFavorite = useCryptoStore((s) => s.removeFavorite);
  const isFav = favorites.some(f => f.id === id);

  const [data, setData] = useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
        const d = await fetchCoinDetail(id);
        setData(d);
    } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
        setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [id]);

  const copy = (text: string) => {
      navigator.clipboard.writeText(text);
      setCopied(text);
      setTimeout(() => setCopied(null), 2000);
  };

  if (loading && !data) return <div className="p-10 text-center">Loading...</div>;

  const mData = (data?.market_data || {}) as {
    current_price?: { usd: number };
    price_change_percentage_24h?: number;
    market_cap?: { usd: number };
    total_volume?: { usd: number };
  };
  const desc = cleanHtml(String((data?.description as { en: string })?.en || ""));

  return (
    <main className="min-h-screen bg-[#0b0d12] text-white pb-32">
        <PageHeader 
            title={data?.name as string || id} 
            label={data ? `${String(data.symbol).toUpperCase()} · RANK #${data.market_cap_rank as number || "—"}` : ""}
            left={<Link href="/crypto" className="p-2 -ml-2"><ArrowLeft /></Link>} 
            right={data && <button onClick={() => isFav ? removeFavorite(id) : addFavorite({ id, name: String(data.name), symbol: String(data.symbol), thumb: String((data.image as { thumb: string })?.thumb) })}><Star className={cn(isFav ? "text-amber-300 fill-amber-300" : "text-white/40")} /></button>} 
        />
        
        {error && (
            <div className="mx-4 mt-4 p-4 bg-red-900/20 border border-red-500/50 rounded-2xl text-center">
                <p className="text-sm text-red-200 mb-3">{error}</p>
                <button onClick={fetchData} className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-xl text-white text-xs mx-auto"><RefreshCw className="w-3 h-3" /> Try again</button>
            </div>
        )}

        {data && (
            <div className="px-4 pt-5 space-y-4">
                <div className="bg-[#151922] p-4 rounded-2xl">
                    <div className="text-3xl font-bold font-numeric">{formatUSD(mData.current_price?.usd || 0)}</div>
                    <div className={cn("flex items-center gap-1", (mData.price_change_percentage_24h || 0) > 0 ? "text-[#3ddc97]" : "text-[#ff6b7a]")}>
                        {(mData.price_change_percentage_24h || 0) > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                        {(mData.price_change_percentage_24h || 0).toFixed(2)}%
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                    <div className="bg-[#151922] p-4 rounded-2xl">
                        <p className="text-xs text-[#9aa3b2]">Market Cap</p>
                        <p className="font-bold font-numeric">{mData.market_cap?.usd ? formatCompactUSD(mData.market_cap.usd) : "—"}</p>
                    </div>
                    <div className="bg-[#151922] p-4 rounded-2xl">
                        <p className="text-xs text-[#9aa3b2]">Volume 24h</p>
                        <p className="font-bold font-numeric">{mData.total_volume?.usd ? formatCompactUSD(mData.total_volume.usd) : "—"}</p>
                    </div>
                </div>

                <div className="bg-[#151922] p-4 rounded-2xl space-y-2">
                    <p className="text-xs text-[#9aa3b2]">About</p>
                    <p className="text-sm text-white/70">{desc.length > 300 ? desc.slice(0, 300) + "..." : desc}</p>
                </div>

                {typeof data.contract_address === 'string' && (
                    <div className="bg-[#151922] p-4 rounded-2xl flex items-center justify-between">
                        <p className="text-xs text-[#9aa3b2]">Contract</p>
                        <button onClick={() => copy(data.contract_address as string)} className="flex items-center gap-2 text-sm text-blue-400">
                           {(data.contract_address as string).slice(0, 6)}...{(data.contract_address as string).slice(-4)}
                           {copied === data.contract_address ? <Check className="w-4 h-4 text-green-400"/> : <Copy className="w-4 h-4"/>}
                        </button>
                    </div>
                )}
            </div>
        )}
    </main>
  );
}
