

# Plan: Update GEMINI_API_KEY and Retest

## What will happen
1. **Re-submit GEMINI_API_KEY** — I will use the `add_secret` tool to open a secure input window where you can paste your new Gemini API key. The value is never visible to me.
2. **Retest the model** — After you submit the key, I will invoke the `improve-blog-content` edge function (or the Vertex AI test panel) to confirm the 403 error is resolved and the Gemini model responds successfully.

## No code changes needed
The edge function code is correct — only the API key needs to be refreshed.

