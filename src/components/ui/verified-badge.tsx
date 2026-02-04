import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      {/* Star shape made from two rotated divs */}
      <div
        className="absolute w-full h-full"
        style={{
          backgroundColor: 'gold',
          borderRadius: '20%',
        }}
      />
      <div
        className="absolute w-full h-full"
        style={{
          backgroundColor: 'gold',
          borderRadius: '20%',
          transform: 'rotate(45deg)',
        }}
      />
      {/* Checkmark on top */}
      <svg
        viewBox="4 4 16 16"
        fill="none"
        stroke="black"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative w-3/4 h-3/4"
      >
        <path d="M5 13l4 4L19 7" />
      </svg>
    </span>
  );
}
