from typing import Any, Dict, List, Optional, Sequence, Set
import os
import httpx

from app.core.supabase import get_supabase_client


class RAGService:
    """
    Lightweight retrieval layer for recommendation/explanation/expert-capture flows.

    This is intentionally "standard RAG" without a vector database:
    we retrieve structured knowledge from Supabase tables and let
    downstream LLMs condition on that context.
    """

    def __init__(self, supabase=None):
        self.supabase = supabase or get_supabase_client()

        # Embedding service configuration (shared with Dagster asset)
        # Example: http://embedding-service:8000
        self._embedding_base_url = os.getenv("EMBEDDING_API_BASE", "").rstrip("/")
        self._embedding_path = os.getenv("EMBEDDING_API_PATH", "/v1/embeddings")
        self._embedding_model = os.getenv("RAG_EMBEDDING_MODEL", "mxbai-embed-large")

    # ------------------------------------------------------------------
    # Public entrypoints
    # ------------------------------------------------------------------
    def get_explanation_context(
        self,
        recommendation_type: str,
        key_variables: Sequence[str],
    ) -> str:
        """
        Build a textual context block for the explanation LLM.

        Sources:
          - population_priors for key variables
          - expert_rules whose condition_fields overlap those variables
          - recommendation_explanations templates for this recommendation_type
        """
        key_vars: List[str] = list({v for v in key_variables if v})
        sections: List[str] = []

        if key_vars:
            priors = self._get_priors_for_variables(key_vars)
            if priors:
                sections.append(self._format_priors(priors))

            rules = self._get_rules_for_variables(key_vars)
            if rules:
                sections.append(self._format_rules(rules))

        templates = self._get_templates_for_type(recommendation_type)
        if templates:
            sections.append(self._format_templates(templates))

        return "\n\n".join(sections).strip()

    def get_expert_capture_context(
        self,
        variables_of_interest: Sequence[str],
        difficulty_level: Optional[str] = None,
    ) -> str:
        """
        Build context for expert-capture scenario generation / review.

        Sources:
          - similar synthetic_scenarios (matching difficulty + overlapping variables)
          - expert_rules touching those variables
          - population_priors for those variables
        """
        vars_set: List[str] = list({v for v in variables_of_interest if v})
        sections: List[str] = []

        scenarios = self._get_similar_scenarios(vars_set, difficulty_level)
        if scenarios:
            sections.append(self._format_scenarios(scenarios))

        if vars_set:
            rules = self._get_rules_for_variables(vars_set)
            if rules:
                sections.append(self._format_rules(rules))

            priors = self._get_priors_for_variables(vars_set)
            if priors:
                sections.append(self._format_priors(priors))

        return "\n\n".join(sections).strip()

    # ------------------------------------------------------------------
    # Supabase helpers
    # ------------------------------------------------------------------
    def _get_priors_for_variables(self, variables: Sequence[str]) -> List[Dict[str, Any]]:
        if not variables:
            return []
        try:
            result = (
                self.supabase.table("population_priors")
                .select(
                    "variable_name, population_mean, population_std, variable_category, "
                    "description, source, confidence, n_scenarios, total_judgments"
                )
                .in_("variable_name", list(variables))
                .limit(20)
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Vector / semantic search (via Supabase RPC)
    # ------------------------------------------------------------------
    def _embed_text(self, text: str) -> Optional[List[float]]:
        """
        Compute an embedding for the given text using the local embedding-service.

        Returns None if the embedding service is not configured or fails.
        """
        if not self._embedding_base_url:
            # Embedding service not configured for this backend instance
            return None

        text = (text or "").strip()
        if not text:
            return None

        url = f"{self._embedding_base_url}{self._embedding_path}"
        try:
            resp = httpx.post(
                url,
                json={"input": text, "model": self._embedding_model},
                timeout=10.0,
            )
            resp.raise_for_status()
            data = resp.json()
            vec = data["data"][0]["embedding"]
            # We intentionally don't enforce dimensionality here; the pgvector
            # table and migration handle that constraint.
            return list(vec)
        except Exception:
            return None

    def semantic_search(
        self,
        query_embedding: Sequence[float],
        object_types: Optional[Sequence[str]] = None,
        limit: int = 20,
    ) -> List[Dict[str, Any]]:
        """
        Thin wrapper around the rag_search_knowledge RPC defined in
        supabase/migrations/20251209210000_rag_embeddings.sql.

        NOTE: RAGService does not compute embeddings itself; callers are
        responsible for generating a 1536-dimensional embedding that matches
        the pgvector schema.
        """
        try:
            payload: Dict[str, Any] = {
                "query_embedding": list(query_embedding),
                "match_limit": limit,
            }
            if object_types:
                payload["match_types"] = list(object_types)

            result = self.supabase.rpc("rag_search_knowledge", payload).execute()
            return result.data or []
        except Exception:
            return []

    async def get_vector_context(
        self,
        query_text: str,
        object_types: Optional[Sequence[str]] = None,
        limit: int = 8,
    ) -> str:
        """
        High-level helper for "standard RAG":
          1. Embed the query with mxbai-embed-large via embedding-service
          2. Retrieve similar knowledge rows via Supabase RPC
          3. Re-rank with cross-encoder (bge-reranker) if configured
          4. Format top-k results into a text block for LLM conditioning
        """
        # Step 1: Embed
        embedding = self._embed_text(query_text)
        if not embedding:
            return ""

        # Step 2: Vector search
        candidates = self.semantic_search(
            query_embedding=embedding,
            object_types=object_types,
            limit=limit,
        )
        if not candidates:
            return ""

        # Step 3: Optional re-ranking
        ranked = await self.rerank(query_text, candidates)
        if not ranked:
            return ""

        top = ranked[:limit]

        # Step 4: Format for prompt
        lines: List[str] = ["[RAG Knowledge]"]
        for c in top:
            obj_type = c.get("object_type", "unknown")
            obj_id = c.get("object_id", "")
            sim = c.get("similarity", 0.0)
            content = c.get("content", "")
            lines.append(
                f"- ({obj_type} {obj_id}, similarity={sim:.3f}) {content}"
            )

        return "\n".join(lines)

    # ------------------------------------------------------------------
    # Cross-encoder re-ranking
    # ------------------------------------------------------------------
    async def rerank(
        self,
        query_text: str,
        candidates: List[Dict[str, Any]],
        text_key: str = "content",
    ) -> List[Dict[str, Any]]:
        """
        Re-rank candidates using an external cross-encoder service.

        The service should expose POST /rerank with JSON:
        { "query": "...", "documents": ["doc1", "doc2", ...] }
        and return: { "scores": [float, ...] }

        Configured via env:
          - RERANKER_URL (e.g. https://<railway-app>.up.railway.app/rerank)
        """
        if not candidates:
            return []

        reranker_url = os.getenv("RERANKER_URL")
        if not reranker_url:
            # Reranking not configured; return as-is.
            return candidates

        docs = [str(c.get(text_key, "")) for c in candidates]
        payload = {"query": query_text, "documents": docs}

        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                resp = await client.post(reranker_url, json=payload)
                resp.raise_for_status()
                data = resp.json()
                scores = data.get("scores") or []
                if len(scores) != len(candidates):
                    return candidates
        except Exception as e:
            print(f"[RAGService] rerank failed: {e}")
            return candidates

        for c, s in zip(candidates, scores):
            c["_rerank_score"] = float(s)

        return sorted(candidates, key=lambda x: x.get("_rerank_score", 0.0), reverse=True)

    def _get_rules_for_variables(self, variables: Sequence[str]) -> List[Dict[str, Any]]:
        if not variables:
            return []
        try:
            # condition_fields is an array of variable names the rule touches
            result = (
                self.supabase.table("expert_rules")
                .select(
                    "name, description, rule_category, priority, confidence, "
                    "condition_fields"
                )
                .eq("is_active", True)
                .contains("condition_fields", list(variables))  # overlap
                .order("priority", desc=True)
                .limit(20)
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    def _get_templates_for_type(self, recommendation_type: str) -> List[Dict[str, Any]]:
        try:
            result = (
                self.supabase.table("recommendation_explanations")
                .select(
                    "recommendation_type, target_element, short_explanation, "
                    "mechanism, literature_reference, confidence, priority"
                )
                .eq("is_active", True)
                .eq("recommendation_type", recommendation_type)
                .order("priority", desc=True)
                .limit(10)
                .execute()
            )
            return result.data or []
        except Exception:
            return []

    def _get_similar_scenarios(
        self,
        variables: Sequence[str],
        difficulty_level: Optional[str],
    ) -> List[Dict[str, Any]]:
        """
        Approximate "similar scenarios" by:
          - matching difficulty_level if provided
          - requiring overlap in edge_case_tags
        """
        try:
            query = (
                self.supabase.table("synthetic_scenarios")
                .select(
                    "id, scenario_description, edge_case_tags, "
                    "difficulty_level, generated_at"
                )
                .order("generated_at", desc=True)
                .limit(25)
            )
            if difficulty_level:
                query = query.eq("difficulty_level", difficulty_level)
            result = query.execute()
            scenarios = result.data or []

            if not variables:
                return scenarios

            # Filter client-side by tag overlap with variable names
            var_set: Set[str] = {v for v in variables if v}
            scored: List[Dict[str, Any]] = []
            for s in scenarios:
                tags = set(s.get("edge_case_tags") or [])
                overlap = len(tags & var_set)
                s["_overlap_score"] = overlap
                scored.append(s)

            scored.sort(key=lambda x: x.get("_overlap_score", 0), reverse=True)
            return [s for s in scored if s.get("_overlap_score", 0) > 0][:10] or scored[:5]
        except Exception:
            return []

    # ------------------------------------------------------------------
    # Formatting helpers
    # ------------------------------------------------------------------
    def _format_priors(self, priors: List[Dict[str, Any]]) -> str:
        lines = ["[Population Priors]"]
        for p in priors:
            lines.append(
                f"- {p.get('variable_name')}: mean={p.get('population_mean')}, "
                f"std={p.get('population_std')}, "
                f"category={p.get('variable_category')}, "
                f"source={p.get('source')}, confidence={p.get('confidence')}. "
                f"Desc: {p.get('description')}"
            )
        return "\n".join(lines)

    def _format_rules(self, rules: List[Dict[str, Any]]) -> str:
        lines = ["[Expert Rules]"]
        for r in rules:
            vars_str = ", ".join(r.get("condition_fields") or [])
            lines.append(
                f"- {r.get('name')}: category={r.get('rule_category')}, "
                f"priority={r.get('priority')}, confidence={r.get('confidence')}, "
                f"variables=[{vars_str}]. Desc: {r.get('description')}"
            )
        return "\n".join(lines)

    def _format_templates(self, templates: List[Dict[str, Any]]) -> str:
        lines = ["[Explanation Templates]"]
        for t in templates:
            lines.append(
                f"- type={t.get('recommendation_type')}, target={t.get('target_element')}, "
                f"confidence={t.get('confidence')}, "
                f"short='{t.get('short_explanation')}'. "
                f"Mechanism: {t.get('mechanism') or 'n/a'}. "
                f"Literature: {t.get('literature_reference') or 'n/a'}"
            )
        return "\n".join(lines)

    def _format_scenarios(self, scenarios: List[Dict[str, Any]]) -> str:
        lines = ["[Similar Expert Scenarios]"]
        for s in scenarios:
            tags = ", ".join(s.get("edge_case_tags") or [])
            lines.append(
                f"- id={s.get('id')} diff={s.get('difficulty_level')}, "
                f"tags=[{tags}]. Desc: {s.get('scenario_description')}"
            )
        return "\n".join(lines)


_rag_service: Optional[RAGService] = None


def get_rag_service() -> RAGService:
    global _rag_service
    if _rag_service is None:
        _rag_service = RAGService()
    return _rag_service


