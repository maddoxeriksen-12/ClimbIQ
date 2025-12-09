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
import os
import httpx

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
    description="Backfill semantic RAG embeddings from priors, rules, templates, and scenarios into rag_knowledge_embeddings",
    compute_kind="python",
)
def rag_knowledge_embeddings_backfill(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[int]:
    """
    Build text descriptions for key expert-knowledge objects and store embeddings
    in the rag_knowledge_embeddings table for semantic search.

    NOTE:
      - This asset assumes an embedding model like OpenAI's text-embedding-3-large.
      - You must configure OPENAI_API_KEY (and optionally RAG_EMBEDDING_MODEL).
      - It can be run periodically (e.g. nightly) to refresh embeddings.
    """
    client = supabase.client

    api_key = os.getenv("OPENAI_API_KEY")
    # Default to the recommended high-quality model; you can override via env.
    # NOTE: Ensure its output dimensionality matches the VECTOR dimension
    # configured in the rag_knowledge_embeddings migration.
    model = os.getenv("RAG_EMBEDDING_MODEL", "mxbai-embed-large")

    if not api_key:
        raise RuntimeError(
            "OPENAI_API_KEY must be set to run rag_knowledge_embeddings_backfill. "
            "Set it in the Dagster environment or resource configuration."
        )

    def embed(text: str) -> list[float]:
        """Call the embedding API and return a 1536-dim vector."""
        # Truncate overly long inputs for safety
        text = text.strip()
        if not text:
            text = "empty"

        resp = httpx.post(
            "https://api.openai.com/v1/embeddings",
            headers={"Authorization": f"Bearer {api_key}"},
            json={"input": text, "model": model},
            timeout=30.0,
        )
        resp.raise_for_status()
        data = resp.json()
        vec = data["data"][0]["embedding"]
        if len(vec) != 1536:
            # The migration assumes 1536 dimensions; if the model changes,
            # adjust the VECTOR dimension in the migration accordingly.
            raise ValueError(f"Expected 1536-dim embedding, got {len(vec)}")
        return vec

    def replace_embedding(object_type: str, object_table: str, object_id: str, content: str) -> None:
        """Delete any existing embedding for this object and insert a new one."""
        # Best-effort delete; ignore errors
        try:
            client.table("rag_knowledge_embeddings") \
                .delete() \
                .eq("object_type", object_type) \
                .eq("object_table", object_table) \
                .eq("object_id", object_id) \
                .execute()
        except Exception:
            pass

        vec = embed(content)
        client.table("rag_knowledge_embeddings").insert({
            "object_type": object_type,
            "object_table": object_table,
            "object_id": object_id,
            "content": content,
            "embedding": vec,
        }).execute()

    total = 0

    # -------- Priors --------
    try:
        priors_res = client.table("population_priors").select("*").execute()
        for row in priors_res.data or []:
            vid = row.get("variable_name") or row.get("id")
            if not vid:
                continue
            desc = row.get("description") or ""
            content = (
                f"Population prior for {row.get('variable_name')}: "
                f"mean={row.get('population_mean')}, std={row.get('population_std')}, "
                f"category={row.get('variable_category')}, source={row.get('source')}, "
                f"confidence={row.get('confidence')}. {desc}"
            )
            replace_embedding("prior", "population_priors", str(vid), content)
            total += 1
    except Exception as e:
        context.log.warning(f"Failed to backfill priors embeddings: {e}")

    # -------- Rules --------
    try:
        rules_res = client.table("expert_rules").select(
            "id, name, description, rule_category, priority, confidence, condition_fields"
        ).eq("is_active", True).execute()
        for row in rules_res.data or []:
            rid = row.get("id")
            if not rid:
                continue
            vars_str = ", ".join(row.get("condition_fields") or [])
            content = (
                f"Expert rule {row.get('name')}: category={row.get('rule_category')}, "
                f"priority={row.get('priority')}, confidence={row.get('confidence')}, "
                f"variables=[{vars_str}]. Description: {row.get('description') or ''}"
            )
            replace_embedding("rule", "expert_rules", str(rid), content)
            total += 1
    except Exception as e:
        context.log.warning(f"Failed to backfill rules embeddings: {e}")

    # -------- Explanation templates --------
    try:
        tmpl_res = client.table("recommendation_explanations").select(
            "id, recommendation_type, target_element, short_explanation, "
            "mechanism, literature_reference, confidence"
        ).eq("is_active", True).execute()
        for row in tmpl_res.data or []:
            tid = row.get("id")
            if not tid:
                continue
            content = (
                f"Explanation template for {row.get('recommendation_type')} "
                f"target={row.get('target_element')}: "
                f"short='{row.get('short_explanation') or ''}'. "
                f"Mechanism: {row.get('mechanism') or 'n/a'}. "
                f"Literature: {row.get('literature_reference') or 'n/a'}. "
                f"Confidence: {row.get('confidence') or 'medium'}."
            )
            replace_embedding("template", "recommendation_explanations", str(tid), content)
            total += 1
    except Exception as e:
        context.log.warning(f"Failed to backfill explanation template embeddings: {e}")

    # -------- Scenarios --------
    try:
        scen_res = client.table("synthetic_scenarios").select(
            "id, scenario_description, edge_case_tags, difficulty_level, "
            "baseline_snapshot, pre_session_snapshot"
        ).execute()
        for row in scen_res.data or []:
            sid = row.get("id")
            if not sid:
                continue
            baseline = row.get("baseline_snapshot") or {}
            pre = row.get("pre_session_snapshot") or {}
            tags = ", ".join(row.get("edge_case_tags") or [])

            # Lightweight textual summary
            content = (
                f"Synthetic scenario {sid}: diff={row.get('difficulty_level')}, tags=[{tags}]. "
                f"Description: {row.get('scenario_description') or ''}. "
                f"Baseline: {baseline}. Pre-session: {pre}."
            )
            replace_embedding("scenario", "synthetic_scenarios", str(sid), content)
            total += 1
    except Exception as e:
        context.log.warning(f"Failed to backfill scenario embeddings: {e}")

    context.log.info(f"Backfilled embeddings for {total} knowledge objects into rag_knowledge_embeddings.")

    return Output(
        total,
        metadata={
            "total_embeddings_written": total,
            "embedding_model": model,
        },
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


@asset(
    group_name="expert_capture",
    description="Extract explanation patterns from expert reasoning for 'Why?' feature",
    compute_kind="python",
)
def extracted_explanation_patterns(
    context: AssetExecutionContext,
    supabase: SupabaseResource,
) -> Output[pd.DataFrame]:
    """
    Extract explanation patterns from expert scenario reviews.

    This asset analyzes expert reasoning from scenario reviews to identify:
    1. Common condition patterns (e.g., "when sleep_quality <= 4")
    2. Explanation templates used by experts
    3. Mechanisms referenced in expert reasoning

    These patterns are used to populate the recommendation_explanations table
    for the hybrid "Why?" feature.
    """
    client = supabase.client

    # Fetch expert reviews with reasoning
    result = client.table('expert_reviews') \
        .select('*, expert_scenarios(pre_session_snapshot, scenario_description)') \
        .not_.is_('reasoning', 'null') \
        .order('created_at', desc=True) \
        .limit(500) \
        .execute()

    reviews = result.data or []
    context.log.info(f"Found {len(reviews)} expert reviews with reasoning")

    if not reviews:
        return Output(
            pd.DataFrame(columns=[
                'recommendation_type', 'target_element', 'condition_pattern',
                'explanation_template', 'factors_explained', 'source_scenario_id',
                'confidence', 'expert_id'
            ]),
            metadata={"num_patterns_extracted": 0}
        )

    # Extract patterns from expert reasoning
    patterns = []

    # Recommendation type keywords for classification
    type_keywords = {
        'warmup': ['warmup', 'warm-up', 'warm up', 'activation', 'mobility'],
        'session_structure': ['session', 'duration', 'structure', 'rest', 'intervals'],
        'intensity': ['intensity', 'load', 'difficulty', 'effort', 'grade'],
        'avoid': ['avoid', 'skip', 'dont', "don't", 'careful', 'risk'],
        'include': ['include', 'focus', 'prioritize', 'emphasize', 'add'],
        'rest': ['rest', 'recovery', 'break', 'pause'],
    }

    for review in reviews:
        reasoning = review.get('reasoning', '')
        if not reasoning or len(reasoning) < 20:
            continue

        scenario = review.get('expert_scenarios', {}) or {}
        pre_session = scenario.get('pre_session_snapshot', {}) or {}

        # Determine recommendation type from reasoning text
        rec_type = 'general'
        for rtype, keywords in type_keywords.items():
            if any(kw.lower() in reasoning.lower() for kw in keywords):
                rec_type = rtype
                break

        # Extract factors mentioned in reasoning
        factors_explained = []
        factor_keywords = [
            'sleep', 'stress', 'energy', 'motivation', 'soreness', 'fatigue',
            'finger', 'injury', 'hydration', 'recovery', 'rest', 'caffeine'
        ]
        for factor in factor_keywords:
            if factor.lower() in reasoning.lower():
                # Map to actual variable names
                factor_map = {
                    'sleep': 'sleep_quality',
                    'stress': 'stress_level',
                    'energy': 'energy_level',
                    'motivation': 'motivation',
                    'soreness': 'muscle_soreness',
                    'fatigue': 'energy_level',
                    'finger': 'finger_tendon_health',
                    'injury': 'injury_severity',
                    'hydration': 'hydration_status',
                    'recovery': 'days_since_rest_day',
                    'rest': 'days_since_rest_day',
                    'caffeine': 'caffeine_today',
                }
                if factor in factor_map:
                    factors_explained.append(factor_map[factor])

        # Build condition pattern from pre_session data + factors mentioned
        conditions = []
        for factor in set(factors_explained):
            if factor in pre_session:
                value = pre_session[factor]
                if isinstance(value, (int, float)):
                    # Determine operator based on whether this is a "bad" value
                    # Low values are typically bad for: sleep_quality, energy_level, motivation, hydration_status
                    # High values are typically bad for: stress_level, muscle_soreness, injury_severity
                    bad_high = ['stress_level', 'muscle_soreness', 'injury_severity']
                    if factor in bad_high:
                        op = '>=' if value >= 6 else '<='
                    else:
                        op = '<=' if value <= 5 else '>='
                    conditions.append({
                        'variable': factor,
                        'op': op,
                        'value': value
                    })

        condition_pattern = {'ALL': conditions} if len(conditions) > 1 else (conditions[0] if conditions else {})

        patterns.append({
            'recommendation_type': rec_type,
            'target_element': review.get('recommended_session_type'),
            'condition_pattern': condition_pattern,
            'explanation_template': reasoning[:500],  # Truncate if too long
            'factors_explained': list(set(factors_explained)),
            'source_scenario_id': review.get('scenario_id'),
            'expert_id': review.get('expert_id'),
            'confidence': 'medium',  # Expert-derived patterns get medium confidence
        })

    df = pd.DataFrame(patterns)

    context.log.info(f"Extracted {len(df)} explanation patterns from expert reviews")

    return Output(
        df,
        metadata={
            "num_patterns_extracted": len(df),
            "recommendation_types": MetadataValue.json(
                df['recommendation_type'].value_counts().to_dict() if len(df) > 0 else {}
            ),
            "unique_factors": MetadataValue.int(
                len(set([f for factors in df['factors_explained'].tolist() for f in factors])) if len(df) > 0 else 0
            ),
            "preview": MetadataValue.md(df.head(5).to_markdown()) if len(df) > 0 else "No patterns",
        }
    )


@asset(
    group_name="expert_capture",
    description="Write extracted explanation patterns to recommendation_explanations table",
    compute_kind="database",
)
def updated_explanation_templates(
    context: AssetExecutionContext,
    extracted_explanation_patterns: pd.DataFrame,
    supabase: SupabaseResource,
) -> Output[Dict[str, Any]]:
    """
    Write extracted explanation patterns to the recommendation_explanations table.

    This creates new explanation templates derived from expert reasoning,
    complementing the literature-based seed templates.
    """
    client = supabase.client

    if extracted_explanation_patterns.empty:
        context.log.info("No explanation patterns to write")
        return Output(
            {"templates_written": 0},
            metadata={"templates_written": 0}
        )

    templates_written = 0
    templates_skipped = 0

    for _, row in extracted_explanation_patterns.iterrows():
        # Skip if no meaningful condition pattern
        if not row['condition_pattern'] or (
            isinstance(row['condition_pattern'], dict) and
            row['condition_pattern'].get('ALL', []) == []
        ):
            templates_skipped += 1
            continue

        # Check for duplicates (same type + similar condition)
        try:
            existing = client.table('recommendation_explanations') \
                .select('id') \
                .eq('recommendation_type', row['recommendation_type']) \
                .eq('source_type', 'expert') \
                .execute()

            # If we already have many expert templates for this type, skip
            if len(existing.data or []) >= 10:
                templates_skipped += 1
                continue
        except Exception:
            pass

        # Insert new template
        try:
            record = {
                'recommendation_type': row['recommendation_type'],
                'target_element': row['target_element'],
                'condition_pattern': row['condition_pattern'],
                'explanation_template': row['explanation_template'],
                'factors_explained': row['factors_explained'],
                'source_type': 'expert',
                'expert_scenario_ids': [row['source_scenario_id']] if row['source_scenario_id'] else [],
                'confidence': row['confidence'],
                'priority': 60,  # Expert templates get priority 60 (between literature and AI)
                'is_active': True,
            }

            client.table('recommendation_explanations').insert(record).execute()
            templates_written += 1

        except Exception as e:
            context.log.warning(f"Failed to insert explanation template: {e}")

    context.log.info(f"Wrote {templates_written} explanation templates, skipped {templates_skipped}")

    return Output(
        {
            "templates_written": templates_written,
            "templates_skipped": templates_skipped,
            "timestamp": datetime.utcnow().isoformat(),
        },
        metadata={
            "templates_written": templates_written,
            "templates_skipped": templates_skipped,
        }
    )


