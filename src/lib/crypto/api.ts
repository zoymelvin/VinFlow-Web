export function formatUSD(value: number): string {
  if (value === 0) return "$0.00";
  if (value >= 1000) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(value);
  }
  if (value >= 1) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 2,
      maximumFractionDigits: 4,
    }).format(value);
  }
  if (value >= 0.0001) {
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 4,
      maximumFractionDigits: 6,
    }).format(value);
  }
  return "$" + value.toFixed(8);
}

export function formatCompactUSD(value: number): string {
  if (value >= 1e12) return `$${(value / 1e12).toFixed(2)}T`;
  if (value >= 1e9) return `$${(value / 1e9).toFixed(2)}B`;
  if (value >= 1e6) return `$${(value / 1e6).toFixed(2)}M`;
  if (value >= 1e3) return `$${(value / 1e3).toFixed(2)}K`;
  return formatUSD(value);
}

export interface CoinMarket {
  id: string;
  name: string;
  symbol: string;
  image: string;
  current_price: number;
  market_cap: number;
  market_cap_rank: number;
  total_volume: number;
  high_24h: number;
  low_24h: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  circulating_supply: number;
  total_supply: number;
  max_supply: number;
  ath: number;
  ath_date: string;
  atl: number;
  atl_date: string;
}

export interface CoinSearchResult {
  id: string;
  name: string;
  symbol: string;
  market_cap_rank?: number;
  thumb: string;
  large: string;
}

const CACHE = new Map<string, { data: unknown; expiry: number }>();

const QUEUE: (() => void)[] = [];
let processing = false;

function delay(ms: number) { return new Promise(resolve => setTimeout(resolve, ms)); }

async function processQueue() {
    if (processing || QUEUE.length === 0) return;
    processing = true;
    while (QUEUE.length > 0) {
        const next = QUEUE.shift();
        if (next) next();
        await delay(2000); // 1 request per 2 seconds
    }
    processing = false;
}

async function request<T>(url: string, timeout = 10000): Promise<T> {
  return new Promise((resolve, reject) => {
    QUEUE.push(async () => {
        const controller = new AbortController();
        const id = setTimeout(() => controller.abort(), timeout);
        try {
            const res = await fetch(url, { signal: controller.signal });
            if (res.status === 429) reject(new Error("RATE_LIMIT"));
            else if (!res.ok) reject(new Error(`HTTP_ERROR:${res.status}`));
            else resolve(await res.json());
        } catch (err) {
            reject(err instanceof Error && err.name === 'AbortError' ? new Error("TIMEOUT") : err);
        } finally {
            clearTimeout(id);
        }
    });
    processQueue();
  });
}

export async function fetchCoinMarkets(ids: string[]): Promise<CoinMarket[]> {
  if (ids.length === 0) return [];
  const key = `markets-${ids.join(",")}`;
  const cached = CACHE.get(key);
  if (cached && cached.expiry > Date.now()) return cached.data as CoinMarket[];

  try {
    const data = await request<CoinMarket[]>(`https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=${ids.join(",")}&price_change_percentage=24h`);
    CACHE.set(key, { data, expiry: Date.now() + 60000 });
    return data;
  } catch (err) {
    if (cached) return cached.data as CoinMarket[];
    throw err;
  }
}

export async function searchCoins(query: string, signal?: AbortSignal): Promise<CoinSearchResult[]> {
  if (!query.trim()) return [];
  const res = await fetch(`https://api.coingecko.com/api/v3/search?query=${encodeURIComponent(query)}`, { signal });
  if (!res.ok) throw new Error("Search failed");
  const data = (await res.json()) as { coins?: Array<Record<string, unknown>> };
  return (data.coins || []).slice(0, 20).map((c) => ({
    id: String(c.id || ""),
    name: String(c.name || ""),
    symbol: String(c.symbol || ""),
    market_cap_rank: typeof c.market_cap_rank === "number" ? c.market_cap_rank : undefined,
    thumb: String(c.thumb || ""),
    large: String(c.large || ""),
  }));
}

export async function fetchCoinDetail(id: string): Promise<Record<string, unknown>> {
  const key = `detail-${id}`;
  const cached = CACHE.get(key);
  if (cached && cached.expiry > Date.now()) return cached.data as Record<string, unknown>;

  try {
    const data = await request<Record<string, unknown>>(`https://api.coingecko.com/api/v3/coins/${id}?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false`);
    CACHE.set(key, { data, expiry: Date.now() + 300000 });
    return data;
  } catch (err) {
    if (cached) return cached.data as Record<string, unknown>;
    throw err;
  }
}

export function cleanHtml(html: string): string {
  if (!html) return "";
  return html.replace(/<[^>]*>?/gm, '');
}
