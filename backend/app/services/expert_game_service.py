from __future__ import annotations

import math
import random
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, Optional, Tuple

from supabase import Client

from app.services.action_id import compute_action_id
from app.services.dose_features import compute_executed_dose_features, compute_planned_dose_features
from app.services.supabase_guard import SupabaseWriteGuard
from app.services.workout_schemas import validate_executed_workout, validate_planned_workout


LATENT_DIMS = [
    "strength_fingers",
    "strength_pull",
    "power",
    "aerobic_capacity",
    "anaerobic_capacity",
    "technique",
    "movement_skill",
    "injury_risk",
    "fatigue_acute",
    "motivation",
    "skin_limit",
]

EVENT_FAMILIES = [
    "SCHEDULE_SHOCK",
    "ACCESS_SHOCK",
    "RECOVERY_SHOCK",
    "MICRO_INJURY_FLAG",
    "OPPORTUNITY",
]


DEFAULT_EVENT_DEFAULTS: Dict[str, Any] = {
    "base_probability_per_session": 0.08,
    "no_new_event_while_active": True,
    "post_event_cooldown_sessions": 3,
    "max_meaningful_events_per_30": 3,
    "severity_distribution": {"low": 0.75, "medium": 0.22, "high": 0.03},
    "duration_sessions_by_severity": {"low": [1, 2], "medium": [2, 4], "high": [3, 6]},
    "budgets": {
        "SCHEDULE_SHOCK": {"max": 1},
        "ACCESS_SHOCK": {"max": 1},
        "RECOVERY_SHOCK": {"max": 2},
        "MICRO_INJURY_FLAG": {"max": 1},
        "OPPORTUNITY": {"max": 1},
        "TOTAL": {"max": 3},
    },
    "family_cooldowns_sessions": {
        "SCHEDULE_SHOCK": 8,
        "ACCESS_SHOCK": 8,
        "RECOVERY_SHOCK": 5,
        "MICRO_INJURY_FLAG": 10,
        "OPPORTUNITY": 6,
    },
    "hazard_modifiers": {
        "fatigue_high": 1.35,
        "sleep_low": 1.25,
        "injury_risk_high": 1.50,
        "stable_streak_good": 0.85,
    },
}


def _clamp(x: float, lo: float, hi: float) -> float:
    return max(lo, min(hi, x))


def _weighted_choice(rng: random.Random, weights: Dict[str, float]) -> str:
    items = list(weights.items())
    total = sum(w for _, w in items)
    if total <= 0:
        return items[0][0]
    r = rng.random() * total
    acc = 0.0
    for k, w in items:
        acc += w
        if r <= acc:
            return k
    return items[-1][0]


def _get_transition_params(client: Client, transition_param_set_id: str) -> Dict[str, Any]:
    """Load a param set into a simple dict {param_key: value}.

    value is float for value_num else dict for value_json.
    """

    rows = (
        client.table("transition_params")
        .select("param_key,value_num,value_json")
        .eq("transition_param_set_id", transition_param_set_id)
        .execute()
    )
    out: Dict[str, Any] = {}
    for r in rows.data or []:
        key = r.get("param_key")
        if not key:
            continue
        if r.get("value_json") is not None:
            out[key] = r.get("value_json")
        else:
            out[key] = r.get("value_num")
    return out


