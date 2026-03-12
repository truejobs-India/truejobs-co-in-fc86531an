import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { CachePage } from './cacheTypes';
import { extractMetadata } from './cacheValidation';

interface Props {
  page: CachePage | null;
  open: boolean;
  onClose: () => void;
}

export function CachePreviewModal({ page, open, onClose }: Props) {
  if (!page) return null;

  const meta = page.headHtml ? extractMetadata(page.headHtml) : null;
  const assembledHtml = `<!DOCTYPE html><html><head>${page.headHtml || ''}</head><body>${page.bodyHtml || ''}</body></html>`;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="text-sm font-mono">/{page.slug}</DialogTitle>
        </DialogHeader>

        <div className="flex flex-1 gap-4 overflow-hidden min-h-0">
          {/* Main preview area */}
          <div className="flex-1 min-w-0">
            <Tabs defaultValue="fragments" className="h-full flex flex-col">
              <TabsList className="mb-2">
                <TabsTrigger value="fragments">Cached Fragments</TabsTrigger>
                <TabsTrigger value="assembled">Assembled Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="fragments" className="flex-1 overflow-auto">
                <div className="space-y-4">
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">head_html</p>
                    <ScrollArea className="h-48 rounded border bg-muted/30">
                      <pre className="text-xs p-3 whitespace-pre-wrap break-all">{page.headHtml || '(empty)'}</pre>
                    </ScrollArea>
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-muted-foreground mb-1">body_html</p>
                    <ScrollArea className="h-64 rounded border bg-muted/30">
                      <pre className="text-xs p-3 whitespace-pre-wrap break-all">{page.bodyHtml || '(empty)'}</pre>
                    </ScrollArea>
                  </div>
                </div>
              </TabsContent>
              <TabsContent value="assembled" className="flex-1 overflow-hidden flex flex-col">
                <p className="text-[10px] text-muted-foreground mb-1 italic">
                  Approximate preview — production merges these with the live app shell
                </p>
                <iframe
                  srcDoc={assembledHtml}
                  className="flex-1 w-full border rounded bg-white"
                  sandbox="allow-same-origin"
                  title="Assembled preview"
                />
              </TabsContent>
            </Tabs>
          </div>

          {/* Metadata sidebar */}
          {meta && (
            <ScrollArea className="w-72 shrink-0 border-l pl-4">
              <div className="space-y-3 text-xs">
                <MetaItem label="Title" value={meta.title} />
                <MetaItem label="Description" value={meta.description} />
                <MetaItem label="Canonical" value={meta.canonical} />
                <MetaItem label="Robots" value={meta.robots} />

                {meta.ogTags.length > 0 && (
                  <div>
                    <p className="font-semibold text-muted-foreground mb-1">OG Tags</p>
                    {meta.ogTags.map((t, i) => (
                      <p key={i}><span className="text-muted-foreground">{t.name}:</span> {t.content}</p>
                    ))}
                  </div>
                )}

                {meta.twitterTags.length > 0 && (
                  <div>
                    <p className="font-semibold text-muted-foreground mb-1">Twitter Tags</p>
                    {meta.twitterTags.map((t, i) => (
                      <p key={i}><span className="text-muted-foreground">{t.name}:</span> {t.content}</p>
                    ))}
                  </div>
                )}

                {meta.jsonLdBlocks.length > 0 && (
                  <div>
                    <p className="font-semibold text-muted-foreground mb-1">JSON-LD ({meta.jsonLdBlocks.length})</p>
                    {meta.jsonLdBlocks.map((block, i) => (
                      <details key={i} className="mb-1">
                        <summary className="cursor-pointer">
                          <Badge variant="outline" className="text-[10px]">{block['@type'] || 'Schema'}</Badge>
                        </summary>
                        <pre className="mt-1 p-2 bg-muted rounded text-[10px] overflow-auto max-h-32">
                          {JSON.stringify(block, null, 2)}
                        </pre>
                      </details>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function MetaItem({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="font-semibold text-muted-foreground">{label}</p>
      <p className={value ? '' : 'text-destructive'}>{value || '(missing)'}</p>
    </div>
  );
}
