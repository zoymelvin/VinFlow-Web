# VinFlow

VinFlow is a premium personal finance tracker app. Track expenses, manage budgets, and visualize your financial health directly on your device.

## About
VinFlow is a privacy-first personal finance tracker that keeps your data securely on your device using browser local storage. It provides a comprehensive dashboard to track your daily expenses, manage budgets, and achieve your financial goals without requiring any server-side account or cloud login.

The application is mobile-first, designed for a seamless experience on devices around 390px, featuring a clean UI, dark mode, and complete control over your financial data. All amounts are formatted in IDR (Rupiah), and the interface is fully in English.

## Features

### Money Management
- **Wallets**: Manage multiple accounts (Bank, E-Wallet, Cash) with real-time balance tracking.
- **Transactions**: Add daily expenses and income with categories, dates, and notes.
- **History**: View and filter your past transactions with detailed insights.
- **Reports**: Visualize your spending habits and financial health with donut charts and smart insights.
- **Budgets**: Set monthly spending limits for different categories.
- **Goals**: Create savings goals and track your progress.

### Smart Tools
- **Scan Receipt**: Automatically extract transaction details from receipts using Gemini AI (requires API key).
- **Crypto Watch**: Monitor your favorite cryptocurrencies with live market data provided by CoinGecko.

### Experience
- **Hide Balances**: Toggle balance visibility for privacy.
- **PWA Ready**: Installable on your device for a native-like experience.
- **Privacy-first**: No server-side account, no cloud storage, data lives only on your device.

## Tech Stack
| Area | Technology |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript strict |
| UI | React 18, Tailwind CSS, shadcn/ui |
| State | zustand + persist |
| AI | Google Gemini API (via server route) |
| Data Providers | CoinGecko API |
| Hosting | Vercel |

## Getting Started

### Prerequisites
- Node.js 18+ (LTS recommended)
- npm or pnpm

### Installation
```bash
git clone https://github.com/zoymelvin/VinFlow-Web.git
cd VinFlow-Web
npm install
cp .env.example .env.local
```

### Environment variables
| Variable | Required | Description |
|---|---|---|
| `GEMINI_API_KEY` | Yes (for Scan) | API key from Google AI Studio. |

> **Warning**: Never commit `.env.local` to version control.

### Run
```bash
npm run dev      # Start development server
npm run build    # Production build
npm run lint     # Linting
npm test         # Run tests
```

## Data & Privacy
- All financial data is stored locally in your browser's local storage via `zustand`. 
- No personal data is sent to any server, except for receipt images sent to Gemini API when using the "Scan Receipt" feature.
- Clearing your browser data will permanently remove all application data.

## License
License: not yet specified.

## Acknowledgements
- [Next.js](https://nextjs.org/)
- [Tailwind CSS](https://tailwindcss.com/)
- [shadcn/ui](https://ui.shadcn.com/)
- [Zustand](https://zustand-demo.pmnd.rs/)
- [Google Gemini API](https://aistudio.google.com/)
- [CoinGecko API](https://www.coingecko.com/en/api)
EOF
