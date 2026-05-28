import logging

logger = logging.getLogger(__name__)


class ConstraintEnforcer:
    """Mechanically enforces behavioral constraints on a trading proposal.

    Runs four checks in order: max trades, position size, forbidden actions,
    cash floor. Each check parses the constraint rule text via keyword matching.
    """

    def enforce(self, proposal: dict, constraints: list[dict], portfolio: dict) -> dict:
        trades = list(proposal.get("trades", []))
        violations: list[dict] = []
        modifications: list[str] = []

        # CHECK 1: Max trades per cycle
        for c in constraints:
            rule = c.get("rule", "")
            cid = c.get("constraint_id", "unknown")
            rule_lower = rule.lower()
            if any(kw in rule_lower for kw in ("max", "maximum", "no more than")) and "trade" in rule_lower:
                trades, v = self._check_max_trades(trades, rule, cid, modifications)
                if v:
                    violations.append(v)

        # CHECK 2: Position size limit
        for c in constraints:
            rule = c.get("rule", "")
            cid = c.get("constraint_id", "unknown")
            rule_lower = rule.lower()
            if "%" in rule and any(kw in rule_lower for kw in ("position siz", "max position", "reduce position")):
                new_trades, vs = self._check_position_size(trades, rule, cid, portfolio, modifications)
                trades = new_trades
                violations.extend(vs)

        # CHECK 3: Forbidden actions
        for c in constraints:
            rule = c.get("rule", "")
            cid = c.get("constraint_id", "unknown")
            rule_lower = rule.lower()
            if any(kw in rule_lower for kw in ("no buy", "no sell", "hold only", "no trades in")):
                new_trades, vs = self._check_forbidden_actions(trades, rule, cid, modifications)
                trades = new_trades
                violations.extend(vs)

        # CHECK 4: Cash floor
        for c in constraints:
            rule = c.get("rule", "")
            cid = c.get("constraint_id", "unknown")
            rule_lower = rule.lower()
            if "cash" in rule_lower and "%" in rule and any(kw in rule_lower for kw in ("maintain", "cash floor")):
                new_trades, vs = self._check_cash_floor(trades, rule, cid, portfolio, modifications)
                trades = new_trades
                violations.extend(vs)

        # Log debug for constraints that matched no check
        matched_ids = {v["constraint_id"] for v in violations}
        for c in constraints:
            cid = c.get("constraint_id", "unknown")
            rule = c.get("rule", "")
            rule_lower = rule.lower()
            already_matched = (
                (any(kw in rule_lower for kw in ("max", "maximum", "no more than")) and "trade" in rule_lower)
                or ("%" in rule and any(kw in rule_lower for kw in ("position siz", "max position", "reduce position")))
                or any(kw in rule_lower for kw in ("no buy", "no sell", "hold only", "no trades in"))
                or ("cash" in rule_lower and "%" in rule and any(kw in rule_lower for kw in ("maintain", "cash floor")))
            )
            if not already_matched:
                logger.debug(f"[ConstraintEnforcer] No matching pattern for constraint '{cid}': {rule}")

        modified_proposal = {**proposal, "trades": trades}
        return {
            "passed": len(violations) == 0,
            "proposal": modified_proposal,
            "violations": violations,
            "modifications": modifications,
        }

    def _check_max_trades(
        self, trades: list, rule: str, constraint_id: str, modifications: list
    ) -> tuple[list, dict | None]:
        words = rule.lower().replace(",", "").split()
        n = None

        for i, word in enumerate(words):
            if word in ("max", "maximum") and i + 1 < len(words):
                try:
                    n = int(words[i + 1])
                    break
                except ValueError:
                    pass
            if word == "than" and i + 1 < len(words):  # "no more than N"
                try:
                    n = int(words[i + 1])
                    break
                except ValueError:
                    pass

        if n is None:
            logger.debug(f"[ConstraintEnforcer] Max trades: could not parse N from '{rule}'")
            return trades, None

        if len(trades) > n:
            sorted_trades = sorted(trades, key=lambda t: t.get("confidence", 0.0), reverse=True)
            trimmed = sorted_trades[:n]
            violation = {
                "constraint_id": constraint_id,
                "rule": rule,
                "violation": f"Proposed {len(trades)} trades",
                "action": "TRIMMED",
            }
            modifications.append(f"Trimmed trade count from {len(trades)} to {n}")
            logger.info(f"[ConstraintEnforcer] {constraint_id}: trimmed {len(trades)} trades to {n}")
            return trimmed, violation

        return trades, None

    def _check_position_size(
        self, trades: list, rule: str, constraint_id: str, portfolio: dict, modifications: list
    ) -> tuple[list, list]:
        limit_pct = self._extract_pct(rule)
        if limit_pct is None:
            logger.debug(f"[ConstraintEnforcer] Position size: could not parse % from '{rule}'")
            return trades, []

        total_value = float(portfolio.get("total_value", 0))
        if total_value <= 0:
            return trades, []

        positions = portfolio.get("positions", {})
        violations: list[dict] = []
        updated_trades: list[dict] = []

        for trade in trades:
            ticker = trade.get("ticker", "")
            direction = trade.get("direction", "").upper()
            quantity = float(trade.get("quantity", 0))

            pos = positions.get(ticker, {})
            current_shares = float(pos.get("shares", 0))
            current_price = float(pos.get("current_price", 0))

            if current_price <= 0:
                updated_trades.append(trade)
                continue

            current_position_value = current_shares * current_price

            if direction == "BUY":
                new_position_value = current_position_value + quantity * current_price
            elif direction == "SELL":
                new_position_value = max(0.0, current_position_value - quantity * current_price)
            else:
                updated_trades.append(trade)
                continue

            new_pct = (new_position_value / total_value) * 100

            if new_pct > limit_pct:
                max_new_position_value = (limit_pct / 100) * total_value
                allowable_delta = max_new_position_value - current_position_value

                if allowable_delta <= 0:
                    new_qty = 0.0
                else:
                    new_qty = allowable_delta / current_price

                updated_trades.append({**trade, "quantity": round(new_qty, 4)})
                modifications.append(
                    f"Scaled {ticker} {direction} quantity from {quantity} to {round(new_qty, 4)}"
                )
                violations.append({
                    "constraint_id": constraint_id,
                    "rule": rule,
                    "violation": f"{ticker} position would reach {new_pct:.1f}% of portfolio (limit {limit_pct}%)",
                    "action": "TRIMMED",
                })
                logger.info(
                    f"[ConstraintEnforcer] {constraint_id}: scaled {ticker} to {limit_pct}% limit"
                )
            else:
                updated_trades.append(trade)

        return updated_trades, violations

    def _check_forbidden_actions(
        self, trades: list, rule: str, constraint_id: str, modifications: list
    ) -> tuple[list, list]:
        rule_lower = rule.lower()
        violations: list[dict] = []
        updated_trades: list[dict] = []

        # Parse forbidden ticker for "no trades in TICKER"
        forbidden_ticker: str | None = None
        if "no trades in" in rule_lower:
            idx = rule_lower.find("no trades in")
            after = rule[idx + len("no trades in"):].strip()
            # Strip surrounding brackets if present
            token = after.strip("[]()").split()[0] if after.split() else ""
            forbidden_ticker = token.upper() if token else None

        for trade in trades:
            direction = trade.get("direction", "").upper()
            ticker = trade.get("ticker", "").upper()
            blocked = False

            if "no buy" in rule_lower and direction == "BUY":
                blocked = True
            elif "no sell" in rule_lower and direction == "SELL":
                blocked = True
            elif "hold only" in rule_lower and direction in ("BUY", "SELL"):
                blocked = True
            elif forbidden_ticker and ticker == forbidden_ticker:
                blocked = True

            if blocked:
                violations.append({
                    "constraint_id": constraint_id,
                    "rule": rule,
                    "violation": f"{direction} {ticker} is forbidden by this constraint",
                    "action": "BLOCKED",
                })
                modifications.append(f"Blocked {direction} {ticker}")
                logger.info(f"[ConstraintEnforcer] {constraint_id}: blocked {direction} {ticker}")
            else:
                updated_trades.append(trade)

        return updated_trades, violations

    def _check_cash_floor(
        self, trades: list, rule: str, constraint_id: str, portfolio: dict, modifications: list
    ) -> tuple[list, list]:
        floor_pct = self._extract_pct(rule)
        if floor_pct is None:
            logger.debug(f"[ConstraintEnforcer] Cash floor: could not parse % from '{rule}'")
            return trades, []

        total_value = float(portfolio.get("total_value", 0))
        if total_value <= 0:
            return trades, []

        positions = portfolio.get("positions", {})
        cash = float(portfolio.get("cash", 0))
        violations: list[dict] = []
        remaining_trades = list(trades)

        while True:
            net_cash_spent = sum(
                float(t.get("quantity", 0)) * float(positions.get(t.get("ticker", ""), {}).get("current_price", 0))
                for t in remaining_trades
                if t.get("direction", "").upper() == "BUY"
            )
            projected_cash = cash - net_cash_spent
            projected_cash_pct = (projected_cash / total_value) * 100

            if projected_cash_pct >= floor_pct:
                break

            buy_trades_indexed = [
                (i, t) for i, t in enumerate(remaining_trades)
                if t.get("direction", "").upper() == "BUY"
            ]
            if not buy_trades_indexed:
                break

            def _cost(idx_trade: tuple) -> float:
                _, t = idx_trade
                ticker = t.get("ticker", "")
                qty = float(t.get("quantity", 0))
                price = float(positions.get(ticker, {}).get("current_price", 0))
                return qty * price

            most_expensive_idx, most_expensive = max(buy_trades_indexed, key=_cost)
            ticker = most_expensive.get("ticker", "UNKNOWN")

            violations.append({
                "constraint_id": constraint_id,
                "rule": rule,
                "violation": f"Projected cash {projected_cash_pct:.1f}% would fall below floor {floor_pct}%",
                "action": "TRIMMED",
            })
            modifications.append(f"Removed BUY {ticker} to maintain {floor_pct}% cash floor")
            logger.info(
                f"[ConstraintEnforcer] {constraint_id}: removed BUY {ticker} to maintain cash floor"
            )
            remaining_trades = [t for i, t in enumerate(remaining_trades) if i != most_expensive_idx]

        return remaining_trades, violations

    def _extract_pct(self, text: str) -> float | None:
        """Extract the first percentage value from text (looks for 'N%' or 'N %')."""
        words = text.replace(",", "").split()
        for i, word in enumerate(words):
            # Handle "25%" attached
            if "%" in word:
                cleaned = word.replace("%", "")
                try:
                    val = float(cleaned)
                    if 0 < val <= 100:
                        return val
                except ValueError:
                    pass
            # Handle "25 %" separated
            if i + 1 < len(words) and words[i + 1] == "%":
                try:
                    val = float(word)
                    if 0 < val <= 100:
                        return val
                except ValueError:
                    pass
        return None
