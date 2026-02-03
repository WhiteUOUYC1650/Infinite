import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-4 h-4", className)}>
      <svg viewBox="0 0 24 24" className="absolute w-full h-full" fill="#FFD700">
        <path
          d="M12 2L14.121 9.879L22 12L14.121 14.121L12 22L9.879 14.121L2 12L9.879 9.879L12 2Z"
        />
        <path
          d="M12 2L14.121 9.879L22 12L14.121 14.121L12 22L9.879 14.121L2 12L9.879 9.879L12 2Z"
          transform="rotate(45 12 12)"
        />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" className="relative w-full h-full">
        <path d="M9.5 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
