

# Delete All Vertex AI / GCP Secrets

## Secrets to Delete
The following 5 secrets power all Vertex AI text and image models:

1. **GCP_PRIVATE_KEY** — Service account private key for Vertex AI authentication
2. **GCP_PROJECT_ID** — Google Cloud project identifier
3. **GCP_CLIENT_EMAIL** — Service account email
4. **GCP_LOCATION** — GCP region (e.g., us-central1)
5. **GEMINI_API_KEY** — Gemini API key (if used as alternative auth)

## What Stays Intact
- All edge function code (`_shared/vertex-ai.ts`, `generate-vertex-image/index.ts`, all Gemini routing in every edge function)
- All frontend model selectors and registry entries in `src/lib/aiModels.ts`
- All prompt policies and image generation logic

The Vertex models will return errors when selected until new secrets are configured. Other providers (Azure GPT-5-mini, GPT-4.1-mini, DeepSeek, Sarvam, Bedrock, etc.) will continue working normally.

## How to Execute
Since there is no programmatic "delete secret" tool available, you will need to go to **Lovable Cloud** settings and manually remove the 5 secrets listed above. Alternatively, I can overwrite each secret with an empty/placeholder value — but that would still leave the secret entries visible.

Would you like me to proceed with the deletion once approved, or would you prefer to remove them from the Cloud settings yourself?

