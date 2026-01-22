"use client";

import React, { useState, useEffect } from 'react';

const Logo = () => (
  <svg width="120" height="120" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
    <path fillRule="evenodd" clipRule="evenodd" d="M42.4,8.8c-17.5,0-31.7,14.2-31.7,31.7c0,10.6,5.2,20,13.4,26.1l-4.2,7.3c-1.7,3,0.4,6.8,3.9,6.8c1.6,0,3.1-0.6,4.2-1.8l8-13.9c2.5,0.8,5.1,1.2,7.8,1.2c17.5,0,31.7-14.2,31.7-31.7C74,23,59.9,8.8,42.4,8.8z M42.4,64.4c-13.2,0-23.9-10.7-23.9-23.9c0-13.2,10.7-23.9,23.9-23.9s23.9,10.7,23.9,23.9C66.2,53.7,55.5,64.4,42.4,64.4z" fill="white"/>
    <path fillRule="evenodd" clipRule="evenodd" d="M74.9,45.1c-11.4,0-20.6,9.2-20.6,20.6c0,11.4,9.2,20.6,20.6,20.6c11.4,0,20.6-9.2,20.6-20.6C95.5,54.3,86.3,45.1,74.9,45.1z M74.9,78.5c-7.1,0-12.8-5.7-12.8-12.8s5.7-12.8,12.8-12.8s12.8,5.7,12.8,12.8S82,78.5,74.9,78.5z" fill="white"/>
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
