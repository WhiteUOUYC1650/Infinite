import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      {/* Unicode 8-pointed star character (✳) */}
      <svg viewBox="0 0 24 24" className="absolute w-full h-full" fill="#FFD700">
        <text
          x="12"
          y="13" // Adjusted for better vertical alignment
          fontSize="26"
          textAnchor="middle"
          dominantBaseline="central"
        >
          &#10031;
        </text>
      </svg>
      {/* Checkmark */}
      <svg viewBox="0 0 24 24" fill="none" className="relative w-full h-full">
        <path d="M9.5 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
