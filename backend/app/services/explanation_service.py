"""
Explanation Service - Hybrid Template + LLM explanations for "Why?" feature

This service provides explanations for recommendations by:
1. Matching user state against pre-built template conditions from the database
2. Falling back to self-hosted Ollama (preferred for privacy) or Grok for complex/novel cases
3. Caching LLM-generated explanations for reuse

Privacy Note:
- Ollama (self-hosted) is the default backend - no data leaves your infrastructure
- Grok can be used as fallback but sends user state to external API
- User IDs and session IDs are always stripped before LLM calls
"""

import hashlib
import json
import re
import httpx
from typing import Any, Dict, List, Optional
from datetime import datetime, timedelta

from app.core.config import settings
from app.core.supabase import get_supabase_client
from app.services.rag_service import get_rag_service


GROK_API_URL = "https://api.x.ai/v1/chat/completions"

# Fields to always strip before sending to any LLM (even self-hosted)
SENSITIVE_FIELDS = {"user_id", "session_id", "email", "name", "phone"}

EXPLANATION_PROMPT = """You are an expert climbing coach and sports scientist. A climber is asking "Why?" about a specific recommendation they received.

**Recommendation Type:** {recommendation_type}
**Specific Element:** {target_element}
**Recommendation Message:** {recommendation_message}

**Current User State:**
{user_state_formatted}

**Key Factors Influencing This Recommendation:**
{key_factors_formatted}

Generate a helpful, science-backed explanation for WHY this recommendation was made. Your explanation should:

1. Acknowledge the user's current state in a non-judgmental way
2. Explain the physiological or psychological mechanism behind the recommendation
3. Reference relevant sports science research when applicable (but keep citations brief)
4. Be encouraging and actionable

Return valid JSON with this structure:
{{
  "summary": "2-3 sentence explanation of why this recommendation was made",
  "mechanism": "Brief description of the underlying physiological/psychological mechanism",
  "factors": [
    {{
      "variable": "sleep_quality",
      "value": 4,
      "impact": "Brief explanation of how this factor influenced the recommendation"
    }}
  ],
  "science_note": "Optional brief reference to relevant research (1 sentence, or null)",
  "actionable_tip": "Optional specific tip for addressing this factor (or null)"
}}
"""


