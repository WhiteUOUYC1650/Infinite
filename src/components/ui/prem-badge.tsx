
'use client';

import { cn } from "@/lib/utils";

export function PremBadge({ className }: { className?: string }) {
  return (
    <span className={cn("relative inline-flex items-center justify-center w-5 h-5", className)}>
      {/* Star shape made from two rotated spans */}
      <span
        className="absolute w-full h-full"
        style={{
          backgroundColor: '#8B5CF6', // Purple-500
          borderRadius: '20%',
          display: 'block'
        }}
      />
      <span
        className="absolute w-full h-full"
        style={{
          backgroundColor: '#8B5CF6',
          borderRadius: '20%',
          transform: 'rotate(45deg)',
          display: 'block'
        }}
      />
      {/* P symbol on top */}
      <span className="relative text-[10px] font-black text-white select-none">P</span>
    </span>
  );
}
