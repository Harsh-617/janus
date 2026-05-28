import logging
import uuid
from datetime import datetime, timezone

logger = logging.getLogger(__name__)

ASSET_CLASSES = ["energy", "commodities", "crypto", "bonds", "equities"]

REDUCE_KEYWORDS = ["reduce", "decrease", "sell", "cut", "lower", "limit"]
INCREASE_KEYWORDS = ["increase", "buy", "add", "raise", "boost", "expand"]

CONDITION_KEYWORDS = [
    "high volatility",
    "oil shock",
    "market shock",
    "low liquidity",
    "circuit breaker",
    "news_volume",
]

_COMMON_WORDS = {
    "WHEN", "HIGH", "LOW", "MAX", "MIN", "THAN", "ABOVE", "BELOW",
    "WITH", "UNDER", "OVER", "INTO", "FROM", "EACH", "THIS", "THAT",
    "THEN", "ALSO", "ONLY", "BOTH", "SUCH", "SAME", "MORE", "LESS",
    "NEXT", "LAST", "VERY", "MOST", "SOME", "HAVE", "BEEN", "WILL",
}


class ConstraintConflictDetector:
    """Detects conflicts between a new constraint and existing active constraints.

    All checks use keyword matching — no LLM, no regex.
    """

    def detect(self, new_constraint: dict, active_constraints: list[dict]) -> list[dict]:
        """Return a list of conflict dicts (empty if none detected)."""
        conflicts: list[dict] = []
        new_id = new_constraint.get("constraint_id", "")

        for existing in active_constraints:
            if existing.get("constraint_id") == new_id:
                continue

            conflict = (
                self._check_directional_opposition(new_constraint, existing)
                or self._check_condition_overlap(new_constraint, existing)
                or self._check_numeric_contradiction(new_constraint, existing)
                or self._check_cash_floor_contradiction(new_constraint, existing)
            )
            if conflict:
                conflicts.append(conflict)

        return conflicts

    def adjudicate(self, conflict: dict, constraint_a: dict, constraint_b: dict) -> dict:
        """Return a recommended resolution for the given conflict.

        constraint_a is the existing constraint; constraint_b is the new one.
        """
        conflict_type = conflict.get("conflict_type", "")
        severity = conflict.get("severity", "LOW")

        if conflict_type == "DIRECTIONAL_OPPOSITION":
            recommendation = "PREFER_NEWER"
            a_time = constraint_a.get("generated_at", "")
            b_time = constraint_b.get("generated_at", "")
            if b_time >= a_time:
                newer_id = constraint_b.get("constraint_id", "")
                older_id = constraint_a.get("constraint_id", "")
                action = "SUSPEND_A"
            else:
                newer_id = constraint_a.get("constraint_id", "")
                older_id = constraint_b.get("constraint_id", "")
                action = "SUSPEND_B"
            reasoning = (
                f"Constraint #{newer_id} is newer and more likely reflects recent learning. "
                f"Recommend suspending #{older_id} to eliminate the directional contradiction."
            )

        elif conflict_type == "CONDITION_OVERLAP":
            recommendation = "PREFER_STRICTER"
            action = "SUSPEND_LESS_STRICT"
            reasoning = (
                "Both constraints apply under the same condition. "
                "The stricter (more conservative) rule should take precedence to maintain safety."
            )

        elif conflict_type == "NUMERIC_CONTRADICTION":
            recommendation = "PREFER_STRICTER"
            action = "SUSPEND_LESS_STRICT"
            reasoning = (
                "Numeric limits conflict. The lower (stricter) limit is safer and should be enforced. "
                "The constraint with the higher limit should be suspended."
            )

        else:
            recommendation = "MANUAL_REVIEW"
            action = "SUSPEND_BOTH"
            reasoning = "Conflict type is unrecognised — requires human review."

        if severity == "HIGH":
            reasoning += " MANUAL_REVIEW recommended due to HIGH severity."

        return {
            "conflict_id": conflict["conflict_id"],
            "recommendation": recommendation,
            "reasoning": reasoning,
            "action": action,
        }

    # ── CHECK 1: Directional Opposition ──────────────────────────────────────

    def _check_directional_opposition(self, c_new: dict, c_existing: dict) -> dict | None:
        rule_new = c_new.get("rule", "").lower()
        rule_existing = c_existing.get("rule", "").lower()

        new_reduces = any(kw in rule_new for kw in REDUCE_KEYWORDS)
        new_increases = any(kw in rule_new for kw in INCREASE_KEYWORDS)
        existing_reduces = any(kw in rule_existing for kw in REDUCE_KEYWORDS)
        existing_increases = any(kw in rule_existing for kw in INCREASE_KEYWORDS)

        opposite = (new_reduces and existing_increases) or (new_increases and existing_reduces)
        if not opposite:
            return None

        shared = self._shared_subject(rule_new, rule_existing)
        if not shared:
            return None

        return {
            "conflict_id": self._make_conflict_id(),
            "constraint_a_id": c_existing.get("constraint_id", ""),
            "constraint_b_id": c_new.get("constraint_id", ""),
            "conflict_type": "DIRECTIONAL_OPPOSITION",
            "description": (
                f"Constraint #{c_existing.get('constraint_id')} and "
                f"#{c_new.get('constraint_id')} give opposite directions for '{shared}'. "
                "One reduces/sells while the other increases/buys — both conditions can be "
                "true simultaneously."
            ),
            "severity": "HIGH",
            "detected_at": datetime.now(timezone.utc).isoformat(),
        }

    # ── CHECK 2: Condition Overlap ────────────────────────────────────────────

    def _check_condition_overlap(self, c_new: dict, c_existing: dict) -> dict | None:
        cond_new = c_new.get("condition", "").lower()
        cond_existing = c_existing.get("condition", "").lower()
        rule_new = c_new.get("rule", "").lower()
        rule_existing = c_existing.get("rule", "").lower()

        shared_condition: str | None = None
        for kw in CONDITION_KEYWORDS:
            if kw in cond_new and kw in cond_existing:
                shared_condition = kw
                break
        if not shared_condition:
            return None

        if c_new.get("target_agent") != c_existing.get("target_agent"):
            return None

        if rule_new == rule_existing:
            return None

        new_reduces = any(kw in rule_new for kw in REDUCE_KEYWORDS)
        new_increases = any(kw in rule_new for kw in INCREASE_KEYWORDS)
        existing_reduces = any(kw in rule_existing for kw in REDUCE_KEYWORDS)
        existing_increases = any(kw in rule_existing for kw in INCREASE_KEYWORDS)

        # Only conflict if they'd produce different directions
        same_direction = (new_reduces == existing_reduces) and (new_increases == existing_increases)
        if same_direction:
            return None

        agent = c_new.get("target_agent", "")
        return {
            "conflict_id": self._make_conflict_id(),
            "constraint_a_id": c_existing.get("constraint_id", ""),
            "constraint_b_id": c_new.get("constraint_id", ""),
            "conflict_type": "CONDITION_OVERLAP",
            "description": (
                f"Both constraints apply under '{shared_condition}' but prescribe "
                f"different actions for {agent}. Active simultaneously, they create "
                "contradictory instructions for the same agent under the same condition."
            ),
            "severity": "MEDIUM",
            "detected_at": datetime.now(timezone.utc).isoformat(),
        }

    # ── CHECK 3: Numeric Contradiction ───────────────────────────────────────

    def _check_numeric_contradiction(self, c_new: dict, c_existing: dict) -> dict | None:
        rule_new = c_new.get("rule", "").lower()
        rule_existing = c_existing.get("rule", "").lower()

        # Max trades
        n_new = self._extract_max_trades(rule_new)
        n_existing = self._extract_max_trades(rule_existing)
        if n_new is not None and n_existing is not None and n_new != n_existing:
            if c_new.get("target_agent") == c_existing.get("target_agent"):
                return {
                    "conflict_id": self._make_conflict_id(),
                    "constraint_a_id": c_existing.get("constraint_id", ""),
                    "constraint_b_id": c_new.get("constraint_id", ""),
                    "conflict_type": "NUMERIC_CONTRADICTION",
                    "description": (
                        f"Constraint #{c_existing.get('constraint_id')} sets max {n_existing} trades "
                        f"but #{c_new.get('constraint_id')} sets max {n_new} trades. "
                        f"Both target {c_new.get('target_agent')} — only one limit can apply."
                    ),
                    "severity": "MEDIUM",
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                }

        # Position size limit
        pct_new = self._extract_position_pct(rule_new)
        pct_existing = self._extract_position_pct(rule_existing)
        if pct_new is not None and pct_existing is not None and pct_new != pct_existing:
            if c_new.get("target_agent") == c_existing.get("target_agent"):
                return {
                    "conflict_id": self._make_conflict_id(),
                    "constraint_a_id": c_existing.get("constraint_id", ""),
                    "constraint_b_id": c_new.get("constraint_id", ""),
                    "conflict_type": "NUMERIC_CONTRADICTION",
                    "description": (
                        f"Constraint #{c_existing.get('constraint_id')} sets max {pct_existing}% position "
                        f"but #{c_new.get('constraint_id')} sets max {pct_new}% position. "
                        f"Conflicting size limits for {c_new.get('target_agent')}."
                    ),
                    "severity": "MEDIUM",
                    "detected_at": datetime.now(timezone.utc).isoformat(),
                }

        return None

    # ── CHECK 4: Cash Floor Contradiction ────────────────────────────────────

    def _check_cash_floor_contradiction(self, c_new: dict, c_existing: dict) -> dict | None:
        rule_new = c_new.get("rule", "").lower()
        rule_existing = c_existing.get("rule", "").lower()

        if not (self._is_cash_floor(rule_new) and self._is_cash_floor(rule_existing)):
            return None

        floor_new = self._extract_pct(rule_new)
        floor_existing = self._extract_pct(rule_existing)

        if floor_new is None or floor_existing is None or floor_new == floor_existing:
            return None

        return {
            "conflict_id": self._make_conflict_id(),
            "constraint_a_id": c_existing.get("constraint_id", ""),
            "constraint_b_id": c_new.get("constraint_id", ""),
            "conflict_type": "NUMERIC_CONTRADICTION",
            "description": (
                f"Constraint #{c_existing.get('constraint_id')} sets cash floor at {floor_existing}% "
                f"but #{c_new.get('constraint_id')} sets it at {floor_new}%. "
                "Two different cash floors cannot both be enforced simultaneously."
            ),
            "severity": "LOW",
            "detected_at": datetime.now(timezone.utc).isoformat(),
        }

    # ── Helpers ───────────────────────────────────────────────────────────────

    def _shared_subject(self, rule_a: str, rule_b: str) -> str | None:
        for asset in ASSET_CLASSES:
            if asset in rule_a and asset in rule_b:
                return asset
        tokens_a = {
            t.upper() for t in rule_a.split()
            if 2 <= len(t) <= 5 and t.isalpha()
        } - _COMMON_WORDS
        tokens_b = {
            t.upper() for t in rule_b.split()
            if 2 <= len(t) <= 5 and t.isalpha()
        } - _COMMON_WORDS
        shared = tokens_a & tokens_b
        return next(iter(shared)) if shared else None

    def _extract_max_trades(self, rule: str) -> int | None:
        if "trade" not in rule:
            return None
        if not any(kw in rule for kw in ("max", "maximum", "no more than")):
            return None
        words = rule.replace(",", "").split()
        for i, word in enumerate(words):
            if word in ("max", "maximum") and i + 1 < len(words):
                try:
                    return int(words[i + 1])
                except ValueError:
                    pass
            if word == "than" and i + 1 < len(words):
                try:
                    return int(words[i + 1])
                except ValueError:
                    pass
        return None

    def _extract_position_pct(self, rule: str) -> float | None:
        if not any(kw in rule for kw in ("position siz", "max position", "position limit")):
            return None
        return self._extract_pct(rule)

    def _is_cash_floor(self, rule: str) -> bool:
        return "cash" in rule and any(
            kw in rule for kw in ("floor", "maintain", "minimum cash", "cash floor")
        )

    def _extract_pct(self, text: str) -> float | None:
        words = text.replace(",", "").split()
        for i, word in enumerate(words):
            if "%" in word:
                try:
                    val = float(word.replace("%", ""))
                    if 0 < val <= 100:
                        return val
                except ValueError:
                    pass
            if i + 1 < len(words) and words[i + 1] == "%":
                try:
                    val = float(word)
                    if 0 < val <= 100:
                        return val
                except ValueError:
                    pass
        return None

    def _make_conflict_id(self) -> str:
        today = datetime.now(timezone.utc).strftime("%Y%m%d")
        uid = str(uuid.uuid4())[:8]
        return f"conflict_{today}_{uid}"
