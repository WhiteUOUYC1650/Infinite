'use client';

import { cn } from "@/lib/utils";

export function InfGoldIcon({ className }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("w-6 h-6", className)}
    >
      <circle cx="12" cy="12" r="10" fill="gold" stroke="darkgoldenrod" strokeWidth="1.5" />
      <circle cx="12" cy="12" r="8" fill="none" stroke="darkgoldenrod" strokeOpacity="0.5" strokeWidth="1" />
      <path
        d="M 9.5 12 C 9.5 10.5, 10.5 10.5, 12 12 C 13.5 13.5, 14.5 13.5, 14.5 12 C 14.5 10.5, 13.5 10.5, 12 12 C 10.5 13.5, 9.5 13.5, 9.5 12 Z"
        stroke="darkgoldenrod"
        strokeWidth="1.5"
        fill="none"
      />
    </svg>
  );
}
