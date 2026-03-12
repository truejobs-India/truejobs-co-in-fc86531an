const COMPANIES = [
  'Infosys', 'TCS', 'Wipro', 'HCL', 'Tech Mahindra', 
  'Bajaj Allianz', 'HDFC Life', 'ICICI Prudential', 'Tata AIG', 'Reliance'
];

export function CompactTrustBar() {
  return (
    <section className="py-4 border-y border-border bg-muted/30">
      <div className="container mx-auto px-4">
        <p className="text-center text-xs text-muted-foreground">
          <span className="font-medium text-foreground">Trusted by top companies:</span>{' '}
          {COMPANIES.join(' • ')}
        </p>
      </div>
    </section>
  );
}
