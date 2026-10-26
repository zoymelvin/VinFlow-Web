const providers = [
  { 
    name: 'CoinGecko', 
    url: 'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false' 
  },
  { 
    name: 'Coinpaprika', 
    url: 'https://api.coinpaprika.com/v1/coins/btc-bitcoin' 
  }
];

async function runBenchmark() {
  for (const p of providers) {
    const start = Date.now();
    try {
      const res = await fetch(p.url);
      const latency = Date.now() - start;
      const data = await res.json();
      console.log(`--- ${p.name} ---`);
      console.log(`Status: ${res.status}`);
      console.log(`Latency: ${latency}ms`);
      console.log(`CORS Allow Origin: ${res.headers.get('access-control-allow-origin') || 'None'}`);
      console.log(`Rate Limit (if any): ${res.headers.get('x-ratelimit-remaining') || 'Not provided'}`);
      console.log(`Keys present: ${Object.keys(data).length}`);
    } catch (e) {
      console.error(`--- ${p.name} ---`);
      console.error(`Error: ${e.message}`);
    }
  }
}
runBenchmark();