class ExplanationService:
    """Service for generating "Why?" explanations for recommendations."""

    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_client()
        self._template_cache: Optional[List[Dict]] = None
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl_seconds = 300  # 5 minutes

    async def get_explanation(
        self,
        recommendation_type: str,
        target_element: Optional[str],
        recommendation_message: str,
        user_state: Dict[str, Any],
        key_factors: List[Dict[str, Any]],
    ) -> Dict[str, Any]:
        """
        Get an explanation for a recommendation.

        First tries to match template conditions from the database.
        Falls back to Grok LLM for complex cases.

        Args:
            recommendation_type: Type of recommendation (warmup, session_structure, rest, etc.)
            target_element: Specific element being explained (extended_warmup, long_rests, etc.)
            recommendation_message: The actual recommendation text
            user_state: Current user state variables
            key_factors: Key factors that influenced this recommendation

        Returns:
            Explanation object with summary, mechanism, factors, etc.
        """
        # Try template match first
        template_explanation = await self._match_template(
            recommendation_type, target_element, user_state
        )

        if template_explanation:
            # Fill placeholders in template
            filled_explanation = self._fill_template(template_explanation, user_state)
            await self._increment_usage(template_explanation["id"])
            return {
                "source": "template",
                "explanation_id": template_explanation["id"],
                **filled_explanation
            }

        # Check cache for LLM-generated explanation
        cache_key = self._generate_cache_key(
            recommendation_type, target_element, user_state, key_factors
        )
        cached = await self._get_from_cache(cache_key)

        if cached:
            return {
                "source": "cached",
                "cache_id": cached["id"],
                **cached["explanation"]
            }

        # Build retrieval-augmented context from priors, rules, templates
        rag = get_rag_service()
        key_vars = [f.get("variable") for f in key_factors if f.get("variable")]
        rag_context = rag.get_explanation_context(recommendation_type, key_vars)

        # Fall back to LLM (Ollama preferred for privacy, Grok as fallback),
        # now conditioning on retrieved context.
        llm_explanation = await self._generate_with_llm(
            recommendation_type,
            target_element,
            recommendation_message,
            user_state,
            key_factors,
            rag_context=rag_context,
        )

        if llm_explanation.get("success"):
            # Cache the LLM response
            cache_id = await self._save_to_cache(
                cache_key, recommendation_type, key_factors,
                user_state, llm_explanation["explanation"]
            )
            return {
                "source": "generated",
                "cache_id": cache_id,
                "backend": llm_explanation.get("backend", "unknown"),
                **llm_explanation["explanation"]
            }

        # Fallback if LLM fails
        return self._generate_fallback_explanation(
            recommendation_type, recommendation_message, key_factors
        )

    async def _load_templates(self) -> List[Dict]:
        """Load active explanation templates from database with caching."""
        now = datetime.utcnow()

        # Check cache validity
        if (self._template_cache is not None and
            self._cache_timestamp is not None and
            (now - self._cache_timestamp).total_seconds() < self._cache_ttl_seconds):
            return self._template_cache

        try:
            result = self.supabase.table("recommendation_explanations").select(
                "id, recommendation_type, target_element, condition_pattern, "
                "explanation_template, short_explanation, factors_explained, "
                "literature_reference, mechanism, confidence, priority"
            ).eq("is_active", True).order("priority", desc=True).execute()

            self._template_cache = result.data or []
            self._cache_timestamp = now
            return self._template_cache
        except Exception as e:
            print(f"Error loading explanation templates: {e}")
            return self._template_cache or []

    async def _match_template(
        self,
        recommendation_type: str,
        target_element: Optional[str],
        user_state: Dict[str, Any]
    ) -> Optional[Dict]:
        """Find the best matching template for the given state."""
        templates = await self._load_templates()

        matching_templates = []

        for template in templates:
            # Check recommendation type
            if template["recommendation_type"] != recommendation_type:
                continue

            # Check target element if specified
            if template["target_element"] and target_element:
                if template["target_element"] != target_element:
                    continue

            # Evaluate condition pattern
            if self._evaluate_condition(template["condition_pattern"], user_state):
                matching_templates.append(template)

        # Return highest priority match
        if matching_templates:
            return matching_templates[0]  # Already sorted by priority desc

        return None

    def _evaluate_condition(self, pattern: Dict, user_state: Dict) -> bool:
        """Evaluate a condition pattern against user state."""
        if not pattern:
            return True

        # Handle ALL (AND) conditions
        if "ALL" in pattern:
            return all(
                self._evaluate_single_condition(cond, user_state)
                for cond in pattern["ALL"]
            )

        # Handle ANY (OR) conditions
        if "ANY" in pattern:
            return any(
                self._evaluate_single_condition(cond, user_state)
                for cond in pattern["ANY"]
            )

        # Single condition
        return self._evaluate_single_condition(pattern, user_state)

    def _evaluate_single_condition(self, cond: Dict, user_state: Dict) -> bool:
        """Evaluate a single condition against user state."""
        variable = cond.get("variable")
        op = cond.get("op")
        value = cond.get("value")

        if variable not in user_state:
            return False

        user_value = user_state[variable]

        if op == "==":
            return user_value == value
        elif op == "!=":
            return user_value != value
        elif op == "<=":
            return user_value <= value
        elif op == ">=":
            return user_value >= value
        elif op == "<":
            return user_value < value
        elif op == ">":
            return user_value > value
        elif op == "in":
            return user_value in value
        elif op == "not_in":
            return user_value not in value

        return False

    def _fill_template(self, template: Dict, user_state: Dict) -> Dict:
        """Fill placeholder values in a template explanation."""
        explanation_text = template["explanation_template"]
        short_text = template.get("short_explanation", "")

        # Replace {variable} placeholders with actual values
        for key, value in user_state.items():
            placeholder = "{" + key + "}"
            if placeholder in explanation_text:
                explanation_text = explanation_text.replace(placeholder, str(value))
            if short_text and placeholder in short_text:
                short_text = short_text.replace(placeholder, str(value))

        # Build factors list from factors_explained
        factors = []
        for var in template.get("factors_explained", []):
            if var in user_state:
                factors.append({
                    "variable": var,
                    "value": user_state[var],
                    "impact": f"This value influenced the {template['recommendation_type']} recommendation"
                })

        return {
            "summary": explanation_text,
            "short_summary": short_text,
            "mechanism": template.get("mechanism"),
            "factors": factors,
            "science_note": template.get("literature_reference"),
            "confidence": template.get("confidence", "medium"),
        }

    async def _increment_usage(self, explanation_id: str):
        """Increment usage count for a template explanation."""
        try:
            self.supabase.rpc("increment_explanation_usage", {
                "explanation_id": explanation_id
            }).execute()
        except Exception as e:
            print(f"Error incrementing explanation usage: {e}")

    def _generate_cache_key(
        self,
        recommendation_type: str,
        target_element: Optional[str],
        user_state: Dict,
        key_factors: List[Dict]
    ) -> str:
        """Generate a cache key for LLM-generated explanations."""
        # Only include relevant state variables
        relevant_vars = set()
        for factor in key_factors:
            if "variable" in factor:
                relevant_vars.add(factor["variable"])

        relevant_state = {k: v for k, v in user_state.items() if k in relevant_vars}

        # Create deterministic string for hashing
        cache_data = {
            "type": recommendation_type,
            "element": target_element,
            "state": relevant_state,
        }
        cache_string = json.dumps(cache_data, sort_keys=True)

        return hashlib.sha256(cache_string.encode()).hexdigest()[:32]

    async def _get_from_cache(self, cache_key: str) -> Optional[Dict]:
        """Get a cached explanation if available and not expired."""
        try:
            result = self.supabase.table("explanation_cache").select("*").eq(
                "cache_key", cache_key
            ).gt("expires_at", datetime.utcnow().isoformat()).single().execute()

            if result.data:
                # Update last accessed time and hit count
                self.supabase.table("explanation_cache").update({
                    "last_accessed_at": datetime.utcnow().isoformat(),
                    "hit_count": result.data["hit_count"] + 1
                }).eq("id", result.data["id"]).execute()

                return result.data
        except Exception:
            pass

        return None

    async def _save_to_cache(
        self,
        cache_key: str,
        recommendation_type: str,
        key_factors: List[Dict],
        user_state: Dict,
        explanation: Dict
    ) -> Optional[str]:
        """Save an LLM-generated explanation to cache."""
        try:
            # Create a hash of relevant user state
            state_hash = hashlib.sha256(
                json.dumps(user_state, sort_keys=True).encode()
            ).hexdigest()[:16]

            # Set a reasonable TTL (e.g. 30 days) for cached explanations
            now = datetime.utcnow()
            expires_at = now + timedelta(days=30)

            result = self.supabase.table("explanation_cache").insert({
                "cache_key": cache_key,
                "explanation": explanation,
                "recommendation_type": recommendation_type,
                "key_factors": key_factors,
                "user_state_hash": state_hash,
                "created_at": now.isoformat(),
                "last_accessed_at": now.isoformat(),
                "expires_at": expires_at.isoformat(),
            }).execute()

            if result.data:
                return result.data[0]["id"]
        except Exception as e:
            print(f"Error caching explanation: {e}")

        return None

    def _sanitize_for_llm(self, user_state: Dict[str, Any]) -> Dict[str, Any]:
        """Remove sensitive fields before sending to LLM."""
        return {
            k: v for k, v in user_state.items()
            if k not in SENSITIVE_FIELDS and v is not None
        }

    async def _generate_with_llm(
        self,
        recommendation_type: str,
        target_element: Optional[str],
        recommendation_message: str,
        user_state: Dict[str, Any],
        key_factors: List[Dict[str, Any]],
        rag_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Route LLM generation to configured backend.

        Priority:
        1. Ollama (self-hosted) - if configured and available
        2. Grok (external API) - fallback if Ollama fails/unavailable
        """
        backend = settings.LLM_BACKEND.lower()

        # Sanitize user state for privacy
        safe_state = self._sanitize_for_llm(user_state)

        if backend == "ollama":
            # Try Ollama first
            result = await self._generate_with_ollama(
                recommendation_type,
                target_element,
                recommendation_message,
                safe_state,
                key_factors,
                rag_context=rag_context,
            )
            if result.get("success"):
                result["backend"] = "ollama"
                return result

            # Fall back to Grok if Ollama fails and Grok is configured
            if settings.GROK_API_KEY:
                print("[ExplanationService] Ollama failed, falling back to Grok")
                result = await self._generate_with_grok(
                    recommendation_type,
                    target_element,
                    recommendation_message,
                    safe_state,
                    key_factors,
                    rag_context=rag_context,
                )
                if result.get("success"):
                    result["backend"] = "grok"
                return result

            return result  # Return Ollama error

        elif backend == "grok":
            if not settings.GROK_API_KEY:
                return {"success": False, "error": "GROK_API_KEY not configured"}

            result = await self._generate_with_grok(
                recommendation_type,
                target_element,
                recommendation_message,
                safe_state,
                key_factors,
                rag_context=rag_context,
            )
            if result.get("success"):
                result["backend"] = "grok"
            return result

        else:
            return {"success": False, "error": f"Unknown LLM backend: {backend}"}

    async def _generate_with_ollama(
        self,
        recommendation_type: str,
        target_element: Optional[str],
        recommendation_message: str,
        user_state: Dict[str, Any],
        key_factors: List[Dict[str, Any]],
        rag_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate an explanation using self-hosted Ollama."""
        ollama_url = settings.OLLAMA_URL.rstrip("/")
        model = settings.OLLAMA_MODEL

        # Format user state for prompt
        user_state_formatted = "\n".join([
            f"- {k}: {v}" for k, v in user_state.items()
        ])

        # Format key factors for prompt
        key_factors_formatted = "\n".join([
            f"- {f.get('variable', 'unknown')}: {f.get('description', f.get('effect', 'affects recommendation'))}"
            for f in key_factors
        ]) or "No specific key factors identified."

        base_prompt = EXPLANATION_PROMPT.format(
            recommendation_type=recommendation_type,
            target_element=target_element or "general",
            recommendation_message=recommendation_message,
            user_state_formatted=user_state_formatted,
            key_factors_formatted=key_factors_formatted,
        )
        if rag_context:
            prompt = f"{base_prompt}\n\n[Retrieved Context]\n{rag_context}"
        else:
            prompt = base_prompt

        try:
            async with httpx.AsyncClient(timeout=45.0) as client:
                response = await client.post(
                    f"{ollama_url}/api/generate",
                    json={
                        "model": model,
                        "prompt": f"You are an expert climbing coach. Respond with valid JSON only, no markdown.\n\n{prompt}",
                        "stream": False,
                        "format": "json",
                        "options": {
                            "temperature": 0.4,
                            # Explanations are short; reducing num_predict lowers latency
                            "num_predict": 400,
                        }
                    }
                )

                if response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"Ollama API error: {response.status_code}"
                    }

                result = response.json()
                content = result.get("response", "")

                # Parse JSON response
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]

                explanation = json.loads(content.strip())

                return {
                    "success": True,
                    "explanation": explanation,
                }

        except json.JSONDecodeError as e:
            return {"success": False, "error": f"Failed to parse Ollama response: {e}"}
        except httpx.ConnectError:
            return {"success": False, "error": "Could not connect to Ollama service"}
        except httpx.TimeoutException:
            return {"success": False, "error": "Ollama request timed out"}
        except Exception as e:
            return {"success": False, "error": f"Error with Ollama: {e}"}

    async def _generate_with_grok(
        self,
        recommendation_type: str,
        target_element: Optional[str],
        recommendation_message: str,
        user_state: Dict[str, Any],
        key_factors: List[Dict[str, Any]],
        rag_context: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Generate an explanation using Grok LLM."""
        if not settings.GROK_API_KEY:
            return {"success": False, "error": "GROK_API_KEY not configured"}

        # Format user state for prompt
        user_state_formatted = "\n".join([
            f"- {k}: {v}" for k, v in user_state.items()
            if v is not None and k not in ["user_id", "session_id"]
        ])

        # Format key factors for prompt
        key_factors_formatted = "\n".join([
            f"- {f.get('variable', 'unknown')}: {f.get('description', f.get('effect', 'affects recommendation'))}"
            for f in key_factors
        ]) or "No specific key factors identified."

        base_prompt = EXPLANATION_PROMPT.format(
            recommendation_type=recommendation_type,
            target_element=target_element or "general",
            recommendation_message=recommendation_message,
            user_state_formatted=user_state_formatted,
            key_factors_formatted=key_factors_formatted,
        )
        if rag_context:
            prompt = f"{base_prompt}\n\n[Retrieved Context]\n{rag_context}"
        else:
            prompt = base_prompt

        try:
            async with httpx.AsyncClient(timeout=30.0) as client:
                response = await client.post(
                    GROK_API_URL,
                    headers={
                        "Authorization": f"Bearer {settings.GROK_API_KEY}",
                        "Content-Type": "application/json",
                    },
                    json={
                        "model": "grok-4-1-fast-reasoning",
                        "messages": [
                            {
                                "role": "system",
                                "content": "You are an expert climbing coach. Always respond with valid JSON only, no markdown formatting."
                            },
                            {
                                "role": "user",
                                "content": prompt
                            }
                        ],
                        "temperature": 0.4,
                        "max_tokens": 1000,
                    }
                )

                if response.status_code != 200:
                    return {
                        "success": False,
                        "error": f"Grok API error: {response.status_code}"
                    }

                result = response.json()
                content = result.get("choices", [{}])[0].get("message", {}).get("content", "")

                # Parse JSON response (handle markdown code blocks)
                if "```json" in content:
                    content = content.split("```json")[1].split("```")[0]
                elif "```" in content:
                    content = content.split("```")[1].split("```")[0]

                explanation = json.loads(content.strip())

                return {
                    "success": True,
                    "explanation": explanation,
                }

        except json.JSONDecodeError as e:
            return {"success": False, "error": f"Failed to parse Grok response: {e}"}
        except httpx.TimeoutException:
            return {"success": False, "error": "Grok API request timed out"}
        except Exception as e:
            return {"success": False, "error": f"Error generating explanation: {e}"}

    def _generate_fallback_explanation(
        self,
        recommendation_type: str,
        recommendation_message: str,
        key_factors: List[Dict]
    ) -> Dict[str, Any]:
        """Generate a basic fallback explanation when LLM fails."""
        # Build factors list from key_factors
        factors = []
        for factor in key_factors:
            factors.append({
                "variable": factor.get("variable", "unknown"),
                "value": factor.get("value"),
                "impact": factor.get("description", f"This factor influenced the recommendation")
            })

        return {
            "source": "fallback",
            "summary": f"This {recommendation_type} recommendation is based on your current physical and mental state. {recommendation_message}",
            "mechanism": None,
            "factors": factors,
            "science_note": None,
            "confidence": "low",
        }

    async def submit_feedback(
        self,
        user_id: str,
        recommendation_type: str,
        explanation_shown: Dict,
        was_helpful: bool,
        clarity_rating: Optional[int] = None,
        feedback_text: Optional[str] = None,
        session_id: Optional[str] = None,
        explanation_id: Optional[str] = None,
        cache_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """Submit user feedback on an explanation."""
        try:
            result = self.supabase.table("explanation_feedback").insert({
                "user_id": user_id,
                "recommendation_type": recommendation_type,
                "explanation_id": explanation_id,
                "cache_id": cache_id,
                "explanation_shown": explanation_shown,
                "was_helpful": was_helpful,
                "clarity_rating": clarity_rating,
                "feedback_text": feedback_text,
                "session_id": session_id,
            }).execute()

            # Update feedback counts on template if applicable
            if explanation_id:
                if was_helpful:
                    self.supabase.rpc("increment_positive_feedback", {
                        "explanation_id": explanation_id
                    }).execute()
                else:
                    self.supabase.rpc("increment_negative_feedback", {
                        "explanation_id": explanation_id
                    }).execute()

            # Update cache feedback if applicable
            if cache_id:
                self.supabase.table("explanation_cache").update({
                    "was_helpful": was_helpful,
                    "feedback_text": feedback_text,
                }).eq("id", cache_id).execute()

            return {"success": True, "feedback_id": result.data[0]["id"] if result.data else None}

        except Exception as e:
            return {"success": False, "error": str(e)}


# Singleton instance
_explanation_service: Optional[ExplanationService] = None


def get_explanation_service() -> ExplanationService:
    """Get or create the explanation service singleton."""
    global _explanation_service
    if _explanation_service is None:
        _explanation_service = ExplanationService()
    return _explanation_service
