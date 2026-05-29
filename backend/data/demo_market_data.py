DEMO_PRICES = {
    "AAPL": 213.49,
    "GLD": 315.23,
    "BTC-USD": 68420.00,
    "TLT": 91.45,
    "XOM": 118.32,
    "KRE": 44.87,
    "ETH-USD": 3842.10,
    "AMZN": 198.45,
    "MSFT": 415.23,
    "JPM": 198.67,
}

DEMO_NEWS = [
    {
        "title": "Federal Reserve signals potential rate cuts amid cooling inflation data",
        "summary": "Fed officials indicate two rate cuts possible in H2 2026 as CPI drops to 2.8%",
        "sentiment": "positive",
        "tickers": ["TLT", "GLD"],
        "timestamp": "2026-06-01T09:00:00Z",
    },
    {
        "title": "AAPL announces record Q2 earnings, beats estimates by 12%",
        "summary": "Apple reports $1.52 EPS vs $1.36 expected, services revenue up 18% YoY",
        "sentiment": "positive",
        "tickers": ["AAPL"],
        "timestamp": "2026-06-01T08:30:00Z",
    },
    {
        "title": "Oil supply concerns mount as OPEC+ announces production cuts",
        "summary": "Cartel reduces output by 1.2M barrels/day, energy stocks surge",
        "sentiment": "positive",
        "tickers": ["XOM"],
        "timestamp": "2026-06-01T07:45:00Z",
    },
    {
        "title": "Bitcoin ETF inflows hit monthly record as institutional adoption grows",
        "summary": "Spot BTC ETFs see $2.1B inflows in May, largest month since January",
        "sentiment": "positive",
        "tickers": ["BTC-USD"],
        "timestamp": "2026-06-01T07:00:00Z",
    },
    {
        "title": "Regional bank stress tests show improved capital ratios",
        "summary": "Fed stress tests reveal KRE constituents hold 12.4% average CET1 ratio",
        "sentiment": "neutral",
        "tickers": ["KRE"],
        "timestamp": "2026-06-01T06:30:00Z",
    },
]

DEMO_VOLATILITY = "MODERATE"
DEMO_NEWS_VOLUME = 3

OIL_SHOCK_PRICES = {
    "AAPL": 192.15,
    "GLD": 338.90,
    "BTC-USD": 61200.00,
    "TLT": 88.20,
    "XOM": 139.45,
    "KRE": 41.20,
    "ETH-USD": 3210.50,
    "AMZN": 178.90,
    "MSFT": 389.45,
    "JPM": 185.20,
}

OIL_SHOCK_NEWS = [
    {
        "title": "BREAKING: Major oil producer announces export restrictions amid regional conflict",
        "summary": "Brent crude surges 18% as supply fears grip markets. Energy stocks rallying.",
        "sentiment": "negative",
        "tickers": ["XOM", "GLD", "TLT"],
        "timestamp": "2026-06-01T10:00:00Z",
    },
    {
        "title": "Tech stocks tumble as energy costs spike — AAPL supply chain at risk",
        "summary": "Higher energy costs threaten margins across semiconductor and device makers",
        "sentiment": "negative",
        "tickers": ["AAPL"],
        "timestamp": "2026-06-01T10:05:00Z",
    },
    {
        "title": "Gold surges to 6-month high as geopolitical risk premium rises",
        "summary": "Safe haven demand drives GLD up 7.4% in morning session",
        "sentiment": "positive",
        "tickers": ["GLD"],
        "timestamp": "2026-06-01T10:10:00Z",
    },
    {
        "title": "Crypto markets sell off on risk-off sentiment",
        "summary": "Bitcoin drops 10% as traders move to cash and commodities",
        "sentiment": "negative",
        "tickers": ["BTC-USD", "ETH-USD"],
        "timestamp": "2026-06-01T10:15:00Z",
    },
    {
        "title": "Regional banks face liquidity pressure as energy loan exposure rises",
        "summary": "KRE index drops 6.2% on concerns about energy sector loan defaults",
        "sentiment": "negative",
        "tickers": ["KRE"],
        "timestamp": "2026-06-01T10:20:00Z",
    },
    {
        "title": "Tech giants face margin pressure as energy costs spike",
        "summary": "AMZN and MSFT cloud infrastructure costs rise with energy prices",
        "sentiment": "negative",
        "tickers": ["AMZN", "MSFT"],
        "timestamp": "2026-06-01T10:25:00Z",
    },
]

OIL_SHOCK_VOLATILITY = "HIGH"
OIL_SHOCK_NEWS_VOLUME = 7
