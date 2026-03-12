interface SEOContentSectionProps {
  htmlContent: string;
}

export function SEOContentSection({ htmlContent }: SEOContentSectionProps) {
  return (
    <section className="mb-10">
      <div
        className="prose prose-neutral max-w-none text-muted-foreground [&_h2]:text-foreground [&_h3]:text-foreground [&_strong]:text-foreground [&_a]:text-primary"
        dangerouslySetInnerHTML={{ __html: htmlContent }}
      />
    </section>
  );
}
