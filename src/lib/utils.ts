import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function getRankFromWins(wins: number): string {
  if (wins >= 250) return 'Grandmaster';
  if (wins >= 100) return 'Master';
  if (wins >= 50) return 'Diamond';
  if (wins >= 30) return 'Platinum';
  if (wins >= 15) return 'Gold';
  if (wins >= 5) return 'Silver';
  return 'Bronze';
}

