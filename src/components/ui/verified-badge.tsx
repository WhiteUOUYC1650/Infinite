import { cn } from "@/lib/utils";

export function VerifiedBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      <svg viewBox="0 0 24 24" className="absolute w-full h-full" fill="#FFD700">
        {/* Symmetrical 8-pointed star with rounded corners */}
        <path d="M12 2.25c.77 0 1.5.17 2.18.5l3.29 1.64c.33.17.7.39 1.08.67l2.39 1.79c.6.45 1.08 1.08 1.38 1.82l1.01 2.52c.17.42.3.87.39 1.32l.26 1.3c.09.45.09.91 0 1.36l-.26 1.3c-.09.45-.22.9-.39 1.32l-1.01 2.52c-.3.74-.78 1.37-1.38 1.82l-2.39 1.79c-.38.28-.75.5-1.08.67l-3.29 1.64a4.5 4.5 0 0 1-4.36 0l-3.29-1.64a4.5 4.5 0 0 1-1.08-.67l-2.39-1.79c-.6-.45-1.08-1.08-1.38-1.82l-1.01-2.52a4.5 4.5 0 0 1-.39-1.32l-.26-1.3a2.25 2.25 0 0 1 0-1.36l.26-1.3c.09-.45.22.9.39-1.32l1.01-2.52c.3-.74.78-1.37 1.38-1.82l2.39-1.79c.38-.28.75-.5 1.08-.67l3.29-1.64A4.5 4.5 0 0 1 12 2.25z" />
      </svg>
      <svg viewBox="0 0 24 24" fill="none" className="relative w-full h-full">
        <path d="M9.5 12l2 2 4-4" stroke="black" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
