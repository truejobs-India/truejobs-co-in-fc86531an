// Types for the Azure Based Extraction pipeline (completely separate from classic Emp News)

export type AzureOcrStatus = 'pending' | 'processing' | 'partially_completed' | 'completed' | 'failed';
export type AzureReconstructionStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AzureAiStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AzurePublishStatus = 'pending' | 'partially_published' | 'published';
export type AzurePageOcrStatus = 'pending' | 'processing' | 'completed' | 'failed';
export type AzureFragmentType = 'job_notice' | 'admission' | 'editorial' | 'advertisement' | 'unknown' | 'continuation';
export type AzureValidationStatus = 'pending' | 'passed' | 'failed' | 'review_needed';
export type AzureDraftPublishStatus = 'draft' | 'published' | 'failed';

export interface AzureEmpNewsIssue {
  id: string;
  issue_name: string;
  issue_date: string | null;
  total_pages: number;
  uploaded_pages: number;
  ocr_completed_pages: number;
  ocr_failed_pages: number;
  ocr_status: AzureOcrStatus;
  reconstruction_status: AzureReconstructionStatus;
  ai_status: AzureAiStatus;
  publish_status: AzurePublishStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface AzureEmpNewsPage {
  id: string;
  issue_id: string;
  page_no: number;
  original_filename: string;
  storage_path: string;
  file_size: number | null;
  mime_type: string | null;
  ocr_status: AzurePageOcrStatus;
  retry_count: number;
  azure_operation_url: string | null;
  azure_result_json: Record<string, unknown> | null;
  extracted_content: string | null;
  cleaned_content: string | null;
  error_message: string | null;
  processed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AzureEmpNewsFragment {
  id: string;
  issue_id: string;
  page_id: string;
  page_no: number;
  fragment_index: number;
  fragment_type: AzureFragmentType;
  raw_text: string;
  cleaned_text: string;
  bbox: Record<string, unknown> | null;
  continuation_hint: string | null;
  continuation_to_page: number | null;
  continuation_from_page: number | null;
  confidence: number | null;
  created_at: string;
}

export interface AzureEmpNewsReconstructedNotice {
  id: string;
  issue_id: string;
  notice_key: string;
  start_page: number | null;
  end_page: number | null;
  notice_title: string | null;
  employer_name: string | null;
  merged_text: string;
  merged_blocks_json: Record<string, unknown> | null;
  reconstruction_confidence: number | null;
  ai_status: AzureAiStatus;
  created_at: string;
  updated_at: string;
}

export interface AzureEmpNewsDraftJob {
  id: string;
  issue_id: string;
  reconstructed_notice_id: string | null;
  draft_title: string;
  draft_data: Record<string, unknown>;
  ai_cleaned_data: Record<string, unknown> | null;
  validation_status: AzureValidationStatus;
  validation_notes: string[];
  publish_status: AzureDraftPublishStatus;
  linked_live_job_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface AzureEmpNewsPublishLog {
  id: string;
  issue_id: string;
  draft_job_id: string | null;
  action: string;
  status: string;
  message: string | null;
  created_at: string;
}
