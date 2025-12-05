"""
SSE Streaming Recommendation Serving

Main recommendation endpoint with Server-Sent Events streaming.
Implements the architecture spec flow:
1. Load user context (instant)
2. Check expert rules FIRST (instant)
3. If no rule override: compute model prediction + counterfactuals (instant)
4. Compute statistical context (instant)
5. Stream NLG explanations via Claude (1-2 seconds)
"""

import json
from datetime import datetime
from typing import AsyncIterator, Dict, Any, Optional, List

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

from app.core.supabase import get_supabase_client
from app.api.routes.expert_capture.rule_engine import RuleEngine
from app.services.statistical_context import compute_statistical_context


router = APIRouter()


class PreSessionRequest(BaseModel):
    """Request body for pre-session recommendations"""
    user_id: str
    
    # Current conditions
    sleep_hours: Optional[float] = None
    sleep_quality: Optional[int] = None
    energy_level: Optional[int] = None
    stress_level: Optional[int] = None
    motivation_level: Optional[int] = None
    soreness_level: Optional[int] = None
    
    # Recovery
    days_since_last_session: Optional[int] = None
    days_since_hard_session: Optional[int] = None
    
    # Session intent
    planned_session_type: Optional[str] = None
    planned_caffeine_mg: Optional[int] = 0
    planned_warmup_min: Optional[int] = None
    planned_intensity: Optional[str] = None
    time_available_min: Optional[int] = None
    time_of_day: Optional[str] = None
    session_goal: Optional[str] = None
    
    # Injury status
    current_niggles: Optional[List[Dict]] = None
    
    # Psychological
    performance_anxiety: Optional[int] = None
    
    class Config:
        extra = "allow"


def sse_event(event: str, data: dict) -> str:
    """Format data as Server-Sent Event."""
    return f"event: {event}\ndata: {json.dumps(data)}\n\n"


async def load_user_context(user_id: str, supabase) -> Dict[str, Any]:
    """Load all user context needed for recommendations."""
    context = {
        "user_id": user_id,
        "coefficients": {},
        "baseline": {},
        "history": [],
        "population_stats": {},
        "phase": "cold_start"
    }
    
    # Load user coefficients from model_outputs
    model_result = supabase.table("model_outputs")\
        .select("*")\
        .eq("user_id", user_id)\
        .execute()
    
    if model_result.data:
        model = model_result.data[0]
        context["coefficients"] = model.get("coefficients", {})
        context["phase"] = model.get("phase", "cold_start")
        context["sessions_included"] = model.get("sessions_included", 0)
        context["confidence_intervals"] = model.get("confidence_intervals", {})
    
    # Load baseline assessment
    baseline_result = supabase.table("baseline_assessments")\
        .select("*")\
        .eq("user_id", user_id)\
        .eq("is_current", True)\
        .execute()
    
    if baseline_result.data:
        context["baseline"] = baseline_result.data[0]
    
    # Load recent session history (last 30 sessions)
    history_result = supabase.table("climbing_sessions")\
        .select("*, pre_session_data, post_session_data")\
        .eq("user_id", user_id)\
        .eq("status", "completed")\
        .order("started_at", desc=True)\
        .limit(30)\
        .execute()
    
    context["history"] = history_result.data or []
    
    # Load population statistics
    stats_result = supabase.table("population_priors")\
        .select("*")\
        .eq("is_current", True)\
        .execute()
    
    for prior in (stats_result.data or []):
        var_name = prior["variable_name"]
        context["population_stats"][var_name] = {
            "mean": prior["population_mean"],
            "std": prior["population_std"],
            "optimal_min": prior.get("optimal_min"),
            "optimal_max": prior.get("optimal_max")
        }
        # Also store coefficient-level stats
        context["population_stats"][f"{var_name}_coefficient"] = {
            "mean": prior["population_mean"],
            "std": prior["population_std"]
        }
    
    return context


def build_user_state(context: Dict, current_conditions: Dict) -> Dict[str, Any]:
    """Combine baseline and current conditions into rule-checkable state."""
    state = {}
    
    # Add baseline fields with prefix
    baseline = context.get("baseline", {})
    for key, value in baseline.items():
        if key not in ["id", "user_id", "created_at", "updated_at", "assessed_at", "is_current"]:
            state[f"baseline.{key}"] = value
            state[key] = value  # Also add without prefix for convenience
    
    # Add current conditions with prefix
    for key, value in current_conditions.items():
        if value is not None:
            state[f"pre_session.{key}"] = value
            state[key] = value  # Also add without prefix
    
    return state


