

# Restore GPT-4.1-mini to use the real TrueJobs endpoint

## Problem
The previous fix incorrectly fell back `azure-gpt41-mini` to use `gpt-4o-mini` in `generate-blog-article/index.ts`. The shared caller (`azure-openai.ts`) already points to `https://truejobs.openai.azure.com` with deployment name `gpt-4.1-mini` — which is correct per your confirmation.

## Fix
One file change: revert `generate-blog-article/index.ts` line 611-615 to use `callAzureGPT41Mini` (the proper wrapper) instead of the fallback `callAzureOpenAI`.

### File: `supabase/functions/generate-blog-article/index.ts`
Change the `azure-gpt41-mini` case from:
```typescript
case 'azure-gpt41-mini': {
  const { callAzureOpenAI } = await import('../_shared/azure-openai.ts');
  return callAzureOpenAI(prompt, { maxTokens: mt, temperature: 0.5 });
}
```
To:
```typescript
case 'azure-gpt41-mini': {
  const { callAzureGPT41Mini } = await import('../_shared/azure-openai.ts');
  return callAzureGPT41Mini(prompt, { maxTokens: mt, temperature: 0.5 });
}
```

Then redeploy and test with a curl call to verify the TrueJobs endpoint responds successfully.

