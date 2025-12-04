"""
Rule Engine for Expert Capture System

Matches and applies expert-defined rules at recommendation time.
Provides a flexible rule evaluation system for handling edge cases
and safety constraints.
"""

import time
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from supabase import Client


class RuleEngine:
    """
    Rule engine for matching and applying expert rules.
    
    Rules are structured as:
    - Conditions: IF clauses that determine when a rule applies
    - Actions: THEN clauses that modify recommendations or add constraints
    
    Condition types:
    - ALL: All conditions must be true
    - ANY: At least one condition must be true
    - NOT: Nested conditions must be false
    
    Action types:
    - suppress: Remove a recommendation
    - add_recommendation: Add a specific recommendation
    - modify_coefficient: Adjust a model coefficient
    - override: Override the entire recommendation
    """
    
    # Cache TTL in seconds
    CACHE_TTL = 300  # 5 minutes
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
        self._rule_cache: Optional[List[Dict]] = None
        self._cache_timestamp: Optional[datetime] = None
    
    def get_active_rules(self, force_refresh: bool = False) -> List[Dict[str, Any]]:
        """
        Fetch all active rules with caching.
        Rules are cached for CACHE_TTL seconds to improve performance.
        """
        now = datetime.utcnow()
        
        # Check if cache is valid
        if (not force_refresh and 
            self._rule_cache is not None and 
            self._cache_timestamp is not None and
            (now - self._cache_timestamp).total_seconds() < self.CACHE_TTL):
            return self._rule_cache
        
        # Fetch rules from database
        result = self.supabase.table("expert_rules").select("*").eq("is_active", True).order("priority", desc=True).execute()
        
        self._rule_cache = result.data or []
        self._cache_timestamp = now
        
        return self._rule_cache
    
    def match_rules(self, user_state: Dict[str, Any]) -> List[Dict[str, Any]]:
        """
        Find all rules that match the current user state.
        
        Args:
            user_state: Combined baseline + pre-session data
        
        Returns:
            List of matched rules, sorted by priority (highest first)
        """
        rules = self.get_active_rules()
        matched = []
        
        for rule in rules:
            conditions = rule.get("conditions", {})
            if self._evaluate_conditions(conditions, user_state):
                matched.append(rule)
        
        # Already sorted by priority from database query
        return matched
    
    def apply_rules(
        self,
        matched_rules: List[Dict],
        model_recommendations: Dict[str, Any],
        model_coefficients: Optional[Dict[str, float]] = None
    ) -> Dict[str, Any]:
        """
        Apply matched rules to model output.
        
        Args:
            matched_rules: Rules that matched the user state
            model_recommendations: Original recommendations from the model
            model_coefficients: Optional model coefficients that can be modified
        
        Returns:
            Modified recommendations with rule applications logged
        """
        result = {
            "recommendations": dict(model_recommendations),
            "coefficients": dict(model_coefficients) if model_coefficients else {},
            "rules_applied": [],
            "warnings": [],
            "overridden": False,
        }
        
        for rule in matched_rules:
            actions = rule.get("actions", [])
            rule_applied = False
            
            for action in actions:
                action_type = action.get("type")
                
                if action_type == "suppress":
                    target = action.get("target")
                    if target and target in result["recommendations"]:
                        del result["recommendations"][target]
                        rule_applied = True
                
                elif action_type == "add_recommendation":
                    rec = action.get("recommendation", {})
                    target = action.get("target")
                    if target:
                        result["recommendations"][target] = rec
                    else:
                        result["recommendations"].update(rec)
                    rule_applied = True
                    
                    # Add any warnings
                    if action.get("message"):
                        result["warnings"].append({
                            "source": rule.get("name"),
                            "category": rule.get("rule_category"),
                            "message": action.get("message"),
                            "reason": action.get("reason"),
                        })
                
                elif action_type == "modify_coefficient":
                    target = action.get("target")
                    multiplier = action.get("multiplier", 1.0)
                    if target and target in result["coefficients"]:
                        result["coefficients"][target] *= multiplier
                        rule_applied = True
                
                elif action_type == "override":
                    # Complete override - replace all recommendations
                    override_rec = action.get("recommendation", {})
                    result["recommendations"] = override_rec
                    result["overridden"] = True
                    rule_applied = True
                    
                    if action.get("message"):
                        result["warnings"].append({
                            "source": rule.get("name"),
                            "category": rule.get("rule_category"),
                            "message": action.get("message"),
                            "reason": action.get("reason"),
                            "is_override": True,
                        })
                    
                    # Stop processing after override
                    break
            
            if rule_applied:
                result["rules_applied"].append({
                    "rule_id": rule.get("id"),
                    "rule_name": rule.get("name"),
                    "category": rule.get("rule_category"),
                    "priority": rule.get("priority"),
                })
            
            # Stop if we hit an override
            if result["overridden"]:
                break
        
        return result
    
    def _evaluate_conditions(self, conditions: Dict[str, Any], state: Dict[str, Any]) -> bool:
        """
        Evaluate IF clause against user state.
        
        Supports:
        - ALL: [conditions] - all must be true
        - ANY: [conditions] - at least one must be true
        - NOT: {conditions} - nested conditions must be false
        - Direct condition: {field, op, value}
        """
        if not conditions:
            return True
        
        # Handle ALL conditions
        if "ALL" in conditions:
            all_conditions = conditions["ALL"]
            return all(self._evaluate_single_condition(c, state) for c in all_conditions)
        
        # Handle ANY conditions
        if "ANY" in conditions:
            any_conditions = conditions["ANY"]
            return any(self._evaluate_single_condition(c, state) for c in any_conditions)
        
        # Handle NOT conditions
        if "NOT" in conditions:
            not_conditions = conditions["NOT"]
            return not self._evaluate_conditions(not_conditions, state)
        
        # Single condition
        return self._evaluate_single_condition(conditions, state)
    
    def _evaluate_single_condition(self, condition: Dict[str, Any], state: Dict[str, Any]) -> bool:
        """Evaluate a single condition against the state"""
        field = condition.get("field")
        op = condition.get("op")
        value = condition.get("value")
        
        if not field or not op:
            return False
        
        # Get actual value from state (support nested paths like "injury.severity")
        actual = self._get_nested_value(state, field)
        
        if actual is None and op not in ["==", "!="]:
            return False
        
        # Evaluate based on operator
        try:
            if op == ">=":
                return actual >= value
            elif op == "<=":
                return actual <= value
            elif op == ">":
                return actual > value
            elif op == "<":
                return actual < value
            elif op == "==":
                return actual == value
            elif op == "!=":
                return actual != value
            elif op == "in":
                return actual in value if isinstance(value, (list, tuple)) else False
            elif op == "contains":
                if isinstance(actual, (list, tuple)):
                    return value in actual
                elif isinstance(actual, str):
                    return value in actual
                return False
            elif op == "contains_location":
                # Special operator for injury location matching
                if isinstance(actual, list):
                    return any(
                        item.get("location") == value or value in str(item.get("location", ""))
                        for item in actual
                        if isinstance(item, dict)
                    )
                return False
            else:
                return False
        except (TypeError, ValueError):
            return False
    
    def _get_nested_value(self, data: Dict, path: str) -> Any:
        """Get a value from nested dict using dot notation path"""
        keys = path.split(".")
        value = data
        
        for key in keys:
            if isinstance(value, dict):
                value = value.get(key)
            elif isinstance(value, list) and key.isdigit():
                idx = int(key)
                value = value[idx] if 0 <= idx < len(value) else None
            else:
                return None
        
        return value
    
    def validate_rule(self, rule_data: Dict[str, Any]) -> Tuple[bool, List[str]]:
        """
        Validate a rule before saving.
        
        Returns:
            Tuple of (is_valid, list_of_errors)
        """
        errors = []
        
        # Check required fields
        if not rule_data.get("name"):
            errors.append("Rule name is required")
        
        if not rule_data.get("conditions"):
            errors.append("Rule conditions are required")
        
        if not rule_data.get("actions"):
            errors.append("Rule actions are required")
        
        if not rule_data.get("rule_category"):
            errors.append("Rule category is required")
        
        # Validate condition structure
        conditions = rule_data.get("conditions", {})
        if not self._validate_conditions_structure(conditions):
            errors.append("Invalid condition structure")
        
        # Validate actions
        actions = rule_data.get("actions", [])
        for i, action in enumerate(actions):
            action_type = action.get("type")
            if action_type not in ["suppress", "add_recommendation", "modify_coefficient", "override"]:
                errors.append(f"Invalid action type in action {i}: {action_type}")
        
        # Check priority range
        priority = rule_data.get("priority", 50)
        if not (0 <= priority <= 100):
            errors.append("Priority must be between 0 and 100")
        
        return len(errors) == 0, errors
    
    def _validate_conditions_structure(self, conditions: Dict) -> bool:
        """Validate the structure of conditions"""
        if not conditions:
            return False
        
        valid_keys = {"ALL", "ANY", "NOT", "field", "op", "value"}
        
        for key in conditions.keys():
            if key not in valid_keys:
                return False
        
        # Recursively validate nested conditions
        if "ALL" in conditions:
            for c in conditions["ALL"]:
                if not self._validate_single_condition_structure(c):
                    return False
        
        if "ANY" in conditions:
            for c in conditions["ANY"]:
                if not self._validate_single_condition_structure(c):
                    return False
        
        if "NOT" in conditions:
            if not self._validate_conditions_structure(conditions["NOT"]):
                return False
        
        return True
    
    def _validate_single_condition_structure(self, condition: Dict) -> bool:
        """Validate a single condition"""
        required_keys = {"field", "op", "value"}
        valid_ops = {">=", "<=", ">", "<", "==", "!=", "in", "contains", "contains_location"}
        
        if not all(k in condition for k in ["field", "op"]):
            return False
        
        if condition.get("op") not in valid_ops:
            return False
        
        return True
    
    def test_rule(self, rule: Dict[str, Any], test_states: List[Dict[str, Any]]) -> Dict[str, Any]:
        """
        Test a rule against multiple test states.
        
        Returns:
            Results showing which states matched and what actions would be taken.
        """
        results = []
        
        for i, state in enumerate(test_states):
            conditions = rule.get("conditions", {})
            matched = self._evaluate_conditions(conditions, state)
            
            result = {
                "test_case": i + 1,
                "matched": matched,
                "state_summary": {k: v for k, v in state.items() if k in rule.get("condition_fields", [])},
            }
            
            if matched:
                # Simulate action application
                mock_recommendations = {"session_type": "volume", "intensity": "moderate"}
                mock_coefficients = {"energy": 1.0, "motivation": 1.0}
                
                applied = self.apply_rules([rule], mock_recommendations, mock_coefficients)
                result["actions_applied"] = applied.get("rules_applied", [])
                result["warnings_generated"] = applied.get("warnings", [])
            
            results.append(result)
        
        return {
            "rule_name": rule.get("name"),
            "test_cases": len(test_states),
            "matched_count": sum(1 for r in results if r["matched"]),
            "results": results,
        }
    
    def get_rules_by_category(self) -> Dict[str, List[Dict]]:
        """Get all active rules grouped by category"""
        rules = self.get_active_rules()
        
        by_category = {}
        for rule in rules:
            category = rule.get("rule_category", "other")
            if category not in by_category:
                by_category[category] = []
            by_category[category].append(rule)
        
        return by_category
    
    def find_conflicting_rules(self) -> List[Dict[str, Any]]:
        """
        Identify rules that might conflict with each other.
        
        Conflicts can occur when:
        - Two rules have overlapping conditions but different actions
        - A lower priority rule would never fire due to higher priority rule
        """
        rules = self.get_active_rules()
        conflicts = []
        
        for i, rule1 in enumerate(rules):
            for rule2 in rules[i + 1:]:
                # Check for overlapping condition fields
                fields1 = set(rule1.get("condition_fields", []))
                fields2 = set(rule2.get("condition_fields", []))
                
                overlap = fields1 & fields2
                if overlap:
                    # Check if actions might conflict
                    actions1 = [a.get("type") for a in rule1.get("actions", [])]
                    actions2 = [a.get("type") for a in rule2.get("actions", [])]
                    
                    if "override" in actions1 or "override" in actions2:
                        conflicts.append({
                            "rule1": rule1.get("name"),
                            "rule2": rule2.get("name"),
                            "overlap_fields": list(overlap),
                            "conflict_type": "override",
                            "priority_diff": rule1.get("priority", 50) - rule2.get("priority", 50),
                        })
                    elif set(actions1) & set(actions2):
                        conflicts.append({
                            "rule1": rule1.get("name"),
                            "rule2": rule2.get("name"),
                            "overlap_fields": list(overlap),
                            "conflict_type": "action_overlap",
                            "shared_actions": list(set(actions1) & set(actions2)),
                        })
        
        return conflicts