async def check_rules(user_state: Dict, supabase) -> Optional[Dict]:
    """Check all expert rules against user state."""
    rule_engine = RuleEngine(supabase)
    matched_rules = rule_engine.match_rules(user_state)
    
    if not matched_rules:
        return None
    
    # Apply rules and check for overrides
    result = rule_engine.apply_rules(matched_rules, {}, {})
    
    if result.get("overridden"):
        # Return the override details
        return {
            "type": "rule_override",
            "rules_applied": result.get("rules_applied", []),
            "recommendations": result.get("recommendations", {}),
            "warnings": result.get("warnings", []),
            "message": result["warnings"][0]["message"] if result.get("warnings") else "Expert rule triggered"
        }
    
    # Return rules info without override
    return {
        "type": "rules_applied",
        "rules_applied": result.get("rules_applied", []),
        "warnings": result.get("warnings", []),
        "modifiers": result.get("modifiers", [])
    }


def predict_quality(coefficients: Dict, conditions: Dict, population_priors: Dict) -> Dict[str, Any]:
    """Predict session quality using user coefficients."""
    # If no user coefficients, use population priors
    if not coefficients:
        coefficients = {k: v.get("mean", 0) for k, v in population_priors.items() if "coefficient" not in k}
    
    # Base quality
    intercept = coefficients.get("intercept", 5.0)
    quality = intercept
    
    # Variable contributions
    contributions = {}
    variables = [
        ("sleep_hours", 0),
        ("sleep_quality", 0),
        ("energy_level", 0),
        ("stress_level", 0),
        ("motivation_level", 0),
        ("soreness_level", 0),
        ("days_since_hard_session", 0),
        ("planned_caffeine_mg", 0),
        ("planned_warmup_min", 0)
    ]
    
    for var, default in variables:
        if var in conditions and conditions[var] is not None:
            coef = coefficients.get(var, population_priors.get(var, {}).get("mean", 0))
            value = conditions[var]
            
            # Normalize around typical values
            if var in ["sleep_hours"]:
                normalized = value - 7  # Center around 7 hours
            elif var in ["energy_level", "motivation_level"]:
                normalized = value - 5  # Center around 5 (1-10 scale)
            elif var in ["stress_level", "soreness_level"]:
                normalized = value - 3  # Center around 3 (1-5 scale)
            elif var == "planned_caffeine_mg":
                normalized = value / 100  # Per 100mg
            elif var == "planned_warmup_min":
                normalized = (value - 15) / 10  # Relative to 15 min
            else:
                normalized = value
            
            contribution = coef * normalized
            quality += contribution
            contributions[var] = round(contribution, 3)
    
    # Clamp to 1-10 range
    quality = max(1.0, min(10.0, quality))
    
    # Calculate confidence interval (simplified)
    std_error = 0.8 if len(coefficients) > 5 else 1.2  # Narrower with personalization
    
    return {
        "expected_quality": round(quality, 1),
        "confidence_interval": [round(max(1, quality - 1.96 * std_error), 1), 
                                round(min(10, quality + 1.96 * std_error), 1)],
        "contributions": contributions
    }


