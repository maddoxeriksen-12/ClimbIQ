export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      climbing_sessions: {
        Row: {
          id: string
          user_id: string
          goal_id: string | null
          session_type: string
          location: string | null
          is_outdoor: boolean | null
          started_at: string
          ended_at: string | null
          planned_duration_minutes: number | null
          actual_duration_minutes: number | null
          status: string | null
          pre_session_data: Json | null
          post_session_data: Json | null
          energy_level: number | null
          motivation: number | null
          sleep_quality: number | null
          stress_level: number | null
          session_rpe: number | null
          satisfaction: number | null
          highest_grade_sent: string | null
          highest_grade_attempted: string | null
          total_climbs: number | null
          total_sends: number | null
          flash_count: number | null
          had_pain_before: boolean | null
          had_pain_after: boolean | null
          pain_location: string | null
          pain_severity: number | null
          notes: string | null
          created_at: string | null
          updated_at: string | null
          
          // Additional fields that might be in the JSONB but accessed directly in some queries
          sleep_hours?: number | null
          hours_since_meal?: string | null
          hydration?: string | null
          days_since_last_session?: number | null
          days_since_rest_day?: number | null
          muscle_soreness?: string | null
          soreness_locations?: string[] | null
          had_caffeine?: boolean | null
          caffeine_amount?: string | null
          had_alcohol?: boolean | null
          alcohol_amount?: string | null
          primary_goal?: string | null
          session_focus?: string | null
          gym_name?: string | null
          crag_name?: string | null
          rock_type?: string | null
          conditions_rating?: number | null
          temperature?: string | null
          humidity?: string | null
          recent_precipitation?: boolean | null
          is_project_session?: boolean | null
          project_name?: string | null
          project_session_number?: number | null
          current_high_point?: string | null
          project_goal?: string | null
          section_focus?: string | null
          training_focus?: string[] | null
          planned_exercises?: string | null
          target_training_time?: number | null
          belay_type?: string | null
          actual_vs_planned?: string | null
          end_energy?: number | null
          skin_condition?: string | null
          felt_pumped_out?: boolean | null
          could_have_done_more?: string | null
          skipped_planned_climbs?: boolean | null
          attempted_harder?: boolean | null
          one_more_try_count?: number | null
          moved_toward_goal?: string | null
          total_attempts?: number | null
          highest_point_reached?: string | null
          matched_high_point?: boolean | null
          linked_more_moves?: boolean | null
          sent_project?: boolean | null
          send_attempts?: number | null
          fall_location?: string | null
          same_crux?: boolean | null
          crux_type?: string | null
          limiting_factors?: string[] | null
          beta_changes?: string | null
          routes_attempted?: number | null
          total_pitches?: number | null
          onsight_rate?: number | null
          falls_count?: number | null
          fall_types?: string[] | null
          longest_route?: string | null
          rest_time_between_routes?: number | null
          head_game_falls?: number | null
          backed_off_due_to_fear?: boolean | null
          conditions_vs_expected?: string | null
          skin_lasted?: boolean | null
          conditions_affected_performance?: string | null
          rock_quality?: string | null
          had_fun?: boolean | null
          standout_moments?: string | null
          exercises_completed?: Json[] | null
          training_quality?: number | null
          progressed_or_regressed?: string | null
          prs_achieved?: string[] | null
          climbs_log?: Json[] | null
        }
        Insert: {
          id?: string
          user_id: string
          goal_id?: string | null
          session_type: string
          location?: string | null
          is_outdoor?: boolean | null
          started_at: string
          ended_at?: string | null
          planned_duration_minutes?: number | null
          actual_duration_minutes?: number | null
          status?: string | null
          pre_session_data?: Json | null
          post_session_data?: Json | null
          energy_level?: number | null
          motivation?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          session_rpe?: number | null
          satisfaction?: number | null
          highest_grade_sent?: string | null
          highest_grade_attempted?: string | null
          total_climbs?: number | null
          total_sends?: number | null
          flash_count?: number | null
          had_pain_before?: boolean | null
          had_pain_after?: boolean | null
          pain_location?: string | null
          pain_severity?: number | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          
          // Extended fields
          sleep_hours?: number | null
          hours_since_meal?: string | null
          hydration?: string | null
          days_since_last_session?: number | null
          days_since_rest_day?: number | null
          muscle_soreness?: string | null
          soreness_locations?: string[] | null
          had_caffeine?: boolean | null
          caffeine_amount?: string | null
          had_alcohol?: boolean | null
          alcohol_amount?: string | null
          primary_goal?: string | null
          session_focus?: string | null
          gym_name?: string | null
          crag_name?: string | null
          rock_type?: string | null
          conditions_rating?: number | null
          temperature?: string | null
          humidity?: string | null
          recent_precipitation?: boolean | null
          is_project_session?: boolean | null
          project_name?: string | null
          project_session_number?: number | null
          current_high_point?: string | null
          project_goal?: string | null
          section_focus?: string | null
          training_focus?: string[] | null
          planned_exercises?: string | null
          target_training_time?: number | null
          belay_type?: string | null
          actual_vs_planned?: string | null
          end_energy?: number | null
          skin_condition?: string | null
          felt_pumped_out?: boolean | null
          could_have_done_more?: string | null
          skipped_planned_climbs?: boolean | null
          attempted_harder?: boolean | null
          one_more_try_count?: number | null
          moved_toward_goal?: string | null
          total_attempts?: number | null
          highest_point_reached?: string | null
          matched_high_point?: boolean | null
          linked_more_moves?: boolean | null
          sent_project?: boolean | null
          send_attempts?: number | null
          fall_location?: string | null
          same_crux?: boolean | null
          crux_type?: string | null
          limiting_factors?: string[] | null
          beta_changes?: string | null
          routes_attempted?: number | null
          total_pitches?: number | null
          onsight_rate?: number | null
          falls_count?: number | null
          fall_types?: string[] | null
          longest_route?: string | null
          rest_time_between_routes?: number | null
          head_game_falls?: number | null
          backed_off_due_to_fear?: boolean | null
          conditions_vs_expected?: string | null
          skin_lasted?: boolean | null
          conditions_affected_performance?: string | null
          rock_quality?: string | null
          had_fun?: boolean | null
          standout_moments?: string | null
          exercises_completed?: Json[] | null
          training_quality?: number | null
          progressed_or_regressed?: string | null
          prs_achieved?: string[] | null
          climbs_log?: Json[] | null
        }
        Update: {
          id?: string
          user_id?: string
          goal_id?: string | null
          session_type?: string
          location?: string | null
          is_outdoor?: boolean | null
          started_at?: string
          ended_at?: string | null
          planned_duration_minutes?: number | null
          actual_duration_minutes?: number | null
          status?: string | null
          pre_session_data?: Json | null
          post_session_data?: Json | null
          energy_level?: number | null
          motivation?: number | null
          sleep_quality?: number | null
          stress_level?: number | null
          session_rpe?: number | null
          satisfaction?: number | null
          highest_grade_sent?: string | null
          highest_grade_attempted?: string | null
          total_climbs?: number | null
          total_sends?: number | null
          flash_count?: number | null
          had_pain_before?: boolean | null
          had_pain_after?: boolean | null
          pain_location?: string | null
          pain_severity?: number | null
          notes?: string | null
          created_at?: string | null
          updated_at?: string | null
          
          // Extended fields
          sleep_hours?: number | null
          hours_since_meal?: string | null
          hydration?: string | null
          days_since_last_session?: number | null
          days_since_rest_day?: number | null
          muscle_soreness?: string | null
          soreness_locations?: string[] | null
          had_caffeine?: boolean | null
          caffeine_amount?: string | null
          had_alcohol?: boolean | null
          alcohol_amount?: string | null
          primary_goal?: string | null
          session_focus?: string | null
          gym_name?: string | null
          crag_name?: string | null
          rock_type?: string | null
          conditions_rating?: number | null
          temperature?: string | null
          humidity?: string | null
          recent_precipitation?: boolean | null
          is_project_session?: boolean | null
          project_name?: string | null
          project_session_number?: number | null
          current_high_point?: string | null
          project_goal?: string | null
          section_focus?: string | null
          training_focus?: string[] | null
          planned_exercises?: string | null
          target_training_time?: number | null
          belay_type?: string | null
          actual_vs_planned?: string | null
          end_energy?: number | null
          skin_condition?: string | null
          felt_pumped_out?: boolean | null
          could_have_done_more?: string | null
          skipped_planned_climbs?: boolean | null
          attempted_harder?: boolean | null
          one_more_try_count?: number | null
          moved_toward_goal?: string | null
          total_attempts?: number | null
          highest_point_reached?: string | null
          matched_high_point?: boolean | null
          linked_more_moves?: boolean | null
          sent_project?: boolean | null
          send_attempts?: number | null
          fall_location?: string | null
          same_crux?: boolean | null
          crux_type?: string | null
          limiting_factors?: string[] | null
          beta_changes?: string | null
          routes_attempted?: number | null
          total_pitches?: number | null
          onsight_rate?: number | null
          falls_count?: number | null
          fall_types?: string[] | null
          longest_route?: string | null
          rest_time_between_routes?: number | null
          head_game_falls?: number | null
          backed_off_due_to_fear?: boolean | null
          conditions_vs_expected?: string | null
          skin_lasted?: boolean | null
          conditions_affected_performance?: string | null
          rock_quality?: string | null
          had_fun?: boolean | null
          standout_moments?: string | null
          exercises_completed?: Json[] | null
          training_quality?: number | null
          progressed_or_regressed?: string | null
          prs_achieved?: string[] | null
          climbs_log?: Json[] | null
        }
      }
      pre_session_data: {
        Row: {
          id: string
          session_id: string
          user_id: string
          created_at: string | null
          updated_at: string | null
          session_environment: string | null
          planned_duration: number | null
          partner_status: string | null
          crowdedness: number | null
          sleep_quality: number | null
          sleep_hours: number | null
          stress_level: number | null
          fueling_status: string | null
          hydration_feel: string | null
          skin_condition: string | null
          finger_tendon_health: number | null
          doms_locations: string[] | null
          doms_severity: number | null
          menstrual_phase: string | null
          motivation: number | null
          primary_goal: string | null
          warmup_rpe: string | null
          warmup_compliance: string | null
          upper_body_power: number | null
          shoulder_integrity: number | null
          leg_springiness: number | null
          finger_strength: number | null
          readiness_score: number | null
          recovery_status: string | null
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          created_at?: string | null
          updated_at?: string | null
          session_environment?: string | null
          planned_duration?: number | null
          partner_status?: string | null
          crowdedness?: number | null
          sleep_quality?: number | null
          sleep_hours?: number | null
          stress_level?: number | null
          fueling_status?: string | null
          hydration_feel?: string | null
          skin_condition?: string | null
          finger_tendon_health?: number | null
          doms_locations?: string[] | null
          doms_severity?: number | null
          menstrual_phase?: string | null
          motivation?: number | null
          primary_goal?: string | null
          warmup_rpe?: string | null
          warmup_compliance?: string | null
          upper_body_power?: number | null
          shoulder_integrity?: number | null
          leg_springiness?: number | null
          finger_strength?: number | null
          readiness_score?: number | null
          recovery_status?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          created_at?: string | null
          updated_at?: string | null
          session_environment?: string | null
          planned_duration?: number | null
          partner_status?: string | null
          crowdedness?: number | null
          sleep_quality?: number | null
          sleep_hours?: number | null
          stress_level?: number | null
          fueling_status?: string | null
          hydration_feel?: string | null
          skin_condition?: string | null
          finger_tendon_health?: number | null
          doms_locations?: string[] | null
          doms_severity?: number | null
          menstrual_phase?: string | null
          motivation?: number | null
          primary_goal?: string | null
          warmup_rpe?: string | null
          warmup_compliance?: string | null
          upper_body_power?: number | null
          shoulder_integrity?: number | null
          leg_springiness?: number | null
          finger_strength?: number | null
          readiness_score?: number | null
          recovery_status?: string | null
        }
      }
      post_session_data: {
        Row: {
          id: string
          session_id: string
          user_id: string
          created_at: string | null
          updated_at: string | null
          hardest_grade_sent: string | null
          hardest_grade_attempted: string | null
          volume_estimation: string | null
          strength_metrics: Json | null
          dominant_style: string | null
          rpe: number | null
          session_density: string | null
          intra_session_fueling: string | null
          limiting_factors: string[] | null
          flash_pump: boolean | null
          new_pain_location: string | null
          new_pain_severity: number | null
          fingers_stiffer_than_usual: boolean | null
          skin_status_post: string | null
          doms_severity_post: number | null
          finger_power_post: number | null
          shoulder_mobility_post: number | null
          prediction_error: number | null
          session_quality_score: number | null
          fatigue_delta: number | null
          performance_vs_expected: string | null
        }
        Insert: {
          id?: string
          session_id: string
          user_id: string
          created_at?: string | null
          updated_at?: string | null
          hardest_grade_sent?: string | null
          hardest_grade_attempted?: string | null
          volume_estimation?: string | null
          strength_metrics?: Json | null
          dominant_style?: string | null
          rpe?: number | null
          session_density?: string | null
          intra_session_fueling?: string | null
          limiting_factors?: string[] | null
          flash_pump?: boolean | null
          new_pain_location?: string | null
          new_pain_severity?: number | null
          fingers_stiffer_than_usual?: boolean | null
          skin_status_post?: string | null
          doms_severity_post?: number | null
          finger_power_post?: number | null
          shoulder_mobility_post?: number | null
          prediction_error?: number | null
          session_quality_score?: number | null
          fatigue_delta?: number | null
          performance_vs_expected?: string | null
        }
        Update: {
          id?: string
          session_id?: string
          user_id?: string
          created_at?: string | null
          updated_at?: string | null
          hardest_grade_sent?: string | null
          hardest_grade_attempted?: string | null
          volume_estimation?: string | null
          strength_metrics?: Json | null
          dominant_style?: string | null
          rpe?: number | null
          session_density?: string | null
          intra_session_fueling?: string | null
          limiting_factors?: string[] | null
          flash_pump?: boolean | null
          new_pain_location?: string | null
          new_pain_severity?: number | null
          fingers_stiffer_than_usual?: boolean | null
          skin_status_post?: string | null
          doms_severity_post?: number | null
          finger_power_post?: number | null
          shoulder_mobility_post?: number | null
          prediction_error?: number | null
          session_quality_score?: number | null
          fatigue_delta?: number | null
          performance_vs_expected?: string | null
        }
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          role: string | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id: string
          full_name?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          full_name?: string | null
          role?: string | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      climbing_goals: {
        Row: {
          id: string
          user_id: string
          type: string
          title: string
          description: string | null
          target_date: string | null
          start_date: string | null
          target_grade: string | null
          project_name: string | null
          competition_name: string | null
          custom_details: string | null
          is_active: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          user_id: string
          type: string
          title: string
          description?: string | null
          target_date?: string | null
          start_date?: string | null
          target_grade?: string | null
          project_name?: string | null
          competition_name?: string | null
          custom_details?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          user_id?: string
          type?: string
          title?: string
          description?: string | null
          target_date?: string | null
          start_date?: string | null
          target_grade?: string | null
          project_name?: string | null
          competition_name?: string | null
          custom_details?: string | null
          is_active?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      expert_scenario_responses: {
        Row: {
          id: string
          scenario_id: string
          expert_id: string
          predicted_quality_optimal: number | null
          predicted_quality_baseline: number | null
          prediction_confidence: string | null
          recommended_session_type: string | null
          session_type_confidence: string | null
          treatment_recommendations: Json
          counterfactuals: Json | null
          key_drivers: Json | null
          interaction_effects: Json | null
          session_structure: Json | null
          reasoning: string | null
          agrees_with_ai: string | null
          response_duration_sec: number | null
          is_complete: boolean | null
          created_at: string | null
          updated_at: string | null
        }
        Insert: {
          id?: string
          scenario_id: string
          expert_id: string
          predicted_quality_optimal?: number | null
          predicted_quality_baseline?: number | null
          prediction_confidence?: string | null
          recommended_session_type?: string | null
          session_type_confidence?: string | null
          treatment_recommendations?: Json
          counterfactuals?: Json | null
          key_drivers?: Json | null
          interaction_effects?: Json | null
          session_structure?: Json | null
          reasoning?: string | null
          agrees_with_ai?: string | null
          response_duration_sec?: number | null
          is_complete?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
        Update: {
          id?: string
          scenario_id?: string
          expert_id?: string
          predicted_quality_optimal?: number | null
          predicted_quality_baseline?: number | null
          prediction_confidence?: string | null
          recommended_session_type?: string | null
          session_type_confidence?: string | null
          treatment_recommendations?: Json
          counterfactuals?: Json | null
          key_drivers?: Json | null
          interaction_effects?: Json | null
          session_structure?: Json | null
          reasoning?: string | null
          agrees_with_ai?: string | null
          response_duration_sec?: number | null
          is_complete?: boolean | null
          created_at?: string | null
          updated_at?: string | null
        }
      }
      expert_rules: {
        Row: {
          id: string
          name: string
          description: string | null
          conditions: Json
          actions: Json
          condition_fields: string[] | null
          rule_category: string
          priority: number
          confidence: string | null
          is_active: boolean | null
          source: string
          evidence: string | null
          contributors: string[] | null
          source_scenario_id: string | null
          review_session_id: string | null
          created_at: string | null
          updated_at: string | null
          created_by: string | null
          expires_at: string | null
          superseded_by: string | null
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          conditions: Json
          actions: Json
          condition_fields?: string[] | null
          rule_category: string
          priority?: number
          confidence?: string | null
          is_active?: boolean | null
          source: string
          evidence?: string | null
          contributors?: string[] | null
          source_scenario_id?: string | null
          review_session_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          superseded_by?: string | null
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          conditions?: Json
          actions?: Json
          condition_fields?: string[] | null
          rule_category?: string
          priority?: number
          confidence?: string | null
          is_active?: boolean | null
          source?: string
          evidence?: string | null
          contributors?: string[] | null
          source_scenario_id?: string | null
          review_session_id?: string | null
          created_at?: string | null
          updated_at?: string | null
          created_by?: string | null
          expires_at?: string | null
          superseded_by?: string | null
        }
      }
      synthetic_scenarios: {
        Row: {
          id: string
          baseline_snapshot: Json
          pre_session_snapshot: Json
          scenario_description: string | null
          edge_case_tags: string[] | null
          difficulty_level: string | null
          ai_recommendation: Json | null
          ai_reasoning: string | null
          status: string | null
          assigned_reviewers: string[] | null
          consensus_recommendation: Json | null
          converted_to_rule_id: string | null
          generated_at: string | null
          generation_batch: string | null
          reviewed_at: string | null
          review_session_id: string | null
        }
        Insert: {
          id?: string
          baseline_snapshot: Json
          pre_session_snapshot: Json
          scenario_description?: string | null
          edge_case_tags?: string[] | null
          difficulty_level?: string | null
          ai_recommendation?: Json | null
          ai_reasoning?: string | null
          status?: string | null
          assigned_reviewers?: string[] | null
          consensus_recommendation?: Json | null
          converted_to_rule_id?: string | null
          generated_at?: string | null
          generation_batch?: string | null
          reviewed_at?: string | null
          review_session_id?: string | null
        }
        Update: {
          id?: string
          baseline_snapshot?: Json
          pre_session_snapshot?: Json
          scenario_description?: string | null
          edge_case_tags?: string[] | null
          difficulty_level?: string | null
          ai_recommendation?: Json | null
          ai_reasoning?: string | null
          status?: string | null
          assigned_reviewers?: string[] | null
          consensus_recommendation?: Json | null
          converted_to_rule_id?: string | null
          generated_at?: string | null
          generation_batch?: string | null
          reviewed_at?: string | null
          review_session_id?: string | null
        }
      }
      rule_audit_log: {
        Row: {
          id: string
          rule_id: string | null
          action: string
          changed_by: string
          previous_state: Json | null
          new_state: Json | null
          reason: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          rule_id?: string | null
          action: string
          changed_by: string
          previous_state?: Json | null
          new_state?: Json | null
          reason?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          rule_id?: string | null
          action?: string
          changed_by?: string
          previous_state?: Json | null
          new_state?: Json | null
          reason?: string | null
          created_at?: string | null
        }
      }
      rule_review_sessions: {
        Row: {
          id: string
          session_date: string
          session_name: string | null
          participants: string[]
          scenarios_reviewed: number | null
          rules_created: number | null
          rules_modified: number | null
          notes: string | null
          status: string | null
          created_at: string | null
          completed_at: string | null
        }
        Insert: {
          id?: string
          session_date: string
          session_name?: string | null
          participants: string[]
          scenarios_reviewed?: number | null
          rules_created?: number | null
          rules_modified?: number | null
          notes?: string | null
          status?: string | null
          created_at?: string | null
          completed_at?: string | null
        }
        Update: {
          id?: string
          session_date?: string
          session_name?: string | null
          participants?: string[]
          scenarios_reviewed?: number | null
          rules_created?: number | null
          rules_modified?: number | null
          notes?: string | null
          status?: string | null
          created_at?: string | null
          completed_at?: string | null
        }
      }
      scenario_consensus: {
        Row: {
          id: string
          scenario_id: string
          consensus_quality_optimal: number | null
          consensus_quality_baseline: number | null
          consensus_session_type: string | null
          consensus_treatments: Json | null
          coefficient_signals: Json | null
          expert_agreement_score: number | null
          n_experts: number | null
          disputed_factors: string[] | null
          processed_into_priors: boolean | null
          processed_at: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          scenario_id: string
          consensus_quality_optimal?: number | null
          consensus_quality_baseline?: number | null
          consensus_session_type?: string | null
          consensus_treatments?: Json | null
          coefficient_signals?: Json | null
          expert_agreement_score?: number | null
          n_experts?: number | null
          disputed_factors?: string[] | null
          processed_into_priors?: boolean | null
          processed_at?: string | null
          created_at?: string | null
        }
        Update: {
          id?: string
          scenario_id?: string
          consensus_quality_optimal?: number | null
          consensus_quality_baseline?: number | null
          consensus_session_type?: string | null
          consensus_treatments?: Json | null
          coefficient_signals?: Json | null
          expert_agreement_score?: number | null
          n_experts?: number | null
          disputed_factors?: string[] | null
          processed_into_priors?: boolean | null
          processed_at?: string | null
          created_at?: string | null
        }
      }
    }
    Views: Record<string, never>
    Functions: Record<string, never>
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
