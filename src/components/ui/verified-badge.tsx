import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      <svg viewBox="0 0 24 24" className="absolute w-full h-full" fill="#FFD700">
        {/* 8-pointed star with rounded corners */}
        <path d="M12,1 C13.5,6 18,3 19,5 C17.5,8 22,8.5 22.5,12 C22,15.5 17.5,16 19,19 C18,21 13.5,18 12,23 C10.5,18 6,21 5,19 C6.5,16 2,15.5 1.5,12 C2,8.5 6.5,8 5,5 C6,3 10.5,6 12,1 Z" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" className="relative w-full h-full">
        <path d="M9.5 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
