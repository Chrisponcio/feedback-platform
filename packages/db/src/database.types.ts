/**
 * Auto-generated Supabase TypeScript types.
 * Regenerate with: pnpm db:generate-types
 * Do not edit manually.
 */
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  public: {
    Tables: {
      organizations: {
        Row: {
          id: string
          name: string
          slug: string
          plan: 'starter' | 'growth' | 'enterprise'
          settings: Json
          custom_domain: string | null
          saml_config: Json | null
          saml_enabled: boolean
          max_users: number
          max_responses_month: number
          trial_ends_at: string | null
          subscription_id: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<
          Database['public']['Tables']['organizations']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['organizations']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['organizations']['Insert']>
      }
      profiles: {
        Row: {
          id: string
          full_name: string | null
          avatar_url: string | null
          phone: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'created_at' | 'updated_at'>
        Update: Partial<Database['public']['Tables']['profiles']['Insert']>
      }
      organization_members: {
        Row: {
          id: string
          organization_id: string
          user_id: string
          role: 'owner' | 'admin' | 'manager' | 'viewer'
          invited_by: string | null
          invited_at: string | null
          accepted_at: string | null
          status: 'pending' | 'active' | 'suspended'
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['organization_members']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['organization_members']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['organization_members']['Insert']>
      }
      invitations: {
        Row: {
          id: string
          organization_id: string
          email: string
          role: 'admin' | 'manager' | 'viewer'
          token: string
          invited_by: string
          expires_at: string
          accepted_at: string | null
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['invitations']['Row'],
          'id' | 'token' | 'created_at'
        > &
          Partial<Pick<Database['public']['Tables']['invitations']['Row'], 'id' | 'token'>>
        Update: Partial<Database['public']['Tables']['invitations']['Insert']>
      }
      locations: {
        Row: {
          id: string
          organization_id: string
          name: string
          address: string | null
          city: string | null
          state: string | null
          country: string
          timezone: string
          metadata: Json
          is_active: boolean
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<
          Database['public']['Tables']['locations']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['locations']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['locations']['Insert']>
      }
      surveys: {
        Row: {
          id: string
          organization_id: string
          location_id: string | null
          title: string
          description: string | null
          status: 'draft' | 'active' | 'paused' | 'archived' | 'closed'
          survey_type: 'standard' | 'pulse' | 'kiosk' | 'onboarding'
          language: string
          branding: Json
          settings: Json
          starts_at: string | null
          ends_at: string | null
          response_limit: number | null
          allow_anonymous: boolean
          require_login: boolean
          one_response_per: 'session' | 'user' | 'device' | null
          thank_you_message: string | null
          redirect_url: string | null
          created_by: string | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<
          Database['public']['Tables']['surveys']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['surveys']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['surveys']['Insert']>
      }
      questions: {
        Row: {
          id: string
          survey_id: string
          organization_id: string
          type:
            | 'nps'
            | 'csat'
            | 'ces'
            | 'smiley'
            | 'emoji_rating'
            | 'star_rating'
            | 'multiple_choice'
            | 'checkbox'
            | 'open_text'
            | 'number_scale'
            | 'date'
            | 'email_capture'
            | 'phone_capture'
            | 'section_header'
          title: string
          description: string | null
          is_required: boolean
          position: number
          settings: Json
          logic: Json | null
          created_at: string
          updated_at: string
          deleted_at: string | null
        }
        Insert: Omit<
          Database['public']['Tables']['questions']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['questions']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['questions']['Insert']>
      }
      survey_distributions: {
        Row: {
          id: string
          survey_id: string
          organization_id: string
          location_id: string | null
          channel: 'kiosk' | 'email' | 'sms' | 'qr_code' | 'web_embed' | 'web_link' | 'api'
          name: string | null
          token: string
          config: Json
          is_active: boolean
          response_count: number
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['survey_distributions']['Row'],
          'id' | 'token' | 'response_count' | 'created_at' | 'updated_at'
        > &
          Partial<
            Pick<
              Database['public']['Tables']['survey_distributions']['Row'],
              'id' | 'token' | 'response_count'
            >
          >
        Update: Partial<Database['public']['Tables']['survey_distributions']['Insert']>
      }
      responses: {
        Row: {
          id: string
          survey_id: string
          organization_id: string
          distribution_id: string | null
          location_id: string | null
          respondent_id: string | null
          is_anonymous: boolean
          is_complete: boolean
          started_at: string
          completed_at: string | null
          duration_seconds: number | null
          channel: 'kiosk' | 'email' | 'sms' | 'qr_code' | 'web_embed' | 'web_link' | 'api'
          device_type: 'mobile' | 'tablet' | 'desktop' | 'kiosk' | 'unknown' | null
          browser: string | null
          os: string | null
          ip_hash: string | null
          session_id: string | null
          language: string
          metadata: Json
          respondent_email: string | null
          respondent_phone: string | null
          respondent_name: string | null
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['responses']['Row'],
          'id' | 'started_at' | 'created_at'
        > &
          Partial<Pick<Database['public']['Tables']['responses']['Row'], 'id' | 'started_at'>>
        Update: Partial<Database['public']['Tables']['responses']['Insert']>
      }
      response_answers: {
        Row: {
          id: string
          response_id: string
          question_id: string
          organization_id: string
          survey_id: string
          value_numeric: number | null
          value_text: string | null
          value_boolean: boolean | null
          value_json: Json | null
          question_type: string
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['response_answers']['Row'],
          'id' | 'created_at'
        > &
          Partial<Pick<Database['public']['Tables']['response_answers']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['response_answers']['Insert']>
      }
      response_tags: {
        Row: {
          id: string
          response_id: string
          answer_id: string | null
          organization_id: string
          tag: string
          tag_type: 'sentiment' | 'topic' | 'intent' | 'custom'
          confidence: number | null
          source: 'ai' | 'manual' | 'rule'
          model_version: string | null
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['response_tags']['Row'],
          'id' | 'created_at'
        > &
          Partial<Pick<Database['public']['Tables']['response_tags']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['response_tags']['Insert']>
      }
      pulse_schedules: {
        Row: {
          id: string
          organization_id: string
          survey_id: string
          name: string
          status: 'active' | 'paused' | 'completed'
          frequency: 'daily' | 'weekly' | 'biweekly' | 'monthly' | 'quarterly'
          day_of_week: number | null
          day_of_month: number | null
          send_time: string
          timezone: string
          audience_config: Json
          channels: string[]
          next_run_at: string | null
          last_run_at: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['pulse_schedules']['Row'],
          'id' | 'created_at' | 'updated_at'
        > &
          Partial<Pick<Database['public']['Tables']['pulse_schedules']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['pulse_schedules']['Insert']>
      }
      report_snapshots: {
        Row: {
          id: string
          organization_id: string
          survey_id: string | null
          location_id: string | null
          snapshot_type: 'daily' | 'weekly' | 'monthly' | 'custom'
          period_start: string
          period_end: string
          metrics: Json
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['report_snapshots']['Row'],
          'id' | 'created_at'
        > &
          Partial<Pick<Database['public']['Tables']['report_snapshots']['Row'], 'id'>>
        Update: Partial<Database['public']['Tables']['report_snapshots']['Insert']>
      }
      audit_logs: {
        Row: {
          id: string
          organization_id: string
          user_id: string | null
          action: string
          resource_type: string
          resource_id: string | null
          old_value: Json | null
          new_value: Json | null
          ip_address: string | null
          user_agent: string | null
          created_at: string
        }
        Insert: Omit<
          Database['public']['Tables']['audit_logs']['Row'],
          'id' | 'created_at'
        > &
          Partial<Pick<Database['public']['Tables']['audit_logs']['Row'], 'id'>>
        Update: never
      }
    }
    Views: Record<string, never>
    Functions: {
      current_organization_id: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}

// Convenience type aliases
export type Tables<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Row']

export type TablesInsert<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Insert']

export type TablesUpdate<T extends keyof Database['public']['Tables']> =
  Database['public']['Tables'][T]['Update']

// Commonly used row types
export type Organization = Tables<'organizations'>
export type Profile = Tables<'profiles'>
export type OrganizationMember = Tables<'organization_members'>
export type Invitation = Tables<'invitations'>
export type Location = Tables<'locations'>
export type Survey = Tables<'surveys'>
export type Question = Tables<'questions'>
export type SurveyDistribution = Tables<'survey_distributions'>
export type Response = Tables<'responses'>
export type ResponseAnswer = Tables<'response_answers'>
export type ResponseTag = Tables<'response_tags'>
export type PulseSchedule = Tables<'pulse_schedules'>
export type ReportSnapshot = Tables<'report_snapshots'>
export type AuditLog = Tables<'audit_logs'>
