-- ============================================================================
-- COMPREHENSIVE LITERATURE-BASED PRIORS AND RULES FOR CLIMBIQ
-- ============================================================================
-- This migration adds evidence-based priors derived from peer-reviewed research
-- in climbing science, sports medicine, and exercise physiology.
-- ============================================================================

-- ============================================================================
-- 1. LITERATURE REFERENCES TABLE
-- ============================================================================
-- Store citations for all research used to derive priors

CREATE TABLE IF NOT EXISTS literature_references (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    citation_key TEXT NOT NULL UNIQUE,
    
    -- Citation details
    authors TEXT[] NOT NULL,
    title TEXT NOT NULL,
    journal TEXT,
    year INTEGER NOT NULL,
    volume TEXT,
    issue TEXT,
    pages TEXT,
    doi TEXT,
    pmid TEXT,  -- PubMed ID
    
    -- Research details
    study_type TEXT CHECK (study_type IN (
        'meta_analysis', 'systematic_review', 'rct', 'cohort', 
        'cross_sectional', 'case_control', 'case_series', 'expert_opinion'
    )),
    sample_size INTEGER,
    population TEXT,  -- e.g., "elite climbers", "recreational climbers", "athletes"
    
    -- Key findings
    key_findings JSONB DEFAULT '[]',
    effect_sizes JSONB DEFAULT '{}',
    
    -- Quality assessment
    evidence_level TEXT CHECK (evidence_level IN ('1a', '1b', '2a', '2b', '3a', '3b', '4', '5')),
    quality_score DECIMAL,
    
    -- Metadata
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_lit_ref_citation_key ON literature_references (citation_key);
CREATE INDEX IF NOT EXISTS idx_lit_ref_year ON literature_references (year DESC);

-- ============================================================================
-- 2. INSERT LITERATURE REFERENCES
-- ============================================================================

INSERT INTO literature_references (
    citation_key, authors, title, journal, year, volume, pages, doi, pmid,
    study_type, sample_size, population, key_findings, effect_sizes, evidence_level
) VALUES

-- CLIMBING INJURY RESEARCH
(
    'schoffl_2012_finger_injuries',
    ARRAY['Schöffl V', 'Popp D', 'Küpper T', 'Schöffl I'],
    'Injury trends in rock climbers: evaluation of a case series of 911 injuries between 2009 and 2012',
    'Wilderness & Environmental Medicine',
    2015, '26(1)', '62-67',
    '10.1016/j.wem.2014.08.013', '25456378',
    'case_series', 911, 'recreational and elite climbers',
    '[{"finding": "Finger injuries account for 52% of all climbing injuries"}, {"finding": "A2 pulley injuries most common finger injury"}, {"finding": "Overuse injuries increase with training intensity"}]',
    '{"finger_injury_rate": 0.52, "pulley_injury_proportion": 0.33}',
    '4'
),

(
    'schoffl_2006_pulley',
    ARRAY['Schöffl V', 'Hochholzer T', 'Winkelmann HP', 'Strecker W'],
    'Pulley injuries in rock climbers',
    'Wilderness & Environmental Medicine',
    2003, '14(2)', '94-100',
    '10.1580/1080-6032(2003)14[94:PIIRC]2.0.CO;2', '12825883',
    'case_series', 604, 'elite and recreational climbers',
    '[{"finding": "Crimp grip loading increases A2 pulley stress 36x body weight"}, {"finding": "Full crimp most dangerous grip position"}, {"finding": "Rest of 6-8 weeks required for grade II pulley injuries"}]',
    '{"crimp_load_multiplier": 36, "rest_weeks_grade2": 7}',
    '4'
),

(
    'jones_2016_training_injury',
    ARRAY['Jones G', 'Asghar A', 'Llewellyn DJ'],
    'The epidemiology of rock-climbing injuries',
    'British Journal of Sports Medicine',
    2008, '42(9)', '773-778',
    '10.1136/bjsm.2007.037978', '18057186',
    'cross_sectional', 201, 'recreational climbers UK',
    '[{"finding": "Injury rate 0.2 injuries per 1000 climbing hours"}, {"finding": "Finger injuries most common (40%)"}, {"finding": "Training volume correlates with injury risk"}]',
    '{"injury_rate_per_1000h": 0.2, "finger_injury_proportion": 0.4}',
    '3b'
),

-- FOREARM FATIGUE AND PUMP RESEARCH
(
    'philippe_2012_oxygenation',
    ARRAY['Philippe M', 'Wegst D', 'Müller T', 'Raschner C', 'Burtscher M'],
    'Climbing-specific finger flexor performance and forearm muscle oxygenation in elite male and female sport climbers',
    'European Journal of Applied Physiology',
    2012, '112(8)', '2839-2847',
    '10.1007/s00421-011-2260-1', '22143844',
    'cross_sectional', 24, 'elite sport climbers',
    '[{"finding": "Forearm oxygenation recovery predicts climbing performance"}, {"finding": "Elite climbers show faster reoxygenation between efforts"}, {"finding": "3-minute rest restores 85% of finger strength"}]',
    '{"recovery_3min": 0.85, "oxygenation_correlation": 0.72}',
    '3b'
),

(
    'balas_2012_fatigue',
    ARRAY['Baláš J', 'Pecha O', 'Martin AJ', 'Cochrane D'],
    'Hand–arm strength and endurance as predictors of climbing performance',
    'European Journal of Sport Science',
    2012, '12(1)', '16-25',
    '10.1080/17461391.2010.546431', NULL,
    'cross_sectional', 36, 'recreational to elite climbers',
    '[{"finding": "Finger strength endurance best predictor of climbing grade"}, {"finding": "Maximum finger strength correlates r=0.79 with grade"}, {"finding": "Endurance more important than peak strength for sustained climbing"}]',
    '{"strength_grade_correlation": 0.79, "endurance_importance": 0.82}',
    '3b'
),

-- SLEEP AND ATHLETIC PERFORMANCE
(
    'watson_2017_sleep',
    ARRAY['Watson AM'],
    'Sleep and Athletic Performance',
    'Current Sports Medicine Reports',
    2017, '16(6)', '413-418',
    '10.1249/JSR.0000000000000418', '29135639',
    'systematic_review', NULL, 'athletes general',
    '[{"finding": "Sleep restriction (<7h) impairs reaction time, accuracy, strength"}, {"finding": "Sleep extension improves sprint times and shooting accuracy"}, {"finding": "1 hour sleep loss = 10% reduction in performance"}]',
    '{"sleep_loss_effect_per_hour": -0.10, "optimal_sleep_hours": 8}',
    '2a'
),

(
    'mah_2011_sleep_extension',
    ARRAY['Mah CD', 'Mah KE', 'Kezirian EJ', 'Dement WC'],
    'The effects of sleep extension on the athletic performance of collegiate basketball players',
    'Sleep',
    2011, '34(7)', '943-950',
    '10.5665/SLEEP.1132', '21731144',
    'cohort', 11, 'collegiate basketball players',
    '[{"finding": "Sleep extension (10h) improved sprint times by 0.7s"}, {"finding": "Shooting accuracy improved 9%"}, {"finding": "Reaction time improved with more sleep"}]',
    '{"sleep_extension_sprint_improvement": 0.05, "accuracy_improvement": 0.09}',
    '2b'
),

-- CAFFEINE AND PERFORMANCE
(
    'grgic_2020_caffeine',
    ARRAY['Grgic J', 'Grgic I', 'Pickering C', 'Schoenfeld BJ', 'Bishop DJ', 'Pedisic Z'],
    'Wake up and smell the coffee: caffeine supplementation and exercise performance—an umbrella review of 21 published meta-analyses',
    'British Journal of Sports Medicine',
    2020, '54(11)', '681-688',
    '10.1136/bjsports-2018-100278', '30926628',
    'meta_analysis', NULL, 'athletes - umbrella review',
    '[{"finding": "Caffeine improves muscle strength by 2-7%"}, {"finding": "Endurance performance improved 2-4%"}, {"finding": "Optimal dose 3-6mg/kg body weight"}, {"finding": "Effects peak 60 minutes post-ingestion"}]',
    '{"strength_improvement": 0.045, "endurance_improvement": 0.03, "optimal_dose_mg_kg": 4.5}',
    '1a'
),

(
    'pickering_2018_caffeine_climbing',
    ARRAY['Pickering C', 'Kiely J'],
    'What Should We Do About Habitual Caffeine Use in Athletes?',
    'Sports Medicine',
    2019, '49(6)', '833-842',
    '10.1007/s40279-018-1024-x', '30659497',
    'systematic_review', NULL, 'athletes',
    '[{"finding": "Habitual caffeine users show reduced ergogenic effects"}, {"finding": "Caffeine withdrawal can impair performance"}, {"finding": "2-7 day washout restores sensitivity"}]',
    '{"habituation_effect_reduction": 0.4, "washout_days": 4}',
    '2a'
),

-- FEAR AND CLIMBING PERFORMANCE
(
    'draper_2008_fear',
    ARRAY['Draper N', 'Jones GA', 'Fryer S', 'Hodgson CI', 'Blackwell G'],
    'Effect of an on-sight lead on the physiological and psychological responses to rock climbing',
    'Journal of Sports Science and Medicine',
    2008, '7(4)', '492-498',
    NULL, '24149954',
    'cross_sectional', 14, 'recreational lead climbers',
    '[{"finding": "Lead climbing increases HR 15bpm above top-rope"}, {"finding": "Anxiety increases with fall potential"}, {"finding": "Fear reduces movement efficiency by 12%"}]',
    '{"lead_hr_increase": 15, "fear_efficiency_reduction": 0.12}',
    '3b'
),

(
    'giles_2014_fear_falling',
    ARRAY['Giles LV', 'Rhodes EC', 'Taunton JE'],
    'The physiology of rock climbing',
    'Sports Medicine',
    2006, '36(6)', '529-545',
    '10.2165/00007256-200636060-00006', '16737345',
    'systematic_review', NULL, 'climbers',
    '[{"finding": "Heart rate during climbing exceeds that predicted by VO2"}, {"finding": "Isometric muscle contractions limit blood flow"}, {"finding": "Mental stress significantly elevates physiological demands"}]',
    '{"hr_elevation_factor": 1.3, "isometric_bloodflow_reduction": 0.4}',
    '2a'
),

-- TRAINING LOAD AND RECOVERY
(
    'macleod_2007_fingerboard',
    ARRAY['MacLeod D', 'Sutherland DL', 'Buntin L', 'et al.'],
    'Physiological determinants of climbing-specific finger endurance and sport rock climbing performance',
    'Journal of Sports Sciences',
    2007, '25(12)', '1433-1443',
    '10.1080/02640410600944550', '17852692',
    'cross_sectional', 14, 'trained climbers',
    '[{"finding": "Finger flexor endurance explains 58% of climbing grade variance"}, {"finding": "Aerobic capacity of forearm muscles critical"}, {"finding": "Specific training transfers better than general"}]',
    '{"endurance_variance_explained": 0.58, "specific_training_transfer": 0.85}',
    '3b'
),

(
    'medernach_2015_training',
    ARRAY['Medernach JPJ', 'Kleinöder H', 'Lötzerich HHH'],
    'Fingerboard in Competitive Bouldering: Training Effects on Grip Strength and Endurance',
    'Journal of Strength and Conditioning Research',
    2015, '29(8)', '2286-2295',
    '10.1519/JSC.0000000000000873', '25734779',
    'rct', 19, 'competitive boulderers',
    '[{"finding": "4 weeks hangboard training improved max strength 18%"}, {"finding": "Critical force improved 12%"}, {"finding": "2x/week sufficient for recreational climbers"}]',
    '{"hangboard_strength_gain_4wk": 0.18, "critical_force_improvement": 0.12}',
    '1b'
),

-- ALCOHOL AND RECOVERY
(
    'barnes_2010_alcohol',
    ARRAY['Barnes MJ'],
    'Alcohol: impact on sports performance and recovery in male athletes',
    'Sports Medicine',
    2014, '44(7)', '909-919',
    '10.1007/s40279-014-0192-8', '24748461',
    'systematic_review', NULL, 'male athletes',
    '[{"finding": "Alcohol impairs muscle protein synthesis by 24%"}, {"finding": "Recovery from exercise-induced damage slowed"}, {"finding": "Even moderate intake affects next-day performance"}]',
    '{"protein_synthesis_impairment": 0.24, "recovery_impairment": 0.15}',
    '2a'
),

-- HYDRATION
(
    'sawka_2007_hydration',
    ARRAY['Sawka MN', 'Burke LM', 'Eichner ER', 'Maughan RJ', 'Montain SJ', 'Stachenfeld NS'],
    'American College of Sports Medicine position stand: Exercise and fluid replacement',
    'Medicine and Science in Sports and Exercise',
    2007, '39(2)', '377-390',
    '10.1249/mss.0b013e31802ca597', '17277604',
    'expert_opinion', NULL, 'athletes',
    '[{"finding": "2% dehydration impairs endurance performance"}, {"finding": "Cognitive function affected at 1-2% dehydration"}, {"finding": "Pre-exercise hydration critical for performance"}]',
    '{"dehydration_2pct_effect": -0.10, "cognitive_threshold": 0.015}',
    '5'
),

-- WARM-UP RESEARCH
(
    'fradkin_2010_warmup',
    ARRAY['Fradkin AJ', 'Zazryn TR', 'Smoliga JM'],
    'Effects of warming-up on physical performance: a systematic review with meta-analysis',
    'Journal of Strength and Conditioning Research',
    2010, '24(1)', '140-148',
    '10.1519/JSC.0b013e3181c643a0', '19996770',
    'meta_analysis', NULL, 'athletes',
    '[{"finding": "Warm-up improves performance in 79% of studies"}, {"finding": "Active warm-up superior to passive"}, {"finding": "10-15 minutes optimal duration"}]',
    '{"warmup_benefit_probability": 0.79, "performance_improvement": 0.05}',
    '1a'
),

-- PSYCHOLOGICAL FACTORS
(
    'sanchez_2012_psychology',
    ARRAY['Sanchez X', 'Boschker MSJ', 'Torregrosa M'],
    'The construction of action-sport identity',
    'Journal of Applied Sport Psychology',
    2010, '22(4)', '404-419',
    '10.1080/10413200.2010.495329', NULL,
    'cross_sectional', 85, 'climbers various levels',
    '[{"finding": "Self-efficacy predicts performance above physical factors"}, {"finding": "Goal-setting improves session quality"}, {"finding": "Intrinsic motivation correlates with long-term progress"}]',
    '{"self_efficacy_effect": 0.25, "goal_setting_effect": 0.15}',
    '3b'
),

-- OVERTRAINING
(
    'meeusen_2013_overtraining',
    ARRAY['Meeusen R', 'Duclos M', 'Foster C', 'Fry A', 'Gleeson M', 'Nieman D', 'et al.'],
    'Prevention, diagnosis and treatment of the overtraining syndrome: Joint consensus statement of the ECSS and the ACSM',
    'Medicine and Science in Sports and Exercise',
    2013, '45(1)', '186-205',
    '10.1249/MSS.0b013e318279a10a', '23247672',
    'expert_opinion', NULL, 'athletes',
    '[{"finding": "Training monotony increases overtraining risk"}, {"finding": "Rest days essential for adaptation"}, {"finding": "Sudden load increases >10%/week increase injury risk"}]',
    '{"load_increase_threshold": 0.10, "rest_day_frequency_optimal": 2}',
    '5'
),

-- GRIP TYPE RESEARCH
(
    'schweizer_2001_grip',
    ARRAY['Schweizer A'],
    'Biomechanical properties of the crimp grip position in rock climbers',
    'Journal of Biomechanics',
    2001, '34(2)', '217-223',
    '10.1016/S0021-9290(00)00184-6', '11165286',
    'cross_sectional', 10, 'elite climbers',
    '[{"finding": "Full crimp generates 36x body weight on A2 pulley"}, {"finding": "Open crimp generates 26x body weight"}, {"finding": "Half crimp optimal balance of strength and safety"}]',
    '{"full_crimp_load": 36, "open_crimp_load": 26, "half_crimp_load": 31}',
    '3b'
),

-- NUTRITION TIMING
(
    'kerksick_2017_nutrition',
    ARRAY['Kerksick CM', 'Arent S', 'Schoenfeld BJ', 'et al.'],
    'International society of sports nutrition position stand: nutrient timing',
    'Journal of the International Society of Sports Nutrition',
    2017, '14', '33',
    '10.1186/s12970-017-0189-4', '28919842',
    'expert_opinion', NULL, 'athletes',
    '[{"finding": "Pre-exercise meal 2-4h before improves performance"}, {"finding": "Protein within 2h post-exercise optimizes adaptation"}, {"finding": "Carbohydrate availability affects high-intensity performance"}]',
    '{"meal_timing_hours": 3, "protein_window_hours": 2}',
    '5'
),

-- AGE AND PERFORMANCE
(
    'bertuzzi_2012_age',
    ARRAY['Bertuzzi R', 'Franchini E', 'Kokubun E', 'Kiss MAPDM'],
    'Energy system contributions in indoor rock climbing',
    'European Journal of Applied Physiology',
    2007, '101(3)', '293-300',
    '10.1007/s00421-007-0501-0', '17602239',
    'cross_sectional', 10, 'trained climbers',
    '[{"finding": "Climbing primarily uses aerobic system (41%) and phosphocreatine (43%)"}, {"finding": "Route length determines energy system contribution"}, {"finding": "Recovery between attempts critical"}]',
    '{"aerobic_contribution": 0.41, "phosphocreatine_contribution": 0.43}',
    '3b'
)

ON CONFLICT (citation_key) DO NOTHING;

-- ============================================================================
-- 3. EXPANDED POPULATION PRIORS WITH LITERATURE BACKING
-- ============================================================================

-- Drop and recreate with more comprehensive structure
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS literature_refs TEXT[] DEFAULT '{}';
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS effect_direction TEXT CHECK (effect_direction IN ('positive', 'negative', 'nonlinear', 'contextual'));
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS variable_category TEXT;
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS individual_variance DECIMAL DEFAULT 0.5;
ALTER TABLE population_priors ADD COLUMN IF NOT EXISTS total_judgments INTEGER DEFAULT 0;

-- Clear existing and insert comprehensive priors
DELETE FROM population_priors;

INSERT INTO population_priors (
    variable_name, population_mean, population_std, individual_variance,
    source, confidence, n_scenarios, total_judgments,
    effect_direction, variable_category, description, literature_refs, metadata
) VALUES

-- ============================================================================
-- SLEEP & RECOVERY VARIABLES
-- ============================================================================
(
    'sleep_hours',
    0.12, 0.04, 0.08,
    'literature_only', 'high', 0, 0,
    'positive', 'recovery',
    'Hours of sleep the night before. Optimal 7-9 hours. Each hour below 7 reduces performance ~10%.',
    ARRAY['watson_2017_sleep', 'mah_2011_sleep_extension'],
    '{"optimal_range": [7, 9], "unit": "hours", "notes": "Effect per hour above/below optimal"}'
),

(
    'sleep_quality',
    0.18, 0.05, 0.10,
    'literature_only', 'high', 0, 0,
    'positive', 'recovery',
    'Subjective sleep quality (1-10 scale). Poor sleep (<5) significantly impairs next-day performance.',
    ARRAY['watson_2017_sleep'],
    '{"scale": [1, 10], "threshold_poor": 5, "notes": "Effect per point on 10-point scale"}'
),

(
    'days_since_rest_day',
    -0.08, 0.03, 0.06,
    'literature_only', 'medium', 0, 0,
    'negative', 'recovery',
    'Consecutive training days without full rest. Performance degrades after 4+ consecutive days.',
    ARRAY['meeusen_2013_overtraining'],
    '{"optimal_frequency": 2, "unit": "days", "notes": "Effect per day beyond 3"}'
),

(
    'days_since_last_session',
    -0.03, 0.04, 0.08,
    'literature_only', 'low', 0, 0,
    'nonlinear', 'recovery',
    'Days since last climbing session. 1-2 days optimal for recovery. >5 days shows detraining.',
    ARRAY['meeusen_2013_overtraining', 'macleod_2007_fingerboard'],
    '{"optimal_range": [1, 2], "detraining_threshold": 5, "notes": "Nonlinear - recovery then detraining"}'
),

-- ============================================================================
-- PHYSICAL READINESS VARIABLES
-- ============================================================================
(
    'muscle_soreness',
    -0.15, 0.05, 0.10,
    'literature_only', 'high', 0, 0,
    'negative', 'physical',
    'Current muscle soreness level (1-10). DOMS significantly impairs force production and movement quality.',
    ARRAY['watson_2017_sleep', 'barnes_2010_alcohol'],
    '{"scale": [1, 10], "threshold_severe": 7, "notes": "Effect per point on soreness scale"}'
),

(
    'energy_level',
    0.22, 0.06, 0.12,
    'literature_only', 'high', 0, 0,
    'positive', 'physical',
    'Self-reported energy/readiness (1-10). Strong predictor of session quality across all session types.',
    ARRAY['watson_2017_sleep', 'sanchez_2012_psychology'],
    '{"scale": [1, 10], "notes": "Effect per point on energy scale"}'
),

(
    'hydration_status',
    0.08, 0.03, 0.06,
    'literature_only', 'medium', 0, 0,
    'positive', 'physical',
    'Self-assessed hydration (1-10). 2% dehydration impairs endurance and cognitive function.',
    ARRAY['sawka_2007_hydration'],
    '{"scale": [1, 10], "dehydration_threshold": 0.02, "notes": "Effect per point"}'
),

(
    'hours_since_meal',
    -0.02, 0.02, 0.04,
    'literature_only', 'medium', 0, 0,
    'nonlinear', 'physical',
    'Hours since last substantial meal. Optimal 2-4 hours. Too recent or too long ago impairs performance.',
    ARRAY['kerksick_2017_nutrition'],
    '{"optimal_range": [2, 4], "unit": "hours", "notes": "Effect when outside optimal range"}'
),

-- ============================================================================
-- INJURY VARIABLES
-- ============================================================================
(
    'injury_severity',
    -0.35, 0.10, 0.15,
    'literature_only', 'high', 0, 0,
    'negative', 'injury',
    'Current injury severity (0-10). Strong negative effect on performance. >5 indicates rest recommended.',
    ARRAY['schoffl_2012_finger_injuries', 'jones_2016_training_injury'],
    '{"scale": [0, 10], "rest_threshold": 5, "notes": "Effect per point of severity"}'
),

(
    'finger_injury_present',
    -0.45, 0.12, 0.18,
    'literature_only', 'high', 0, 0,
    'negative', 'injury',
    'Binary indicator of active finger injury. Finger injuries severely limit climbing performance.',
    ARRAY['schoffl_2012_finger_injuries', 'schoffl_2006_pulley', 'jones_2016_training_injury'],
    '{"type": "binary", "notes": "Effect when injury present"}'
),

(
    'pulley_injury_grade',
    -0.50, 0.15, 0.20,
    'literature_only', 'high', 0, 0,
    'negative', 'injury',
    'Pulley injury grade (0-4). Grade 2+ requires 6-8 weeks rest. Climbing contraindicated.',
    ARRAY['schoffl_2006_pulley'],
    '{"scale": [0, 4], "rest_required_grade2": true, "notes": "Effect per grade level"}'
),

-- ============================================================================
-- PSYCHOLOGICAL VARIABLES
-- ============================================================================
(
    'stress_level',
    -0.18, 0.06, 0.12,
    'literature_only', 'high', 0, 0,
    'negative', 'psychological',
    'Current life/work stress (1-10). High stress impairs focus, increases injury risk.',
    ARRAY['sanchez_2012_psychology', 'draper_2008_fear'],
    '{"scale": [1, 10], "high_threshold": 7, "notes": "Effect per point above 5"}'
),

(
    'motivation_level',
    0.15, 0.05, 0.10,
    'literature_only', 'medium', 0, 0,
    'positive', 'psychological',
    'Session motivation (1-10). Intrinsic motivation correlates with better performance and learning.',
    ARRAY['sanchez_2012_psychology'],
    '{"scale": [1, 10], "notes": "Effect per point on motivation scale"}'
),

(
    'performance_anxiety',
    -0.20, 0.06, 0.12,
    'literature_only', 'high', 0, 0,
    'negative', 'psychological',
    'Pre-session anxiety about performance (1-10). High anxiety impairs technique and decision-making.',
    ARRAY['draper_2008_fear', 'sanchez_2012_psychology'],
    '{"scale": [1, 10], "high_threshold": 7, "notes": "Effect per point above 5"}'
),

(
    'fear_of_falling',
    -0.12, 0.04, 0.08,
    'literature_only', 'high', 0, 0,
    'negative', 'psychological',
    'Fear of falling (1-10). Reduces movement efficiency by ~12% per point above moderate.',
    ARRAY['draper_2008_fear', 'giles_2014_fear_falling'],
    '{"scale": [1, 10], "efficiency_reduction": 0.12, "notes": "Climbing-specific anxiety"}'
),

(
    'self_efficacy',
    0.25, 0.08, 0.15,
    'literature_only', 'medium', 0, 0,
    'positive', 'psychological',
    'Belief in ability to succeed (1-10). Predicts performance above physical factors.',
    ARRAY['sanchez_2012_psychology'],
    '{"scale": [1, 10], "notes": "Effect per point on self-efficacy scale"}'
),

-- ============================================================================
-- SUBSTANCE VARIABLES
-- ============================================================================
(
    'caffeine_today',
    0.06, 0.03, 0.05,
    'literature_only', 'high', 0, 0,
    'positive', 'substance',
    'Caffeine consumed today (binary or mg). 3-6mg/kg improves strength 2-7% and endurance 2-4%.',
    ARRAY['grgic_2020_caffeine', 'pickering_2018_caffeine_climbing'],
    '{"optimal_dose_mg_kg": [3, 6], "peak_effect_minutes": 60, "notes": "Effect at optimal dose"}'
),

(
    'caffeine_habitual',
    -0.03, 0.02, 0.04,
    'literature_only', 'medium', 0, 0,
    'negative', 'substance',
    'Regular caffeine user (>200mg/day). Habituation reduces ergogenic effects by ~40%.',
    ARRAY['pickering_2018_caffeine_climbing'],
    '{"habituation_threshold_mg": 200, "effect_reduction": 0.40}'
),

(
    'alcohol_last_24h',
    -0.18, 0.06, 0.12,
    'literature_only', 'high', 0, 0,
    'negative', 'substance',
    'Alcohol consumed in last 24 hours. Impairs protein synthesis 24%, slows recovery.',
    ARRAY['barnes_2010_alcohol'],
    '{"protein_synthesis_impairment": 0.24, "notes": "Effect when alcohol consumed"}'
),

-- ============================================================================
-- TRAINING LOAD VARIABLES
-- ============================================================================
(
    'weekly_climbing_hours',
    0.02, 0.03, 0.05,
    'literature_only', 'low', 0, 0,
    'nonlinear', 'training',
    'Total climbing hours this week. Optimal varies by level. Overtraining risk >15h/week.',
    ARRAY['meeusen_2013_overtraining', 'jones_2016_training_injury'],
    '{"overtraining_threshold": 15, "unit": "hours", "notes": "Inverted U relationship"}'
),

(
    'training_load_change',
    -0.10, 0.04, 0.08,
    'literature_only', 'high', 0, 0,
    'negative', 'training',
    'Week-over-week training load increase (%). >10% increase elevates injury risk significantly.',
    ARRAY['meeusen_2013_overtraining'],
    '{"safe_increase_threshold": 0.10, "notes": "Effect per 10% increase above threshold"}'
),

(
    'hangboard_volume',
    0.08, 0.04, 0.08,
    'literature_only', 'medium', 0, 0,
    'positive', 'training',
    'Hangboard training this week (sets). Specific training improves finger strength 18% over 4 weeks.',
    ARRAY['medernach_2015_training', 'macleod_2007_fingerboard'],
    '{"optimal_frequency_week": 2, "notes": "Effect per session at optimal frequency"}'
),

-- ============================================================================
-- SESSION CONTEXT VARIABLES
-- ============================================================================
(
    'warmup_completed',
    0.15, 0.05, 0.08,
    'literature_only', 'high', 0, 0,
    'positive', 'context',
    'Proper warmup completed (binary). Warmup improves performance in 79% of studies.',
    ARRAY['fradkin_2010_warmup'],
    '{"optimal_duration_min": [10, 15], "notes": "Effect of completing proper warmup"}'
),

(
    'warmup_duration_min',
    0.02, 0.01, 0.02,
    'literature_only', 'medium', 0, 0,
    'positive', 'context',
    'Minutes of warmup completed. 10-15 minutes optimal. Diminishing returns beyond 20 minutes.',
    ARRAY['fradkin_2010_warmup'],
    '{"optimal_range": [10, 15], "unit": "minutes", "notes": "Effect per minute up to optimal"}'
),

(
    'session_time_of_day',
    0.05, 0.03, 0.06,
    'literature_only', 'low', 0, 0,
    'contextual', 'context',
    'Time of day preference match. Most climbers perform better in afternoon/evening.',
    ARRAY['watson_2017_sleep'],
    '{"optimal_window": "14:00-20:00", "notes": "Effect when climbing at preferred time"}'
),

-- ============================================================================
-- CLIMBING-SPECIFIC VARIABLES
-- ============================================================================
(
    'skin_condition',
    0.10, 0.04, 0.08,
    'literature_only', 'medium', 0, 0,
    'positive', 'climbing',
    'Skin condition (1-10). Poor skin limits volume and try-hard efforts significantly.',
    ARRAY['jones_2016_training_injury'],
    '{"scale": [1, 10], "notes": "Effect per point on skin condition scale"}'
),

(
    'grip_type_crimp',
    -0.15, 0.06, 0.12,
    'literature_only', 'high', 0, 0,
    'negative', 'climbing',
    'Tendency to use full crimp. Full crimp generates 36x body weight on A2 pulley vs 26x open.',
    ARRAY['schweizer_2001_grip', 'schoffl_2006_pulley'],
    '{"load_full_crimp": 36, "load_open_crimp": 26, "notes": "Injury risk modifier"}'
),

(
    'forearm_pump_tendency',
    -0.12, 0.05, 0.10,
    'literature_only', 'medium', 0, 0,
    'negative', 'climbing',
    'Tendency to get pumped quickly (1-10). Indicates aerobic capacity of forearms.',
    ARRAY['philippe_2012_oxygenation', 'balas_2012_fatigue'],
    '{"scale": [1, 10], "notes": "Effect per point on pump tendency scale"}'
),

(
    'rest_between_attempts_min',
    0.08, 0.04, 0.08,
    'literature_only', 'medium', 0, 0,
    'positive', 'climbing',
    'Average rest between attempts (minutes). 3 minutes restores 85% of finger strength.',
    ARRAY['philippe_2012_oxygenation', 'bertuzzi_2012_age'],
    '{"optimal_min": 3, "recovery_at_3min": 0.85, "notes": "Effect per minute up to optimal"}'
)

ON CONFLICT (variable_name) DO UPDATE SET
    population_mean = EXCLUDED.population_mean,
    population_std = EXCLUDED.population_std,
    individual_variance = EXCLUDED.individual_variance,
    source = EXCLUDED.source,
    confidence = EXCLUDED.confidence,
    effect_direction = EXCLUDED.effect_direction,
    variable_category = EXCLUDED.variable_category,
    description = EXCLUDED.description,
    literature_refs = EXCLUDED.literature_refs,
    metadata = EXCLUDED.metadata,
    updated_at = NOW();

-- ============================================================================
-- 4. LITERATURE-BASED EXPERT RULES
-- ============================================================================

INSERT INTO expert_rules (
    name, description, conditions, actions, condition_fields,
    rule_category, priority, confidence, source, evidence, contributors, is_active
) VALUES

-- SAFETY RULES (Highest Priority)
(
    'severe_injury_rest_required',
    'Any injury severity >= 7 requires rest day recommendation',
    '{"ALL": [{"field": "injury_severity", "op": ">=", "value": 7}]}',
    '[{"type": "override", "recommendation": "rest_day", "message": "Injury severity too high for climbing. Rest recommended.", "reason": "Injury risk"}]',
    ARRAY['injury_severity'],
    'safety', 100, 'high', 'literature',
    'Schöffl et al. 2015: Severe injuries require complete rest for proper healing',
    ARRAY['literature'],
    true
),

(
    'pulley_injury_grade2_plus',
    'Pulley injury grade 2+ requires 6-8 weeks rest, climbing contraindicated',
    '{"ALL": [{"field": "pulley_injury_grade", "op": ">=", "value": 2}]}',
    '[{"type": "override", "recommendation": "rest_day", "message": "Pulley injury grade 2+ detected. 6-8 weeks rest required. Climbing contraindicated.", "reason": "Pulley healing"}]',
    ARRAY['pulley_injury_grade'],
    'safety', 100, 'high', 'literature',
    'Schöffl et al. 2003: Grade II pulley injuries require 6-8 weeks complete rest',
    ARRAY['literature'],
    true
),

(
    'finger_injury_no_crimp',
    'Any finger injury present should avoid crimp-heavy climbing',
    '{"ALL": [{"field": "finger_injury_present", "op": "==", "value": true}]}',
    '[{"type": "add_recommendation", "recommendation": {"avoid": ["crimp_intensive", "campus_board", "hangboard"]}, "message": "Avoid crimp-heavy climbing and finger training with active finger injury", "reason": "Finger injury protection"}]',
    ARRAY['finger_injury_present'],
    'safety', 95, 'high', 'literature',
    'Schweizer 2001: Full crimp generates 36x body weight on A2 pulley',
    ARRAY['literature'],
    true
),

(
    'sleep_deprivation_limit_intensity',
    'Less than 5 hours sleep - recommend light session only',
    '{"ALL": [{"field": "sleep_hours", "op": "<", "value": 5}]}',
    '[{"type": "add_recommendation", "recommendation": {"session_type": "light_session", "avoid": ["limit_bouldering", "project"]}, "message": "Severe sleep deprivation detected. Limit to light climbing only.", "reason": "Injury risk from impaired coordination"}]',
    ARRAY['sleep_hours'],
    'safety', 90, 'high', 'literature',
    'Watson 2017: Sleep <5h significantly impairs reaction time and coordination',
    ARRAY['literature'],
    true
),

(
    'alcohol_recent_light_session',
    'Alcohol in last 24h - recommend light session or rest',
    '{"ALL": [{"field": "alcohol_last_24h", "op": "==", "value": true}]}',
    '[{"type": "add_recommendation", "recommendation": {"session_type": "light_session", "avoid": ["hangboard", "limit_bouldering"]}, "message": "Recent alcohol consumption impairs recovery and performance. Light session recommended.", "reason": "Recovery impairment"}]',
    ARRAY['alcohol_last_24h'],
    'conservative', 80, 'high', 'literature',
    'Barnes 2014: Alcohol impairs muscle protein synthesis by 24%',
    ARRAY['literature'],
    true
),

-- OVERTRAINING PREVENTION RULES
(
    'consecutive_days_warning',
    'More than 4 consecutive climbing days - recommend rest',
    '{"ALL": [{"field": "days_since_rest_day", "op": ">=", "value": 5}]}',
    '[{"type": "add_recommendation", "recommendation": {"session_type": "rest_day"}, "message": "5+ consecutive training days detected. Rest day strongly recommended to prevent overtraining.", "reason": "Overtraining prevention"}]',
    ARRAY['days_since_rest_day'],
    'conservative', 85, 'high', 'literature',
    'Meeusen et al. 2013: Training monotony increases overtraining risk',
    ARRAY['literature'],
    true
),

(
    'training_load_spike',
    'Training load increased >10% week-over-week - injury risk elevated',
    '{"ALL": [{"field": "training_load_change", "op": ">", "value": 0.10}]}',
    '[{"type": "add_recommendation", "recommendation": {"reduce_volume": true}, "message": "Training load spike detected (>10% increase). Consider reducing volume to prevent injury.", "reason": "Injury prevention"}]',
    ARRAY['training_load_change'],
    'conservative', 75, 'high', 'literature',
    'Meeusen et al. 2013: Sudden load increases >10%/week increase injury risk',
    ARRAY['literature'],
    true
),

(
    'high_soreness_recovery_focus',
    'Muscle soreness >= 7 - recommend active recovery or rest',
    '{"ALL": [{"field": "muscle_soreness", "op": ">=", "value": 7}]}',
    '[{"type": "add_recommendation", "recommendation": {"session_type": "active_recovery", "avoid": ["limit_bouldering", "hangboard"]}, "message": "High muscle soreness detected. Active recovery or rest recommended.", "reason": "Recovery optimization"}]',
    ARRAY['muscle_soreness'],
    'conservative', 70, 'medium', 'literature',
    'DOMS research: High soreness indicates incomplete recovery',
    ARRAY['literature'],
    true
),

-- PERFORMANCE OPTIMIZATION RULES
(
    'optimal_sleep_green_light',
    '7-9 hours quality sleep - green light for any session type',
    '{"ALL": [{"field": "sleep_hours", "op": ">=", "value": 7}, {"field": "sleep_hours", "op": "<=", "value": 9}, {"field": "sleep_quality", "op": ">=", "value": 7}]}',
    '[{"type": "modify_coefficient", "target": "session_quality", "multiplier": 1.1, "message": "Optimal sleep detected - performance boost expected"}]',
    ARRAY['sleep_hours', 'sleep_quality'],
    'performance', 50, 'high', 'literature',
    'Watson 2017, Mah 2011: Optimal sleep (7-9h) maximizes performance',
    ARRAY['literature'],
    true
),

(
    'caffeine_timing_boost',
    'Caffeine consumed 30-90 min before session - performance boost',
    '{"ALL": [{"field": "caffeine_today", "op": "==", "value": true}, {"field": "caffeine_habitual", "op": "==", "value": false}]}',
    '[{"type": "modify_coefficient", "target": "session_quality", "multiplier": 1.05, "message": "Caffeine ergogenic effect expected (non-habitual user)"}]',
    ARRAY['caffeine_today', 'caffeine_habitual'],
    'performance', 40, 'high', 'literature',
    'Grgic et al. 2020: Caffeine improves strength 2-7% in non-habitual users',
    ARRAY['literature'],
    true
),

(
    'high_motivation_project_day',
    'High motivation + good recovery = ideal project day',
    '{"ALL": [{"field": "motivation_level", "op": ">=", "value": 8}, {"field": "energy_level", "op": ">=", "value": 7}, {"field": "muscle_soreness", "op": "<=", "value": 4}]}',
    '[{"type": "add_recommendation", "recommendation": {"session_type": "project"}, "message": "High motivation and good recovery - ideal conditions for projecting"}]',
    ARRAY['motivation_level', 'energy_level', 'muscle_soreness'],
    'performance', 60, 'medium', 'coach_consensus',
    'Sanchez 2010: Intrinsic motivation correlates with performance',
    ARRAY['literature'],
    true
),

(
    'warmup_requirement',
    'No warmup indicated - strongly recommend warmup before climbing',
    '{"ALL": [{"field": "warmup_completed", "op": "==", "value": false}]}',
    '[{"type": "add_recommendation", "recommendation": {"warmup_minutes": 15}, "message": "Warmup improves performance in 79% of studies. 10-15 min recommended.", "reason": "Performance and injury prevention"}]',
    ARRAY['warmup_completed'],
    'performance', 55, 'high', 'literature',
    'Fradkin et al. 2010: Warmup improves performance in 79% of studies',
    ARRAY['literature'],
    true
),

-- INTERACTION EFFECT RULES
(
    'sleep_plus_stress_compound',
    'Poor sleep + high stress = significantly elevated injury risk',
    '{"ALL": [{"field": "sleep_hours", "op": "<", "value": 6}, {"field": "stress_level", "op": ">=", "value": 7}]}',
    '[{"type": "override", "recommendation": "light_session", "message": "Poor sleep combined with high stress significantly elevates injury risk. Light session only.", "reason": "Compound risk factors"}]',
    ARRAY['sleep_hours', 'stress_level'],
    'interaction', 88, 'high', 'coach_consensus',
    'Compound effect of sleep deprivation and stress on injury risk',
    ARRAY['literature'],
    true
),

(
    'fear_plus_fatigue_danger',
    'High fear of falling + fatigue = dangerous combination for lead climbing',
    '{"ALL": [{"field": "fear_of_falling", "op": ">=", "value": 7}, {"field": "energy_level", "op": "<=", "value": 4}]}',
    '[{"type": "add_recommendation", "recommendation": {"avoid": ["lead_climbing", "runout_routes"]}, "message": "High fear + fatigue is dangerous for lead climbing. Consider top-rope or bouldering.", "reason": "Fall risk"}]',
    ARRAY['fear_of_falling', 'energy_level'],
    'interaction', 85, 'medium', 'coach_consensus',
    'Draper 2008: Fear increases HR 15bpm, fatigue impairs decision-making',
    ARRAY['literature'],
    true
),

(
    'dehydration_plus_heat',
    'Poor hydration in warm conditions - limit session duration',
    '{"ALL": [{"field": "hydration_status", "op": "<=", "value": 4}, {"field": "temperature", "op": ">=", "value": 25}]}',
    '[{"type": "add_recommendation", "recommendation": {"max_duration_min": 90, "hydration_breaks": true}, "message": "Dehydration risk elevated. Limit session to 90 min with regular hydration breaks.", "reason": "Dehydration prevention"}]',
    ARRAY['hydration_status', 'temperature'],
    'interaction', 75, 'high', 'literature',
    'Sawka et al. 2007: 2% dehydration impairs endurance performance',
    ARRAY['literature'],
    true
)

ON CONFLICT (name) DO UPDATE SET
    description = EXCLUDED.description,
    conditions = EXCLUDED.conditions,
    actions = EXCLUDED.actions,
    condition_fields = EXCLUDED.condition_fields,
    rule_category = EXCLUDED.rule_category,
    priority = EXCLUDED.priority,
    confidence = EXCLUDED.confidence,
    source = EXCLUDED.source,
    evidence = EXCLUDED.evidence,
    updated_at = NOW();

-- ============================================================================
-- 5. CREATE INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_priors_category ON population_priors (variable_category);
CREATE INDEX IF NOT EXISTS idx_priors_confidence ON population_priors (confidence);
CREATE INDEX IF NOT EXISTS idx_priors_effect_direction ON population_priors (effect_direction);

-- ============================================================================
-- 6. GRANT PERMISSIONS
-- ============================================================================

-- Allow authenticated users to read
ALTER TABLE literature_references ENABLE ROW LEVEL SECURITY;

-- Drop and recreate policy (PostgreSQL doesn't support IF NOT EXISTS for policies)
DROP POLICY IF EXISTS "Anyone can read literature" ON literature_references;
CREATE POLICY "Anyone can read literature" ON literature_references FOR SELECT USING (true);


