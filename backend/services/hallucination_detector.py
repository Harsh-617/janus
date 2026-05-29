import asyncio
import logging
import re

import pandas as pd
import yfinance as yf

logger = logging.getLogger(__name__)

# Keywords that indicate the agent is characterising an asset as defensive/safe
_DEFENSIVE_KEYWORDS = re.compile(
    r"\b(defensive|safe haven|low[- ]risk|stable)\b", re.IGNORECASE
)

# Keywords that indicate the agent is claiming two assets are uncorrelated / a hedge
_UNCORRELATED_KEYWORDS = re.compile(
    r"\b(uncorrelated|inversely correlated|hedge against|not correlated)\b",
    re.IGNORECASE,
)

# Keywords that indicate the agent is claiming diversification
_DIVERSIFICATION_KEYWORDS = re.compile(
    r"\b(diversified|balanced|spread across sectors?)\b", re.IGNORECASE
)

# Simple ticker extractor — finds 1-5 uppercase letters optionally followed by -USD
_TICKER_RE = re.compile(r"\b([A-Z]{1,5}(?:-USD)?)\b")


def _extract_tickers(text: str) -> list[str]:
    return list(dict.fromkeys(_TICKER_RE.findall(text)))


class HallucinationDetector:
    async def check(
        self,
        reasoning: str,
        proposed_trades: list,
        portfolio: dict,
    ) -> list[dict]:
        flags: list[dict] = []
        flags.extend(await self._beta_check(reasoning, proposed_trades))
        flags.extend(await self._correlation_check(reasoning, proposed_trades))
        flags.extend(self._concentration_check(reasoning, proposed_trades, portfolio))
        return flags

    # ------------------------------------------------------------------
    # CHECK 1 — Beta mismatch
    # ------------------------------------------------------------------
    async def _beta_check(
        self, reasoning: str, proposed_trades: list
    ) -> list[dict]:
        if not _DEFENSIVE_KEYWORDS.search(reasoning):
            return []

        flags = []
        tickers = [t.get("ticker") for t in proposed_trades if t.get("ticker")]

        for ticker in tickers:
            try:
                info = await asyncio.to_thread(lambda: yf.Ticker(ticker).info)
                beta = info.get("beta")
                if beta is None:
                    continue
                if beta > 1.0:
                    flags.append({
                        "check": "BETA_MISMATCH",
                        "ticker": ticker,
                        "claimed": "defensive positioning",
                        "actual_beta": round(float(beta), 4),
                        "flag": (
                            f"Agent characterized {ticker} as defensive but "
                            f"beta={round(float(beta), 2)} (>1.0, not defensive)"
                        ),
                    })
            except Exception as exc:
                logger.warning("[HallucinationDetector] beta_check %s: %s", ticker, exc)
        return flags

    # ------------------------------------------------------------------
    # CHECK 2 — Correlation direction mismatch
    # ------------------------------------------------------------------
    async def _correlation_check(
        self, reasoning: str, proposed_trades: list
    ) -> list[dict]:
        if not _UNCORRELATED_KEYWORDS.search(reasoning):
            return []

        # Collect unique tickers mentioned in proposed trades
        tickers = list(dict.fromkeys(
            t.get("ticker") for t in proposed_trades if t.get("ticker")
        ))

        if len(tickers) < 2:
            return []

        flags = []

        # Check every pair
        try:
            raw = await asyncio.to_thread(
                lambda: yf.download(
                    tickers,
                    period="90d",
                    interval="1d",
                    auto_adjust=True,
                    progress=False,
                )
            )
            if raw.empty:
                return []

            # yfinance returns MultiIndex columns when >1 ticker
            if isinstance(raw.columns, pd.MultiIndex):
                close = raw["Close"]
            else:
                close = raw[["Close"]] if "Close" in raw.columns else raw

            close = close.dropna(how="all")

            for i in range(len(tickers)):
                for j in range(i + 1, len(tickers)):
                    t1, t2 = tickers[i], tickers[j]
                    try:
                        col1 = close[t1] if t1 in close.columns else None
                        col2 = close[t2] if t2 in close.columns else None
                        if col1 is None or col2 is None:
                            continue
                        corr = float(col1.corr(col2))
                        if pd.isna(corr):
                            continue
                        if corr > 0.3:
                            flags.append({
                                "check": "CORRELATION_MISMATCH",
                                "tickers": [t1, t2],
                                "claimed": "uncorrelated",
                                "actual_correlation": round(corr, 4),
                                "flag": (
                                    f"Agent claimed {t1} and {t2} are uncorrelated "
                                    f"but 90-day correlation={round(corr, 2)}"
                                ),
                            })
                    except Exception as exc:
                        logger.warning(
                            "[HallucinationDetector] correlation pair (%s, %s): %s",
                            t1, t2, exc,
                        )

        except Exception as exc:
            logger.warning("[HallucinationDetector] correlation_check download: %s", exc)

        return flags

    # ------------------------------------------------------------------
    # CHECK 3 — Concentration mismatch
    # ------------------------------------------------------------------
    def _concentration_check(
        self, reasoning: str, proposed_trades: list, portfolio: dict
    ) -> list[dict]:
        if not _DIVERSIFICATION_KEYWORDS.search(reasoning):
            return []

        flags = []
        try:
            positions: dict = dict(portfolio.get("positions", {}))
            cash = float(portfolio.get("cash", 0))

            # Apply proposed trades to get post-trade positions
            for trade in proposed_trades:
                ticker = trade.get("ticker")
                direction = str(trade.get("direction", "")).upper()
                quantity = float(trade.get("quantity", 0))
                price = float(trade.get("price", 0))
                if not ticker or quantity <= 0:
                    continue

                if ticker not in positions:
                    positions[ticker] = {"shares": 0, "current_price": price or 1}

                pos = dict(positions[ticker])
                if direction == "BUY":
                    pos["shares"] = float(pos.get("shares", 0)) + quantity
                    if price:
                        pos["current_price"] = price
                elif direction == "SELL":
                    pos["shares"] = max(0.0, float(pos.get("shares", 0)) - quantity)
                positions[ticker] = pos

            # Compute total value
            total = cash
            for pos in positions.values():
                shares = float(pos.get("shares", 0))
                price_val = float(pos.get("current_price", 0))
                total += shares * price_val

            if total <= 0:
                return []

            for ticker, pos in positions.items():
                shares = float(pos.get("shares", 0))
                price_val = float(pos.get("current_price", 0))
                position_value = shares * price_val
                concentration = position_value / total
                if concentration > 0.35:
                    flags.append({
                        "check": "CONCENTRATION_MISMATCH",
                        "ticker": ticker,
                        "claimed": "diversified portfolio",
                        "actual_concentration": round(concentration, 4),
                        "flag": (
                            f"Agent claimed diversification but {ticker} would be "
                            f"{round(concentration * 100, 1)}% of portfolio"
                        ),
                    })

        except Exception as exc:
            logger.warning(
                "[HallucinationDetector] concentration_check: %s", exc
            )

        return flags
