

# Fix: Azure FLUX Deployment Name Mismatch

## Root Cause

The edge function logs show the exact error:

```text
Azure FLUX AZURE_FLUX_DEPLOYMENT=FLUX.1-Kontext-pro error 404: DeploymentNotFound
```

The secret `AZURE_FLUX_DEPLOYMENT` is set to `FLUX.1-Kontext-pro` (the model display name), but Azure requires the **deployment name** which is `flux-1-kontext-pro` (lowercase, hyphens instead of dots).

All 67 images failed because every request hit a 404 before any image generation could begin.

## Fix

Update the `AZURE_FLUX_DEPLOYMENT` secret value from `FLUX.1-Kontext-pro` to `flux-1-kontext-pro`.

This is a single secret value change — no code changes needed. The shared caller in `azure-flux.ts` already constructs the URL correctly using this env var.

## After Fix

Re-run the bulk cover image generation from the Blog admin panel. All requests should now resolve to the correct Azure deployment endpoint.

| Item | Detail |
|---|---|
| Files changed | None |
| Secret to update | `AZURE_FLUX_DEPLOYMENT` → `flux-1-kontext-pro` |

