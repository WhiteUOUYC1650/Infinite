import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      <svg viewBox="0 0 24 24" className="absolute w-full h-full" fill="#FFD700">
        {/* 8-pointed star with rounded corners */}
        <path d="M12 .5C12.5 .5 15.25 4.5 16.5 5.5C17.75 6.5 22.5 6.25 23.5 7C24.5 7.75 22 10.5 22 12C22 13.5 24.5 16.25 23.5 17C22.5 17.75 17.75 17.5 16.5 18.5C15.25 19.5 12.5 23.5 12 23.5C11.5 23.5 8.75 19.5 7.5 18.5C6.25 17.5 1.5 17.75 .5 17C-.5 16.25 2 13.5 2 12C2 10.5 -.5 7.75 .5 7C1.5 6.25 6.25 6.5 7.5 5.5C8.75 4.5 11.5 .5 12 .5z" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" className="relative w-full h-full">
        <path d="M9.5 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
