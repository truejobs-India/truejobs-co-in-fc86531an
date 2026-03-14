/**
 * Frontend API client for Vertex AI edge functions.
 * All calls go through Supabase Edge Functions — never directly to Google.
 */
import { supabase } from '@/integrations/supabase/client';
import type {
  SeoHelperAction, SeoHelperRequest,
  PremiumArticleAction, PremiumArticleRequest,
  BlogImageRequest,
  VertexAIResponse,
} from '@/types/vertex-ai';

async function invokeVertex<T>(functionName: string, body: Record<string, unknown>): Promise<VertexAIResponse<T>> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Not authenticated — please log in');

  const { data, error } = await supabase.functions.invoke(functionName, { body });
  if (error) {
    return { success: false, error: error.message };
  }
  return data as VertexAIResponse<T>;
}

// ═══════════════════════════════════════════════════════════════
// SEO Helper (Gemini 2.5 Flash)
// ═══════════════════════════════════════════════════════════════

export async function callSeoHelper(request: SeoHelperRequest) {
  return invokeVertex('generate-seo-helper', request as unknown as Record<string, unknown>);
}

export async function generateOutline(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'generate-outline' });
}

export async function generateFaqs(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'generate-faqs' });
}

export async function generateMeta(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'generate-meta' });
}

export async function suggestTags(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'suggest-tags' });
}

export async function suggestCategory(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'suggest-category' });
}

export async function suggestInternalLinks(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'suggest-internal-links' });
}

export async function clusterKeywords(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'cluster-keywords' });
}

export async function generateSchemaDraft(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'generate-schema-draft' });
}

export async function rewriteShortCopy(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'rewrite-short-copy' });
}

export async function generateTitleVariations(params: Omit<SeoHelperRequest, 'action'>) {
  return callSeoHelper({ ...params, action: 'generate-title-variations' });
}

// ═══════════════════════════════════════════════════════════════
// Premium Article (Gemini 2.5 Pro)
// ═══════════════════════════════════════════════════════════════

export async function callPremiumArticle(request: PremiumArticleRequest) {
  return invokeVertex('generate-premium-article', request as unknown as Record<string, unknown>);
}

export async function generateFullArticle(params: Omit<PremiumArticleRequest, 'action'>) {
  return callPremiumArticle({ ...params, action: 'generate-full-article' });
}

export async function rewriteArticle(params: Omit<PremiumArticleRequest, 'action'>) {
  return callPremiumArticle({ ...params, action: 'rewrite-article' });
}

export async function polishArticle(params: Omit<PremiumArticleRequest, 'action'>) {
  return callPremiumArticle({ ...params, action: 'polish-article' });
}

export async function expandArticle(params: Omit<PremiumArticleRequest, 'action'>) {
  return callPremiumArticle({ ...params, action: 'expand-article' });
}

export async function generateFinalSeoPackage(params: Omit<PremiumArticleRequest, 'action'>) {
  return callPremiumArticle({ ...params, action: 'generate-final-seo-package' });
}

// ═══════════════════════════════════════════════════════════════
// Blog Image (Imagen via Vertex AI)
// ═══════════════════════════════════════════════════════════════

export async function generateVertexImage(request: BlogImageRequest) {
  return invokeVertex('generate-vertex-image', request as unknown as Record<string, unknown>);
}
