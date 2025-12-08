"""
ClimbIQ Recommendation Engine

Uses Bayesian priors (from literature + expert judgments) and expert rules
to generate personalized climbing session recommendations.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import math
from supabase import Client
from app.api.routes.expert_capture.prior_extractor import LITERATURE_PRIORS


class RecommendationEngine:
    """
    Generates climbing session recommendations based on:
    1. Population priors (literature + expert-derived coefficients)
    2. Expert rules (safety, interaction, performance)
    3. User's current state (pre-session data)
    """
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self._priors_cache: Dict[str, Dict] = {}
        self._rules_cache: List[Dict] = []
        self._cache_timestamp: Optional[datetime] = None
        self._cache_ttl_seconds = 300  # 5 minute cache
    
    def _load_priors(self) -> Dict[str, Dict]:
        """Load population priors from database, falling back to literature"""
        priors = {}
        
        # 1. Load literature priors as baseline
        for var, data in LITERATURE_PRIORS.items():
            priors[var] = {
                "mean": data["mean_effect"],
                "std": data["std"],
                "variance": data["std"] ** 2,
                "confidence": data["confidence"],
                "source": "literature_baseline",
                "description": f"Baseline from {data.get('source', 'literature')}",
                "effect_direction": "linear",  # Default to linear
                "metadata": {},
            }
        
        # 2. Overlay database priors (expert + updated literature)
        try:
            result = self.supabase.table("population_priors").select("*").execute()
            for row in (result.data or []):
                # Merge metadata with explicit n_scenarios/total_judgments so the
                # engine can report how much expert data backs each variable.
                existing_meta = row.get("metadata", {}) or {}
                metadata = {
                    **existing_meta,
                    "n_scenarios": row.get("n_scenarios", existing_meta.get("n_scenarios", 0)),
                    "total_judgments": row.get("total_judgments", existing_meta.get("total_judgments", 0)),
                }
                priors[row["variable_name"]] = {
                    "mean": row["population_mean"],
                    "std": row["population_std"],
                    "variance": row.get("individual_variance", row["population_std"] ** 2),
                    "confidence": row.get("confidence", "medium"),
                    "source": row.get("source", "unknown"),
                    "effect_direction": row.get("effect_direction"),
                    "category": row.get("variable_category"),
                    "description": row.get("description"),
                    "metadata": metadata,
                }
            return priors
        except Exception as e:
            print(f"[ENGINE] Error loading priors from DB, using literature only: {e}")
            return priors
    
    def _load_rules(self) -> List[Dict]:
        """Load active expert rules from database, sorted by priority"""
        try:
            result = self.supabase.table("expert_rules")\
                .select("*")\
                .eq("is_active", True)\
                .order("priority", desc=True)\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"[ENGINE] Error loading rules: {e}")
            return []
    
    def _refresh_cache_if_needed(self) -> None:
        """Refresh cache if expired"""
        now = datetime.utcnow()
        if (self._cache_timestamp is None or 
            (now - self._cache_timestamp).total_seconds() > self._cache_ttl_seconds):
            self._priors_cache = self._load_priors()
            self._rules_cache = self._load_rules()
            self._cache_timestamp = now
            print(f"[ENGINE] Cache refreshed: {len(self._priors_cache)} priors, {len(self._rules_cache)} rules")
    
    def _evaluate_condition(self, condition: Dict, user_state: Dict) -> bool:
        """Evaluate a single condition against user state"""
        field = condition.get("field")
        op = condition.get("op")
        value = condition.get("value")
        
        if field not in user_state:
            return False  # Unknown field, condition not met
        
        user_value = user_state[field]
        
        try:
            if op == ">=":
                return user_value >= value
            elif op == "<=":
                return user_value <= value
            elif op == ">":
                return user_value > value
            elif op == "<":
                return user_value < value
            elif op == "==":
                return user_value == value
            elif op == "!=":
                return user_value != value
            elif op == "in":
                return user_value in value
            elif op == "contains":
                return value in user_value
            else:
                return False
        except (TypeError, ValueError):
            return False
    
    def _evaluate_conditions(self, conditions: Dict, user_state: Dict) -> bool:
        """Evaluate compound conditions (ALL, ANY, NOT)"""
        if "ALL" in conditions:
            return all(self._evaluate_condition(c, user_state) for c in conditions["ALL"])
        elif "ANY" in conditions:
            return any(self._evaluate_condition(c, user_state) for c in conditions["ANY"])
        elif "NOT" in conditions:
            return not self._evaluate_conditions(conditions["NOT"], user_state)
        else:
            # Single condition
            return self._evaluate_condition(conditions, user_state)
    
    def _match_rules(self, user_state: Dict) -> List[Dict]:
        """Find all rules that match the current user state"""
        matched_rules = []
        
        for rule in self._rules_cache:
            conditions = rule.get("conditions", {})
            if self._evaluate_conditions(conditions, user_state):
                matched_rules.append(rule)
        
        return matched_rules
    
    def _calculate_base_quality(self, user_state: Dict) -> Tuple[float, Dict[str, float]]:
        """
        Calculate predicted session quality using Bayesian priors.
        Returns (predicted_quality, contribution_breakdown)
        """
        # Base quality (average session)
        base_quality = 5.0
        
        contributions = {}
        total_effect = 0.0
        
        for variable, prior in self._priors_cache.items():
            if variable not in user_state:
                continue
            
            user_value = user_state[variable]
            mean_effect = prior["mean"]
            
            # Calculate contribution based on variable type
            metadata = prior.get("metadata", {})
            
            # Handle different variable types
            if prior.get("effect_direction") == "nonlinear":
                # Nonlinear effects (e.g., optimal range)
                optimal_range = metadata.get("optimal_range")
                if optimal_range and len(optimal_range) == 2:
                    if optimal_range[0] <= user_value <= optimal_range[1]:
                        effect = mean_effect  # In optimal range
                    else:
                        # Outside optimal range - negative effect
                        distance = min(abs(user_value - optimal_range[0]), 
                                      abs(user_value - optimal_range[1]))
                        effect = -mean_effect * distance * 0.5
                else:
                    effect = mean_effect * user_value
            elif isinstance(user_value, bool):
                # Binary variable
                effect = mean_effect if user_value else 0
            elif isinstance(user_value, (int, float)):
                # Scale-based variable (1-10 typically)
                # Normalize around midpoint (5) for 1-10 scales
                scale = metadata.get("scale", [1, 10])
                if scale and len(scale) == 2:
                    midpoint = (scale[0] + scale[1]) / 2
                    normalized = user_value - midpoint
                    effect = mean_effect * normalized
                else:
                    effect = mean_effect * user_value
            else:
                continue
            
            contributions[variable] = round(effect, 4)
            total_effect += effect
        
        predicted_quality = base_quality + total_effect
        # Clamp to 1-10 range
        predicted_quality = max(1.0, min(10.0, predicted_quality))
        
        return predicted_quality, contributions
    
    def _apply_rule_actions(
        self, 
        matched_rules: List[Dict], 
        base_quality: float,
        contributions: Dict[str, float]
    ) -> Tuple[float, str, Dict[str, Any]]:
        """
        Apply rule actions and determine final recommendation.
        Returns (adjusted_quality, session_type, recommendations)
        """
        adjusted_quality = base_quality
        session_type = None
        recommendations = {
            "messages": [],
            "avoid": [],
            "include": [],
            "overrides": [],
            "modifiers": [],
        }
        
        for rule in matched_rules:
            actions = rule.get("actions", [])
            
            for action in actions:
                action_type = action.get("type")
                
                if action_type == "override":
                    # Complete override of recommendation
                    session_type = action.get("recommendation")
                    recommendations["overrides"].append({
                        "rule": rule["name"],
                        "reason": action.get("reason"),
                        "message": action.get("message"),
                    })
                    
                elif action_type == "add_recommendation":
                    rec = action.get("recommendation", {})
                    if "session_type" in rec:
                        session_type = rec["session_type"]
                    if "avoid" in rec:
                        recommendations["avoid"].extend(rec["avoid"])
                    if "include" in rec:
                        recommendations["include"].extend(rec["include"])
                    
                    recommendations["messages"].append({
                        "rule": rule["name"],
                        "message": action.get("message"),
                        "reason": action.get("reason"),
                    })
                    
                elif action_type == "modify_coefficient":
                    multiplier = action.get("multiplier", 1.0)
                    adjusted_quality *= multiplier
                    recommendations["modifiers"].append({
                        "rule": rule["name"],
                        "multiplier": multiplier,
                        "message": action.get("message"),
                    })
        
        # Clamp quality
        adjusted_quality = max(1.0, min(10.0, adjusted_quality))
        
        return adjusted_quality, session_type, recommendations
    
    def _determine_session_type(
        self, 
        adjusted_quality: float, 
        user_state: Dict,
        matched_rules: List[Dict]
    ) -> str:
        """Determine recommended session type if not overridden by rules"""
        
        # Check for rule overrides first
        for rule in matched_rules:
            for action in rule.get("actions", []):
                if action.get("type") == "override":
                    return action.get("recommendation", "light_session")
        
        # Otherwise, base on predicted quality and user state.
        # We are defensive here and support both the "core" engine fields
        # and the richer survey aliases coming from the frontend.

        # Energy: prefer explicit energy_level, fall back to survey proxies
        energy = user_state.get("energy_level")
        if energy is None:
            # Derive energy from upper-body power and leg springiness if present
            ub = user_state.get("upper_body_power")
            leg = user_state.get("leg_springiness")
            if isinstance(ub, (int, float)) and isinstance(leg, (int, float)):
                energy = (ub + leg) / 2
            else:
                energy = 5

        # Motivation: support both "motivation_level" and "motivation"
        motivation = user_state.get("motivation_level", user_state.get("motivation", 5))

        # Soreness: support both "muscle_soreness" and DOMS proxy
        soreness = user_state.get("muscle_soreness", user_state.get("doms_severity", 5))
        
        # High quality prediction + high motivation = projecting
        if adjusted_quality >= 7.5 and motivation >= 8 and energy >= 7:
            return "project"
        
        # High quality, lower motivation = volume/mileage
        if adjusted_quality >= 7 and energy >= 6:
            return "volume"
        
        # Moderate quality
        if adjusted_quality >= 5.5:
            if soreness >= 6:
                return "technique"
            return "volume"
        
        # Lower quality
        if adjusted_quality >= 4:
            return "light_session"
        
        # Very low quality
        if adjusted_quality >= 3:
            return "active_recovery"
        
        # Extremely low
        return "rest_day"
    
    def generate_recommendation(self, user_state: Dict) -> Dict[str, Any]:
        """
        Generate a complete recommendation based on user's current state.
        
        Args:
            user_state: Dictionary with pre-session data (sleep, energy, etc.)
        
        Returns:
            Complete recommendation including:
            - predicted_quality: Predicted session quality (1-10)
            - session_type: Recommended session type
            - confidence: Confidence in recommendation
            - key_factors: Top factors influencing recommendation
            - warnings: Safety/health warnings
            - suggestions: Specific suggestions for the session
            - rule_matches: Rules that triggered
            - coefficient_breakdown: Contribution of each factor
        """
        self._refresh_cache_if_needed()
        
        # Calculate base quality from priors
        base_quality, contributions = self._calculate_base_quality(user_state)
        
        # Match rules
        matched_rules = self._match_rules(user_state)
        
        # Apply rule actions
        adjusted_quality, rule_session_type, rule_recommendations = self._apply_rule_actions(
            matched_rules, base_quality, contributions
        )
        
        # Determine session type
        session_type = rule_session_type or self._determine_session_type(
            adjusted_quality, user_state, matched_rules
        )
        
        # Identify key factors
        sorted_contributions = sorted(
            contributions.items(), 
            key=lambda x: abs(x[1]), 
            reverse=True
        )
        key_factors = [
            {
                "variable": var,
                "effect": effect,
                "direction": "positive" if effect > 0 else "negative",
                "description": self._priors_cache.get(var, {}).get("description", ""),
            }
            for var, effect in sorted_contributions[:5]
            if abs(effect) > 0.05
        ]
        
        # Extract warnings from safety rules
        warnings = []
        for rule in matched_rules:
            if rule.get("rule_category") == "safety":
                for action in rule.get("actions", []):
                    warnings.append({
                        "severity": "high",
                        "message": action.get("message", rule.get("description")),
                        "rule": rule["name"],
                    })
        
        # Generate suggestions based on session type
        suggestions = self._generate_suggestions(session_type, user_state, matched_rules)
        
        # Calculate confidence
        confidence = self._calculate_confidence(contributions, matched_rules)
        
        # Build a rough structured session plan (warmup + main + cooldown)
        structured_plan = self._build_structured_plan(session_type, user_state)

        # Summarize how much expert data informed THIS recommendation
        expert_variables = []
        literature_only_variables = []
        approx_expert_scenarios = 0
        
        for var, effect in contributions.items():
            prior = self._priors_cache.get(var, {})
            source = prior.get("source", "")
            metadata = prior.get("metadata", {}) or {}
            n_scenarios = metadata.get("n_scenarios", 0) or 0
            
            if n_scenarios > 0 and source in ("expert_only", "blended", "expert_judgment"):
                expert_variables.append(var)
                # Use max across variables as a conservative lower bound on
                # the number of expert scenarios that informed this plan.
                approx_expert_scenarios = max(approx_expert_scenarios, n_scenarios)
            elif "literature" in str(source):
                literature_only_variables.append(var)
        
        expert_coverage = {
            "variables_used": len(contributions),
            "variables_with_expert_data": len(expert_variables),
            "literature_only_variables": len(literature_only_variables),
            "approx_expert_scenarios": approx_expert_scenarios,
        }
        
        return {
            "predicted_quality": round(adjusted_quality, 1),
            "base_quality": round(base_quality, 1),
            "session_type": session_type,
            "confidence": confidence,
            "key_factors": key_factors,
            "warnings": warnings,
            "suggestions": suggestions,
            "rule_matches": [
                {
                    "name": r["name"],
                    "category": r.get("rule_category"),
                    "priority": r.get("priority"),
                }
                for r in matched_rules
            ],
            "coefficient_breakdown": contributions,
            "messages": rule_recommendations.get("messages", []),
            "avoid": list(set(rule_recommendations.get("avoid", []))),
            "include": list(set(rule_recommendations.get("include", []))),
            "generated_at": datetime.utcnow().isoformat(),
            "priors_count": len(self._priors_cache),
            "rules_count": len(self._rules_cache),
            "structured_plan": structured_plan,
            "expert_coverage": expert_coverage,
        }
    
    def _generate_suggestions(
        self, 
        session_type: str, 
        user_state: Dict,
        matched_rules: List[Dict]
    ) -> List[Dict[str, str]]:
        """Generate specific suggestions for the recommended session type"""
        suggestions = []
        
        # --- Dynamic Warmup Recommendation ---
        # Check priors for specific warmup advice
        warmup_prior = self._priors_cache.get("warmup_duration_min", {})
        warmup_effect = warmup_prior.get("mean", 0)
        
        intensity_prior = self._priors_cache.get("warmup_intensity", {})
        intensity_effect = intensity_prior.get("mean", 0)
        
        warmup_msg = "Complete a 10-15 minute warmup before climbing."
        
        # Adjust duration based on model
        if warmup_effect > 0.03:
            warmup_msg = "Complete an extended 20-25 minute warmup."
        elif warmup_effect < 0:
             warmup_msg = "Keep your warmup short (5-10 mins) to conserve energy."
             
        # Adjust intensity based on model
        if intensity_effect > 0.05:
            warmup_msg += " Include some higher intensity recruitment pulls."
        else:
            warmup_msg += " Keep intensity low and focus on mobility."

        if not user_state.get("warmup_completed", False):
            suggestions.append({
                "type": "warmup",
                "message": warmup_msg,
            })
            
        # --- Dynamic Session Structure Recommendation ---
        rest_prior = self._priors_cache.get("main_session_rest_level", {})
        rest_effect = rest_prior.get("mean", 0)
        
        if session_type in ["project", "limit_bouldering"] and rest_effect > 0.1:
             suggestions.append({
                "type": "structure",
                "message": "Prioritize long rests (3-5 min) between attempts to maximize quality.",
            })
        elif session_type == "volume" and rest_effect < 0.05:
             suggestions.append({
                "type": "structure",
                "message": "Keep rests short (1-2 min) to maintain heart rate and flow.",
            })
        
        # Session-type specific suggestions
        if session_type == "project":
            suggestions.append({
                "type": "projecting",
                "message": "Conditions look good for projecting. Focus on your current project.",
            })
        elif session_type == "volume":
            suggestions.append({
                "type": "volume",
                "message": "Good day for volume. Aim for many climbs 2-3 grades below your limit with shorter rest.",
            })
        elif session_type == "technique":
            suggestions.append({
                "type": "technique",
                "message": "Focus on movement quality today. Climb easy routes emphasizing body position and footwork.",
            })
        elif session_type == "light_session":
            suggestions.append({
                "type": "light",
                "message": "Keep it light today. Easy climbing, no limit attempts. Listen to your body.",
            })
        elif session_type == "active_recovery":
            suggestions.append({
                "type": "recovery",
                "message": "Active recovery recommended. Very easy climbing or mobility work only.",
            })
        elif session_type == "rest_day":
            suggestions.append({
                "type": "rest",
                "message": "Rest day recommended. Focus on recovery: sleep, nutrition, light stretching.",
            })
        
        # Hydration reminder
        if user_state.get("hydration_status", 10) < 6:
            suggestions.append({
                "type": "hydration",
                "message": "You indicated suboptimal hydration. Drink water before and during your session.",
            })
        
        # Caffeine timing
        if user_state.get("caffeine_today") and session_type in ["project", "limit_bouldering"]:
            suggestions.append({
                "type": "caffeine",
                "message": "Caffeine detected. Time your session 30-60 minutes after caffeine for peak effect.",
            })
        
        return suggestions
    
    def _calculate_confidence(
        self, 
        contributions: Dict[str, float],
        matched_rules: List[Dict]
    ) -> str:
        """Calculate confidence in the recommendation"""
        # More data = higher confidence
        n_factors = len([c for c in contributions.values() if abs(c) > 0.01])
        
        # High-priority safety rules increase confidence
        has_safety_rules = any(r.get("rule_category") == "safety" for r in matched_rules)
        
        # Calculate confidence
        if has_safety_rules:
            return "high"  # Safety rules are high confidence
        elif n_factors >= 5:
            return "high"
        elif n_factors >= 3:
            return "medium"
        else:
            return "low"
    
    def _build_structured_plan(self, session_type: str, user_state: Dict) -> Dict[str, Any]:
        """
        Build a rough, step-by-step session structure with warmup and main session
        blocks. This is a heuristic scaffold used until we have enough expert
        scenario data to learn personalized structures.
        """
        primary_goal = user_state.get("primary_goal")
        energy = user_state.get("energy_level", 6)
        soreness = user_state.get("muscle_soreness", 3)
        
        warmup_blocks: List[Dict[str, Any]] = []
        main_blocks: List[Dict[str, Any]] = []
        cooldown_blocks: List[Dict[str, Any]] = []

        # --- Warmup scaffold (shared) ---
        warmup_blocks.append({
            "phase": "warmup",
            "title": "General Activation",
            "duration_min": 5 if session_type != "active_recovery" else 10,
            "exercises": [
                {
                    "name": "Light cardio",
                    "duration": "3–5 min",
                    "notes": "Easy jog, bike, or brisk walk until slightly warm."
                },
                {
                    "name": "Joint prep",
                    "duration": "2–3 min",
                    "notes": "Arm circles, shoulder rolls, hip circles, wrist and ankle circles."
                },
            ],
        })

        warmup_blocks.append({
            "phase": "warmup",
            "title": "Climbing-Specific Prep",
            "duration_min": 10,
            "exercises": [
                {
                    "name": "Easy traverses",
                    "duration": "5–7 min",
                    "notes": "On jugs / big holds, breathing through the nose, low pump."
                },
                {
                    "name": "Gradual difficulty build",
                    "sets": 3,
                    "reps": "1 problem per set",
                    "notes": "VB → V0 → V1 (or equivalent); focus on smooth movement."
                },
            ],
        })

        # --- Main session scaffold based on session_type ---
        if session_type == "active_recovery":
            main_blocks.append({
                "phase": "main",
                "title": "Active Recovery Climbing",
                "duration_min": 30,
                "focus": "Very easy climbing or movement to promote circulation.",
                "exercises": [
                    {
                        "name": "Easy traverses",
                        "duration": "20–30 min total",
                        "intensity": "RPE 2–3/10",
                        "notes": "Stay on jugs and good feet, keep breathing relaxed."
                    },
                    {
                        "name": "Mobility flow",
                        "duration": "10–15 min",
                        "notes": "Hip openers, thoracic rotations, gentle hamstring and calf stretches."
                    },
                ],
            })
        elif session_type == "volume":
            main_blocks.append({
                "phase": "main",
                "title": "Volume Mileage Block",
                "duration_min": 45,
                "focus": "Accumulate submaximal climbs to build aerobic and technical base.",
                "exercises": [
                    {
                        "name": "Continuous circuits",
                        "sets": 3,
                        "reps": "4–6 problems per set",
                        "rest": "3–4 min between sets",
                        "notes": "2–3 grades below limit; focus on efficiency and footwork."
                    },
                    {
                        "name": "Downclimb drills",
                        "sets": 2,
                        "reps": "2–3 problems per set",
                        "notes": "Climb up and down the same problem to extend time on wall."
                    },
                ],
            })
        elif session_type == "project":
            main_blocks.append({
                "phase": "main",
                "title": "Limit Bouldering / Project Work",
                "duration_min": 60,
                "focus": "High-quality attempts on your hardest climbs.",
                "exercises": [
                    {
                        "name": "Project attempts",
                        "sets": 4,
                        "reps": "2–3 quality attempts per set",
                        "rest": "3–5 min between attempts",
                        "notes": "Full commitment on each go; stop before form breaks down."
                    },
                    {
                        "name": "Movement rehearsal",
                        "sets": 2,
                        "reps": "5–8 low-intensity rehearsals",
                        "notes": "Practice crux sequences on easier angles or with bigger holds."
                    },
                ],
            })
        elif session_type == "technique":
            main_blocks.append({
                "phase": "main",
                "title": "Technique Drills Block",
                "duration_min": 45,
                "focus": "Refine movement quality at moderate difficulty.",
                "exercises": [
                    {
                        "name": "Silent feet drill",
                        "sets": 3,
                        "reps": "3 problems per set",
                        "notes": "No sound when placing feet; prioritize precision over difficulty."
                    },
                    {
                        "name": "Hip position drill",
                        "sets": 2,
                        "reps": "3–4 problems",
                        "notes": "Keep hips close, experiment with drop-knees and flagging."
                    },
                ],
            })
        else:
            # Generic light session scaffold
            main_blocks.append({
                "phase": "main",
                "title": "General Climbing Session",
                "duration_min": 45,
                "focus": "Balanced mix of movement quality and moderate effort.",
                "exercises": [
                    {
                        "name": "Pyramid set",
                        "sets": 4,
                        "reps": "1 problem per set",
                        "notes": "Easy → moderate → near-limit → moderate; long rest before harder climbs."
                    },
                    {
                        "name": "Technique finisher",
                        "duration": "10–15 min",
                        "notes": "Pick easy problems and exaggerate good habits: quiet feet, relaxed grip, steady breathing."
                    },
                ],
            })

        # --- Cooldown scaffold ---
        cooldown_blocks.append({
            "phase": "cooldown",
            "title": "Cooldown & Reset",
            "duration_min": 10,
            "exercises": [
                {
                    "name": "Easy movement",
                    "duration": "5 min",
                    "notes": "Very easy climbing or walking to gradually bring HR down."
                },
                {
                    "name": "Stretch & breathe",
                    "duration": "5–10 min",
                    "notes": "Focus on forearms, shoulders, hips; 4–6 slow breaths per stretch."
                },
            ],
        })

        return {
            "warmup": warmup_blocks,
            "main": main_blocks,
            "cooldown": cooldown_blocks,
        }
    
    def get_priors_summary(self) -> Dict[str, Any]:
        """Get summary of loaded priors for debugging/display"""
        self._refresh_cache_if_needed()
        
        by_category = {}
        for var, prior in self._priors_cache.items():
            cat = prior.get("category", "uncategorized")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append({
                "variable": var,
                "mean": prior["mean"],
                "confidence": prior.get("confidence"),
                "source": prior.get("source"),
            })
        
        return {
            "total_priors": len(self._priors_cache),
            "by_category": by_category,
            "cache_age_seconds": (datetime.utcnow() - self._cache_timestamp).total_seconds() if self._cache_timestamp else None,
        }
    
    def get_rules_summary(self) -> Dict[str, Any]:
        """Get summary of loaded rules for debugging/display"""
        self._refresh_cache_if_needed()
        
        by_category = {}
        for rule in self._rules_cache:
            cat = rule.get("rule_category", "uncategorized")
            if cat not in by_category:
                by_category[cat] = []
            by_category[cat].append({
                "name": rule["name"],
                "priority": rule.get("priority"),
                "confidence": rule.get("confidence"),
                "source": rule.get("source"),
            })
        
        return {
            "total_rules": len(self._rules_cache),
            "by_category": {k: len(v) for k, v in by_category.items()},
            "rules": by_category,
        }

