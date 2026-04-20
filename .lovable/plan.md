

## Goal
Make the ChatGPT-Agent draft editor show the cover/featured image **the same way the Blog editor does** — with a proper preview block, URL field, file upload tab, and remove button — so admins can see exactly how it will appear to users.

## What's different today
| Blog editor | ChatGPT Agent editor (current) |
|---|---|
| `CoverImageUploader` — full-width preview, URL tab, Upload tab, remove ✕ | Tiny 128×128 thumb only |
| Visible `cover_image_url` input | No URL/manual input |
| Manual upload to `blog-assets` | No upload path |
| `FeaturedImageGenerator`-style "Regenerate" button | "Generate / Regenerate" button (already present) |

## Changes (1 file)

### `src/components/admin/chatgpt-agent/ChatGptAgentDraftEditor.tsx`
In the **Master-File tab → Image (512×512)** block, replace the current small thumbnail with the same UX the blog uses:

1. **Reuse the existing `CoverImageUploader` component** (`src/components/admin/blog/CoverImageUploader.tsx`) bound to the draft's `image_url` field via the existing `val()`/`set()` helpers. This gives us for free:
   - URL / Upload tabs
   - Direct upload to the `blog-assets` bucket
   - Full-width preview (`w-full h-32 object-cover`) — exactly what users see
   - Remove (✕) button
2. **Keep the existing controls** below the preview:
   - "Generate / Regenerate" button (already wired to `handleRegenerateImage`)
   - Image Prompt textarea
   - Image Alt Text input
   - `runtime_meta.image_error` display
3. **Persist URL/upload edits**: because `CoverImageUploader.onChange` will call `set('image_url', url)`, the existing save flow already writes `image_url` to `intake_drafts` — no extra wiring needed.
4. **Add an aspect note** under the preview: "Generated images are saved at exactly 512×512." (purely informational — no behaviour change).

No changes to the image-generation pipeline, no changes to the model selector, no changes to the database, no changes to other components.

## Verification (manual, after implementation)
- Open a draft in the ChatGPT-Agent → Master-File tab.
- Confirm the preview block matches the blog editor visually (same width, same controls).
- Upload a custom image → preview updates → save → reopen → image persists.
- Paste a URL → preview updates → save → persists.
- Click ✕ → preview clears → save → `image_url` set to null in DB.
- Click "Generate" → AI image appears in the same preview frame.

## Out of scope
- No redesign of the rest of the editor.
- No changes to image model routing or 512×512 cropping.
- No new storage buckets.

