// Queue routing: decides which items go to monitoring_review_queue and upserts them
// Tightened for TrueJobs.co.in: only core job/exam content reaches review queue

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface QueueableItem {
  rssItemId: string;
  rssSourceId: string;
  title: string;
  link: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  itemType: string;
  primaryDomain: string;
  displayGroup: string;
  relevanceLevel: string;
  rawPayload: Record<string, unknown>;
  parsedPayload: Record<string, unknown>;
}

// Core TrueJobs item types — always eligible for queueing
const CORE_TYPES = new Set([
  'recruitment', 'vacancy', 'exam', 'admit_card', 'result', 'answer_key',
]);

// Exam-adjacent types — queue only if High relevance
const EXAM_ADJACENT_TYPES = new Set(['syllabus']);

// Non-core domains that need high score to qualify
const NON_CORE_DOMAINS = new Set([
  'policy_updates', 'public_services', 'general_alerts', 'education_services',
]);

export interface QueueDecision {
  shouldQueue: boolean;
  reason: string;
}

/**
 * Should this item be queued for review?
 * Strict TrueJobs gating: only core job/exam types, or high-score overrides.
 */
export function shouldQueueForTrueJobs(
  relevanceLevel: string,
  primaryDomain: string,
  itemType: string,
  truejobsScore: number
): QueueDecision {
  // Always queue core types with High or Medium relevance
  if (CORE_TYPES.has(itemType) && (relevanceLevel === 'High' || relevanceLevel === 'Medium')) {
    return { shouldQueue: true, reason: 'core_type' };
  }

  // Queue exam-adjacent types only if High relevance
  if (EXAM_ADJACENT_TYPES.has(itemType) && relevanceLevel === 'High') {
    return { shouldQueue: true, reason: 'exam_adjacent' };
  }

  // Non-core domains need score >= 60 to qualify
  if (NON_CORE_DOMAINS.has(primaryDomain)) {
    if (truejobsScore >= 60) {
      return { shouldQueue: true, reason: 'high_score_override' };
    }
    return { shouldQueue: false, reason: 'non_core_domain' };
  }

  // Default: queue only if High relevance
  if (relevanceLevel === 'High') {
    return { shouldQueue: true, reason: 'high_relevance' };
  }

  return { shouldQueue: false, reason: 'insufficient_relevance' };
}

/**
 * Legacy compat — old callers that pass only relevanceLevel
 * @deprecated Use shouldQueueForTrueJobs instead
 */
export function shouldQueue(relevanceLevel: string): boolean {
  return relevanceLevel === 'High' || relevanceLevel === 'Medium';
}

/**
 * Upsert an item into monitoring_review_queue
 */
export async function upsertReviewEntry(
  supabaseUrl: string,
  serviceRoleKey: string,
  item: QueueableItem
): Promise<{ success: boolean; error?: string }> {
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  // Check if entry already exists
  const { data: existing } = await supabase
    .from('monitoring_review_queue')
    .select('id, review_status')
    .eq('channel', 'rss')
    .eq('source_item_id', item.rssItemId)
    .maybeSingle();

  if (existing) {
    // Only update if still pending — don't overwrite reviewed items
    if (existing.review_status === 'pending') {
      const { error } = await supabase
        .from('monitoring_review_queue')
        .update({
          title: item.title,
          source_url: item.link,
          pdf_url: item.pdfUrl,
          published_at: item.publishedAt,
          item_type: item.itemType,
          primary_domain: item.primaryDomain,
          display_group: item.displayGroup,
          raw_payload: item.rawPayload,
          parsed_payload: item.parsedPayload,
        })
        .eq('id', existing.id);
      if (error) return { success: false, error: error.message };
    }
    return { success: true };
  }

  const { error } = await supabase
    .from('monitoring_review_queue')
    .insert({
      channel: 'rss',
      source_id: item.rssSourceId,
      source_item_id: item.rssItemId,
      title: item.title,
      source_url: item.link,
      pdf_url: item.pdfUrl,
      published_at: item.publishedAt,
      item_type: item.itemType,
      primary_domain: item.primaryDomain,
      display_group: item.displayGroup,
      review_status: 'pending',
      raw_payload: item.rawPayload,
      parsed_payload: item.parsedPayload,
    });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
