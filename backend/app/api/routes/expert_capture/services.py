"""
Business logic for the Expert Capture system
"""

from typing import List, Optional, Dict, Any
from datetime import datetime
import statistics
from supabase import Client

from .schemas import (
    ReviewSessionCreate, ReviewSessionUpdate,
    SyntheticScenarioCreate,
    ExpertResponseCreate, ExpertResponseUpdate,
    ExpertRuleCreate, ExpertRuleUpdate,
    ScenarioConsensusCreate,
    ScenarioStatus
)


class ExpertCaptureService:
    """Service class for Expert Capture operations"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    # ============ REVIEW SESSIONS ============
    
    def create_review_session(self, session: ReviewSessionCreate) -> Dict[str, Any]:
        """Create a new expert review session"""
        data = {
            "session_date": str(session.session_date),
            "session_name": session.session_name,
            "participants": session.participants,
            "notes": session.notes,
            "status": "active",
        }
        
        result = self.supabase.table("rule_review_sessions").insert(data).execute()
        return result.data[0] if result.data else {}
    
    def list_review_sessions(self, status: Optional[str] = None) -> List[Dict[str, Any]]:
        """List all review sessions with optional status filter"""
        query = self.supabase.table("rule_review_sessions").select("*").order("created_at", desc=True)
        
        if status:
            query = query.eq("status", status)
        
        result = query.execute()
        return result.data or []
    
    def get_review_session(self, session_id: str) -> Dict[str, Any]:
        """Get review session details with associated scenarios"""
        # Get session
        session_result = self.supabase.table("rule_review_sessions").select("*").eq("id", session_id).single().execute()
        session = session_result.data
        
        if not session:
            return {}
        
        # Get associated scenarios
        scenarios_result = self.supabase.table("synthetic_scenarios").select("*").eq("review_session_id", session_id).execute()
        session["scenarios"] = scenarios_result.data or []
        
        return session
    
    def update_review_session(self, session_id: str, update: ReviewSessionUpdate) -> Dict[str, Any]:
        """Update a review session"""
        data = {k: v for k, v in update.model_dump().items() if v is not None}
        
        if data.get("status") == "completed":
            data["completed_at"] = datetime.utcnow().isoformat()
        
        result = self.supabase.table("rule_review_sessions").update(data).eq("id", session_id).execute()
        return result.data[0] if result.data else {}
    
    # ============ SCENARIOS ============
    
    def create_scenario(self, scenario: SyntheticScenarioCreate) -> Dict[str, Any]:
        """Create a new synthetic scenario"""
        data = {
            "baseline_snapshot": scenario.baseline_snapshot,
            "pre_session_snapshot": scenario.pre_session_snapshot,
            "scenario_description": scenario.scenario_description,
            "edge_case_tags": scenario.edge_case_tags,
            "difficulty_level": scenario.difficulty_level.value if hasattr(scenario.difficulty_level, 'value') else scenario.difficulty_level,
            "ai_recommendation": scenario.ai_recommendation,
            "ai_reasoning": scenario.ai_reasoning,
            "assigned_reviewers": scenario.assigned_reviewers,
            "generation_batch": scenario.generation_batch,
            "status": "pending",
        }
        
        result = self.supabase.table("synthetic_scenarios").insert(data).execute()
        return result.data[0] if result.data else {}
    
    def list_scenarios(
        self,
        status: Optional[ScenarioStatus] = None,
        review_session_id: Optional[str] = None,
        edge_case_tag: Optional[str] = None,
        limit: int = 20,
        offset: int = 0
    ) -> List[Dict[str, Any]]:
        """List scenarios with optional filters"""
        query = self.supabase.table("synthetic_scenarios").select("*").order("generated_at", desc=True)
        
        if status:
            query = query.eq("status", status.value if hasattr(status, 'value') else status)
        if review_session_id:
            query = query.eq("review_session_id", review_session_id)
        if edge_case_tag:
            query = query.contains("edge_case_tags", [edge_case_tag])
        
        query = query.range(offset, offset + limit - 1)
        result = query.execute()
        return result.data or []
    
    def get_scenario(self, scenario_id: str) -> Dict[str, Any]:
        """Get a single scenario by ID"""
        result = self.supabase.table("synthetic_scenarios").select("*").eq("id", scenario_id).single().execute()
        return result.data or {}
    
    def get_next_scenario_for_expert(
        self,
        expert_id: str,
        review_session_id: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """Get next unreviewed scenario for an expert"""
        # Get scenarios the expert has already reviewed
        reviewed_result = self.supabase.table("expert_scenario_responses").select("scenario_id").eq("expert_id", expert_id).execute()
        reviewed_ids = [r["scenario_id"] for r in (reviewed_result.data or [])]
        
        # Query for pending scenarios not yet reviewed by this expert
        query = self.supabase.table("synthetic_scenarios").select("*").in_("status", ["pending", "in_review"]).order("generated_at", desc=False)
        
        if review_session_id:
            query = query.eq("review_session_id", review_session_id)
        
        result = query.execute()
        
        # Filter out already reviewed scenarios
        for scenario in (result.data or []):
            if scenario["id"] not in reviewed_ids:
                return scenario
        
        return None
    
    def get_scenario_with_responses(self, scenario_id: str) -> Dict[str, Any]:
        """Get scenario with all expert responses"""
        scenario = self.get_scenario(scenario_id)
        if not scenario:
            return {}
        
        responses_result = self.supabase.table("expert_scenario_responses").select("*").eq("scenario_id", scenario_id).execute()
        scenario["responses"] = responses_result.data or []
        
        return scenario
    
    def update_scenario_status(self, scenario_id: str, status: ScenarioStatus) -> Dict[str, Any]:
        """Update scenario status"""
        data = {"status": status.value if hasattr(status, 'value') else status}
        
        if status == ScenarioStatus.consensus_reached:
            data["reviewed_at"] = datetime.utcnow().isoformat()
        
        result = self.supabase.table("synthetic_scenarios").update(data).eq("id", scenario_id).execute()
        return result.data[0] if result.data else {}
    
    # ============ EXPERT RESPONSES ============
    
    def create_response(self, response: ExpertResponseCreate) -> Dict[str, Any]:
        """Create a new expert response"""
        data = {
            "scenario_id": response.scenario_id,
            "expert_id": response.expert_id,
            "predicted_quality_optimal": response.predicted_quality_optimal,
            "predicted_quality_baseline": response.predicted_quality_baseline,
            "prediction_confidence": response.prediction_confidence.value,
            "recommended_session_type": response.recommended_session_type.value,
            "session_type_confidence": response.session_type_confidence.value,
            "treatment_recommendations": {k: v.model_dump() for k, v in response.treatment_recommendations.items()} if response.treatment_recommendations else {},
            "counterfactuals": [c.model_dump() for c in response.counterfactuals],
            "key_drivers": [k.model_dump() for k in response.key_drivers],
            "interaction_effects": [i.model_dump() for i in response.interaction_effects],
            "session_structure": response.session_structure.model_dump() if response.session_structure else None,
            "reasoning": response.reasoning,
            "agrees_with_ai": response.agrees_with_ai,
            "response_duration_sec": response.response_duration_sec,
            "is_complete": True,
        }
        
        result = self.supabase.table("expert_scenario_responses").insert(data).execute()
        
        # Update scenario status to in_review if it was pending
        self.supabase.table("synthetic_scenarios").update({"status": "in_review"}).eq("id", response.scenario_id).eq("status", "pending").execute()
        
        return result.data[0] if result.data else {}
    
    def get_response(self, response_id: str) -> Dict[str, Any]:
        """Get a specific expert response"""
        result = self.supabase.table("expert_scenario_responses").select("*").eq("id", response_id).single().execute()
        return result.data or {}
    
    def update_response(self, response_id: str, update: ExpertResponseUpdate) -> Dict[str, Any]:
        """Update an existing response"""
        data = {}
        
        for field, value in update.model_dump().items():
            if value is not None:
                if field == "prediction_confidence" or field == "session_type_confidence":
                    data[field] = value.value if hasattr(value, 'value') else value
                elif field == "recommended_session_type":
                    data[field] = value.value if hasattr(value, 'value') else value
                elif field == "treatment_recommendations":
                    data[field] = {k: v.model_dump() if hasattr(v, 'model_dump') else v for k, v in value.items()}
                elif field in ["counterfactuals", "key_drivers", "interaction_effects"]:
                    data[field] = [item.model_dump() if hasattr(item, 'model_dump') else item for item in value]
                elif field == "session_structure":
                    data[field] = value.model_dump() if hasattr(value, 'model_dump') else value
                else:
                    data[field] = value
        
        data["updated_at"] = datetime.utcnow().isoformat()
        
        result = self.supabase.table("expert_scenario_responses").update(data).eq("id", response_id).execute()
        return result.data[0] if result.data else {}
    
    def list_responses_by_expert(
        self,
        expert_id: str,
        review_session_id: Optional[str] = None
    ) -> List[Dict[str, Any]]:
        """List all responses from a specific expert"""
        query = self.supabase.table("expert_scenario_responses").select("*, synthetic_scenarios(*)").eq("expert_id", expert_id).order("created_at", desc=True)
        
        result = query.execute()
        responses = result.data or []
        
        # Filter by review session if provided
        if review_session_id:
            responses = [r for r in responses if r.get("synthetic_scenarios", {}).get("review_session_id") == review_session_id]
        
        return responses
    
    # ============ CONSENSUS ============
    
    def calculate_consensus(self, scenario_id: str) -> Dict[str, Any]:
        """Calculate consensus from all expert responses for a scenario"""
        # Get all complete responses for the scenario
        responses_result = self.supabase.table("expert_scenario_responses").select("*").eq("scenario_id", scenario_id).eq("is_complete", True).execute()
        responses = responses_result.data or []
        
        if not responses:
            return {"error": "No complete responses found for scenario"}
        
        n_experts = len(responses)
        
        # Calculate consensus values
        quality_optimal_values = [r["predicted_quality_optimal"] for r in responses if r.get("predicted_quality_optimal")]
        quality_baseline_values = [r["predicted_quality_baseline"] for r in responses if r.get("predicted_quality_baseline")]
        
        consensus_quality_optimal = statistics.mean(quality_optimal_values) if quality_optimal_values else None
        consensus_quality_baseline = statistics.mean(quality_baseline_values) if quality_baseline_values else None
        
        # Calculate session type consensus (mode)
        session_types = [r["recommended_session_type"] for r in responses if r.get("recommended_session_type")]
        consensus_session_type = max(set(session_types), key=session_types.count) if session_types else None
        
        # Calculate agreement score
        if quality_optimal_values and len(quality_optimal_values) > 1:
            std_dev = statistics.stdev(quality_optimal_values)
            max_possible_std = 4.5  # Max possible std dev for 1-10 scale
            agreement_score = 1 - (std_dev / max_possible_std)
        else:
            agreement_score = 1.0 if quality_optimal_values else None
        
        # Identify disputed factors (where experts disagree significantly)
        disputed_factors = []
        if session_types and len(set(session_types)) > 1:
            disputed_factors.append("session_type")
        if quality_optimal_values and len(quality_optimal_values) > 1:
            if statistics.stdev(quality_optimal_values) > 2:
                disputed_factors.append("quality_prediction")
        
        # Extract coefficient signals from counterfactuals
        coefficient_signals = self._extract_coefficient_signals(responses)
        
        # Create or update consensus record
        consensus_data = {
            "scenario_id": scenario_id,
            "consensus_quality_optimal": consensus_quality_optimal,
            "consensus_quality_baseline": consensus_quality_baseline,
            "consensus_session_type": consensus_session_type,
            "coefficient_signals": coefficient_signals,
            "expert_agreement_score": agreement_score,
            "n_experts": n_experts,
            "disputed_factors": disputed_factors,
        }
        
        # Upsert consensus
        existing = self.supabase.table("scenario_consensus").select("id").eq("scenario_id", scenario_id).execute()
        
        if existing.data:
            result = self.supabase.table("scenario_consensus").update(consensus_data).eq("scenario_id", scenario_id).execute()
        else:
            result = self.supabase.table("scenario_consensus").insert(consensus_data).execute()
        
        # Update scenario status
        new_status = "consensus_reached" if agreement_score and agreement_score > 0.7 else "disputed"
        self.update_scenario_status(scenario_id, ScenarioStatus(new_status))
        
        return result.data[0] if result.data else consensus_data
    
    def _extract_coefficient_signals(self, responses: List[Dict[str, Any]]) -> Dict[str, Any]:
        """Extract coefficient signals from expert counterfactuals"""
        signals = {}
        
        for response in responses:
            counterfactuals = response.get("counterfactuals", [])
            for cf in counterfactuals:
                variable = cf.get("variable")
                if not variable:
                    continue
                
                actual = cf.get("actual_value", 0)
                counterfactual = cf.get("counterfactual_value", 0)
                quality_change = cf.get("new_predicted_quality", 0) - response.get("predicted_quality_optimal", 0)
                
                if variable not in signals:
                    signals[variable] = {"effects": [], "experts": []}
                
                # Calculate implied effect per unit change
                value_change = counterfactual - actual
                if value_change != 0:
                    implied_effect = quality_change / value_change
                    signals[variable]["effects"].append(implied_effect)
                    signals[variable]["experts"].append(response.get("expert_id"))
        
        # Aggregate signals
        aggregated = {}
        for variable, data in signals.items():
            effects = data["effects"]
            if effects:
                aggregated[variable] = {
                    "mean_effect": statistics.mean(effects),
                    "std_dev": statistics.stdev(effects) if len(effects) > 1 else 0,
                    "n_judgments": len(effects),
                    "n_experts": len(set(data["experts"])),
                }
        
        return aggregated
    
    def list_consensus(self, processed: Optional[bool] = None) -> List[Dict[str, Any]]:
        """List all consensus records"""
        query = self.supabase.table("scenario_consensus").select("*").order("created_at", desc=True)
        
        if processed is not None:
            query = query.eq("processed_into_priors", processed)
        
        result = query.execute()
        return result.data or []
    
    # ============ RULES ============
    
    def create_rule(self, rule: ExpertRuleCreate, created_by: str) -> Dict[str, Any]:
        """Create a new expert rule"""
        data = {
            "name": rule.name,
            "description": rule.description,
            "conditions": rule.conditions,
            "actions": rule.actions,
            "condition_fields": rule.condition_fields,
            "rule_category": rule.rule_category.value if hasattr(rule.rule_category, 'value') else rule.rule_category,
            "priority": rule.priority,
            "confidence": rule.confidence.value if hasattr(rule.confidence, 'value') else rule.confidence,
            "source": rule.source.value if hasattr(rule.source, 'value') else rule.source,
            "evidence": rule.evidence,
            "contributors": rule.contributors,
            "source_scenario_id": rule.source_scenario_id,
            "review_session_id": rule.review_session_id,
            "created_by": created_by,
            "is_active": True,
        }
        
        result = self.supabase.table("expert_rules").insert(data).execute()
        
        if result.data:
            # Create audit log entry
            self._create_audit_log(result.data[0]["id"], "created", created_by, None, result.data[0])
        
        return result.data[0] if result.data else {}
    
    def list_rules(
        self,
        category: Optional[str] = None,
        is_active: Optional[bool] = True
    ) -> List[Dict[str, Any]]:
        """List rules with optional filters"""
        query = self.supabase.table("expert_rules").select("*").order("priority", desc=True)
        
        if category:
            query = query.eq("rule_category", category)
        if is_active is not None:
            query = query.eq("is_active", is_active)
        
        result = query.execute()
        return result.data or []
    
    def get_rule(self, rule_id: str) -> Dict[str, Any]:
        """Get rule details with audit history"""
        rule_result = self.supabase.table("expert_rules").select("*").eq("id", rule_id).single().execute()
        rule = rule_result.data
        
        if rule:
            # Get audit history
            audit_result = self.supabase.table("rule_audit_log").select("*").eq("rule_id", rule_id).order("created_at", desc=True).execute()
            rule["audit_history"] = audit_result.data or []
        
        return rule or {}
    
    def update_rule(self, rule_id: str, updates: Dict[str, Any], updated_by: str, reason: Optional[str] = None) -> Dict[str, Any]:
        """Update a rule with audit logging"""
        # Get current state
        current = self.get_rule(rule_id)
        if not current:
            return {}
        
        # Remove audit_history from current for comparison
        current.pop("audit_history", None)
        
        # Update
        updates["updated_at"] = datetime.utcnow().isoformat()
        result = self.supabase.table("expert_rules").update(updates).eq("id", rule_id).execute()
        
        if result.data:
            self._create_audit_log(rule_id, "modified", updated_by, current, result.data[0], reason)
        
        return result.data[0] if result.data else {}
    
    def deactivate_rule(self, rule_id: str, reason: str, deactivated_by: str) -> Dict[str, Any]:
        """Deactivate a rule"""
        return self.update_rule(rule_id, {"is_active": False}, deactivated_by, reason)
    
    def _create_audit_log(
        self,
        rule_id: str,
        action: str,
        changed_by: str,
        previous_state: Optional[Dict],
        new_state: Dict,
        reason: Optional[str] = None
    ):
        """Create an audit log entry"""
        data = {
            "rule_id": rule_id,
            "action": action,
            "changed_by": changed_by,
            "previous_state": previous_state,
            "new_state": new_state,
            "reason": reason,
        }
        self.supabase.table("rule_audit_log").insert(data).execute()
    
    # ============ ANALYTICS ============
    
    def get_analytics_overview(self) -> Dict[str, Any]:
        """Get overview analytics for expert capture system"""
        # Count scenarios by status
        scenarios = self.supabase.table("synthetic_scenarios").select("status", count="exact").execute()
        total_scenarios = scenarios.count or 0
        
        pending = self.supabase.table("synthetic_scenarios").select("*", count="exact").eq("status", "pending").execute()
        pending_scenarios = pending.count or 0
        
        reviewed = self.supabase.table("synthetic_scenarios").select("*", count="exact").eq("status", "consensus_reached").execute()
        reviewed_scenarios = reviewed.count or 0
        
        # Count responses
        all_responses = self.supabase.table("expert_scenario_responses").select("*", count="exact").execute()
        total_responses = all_responses.count or 0
        
        complete_responses = self.supabase.table("expert_scenario_responses").select("*", count="exact").eq("is_complete", True).execute()
        complete_count = complete_responses.count or 0
        
        # Count rules
        all_rules = self.supabase.table("expert_rules").select("*", count="exact").execute()
        total_rules = all_rules.count or 0
        
        active_rules = self.supabase.table("expert_rules").select("*", count="exact").eq("is_active", True).execute()
        active_count = active_rules.count or 0
        
        # Count review sessions
        all_sessions = self.supabase.table("rule_review_sessions").select("*", count="exact").execute()
        total_sessions = all_sessions.count or 0
        
        active_sessions = self.supabase.table("rule_review_sessions").select("*", count="exact").eq("status", "active").execute()
        active_session_count = active_sessions.count or 0
        
        # Calculate averages
        avg_responses = total_responses / total_scenarios if total_scenarios > 0 else 0
        
        # Get average agreement score
        consensus_records = self.supabase.table("scenario_consensus").select("expert_agreement_score").execute()
        agreement_scores = [c["expert_agreement_score"] for c in (consensus_records.data or []) if c.get("expert_agreement_score")]
        avg_agreement = statistics.mean(agreement_scores) if agreement_scores else None
        
        return {
            "total_scenarios": total_scenarios,
            "pending_scenarios": pending_scenarios,
            "reviewed_scenarios": reviewed_scenarios,
            "total_responses": total_responses,
            "complete_responses": complete_count,
            "total_rules": total_rules,
            "active_rules": active_count,
            "total_review_sessions": total_sessions,
            "active_review_sessions": active_session_count,
            "avg_responses_per_scenario": round(avg_responses, 2),
            "avg_agreement_score": round(avg_agreement, 3) if avg_agreement else None,
        }
    
    def get_expert_analytics(self, expert_id: str) -> Dict[str, Any]:
        """Get analytics for a specific expert"""
        # Get responses
        responses = self.supabase.table("expert_scenario_responses").select("*").eq("expert_id", expert_id).execute()
        response_data = responses.data or []
        
        total_responses = len(response_data)
        complete_responses = len([r for r in response_data if r.get("is_complete")])
        
        # Calculate average response time
        response_times = [r["response_duration_sec"] for r in response_data if r.get("response_duration_sec")]
        avg_response_time = statistics.mean(response_times) if response_times else None
        
        # Calculate AI agreement rate
        ai_agreements = [r["agrees_with_ai"] for r in response_data if r.get("agrees_with_ai")]
        agree_count = ai_agreements.count("yes") + ai_agreements.count("partially") * 0.5
        agreement_rate = agree_count / len(ai_agreements) if ai_agreements else 0
        
        # Count unique scenarios
        scenarios = set(r["scenario_id"] for r in response_data)
        
        # Count rules contributed
        rules = self.supabase.table("expert_rules").select("*", count="exact").contains("contributors", [expert_id]).execute()
        rules_contributed = rules.count or 0
        
        return {
            "expert_id": expert_id,
            "total_responses": total_responses,
            "complete_responses": complete_responses,
            "avg_response_time_sec": round(avg_response_time, 1) if avg_response_time else None,
            "scenarios_reviewed": len(scenarios),
            "agreement_rate_with_ai": round(agreement_rate, 3),
            "rules_contributed": rules_contributed,
        }

