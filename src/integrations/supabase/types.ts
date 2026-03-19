export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      app_settings: {
        Row: {
          description: string | null
          id: string
          is_internal: boolean
          key: string
          updated_at: string
          updated_by: string | null
          value: Json
        }
        Insert: {
          description?: string | null
          id?: string
          is_internal?: boolean
          key: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Update: {
          description?: string | null
          id?: string
          is_internal?: boolean
          key?: string
          updated_at?: string
          updated_by?: string | null
          value?: Json
        }
        Relationships: []
      }
      applications: {
        Row: {
          applicant_id: string
          applied_at: string
          company_research: Json | null
          cover_letter: string | null
          employer_notes: string | null
          follow_up_date: string | null
          id: string
          job_id: string
          match_score: number | null
          reminder_sent: boolean | null
          resume_url: string | null
          seeker_notes: string | null
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          viewed_at: string | null
        }
        Insert: {
          applicant_id: string
          applied_at?: string
          company_research?: Json | null
          cover_letter?: string | null
          employer_notes?: string | null
          follow_up_date?: string | null
          id?: string
          job_id: string
          match_score?: number | null
          reminder_sent?: boolean | null
          resume_url?: string | null
          seeker_notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          viewed_at?: string | null
        }
        Update: {
          applicant_id?: string
          applied_at?: string
          company_research?: Json | null
          cover_letter?: string | null
          employer_notes?: string | null
          follow_up_date?: string | null
          id?: string
          job_id?: string
          match_score?: number | null
          reminder_sent?: boolean | null
          resume_url?: string | null
          seeker_notes?: string | null
          status?: Database["public"]["Enums"]["application_status"]
          updated_at?: string
          viewed_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "applications_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      blog_ai_audit_log: {
        Row: {
          after_value: string
          apply_mode: string
          before_value: string
          created_at: string
          id: string
          slug: string | null
          target_field: string | null
          timestamp: string
          tool_name: string
        }
        Insert: {
          after_value?: string
          apply_mode?: string
          before_value?: string
          created_at?: string
          id?: string
          slug?: string | null
          target_field?: string | null
          timestamp?: string
          tool_name: string
        }
        Update: {
          after_value?: string
          apply_mode?: string
          before_value?: string
          created_at?: string
          id?: string
          slug?: string | null
          target_field?: string | null
          timestamp?: string
          tool_name?: string
        }
        Relationships: []
      }
      blog_ai_telemetry: {
        Row: {
          action: string | null
          apply_mode: string | null
          category: string | null
          created_at: string
          error_message: string | null
          event_name: string
          id: string
          item_count: number | null
          slug: string | null
          status: string | null
          tags: string[] | null
          target: string | null
          timestamp: string
          tool_name: string
        }
        Insert: {
          action?: string | null
          apply_mode?: string | null
          category?: string | null
          created_at?: string
          error_message?: string | null
          event_name: string
          id?: string
          item_count?: number | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          target?: string | null
          timestamp?: string
          tool_name: string
        }
        Update: {
          action?: string | null
          apply_mode?: string | null
          category?: string | null
          created_at?: string
          error_message?: string | null
          event_name?: string
          id?: string
          item_count?: number | null
          slug?: string | null
          status?: string | null
          tags?: string[] | null
          target?: string | null
          timestamp?: string
          tool_name?: string
        }
        Relationships: []
      }
      blog_bulk_workflow_sessions: {
        Row: {
          ai_model: string | null
          completed_at: string | null
          execution_results: Json | null
          id: string
          last_heartbeat_at: string
          max_articles_per_run: number
          progress: Json | null
          scan_report: Json | null
          started_at: string
          started_by: string
          status: string
          stop_requested: boolean
          workflow_type: string
        }
        Insert: {
          ai_model?: string | null
          completed_at?: string | null
          execution_results?: Json | null
          id?: string
          last_heartbeat_at?: string
          max_articles_per_run?: number
          progress?: Json | null
          scan_report?: Json | null
          started_at?: string
          started_by: string
          status?: string
          stop_requested?: boolean
          workflow_type: string
        }
        Update: {
          ai_model?: string | null
          completed_at?: string | null
          execution_results?: Json | null
          id?: string
          last_heartbeat_at?: string
          max_articles_per_run?: number
          progress?: Json | null
          scan_report?: Json | null
          started_at?: string
          started_by?: string
          status?: string
          stop_requested?: boolean
          workflow_type?: string
        }
        Relationships: []
      }
      blog_posts: {
        Row: {
          ai_fixed_at: string | null
          article_images: Json | null
          author_id: string
          author_name: string | null
          canonical_url: string | null
          category: string | null
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          faq_count: number | null
          faq_schema: Json | null
          featured_image_alt: string | null
          has_faq_schema: boolean | null
          id: string
          internal_links: Json | null
          is_published: boolean
          language: string | null
          meta_description: string | null
          meta_title: string | null
          published_at: string | null
          reading_time: number | null
          scheduled_at: string | null
          schema_json: string | null
          slug: string
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          word_count: number | null
        }
        Insert: {
          ai_fixed_at?: string | null
          article_images?: Json | null
          author_id: string
          author_name?: string | null
          canonical_url?: string | null
          category?: string | null
          content: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          faq_count?: number | null
          faq_schema?: Json | null
          featured_image_alt?: string | null
          has_faq_schema?: boolean | null
          id?: string
          internal_links?: Json | null
          is_published?: boolean
          language?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          schema_json?: string | null
          slug: string
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          ai_fixed_at?: string | null
          article_images?: Json | null
          author_id?: string
          author_name?: string | null
          canonical_url?: string | null
          category?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          faq_count?: number | null
          faq_schema?: Json | null
          featured_image_alt?: string | null
          has_faq_schema?: boolean | null
          id?: string
          internal_links?: Json | null
          is_published?: boolean
          language?: string | null
          meta_description?: string | null
          meta_title?: string | null
          published_at?: string | null
          reading_time?: number | null
          scheduled_at?: string | null
          schema_json?: string | null
          slug?: string
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          word_count?: number | null
        }
        Relationships: []
      }
      board_result_batch_rows: {
        Row: {
          batch_id: string
          board_abbr: string
          board_name: string
          content: string | null
          created_at: string
          delete_reason: string | null
          deleted_at: string | null
          deleted_by: string | null
          display_title: string | null
          duplicate_count: number
          duplicate_status: string
          enriched_content: Json | null
          error_message: string | null
          excerpt: string | null
          faq_schema: Json | null
          generated_page_id: string | null
          generation_status: string
          id: string
          is_valid: boolean
          meta_description: string | null
          meta_title: string | null
          official_board_url: string
          published_at: string | null
          published_page_id: string | null
          qa_notes: string[] | null
          quality_score: number | null
          result_url: string
          row_index: number
          seo_fixes: Json | null
          seo_intro_text: string | null
          slug: string
          source_payload: Json
          state_ut: string
          tags: string[] | null
          top_duplicate_reason: string | null
          updated_at: string
          validation_errors: string[] | null
          validation_status: string
          variant: string
          word_count: number | null
          workflow_status: string
        }
        Insert: {
          batch_id: string
          board_abbr?: string
          board_name: string
          content?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          display_title?: string | null
          duplicate_count?: number
          duplicate_status?: string
          enriched_content?: Json | null
          error_message?: string | null
          excerpt?: string | null
          faq_schema?: Json | null
          generated_page_id?: string | null
          generation_status?: string
          id?: string
          is_valid?: boolean
          meta_description?: string | null
          meta_title?: string | null
          official_board_url?: string
          published_at?: string | null
          published_page_id?: string | null
          qa_notes?: string[] | null
          quality_score?: number | null
          result_url?: string
          row_index: number
          seo_fixes?: Json | null
          seo_intro_text?: string | null
          slug: string
          source_payload?: Json
          state_ut: string
          tags?: string[] | null
          top_duplicate_reason?: string | null
          updated_at?: string
          validation_errors?: string[] | null
          validation_status?: string
          variant?: string
          word_count?: number | null
          workflow_status?: string
        }
        Update: {
          batch_id?: string
          board_abbr?: string
          board_name?: string
          content?: string | null
          created_at?: string
          delete_reason?: string | null
          deleted_at?: string | null
          deleted_by?: string | null
          display_title?: string | null
          duplicate_count?: number
          duplicate_status?: string
          enriched_content?: Json | null
          error_message?: string | null
          excerpt?: string | null
          faq_schema?: Json | null
          generated_page_id?: string | null
          generation_status?: string
          id?: string
          is_valid?: boolean
          meta_description?: string | null
          meta_title?: string | null
          official_board_url?: string
          published_at?: string | null
          published_page_id?: string | null
          qa_notes?: string[] | null
          quality_score?: number | null
          result_url?: string
          row_index?: number
          seo_fixes?: Json | null
          seo_intro_text?: string | null
          slug?: string
          source_payload?: Json
          state_ut?: string
          tags?: string[] | null
          top_duplicate_reason?: string | null
          updated_at?: string
          validation_errors?: string[] | null
          validation_status?: string
          variant?: string
          word_count?: number | null
          workflow_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "board_result_batch_rows_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_result_batch_rows_generated_page_id_fkey"
            columns: ["generated_page_id"]
            isOneToOne: false
            referencedRelation: "custom_pages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "board_result_batch_rows_published_page_id_fkey"
            columns: ["published_page_id"]
            isOneToOne: false
            referencedRelation: "custom_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      campaign_enrollments: {
        Row: {
          created_at: string
          email: string
          experience: string
          full_name: string
          id: string
          job_role: string | null
          phone: string
          preferred_location: string | null
          skills: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email: string
          experience: string
          full_name: string
          id?: string
          job_role?: string | null
          phone: string
          preferred_location?: string | null
          skills?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string
          experience?: string
          full_name?: string
          id?: string
          job_role?: string | null
          phone?: string
          preferred_location?: string | null
          skills?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      chatbot_analytics: {
        Row: {
          created_at: string | null
          id: string
          intent: string | null
          ip_hash: string | null
          query_language: string | null
          query_text: string | null
          refusal_reason: string | null
          response_time_ms: number | null
          retrieval_count: number | null
          retrieval_status: string | null
          session_id: string
          was_refused: boolean | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          intent?: string | null
          ip_hash?: string | null
          query_language?: string | null
          query_text?: string | null
          refusal_reason?: string | null
          response_time_ms?: number | null
          retrieval_count?: number | null
          retrieval_status?: string | null
          session_id: string
          was_refused?: boolean | null
        }
        Update: {
          created_at?: string | null
          id?: string
          intent?: string | null
          ip_hash?: string | null
          query_language?: string | null
          query_text?: string | null
          refusal_reason?: string | null
          response_time_ms?: number | null
          retrieval_count?: number | null
          retrieval_status?: string | null
          session_id?: string
          was_refused?: boolean | null
        }
        Relationships: []
      }
      companies: {
        Row: {
          auto_approve_jobs: boolean | null
          company_size: string | null
          cover_image_url: string | null
          created_at: string
          current_plan_id: string | null
          description: string | null
          founded_year: number | null
          id: string
          industry: string | null
          is_approved: boolean | null
          is_verified: boolean | null
          linkedin_url: string | null
          location: string | null
          logo_url: string | null
          name: string
          owner_id: string
          plan_expires_at: string | null
          slug: string
          updated_at: string
          website_url: string | null
        }
        Insert: {
          auto_approve_jobs?: boolean | null
          company_size?: string | null
          cover_image_url?: string | null
          created_at?: string
          current_plan_id?: string | null
          description?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          is_approved?: boolean | null
          is_verified?: boolean | null
          linkedin_url?: string | null
          location?: string | null
          logo_url?: string | null
          name: string
          owner_id: string
          plan_expires_at?: string | null
          slug: string
          updated_at?: string
          website_url?: string | null
        }
        Update: {
          auto_approve_jobs?: boolean | null
          company_size?: string | null
          cover_image_url?: string | null
          created_at?: string
          current_plan_id?: string | null
          description?: string | null
          founded_year?: number | null
          id?: string
          industry?: string | null
          is_approved?: boolean | null
          is_verified?: boolean | null
          linkedin_url?: string | null
          location?: string | null
          logo_url?: string | null
          name?: string
          owner_id?: string
          plan_expires_at?: string | null
          slug?: string
          updated_at?: string
          website_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "companies_current_plan_id_fkey"
            columns: ["current_plan_id"]
            isOneToOne: false
            referencedRelation: "job_posting_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      content_enrichments: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          created_at: string
          current_section_count: number | null
          current_word_count: number | null
          enrichment_data: Json
          failure_reason: string | null
          flags: string[] | null
          id: string
          internal_links_added: string[] | null
          page_slug: string
          page_type: string
          published_at: string | null
          quality_score: Json | null
          review_notes: string | null
          sections_added: string[] | null
          status: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_section_count?: number | null
          current_word_count?: number | null
          enrichment_data?: Json
          failure_reason?: string | null
          flags?: string[] | null
          id?: string
          internal_links_added?: string[] | null
          page_slug: string
          page_type: string
          published_at?: string | null
          quality_score?: Json | null
          review_notes?: string | null
          sections_added?: string[] | null
          status?: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          current_section_count?: number | null
          current_word_count?: number | null
          enrichment_data?: Json
          failure_reason?: string | null
          flags?: string[] | null
          id?: string
          internal_links_added?: string[] | null
          page_slug?: string
          page_type?: string
          published_at?: string | null
          quality_score?: Json | null
          review_notes?: string | null
          sections_added?: string[] | null
          status?: string
          updated_at?: string
          version?: number
        }
        Relationships: []
      }
      contest_entries: {
        Row: {
          contest_id: string
          created_at: string
          id: string
          is_winner: boolean | null
          score: number | null
          submission_text: string | null
          submission_url: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          contest_id: string
          created_at?: string
          id?: string
          is_winner?: boolean | null
          score?: number | null
          submission_text?: string | null
          submission_url?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          contest_id?: string
          created_at?: string
          id?: string
          is_winner?: boolean | null
          score?: number | null
          submission_text?: string | null
          submission_url?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "contest_entries_contest_id_fkey"
            columns: ["contest_id"]
            isOneToOne: false
            referencedRelation: "contests"
            referencedColumns: ["id"]
          },
        ]
      }
      contests: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_results_public: boolean
          max_entries: number | null
          prizes: string | null
          results_shared_at: string | null
          rules: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["engagement_status"]
          target_audience: Database["public"]["Enums"]["target_audience"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_results_public?: boolean
          max_entries?: number | null
          prizes?: string | null
          results_shared_at?: string | null
          rules?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_results_public?: boolean
          max_entries?: number | null
          prizes?: string | null
          results_shared_at?: string | null
          rules?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_pages: {
        Row: {
          ai_generated_at: string | null
          ai_model_used: string | null
          author_id: string
          board_name: string | null
          canonical_url: string | null
          category: string | null
          content: string
          cover_image_url: string | null
          created_at: string
          excerpt: string | null
          faq_schema: Json | null
          featured_image_alt: string | null
          generation_metadata: Json | null
          id: string
          import_batch_id: string | null
          internal_links: Json | null
          is_published: boolean | null
          language: string | null
          meta_description: string | null
          meta_title: string | null
          official_board_url: string | null
          page_type: string | null
          published_at: string | null
          qa_notes: string[] | null
          reading_time: number | null
          result_url: string | null
          result_variant: string | null
          schema_json: string | null
          slug: string
          source_payload: Json | null
          source_row_index: number | null
          state_ut: string | null
          status: string | null
          tags: string[] | null
          title: string
          updated_at: string
          word_count: number | null
        }
        Insert: {
          ai_generated_at?: string | null
          ai_model_used?: string | null
          author_id: string
          board_name?: string | null
          canonical_url?: string | null
          category?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          faq_schema?: Json | null
          featured_image_alt?: string | null
          generation_metadata?: Json | null
          id?: string
          import_batch_id?: string | null
          internal_links?: Json | null
          is_published?: boolean | null
          language?: string | null
          meta_description?: string | null
          meta_title?: string | null
          official_board_url?: string | null
          page_type?: string | null
          published_at?: string | null
          qa_notes?: string[] | null
          reading_time?: number | null
          result_url?: string | null
          result_variant?: string | null
          schema_json?: string | null
          slug: string
          source_payload?: Json | null
          source_row_index?: number | null
          state_ut?: string | null
          status?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string
          word_count?: number | null
        }
        Update: {
          ai_generated_at?: string | null
          ai_model_used?: string | null
          author_id?: string
          board_name?: string | null
          canonical_url?: string | null
          category?: string | null
          content?: string
          cover_image_url?: string | null
          created_at?: string
          excerpt?: string | null
          faq_schema?: Json | null
          featured_image_alt?: string | null
          generation_metadata?: Json | null
          id?: string
          import_batch_id?: string | null
          internal_links?: Json | null
          is_published?: boolean | null
          language?: string | null
          meta_description?: string | null
          meta_title?: string | null
          official_board_url?: string | null
          page_type?: string | null
          published_at?: string | null
          qa_notes?: string[] | null
          reading_time?: number | null
          result_url?: string | null
          result_variant?: string | null
          schema_json?: string | null
          slug?: string
          source_payload?: Json | null
          source_row_index?: number | null
          state_ut?: string | null
          status?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string
          word_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_pages_import_batch_id_fkey"
            columns: ["import_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      duplicate_matches: {
        Row: {
          batch_row_id: string
          confidence: number
          created_at: string
          duplicate_type: string
          id: string
          last_checked_at: string
          matched_batch_row_id: string | null
          matched_custom_page_id: string | null
          matched_slug: string | null
          matched_title: string | null
          matched_url: string | null
          reason: string
          recommended_action: string
        }
        Insert: {
          batch_row_id: string
          confidence?: number
          created_at?: string
          duplicate_type: string
          id?: string
          last_checked_at?: string
          matched_batch_row_id?: string | null
          matched_custom_page_id?: string | null
          matched_slug?: string | null
          matched_title?: string | null
          matched_url?: string | null
          reason: string
          recommended_action?: string
        }
        Update: {
          batch_row_id?: string
          confidence?: number
          created_at?: string
          duplicate_type?: string
          id?: string
          last_checked_at?: string
          matched_batch_row_id?: string | null
          matched_custom_page_id?: string | null
          matched_slug?: string | null
          matched_title?: string | null
          matched_url?: string | null
          reason?: string
          recommended_action?: string
        }
        Relationships: [
          {
            foreignKeyName: "duplicate_matches_batch_row_id_fkey"
            columns: ["batch_row_id"]
            isOneToOne: false
            referencedRelation: "board_result_batch_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_matches_matched_batch_row_id_fkey"
            columns: ["matched_batch_row_id"]
            isOneToOne: false
            referencedRelation: "board_result_batch_rows"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "duplicate_matches_matched_custom_page_id_fkey"
            columns: ["matched_custom_page_id"]
            isOneToOne: false
            referencedRelation: "custom_pages"
            referencedColumns: ["id"]
          },
        ]
      }
      education: {
        Row: {
          created_at: string
          degree: string
          description: string | null
          end_date: string | null
          field_of_study: string | null
          id: string
          institution: string
          is_current: boolean | null
          profile_id: string
          start_date: string | null
        }
        Insert: {
          created_at?: string
          degree: string
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          id?: string
          institution: string
          is_current?: boolean | null
          profile_id: string
          start_date?: string | null
        }
        Update: {
          created_at?: string
          degree?: string
          description?: string | null
          end_date?: string | null
          field_of_study?: string | null
          id?: string
          institution?: string
          is_current?: boolean | null
          profile_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "education_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      email_otp_sessions: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          otp_code: string
          purpose: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          email: string
          expires_at: string
          id?: string
          otp_code: string
          purpose?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          otp_code?: string
          purpose?: string
          verified?: boolean
        }
        Relationships: []
      }
      email_subscribers: {
        Row: {
          created_at: string
          email: string
          frequency: string
          full_name: string | null
          id: string
          is_active: boolean
          job_categories: string[] | null
          preferred_locations: string[] | null
          subscribed_at: string
          unsubscribe_token: string
          unsubscribed_at: string | null
          updated_at: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          email: string
          frequency?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_categories?: string[] | null
          preferred_locations?: string[] | null
          subscribed_at?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          email?: string
          frequency?: string
          full_name?: string | null
          id?: string
          is_active?: boolean
          job_categories?: string[] | null
          preferred_locations?: string[] | null
          subscribed_at?: string
          unsubscribe_token?: string
          unsubscribed_at?: string | null
          updated_at?: string
          verified?: boolean
        }
        Relationships: []
      }
      employment_news_jobs: {
        Row: {
          advertisement_number: string | null
          age_limit: string | null
          application_mode: string | null
          application_start_date: string | null
          apply_link: string | null
          created_at: string
          description: string | null
          enriched_description: string | null
          enriched_title: string | null
          enrichment_attempts: number
          enrichment_error: string | null
          experience_required: string | null
          faq_html: string | null
          id: string
          job_category: string | null
          job_type: string | null
          keywords: string[] | null
          last_date: string | null
          last_date_raw: string | null
          last_date_resolved: string | null
          location: string | null
          meta_description: string | null
          meta_title: string | null
          notification_reference_number: string | null
          org_name: string | null
          post: string | null
          published_at: string | null
          qualification: string | null
          salary: string | null
          schema_markup: Json | null
          slug: string | null
          source: string
          state: string | null
          status: string
          upload_batch_id: string | null
          vacancies: number | null
        }
        Insert: {
          advertisement_number?: string | null
          age_limit?: string | null
          application_mode?: string | null
          application_start_date?: string | null
          apply_link?: string | null
          created_at?: string
          description?: string | null
          enriched_description?: string | null
          enriched_title?: string | null
          enrichment_attempts?: number
          enrichment_error?: string | null
          experience_required?: string | null
          faq_html?: string | null
          id?: string
          job_category?: string | null
          job_type?: string | null
          keywords?: string[] | null
          last_date?: string | null
          last_date_raw?: string | null
          last_date_resolved?: string | null
          location?: string | null
          meta_description?: string | null
          meta_title?: string | null
          notification_reference_number?: string | null
          org_name?: string | null
          post?: string | null
          published_at?: string | null
          qualification?: string | null
          salary?: string | null
          schema_markup?: Json | null
          slug?: string | null
          source?: string
          state?: string | null
          status?: string
          upload_batch_id?: string | null
          vacancies?: number | null
        }
        Update: {
          advertisement_number?: string | null
          age_limit?: string | null
          application_mode?: string | null
          application_start_date?: string | null
          apply_link?: string | null
          created_at?: string
          description?: string | null
          enriched_description?: string | null
          enriched_title?: string | null
          enrichment_attempts?: number
          enrichment_error?: string | null
          experience_required?: string | null
          faq_html?: string | null
          id?: string
          job_category?: string | null
          job_type?: string | null
          keywords?: string[] | null
          last_date?: string | null
          last_date_raw?: string | null
          last_date_resolved?: string | null
          location?: string | null
          meta_description?: string | null
          meta_title?: string | null
          notification_reference_number?: string | null
          org_name?: string | null
          post?: string | null
          published_at?: string | null
          qualification?: string | null
          salary?: string | null
          schema_markup?: Json | null
          slug?: string | null
          source?: string
          state?: string | null
          status?: string
          upload_batch_id?: string | null
          vacancies?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "employment_news_jobs_upload_batch_id_fkey"
            columns: ["upload_batch_id"]
            isOneToOne: false
            referencedRelation: "upload_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      experience: {
        Row: {
          company_name: string
          created_at: string
          description: string | null
          end_date: string | null
          id: string
          is_current: boolean | null
          job_title: string
          location: string | null
          profile_id: string
          start_date: string | null
        }
        Insert: {
          company_name: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_title: string
          location?: string | null
          profile_id: string
          start_date?: string | null
        }
        Update: {
          company_name?: string
          created_at?: string
          description?: string | null
          end_date?: string | null
          id?: string
          is_current?: boolean | null
          job_title?: string
          location?: string | null
          profile_id?: string
          start_date?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "experience_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      govt_admit_cards: {
        Row: {
          created_at: string
          download_link: string | null
          exam_date: string | null
          exam_id: string
          id: string
          instructions: string | null
          release_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_link?: string | null
          exam_date?: string | null
          exam_id: string
          id?: string
          instructions?: string | null
          release_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_link?: string | null
          exam_date?: string | null
          exam_id?: string
          id?: string
          instructions?: string | null
          release_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "govt_admit_cards_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "govt_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      govt_answer_keys: {
        Row: {
          created_at: string
          download_link: string | null
          exam_id: string
          id: string
          objection_deadline: string | null
          objection_link: string | null
          release_date: string | null
          status: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          download_link?: string | null
          exam_id: string
          id?: string
          objection_deadline?: string | null
          objection_link?: string | null
          release_date?: string | null
          status?: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          download_link?: string | null
          exam_id?: string
          id?: string
          objection_deadline?: string | null
          objection_link?: string | null
          release_date?: string | null
          status?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "govt_answer_keys_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "govt_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      govt_exams: {
        Row: {
          admit_card_date: string | null
          age_limit: string | null
          age_relaxation: string | null
          application_end: string | null
          application_fee: string | null
          application_start: string | null
          apply_link: string | null
          conducting_body: string | null
          created_at: string
          department_slug: string | null
          exam_category: string
          exam_date: string | null
          exam_name: string
          exam_pattern: Json | null
          exam_scope: string | null
          exam_year: number | null
          faqs: Json | null
          fee_female: number | null
          fee_gen: number | null
          fee_obc: number | null
          fee_sc: number | null
          fee_st: number | null
          how_to_apply: string | null
          id: string
          important_dates: Json | null
          is_featured: boolean | null
          is_hot: boolean | null
          max_age_exservicemen: number | null
          max_age_gen: number | null
          max_age_obc: number | null
          max_age_ph: number | null
          max_age_scst: number | null
          max_attempts_gen: number | null
          max_attempts_obc: number | null
          max_attempts_scst: number | null
          meta_description: string | null
          meta_title: string | null
          min_age: number | null
          notification_month: number | null
          notification_pdf_url: string | null
          official_notification_url: string | null
          official_website: string | null
          pay_scale: string | null
          posts: Json | null
          published_date: string | null
          qualification_required: string | null
          qualification_tags: string[] | null
          result_date: string | null
          salary_range: string | null
          selection_stages: string | null
          selection_type: string | null
          seo_content: string | null
          seo_keywords: string[] | null
          slug: string
          states: string[] | null
          status: string
          syllabus: Json | null
          total_vacancies: number | null
          updated_at: string
        }
        Insert: {
          admit_card_date?: string | null
          age_limit?: string | null
          age_relaxation?: string | null
          application_end?: string | null
          application_fee?: string | null
          application_start?: string | null
          apply_link?: string | null
          conducting_body?: string | null
          created_at?: string
          department_slug?: string | null
          exam_category?: string
          exam_date?: string | null
          exam_name: string
          exam_pattern?: Json | null
          exam_scope?: string | null
          exam_year?: number | null
          faqs?: Json | null
          fee_female?: number | null
          fee_gen?: number | null
          fee_obc?: number | null
          fee_sc?: number | null
          fee_st?: number | null
          how_to_apply?: string | null
          id?: string
          important_dates?: Json | null
          is_featured?: boolean | null
          is_hot?: boolean | null
          max_age_exservicemen?: number | null
          max_age_gen?: number | null
          max_age_obc?: number | null
          max_age_ph?: number | null
          max_age_scst?: number | null
          max_attempts_gen?: number | null
          max_attempts_obc?: number | null
          max_attempts_scst?: number | null
          meta_description?: string | null
          meta_title?: string | null
          min_age?: number | null
          notification_month?: number | null
          notification_pdf_url?: string | null
          official_notification_url?: string | null
          official_website?: string | null
          pay_scale?: string | null
          posts?: Json | null
          published_date?: string | null
          qualification_required?: string | null
          qualification_tags?: string[] | null
          result_date?: string | null
          salary_range?: string | null
          selection_stages?: string | null
          selection_type?: string | null
          seo_content?: string | null
          seo_keywords?: string[] | null
          slug: string
          states?: string[] | null
          status?: string
          syllabus?: Json | null
          total_vacancies?: number | null
          updated_at?: string
        }
        Update: {
          admit_card_date?: string | null
          age_limit?: string | null
          age_relaxation?: string | null
          application_end?: string | null
          application_fee?: string | null
          application_start?: string | null
          apply_link?: string | null
          conducting_body?: string | null
          created_at?: string
          department_slug?: string | null
          exam_category?: string
          exam_date?: string | null
          exam_name?: string
          exam_pattern?: Json | null
          exam_scope?: string | null
          exam_year?: number | null
          faqs?: Json | null
          fee_female?: number | null
          fee_gen?: number | null
          fee_obc?: number | null
          fee_sc?: number | null
          fee_st?: number | null
          how_to_apply?: string | null
          id?: string
          important_dates?: Json | null
          is_featured?: boolean | null
          is_hot?: boolean | null
          max_age_exservicemen?: number | null
          max_age_gen?: number | null
          max_age_obc?: number | null
          max_age_ph?: number | null
          max_age_scst?: number | null
          max_attempts_gen?: number | null
          max_attempts_obc?: number | null
          max_attempts_scst?: number | null
          meta_description?: string | null
          meta_title?: string | null
          min_age?: number | null
          notification_month?: number | null
          notification_pdf_url?: string | null
          official_notification_url?: string | null
          official_website?: string | null
          pay_scale?: string | null
          posts?: Json | null
          published_date?: string | null
          qualification_required?: string | null
          qualification_tags?: string[] | null
          result_date?: string | null
          salary_range?: string | null
          selection_stages?: string | null
          selection_type?: string | null
          seo_content?: string | null
          seo_keywords?: string[] | null
          slug?: string
          states?: string[] | null
          status?: string
          syllabus?: Json | null
          total_vacancies?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      govt_results: {
        Row: {
          created_at: string
          cutoff_data: Json | null
          exam_id: string
          id: string
          merit_list_url: string | null
          previous_cutoffs: Json | null
          result_date: string | null
          result_link: string | null
          result_title: string
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          cutoff_data?: Json | null
          exam_id: string
          id?: string
          merit_list_url?: string | null
          previous_cutoffs?: Json | null
          result_date?: string | null
          result_link?: string | null
          result_title: string
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          cutoff_data?: Json | null
          exam_id?: string
          id?: string
          merit_list_url?: string | null
          previous_cutoffs?: Json | null
          result_date?: string | null
          result_link?: string | null
          result_title?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "govt_results_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "govt_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          batch_number: number
          completed_at: string | null
          completed_count: number
          created_at: string
          duplicate_count: number
          enriched_count: number
          failed_count: number
          id: string
          published_count: number
          skipped_count: number
          source_file_name: string
          source_file_path: string | null
          started_by: string
          status: string
          total_rows: number
          updated_at: string
        }
        Insert: {
          batch_number?: number
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          duplicate_count?: number
          enriched_count?: number
          failed_count?: number
          id?: string
          published_count?: number
          skipped_count?: number
          source_file_name: string
          source_file_path?: string | null
          started_by: string
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Update: {
          batch_number?: number
          completed_at?: string | null
          completed_count?: number
          created_at?: string
          duplicate_count?: number
          enriched_count?: number
          failed_count?: number
          id?: string
          published_count?: number
          skipped_count?: number
          source_file_name?: string
          source_file_path?: string | null
          started_by?: string
          status?: string
          total_rows?: number
          updated_at?: string
        }
        Relationships: []
      }
      job_posting_drafts: {
        Row: {
          company_id: string
          created_at: string
          current_step: number
          id: string
          job_data: Json
          posted_by: string
          selected_plan_id: string | null
          updated_at: string
        }
        Insert: {
          company_id: string
          created_at?: string
          current_step?: number
          id?: string
          job_data?: Json
          posted_by: string
          selected_plan_id?: string | null
          updated_at?: string
        }
        Update: {
          company_id?: string
          created_at?: string
          current_step?: number
          id?: string
          job_data?: Json
          posted_by?: string
          selected_plan_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "job_posting_drafts_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "job_posting_drafts_selected_plan_id_fkey"
            columns: ["selected_plan_id"]
            isOneToOne: false
            referencedRelation: "job_posting_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      job_posting_plans: {
        Row: {
          created_at: string
          currency: string
          display_order: number
          duration_days: number
          features: Json
          has_priority_placement: boolean
          has_whatsapp_notifications: boolean
          id: string
          is_active: boolean
          is_featured: boolean
          is_urgent_hiring: boolean
          max_applications: number | null
          max_job_posts: number
          name: string
          original_price: number | null
          price: number
          slug: string
          updated_at: string
          visibility_level: string
        }
        Insert: {
          created_at?: string
          currency?: string
          display_order?: number
          duration_days?: number
          features?: Json
          has_priority_placement?: boolean
          has_whatsapp_notifications?: boolean
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_urgent_hiring?: boolean
          max_applications?: number | null
          max_job_posts?: number
          name: string
          original_price?: number | null
          price?: number
          slug: string
          updated_at?: string
          visibility_level?: string
        }
        Update: {
          created_at?: string
          currency?: string
          display_order?: number
          duration_days?: number
          features?: Json
          has_priority_placement?: boolean
          has_whatsapp_notifications?: boolean
          id?: string
          is_active?: boolean
          is_featured?: boolean
          is_urgent_hiring?: boolean
          max_applications?: number | null
          max_job_posts?: number
          name?: string
          original_price?: number | null
          price?: number
          slug?: string
          updated_at?: string
          visibility_level?: string
        }
        Relationships: []
      }
      jobs: {
        Row: {
          admit_card_date: string | null
          advertisement_no: string | null
          age_limit: string | null
          age_relaxation: string | null
          ai_processed_at: string | null
          application_fee: string | null
          applications_count: number | null
          apply_url: string | null
          apply_url_flagged_at: string | null
          approved_at: string | null
          approved_by: string | null
          benefits: string[] | null
          canonical_job_id: string | null
          category_vacancies: Json | null
          city: string | null
          company_id: string | null
          company_name: string | null
          country: string | null
          created_at: string
          description: string
          duplicate_confidence_score: number | null
          duplicate_group_id: string | null
          employment_type: Database["public"]["Enums"]["employment_type"] | null
          enrichment_attempts: number
          exam_date: string | null
          exam_name: string | null
          exam_pattern: string | null
          experience_level: Database["public"]["Enums"]["experience_level"]
          experience_max_years: number | null
          experience_min_years: number | null
          experience_years_max: number | null
          experience_years_min: number | null
          expires_at: string | null
          extraction_confidence: number | null
          government_type: string | null
          id: string
          is_deleted: boolean | null
          is_duplicate: boolean | null
          is_featured: boolean | null
          is_freelance: boolean | null
          is_remote: boolean | null
          is_salary_visible: boolean | null
          is_work_from_home: boolean | null
          job_designation_normalized: string | null
          job_level: Database["public"]["Enums"]["job_level"] | null
          job_opening_date: string | null
          job_role: string | null
          job_sector: string
          job_type: Database["public"]["Enums"]["job_type"]
          last_date_of_application: string | null
          location: string | null
          location_type: Database["public"]["Enums"]["location_type"] | null
          normalized_company: string | null
          normalized_location: string | null
          normalized_title: string | null
          notification_pdf_url: string | null
          official_website: string | null
          organizing_body: string | null
          pay_scale: string | null
          posted_by: string | null
          previous_cutoffs: Json | null
          qualification_required: string | null
          raw_description: string | null
          requirements: string | null
          responsibilities: string | null
          result_date: string | null
          salary_currency: string | null
          salary_max: number | null
          salary_min: number | null
          salary_period: Database["public"]["Enums"]["salary_period"] | null
          selection_stages: string | null
          skills_required: string[] | null
          slug: string
          source: Database["public"]["Enums"]["job_source"]
          source_url: string | null
          source_url_hash: string | null
          state: string | null
          status: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at: string
          views_count: number | null
        }
        Insert: {
          admit_card_date?: string | null
          advertisement_no?: string | null
          age_limit?: string | null
          age_relaxation?: string | null
          ai_processed_at?: string | null
          application_fee?: string | null
          applications_count?: number | null
          apply_url?: string | null
          apply_url_flagged_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          benefits?: string[] | null
          canonical_job_id?: string | null
          category_vacancies?: Json | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          description: string
          duplicate_confidence_score?: number | null
          duplicate_group_id?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          enrichment_attempts?: number
          exam_date?: string | null
          exam_name?: string | null
          exam_pattern?: string | null
          experience_level?: Database["public"]["Enums"]["experience_level"]
          experience_max_years?: number | null
          experience_min_years?: number | null
          experience_years_max?: number | null
          experience_years_min?: number | null
          expires_at?: string | null
          extraction_confidence?: number | null
          government_type?: string | null
          id?: string
          is_deleted?: boolean | null
          is_duplicate?: boolean | null
          is_featured?: boolean | null
          is_freelance?: boolean | null
          is_remote?: boolean | null
          is_salary_visible?: boolean | null
          is_work_from_home?: boolean | null
          job_designation_normalized?: string | null
          job_level?: Database["public"]["Enums"]["job_level"] | null
          job_opening_date?: string | null
          job_role?: string | null
          job_sector?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          last_date_of_application?: string | null
          location?: string | null
          location_type?: Database["public"]["Enums"]["location_type"] | null
          normalized_company?: string | null
          normalized_location?: string | null
          normalized_title?: string | null
          notification_pdf_url?: string | null
          official_website?: string | null
          organizing_body?: string | null
          pay_scale?: string | null
          posted_by?: string | null
          previous_cutoffs?: Json | null
          qualification_required?: string | null
          raw_description?: string | null
          requirements?: string | null
          responsibilities?: string | null
          result_date?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: Database["public"]["Enums"]["salary_period"] | null
          selection_stages?: string | null
          skills_required?: string[] | null
          slug: string
          source?: Database["public"]["Enums"]["job_source"]
          source_url?: string | null
          source_url_hash?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title: string
          updated_at?: string
          views_count?: number | null
        }
        Update: {
          admit_card_date?: string | null
          advertisement_no?: string | null
          age_limit?: string | null
          age_relaxation?: string | null
          ai_processed_at?: string | null
          application_fee?: string | null
          applications_count?: number | null
          apply_url?: string | null
          apply_url_flagged_at?: string | null
          approved_at?: string | null
          approved_by?: string | null
          benefits?: string[] | null
          canonical_job_id?: string | null
          category_vacancies?: Json | null
          city?: string | null
          company_id?: string | null
          company_name?: string | null
          country?: string | null
          created_at?: string
          description?: string
          duplicate_confidence_score?: number | null
          duplicate_group_id?: string | null
          employment_type?:
            | Database["public"]["Enums"]["employment_type"]
            | null
          enrichment_attempts?: number
          exam_date?: string | null
          exam_name?: string | null
          exam_pattern?: string | null
          experience_level?: Database["public"]["Enums"]["experience_level"]
          experience_max_years?: number | null
          experience_min_years?: number | null
          experience_years_max?: number | null
          experience_years_min?: number | null
          expires_at?: string | null
          extraction_confidence?: number | null
          government_type?: string | null
          id?: string
          is_deleted?: boolean | null
          is_duplicate?: boolean | null
          is_featured?: boolean | null
          is_freelance?: boolean | null
          is_remote?: boolean | null
          is_salary_visible?: boolean | null
          is_work_from_home?: boolean | null
          job_designation_normalized?: string | null
          job_level?: Database["public"]["Enums"]["job_level"] | null
          job_opening_date?: string | null
          job_role?: string | null
          job_sector?: string
          job_type?: Database["public"]["Enums"]["job_type"]
          last_date_of_application?: string | null
          location?: string | null
          location_type?: Database["public"]["Enums"]["location_type"] | null
          normalized_company?: string | null
          normalized_location?: string | null
          normalized_title?: string | null
          notification_pdf_url?: string | null
          official_website?: string | null
          organizing_body?: string | null
          pay_scale?: string | null
          posted_by?: string | null
          previous_cutoffs?: Json | null
          qualification_required?: string | null
          raw_description?: string | null
          requirements?: string | null
          responsibilities?: string | null
          result_date?: string | null
          salary_currency?: string | null
          salary_max?: number | null
          salary_min?: number | null
          salary_period?: Database["public"]["Enums"]["salary_period"] | null
          selection_stages?: string | null
          skills_required?: string[] | null
          slug?: string
          source?: Database["public"]["Enums"]["job_source"]
          source_url?: string | null
          source_url_hash?: string | null
          state?: string | null
          status?: Database["public"]["Enums"]["job_status"]
          title?: string
          updated_at?: string
          views_count?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "jobs_company_id_fkey"
            columns: ["company_id"]
            isOneToOne: false
            referencedRelation: "companies"
            referencedColumns: ["id"]
          },
        ]
      }
      monitoring_review_queue: {
        Row: {
          action_decision: string | null
          channel: string
          created_at: string
          display_group: string | null
          id: string
          item_type: string | null
          parsed_payload: Json
          pdf_url: string | null
          primary_domain: string | null
          published_at: string | null
          qa_notes: string | null
          raw_payload: Json
          review_status: string
          reviewed_at: string | null
          source_id: string | null
          source_item_id: string | null
          source_url: string | null
          title: string
          updated_at: string
        }
        Insert: {
          action_decision?: string | null
          channel: string
          created_at?: string
          display_group?: string | null
          id?: string
          item_type?: string | null
          parsed_payload?: Json
          pdf_url?: string | null
          primary_domain?: string | null
          published_at?: string | null
          qa_notes?: string | null
          raw_payload?: Json
          review_status?: string
          reviewed_at?: string | null
          source_id?: string | null
          source_item_id?: string | null
          source_url?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          action_decision?: string | null
          channel?: string
          created_at?: string
          display_group?: string | null
          id?: string
          item_type?: string | null
          parsed_payload?: Json
          pdf_url?: string | null
          primary_domain?: string | null
          published_at?: string | null
          qa_notes?: string | null
          raw_payload?: Json
          review_status?: string
          reviewed_at?: string | null
          source_id?: string | null
          source_item_id?: string | null
          source_url?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          alert_frequency: string
          created_at: string
          email_enabled: boolean
          experience_levels: string[] | null
          id: string
          job_categories: string[] | null
          job_types: string[] | null
          preferred_locations: string[] | null
          push_enabled: boolean
          salary_max: number | null
          salary_min: number | null
          updated_at: string
          user_id: string
        }
        Insert: {
          alert_frequency?: string
          created_at?: string
          email_enabled?: boolean
          experience_levels?: string[] | null
          id?: string
          job_categories?: string[] | null
          job_types?: string[] | null
          preferred_locations?: string[] | null
          push_enabled?: boolean
          salary_max?: number | null
          salary_min?: number | null
          updated_at?: string
          user_id: string
        }
        Update: {
          alert_frequency?: string
          created_at?: string
          email_enabled?: boolean
          experience_levels?: string[] | null
          id?: string
          job_categories?: string[] | null
          job_types?: string[] | null
          preferred_locations?: string[] | null
          push_enabled?: boolean
          salary_max?: number | null
          salary_min?: number | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          is_read: boolean | null
          link: string | null
          message: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message: string
          title: string
          type?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean | null
          link?: string | null
          message?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      otp_sessions: {
        Row: {
          created_at: string
          expires_at: string
          id: string
          phone: string
          purpose: string
          session_id: string
          verified: boolean
        }
        Insert: {
          created_at?: string
          expires_at: string
          id?: string
          phone: string
          purpose: string
          session_id: string
          verified?: boolean
        }
        Update: {
          created_at?: string
          expires_at?: string
          id?: string
          phone?: string
          purpose?: string
          session_id?: string
          verified?: boolean
        }
        Relationships: []
      }
      pdf_resources: {
        Row: {
          ai_generated_at: string | null
          ai_model_used: string | null
          author_id: string
          category: string | null
          content: string
          content_hash: string | null
          cover_image_url: string | null
          created_at: string | null
          cta_click_count: number | null
          download_count: number | null
          download_filename: string | null
          duplicate_approved: boolean | null
          edition_year: number | null
          exam_name: string | null
          exam_year: number | null
          excerpt: string | null
          faq_schema: Json | null
          featured_image_alt: string | null
          file_hash: string | null
          file_size_bytes: number | null
          file_url: string | null
          final_download_count: number | null
          id: string
          image_model_used: string | null
          is_featured: boolean | null
          is_noindex: boolean | null
          is_published: boolean | null
          is_trending: boolean | null
          language: string | null
          meta_description: string | null
          meta_title: string | null
          page_count: number | null
          published_at: string | null
          reading_time: number | null
          resource_type: string
          review_notes: string | null
          slug: string
          status: string | null
          subject: string | null
          tags: string[] | null
          title: string
          updated_at: string | null
          word_count: number | null
        }
        Insert: {
          ai_generated_at?: string | null
          ai_model_used?: string | null
          author_id: string
          category?: string | null
          content?: string
          content_hash?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_click_count?: number | null
          download_count?: number | null
          download_filename?: string | null
          duplicate_approved?: boolean | null
          edition_year?: number | null
          exam_name?: string | null
          exam_year?: number | null
          excerpt?: string | null
          faq_schema?: Json | null
          featured_image_alt?: string | null
          file_hash?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          final_download_count?: number | null
          id?: string
          image_model_used?: string | null
          is_featured?: boolean | null
          is_noindex?: boolean | null
          is_published?: boolean | null
          is_trending?: boolean | null
          language?: string | null
          meta_description?: string | null
          meta_title?: string | null
          page_count?: number | null
          published_at?: string | null
          reading_time?: number | null
          resource_type: string
          review_notes?: string | null
          slug: string
          status?: string | null
          subject?: string | null
          tags?: string[] | null
          title: string
          updated_at?: string | null
          word_count?: number | null
        }
        Update: {
          ai_generated_at?: string | null
          ai_model_used?: string | null
          author_id?: string
          category?: string | null
          content?: string
          content_hash?: string | null
          cover_image_url?: string | null
          created_at?: string | null
          cta_click_count?: number | null
          download_count?: number | null
          download_filename?: string | null
          duplicate_approved?: boolean | null
          edition_year?: number | null
          exam_name?: string | null
          exam_year?: number | null
          excerpt?: string | null
          faq_schema?: Json | null
          featured_image_alt?: string | null
          file_hash?: string | null
          file_size_bytes?: number | null
          file_url?: string | null
          final_download_count?: number | null
          id?: string
          image_model_used?: string | null
          is_featured?: boolean | null
          is_noindex?: boolean | null
          is_published?: boolean | null
          is_trending?: boolean | null
          language?: string | null
          meta_description?: string | null
          meta_title?: string | null
          page_count?: number | null
          published_at?: string | null
          reading_time?: number | null
          resource_type?: string
          review_notes?: string | null
          slug?: string
          status?: string | null
          subject?: string | null
          tags?: string[] | null
          title?: string
          updated_at?: string | null
          word_count?: number | null
        }
        Relationships: []
      }
      poll_options: {
        Row: {
          created_at: string
          display_order: number
          id: string
          option_text: string
          poll_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          option_text: string
          poll_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          option_text?: string
          poll_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_options_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      poll_responses: {
        Row: {
          created_at: string
          id: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          option_id: string
          poll_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          option_id?: string
          poll_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "poll_responses_option_id_fkey"
            columns: ["option_id"]
            isOneToOne: false
            referencedRelation: "poll_options"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "poll_responses_poll_id_fkey"
            columns: ["poll_id"]
            isOneToOne: false
            referencedRelation: "polls"
            referencedColumns: ["id"]
          },
        ]
      }
      polls: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_results_public: boolean
          results_shared_at: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["engagement_status"]
          target_audience: Database["public"]["Enums"]["target_audience"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_results_public?: boolean
          results_shared_at?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_results_public?: boolean
          results_shared_at?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string
          email: string
          expected_salary_max: number | null
          expected_salary_min: number | null
          experience_years: number | null
          full_name: string | null
          github_url: string | null
          headline: string | null
          id: string
          is_active: boolean
          is_available: boolean | null
          language_preference: string | null
          linkedin_url: string | null
          location: string | null
          phone: string | null
          portfolio_url: string | null
          preferred_job_types: Database["public"]["Enums"]["job_type"][] | null
          preferred_locations: string[] | null
          resume_url: string | null
          skills: string[] | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email: string
          expected_salary_max?: number | null
          expected_salary_min?: number | null
          experience_years?: number | null
          full_name?: string | null
          github_url?: string | null
          headline?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean | null
          language_preference?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          portfolio_url?: string | null
          preferred_job_types?: Database["public"]["Enums"]["job_type"][] | null
          preferred_locations?: string[] | null
          resume_url?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string
          email?: string
          expected_salary_max?: number | null
          expected_salary_min?: number | null
          experience_years?: number | null
          full_name?: string | null
          github_url?: string | null
          headline?: string | null
          id?: string
          is_active?: boolean
          is_available?: boolean | null
          language_preference?: string | null
          linkedin_url?: string | null
          location?: string | null
          phone?: string | null
          portfolio_url?: string | null
          preferred_job_types?: Database["public"]["Enums"]["job_type"][] | null
          preferred_locations?: string[] | null
          resume_url?: string | null
          skills?: string[] | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      resource_events: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          referrer: string | null
          resource_id: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          referrer?: string | null
          resource_id: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          referrer?: string | null
          resource_id?: string
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resource_events_resource_id_fkey"
            columns: ["resource_id"]
            isOneToOne: false
            referencedRelation: "pdf_resources"
            referencedColumns: ["id"]
          },
        ]
      }
      restricted_domains: {
        Row: {
          created_at: string
          created_by: string | null
          domain: string
          id: string
          is_active: boolean
          reason: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          domain: string
          id?: string
          is_active?: boolean
          reason?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          domain?: string
          id?: string
          is_active?: boolean
          reason?: string | null
        }
        Relationships: []
      }
      resume_ai_generations: {
        Row: {
          action: string
          created_at: string
          id: string
          request_hash: string
          user_id: string
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          request_hash: string
          user_id: string
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          request_hash?: string
          user_id?: string
        }
        Relationships: []
      }
      rss_ai_processing: {
        Row: {
          analysis_error: string | null
          analysis_model: string | null
          analysis_output: Json | null
          analysis_run_at: string | null
          analysis_status: string
          cover_image_url: string | null
          created_at: string
          enrichment_error: string | null
          enrichment_model: string | null
          enrichment_output: Json | null
          enrichment_run_at: string | null
          enrichment_status: string
          enrichment_word_limit: number | null
          id: string
          image_error: string | null
          image_model: string | null
          image_prompt_used: string | null
          image_run_at: string | null
          image_status: string
          rss_item_id: string
          seo_check_status: string
          seo_error: string | null
          seo_model: string | null
          seo_output: Json | null
          seo_run_at: string | null
          seo_score: number | null
          updated_at: string
        }
        Insert: {
          analysis_error?: string | null
          analysis_model?: string | null
          analysis_output?: Json | null
          analysis_run_at?: string | null
          analysis_status?: string
          cover_image_url?: string | null
          created_at?: string
          enrichment_error?: string | null
          enrichment_model?: string | null
          enrichment_output?: Json | null
          enrichment_run_at?: string | null
          enrichment_status?: string
          enrichment_word_limit?: number | null
          id?: string
          image_error?: string | null
          image_model?: string | null
          image_prompt_used?: string | null
          image_run_at?: string | null
          image_status?: string
          rss_item_id: string
          seo_check_status?: string
          seo_error?: string | null
          seo_model?: string | null
          seo_output?: Json | null
          seo_run_at?: string | null
          seo_score?: number | null
          updated_at?: string
        }
        Update: {
          analysis_error?: string | null
          analysis_model?: string | null
          analysis_output?: Json | null
          analysis_run_at?: string | null
          analysis_status?: string
          cover_image_url?: string | null
          created_at?: string
          enrichment_error?: string | null
          enrichment_model?: string | null
          enrichment_output?: Json | null
          enrichment_run_at?: string | null
          enrichment_status?: string
          enrichment_word_limit?: number | null
          id?: string
          image_error?: string | null
          image_model?: string | null
          image_prompt_used?: string | null
          image_run_at?: string | null
          image_status?: string
          rss_item_id?: string
          seo_check_status?: string
          seo_error?: string | null
          seo_model?: string | null
          seo_output?: Json | null
          seo_run_at?: string | null
          seo_score?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rss_ai_processing_rss_item_id_fkey"
            columns: ["rss_item_id"]
            isOneToOne: true
            referencedRelation: "rss_items"
            referencedColumns: ["id"]
          },
        ]
      }
      rss_fetch_runs: {
        Row: {
          content_type: string | null
          created_at: string
          error_log: string | null
          finished_at: string | null
          http_status: number | null
          id: string
          items_new: number
          items_seen: number
          items_skipped: number
          items_updated: number
          response_meta: Json
          rss_source_id: string
          run_mode: string
          started_at: string
          status: string
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          error_log?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          items_new?: number
          items_seen?: number
          items_skipped?: number
          items_updated?: number
          response_meta?: Json
          rss_source_id: string
          run_mode?: string
          started_at?: string
          status: string
        }
        Update: {
          content_type?: string | null
          created_at?: string
          error_log?: string | null
          finished_at?: string | null
          http_status?: number | null
          id?: string
          items_new?: number
          items_seen?: number
          items_skipped?: number
          items_updated?: number
          response_meta?: Json
          rss_source_id?: string
          run_mode?: string
          started_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "rss_fetch_runs_rss_source_id_fkey"
            columns: ["rss_source_id"]
            isOneToOne: false
            referencedRelation: "rss_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rss_items: {
        Row: {
          author: string | null
          canonical_link: string | null
          categories: string[]
          created_at: string
          current_status: string
          detection_reason: string | null
          display_group: string
          first_pdf_url: string | null
          first_seen_at: string
          id: string
          item_content: string | null
          item_guid: string | null
          item_link: string | null
          item_summary: string | null
          item_title: string
          item_type: string
          last_seen_at: string
          linked_pdf_urls: string[]
          normalized_hash: string
          primary_domain: string
          published_at: string | null
          raw_payload: Json
          relevance_level: string
          rss_source_id: string
          updated_at: string
        }
        Insert: {
          author?: string | null
          canonical_link?: string | null
          categories?: string[]
          created_at?: string
          current_status?: string
          detection_reason?: string | null
          display_group?: string
          first_pdf_url?: string | null
          first_seen_at?: string
          id?: string
          item_content?: string | null
          item_guid?: string | null
          item_link?: string | null
          item_summary?: string | null
          item_title: string
          item_type?: string
          last_seen_at?: string
          linked_pdf_urls?: string[]
          normalized_hash: string
          primary_domain?: string
          published_at?: string | null
          raw_payload?: Json
          relevance_level?: string
          rss_source_id: string
          updated_at?: string
        }
        Update: {
          author?: string | null
          canonical_link?: string | null
          categories?: string[]
          created_at?: string
          current_status?: string
          detection_reason?: string | null
          display_group?: string
          first_pdf_url?: string | null
          first_seen_at?: string
          id?: string
          item_content?: string | null
          item_guid?: string | null
          item_link?: string | null
          item_summary?: string | null
          item_title?: string
          item_type?: string
          last_seen_at?: string
          linked_pdf_urls?: string[]
          normalized_hash?: string
          primary_domain?: string
          published_at?: string | null
          raw_payload?: Json
          relevance_level?: string
          rss_source_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "rss_items_rss_source_id_fkey"
            columns: ["rss_source_id"]
            isOneToOne: false
            referencedRelation: "rss_sources"
            referencedColumns: ["id"]
          },
        ]
      }
      rss_sources: {
        Row: {
          category: string | null
          check_interval_hours: number
          created_at: string
          etag: string | null
          feed_url: string
          fetch_enabled: boolean
          focus: string | null
          id: string
          language: string | null
          last_error: string | null
          last_fetched_at: string | null
          last_modified: string | null
          last_success_at: string | null
          notes: string | null
          official_site: string | null
          priority: string
          source_name: string
          source_type: string
          state_or_scope: string | null
          status: string
          updated_at: string
        }
        Insert: {
          category?: string | null
          check_interval_hours?: number
          created_at?: string
          etag?: string | null
          feed_url: string
          fetch_enabled?: boolean
          focus?: string | null
          id?: string
          language?: string | null
          last_error?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          last_success_at?: string | null
          notes?: string | null
          official_site?: string | null
          priority?: string
          source_name: string
          source_type?: string
          state_or_scope?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          category?: string | null
          check_interval_hours?: number
          created_at?: string
          etag?: string | null
          feed_url?: string
          fetch_enabled?: boolean
          focus?: string | null
          id?: string
          language?: string | null
          last_error?: string | null
          last_fetched_at?: string | null
          last_modified?: string | null
          last_success_at?: string | null
          notes?: string | null
          official_site?: string | null
          priority?: string
          source_name?: string
          source_type?: string
          state_or_scope?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      saved_govt_exams: {
        Row: {
          exam_id: string
          id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          exam_id: string
          id?: string
          saved_at?: string
          user_id: string
        }
        Update: {
          exam_id?: string
          id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_govt_exams_exam_id_fkey"
            columns: ["exam_id"]
            isOneToOne: false
            referencedRelation: "govt_exams"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_jobs: {
        Row: {
          id: string
          job_id: string
          saved_at: string
          user_id: string
        }
        Insert: {
          id?: string
          job_id: string
          saved_at?: string
          user_id: string
        }
        Update: {
          id?: string
          job_id?: string
          saved_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "saved_jobs_job_id_fkey"
            columns: ["job_id"]
            isOneToOne: false
            referencedRelation: "jobs"
            referencedColumns: ["id"]
          },
        ]
      }
      saved_resumes: {
        Row: {
          created_at: string
          custom_skills: string[] | null
          custom_summary: string | null
          id: string
          is_default: boolean | null
          name: string
          score: number | null
          score_details: Json | null
          target_company: string | null
          target_job_title: string | null
          template_style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          custom_skills?: string[] | null
          custom_summary?: string | null
          id?: string
          is_default?: boolean | null
          name: string
          score?: number | null
          score_details?: Json | null
          target_company?: string | null
          target_job_title?: string | null
          template_style?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          custom_skills?: string[] | null
          custom_summary?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          score?: number | null
          score_details?: Json | null
          target_company?: string | null
          target_job_title?: string | null
          template_style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      search_queries: {
        Row: {
          created_at: string
          id: string
          query_text: string
          search_count: number
          source: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          query_text: string
          search_count?: number
          source?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          query_text?: string
          search_count?: number
          source?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      seo_page_cache: {
        Row: {
          body_html: string | null
          content_hash: string | null
          full_html: string
          head_html: string | null
          page_type: string
          slug: string
          updated_at: string
        }
        Insert: {
          body_html?: string | null
          content_hash?: string | null
          full_html: string
          head_html?: string | null
          page_type?: string
          slug: string
          updated_at?: string
        }
        Update: {
          body_html?: string | null
          content_hash?: string | null
          full_html?: string
          head_html?: string | null
          page_type?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      seo_rebuild_log: {
        Row: {
          cf_purged: number
          created_at: string
          duration_ms: number | null
          error_details: Json | null
          id: string
          rebuild_type: string
          slugs_failed: number
          slugs_rebuilt: number
          slugs_requested: number
          slugs_skipped: number
          trigger_source: string | null
        }
        Insert: {
          cf_purged?: number
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          id?: string
          rebuild_type: string
          slugs_failed?: number
          slugs_rebuilt?: number
          slugs_requested?: number
          slugs_skipped?: number
          trigger_source?: string | null
        }
        Update: {
          cf_purged?: number
          created_at?: string
          duration_ms?: number | null
          error_details?: Json | null
          id?: string
          rebuild_type?: string
          slugs_failed?: number
          slugs_rebuilt?: number
          slugs_requested?: number
          slugs_skipped?: number
          trigger_source?: string | null
        }
        Relationships: []
      }
      seo_rebuild_queue: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          last_retry_at: string | null
          max_retries: number
          page_type: string
          processed_at: string | null
          reason: string
          retry_count: number
          slug: string
          status: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          page_type?: string
          processed_at?: string | null
          reason?: string
          retry_count?: number
          slug: string
          status?: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          last_retry_at?: string | null
          max_retries?: number
          page_type?: string
          processed_at?: string | null
          reason?: string
          retry_count?: number
          slug?: string
          status?: string
        }
        Relationships: []
      }
      survey_questions: {
        Row: {
          created_at: string
          display_order: number
          id: string
          is_required: boolean
          options: Json | null
          question_text: string
          question_type: string
          survey_id: string
        }
        Insert: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          options?: Json | null
          question_text: string
          question_type?: string
          survey_id: string
        }
        Update: {
          created_at?: string
          display_order?: number
          id?: string
          is_required?: boolean
          options?: Json | null
          question_text?: string
          question_type?: string
          survey_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_questions_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      survey_responses: {
        Row: {
          answers: Json
          created_at: string
          id: string
          is_paid_out: boolean | null
          paid_at: string | null
          survey_id: string
          user_id: string
        }
        Insert: {
          answers: Json
          created_at?: string
          id?: string
          is_paid_out?: boolean | null
          paid_at?: string | null
          survey_id: string
          user_id: string
        }
        Update: {
          answers?: Json
          created_at?: string
          id?: string
          is_paid_out?: boolean | null
          paid_at?: string | null
          survey_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "survey_responses_survey_id_fkey"
            columns: ["survey_id"]
            isOneToOne: false
            referencedRelation: "surveys"
            referencedColumns: ["id"]
          },
        ]
      }
      surveys: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          ends_at: string | null
          id: string
          is_paid: boolean
          is_results_public: boolean
          results_shared_at: string | null
          reward_amount: number | null
          reward_currency: string | null
          starts_at: string | null
          status: Database["public"]["Enums"]["engagement_status"]
          target_audience: Database["public"]["Enums"]["target_audience"]
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_paid?: boolean
          is_results_public?: boolean
          results_shared_at?: string | null
          reward_amount?: number | null
          reward_currency?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          ends_at?: string | null
          id?: string
          is_paid?: boolean
          is_results_public?: boolean
          results_shared_at?: string | null
          reward_amount?: number | null
          reward_currency?: string | null
          starts_at?: string | null
          status?: Database["public"]["Enums"]["engagement_status"]
          target_audience?: Database["public"]["Enums"]["target_audience"]
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      telegram_subscribers: {
        Row: {
          categories: string[]
          created_at: string
          id: string
          is_active: boolean
          qualifications: string[]
          states: string[]
          telegram_chat_id: string
          telegram_username: string | null
          updated_at: string
        }
        Insert: {
          categories?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          qualifications?: string[]
          states?: string[]
          telegram_chat_id: string
          telegram_username?: string | null
          updated_at?: string
        }
        Update: {
          categories?: string[]
          created_at?: string
          id?: string
          is_active?: boolean
          qualifications?: string[]
          states?: string[]
          telegram_chat_id?: string
          telegram_username?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      upload_batches: {
        Row: {
          filename: string
          id: string
          issue_details: string | null
          new_count: number | null
          status: string
          total_extracted: number
          updated_count: number | null
          uploaded_at: string
        }
        Insert: {
          filename: string
          id?: string
          issue_details?: string | null
          new_count?: number | null
          status?: string
          total_extracted?: number
          updated_count?: number | null
          uploaded_at?: string
        }
        Update: {
          filename?: string
          id?: string
          issue_details?: string | null
          new_count?: number | null
          status?: string
          total_extracted?: number
          updated_count?: number | null
          uploaded_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_otp_sessions: { Args: never; Returns: undefined }
      get_applicant_applications: {
        Args: { applicant_uuid: string }
        Returns: {
          applicant_id: string
          applied_at: string
          company_research: Json
          cover_letter: string
          follow_up_date: string
          id: string
          job_id: string
          match_score: number
          reminder_sent: boolean
          resume_url: string
          seeker_notes: string
          status: Database["public"]["Enums"]["application_status"]
          updated_at: string
          viewed_at: string
        }[]
      }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      increment_job_views: { Args: { job_id: string }; Returns: undefined }
      insert_enrichment_version: {
        Args: {
          p_current_section_count: number
          p_current_word_count: number
          p_enrichment_data: Json
          p_failure_reason?: string
          p_flags: string[]
          p_internal_links_added: string[]
          p_page_slug: string
          p_page_type: string
          p_quality_score: Json
          p_sections_added: string[]
          p_status: string
        }
        Returns: number
      }
      log_chatbot_event: {
        Args: {
          p_intent: string
          p_ip_hash: string
          p_query_language: string
          p_query_text: string
          p_refusal_reason: string
          p_response_time_ms: number
          p_retrieval_count: number
          p_retrieval_status: string
          p_session_id: string
          p_was_refused: boolean
        }
        Returns: undefined
      }
      log_resource_event: {
        Args: {
          p_event_type: string
          p_referrer?: string
          p_resource_id: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      publish_board_result_row: {
        Args: { p_batch_row_id: string }
        Returns: Json
      }
      publish_enrichment_version: {
        Args: { p_page_slug: string; p_version: number }
        Returns: Json
      }
      resync_batch_counters: {
        Args: { p_batch_id: string }
        Returns: undefined
      }
      sync_rss_review_status: {
        Args: {
          p_new_status: string
          p_qa_notes?: string
          p_review_queue_id: string
        }
        Returns: Json
      }
      unpublish_enrichment: { Args: { p_page_slug: string }; Returns: Json }
      upsert_search_query: {
        Args: { p_query: string; p_source: string }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "job_seeker" | "employer" | "admin"
      application_status:
        | "applied"
        | "viewed"
        | "shortlisted"
        | "interviewing"
        | "offered"
        | "rejected"
        | "withdrawn"
      employment_type:
        | "full_time"
        | "part_time"
        | "contract"
        | "freelancing"
        | "internship"
        | "temporary"
      engagement_status: "draft" | "active" | "closed" | "archived"
      experience_level:
        | "fresher"
        | "junior"
        | "mid"
        | "senior"
        | "lead"
        | "executive"
      job_level:
        | "intern"
        | "fresher"
        | "junior"
        | "mid"
        | "senior"
        | "lead"
        | "manager"
        | "director"
        | "executive"
      job_source: "manual" | "scraped"
      job_status:
        | "draft"
        | "pending_approval"
        | "active"
        | "paused"
        | "closed"
        | "expired"
        | "archived"
      job_type: "full_time" | "part_time" | "contract" | "internship" | "remote"
      location_type: "onsite" | "hybrid" | "remote" | "work_from_home"
      salary_period: "hourly" | "daily" | "weekly" | "monthly" | "yearly"
      target_audience: "candidate" | "employer" | "all"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["job_seeker", "employer", "admin"],
      application_status: [
        "applied",
        "viewed",
        "shortlisted",
        "interviewing",
        "offered",
        "rejected",
        "withdrawn",
      ],
      employment_type: [
        "full_time",
        "part_time",
        "contract",
        "freelancing",
        "internship",
        "temporary",
      ],
      engagement_status: ["draft", "active", "closed", "archived"],
      experience_level: [
        "fresher",
        "junior",
        "mid",
        "senior",
        "lead",
        "executive",
      ],
      job_level: [
        "intern",
        "fresher",
        "junior",
        "mid",
        "senior",
        "lead",
        "manager",
        "director",
        "executive",
      ],
      job_source: ["manual", "scraped"],
      job_status: [
        "draft",
        "pending_approval",
        "active",
        "paused",
        "closed",
        "expired",
        "archived",
      ],
      job_type: ["full_time", "part_time", "contract", "internship", "remote"],
      location_type: ["onsite", "hybrid", "remote", "work_from_home"],
      salary_period: ["hourly", "daily", "weekly", "monthly", "yearly"],
      target_audience: ["candidate", "employer", "all"],
    },
  },
} as const
