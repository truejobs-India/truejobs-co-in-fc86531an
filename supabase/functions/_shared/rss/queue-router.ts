// Queue routing: decides which items go to monitoring_review_queue and upserts them

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

export interface QueueableItem {
  rssItemId: string;
  rssSourceId: string;
  title: string;
  link: string | null;
  pdfUrl: string | null;
  publishedAt: string | null;
  itemType: string;
  relevanceLevel: string;
  rawPayload: Record<string, unknown>;
  parsedPayload: Record<string, unknown>;
}

/**
 * Should this item be auto-queued for review?
 */
export function shouldQueue(relevanceLevel: string): boolean {
  return relevanceLevel === 'High' || relevanceLevel === 'Medium';
}

/**
 * Upsert an item into monitoring_review_queue
 * Uses ON CONFLICT on partial unique index (channel, source_item_id) WHERE source_item_id IS NOT NULL
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
      review_status: 'pending',
      raw_payload: item.rawPayload,
      parsed_payload: item.parsedPayload,
    });

  if (error) return { success: false, error: error.message };
  return { success: true };
}
