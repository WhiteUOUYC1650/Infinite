import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      {/* Star shape made from two rotated divs */}
      <div
        className="absolute w-full h-full"
        style={{
          backgroundColor: '#FFD700',
          borderRadius: '20%',
          transform: 'rotate(45deg)',
        }}
      />
      <div
        className="absolute w-full h-full"
        style={{
          backgroundColor: '#FFD700',
          borderRadius: '20%',
        }}
      />
      {/* Checkmark on top */}
      <svg
        viewBox="0 0 24 24"
        fill="none"
        className="relative w-full h-full"
      >
        <path d="M9.5 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
