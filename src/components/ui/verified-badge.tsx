import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      <svg viewBox="0 0 24 24" className="absolute w-full h-full" fill="#FFD700">
        {/* 8-pointed star with rounded corners */}
        <path d="M12,0.5L14.22,5.7L19.8,4.5L16.95,9.15L22.5,11L16.95,12.85L19.8,17.5L14.22,16.3L12,21.5L9.78,16.3L4.2,17.5L7.05,12.85L1.5,11L7.05,9.15L4.2,4.5L9.78,5.7L12,0.5Z" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" className="relative w-full h-full">
        <path d="M9.5 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
