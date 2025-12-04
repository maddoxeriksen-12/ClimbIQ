"""
Expert Capture Assets for Dagster Pipeline

These assets handle the extraction and aggregation of coefficient signals
from expert scenario reviews to derive Bayesian priors for the recommendation engine.
"""

from dagster import asset, AssetExecutionContext, MetadataValue, Output
import pandas as pd
import numpy as np
from typing import Dict, List, Any, Optional
from datetime import datetime

from ..resources import SupabaseResource, LiteraturePriorsResource


@asset(
    group_name="expert_capture",
    description="Extract coefficient signals from completed scenario reviews",
    compute_kind="python",
)
def extracted_coefficient_signals(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[pd.DataFrame]:
    """
    Process unprocessed consensus records and extract coefficient signals.
    
    This asset:
    1. Fetches all scenario_consensus records where processed_into_priors = False
    2. Extracts coefficient signals from counterfactual judgments
    3. Returns a DataFrame with variable, effect, confidence, n_experts, scenario_id
    """
    client = supabase.client
    
    # Fetch unprocessed consensus records
    result = client.table('scenario_consensus') \
        .select('*') \
        .eq('processed_into_priors', False) \
        .execute()
    
    consensus_records = result.data or []
    context.log.info(f"Found {len(consensus_records)} unprocessed consensus records")
    
    if not consensus_records:
        return Output(
            pd.DataFrame(columns=['variable', 'effect', 'confidence', 'n_experts', 'scenario_id', 'std_dev']),
            metadata={
                "num_records_processed": 0,
                "num_signals_extracted": 0,
            }
        )
    
    # Extract coefficient signals from each consensus
    all_signals = []
    
    for consensus in consensus_records:
        scenario_id = consensus['scenario_id']
        coefficient_signals = consensus.get('coefficient_signals', {}) or {}
        n_experts = consensus.get('n_experts', 1)
        
        for variable, signal_data in coefficient_signals.items():
            if isinstance(signal_data, dict):
                all_signals.append({
                    'variable': variable,
                    'effect': signal_data.get('implied_effect', 0.0),
                    'confidence': signal_data.get('confidence', 'medium'),
                    'n_experts': signal_data.get('n_experts', n_experts),
                    'std_dev': signal_data.get('std_dev', 0.1),
                    'scenario_id': scenario_id,
                    'consensus_id': consensus['id'],
                })
    
    df = pd.DataFrame(all_signals)
    
    context.log.info(f"Extracted {len(df)} coefficient signals from {len(consensus_records)} consensus records")
    
    return Output(
        df,
        metadata={
            "num_records_processed": len(consensus_records),
            "num_signals_extracted": len(df),
            "unique_variables": MetadataValue.int(df['variable'].nunique()) if len(df) > 0 else 0,
            "preview": MetadataValue.md(df.head(10).to_markdown()) if len(df) > 0 else "No signals",
        }
    )


@asset(
    group_name="expert_capture",
    description="Aggregate expert signals into prior estimates using inverse-variance weighted meta-analysis",
    compute_kind="python",
)
def expert_derived_priors(
    context: AssetExecutionContext,
    extracted_coefficient_signals: pd.DataFrame,
) -> Output[Dict[str, Dict[str, Any]]]:
    """
    Aggregate coefficient signals using inverse-variance weighted meta-analysis.
    
    For each variable:
    1. Weight each effect estimate by inverse of its variance (1/std_dev^2)
    2. Compute weighted mean as the pooled effect estimate
    3. Compute pooled standard error
    4. Track confidence and number of contributing scenarios
    """
    if extracted_coefficient_signals.empty:
        context.log.info("No coefficient signals to aggregate")
        return Output(
            {},
            metadata={"num_variables": 0, "total_judgments": 0}
        )
    
    # Map confidence to numeric weights
    confidence_weights = {'high': 1.0, 'medium': 0.7, 'low': 0.4}
    
    # Add numeric confidence weight
    df = extracted_coefficient_signals.copy()
    df['conf_weight'] = df['confidence'].map(lambda x: confidence_weights.get(x, 0.5))
    
    # Ensure std_dev is not zero
    df['std_dev'] = df['std_dev'].clip(lower=0.01)
    
    # Calculate inverse variance weights
    df['inv_var'] = 1.0 / (df['std_dev'] ** 2)
    df['weighted_inv_var'] = df['inv_var'] * df['conf_weight']
    
    # Aggregate by variable
    priors = {}
    
    for variable, group in df.groupby('variable'):
        n_scenarios = group['scenario_id'].nunique()
        total_judgments = len(group)
        
        # Inverse-variance weighted mean
        weights = group['weighted_inv_var'].values
        effects = group['effect'].values
        
        if weights.sum() > 0:
            pooled_mean = np.average(effects, weights=weights)
            
            # Pooled standard error (random effects model approximation)
            pooled_var = 1.0 / weights.sum()
            pooled_std = np.sqrt(pooled_var)
            
            # Determine overall confidence
            high_conf_pct = (group['confidence'] == 'high').mean()
            if high_conf_pct > 0.6:
                overall_confidence = 'high'
            elif high_conf_pct > 0.3:
                overall_confidence = 'medium'
            else:
                overall_confidence = 'low'
            
            priors[variable] = {
                'mean': float(pooled_mean),
                'std': float(pooled_std),
                'n_scenarios': int(n_scenarios),
                'total_judgments': int(total_judgments),
                'confidence': overall_confidence,
                'source': 'expert',
                'last_updated': datetime.utcnow().isoformat(),
            }
    
    context.log.info(f"Aggregated priors for {len(priors)} variables")
    
    # Create summary for metadata
    summary_df = pd.DataFrame([
        {'variable': k, 'mean': v['mean'], 'std': v['std'], 'n_scenarios': v['n_scenarios']}
        for k, v in priors.items()
    ])
    
    return Output(
        priors,
        metadata={
            "num_variables": len(priors),
            "total_scenarios": int(df['scenario_id'].nunique()),
            "total_judgments": int(len(df)),
            "variables_summary": MetadataValue.md(
                summary_df.to_markdown() if len(summary_df) > 0 else "No priors"
            ),
        }
    )


@asset(
    group_name="expert_capture",
    description="Blend expert priors with literature priors using inverse-variance weighting",
    compute_kind="python",
)
def blended_population_priors(
    context: AssetExecutionContext,
    expert_derived_priors: Dict[str, Dict[str, Any]],
    literature_priors: LiteraturePriorsResource,
) -> Output[Dict[str, Dict[str, Any]]]:
    """
    Combine expert and literature priors using inverse-variance weighting.
    
    For variables with both expert and literature estimates:
    - Blend using inverse-variance weighting
    - Expert priors get additional weight if based on many scenarios
    
    For variables with only one source:
    - Use available estimate with increased uncertainty
    """
    lit_priors = literature_priors.get_all_priors()
    
    all_variables = set(expert_derived_priors.keys()) | set(lit_priors.keys())
    blended = {}
    
    for variable in all_variables:
        expert = expert_derived_priors.get(variable)
        lit = lit_priors.get(variable)
        
        if expert and lit:
            # Both sources available - blend them
            expert_var = expert['std'] ** 2
            lit_var = lit['std'] ** 2
            
            # Boost expert weight if based on many scenarios
            n_scenarios = expert.get('n_scenarios', 1)
            expert_boost = min(1 + 0.1 * n_scenarios, 2.0)  # Max 2x boost
            
            expert_weight = (1 / expert_var) * expert_boost
            lit_weight = 1 / lit_var
            total_weight = expert_weight + lit_weight
            
            blended_mean = (expert['mean'] * expert_weight + lit['mean'] * lit_weight) / total_weight
            blended_var = 1 / total_weight
            blended_std = np.sqrt(blended_var)
            
            blended[variable] = {
                'mean': float(blended_mean),
                'std': float(blended_std),
                'source': 'blended',
                'expert_weight': float(expert_weight / total_weight),
                'literature_weight': float(lit_weight / total_weight),
                'expert_mean': expert['mean'],
                'literature_mean': lit['mean'],
                'n_scenarios': expert.get('n_scenarios', 0),
                'confidence': expert.get('confidence', 'medium'),
                'last_updated': datetime.utcnow().isoformat(),
            }
            
        elif expert:
            # Only expert data - use with increased uncertainty
            blended[variable] = {
                'mean': expert['mean'],
                'std': expert['std'] * 1.2,  # Increase uncertainty slightly
                'source': 'expert_only',
                'n_scenarios': expert.get('n_scenarios', 0),
                'confidence': expert.get('confidence', 'low'),
                'last_updated': datetime.utcnow().isoformat(),
            }
            
        else:
            # Only literature data - use with increased uncertainty
            blended[variable] = {
                'mean': lit['mean'],
                'std': lit['std'] * 1.3,  # Increase uncertainty more
                'source': 'literature_only',
                'confidence': 'low',
                'last_updated': datetime.utcnow().isoformat(),
            }
    
    context.log.info(f"Blended priors for {len(blended)} variables")
    
    # Categorize sources for metadata
    source_counts = {}
    for v in blended.values():
        src = v.get('source', 'unknown')
        source_counts[src] = source_counts.get(src, 0) + 1
    
    return Output(
        blended,
        metadata={
            "num_variables": len(blended),
            "source_breakdown": MetadataValue.json(source_counts),
            "expert_only_count": source_counts.get('expert_only', 0),
            "literature_only_count": source_counts.get('literature_only', 0),
            "blended_count": source_counts.get('blended', 0),
        }
    )


@asset(
    group_name="expert_capture",
    description="Write blended priors to population_priors table and mark consensus records as processed",
    compute_kind="database",
)
def updated_population_priors_table(
    context: AssetExecutionContext,
    blended_population_priors: Dict[str, Dict[str, Any]],
    extracted_coefficient_signals: pd.DataFrame,
    supabase: SupabaseResource,
) -> Output[Dict[str, Any]]:
    """
    Write blended priors to the population_priors table and mark
    consensus records as processed.
    """
    client = supabase.client
    
    if not blended_population_priors:
        context.log.info("No priors to write")
        return Output(
            {"priors_written": 0, "consensus_marked": 0},
            metadata={"priors_written": 0, "consensus_marked": 0}
        )
    
    # Prepare records for upsert
    prior_records = []
    for variable, prior_data in blended_population_priors.items():
        prior_records.append({
            'variable_name': variable,
            'population_mean': prior_data['mean'],
            'population_std': prior_data['std'],
            'source': prior_data.get('source', 'blended'),
            'confidence': prior_data.get('confidence', 'medium'),
            'n_scenarios': prior_data.get('n_scenarios', 0),
            'metadata': {
                'expert_weight': prior_data.get('expert_weight'),
                'literature_weight': prior_data.get('literature_weight'),
                'expert_mean': prior_data.get('expert_mean'),
                'literature_mean': prior_data.get('literature_mean'),
            },
            'updated_at': datetime.utcnow().isoformat(),
        })
    
    # Upsert to population_priors table
    priors_written = 0
    for record in prior_records:
        try:
            client.table('population_priors').upsert(
                record,
                on_conflict='variable_name'
            ).execute()
            priors_written += 1
        except Exception as e:
            context.log.warning(f"Failed to upsert prior for {record['variable_name']}: {e}")
    
    context.log.info(f"Wrote {priors_written} priors to population_priors table")
    
    # Mark consensus records as processed
    consensus_marked = 0
    if not extracted_coefficient_signals.empty and 'consensus_id' in extracted_coefficient_signals.columns:
        consensus_ids = extracted_coefficient_signals['consensus_id'].unique().tolist()
        
        for consensus_id in consensus_ids:
            try:
                client.table('scenario_consensus').update({
                    'processed_into_priors': True,
                    'processed_at': datetime.utcnow().isoformat(),
                }).eq('id', consensus_id).execute()
                consensus_marked += 1
            except Exception as e:
                context.log.warning(f"Failed to mark consensus {consensus_id} as processed: {e}")
    
    context.log.info(f"Marked {consensus_marked} consensus records as processed")
    
    return Output(
        {
            "priors_written": priors_written,
            "consensus_marked": consensus_marked,
            "timestamp": datetime.utcnow().isoformat(),
        },
        metadata={
            "priors_written": priors_written,
            "consensus_marked": consensus_marked,
            "variables": MetadataValue.json(list(blended_population_priors.keys())),
        }
    )

