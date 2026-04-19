/**
 * ChatGPT Agent draft filter — single source of truth.
 *
 * Both the manager list query and the Excel export apply this exact predicate
 * so the export can never drift from what the manager shows.
 *
 * `description` is the human-readable form written into the Export_Metadata
 * sheet so reviewers can see exactly which rows were exported.
 */
export const CHATGPT_AGENT_FILTER = {
  description: "source_channel = 'chatgpt_agent'",
  apply: <T extends { eq: (col: string, val: any) => T }>(qb: T): T =>
    qb.eq('source_channel', 'chatgpt_agent'),
};
