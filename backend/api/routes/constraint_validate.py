import json
import logging

from fastapi import APIRouter
from pydantic import BaseModel

from config import settings
from services.gemini_client import generate

router = APIRouter()
logger = logging.getLogger(__name__)

SYSTEM_PROMPT = (
    "You are a behavioral constraint validator for an AI financial agent system. "
    "A user wants to inject a behavioral constraint. Evaluate if the constraint "
    "is specific and actionable enough to meaningfully affect agent behavior. "
    "A constraint is TOO VAGUE if it is generic, unclear, or lacks specific "
    "conditions or measurable rules. "
    'Return ONLY valid JSON, no other text: '
    '{"is_valid": true/false, "reason": "one sentence explanation", "suggestions": ['
    '{"condition": "...", "rule": "...", "rationale": "..."}, '
    '{"condition": "...", "rule": "...", "rationale": "..."}, '
    '{"condition": "...", "rule": "...", "rationale": "..."}'
    ']} '
    "If is_valid is true, suggestions can be an empty array. "
    "If is_valid is false, suggestions must have exactly 3 specific alternatives "
    "tailored to the target_agent provided."
)


class ConstraintValidateRequest(BaseModel):
    target_agent: str
    condition: str
    rule: str
    rationale: str


@router.post("/constraints/validate")
async def validate_constraint(body: ConstraintValidateRequest):
    user_message = (
        f"Target agent: {body.target_agent}\n"
        f"Condition: {body.condition}\n"
        f"Rule: {body.rule}\n"
        f"Rationale: {body.rationale}"
    )
    try:
        raw = await generate(
            system_prompt=SYSTEM_PROMPT,
            user_message=user_message,
            model=settings.GEMINI_MODEL_JUDGE,
            temperature=0.3,
        )
        return json.loads(raw.strip())
    except (json.JSONDecodeError, ValueError) as exc:
        logger.warning("Failed to parse constraint validation response: %s", exc)
        return {"is_valid": False, "reason": "Validation service unavailable. Please try again.", "suggestions": []}
