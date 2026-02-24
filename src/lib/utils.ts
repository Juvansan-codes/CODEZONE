import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// ─── XP-Based Rank System ───────────────────────────────────────────────────

export interface RankTier {
  name: string;
  xp: number;
  color: string;
  emoji: string;
}

export const RANK_TIERS: RankTier[] = [
  { name: 'Bronze', xp: 0, color: '#cd7f32', emoji: '🥉' },
  { name: 'Silver', xp: 100, color: '#c0c0c0', emoji: '🥈' },
  { name: 'Gold', xp: 300, color: '#ffd700', emoji: '🥇' },
  { name: 'Platinum', xp: 600, color: '#00cec9', emoji: '💎' },
  { name: 'Diamond', xp: 1000, color: '#a29bfe', emoji: '💠' },
  { name: 'Master', xp: 1500, color: '#fd79a8', emoji: '🏅' },
  { name: 'Grandmaster', xp: 2500, color: '#e84393', emoji: '👑' },
  { name: 'Legend', xp: 5000, color: '#ff6b6b', emoji: '🔥' },
];

export interface RankInfo {
  rank: RankTier;
  rankIndex: number;
  nextRank: RankTier | null;
  xpInCurrentTier: number;
  xpNeededForNextTier: number;
  progressPercent: number;
  level: number;
}

/**
 * Computes rank, level, and progress from cumulative XP.
 * XP never resets — ranks are milestones on a continuous ladder.
 */
export function getRankFromXP(xp: number): RankInfo {
  const safeXp = Math.max(0, xp || 0);

  // Find the highest tier the player qualifies for
  let rankIndex = 0;
  for (let i = RANK_TIERS.length - 1; i >= 0; i--) {
    if (safeXp >= RANK_TIERS[i].xp) {
      rankIndex = i;
      break;
    }
  }

  const rank = RANK_TIERS[rankIndex];
  const nextRank = rankIndex < RANK_TIERS.length - 1 ? RANK_TIERS[rankIndex + 1] : null;

  const xpInCurrentTier = safeXp - rank.xp;
  const xpNeededForNextTier = nextRank ? nextRank.xp - rank.xp : 0;
  const progressPercent = nextRank
    ? Math.min(100, Math.round((xpInCurrentTier / xpNeededForNextTier) * 100))
    : 100; // Max rank = 100% complete

  // Level = 1 + floor(xp / 50), so every 50 XP = 1 level
  const level = Math.floor(safeXp / 50) + 1;

  return {
    rank,
    rankIndex,
    nextRank,
    xpInCurrentTier,
    xpNeededForNextTier,
    progressPercent,
    level,
  };
}

/** @deprecated Use getRankFromXP instead. Kept for backward compatibility. */
export function getRankFromWins(wins: number): string {
  // Approximate: treat each win as ~10 XP for legacy compat
  return getRankFromXP(wins * 10).rank.name;
}

