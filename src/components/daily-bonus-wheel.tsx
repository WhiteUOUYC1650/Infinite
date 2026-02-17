'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useLanguage } from '@/context/language-context';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { Loader2 } from 'lucide-react';

interface DailyBonusWheelProps {
  onSpin: () => Promise<number>;
  isSpinning: boolean;
  setSpinning: (spinning: boolean) => void;
  canSpin: boolean;
  rotation: number;
}

export const PRIZES = [50, 1, 25, 2, 10, 3, 5, 1]; // 8 segments, arranged for visual balance

export function DailyBonusWheel({ onSpin, isSpinning, setSpinning, canSpin, rotation }: DailyBonusWheelProps) {
  const { t } = useLanguage();

  const handleSpinClick = async () => {
    if (isSpinning || !canSpin) return;
    
    setSpinning(true);
    await onSpin();
  };

  const segmentColors = [
    '#4285F4', '#DB4437', '#F4B400', '#0F9D58', '#6a5acd', '#ff69b4', '#a0522d', '#708090'
  ];

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      <div className="relative w-64 h-64 md:w-80 md:h-80">
        <div 
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border-2 border-muted-foreground z-20"
        />
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>
          <div className="w-0 h-0 border-x-[12px] border-x-transparent border-t-[20px] border-t-primary"></div>
        </div>

        <ul
          className="relative w-full h-full rounded-full border-4 border-muted overflow-hidden transition-transform duration-[5000ms] ease-out list-none m-0 p-0"
          style={{ transform: `rotate(${rotation}deg)` }}
        >
          {PRIZES.map((prize, i) => {
            const angle = 360 / PRIZES.length;
            return (
              <li
                key={i}
                className="absolute w-full h-full"
                style={{ 
                    transform: `rotate(${angle * i}deg)`,
                    clipPath: 'polygon(50% 0, 100% 0, 100% 50%, 50% 50%)'
                 }}
              >
                <div
                  className="absolute w-full h-full flex items-center justify-start text-white font-bold text-lg"
                  style={{
                    backgroundColor: segmentColors[i],
                    transform: 'rotate(-22.5deg) skewX(45deg)', // Magic numbers for 8 segments
                    transformOrigin: '0% 0%',
                    paddingLeft: '3rem',
                    paddingTop: '1rem',
                  }}
                >
                    <span style={{transform: 'skewX(-45deg)'}} className='flex items-center gap-1'>
                        {prize}
                    </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
      <Button onClick={handleSpinClick} disabled={isSpinning || !canSpin} size="lg" className='w-48'>
        {isSpinning ? <Loader2 className='animate-spin' /> : (canSpin ? t('spin_the_wheel') : t('come_back_tomorrow'))}
      </Button>
    </div>
  );
}
