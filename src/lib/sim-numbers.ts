'use client';

import { Capacitor, registerPlugin } from '@capacitor/core';

export type SimNumber = {
  slot: number;
  number: string;
  carrier?: string;
};

type PhoneNumbersPlugin = {
  checkPermissions(): Promise<{ phone: PermissionState }>;
  requestPermissions(): Promise<{ phone: PermissionState }>;
  getSimNumbers(): Promise<{ numbers: SimNumber[] }>;
};

type PermissionState = 'prompt' | 'granted' | 'denied';

const PhoneNumbers = registerPlugin<PhoneNumbersPlugin>('PhoneNumbers');

export function isSimDetectionSupported(): boolean {
  return Capacitor.isNativePlatform() && Capacitor.getPlatform() === 'android';
}

export async function requestSimPermission(): Promise<PermissionState> {
  if (!isSimDetectionSupported()) return 'denied';
  const current = await PhoneNumbers.checkPermissions();
  if (current.phone === 'granted') return 'granted';
  const result = await PhoneNumbers.requestPermissions();
  return result.phone;
}

export async function readSimNumbers(): Promise<SimNumber[]> {
  if (!isSimDetectionSupported()) return [];
  const permission = await requestSimPermission();
  if (permission !== 'granted') return [];
  const { numbers } = await PhoneNumbers.getSimNumbers();
  return numbers.filter(entry => !!entry.number);
}