def generate_counterfactuals(
    coefficients: Dict, 
    conditions: Dict, 
    predicted_quality: float,
    population_priors: Dict
) -> List[Dict]:
    """Generate actionable recommendations as counterfactuals."""
    counterfactuals = []
    
    # For each modifiable variable, calculate potential improvement
    modifiable_vars = {
        "planned_caffeine_mg": {
            "target_range": [100, 200],
            "label": "Caffeine",
            "unit": "mg",
            "actionable": True
        },
        "planned_warmup_min": {
            "target_range": [15, 25],
            "label": "Warmup Duration",
            "unit": "min",
            "actionable": True
        },
        "planned_intensity": {
            "targets": ["moderate", "high"],
            "label": "Session Intensity",
            "actionable": True
        },
        "planned_session_type": {
            "targets": ["volume", "technique", "project"],
            "label": "Session Type",
            "actionable": True
        }
    }
    
    for var, config in modifiable_vars.items():
        current_value = conditions.get(var)
        coef = coefficients.get(var, population_priors.get(var, {}).get("mean", 0))
        
        if "target_range" in config:
            target_min, target_max = config["target_range"]
            
            if current_value is None or current_value < target_min:
                # Suggest increasing to target
                target = target_min
                if current_value is not None:
                    improvement = abs(coef * (target - current_value))
                else:
                    improvement = abs(coef * target) * 0.5  # Estimate
                
                if improvement > 0.05:  # Only suggest if meaningful improvement
                    counterfactuals.append({
                        "variable": var,
                        "current_value": current_value,
                        "recommended_value": target,
                        "expected_improvement": round(improvement, 2),
                        "new_expected_quality": round(min(10, predicted_quality + improvement), 1),
                        "label": config["label"],
                        "unit": config.get("unit", ""),
                        "importance": "helpful" if improvement < 0.3 else "recommended" if improvement < 0.6 else "critical",
                        "actionable": True
                    })
    
    # Sort by expected improvement
    counterfactuals.sort(key=lambda x: x["expected_improvement"], reverse=True)
    
    return counterfactuals[:5]  # Return top 5 recommendations


def determine_session_type(quality: float, conditions: Dict, rules_result: Optional[Dict]) -> str:
    """Determine recommended session type based on predicted quality and conditions."""
    # Check for rule overrides first
    if rules_result and rules_result.get("type") == "rule_override":
        recommendations = rules_result.get("recommendations", {})
        if recommendations:
            return recommendations.get("session_type", "volume")
    
    energy = conditions.get("energy_level", 5)
    motivation = conditions.get("motivation_level", 5)
    stress = conditions.get("stress_level", 3)
    soreness = conditions.get("soreness_level", 2)
    
    # High quality + high motivation = projecting
    if quality >= 7.5 and motivation >= 4 and energy >= 4:
        return "project"
    
    # High quality, good energy = volume
    if quality >= 7 and energy >= 3:
        return "volume"
    
    # Moderate quality, high soreness = technique
    if quality >= 5.5 and soreness >= 3:
        return "technique"
    
    # Moderate quality
    if quality >= 5:
        return "volume"
    
    # Lower quality
    if quality >= 4:
        return "light_session"
    
    # Low quality
    if quality >= 3:
        return "active_recovery"
    
    return "rest_day"


@router.post("/pre-session/stream")
async def stream_pre_session_recommendations(
    request: PreSessionRequest
) -> StreamingResponse:
    """
    Main recommendation endpoint with SSE streaming.
    
    Flow:
    1. Load user context (coefficients, baseline, history, population stats)
    2. Check expert rules (fire BEFORE model)
    3. If no rule override: compute model prediction + counterfactuals
    4. Compute statistical context (z-scores, percentiles, personal comparisons)
    5. Stream results via Server-Sent Events
    """
    
    async def event_stream() -> AsyncIterator[str]:
        supabase = get_supabase_client()
        
        try:
            # Phase 1: Load context (instant)
            yield sse_event("status", {"phase": "loading_context"})
            
            context = await load_user_context(request.user_id, supabase)
            
            yield sse_event("context_loaded", {
                "phase": context.get("phase", "cold_start"),
                "sessions_available": len(context.get("history", [])),
                "has_baseline": bool(context.get("baseline")),
                "has_personalization": bool(context.get("coefficients"))
            })
            
            # Build current conditions dict
            current_conditions = {
                k: v for k, v in request.model_dump().items()
                if v is not None and k != "user_id"
            }
            
            # Phase 2: Rule check (instant)
            yield sse_event("status", {"phase": "checking_rules"})
            
            user_state = build_user_state(context, current_conditions)
            rules_result = await check_rules(user_state, supabase)
            
            if rules_result and rules_result.get("type") == "rule_override":
                # Rule override - skip model
                yield sse_event("rule_override", {
                    "rules": rules_result.get("rules_applied", []),
                    "message": rules_result.get("message"),
                    "warnings": rules_result.get("warnings", []),
                    "recommendation": rules_result.get("recommendations", {})
                })
                yield sse_event("done", {"source": "rule_override"})
                return
            
            # Report non-override rules
            if rules_result and rules_result.get("rules_applied"):
                yield sse_event("rules_applied", {
                    "rules": rules_result.get("rules_applied", []),
                    "warnings": rules_result.get("warnings", [])
                })
            
            # Phase 3: Model prediction (instant)
            yield sse_event("status", {"phase": "computing_prediction"})
            
            prediction = predict_quality(
                context.get("coefficients", {}),
                current_conditions,
                context.get("population_stats", {})
            )
            
            yield sse_event("prediction", {
                "expected_quality": prediction["expected_quality"],
                "confidence_interval": prediction["confidence_interval"],
                "contributions": prediction["contributions"],
                "personalization_phase": context.get("phase", "cold_start")
            })
            
            # Phase 4: Generate counterfactuals/recommendations (instant)
            counterfactuals = generate_counterfactuals(
                context.get("coefficients", {}),
                current_conditions,
                prediction["expected_quality"],
                context.get("population_stats", {})
            )
            
            # Determine session type
            session_type = determine_session_type(
                prediction["expected_quality"],
                current_conditions,
                rules_result
            )
            
            yield sse_event("recommendations", {
                "session_type": session_type,
                "items": counterfactuals[:3]
            })
            
            # Phase 5: Statistical context (instant)
            yield sse_event("status", {"phase": "computing_stats"})
            
            stats_context = compute_statistical_context(
                current_conditions,
                context.get("history", []),
                context.get("population_stats", {}),
                context.get("coefficients", {})
            )
            
            yield sse_event("stats", stats_context.dict())
            
            # Phase 6: Summary (instant)
            yield sse_event("summary", {
                "predicted_quality": prediction["expected_quality"],
                "session_type": session_type,
                "confidence": "high" if context.get("phase") == "personalized" else "medium" if context.get("phase") == "learning" else "low",
                "top_recommendations": [r["label"] for r in counterfactuals[:3]],
                "key_factors": list(prediction["contributions"].keys())[:3],
                "generated_at": datetime.utcnow().isoformat()
            })
            
            yield sse_event("done", {"source": "model"})
            
        except Exception as e:
            yield sse_event("error", {"message": str(e)})
    
    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no"
        }
    )