def _event_cooldowns_tick(event_cooldowns: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k, v in (event_cooldowns or {}).items():
        try:
            n = int(v)
        except Exception:
            n = 0
        out[k] = max(0, n - 1)
    return out


def _maybe_end_event(active_event: Optional[Dict[str, Any]], t_index: int) -> Tuple[Optional[Dict[str, Any]], bool]:
    if not active_event:
        return None, False
    end_t = active_event.get("end_t")
    try:
        end_t_int = int(end_t)
    except Exception:
        end_t_int = t_index
    if t_index > end_t_int:
        return None, True
    return active_event, False


def _build_event_deltas(family: str, severity: str, state: Dict[str, Any]) -> Dict[str, Any]:
    readiness = state.get("readiness_state") or {}
    constraints = state.get("constraints_state") or {}

    time_budget = float(constraints.get("time_budget_min", 90))

    if family == "SCHEDULE_SHOCK":
        if severity == "low":
            delta = -15
        elif severity == "medium":
            delta = -25
        else:
            delta = -35
        return {"time_budget_min": max(20, int(time_budget + delta))}

    if family == "ACCESS_SHOCK":
        # Simplified: remove some equipment or reduce gym access.
        if severity in ("medium", "high"):
            return {"gym_access": False, "equipment_available": []}
        return {"equipment_available": constraints.get("equipment_available", [])}

    if family == "RECOVERY_SHOCK":
        # Mild illness/stress spike: reduce sleep_quality proxy and motivation.
        return {
            "sleep_quality": max(0.0, float(readiness.get("sleep_quality", 0.6)) - (0.10 if severity == "low" else 0.18 if severity == "medium" else 0.25)),
            "motivation": max(0.0, float(readiness.get("motivation", 0.6)) - (0.10 if severity == "low" else 0.18 if severity == "medium" else 0.25)),
        }

    if family == "MICRO_INJURY_FLAG":
        # Enforce intensity ceiling + injury flag.
        ceiling = 0.80 if severity == "low" else 0.65 if severity == "medium" else 0.55
        return {"injury_flags": ["micro_injury"], "intensity_ceiling": ceiling}

    if family == "OPPORTUNITY":
        # Opportunity to perform: slight motivation bump.
        return {"motivation": min(1.0, float(readiness.get("motivation", 0.6)) + (0.08 if severity == "low" else 0.12 if severity == "medium" else 0.15))}

    return {}


def maybe_start_event(state_row: Dict[str, Any], *, rng: random.Random, defaults: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    # 0) Hard gates
    active_event = state_row.get("active_event")
    event_cooldowns = state_row.get("event_cooldowns") or {}
    budgets = state_row.get("event_budget_remaining") or {}

    global_cd = int(event_cooldowns.get("GLOBAL", 0) or 0)
    if defaults.get("no_new_event_while_active") and active_event:
        return None
    if global_cd > 0:
        return None
    if float(budgets.get("TOTAL", 0) or 0) <= 0:
        return None

    # 1) hazard p_t
    p = float(defaults.get("base_probability_per_session", 0.08))
    readiness = state_row.get("readiness_state") or {}
    latent = state_row.get("latent_state") or {}
    constraints = state_row.get("constraints_state") or {}

    fatigue = float(readiness.get("fatigue_acute", 0.4) or 0.0)
    sleep = float(readiness.get("sleep_quality", 0.6) or 0.0)
    stable_streak_good = bool(readiness.get("stable_streak_good", False))
    injury_risk = float(latent.get("injury_risk", 0.3) or 0.0)

    if fatigue > 0.75:
        p *= float(defaults["hazard_modifiers"]["fatigue_high"])
    if sleep < 0.35:
        p *= float(defaults["hazard_modifiers"]["sleep_low"])
    if injury_risk > 0.70:
        p *= float(defaults["hazard_modifiers"]["injury_risk_high"])
    if stable_streak_good:
        p *= float(defaults["hazard_modifiers"]["stable_streak_good"])

    p = _clamp(p, 0.0, 0.18)

    # 2) sample
    if rng.random() > p:
        return None

    # 3) eligible families
    eligible = []
    for fam in EVENT_FAMILIES:
        if float(budgets.get(fam, 0) or 0) <= 0:
            continue
        if int(event_cooldowns.get(fam, 0) or 0) > 0:
            continue
        eligible.append(fam)

    if not eligible:
        return None

    # 4) weighted choice
    weights: Dict[str, float] = {}
    schedule_consistency = float(constraints.get("schedule_consistency", 0.7) or 0.7)

    for fam in eligible:
        w = 1.0
        if fam == "MICRO_INJURY_FLAG" and injury_risk < 0.55:
            w *= 0.35
        if fam == "RECOVERY_SHOCK" and sleep < 0.40:
            w *= 1.35
        if fam == "SCHEDULE_SHOCK" and schedule_consistency < 0.5:
            w *= 1.25
        weights[fam] = w

    family = _weighted_choice(rng, weights)

    # 5) severity + duration
    severity = _weighted_choice(rng, defaults["severity_distribution"])
    dur_min, dur_max = defaults["duration_sessions_by_severity"][severity]
    duration = rng.randint(int(dur_min), int(dur_max))

    # 6) build deltas
    deltas = _build_event_deltas(family, severity, state_row)

    # 7) event
    t_index = int(state_row.get("t_index") or 1)
    return {
        "event_id": str(random.Random(rng.random()).randint(10_000_000, 99_999_999)),
        "family": family,
        "severity": severity,
        "start_t": t_index,
        "end_t": t_index + duration - 1,
        "deltas": deltas,
    }


@dataclass
class EpisodeStartResult:
    episode: Dict[str, Any]
    state: Dict[str, Any]


class ExpertGameService:
    """SIM-only Expert Game service.

    Writes ONLY to:
      sim_episodes, scenario_state, expert_recommendations,
      sim_session_execution, sim_observations, sim_priors,
      expert_library_raw
    """

    def __init__(self, supabase: Client):
        self.supabase = supabase
        self._guard = SupabaseWriteGuard(
            supabase,
            allowed_write_tables={
                "sim_episodes",
                "scenario_state",
                "expert_recommendations",
                "sim_session_execution",
                "sim_observations",
                "sim_priors",
                "expert_library_raw",
            },
        )

    def _get_active_param_set(self) -> Dict[str, Any]:
        res = (
            self.supabase.table("transition_param_sets")
            .select("transition_param_set_id,name,version")
            .eq("is_active", True)
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        if not res.data:
            raise RuntimeError("No active transition_param_set found")
        return res.data[0]

    def start_episode(self, *, coach_id: str, coach_role: str = "coach") -> EpisodeStartResult:
        param_set = self._get_active_param_set()
        transition_param_set_id = param_set["transition_param_set_id"]

        rng_seed = random.SystemRandom().randint(1, 2**63 - 1)
        engine_version = "betalab_engine_v1"

        persona_id = str(random.SystemRandom().getrandbits(128))

        # Baseline profile + caps
        baseline_profile = {
            "years_climbing": 4,
            "benchmarks": {"boulder": "V6"},
            "goals": ["outdoor_season_prep"],
            "constraints_seed": {"time_budget_min": 90},
        }

        potential_caps = {d: 0.90 for d in LATENT_DIMS}

        rng = random.Random(rng_seed)

        latent_state = {d: round(_clamp(rng.uniform(0.35, 0.65), 0.0, potential_caps[d]), 4) for d in LATENT_DIMS}
        latent_uncertainty = {d: 0.02 for d in LATENT_DIMS}

        readiness_state = {
            "fatigue_acute": round(rng.uniform(0.25, 0.55), 4),
            "sleep_quality": round(rng.uniform(0.45, 0.80), 4),
            "motivation": round(rng.uniform(0.45, 0.85), 4),
            "skin": round(rng.uniform(0.40, 0.90), 4),
            "stable_streak_good": False,
        }

        constraints_state = {
            "time_budget_min": 90,
            "equipment_available": ["gym"],
            "gym_access": True,
            "injury_flags": [],
            "schedule_consistency": round(rng.uniform(0.55, 0.90), 4),
        }

        phase_state = {"phase": "base", "week_in_phase": 1}

        # SIM priors snapshot is internal to the game loop (never real)
        sim_priors_snapshot = {"version": "sim_priors_v1", "params": {}}
        sim_priors_version = "sim_priors_v1"

        event_cooldowns = {fam: 0 for fam in EVENT_FAMILIES}
        event_cooldowns["GLOBAL"] = 0

        event_budget_remaining = {fam: DEFAULT_EVENT_DEFAULTS["budgets"][fam]["max"] for fam in EVENT_FAMILIES}
        event_budget_remaining["TOTAL"] = DEFAULT_EVENT_DEFAULTS["budgets"]["TOTAL"]["max"]

        # Insert episode
        ep_payload = {
            "coach_id": coach_id,
            "coach_role": coach_role,
            "persona_id": persona_id,
            "rng_seed": rng_seed,
            "engine_version": engine_version,
            "transition_param_set_id": transition_param_set_id,
            "max_t": 30,
            "current_t": 1,
            "status": "active",
        }
        ep_res = self._guard.table("sim_episodes").insert(ep_payload).execute()
        if not ep_res.data:
            raise RuntimeError("Failed to create sim episode")
        episode = ep_res.data[0]

        # Insert initial scenario_state
        st_payload = {
            "episode_id": episode["episode_id"],
            "t_index": 1,
            "state_time": datetime.utcnow().isoformat(),
            "persona_id": persona_id,
            "baseline_profile": baseline_profile,
            "potential_caps": potential_caps,
            "latent_state": latent_state,
            "latent_uncertainty": latent_uncertainty,
            "readiness_state": readiness_state,
            "constraints_state": constraints_state,
            "phase_state": phase_state,
            "sim_priors_snapshot": sim_priors_snapshot,
            "sim_priors_version": sim_priors_version,
            "active_event": None,
            "event_cooldowns": event_cooldowns,
            "event_budget_remaining": event_budget_remaining,
            "rng_seed": rng_seed,
            "engine_version": engine_version,
            "transition_param_set_id": transition_param_set_id,
            "prev_scenario_state_id": None,
        }
        st_res = self._guard.table("scenario_state").insert(st_payload).execute()
        if not st_res.data:
            raise RuntimeError("Failed to create initial scenario_state")

        # Also write a sim pre observation (lightweight)
        self._guard.table("sim_observations").insert(
            {
                "episode_id": episode["episode_id"],
                "t_index": 1,
                "stage": "pre",
                "payload_json": {
                    "baseline_profile": baseline_profile,
                    "readiness_state": readiness_state,
                    "constraints_state": constraints_state,
                    "phase_state": phase_state,
                },
                "source_type": "sim_engine",
                "trust_weight": 0.2,
            }
        ).execute()

        return EpisodeStartResult(episode=episode, state=st_res.data[0])

    def get_state(self, *, episode_id: str, t_index: int) -> Dict[str, Any]:
        res = (
            self.supabase.table("scenario_state")
            .select("*")
            .eq("episode_id", episode_id)
            .eq("t_index", t_index)
            .single()
            .execute()
        )
        if not res.data:
            raise RuntimeError("scenario_state not found")
        return res.data

    def submit_recommendation(
        self,
        *,
        coach_id: str,
        coach_role: str,
        episode_id: str,
        t_index: int,
        scenario_state_id: str,
        planned_workout: Dict[str, Any],
        rationale_tags: Optional[Dict[str, Any]] = None,
        noticed_signals: Optional[Dict[str, Any]] = None,
        avoided_risks: Optional[Dict[str, Any]] = None,
        predicted_outcomes: Optional[Dict[str, Any]] = None,
        confidence: float = 0.7,
    ) -> Dict[str, Any]:
        validate_planned_workout(planned_workout)

        action_id = compute_action_id(planned_workout)
        dose_features = compute_planned_dose_features(planned_workout)

        # Deterministic embedding text composition (simple v1)
        state = (
            self.supabase.table("scenario_state")
            .select("readiness_state,constraints_state,phase_state,latent_state")
            .eq("scenario_state_id", scenario_state_id)
            .single()
            .execute()
        ).data
        rec_text_for_embedding = (
            f"action_id={action_id}\n"
            f"t={t_index}\n"
            f"readiness={state.get('readiness_state')}\n"
            f"constraints={state.get('constraints_state')}\n"
            f"phase={state.get('phase_state')}\n"
            f"latent={state.get('latent_state')}\n"
            f"planned_workout={planned_workout}"
        )

        payload = {
            "episode_id": episode_id,
            "t_index": t_index,
            "scenario_state_id": scenario_state_id,
            "action_id": action_id,
            "planned_workout": planned_workout,
            "planned_dose_features": dose_features,
            "rationale_tags": rationale_tags or {},
            "noticed_signals": noticed_signals or {},
            "avoided_risks": avoided_risks or {},
            "predicted_outcomes": predicted_outcomes or {},
            "confidence": float(_clamp(confidence, 0.0, 1.0)),
            "coach_id": coach_id,
            "coach_role": coach_role,
            "rec_text_for_embedding": rec_text_for_embedding,
            "embedding_model": None,
            "label_trust_weight": 1.0,
            "outcome_trust_weight": 0.2,
        }

        res = self._guard.table("expert_recommendations").insert(payload).execute()
        if not res.data:
            raise RuntimeError("Failed to insert expert_recommendations")
        row = res.data[0]

        # Mirror into raw library layer (so retrieval/search doesn't hit mutable sim tables)
        self._guard.table("expert_library_raw").insert(
            {
                "expert_rec_id": row["expert_rec_id"],
                "episode_id": episode_id,
                "t_index": t_index,
                "scenario_state_id": scenario_state_id,
                "action_id": action_id,
                "planned_workout": planned_workout,
                "planned_dose_features": dose_features,
                "rationale_tags": rationale_tags or {},
                "predicted_outcomes": predicted_outcomes or {},
                "coach_id": coach_id,
                "rubric_status": "needs_review",
            }
        ).execute()

        return row

    def advance_episode(self, *, episode_id: str) -> Dict[str, Any]:
        # Load episode
        ep = (
            self.supabase.table("sim_episodes")
            .select("*")
            .eq("episode_id", episode_id)
            .single()
            .execute()
        ).data
        if not ep:
            raise RuntimeError("Episode not found")

        t = int(ep.get("current_t") or 1)
        max_t = int(ep.get("max_t") or 30)
        if t >= max_t:
            # Mark complete
            self._guard.table("sim_episodes").update({"status": "completed"}).eq("episode_id", episode_id).execute()
            return {"t_index": t, "state": self.get_state(episode_id=episode_id, t_index=t)}

        # Require recommendation for current t
        rec = (
            self.supabase.table("expert_recommendations")
            .select("*")
            .eq("episode_id", episode_id)
            .eq("t_index", t)
            .single()
            .execute()
        ).data
        if not rec:
            raise RuntimeError(f"No expert_recommendation found for episode={episode_id} t={t}")

        state = self.get_state(episode_id=episode_id, t_index=t)

        rng_seed = int(state.get("rng_seed") or ep.get("rng_seed") or 1)
        rng = random.Random((rng_seed ^ (t * 1_000_003)) & 0xFFFFFFFFFFFF)

        # Load params
        param_set_id = state.get("transition_param_set_id")
        params = _get_transition_params(self.supabase, str(param_set_id))

        hi_attempt_threshold = float(params.get("dose.hi_attempt_threshold") or 0.85)

        planned = rec.get("planned_workout")
        planned_dose = rec.get("planned_dose_features") or compute_planned_dose_features(planned, hi_attempt_threshold=hi_attempt_threshold)

        # --- Adherence model (simple v1) ---
        constraints = state.get("constraints_state") or {}
        readiness = state.get("readiness_state") or {}

        time_budget = float(constraints.get("time_budget_min", 90) or 90)
        planned_time = float(planned.get("time_cap_min", 90) or 90)
        fatigue = float(readiness.get("fatigue_acute", 0.4) or 0.4)
        motivation = float(readiness.get("motivation", 0.6) or 0.6)
        complexity = float((planned_dose.get("summary") or {}).get("item_count", 1) or 1)

        # logit = bias - time_over - fatigue + motivation - complexity
        bias = float(params.get("adherence.bias") or 1.3)
        w_time = float(params.get("adherence.weight_time_over_budget") or 2.0)
        w_fatigue = float(params.get("adherence.weight_fatigue") or 1.2)
        w_mot = float(params.get("adherence.weight_motivation") or 0.9)
        w_complex = float(params.get("adherence.weight_complexity") or 0.6)

        time_over = max(0.0, (planned_time - time_budget) / max(1.0, time_budget))
        logit = bias - (w_time * time_over) - (w_fatigue * fatigue) + (w_mot * (motivation - 0.5)) - (w_complex * (complexity / 10.0))
        p_complete = 1.0 / (1.0 + math.exp(-logit))
        completed_fraction = _clamp(p_complete + rng.uniform(-0.15, 0.10), 0.2, 1.0)

        time_spent_min = min(time_budget, planned_time) * completed_fraction

        # Build executed_workout from planned_workout by scaling doses.
        exec_blocks = []
        for b in planned.get("blocks", []) or []:
            items_out = []
            for it in (b.get("prescription") or {}).get("items", []) or []:
                dose = it.get("dose") or {}
                intensity = it.get("intensity") or {}
                items_out.append(
                    {
                        "activity_type": it.get("activity_type"),
                        "name": it.get("name"),
                        "dose_actual": {
                            "sets": int(round(float(dose.get("sets") or 0) * completed_fraction)),
                            "reps": int(round(float(dose.get("reps") or 0) * completed_fraction)),
                            "minutes": float(dose.get("minutes") or 0) * completed_fraction,
                            "attempts": int(round(float(dose.get("attempts") or 0) * completed_fraction)),
                            "rest_seconds_avg": float(dose.get("rest_seconds") or 0),
                        },
                        "intensity_actual": {
                            "rpe_reported": intensity.get("rpe_target"),
                            "intensity_0_1": intensity.get("intensity_0_1"),
                            "grade_band": intensity.get("grade_band"),
                            "percent_max": intensity.get("percent_max"),
                        }
                        if intensity
                        else {},
                    }
                )
            if items_out:
                exec_blocks.append(
                    {
                        "name": b.get("name"),
                        "block_type": b.get("block_type"),
                        "items": items_out,
                    }
                )

        executed_workout = {
            "version": "1.0",
            "source": {"source_type": "sim_engine", "trust_weight": 0.2, "generator_version": ep.get("engine_version")},
            "completion": {
                "completed_fraction": round(completed_fraction, 4),
                "time_spent_min": round(time_spent_min, 2),
                "deviations": [],
            },
            "blocks": exec_blocks,
            "dose_observed": {
                "rpe_distribution": planned.get("dose_targets", {}).get("expected_rpe_distribution", {"bins": [0, 10], "probabilities": [1]}),
                "hi_attempts": 0,
                "tut_minutes": 0,
                "volume_score": 0,
                "fatigue_cost": 0,
            },
        }

        validate_executed_workout(executed_workout)
        exec_dose = compute_executed_dose_features(executed_workout, hi_attempt_threshold=hi_attempt_threshold)
        executed_workout["dose_observed"]["hi_attempts"] = exec_dose["totals"]["hi_attempts"]
        executed_workout["dose_observed"]["tut_minutes"] = exec_dose["totals"]["tut_minutes"]
        executed_workout["dose_observed"]["volume_score"] = exec_dose["summary"]["volume_score"]
        executed_workout["dose_observed"]["fatigue_cost"] = exec_dose["summary"]["fatigue_cost"]

        # Write sim execution and post observation
        self._guard.table("sim_session_execution").insert(
            {
                "episode_id": episode_id,
                "t_index": t,
                "expert_rec_id": rec["expert_rec_id"],
                "source_type": "sim_engine",
                "trust_weight": 0.2,
                "executed_workout": executed_workout,
            }
        ).execute()

        # crude post payload
        post_payload = {
            "completed_fraction": completed_fraction,
            "time_spent_min": time_spent_min,
            "dose_observed": executed_workout.get("dose_observed"),
            "session_quality": round(6.0 + rng.uniform(-1.5, 1.5) - (fatigue * 2.0) + (motivation * 1.0), 2),
            "risk_flags": constraints.get("injury_flags", []),
        }
        self._guard.table("sim_observations").insert(
            {
                "episode_id": episode_id,
                "t_index": t,
                "stage": "post",
                "payload_json": post_payload,
                "source_type": "sim_engine",
                "trust_weight": 0.2,
            }
        ).execute()

        # SIM priors update (kept minimal; stored for reproducibility)
        self._guard.table("sim_priors").insert(
            {
                "episode_id": episode_id,
                "t_index": t,
                "priors_json": {"note": "sim-only priors placeholder", "t": t},
                "priors_version": "sim_priors_v1",
                "source_type": "sim_engine",
                "trust_weight": 0.2,
            }
        ).execute()

        # Advance state to t+1
        next_t = t + 1

        # Fatigue update
        f_add_hi = float(params.get("fatigue.add_per_hi_attempt") or 0.03)
        f_add_tut = float(params.get("fatigue.add_per_min_tut") or 0.015)
        half_life = float(params.get("fatigue.recovery_half_life_sessions") or 2.5)
        decay = math.exp(-math.log(2) / max(0.5, half_life))

        hi_attempts_obs = float(exec_dose["totals"]["hi_attempts"])
        tut_obs = float(exec_dose["totals"]["tut_minutes"])

        fatigue_next = _clamp((fatigue * decay) + (hi_attempts_obs * f_add_hi) + (tut_obs * f_add_tut), 0.0, 1.0)

        # Latent adaptation (very simplified)
        base_rates = params.get("adapt.base_rate") or {}
        intensity_sens = params.get("adapt.intensity_sensitivity") or {}
        volume_sens = params.get("adapt.volume_sensitivity") or {}
        dim_k = float(params.get("adapt.diminishing_returns_k") or 3.0)

        avg_intensity = exec_dose["summary"].get("avg_intensity_0_1")
        avg_intensity_val = float(avg_intensity or 0.7)
        volume_score = float(exec_dose["summary"]["volume_score"])

        latent_next = dict(state.get("latent_state") or {})
        caps = dict(state.get("potential_caps") or {})

        for dim in [
            "strength_fingers",
            "strength_pull",
            "power",
            "aerobic_capacity",
            "anaerobic_capacity",
            "technique",
            "movement_skill",
        ]:
            cur = float(latent_next.get(dim, 0.5) or 0.5)
            cap = float(caps.get(dim, 0.9) or 0.9)

            br = float(base_rates.get(dim, 0.01) or 0.01)
            isens = float(intensity_sens.get(dim, 0.3) or 0.3)
            vsens = float(volume_sens.get(dim, 0.3) or 0.3)

            drive = (isens * avg_intensity_val) + (vsens * (volume_score / 10.0))
            remaining = max(0.0, 1.0 - (cur / max(1e-6, cap)))
            gain = br * drive * (remaining ** dim_k)
            latent_next[dim] = round(_clamp(cur + gain + rng.uniform(-0.002, 0.002), 0.0, cap), 4)

        latent_next["fatigue_acute"] = round(fatigue_next, 4)
        latent_next["injury_risk"] = round(_clamp(float(latent_next.get("injury_risk", 0.3) or 0.3) + rng.uniform(-0.01, 0.02), 0.0, 1.0), 4)

        readiness_next = dict(state.get("readiness_state") or {})
        readiness_next["fatigue_acute"] = round(fatigue_next, 4)
        readiness_next["sleep_quality"] = round(_clamp(float(readiness_next.get("sleep_quality", 0.6) or 0.6) + rng.uniform(-0.07, 0.07), 0.1, 1.0), 4)
        readiness_next["motivation"] = round(_clamp(float(readiness_next.get("motivation", 0.6) or 0.6) + rng.uniform(-0.08, 0.08), 0.1, 1.0), 4)

        constraints_next = dict(constraints)
        phase_next = dict(state.get("phase_state") or {})

        # Tick cooldowns and possibly end existing event
        event_cooldowns = _event_cooldowns_tick(dict(state.get("event_cooldowns") or {}))
        active_event, ended = _maybe_end_event(state.get("active_event"), t_index=t)
        if ended:
            event_cooldowns["GLOBAL"] = int(DEFAULT_EVENT_DEFAULTS.get("post_event_cooldown_sessions", 3))

        # Possibly start a new event at next step based on updated state row
        state_for_event = {
            **state,
            "t_index": next_t,
            "latent_state": latent_next,
            "readiness_state": readiness_next,
            "constraints_state": constraints_next,
            "event_cooldowns": event_cooldowns,
        }

        new_event = maybe_start_event(state_for_event, rng=rng, defaults=DEFAULT_EVENT_DEFAULTS)
        if new_event:
            # Spend budgets + set family cooldown
            budgets = dict(state.get("event_budget_remaining") or {})
            budgets["TOTAL"] = max(0, int(budgets.get("TOTAL", 0)) - 1)
            fam = new_event["family"]
            budgets[fam] = max(0, int(budgets.get(fam, 0)) - 1)
            event_cooldowns[fam] = int(DEFAULT_EVENT_DEFAULTS["family_cooldowns_sessions"][fam])

            # Apply deltas
            deltas = new_event.get("deltas") or {}
            if "time_budget_min" in deltas:
                constraints_next["time_budget_min"] = int(deltas["time_budget_min"])
            if "gym_access" in deltas:
                constraints_next["gym_access"] = bool(deltas["gym_access"])
            if "equipment_available" in deltas:
                constraints_next["equipment_available"] = deltas["equipment_available"]
            if "injury_flags" in deltas:
                constraints_next["injury_flags"] = deltas["injury_flags"]
            if "intensity_ceiling" in deltas:
                constraints_next["intensity_ceiling"] = float(deltas["intensity_ceiling"])
            if "sleep_quality" in deltas:
                readiness_next["sleep_quality"] = float(deltas["sleep_quality"])
            if "motivation" in deltas:
                readiness_next["motivation"] = float(deltas["motivation"])

            active_event = new_event
            event_budget_remaining = budgets
        else:
            event_budget_remaining = dict(state.get("event_budget_remaining") or {})

        # Insert next state row
        st_payload = {
            "episode_id": episode_id,
            "t_index": next_t,
            "state_time": datetime.utcnow().isoformat(),
            "persona_id": state.get("persona_id"),
            "baseline_profile": state.get("baseline_profile"),
            "potential_caps": state.get("potential_caps"),
            "latent_state": latent_next,
            "latent_uncertainty": state.get("latent_uncertainty") or {},
            "readiness_state": readiness_next,
            "constraints_state": constraints_next,
            "phase_state": phase_next,
            "sim_priors_snapshot": state.get("sim_priors_snapshot") or {},
            "sim_priors_version": state.get("sim_priors_version") or "sim_priors_v1",
            "active_event": active_event,
            "event_cooldowns": event_cooldowns,
            "event_budget_remaining": event_budget_remaining,
            "rng_seed": rng_seed,
            "engine_version": state.get("engine_version") or ep.get("engine_version"),
            "transition_param_set_id": state.get("transition_param_set_id"),
            "prev_scenario_state_id": state.get("scenario_state_id"),
        }
        st_res = self._guard.table("scenario_state").insert(st_payload).execute()
        if not st_res.data:
            raise RuntimeError("Failed to insert next scenario_state")

        # Write next pre observation
        self._guard.table("sim_observations").insert(
            {
                "episode_id": episode_id,
                "t_index": next_t,
                "stage": "pre",
                "payload_json": {
                    "readiness_state": readiness_next,
                    "constraints_state": constraints_next,
                    "phase_state": phase_next,
                    "active_event": active_event,
                },
                "source_type": "sim_engine",
                "trust_weight": 0.2,
            }
        ).execute()

        # Update episode current_t
        self._guard.table("sim_episodes").update({"current_t": next_t}).eq("episode_id", episode_id).execute()

        return {"t_index": next_t, "state": st_res.data[0]}
