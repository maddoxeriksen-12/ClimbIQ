"""
Prior Extractor for Expert Capture System

Extracts Bayesian coefficient signals from expert judgments and
blends them with literature priors for the recommendation engine.
"""

import math
import statistics
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from supabase import Client


# Literature-based priors (baseline estimates from research)
LITERATURE_PRIORS = {
    "sleep_quality": {
        "mean_effect": 0.25,  # Effect per unit on session quality
        "std": 0.1,
        "source": "Sleep research meta-analysis",
        "confidence": "high",
    },
    "energy_level": {
        "mean_effect": 0.3,
        "std": 0.12,
        "source": "Sports performance literature",
        "confidence": "high",
    },
    "motivation": {
        "mean_effect": 0.2,
        "std": 0.15,
        "source": "Motivation research",
        "confidence": "medium",
    },
    "stress_level": {
        "mean_effect": -0.15,  # Negative effect
        "std": 0.1,
        "source": "Stress-performance research",
        "confidence": "medium",
    },
    "muscle_soreness": {
        "mean_effect": -0.1,
        "std": 0.08,
        "source": "Recovery research",
        "confidence": "medium",
    },
    "days_since_last_session": {
        "mean_effect": -0.05,  # Complex - can be positive or negative
        "std": 0.2,
        "source": "Training periodization",
        "confidence": "low",
    },
    "caffeine_today": {
        "mean_effect": 0.15,  # Binary effect
        "std": 0.2,
        "source": "Caffeine research",
        "confidence": "medium",
    },
    "performance_anxiety": {
        "mean_effect": -0.2,
        "std": 0.15,
        "source": "Sports psychology",
        "confidence": "high",
    },
    "fear_of_falling": {
        "mean_effect": -0.1,
        "std": 0.1,
        "source": "Climbing-specific research",
        "confidence": "medium",
    },
    "warmup_duration_min": {
        "mean_effect": 0.02,  # Per minute
        "std": 0.01,
        "source": "Warmup meta-analysis",
        "confidence": "high",
    },
    "warmup_intensity": {
        "mean_effect": 0.1,  # Higher intensity (up to a point)
        "std": 0.1,
        "source": "PAP research",
        "confidence": "medium",
    },
    "main_session_rest_level": {
        "mean_effect": 0.15,  # Longer rest
        "std": 0.1,
        "source": "ATP-CP recovery research",
        "confidence": "high",
    },
    "hangboard_load": {
        "mean_effect": 0.05,  # Adjunct training
        "std": 0.15,
        "source": "Finger strength research",
        "confidence": "medium",
    },
}


