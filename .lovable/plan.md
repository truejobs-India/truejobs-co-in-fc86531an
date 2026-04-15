

# Fix: Bulk Auto-Fix Dialog Missing Scroll

## Problem
The "Scan & Auto-Fix by AI" dialog at line 2473 has `max-h-[85vh] overflow-y-auto` on `DialogContent`, but shadcn's `DialogContent` component applies its own `max-h-[calc(100vh-...)]` and overflow styles that can conflict, preventing the modal from scrolling when results exceed the viewport.

## Fix — Single file: `src/components/admin/BlogPostEditor.tsx`

Wrap the entire dialog body (everything between `DialogHeader` and the closing `DialogContent`) in a `<div className="overflow-y-auto flex-1 min-h-0">` so the content scrolls independently of the header. Also add `flex flex-col` to the DialogContent className to enable the flex layout.

**Line 2473** — update DialogContent classes:
```
max-w-2xl max-h-[85vh] flex flex-col overflow-hidden
```

**After DialogHeader closing tag (line 2482)** — wrap remaining content in:
```jsx
<div className="overflow-y-auto flex-1 min-h-0 space-y-4 pr-1">
```

**Before closing `</DialogContent>` (line 2674)** — close the wrapper div.

This ensures the header stays pinned and the body scrolls.

