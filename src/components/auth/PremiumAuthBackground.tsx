import { cn } from '@/lib/utils';

interface PremiumAuthBackgroundProps {
  isEmployer?: boolean;
}

export function PremiumAuthBackground({ isEmployer = false }: PremiumAuthBackgroundProps) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      <div className={cn(
        "absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl opacity-30",
        isEmployer ? "bg-orange-300" : "bg-blue-300"
      )} />
      <div className={cn(
        "absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl opacity-20",
        isEmployer ? "bg-red-300" : "bg-indigo-300"
      )} />
      <div className={cn(
        "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] rounded-full blur-3xl opacity-10",
        isEmployer ? "bg-amber-400" : "bg-purple-400"
      )} />
      <div 
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`
        }}
      />
    </div>
  );
}
