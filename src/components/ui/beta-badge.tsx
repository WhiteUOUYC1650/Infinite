
'use client';

import { cn } from "@/lib/utils";

export function BetaBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      {/* Star shape made from two rotated spans */}
      <span
        className="absolute w-full h-full"
        style={{
          backgroundColor: 'gold',
          borderRadius: '20%',
          display: 'block'
        }}
      />
      <span
        className="absolute w-full h-full"
        style={{
          backgroundColor: 'gold',
          borderRadius: '20%',
          transform: 'rotate(45deg)',
          display: 'block'
        }}
      />
      {/* Beta symbol on top */}
      <span className="relative text-[10px] font-black text-black select-none">β</span>
    </span>
  );
}
