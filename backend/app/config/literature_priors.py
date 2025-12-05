"""
Literature-Based Priors for Bayesian Recommendation Engine

These priors are derived from peer-reviewed research on:
- Sleep and athletic performance
- Caffeine ergogenic effects
- Stress-performance relationships
- Recovery and supercompensation
- Climbing-specific research

Each prior includes:
- population_mean: Expected effect on session quality per unit change
- population_std: Uncertainty in the population estimate
- individual_variance: Expected between-person variance
- optimal_range: Recommended target values (if applicable)
- sources: Literature citations

These priors are combined with expert-derived priors using
inverse-variance weighted meta-analysis.
"""

LITERATURE_PRIORS = {
    # =========================================================================
    # SLEEP FACTORS
    # =========================================================================
    "sleep_hours": {
        "population_mean": 0.15,  # +0.15 quality per hour above baseline
        "population_std": 0.08,
        "individual_variance": 0.10,
        "optimal_range": [7, 9],
        "category": "sleep",
        "effect_direction": "positive",
        "description": "Hours of sleep the night before",
        "sources": ["Walker 2017 - Why We Sleep", "Simpson 2017 - Sleep & Athletic Performance"]
    },
    
    "sleep_quality": {
        "population_mean": 0.40,  # +0.4 quality per point (1-5 scale)
        "population_std": 0.15,
        "individual_variance": 0.15,
        "category": "sleep",
        "effect_direction": "positive",
        "description": "Subjective sleep quality rating",
        "sources": ["Vitale 2019 - Sleep Hygiene for Optimizing Recovery"]
    },
    
    # =========================================================================
    # RECOVERY FACTORS
    # =========================================================================
    "days_since_hard_session": {
        "population_mean": 0.30,  # +0.3 quality per day of recovery
        "population_std": 0.12,
        "individual_variance": 0.20,
        "optimal_range": [2, 4],  # 2-4 days optimal for most climbers
        "category": "recovery",
        "effect_direction": "positive",  # More recovery generally better up to a point
        "description": "Days since last high-intensity session",
        "sources": ["Levernier 2020 - Finger Flexor Fatigue", "Ozimek 2018 - Recovery in Elite Climbers"]
    },
    
    "days_since_last_session": {
        "population_mean": 0.15,
        "population_std": 0.08,
        "individual_variance": 0.15,
        "optimal_range": [1, 3],
        "category": "recovery",
        "effect_direction": "nonlinear",  # U-shaped - too few or too many is bad
        "description": "Days since any climbing session",
        "sources": ["Training periodization literature"]
    },
    
    "soreness_level": {
        "population_mean": -0.20,  # -0.2 quality per point of soreness (1-5)
        "population_std": 0.10,
        "individual_variance": 0.15,
        "category": "recovery",
        "effect_direction": "negative",
        "description": "Muscle soreness rating",
        "sources": ["DOMS research", "Estimated from climbing-specific recovery"]
    },
    
    # =========================================================================
    # ENERGY & READINESS
    # =========================================================================
    "energy_level": {
        "population_mean": 0.45,  # +0.45 quality per point (1-5 scale)
        "population_std": 0.20,
        "individual_variance": 0.25,
        "category": "energy",
        "effect_direction": "positive",
        "description": "Subjective energy rating",
        "sources": ["Estimated from sports performance literature"]
    },
    
    "motivation_level": {
        "population_mean": 0.35,
        "population_std": 0.15,
        "individual_variance": 0.20,
        "category": "psychological",
        "effect_direction": "positive",
        "description": "Motivation to climb",
        "sources": ["Deci & Ryan - Self-Determination Theory", "Sports motivation research"]
    },
    
    # =========================================================================
    # STRESS & ANXIETY
    # =========================================================================
    "stress_level": {
        "population_mean": -0.35,  # -0.35 quality per point of stress (1-5)
        "population_std": 0.15,
        "individual_variance": 0.20,
        "category": "psychological",
        "effect_direction": "negative",
        "description": "Life stress level",
        "sources": ["Nieuwenhuys 2012 - Anxiety and Performance", "Hardy 1996 - Catastrophe Model"]
    },
    
    "performance_anxiety": {
        "population_mean": -0.25,  # -0.25 quality per point (1-10)
        "population_std": 0.12,
        "individual_variance": 0.18,
        "category": "psychological",
        "effect_direction": "negative",
        "description": "Climbing-specific performance anxiety",
        "sources": ["Pijpers 2003 - Anxiety in Climbing", "Hardy 1996"]
    },
    
    "fear_of_falling": {
        "population_mean": -0.15,
        "population_std": 0.08,
        "individual_variance": 0.12,
        "category": "psychological",
        "effect_direction": "negative",
        "description": "Fear of falling rating",
        "sources": ["Draper 2008 - Fear of Falling", "Climbing psychology research"]
    },
    
    # =========================================================================
    # SUBSTANCES
    # =========================================================================
    "caffeine_mg": {
        "population_mean": 0.003,  # +0.003 quality per mg (so +0.3 per 100mg)
        "population_std": 0.002,
        "individual_variance": 0.004,  # High individual variance in caffeine response
        "optimal_range": [100, 300],  # 100-300mg optimal for most
        "category": "substance",
        "effect_direction": "positive",
        "description": "Caffeine intake in mg",
        "sources": ["Grgic 2020 - Caffeine Meta-Analysis", "Guest 2021 - Caffeine Genetics"],
        "notes": "Effect highly dependent on habitual use and genetics (CYP1A2)"
    },
    
    "caffeine_today": {
        "population_mean": 0.15,  # Binary: +0.15 if consumed
        "population_std": 0.10,
        "individual_variance": 0.20,
        "category": "substance",
        "effect_direction": "positive",
        "description": "Whether caffeine was consumed",
        "sources": ["Grgic 2020"]
    },
    
    "alcohol_last_24h": {
        "population_mean": -0.25,  # -0.25 if alcohol consumed
        "population_std": 0.12,
        "individual_variance": 0.15,
        "category": "substance",
        "effect_direction": "negative",
        "description": "Alcohol consumption in last 24h",
        "sources": ["Barnes 2010 - Alcohol and Athletic Performance"]
    },
    
    # =========================================================================
    # WARMUP & PREPARATION
    # =========================================================================
    "warmup_duration_min": {
        "population_mean": 0.025,  # +0.025 quality per minute
        "population_std": 0.015,
        "individual_variance": 0.02,
        "optimal_range": [15, 30],  # 15-30 min optimal
        "category": "preparation",
        "effect_direction": "positive",
        "description": "Warmup duration in minutes",
        "sources": ["España-Romero 2009 - Climbing Specific Warmup", "General warmup research"]
    },
    
    # =========================================================================
    # HYDRATION & NUTRITION
    # =========================================================================
    "hydration_status": {
        "population_mean": 0.20,
        "population_std": 0.10,
        "individual_variance": 0.12,
        "category": "nutrition",
        "effect_direction": "positive",
        "description": "Hydration level rating",
        "sources": ["Hydration and grip strength research"]
    },
    
    "hours_since_meal": {
        "population_mean": -0.05,  # Slightly negative if too long
        "population_std": 0.03,
        "individual_variance": 0.04,
        "optimal_range": [1, 3],  # 1-3 hours optimal
        "category": "nutrition",
        "effect_direction": "nonlinear",
        "description": "Hours since last meal",
        "sources": ["Sports nutrition literature"]
    },
    
    # =========================================================================
    # INJURY FACTORS
    # =========================================================================
    "injury_severity": {
        "population_mean": -0.50,  # -0.5 per point of severity
        "population_std": 0.20,
        "individual_variance": 0.25,
        "category": "injury",
        "effect_direction": "negative",
        "description": "Current injury severity",
        "sources": ["Direct performance limitation"]
    },
    
    "finger_niggle_severity": {
        "population_mean": -0.40,
        "population_std": 0.15,
        "individual_variance": 0.20,
        "category": "injury",
        "effect_direction": "negative",
        "description": "Finger injury/niggle severity",
        "sources": ["Climbing-specific injury research"]
    },
    
    # =========================================================================
    # DEMOGRAPHIC FACTORS (for interaction effects)
    # =========================================================================
    "age_recovery_modifier": {
        "population_mean": -0.01,  # Slight negative effect per year over 30
        "population_std": 0.005,
        "individual_variance": 0.008,
        "category": "demographic",
        "effect_direction": "negative",
        "description": "Age effect on recovery needs",
        "sources": ["Age-related recovery research"]
    },
    
    "experience_stress_modifier": {
        "population_mean": 0.02,  # More experience reduces stress impact
        "population_std": 0.01,
        "individual_variance": 0.015,
        "category": "demographic",
        "effect_direction": "positive",
        "description": "Experience moderates stress effects",
        "sources": ["Expertise and pressure research"]
    },
}


# Confidence weights for expert responses
CONFIDENCE_WEIGHTS = {
    "high": 1.0,
    "medium": 0.7,
    "low": 0.4
}


# Phase thresholds for personalization
PHASE_THRESHOLDS = {
    "cold_start": 10,      # < 10 sessions: rely heavily on population priors
    "learning": 30,        # 10-30 sessions: partial pooling
    "personalized": 30     # >= 30 sessions: individual effects dominate
}


def get_prior(variable_name: str) -> dict:
    """Get literature prior for a variable."""
    return LITERATURE_PRIORS.get(variable_name, {
        "population_mean": 0.0,
        "population_std": 0.5,
        "individual_variance": 0.3,
        "category": "unknown",
        "effect_direction": "unknown",
        "description": "No literature prior available",
        "sources": []
    })


def get_all_treatment_variables() -> list:
    """Get list of all variables that can be used as model inputs."""
    return list(LITERATURE_PRIORS.keys())


def get_variables_by_category(category: str) -> dict:
    """Get all priors in a category."""
    return {
        k: v for k, v in LITERATURE_PRIORS.items()
        if v.get("category") == category
    }