@router.post("/pre-session")
async def get_pre_session_recommendations(
    request: PreSessionRequest
) -> Dict[str, Any]:
    """
    Non-streaming version of recommendation endpoint.
    Returns complete recommendation payload at once.
    """
    supabase = get_supabase_client()
    
    # Load context
    context = await load_user_context(request.user_id, supabase)
    
    # Build current conditions dict
    current_conditions = {
        k: v for k, v in request.model_dump().items()
        if v is not None and k != "user_id"
    }
    
    # Check rules FIRST
    user_state = build_user_state(context, current_conditions)
    rules_result = await check_rules(user_state, supabase)
    
    if rules_result and rules_result.get("type") == "rule_override":
        return {
            "source": "rule_override",
            "rules_applied": rules_result.get("rules_applied", []),
            "message": rules_result.get("message"),
            "warnings": rules_result.get("warnings", []),
            "recommendation": rules_result.get("recommendations", {}),
            "generated_at": datetime.utcnow().isoformat()
        }
    
    # Model prediction
    prediction = predict_quality(
        context.get("coefficients", {}),
        current_conditions,
        context.get("population_stats", {})
    )
    
    # Counterfactuals
    counterfactuals = generate_counterfactuals(
        context.get("coefficients", {}),
        current_conditions,
        prediction["expected_quality"],
        context.get("population_stats", {})
    )
    
    # Session type
    session_type = determine_session_type(
        prediction["expected_quality"],
        current_conditions,
        rules_result
    )
    
    # Statistical context
    stats_context = compute_statistical_context(
        current_conditions,
        context.get("history", []),
        context.get("population_stats", {}),
        context.get("coefficients", {})
    )
    
    return {
        "source": "model",
        "prediction": {
            "expected_quality": prediction["expected_quality"],
            "confidence_interval": prediction["confidence_interval"],
            "contributions": prediction["contributions"]
        },
        "session_type": session_type,
        "recommendations": counterfactuals[:3],
        "rules_applied": rules_result.get("rules_applied", []) if rules_result else [],
        "warnings": rules_result.get("warnings", []) if rules_result else [],
        "statistical_context": stats_context.dict(),
        "personalization": {
            "phase": context.get("phase", "cold_start"),
            "sessions_included": len(context.get("history", [])),
            "has_baseline": bool(context.get("baseline"))
        },
        "generated_at": datetime.utcnow().isoformat()
    }

