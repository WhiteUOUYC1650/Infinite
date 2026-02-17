'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Button } from './ui/button';
import { useLanguage } from '@/context/language-context';
import { InfGoldIcon } from './ui/inf-gold-icon';
import { Loader2 } from 'lucide-react';

// The configuration of prizes. The weight determines the size of the slice.
// Higher weight = larger slice = higher probability.
export const PRIZE_CONFIG = [
  { value: 50, weight: 1.5, color: '#4285F4' }, // Smallest slice
  { value: 1,  weight: 7,   color: '#DB4437' },
  { value: 25, weight: 2,   color: '#F4B400' },
  { value: 2,  weight: 6,   color: '#0F9D58' },
  { value: 10, weight: 3,   color: '#6a5acd' },
  { value: 3,  weight: 5,   color: '#ff69b4' },
  { value: 5,  weight: 4,   color: '#a0522d' },
  { value: 1,  weight: 7,   color: '#708090' }, // Another large slice for 1
];

// Calculate total weight and angles for each prize
const totalWeight = PRIZE_CONFIG.reduce((sum, p) => sum + p.weight, 0);
let cumulativeAngle = 0;
export const PRIZES_WITH_ANGLES = PRIZE_CONFIG.map(prize => {
  const angle = (prize.weight / totalWeight) * 360;
  const startAngle = cumulativeAngle;
  cumulativeAngle += angle;
  const endAngle = cumulativeAngle;
  return { ...prize, angle, startAngle, endAngle };
});


interface DailyBonusWheelProps {
  onSpin: () => Promise<void>;
  isSpinning: boolean;
  setSpinning: (spinning: boolean) => void;
  canSpin: boolean;
  rotation: number;
}

export function DailyBonusWheel({ onSpin, isSpinning, canSpin, rotation }: DailyBonusWheelProps) {
  const { t } = useLanguage();

  const handleSpinClick = async () => {
    if (isSpinning || !canSpin) return;
    setSpinning(true);
    await onSpin();
  };
  
  const conicGradient = PRIZES_WITH_ANGLES.map(p => `${p.color} ${p.startAngle}deg ${p.endAngle}deg`).join(', ');

  return (
    <div className="flex flex-col items-center gap-8 p-4">
      <div className="relative w-64 h-64 md:w-80 md:h-80">
        {/* The pointer */}
        <div className="absolute -top-2 left-1/2 -translate-x-1/2 z-10" style={{ filter: 'drop-shadow(0 2px 2px rgba(0,0,0,0.5))' }}>
          <div className="w-0 h-0 border-x-[12px] border-x-transparent border-t-[20px] border-t-primary"></div>
        </div>

        {/* The wheel */}
        <div
          className="relative w-full h-full rounded-full border-4 border-muted overflow-hidden transition-transform duration-[5000ms] ease-out"
          style={{ 
              transform: `rotate(${rotation}deg)`,
              background: `conic-gradient(${conicGradient})`
           }}
        >
            {/* The center circle */}
            <div 
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background border-2 border-muted-foreground z-20"
            />
            
            {/* The prize labels */}
            {PRIZES_WITH_ANGLES.map((prize, i) => {
                const midAngle = prize.startAngle + prize.angle / 2;
                return (
                    <div
                        key={i}
                        className="absolute top-0 left-0 w-full h-full flex justify-center items-start text-white font-bold text-lg"
                        style={{
                            transform: `rotate(${midAngle}deg)`,
                        }}
                    >
                        <span 
                            className="flex items-center gap-1 pt-4" 
                            style={{ 
                                transform: `rotate(${-midAngle}deg)`,
                                textShadow: '0 1px 1px #000, 0 1px 5px #000',
                            }}
                        >
                            <span>{prize.value}</span>
                            <InfGoldIcon className="w-5 h-5 drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]" />
                        </span>
                    </div>
                );
            })}
        </div>
      </div>
      <Button onClick={handleSpinClick} disabled={isSpinning || !canSpin} size="lg" className='w-48'>
        {isSpinning ? <Loader2 className='animate-spin' /> : (canSpin ? t('spin_the_wheel') : t('come_back_tomorrow'))}
      </Button>
    </div>
  );
}