class PriorExtractor:
    """Extracts and manages Bayesian priors from expert judgments"""
    
    def __init__(self, supabase: Client):
        self.supabase = supabase
    
    def extract_and_aggregate_priors(self) -> Dict[str, Any]:
        """
        Extract coefficient signals from all unprocessed consensus records
        and aggregate them into population priors.
        """
        # Get unprocessed consensus records
        result = self.supabase.table("scenario_consensus").select("*").eq("processed_into_priors", False).execute()
        consensus_records = result.data or []
        
        if not consensus_records:
            return {
                "status": "no_new_data",
                "message": "No unprocessed consensus records found",
            }
        
        # Extract signals from each consensus
        all_signals = {}
        for record in consensus_records:
            signals = record.get("coefficient_signals", {})
            for variable, signal_data in signals.items():
                if variable not in all_signals:
                    all_signals[variable] = []
                all_signals[variable].append({
                    "effect": signal_data.get("mean_effect", 0),
                    "n_judgments": signal_data.get("n_judgments", 1),
                    "std_dev": signal_data.get("std_dev", 0.5),
                    "scenario_id": record.get("scenario_id"),
                })
        
        # Aggregate using inverse-variance weighted meta-analysis
        aggregated_priors = {}
        for variable, signals in all_signals.items():
            aggregated = self._inverse_variance_aggregate(signals)
            aggregated["variable"] = variable
            aggregated["n_scenarios"] = len(signals)
            aggregated["total_judgments"] = sum(s["n_judgments"] for s in signals)
            aggregated_priors[variable] = aggregated
        
        # Blend with literature priors
        blended_priors = self._blend_with_literature(aggregated_priors)
        
        # Mark consensus records as processed
        for record in consensus_records:
            self.supabase.table("scenario_consensus").update({
                "processed_into_priors": True,
                "processed_at": datetime.utcnow().isoformat(),
            }).eq("id", record["id"]).execute()
        
        # Store aggregated priors
        self._store_priors(blended_priors)
        
        return {
            "status": "success",
            "scenarios_processed": len(consensus_records),
            "variables_updated": list(blended_priors.keys()),
            "priors": blended_priors,
        }
    
    def _inverse_variance_aggregate(self, signals: List[Dict]) -> Dict[str, Any]:
        """
        Aggregate multiple effect estimates using inverse-variance weighting.
        This gives more weight to more precise estimates.
        """
        if not signals:
            return {"mean_effect": 0, "std_dev": 1, "confidence": "low"}
        
        weights = []
        effects = []
        
        for signal in signals:
            std = max(signal.get("std_dev", 0.5), 0.1)  # Prevent division by zero
            weight = 1 / (std ** 2)
            weights.append(weight)
            effects.append(signal.get("effect", 0))
        
        total_weight = sum(weights)
        weighted_mean = sum(e * w for e, w in zip(effects, weights)) / total_weight
        
        # Pooled standard error
        pooled_variance = 1 / total_weight
        pooled_std = math.sqrt(pooled_variance)
        
        # Determine confidence based on number of judgments and consistency
        total_judgments = sum(s.get("n_judgments", 1) for s in signals)
        effect_std = statistics.stdev(effects) if len(effects) > 1 else 0
        
        if total_judgments >= 10 and effect_std < 0.3:
            confidence = "high"
        elif total_judgments >= 5:
            confidence = "medium"
        else:
            confidence = "low"
        
        return {
            "mean_effect": round(weighted_mean, 4),
            "std_dev": round(pooled_std, 4),
            "confidence": confidence,
            "min_effect": round(min(effects), 4) if effects else 0,
            "max_effect": round(max(effects), 4) if effects else 0,
        }
    
    def _blend_with_literature(
        self,
        expert_priors: Dict[str, Dict],
        expert_weight: float = 0.6
    ) -> Dict[str, Dict]:
        """
        Blend expert-derived priors with literature priors.
        Uses a weighted average, with more weight given to experts when
        we have sufficient data.
        """
        blended = {}
        
        # Include all variables from both sources
        all_variables = set(expert_priors.keys()) | set(LITERATURE_PRIORS.keys())
        
        for variable in all_variables:
            expert = expert_priors.get(variable, {})
            literature = LITERATURE_PRIORS.get(variable, {})
            
            if expert and literature:
                # Both sources available - blend them
                expert_effect = expert.get("mean_effect", 0)
                lit_effect = literature.get("mean_effect", 0)
                
                # Adjust weight based on expert data quality
                adj_expert_weight = expert_weight
                if expert.get("confidence") == "low":
                    adj_expert_weight = 0.3
                elif expert.get("confidence") == "high" and expert.get("n_scenarios", 0) >= 5:
                    adj_expert_weight = 0.8
                
                lit_weight = 1 - adj_expert_weight
                
                blended_effect = (expert_effect * adj_expert_weight + lit_effect * lit_weight)
                
                # Combine standard deviations
                expert_std = expert.get("std_dev", 0.5)
                lit_std = literature.get("std", 0.3)
                blended_std = math.sqrt((expert_std ** 2 * adj_expert_weight + lit_std ** 2 * lit_weight))
                
                blended[variable] = {
                    "mean_effect": round(blended_effect, 4),
                    "std_dev": round(blended_std, 4),
                    "expert_effect": expert_effect,
                    "literature_effect": lit_effect,
                    "expert_weight": adj_expert_weight,
                    "confidence": expert.get("confidence", literature.get("confidence", "medium")),
                    "n_scenarios": expert.get("n_scenarios", 0),
                    "total_judgments": expert.get("total_judgments", 0),
                    "sources": ["expert_judgment", literature.get("source", "literature")],
                }
            elif expert:
                # Only expert data
                blended[variable] = {
                    **expert,
                    "sources": ["expert_judgment"],
                }
            else:
                # Only literature data
                blended[variable] = {
                    "mean_effect": literature.get("mean_effect", 0),
                    "std_dev": literature.get("std", 0.3),
                    "confidence": literature.get("confidence", "medium"),
                    "n_scenarios": 0,
                    "total_judgments": 0,
                    "sources": [literature.get("source", "literature")],
                }
        
        return blended
    
    def _store_priors(self, priors: Dict[str, Dict]) -> None:
        """Store aggregated priors in the population_priors table"""
        for variable, prior_data in priors.items():
            # Determine source type
            has_expert = prior_data.get("n_scenarios", 0) > 0
            has_literature = "literature" in str(prior_data.get("sources", []))
            
            if has_expert and has_literature:
                source = "blended"
            elif has_expert:
                source = "expert_only"
            else:
                source = "literature_only"
            
            data = {
                "variable_name": variable,
                "population_mean": prior_data.get("mean_effect", 0),
                "population_std": prior_data.get("std_dev", 0.5),
                "individual_variance": prior_data.get("std_dev", 0.5) ** 2,
                "source": source,
                "confidence": prior_data.get("confidence", "medium"),
                "n_scenarios": prior_data.get("n_scenarios", 0),
                "total_judgments": prior_data.get("total_judgments", 0),
                "metadata": {
                    "sources": prior_data.get("sources", []),
                    "expert_effect": prior_data.get("expert_effect"),
                    "literature_effect": prior_data.get("literature_effect"),
                    "expert_weight": prior_data.get("expert_weight"),
                    "min_effect": prior_data.get("min_effect"),
                    "max_effect": prior_data.get("max_effect"),
                    "last_updated": datetime.utcnow().isoformat(),
                },
            }
            
            # Upsert into population_priors table
            try:
                self.supabase.table("population_priors").upsert(
                    data, 
                    on_conflict="variable_name"
                ).execute()
                print(f"[PRIORS] Updated prior for {variable}: mean={data['population_mean']:.4f}, std={data['population_std']:.4f}")
            except Exception as e:
                print(f"[PRIORS] Error storing prior for {variable}: {e}")
    
    def get_blended_priors(self) -> Dict[str, Any]:
        """Get current blended priors (literature + expert)"""
        # Get the latest expert priors
        result = self.supabase.table("scenario_consensus").select("coefficient_signals").execute()
        
        # Aggregate all signals
        all_signals = {}
        for record in (result.data or []):
            signals = record.get("coefficient_signals", {})
            for variable, signal_data in signals.items():
                if variable not in all_signals:
                    all_signals[variable] = []
                all_signals[variable].append({
                    "effect": signal_data.get("mean_effect", 0),
                    "n_judgments": signal_data.get("n_judgments", 1),
                    "std_dev": signal_data.get("std_dev", 0.5),
                })
        
        # Aggregate
        expert_priors = {}
        for variable, signals in all_signals.items():
            expert_priors[variable] = self._inverse_variance_aggregate(signals)
            expert_priors[variable]["n_scenarios"] = len(signals)
            expert_priors[variable]["total_judgments"] = sum(s["n_judgments"] for s in signals)
        
        # Blend with literature
        blended = self._blend_with_literature(expert_priors)
        
        return {
            "priors": blended,
            "total_variables": len(blended),
            "expert_data_available": len(expert_priors),
            "literature_only": len(blended) - len(expert_priors),
        }
    
    def compare_sources(self) -> Dict[str, Any]:
        """Compare literature priors vs expert-derived priors"""
        blended = self.get_blended_priors()
        priors = blended.get("priors", {})
        
        comparisons = []
        for variable, data in priors.items():
            if "expert_effect" in data and "literature_effect" in data:
                difference = data["expert_effect"] - data["literature_effect"]
                relative_diff = difference / abs(data["literature_effect"]) if data["literature_effect"] != 0 else 0
                
                comparisons.append({
                    "variable": variable,
                    "expert_effect": data["expert_effect"],
                    "literature_effect": data["literature_effect"],
                    "absolute_difference": round(difference, 4),
                    "relative_difference_pct": round(relative_diff * 100, 1),
                    "agreement": "high" if abs(relative_diff) < 0.2 else "medium" if abs(relative_diff) < 0.5 else "low",
                    "expert_n_scenarios": data.get("n_scenarios", 0),
                })
        
        # Sort by absolute difference (largest disagreements first)
        comparisons.sort(key=lambda x: abs(x["absolute_difference"]), reverse=True)
        
        return {
            "comparisons": comparisons,
            "variables_compared": len(comparisons),
            "high_agreement_count": len([c for c in comparisons if c["agreement"] == "high"]),
            "low_agreement_count": len([c for c in comparisons if c["agreement"] == "low"]),
        }
    
    def get_coefficient_analytics(self) -> Dict[str, Any]:
        """Get analytics on extracted coefficient signals"""
        blended = self.get_blended_priors()
        priors = blended.get("priors", {})
        
        # Categorize by confidence
        by_confidence = {"high": [], "medium": [], "low": []}
        for variable, data in priors.items():
            conf = data.get("confidence", "medium")
            by_confidence[conf].append(variable)
        
        # Categorize by effect direction
        positive_effects = [v for v, d in priors.items() if d.get("mean_effect", 0) > 0]
        negative_effects = [v for v, d in priors.items() if d.get("mean_effect", 0) < 0]
        neutral_effects = [v for v, d in priors.items() if abs(d.get("mean_effect", 0)) < 0.05]
        
        # Identify strongest effects
        sorted_by_effect = sorted(priors.items(), key=lambda x: abs(x[1].get("mean_effect", 0)), reverse=True)
        strongest = [{"variable": v, "effect": d.get("mean_effect", 0)} for v, d in sorted_by_effect[:5]]
        
        # Data coverage
        variables_with_expert_data = len([v for v, d in priors.items() if d.get("n_scenarios", 0) > 0])
        total_judgments = sum(d.get("total_judgments", 0) for d in priors.values())
        
        return {
            "total_variables": len(priors),
            "by_confidence": {k: len(v) for k, v in by_confidence.items()},
            "effect_directions": {
                "positive": len(positive_effects),
                "negative": len(negative_effects),
                "neutral": len(neutral_effects),
            },
            "strongest_effects": strongest,
            "data_coverage": {
                "variables_with_expert_data": variables_with_expert_data,
                "variables_literature_only": len(priors) - variables_with_expert_data,
                "total_expert_judgments": total_judgments,
            },
            "confidence_breakdown": by_confidence,
        }
    
    def extract_coefficient_signals(self, scenario_id: str) -> Dict[str, Any]:
        """Extract coefficient signals from a single scenario's responses"""
        # Get all responses for this scenario
        result = self.supabase.table("expert_scenario_responses").select("*").eq("scenario_id", scenario_id).eq("is_complete", True).execute()
        responses = result.data or []
        
        if not responses:
            return {"error": "No complete responses for scenario"}
        
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
                    signals[variable] = {"effects": [], "expert_ids": []}
                
                value_change = counterfactual - actual
                if value_change != 0:
                    implied_effect = quality_change / value_change
                    signals[variable]["effects"].append(implied_effect)
                    signals[variable]["expert_ids"].append(response.get("expert_id"))
        
        # Aggregate
        aggregated = {}
        for variable, data in signals.items():
            effects = data["effects"]
            if effects:
                aggregated[variable] = {
                    "mean_effect": round(statistics.mean(effects), 4),
                    "std_dev": round(statistics.stdev(effects) if len(effects) > 1 else 0.5, 4),
                    "n_judgments": len(effects),
                    "n_experts": len(set(data["expert_ids"])),
                    "min_effect": round(min(effects), 4),
                    "max_effect": round(max(effects), 4),
                }
        
        return {
            "scenario_id": scenario_id,
            "coefficient_signals": aggregated,
            "n_responses_analyzed": len(responses),
        }

