from db.firestore_client import get_portfolio, save_portfolio
from config import settings
import logging


async def apply_trade_to_portfolio(
    portfolio_id: str, trade: dict, current_prices: dict[str, float]
) -> bool:
    """Apply a single executed trade to the portfolio.

    Updates: positions (shares, avg_cost, current_price), cash balance.
    Returns True on success, False on failure.

    trade format: {
        "ticker": "AAPL",
        "direction": "BUY" or "SELL",
        "quantity": 50,   # number of shares
        "confidence": 0.8,
        "rationale": "..."
    }
    """
    try:
        portfolio = await get_portfolio(portfolio_id)
        if not portfolio:
            logging.error(
                f"[PortfolioService] Portfolio {portfolio_id} not found"
            )
            return False

        ticker = trade.get("ticker")
        direction = trade.get("direction", "").upper()
        quantity = float(trade.get("quantity", 0))

        if quantity <= 0:
            logging.warning(
                f"[PortfolioService] Invalid quantity {quantity} for {ticker}"
            )
            return False

        # Get current price (from current_prices dict, or from existing position)
        price = current_prices.get(ticker)
        if price is None:
            # Fall back to position's current_price if we have it
            existing = portfolio.get("positions", {}).get(ticker, {})
            price = existing.get("current_price", 0)

        if price <= 0:
            logging.warning(
                f"[PortfolioService] No valid price for {ticker}"
            )
            return False

        trade_value = quantity * price
        positions = portfolio.get("positions", {})
        cash = float(portfolio.get("cash", 0))

        if direction == "BUY":
            # Check cash availability
            if trade_value > cash:
                quantity = cash / price  # buy as much as we can afford
                trade_value = quantity * price
                logging.info(
                    f"[PortfolioService] Adjusted BUY quantity to {quantity:.2f} (cash constraint)"
                )

            if quantity <= 0:
                logging.warning(
                    f"[PortfolioService] Insufficient cash for {ticker} BUY"
                )
                return False

            # Update position
            if ticker in positions:
                existing = positions[ticker]
                existing_shares = float(existing.get("shares", 0))
                existing_avg_cost = float(existing.get("avg_cost", price))
                new_shares = existing_shares + quantity

                # Weighted average cost
                new_avg_cost = (
                    (existing_shares * existing_avg_cost) + trade_value
                ) / new_shares

                positions[ticker] = {
                    **existing,
                    "shares": round(new_shares, 4),
                    "avg_cost": round(new_avg_cost, 2),
                    "current_price": round(price, 2),
                }
            else:
                # New position
                positions[ticker] = {
                    "shares": round(quantity, 4),
                    "avg_cost": round(price, 2),
                    "current_price": round(price, 2),
                    "sector": _get_sector(ticker),
                }

            cash -= trade_value

        elif direction == "SELL":
            if ticker not in positions:
                logging.warning(
                    f"[PortfolioService] Cannot SELL {ticker} — not in portfolio"
                )
                return False

            existing = positions[ticker]
            existing_shares = float(existing.get("shares", 0))

            # Cap sell quantity at what we own
            quantity = min(quantity, existing_shares)
            trade_value = quantity * price

            new_shares = existing_shares - quantity

            if new_shares <= 0.001:  # essentially zero
                del positions[ticker]  # close position
            else:
                positions[ticker] = {
                    **existing,
                    "shares": round(new_shares, 4),
                    "current_price": round(price, 2),
                }

            cash += trade_value

        else:
            logging.warning(
                f"[PortfolioService] Unknown direction: {direction}"
            )
            return False

        # Update prices for all positions we have current data for
        for pos_ticker, pos_data in positions.items():
            if pos_ticker in current_prices:
                positions[pos_ticker]["current_price"] = round(
                    current_prices[pos_ticker], 2
                )

        # Recalculate total value and P&L
        total_position_value = sum(
            float(pos.get("shares", 0)) * float(pos.get("current_price", 0))
            for pos in positions.values()
        )
        total_value = total_position_value + cash

        initial_capital = float(portfolio.get("initial_capital", 1_000_000))
        pnl_pct = ((total_value - initial_capital) / initial_capital) * 100

        # Save updated portfolio
        updated_portfolio = {
            **portfolio,
            "cash": round(max(cash, 0), 2),
            "total_value": round(total_value, 2),
            "pnl_pct": round(pnl_pct, 4),
            "positions": positions,
        }

        await save_portfolio(portfolio_id, updated_portfolio)

        logging.info(
            f"[PortfolioService] {direction} {quantity:.2f} {ticker} @ ${price:.2f} — Cash: ${cash:.2f}"
        )
        return True

    except Exception as e:
        logging.error(f"[PortfolioService] Error applying trade: {e}")
        return False


async def update_portfolio_prices(
    portfolio_id: str, current_prices: dict[str, float]
) -> None:
    """Update current_price for all positions and recalculate total_value."""
    try:
        portfolio = await get_portfolio(portfolio_id)
        if not portfolio:
            return

        positions = portfolio.get("positions", {})
        updated = False

        for ticker, pos_data in positions.items():
            if ticker in current_prices:
                new_price = current_prices[ticker]
                if (
                    abs(new_price - float(pos_data.get("current_price", 0)))
                    > 0.01
                ):
                    positions[ticker] = {
                        **pos_data,
                        "current_price": round(new_price, 2),
                    }
                    updated = True

        if updated:
            cash = float(portfolio.get("cash", 0))
            total_position_value = sum(
                float(pos.get("shares", 0))
                * float(pos.get("current_price", 0))
                for pos in positions.values()
            )
            total_value = total_position_value + cash

            initial_capital = float(
                portfolio.get("initial_capital", 1_000_000)
            )
            pnl_pct = ((total_value - initial_capital) / initial_capital) * 100

            await save_portfolio(
                portfolio_id,
                {
                    **portfolio,
                    "positions": positions,
                    "total_value": round(total_value, 2),
                    "pnl_pct": round(pnl_pct, 4),
                },
            )

    except Exception as e:
        logging.error(f"[PortfolioService] Error updating prices: {e}")


def _get_sector(ticker: str) -> str:
    """Map ticker to sector for new positions."""
    SECTOR_MAP = {
        "AAPL": "Technology",
        "MSFT": "Technology",
        "GOOGL": "Technology",
        "AMZN": "Technology",
        "XOM": "Energy",
        "CVX": "Energy",
        "GLD": "Commodities",
        "SLV": "Commodities",
        "BTC-USD": "Crypto",
        "ETH-USD": "Crypto",
        "TLT": "Bonds",
        "IEF": "Bonds",
        "KRE": "Financials",
        "SPY": "Index",
        "QQQ": "Index",
    }
    return SECTOR_MAP.get(ticker, "Equities")
