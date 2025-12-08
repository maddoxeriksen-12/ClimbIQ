"""
ClimbIQ Recommendation Engine

5-Layer Architecture Implementation:
Layer 1: Context & Input - Gathers static profile, dynamic history, real-time state
Layer 2: Logic Core - Constraint solver + parametric compiler (templates, modifiers, granularity)
Layer 3: Relevance Engine - LLM-powered explanations (handled by explanation_service.py)
Layer 4: Session Execution - Branching logic (handled by session_execution.py)
Layer 5: Learning Loop - Bayesian updater (handled by learning_loop.py Dagster asset)

Uses Bayesian priors (from literature + expert judgments) and expert rules
to generate personalized climbing session recommendations.
"""

from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import math
from supabase import Client
from app.api.routes.expert_capture.prior_extractor import LITERATURE_PRIORS

# Model version for tracking predictions
MODEL_VERSION = "v2.0.0"


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
        self._components_cache: List[Dict] = []
        self._templates_cache: List[Dict] = []
        self._modifiers_cache: List[Dict] = []
        self._variants_cache: List[Dict] = []
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

    def _load_session_components(self) -> List[Dict]:
        """Load active session structure components from database"""
        try:
            result = self.supabase.table("session_structure_components")\
                .select("*")\
                .eq("is_active", True)\
                .order("priority", desc=True)\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"[ENGINE] Error loading session components: {e}")
            return []

    def _load_templates(self) -> List[Dict]:
        """Load active session base templates from database"""
        try:
            result = self.supabase.table("session_base_templates")\
                .select("*")\
                .eq("is_active", True)\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"[ENGINE] Error loading templates: {e}")
            return []

    def _load_modifiers(self) -> List[Dict]:
        """Load active session modifiers from database"""
        try:
            result = self.supabase.table("session_modifiers")\
                .select("*")\
                .eq("is_active", True)\
                .order("priority", desc=True)\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"[ENGINE] Error loading modifiers: {e}")
            return []

    def _load_variants(self) -> List[Dict]:
        """Load active exercise variants from database"""
        try:
            result = self.supabase.table("exercise_variants")\
                .select("*")\
                .eq("is_active", True)\
                .order("priority", desc=True)\
                .execute()
            return result.data or []
        except Exception as e:
            print(f"[ENGINE] Error loading exercise variants: {e}")
            return []

    def _get_user_acwr(self, user_id: str) -> Dict[str, Any]:
        """
        Fetch ACWR (Acute:Chronic Workload Ratio) from materialized view.
        Layer 1: Dynamic history sensor.
        """
        try:
            result = self.supabase.rpc(
                "get_user_acwr",
                {"p_user_id": user_id}
            ).execute()
            if result.data and len(result.data) > 0:
                return result.data[0]
        except Exception as e:
            print(f"[ENGINE] Error fetching ACWR: {e}")

        # Default values if no ACWR data
        return {
            "acwr": 1.0,
            "risk_zone": "optimal",
            "acute_load": 0,
            "chronic_load": 0,
            "injury_probability": 0.05
        }

    def _get_user_deviation(self, user_id: str) -> Dict[str, Any]:
        """
        Fetch user-specific deviation metrics from model_outputs.
        Layer 5: Personalization through learned deviations.
        """
        try:
            result = self.supabase.table("model_outputs")\
                .select("coefficients, recovery_index, variable_deviations, phase")\
                .eq("user_id", user_id)\
                .single()\
                .execute()
            if result.data:
                return {
                    "coefficients": result.data.get("coefficients", {}),
                    "recovery_index": result.data.get("recovery_index", 1.0),
                    "variable_deviations": result.data.get("variable_deviations", {}),
                    "phase": result.data.get("phase", "cold_start"),
                }
        except Exception as e:
            print(f"[ENGINE] Error fetching user deviation: {e}")

        # Default for new users (cold start)
        return {
            "coefficients": {},
            "recovery_index": 1.0,
            "variable_deviations": {},
            "phase": "cold_start",
        }

    def _get_matching_modifiers(self, user_state: Dict) -> List[Dict]:
        """
        Find all modifiers whose conditions match the user state.
        Layer 2: Parametric compiler - modifier application.
        """
        matched = []
        for modifier in self._modifiers_cache:
            condition = modifier.get("condition_pattern", {})
            if self._evaluate_component_condition(condition, user_state):
                matched.append(modifier)
        return sorted(matched, key=lambda m: m.get("priority", 50), reverse=True)

    def _get_exercise_variant(self, generic_exercise: str, user_state: Dict) -> Optional[Dict]:
        """
        Find the best exercise variant for a generic exercise.
        Layer 2: Parametric compiler - granularity injection.
        """
        best_match = None
        best_priority = -1

        for variant in self._variants_cache:
            if variant.get("generic_exercise") != generic_exercise:
                continue

            condition = variant.get("condition_pattern", {})
            priority = variant.get("priority", 50)

            # Empty condition is fallback (lower priority than specific matches)
            if not condition:
                if best_match is None:
                    best_match = variant
                    best_priority = 0  # Fallback has lowest priority
            elif self._evaluate_component_condition(condition, user_state):
                if priority > best_priority:
                    best_match = variant
                    best_priority = priority

        return best_match

    def _refresh_cache_if_needed(self) -> None:
        """Refresh cache if expired"""
        now = datetime.utcnow()
        if (self._cache_timestamp is None or
            (now - self._cache_timestamp).total_seconds() > self._cache_ttl_seconds):
            self._priors_cache = self._load_priors()
            self._rules_cache = self._load_rules()
            self._components_cache = self._load_session_components()
            self._templates_cache = self._load_templates()
            self._modifiers_cache = self._load_modifiers()
            self._variants_cache = self._load_variants()
            self._cache_timestamp = now
            print(f"[ENGINE] Cache refreshed: {len(self._priors_cache)} priors, {len(self._rules_cache)} rules, "
                  f"{len(self._components_cache)} components, {len(self._templates_cache)} templates, "
                  f"{len(self._modifiers_cache)} modifiers, {len(self._variants_cache)} variants")
    
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

    def _evaluate_component_condition(self, condition: Dict, user_state: Dict) -> bool:
        """
        Evaluate a component condition pattern against user state.
        Component patterns use 'variable' instead of 'field'.
        """
        # Empty condition matches all (fallback)
        if not condition:
            return True

        # Handle compound conditions
        if "ALL" in condition:
            return all(
                self._evaluate_component_condition(c, user_state)
                for c in condition["ALL"]
            )
        elif "ANY" in condition:
            return any(
                self._evaluate_component_condition(c, user_state)
                for c in condition["ANY"]
            )
        elif "NOT" in condition:
            return not self._evaluate_component_condition(condition["NOT"], user_state)

        # Single condition with variable/op/value
        variable = condition.get("variable")
        op = condition.get("op")
        value = condition.get("value")

        if variable not in user_state:
            return False

        user_value = user_state[variable]

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

    def _match_phase_components(
        self, phase: str, user_state: Dict
    ) -> List[Dict]:
        """Find all components for a phase that match the user state"""
        matched = []
        for comp in self._components_cache:
            if comp.get("phase") != phase:
                continue
            condition = comp.get("condition_pattern", {})
            if self._evaluate_component_condition(condition, user_state):
                matched.append(comp)
        return matched

    def _calculate_phase_budgets(self, planned_duration: int) -> Dict[str, int]:
        """
        Resource budgeting: Allocate time to phases based on total duration.
        Prevents "Frankenstein sessions" that exceed user's available time.
        """
        return {
            'warmup': min(int(planned_duration * 0.20), 20),    # Max 20% or 20 min
            'main': int(planned_duration * 0.55),               # 55% for main work
            'cooldown': min(int(planned_duration * 0.15), 15),  # Max 15% or 15 min
            'hangboard': min(int(planned_duration * 0.15), 20), # Max 15% or 20 min
            'antagonist': min(int(planned_duration * 0.10), 15),# Max 10% or 15 min
        }

    def _calculate_max_intensity(self, user_state: Dict) -> int:
        """
        Calculate maximum safe intensity (0-10) based on user state.
        Low energy/high soreness = lower max intensity allowed.
        """
        energy = user_state.get("energy_level", 7)
        soreness = user_state.get("muscle_soreness", 3)
        sleep = user_state.get("sleep_quality", 7)

        # Base intensity from energy
        base = min(10, energy + 2)  # energy=5 -> max_intensity=7

        # Reduce for high soreness
        if soreness >= 7:
            base -= 2
        elif soreness >= 5:
            base -= 1

        # Reduce for poor sleep
        if sleep <= 4:
            base -= 1

        return max(3, min(10, base))  # Clamp to 3-10

    def _validate_composition(
        self,
        matched: List[Dict],
        time_budget: int,
        max_intensity: int
    ) -> List[Dict]:
        """
        Apply conflict resolution and resource constraints.

        1. Conflict groups: Only keep highest-priority component per group
        2. Intensity: Filter out components above max_intensity
        3. Time budget: Drop lowest-priority components if over budget
        """
        # Step 1: Resolve conflict groups (keep highest priority per group)
        seen_groups: Dict[str, bool] = {}
        conflict_resolved = []
        for comp in sorted(matched, key=lambda c: c.get("priority", 50), reverse=True):
            group = comp.get("conflict_group")
            if group:
                if group not in seen_groups:
                    seen_groups[group] = True
                    conflict_resolved.append(comp)
                # else: skip - higher priority already claimed this group
            else:
                conflict_resolved.append(comp)

        # Step 2: Filter by intensity
        block_content = lambda c: c.get("block_content", {})
        intensity_filtered = [
            c for c in conflict_resolved
            if block_content(c).get("intensity_score", 5) <= max_intensity
        ]

        # Step 3: Apply time budget (greedy by priority)
        time_used = 0
        budget_validated = []
        for comp in sorted(intensity_filtered, key=lambda c: c.get("priority", 50), reverse=True):
            duration = block_content(comp).get("duration_min", 10)
            if time_used + duration <= time_budget:
                budget_validated.append(comp)
                time_used += duration
            # else: skip - would exceed budget

        return budget_validated

    def _compose_phase_blocks(self, components: List[Dict]) -> List[Dict]:
        """Compose components into phase blocks based on composition_mode"""
        blocks: List[Dict] = []

        for comp in sorted(components, key=lambda c: c.get("priority", 50), reverse=True):
            mode = comp.get("composition_mode", "replace")
            content = comp.get("block_content", {})

            if mode == "replace":
                blocks = [content]
            elif mode == "prepend":
                blocks.insert(0, content)
            elif mode == "append":
                blocks.append(content)
            # 'modify' would merge properties into existing blocks (future)

        return blocks
    
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
    
    def generate_recommendation(self, user_state: Dict, user_id: Optional[str] = None, session_id: Optional[str] = None) -> Dict[str, Any]:
        """
        Generate a complete recommendation based on user's current state.

        5-Layer Architecture Flow:
        Layer 1: Gather context (user_state + ACWR + user_deviation)
        Layer 2: Apply constraints and compile session (templates + modifiers + granularity)
        Layer 5: Store prediction for learning loop

        Args:
            user_state: Dictionary with pre-session data (sleep, energy, etc.)
            user_id: Optional user ID for fetching ACWR and deviations
            session_id: Optional session ID for storing prediction

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
            - acwr: Workload ratio data
        """
        self._refresh_cache_if_needed()

        # Layer 1: Enrich user_state with dynamic history (ACWR)
        acwr_data = {}
        user_deviation = {}
        if user_id:
            acwr_data = self._get_user_acwr(user_id)
            user_deviation = self._get_user_deviation(user_id)
            # Add ACWR to user_state for constraint evaluation
            user_state = {
                **user_state,
                "acwr": acwr_data.get("acwr", 1.0),
                "acwr_risk_zone": acwr_data.get("risk_zone", "optimal"),
                "injury_probability": acwr_data.get("injury_probability", 0.05),
            }

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

        # Layer 2: Get matched modifiers for transparency
        matched_modifiers = self._get_matching_modifiers(user_state)
        modifier_info = [
            {
                "name": m.get("modifier_name"),
                "type": m.get("modifier_type"),
                "reason": m.get("reason"),
                "priority": m.get("priority"),
            }
            for m in matched_modifiers
        ]

        # Build the response
        result = {
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
            # New Layer 1 data
            "acwr": acwr_data if acwr_data else None,
            "user_deviation_phase": user_deviation.get("phase") if user_deviation else "cold_start",
            # New Layer 2 data
            "matched_modifiers": modifier_info,
            "model_version": MODEL_VERSION,
        }

        # Layer 5: Store prediction for learning loop
        if session_id and user_id:
            self._store_prediction(
                session_id=session_id,
                predicted_quality=adjusted_quality,
                session_type=session_type,
                confidence=confidence,
                key_factors=key_factors,
                user_deviation_applied=user_deviation.get("phase") != "cold_start",
            )

        return result

    def _store_prediction(
        self,
        session_id: str,
        predicted_quality: float,
        session_type: str,
        confidence: str,
        key_factors: List[Dict],
        user_deviation_applied: bool = False,
        predicted_fatigue: Optional[float] = None,
    ) -> None:
        """
        Store prediction snapshot for later comparison in learning loop.
        Layer 5: Enable predicted vs actual comparison.
        """
        try:
            self.supabase.rpc(
                "record_prediction",
                {
                    "p_session_id": session_id,
                    "p_predicted_quality": predicted_quality,
                    "p_predicted_fatigue": predicted_fatigue,
                    "p_session_type": session_type,
                    "p_confidence": confidence,
                    "p_key_factors": key_factors,
                    "p_model_version": MODEL_VERSION,
                    "p_population_prior_used": True,
                    "p_user_deviation_applied": user_deviation_applied,
                }
            ).execute()
            print(f"[ENGINE] Stored prediction for session {session_id}")
        except Exception as e:
            # Don't fail the recommendation if prediction storage fails
            print(f"[ENGINE] Error storing prediction: {e}")

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
        Build session structure by composing matching components from the database.
        Falls back to inline scaffold templates when no components match.

        Implements:
        - Conflict group checking (only one component per conflict_group)
        - Resource budgeting (phase time limits based on planned_duration)
        - Intensity constraints (based on user energy/recovery state)
        """
        # Add session_type to user_state for component matching
        user_state_with_session = {**user_state, "session_type": session_type}

        # Calculate constraints
        planned_duration = user_state.get("planned_duration", 90)
        phase_budgets = self._calculate_phase_budgets(planned_duration)
        max_intensity = self._calculate_max_intensity(user_state)

        # Track which phases used expert vs scaffold data
        component_sources: Dict[str, str] = {}

        # Build each phase
        phases = ["warmup", "main", "cooldown"]
        result: Dict[str, List[Dict]] = {}

        for phase in phases:
            # Find matching components for this phase
            matched = self._match_phase_components(phase, user_state_with_session)

            if matched:
                # Apply validation (conflict groups, intensity, budget)
                validated = self._validate_composition(
                    matched,
                    phase_budgets.get(phase, 30),
                    max_intensity
                )

                if validated:
                    # Compose blocks from validated components
                    result[phase] = self._compose_phase_blocks(validated)
                    # Track source (expert if any expert component used)
                    if any(c.get("source_type") == "expert" for c in validated):
                        component_sources[phase] = "expert"
                    else:
                        component_sources[phase] = "scaffold"
                else:
                    # All components filtered out, use inline fallback
                    result[phase] = self._get_fallback_blocks(phase, session_type)
                    component_sources[phase] = "scaffold"
            else:
                # No components matched, use inline fallback
                result[phase] = self._get_fallback_blocks(phase, session_type)
                component_sources[phase] = "scaffold"

        return {
            "warmup": result.get("warmup", []),
            "main": result.get("main", []),
            "cooldown": result.get("cooldown", []),
            "component_sources": component_sources,
        }

    def _get_fallback_blocks(self, phase: str, session_type: str) -> List[Dict]:
        """
        Return inline fallback blocks when no database components match.
        This is the original scaffold logic as a safety net.
        """
        if phase == "warmup":
            return [
                {
                    "title": "General Activation",
                    "duration_min": 5 if session_type != "active_recovery" else 10,
                    "intensity_score": 2,
                    "exercises": [
                        {"name": "Light cardio", "duration": "3-5 min", "notes": "Easy jog, bike, or brisk walk"},
                        {"name": "Joint prep", "duration": "2-3 min", "notes": "Arm circles, shoulder rolls, hip circles"},
                    ],
                },
                {
                    "title": "Climbing-Specific Prep",
                    "duration_min": 10,
                    "intensity_score": 3,
                    "exercises": [
                        {"name": "Easy traverses", "duration": "5-7 min", "notes": "On jugs, breathing through the nose"},
                        {"name": "Gradual difficulty build", "sets": 3, "reps": "1 problem per set", "notes": "VB -> V0 -> V1"},
                    ],
                },
            ]
        elif phase == "main":
            if session_type == "active_recovery":
                return [{
                    "title": "Active Recovery Climbing",
                    "duration_min": 30,
                    "intensity_score": 2,
                    "focus": "Very easy climbing to promote circulation",
                    "exercises": [
                        {"name": "Easy traverses", "duration": "20-30 min", "intensity": "RPE 2-3"},
                        {"name": "Mobility flow", "duration": "10-15 min"},
                    ],
                }]
            elif session_type == "volume":
                return [{
                    "title": "Volume Mileage Block",
                    "duration_min": 45,
                    "intensity_score": 5,
                    "focus": "Accumulate submaximal climbs",
                    "exercises": [
                        {"name": "Continuous circuits", "sets": 3, "reps": "4-6 problems", "rest": "3-4 min"},
                        {"name": "Downclimb drills", "sets": 2, "reps": "2-3 problems"},
                    ],
                }]
            elif session_type == "project":
                return [{
                    "title": "Limit Bouldering / Project Work",
                    "duration_min": 60,
                    "intensity_score": 9,
                    "focus": "High-quality attempts on hardest climbs",
                    "exercises": [
                        {"name": "Project attempts", "sets": 4, "reps": "2-3 attempts", "rest": "3-5 min"},
                        {"name": "Movement rehearsal", "sets": 2, "reps": "5-8 rehearsals"},
                    ],
                }]
            elif session_type == "technique":
                return [{
                    "title": "Technique Drills Block",
                    "duration_min": 45,
                    "intensity_score": 4,
                    "focus": "Refine movement quality",
                    "exercises": [
                        {"name": "Silent feet drill", "sets": 3, "reps": "3 problems"},
                        {"name": "Hip position drill", "sets": 2, "reps": "3-4 problems"},
                    ],
                }]
            else:
                return [{
                    "title": "General Climbing Session",
                    "duration_min": 45,
                    "intensity_score": 6,
                    "focus": "Balanced movement quality and effort",
                    "exercises": [
                        {"name": "Pyramid set", "sets": 4, "reps": "1 problem per set"},
                        {"name": "Technique finisher", "duration": "10-15 min"},
                    ],
                }]
        elif phase == "cooldown":
            return [{
                "title": "Cooldown & Reset",
                "duration_min": 10,
                "intensity_score": 1,
                "exercises": [
                    {"name": "Easy movement", "duration": "5 min", "notes": "Gradually bring HR down"},
                    {"name": "Stretch & breathe", "duration": "5-10 min", "notes": "Forearms, shoulders, hips"},
                ],
            }]
        return []
    
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

