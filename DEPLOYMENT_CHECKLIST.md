# ClimbIQ Deployment Checklist

## Overview of Architecture Changes

This document outlines the deployment steps for the updated ClimbIQ architecture, optimized for **efficiency, scalability, and low latency**.

---

## 🚀 Performance Architecture

### Latency Optimization Strategy

| Component | Strategy | Latency Target |
|-----------|----------|----------------|
| **Rules Check** | In-memory cache (5 min TTL) | <10ms |
| **Model Prediction** | Pre-computed coefficients in DB | <20ms |
| **Statistical Context** | Computed on-demand, simple math | <30ms |
| **SSE Streaming** | Phased delivery, no blocking | <100ms to first event |
| **Full Bayesian Training** | Nightly batch via Dagster | N/A (background) |

### Data Flow

```
User Request → Rules (cached) → Model (cached coefficients) → SSE Stream
                    ↓
              If Override → Return immediately (fastest path)
```

---

## 📋 Pre-Deployment Checklist

### 1. Database Migration

```bash
# Run the new migration in Supabase
supabase db push
# Or manually run:
# supabase/migrations/20251206000000_architecture_alignment.sql
```

**Tables Added:**
- `baseline_assessments` - User profiles
- `model_outputs` - Per-user trained coefficients

**Columns Added to `climbing_sessions`:**
- `session_quality` (key outcome variable)
- `deviated_from_plan`, `actual_*` columns (deviation tracking)

### 2. Backend Deployment (Railway/Render/etc.)

```bash
# Build and deploy the FastAPI service
# The following new files are included:
# - app/services/statistical_context.py
# - app/api/routes/recommendations/streaming.py
# - app/config/literature_priors.py
# - app/config/edge_cases.py
```

**No new services needed** - the existing FastAPI service handles everything.

### 3. Dagster Pipeline Deployment

```bash
# Deploy Dagster with new assets
cd backend/dagster_pipeline
docker build -t climbiq-dagster .
```

**New Assets:**
- `training_data` - Loads session data for training
- `trained_model` - Hierarchical Bayesian model
- `population_statistics` - Population-level stats

**New Jobs:**
- `nightly_training_job` - Full model training (2 AM UTC)
- `user_model_training_job` - On-demand training

**New Sensors:**
- `nightly_training_sensor` - Triggers at 2 AM UTC
- `session_completion_sensor` - Triggers on new completed sessions

### 4. Celery Workers (Optional Update)

The worker now does **quick incremental updates** after session completion:
- Uses cached population priors
- Fast shrinkage-based coefficient update
- Full Bayesian training happens nightly

---

## ⚡ Performance Optimizations Implemented

### 1. Caching Strategy

```python
# In-memory caching with TTL (already implemented)
RULES_CACHE_TTL_SECONDS: 300      # 5 minutes
PRIORS_CACHE_TTL_SECONDS: 600     # 10 minutes  
MODEL_CACHE_TTL_SECONDS: 1800     # 30 minutes
```

### 2. Pre-computed Coefficients

User coefficients are stored in `model_outputs` table:
- **Cold Start (<10 sessions)**: Use population priors directly
- **Learning (10-30 sessions)**: Blended coefficients with shrinkage
- **Personalized (30+ sessions)**: Individual coefficients dominate

No ML inference at request time = **fast predictions**.

### 3. Rules-First Architecture

```
1. Check rules (cached, <10ms)
2. If rule fires → Return immediately (skip model)
3. Else → Compute prediction from stored coefficients
```

### 4. SSE Streaming

Phased delivery reduces perceived latency:
```
Event 1: context_loaded      (instant)
Event 2: prediction          (instant)  
Event 3: recommendations     (instant)
Event 4: stats               (instant)
Event 5: done                (instant)
```

---

## 📊 Environment Variables

Add these to your deployment environment:

```env
# Already required
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
REDIS_URL=

# Optional - Performance tuning
RULES_CACHE_TTL_SECONDS=300
PRIORS_CACHE_TTL_SECONDS=600
MODEL_CACHE_TTL_SECONDS=1800

# For Dagster
DAGSTER_HOME=/app/dagster_home
```

---

## 🔍 Verification Steps

### 1. Test Streaming Endpoint

```bash
curl -X POST "https://your-api.com/api/v1/recommendations/pre-session/stream" \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -d '{
    "user_id": "uuid-here",
    "sleep_hours": 7,
    "energy_level": 4,
    "stress_level": 2
  }'
```

### 2. Verify Rules Are Cached

Check logs for:
```
[ENGINE] Cache refreshed: X priors, Y rules
```

### 3. Verify Dagster Jobs

In Dagster UI:
- Check `nightly_training_sensor` is running
- Manually trigger `nightly_training_job` to test

### 4. Verify Model Outputs

```sql
SELECT user_id, phase, sessions_included, last_trained_at 
FROM model_outputs 
LIMIT 10;
```

---

## 🚨 Rollback Plan

If issues occur:

1. **API Issues**: The streaming endpoint is additive - old `/recommendations/generate` still works
2. **Model Issues**: System falls back to population priors if user model unavailable
3. **Dagster Issues**: Manual job triggering available, sensors can be paused

---

## 📈 Scalability Notes

### Current Architecture Supports:

- **1000s of concurrent users**: Stateless API, cached rules/priors
- **Millions of sessions**: PostgreSQL with proper indexes
- **Sub-100ms predictions**: Pre-computed coefficients, no inference

### Future Scaling Options:

1. **Redis for model cache**: Currently using DB, can move to Redis for faster reads
2. **Read replicas**: Supabase supports read replicas for heavy read workloads
3. **Edge caching**: Population priors can be cached at CDN edge

---

## ✅ Deployment Summary

| Step | Service | Action |
|------|---------|--------|
| 1 | Supabase | Run migration |
| 2 | Backend API | Deploy (includes new endpoints) |
| 3 | Dagster | Deploy (includes training pipeline) |
| 4 | Celery | Optional - update for quick model updates |

**No new services to deploy** - all changes are to existing services.

