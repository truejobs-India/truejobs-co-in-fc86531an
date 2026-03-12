// Types for Polls, Contests, and Surveys

export type TargetAudience = 'candidate' | 'employer' | 'all';
export type EngagementStatus = 'draft' | 'active' | 'closed' | 'archived';

export interface Poll {
  id: string;
  title: string;
  description: string | null;
  target_audience: TargetAudience;
  status: EngagementStatus;
  starts_at: string | null;
  ends_at: string | null;
  is_results_public: boolean;
  results_shared_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface PollOption {
  id: string;
  poll_id: string;
  option_text: string;
  display_order: number;
  created_at: string;
}

export interface PollResponse {
  id: string;
  poll_id: string;
  option_id: string;
  user_id: string;
  created_at: string;
}

export interface Contest {
  id: string;
  title: string;
  description: string | null;
  rules: string | null;
  prizes: string | null;
  target_audience: TargetAudience;
  status: EngagementStatus;
  starts_at: string | null;
  ends_at: string | null;
  max_entries: number | null;
  is_results_public: boolean;
  results_shared_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ContestEntry {
  id: string;
  contest_id: string;
  user_id: string;
  submission_text: string | null;
  submission_url: string | null;
  score: number | null;
  is_winner: boolean;
  created_at: string;
  updated_at: string;
}

export interface Survey {
  id: string;
  title: string;
  description: string | null;
  target_audience: TargetAudience;
  status: EngagementStatus;
  is_paid: boolean;
  reward_amount: number | null;
  reward_currency: string | null;
  starts_at: string | null;
  ends_at: string | null;
  is_results_public: boolean;
  results_shared_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: 'text' | 'single_choice' | 'multiple_choice' | 'rating';
  options: string[] | null;
  is_required: boolean;
  display_order: number;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  survey_id: string;
  user_id: string;
  answers: Record<string, unknown>;
  is_paid_out: boolean;
  paid_at: string | null;
  created_at: string;
}

export interface PollWithOptions extends Poll {
  poll_options: PollOption[];
  response_count?: number;
}

export interface ContestWithEntries extends Contest {
  entry_count?: number;
}

export interface SurveyWithQuestions extends Survey {
  survey_questions: SurveyQuestion[];
  response_count?: number;
}
