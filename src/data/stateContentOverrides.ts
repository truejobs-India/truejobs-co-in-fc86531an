/**
 * State Content Overrides
 * 
 * Stores approved AI-enriched intro content for state government job pages.
 * When a state enrichment is approved in the admin panel, its overview HTML
 * gets stored here, replacing the generic generateStateIntro() output.
 * 
 * Key = state page slug (e.g. "govt-jobs-uttar-pradesh")
 * Value = full HTML intro content
 */
export const stateContentOverrides: Record<string, string> = {};
