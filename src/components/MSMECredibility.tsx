import msmeLogo from '@/assets/msme-logo.png';

export function MSMECredibility({ className = '' }: { className?: string }) {
  return (
    <div className={className}>
      <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
        <img
          src={msmeLogo}
          alt="MSME UDYAM Registered Business – TrueJobs"
          className="h-16 md:h-20 w-auto object-contain shrink-0"
          loading="lazy"
          width="80"
          height="80"
        />
        <div className="text-center sm:text-left">
          <p className="text-sm font-semibold text-foreground">
            TrueJobs is a registered MSME under the Government of India
          </p>
          <p className="text-sm text-foreground mt-1">
            UDYAM Registration No: <span className="font-medium">UDYAM-DL-04-0071179</span>
          </p>
        </div>
      </div>
    </div>
  );
}
