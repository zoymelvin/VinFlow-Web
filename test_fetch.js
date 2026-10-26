async function test() {
  const urls = [
    'https://api.coingecko.com/api/v3/coins/sui?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false',
    'https://api.coingecko.com/api/v3/coins/bitcoin?localization=false&tickers=false&market_data=true&community_data=false&developer_data=false&sparkline=false'
  ];
  
  for (const url of urls) {
    try {
      const res = await fetch(url);
      console.log('URL:', url);
      console.log('Status:', res.status);
      console.log('Headers:', Object.fromEntries(res.headers.entries()));
      const data = await res.json();
      console.log('Response keys:', Object.keys(data));
    } catch (e) {
      console.error('Error for', url, e.message);
    }
  }
}
test();
