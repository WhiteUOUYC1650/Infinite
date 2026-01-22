"use client";

import React, { useState, useEffect } from 'react';

const Logo = () => (
  <svg width="120" height="120" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path
        d="M 25 50 C 25 25, 40 25, 50 50 C 60 75, 75 75, 75 50 C 75 25, 60 25, 50 50 C 40 75, 25 75, 25 50 Z"
        fill="none"
        stroke="white"
        strokeWidth="6"
    />
    <path
        d="M 20 78 L 10 90 L 25 78"
        fill="none"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
    />
     <path
        d="M 80 22 L 90 10 L 75 22"
        fill="none"
        stroke="white"
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
    />
  </svg>
);


export function SplashScreen() {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
    }, 3000);

    return () => clearTimeout(timer);
  }, []);

  if (!isVisible) {
    return null;
  }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center transition-opacity duration-500"
      style={{ backgroundColor: '#FF8C00', opacity: isVisible ? 1 : 0 }}
    >
      <Logo />
    </div>
  );
}
