export interface CryptoCoin {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  market_cap_rank: number;
  price_change_percentage_24h: number;
  sparkline_in_7d?: { price: number[] };
}

const STABLECOINS = new Set(["tether", "usd-coin", "dai", "binance-usd", "frax", "true-usd", "usdd", "pax-dollar", "gemini-dollar"]);

export async function fetchHypedCrypto(): Promise<CryptoCoin[]> {
  try {
    // 1. Get Trending
    const trendingRes = await fetch("https://api.coingecko.com/api/v3/search/trending", { next: { revalidate: 60 } });
    const trendingData: { coins: { item: { id: string } }[] } = await trendingRes.json();
    const trendingIds = trendingData.coins.map((c) => c.item.id);

    // 2. Get Top by Volume
    const marketRes = await fetch("https://api.coingecko.com/api/v3/coins/markets?vs_currency=idr&order=volume_desc&per_page=100&sparkline=true&price_change_percentage=24h", { next: { revalidate: 60 } });
    const marketData: CryptoCoin[] = await marketRes.json();
    
    // 3. Build List
    const result: CryptoCoin[] = [];
    const usedIds = new Set<string>();

    for (const id of trendingIds) {
      const match = marketData.find(c => c.id === id);
      if (match) {
        result.push(match);
        usedIds.add(id);
      }
    }

    for (const coin of marketData) {
      if (result.length >= 20) break;
      if (usedIds.has(coin.id)) continue;
      if (STABLECOINS.has(coin.id)) continue;
      result.push(coin);
      usedIds.add(coin.id);
    }

    return result;
  } catch (e) {
    console.error("Crypto API error:", e);
    throw e;
  }
}
