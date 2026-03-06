import { describe, it, expect } from 'vitest';
import { getRankFromXP, getAdjacentTiers, RANK_TIERS } from '@/lib/utils';

describe('getRankFromXP', () => {
    it('should return Iron for 0 XP', () => {
        const info = getRankFromXP(0);
        expect(info.rank.name).toBe('Iron');
        expect(info.rankIndex).toBe(0);
    });

    it('should return Iron for 999 XP', () => {
        const info = getRankFromXP(999);
        expect(info.rank.name).toBe('Iron');
    });

    it('should return Bronze for 1000 XP', () => {
        const info = getRankFromXP(1000);
        expect(info.rank.name).toBe('Bronze');
        expect(info.rankIndex).toBe(1);
    });

    it('should return Silver for 2500 XP', () => {
        expect(getRankFromXP(2500).rank.name).toBe('Silver');
    });

    it('should return Gold for 5000 XP', () => {
        expect(getRankFromXP(5000).rank.name).toBe('Gold');
    });

    it('should return Platinum for 7500 XP', () => {
        expect(getRankFromXP(7500).rank.name).toBe('Platinum');
    });

    it('should return Diamond for 10000 XP', () => {
        expect(getRankFromXP(10000).rank.name).toBe('Diamond');
    });

    it('should return Master for 15000 XP', () => {
        expect(getRankFromXP(15000).rank.name).toBe('Master');
    });

    it('should return Grandmaster for 20000 XP', () => {
        const info = getRankFromXP(20000);
        expect(info.rank.name).toBe('Grandmaster');
        expect(info.nextRank).toBeNull();
        expect(info.progressPercent).toBe(100);
    });

    it('should return Grandmaster for 99999 XP', () => {
        expect(getRankFromXP(99999).rank.name).toBe('Grandmaster');
    });

    it('should handle negative XP gracefully', () => {
        const info = getRankFromXP(-100);
        expect(info.rank.name).toBe('Iron');
        expect(info.level).toBe(1);
    });

    it('should calculate progress correctly mid-tier', () => {
        // Iron: 0–999, Bronze starts at 1000
        const info = getRankFromXP(500);
        expect(info.rank.name).toBe('Iron');
        expect(info.progressPercent).toBe(50); // 500/1000 = 50%
        expect(info.nextRank?.name).toBe('Bronze');
    });

    it('should calculate levels based on 200 XP per level', () => {
        expect(getRankFromXP(0).level).toBe(1);
        expect(getRankFromXP(200).level).toBe(2);
        expect(getRankFromXP(1000).level).toBe(6);
        expect(getRankFromXP(20000).level).toBe(101);
    });
});

describe('getAdjacentTiers', () => {
    it('should return Iron and Bronze for Iron (bottom edge)', () => {
        const tiers = getAdjacentTiers('Iron');
        expect(tiers).toEqual(['Iron', 'Bronze']);
    });

    it('should return Iron, Bronze, Silver for Bronze (middle)', () => {
        const tiers = getAdjacentTiers('Bronze');
        expect(tiers).toEqual(['Iron', 'Bronze', 'Silver']);
    });

    it('should return Silver, Gold, Platinum for Gold', () => {
        const tiers = getAdjacentTiers('Gold');
        expect(tiers).toEqual(['Silver', 'Gold', 'Platinum']);
    });

    it('should return Master and Grandmaster for Grandmaster (top edge)', () => {
        const tiers = getAdjacentTiers('Grandmaster');
        expect(tiers).toEqual(['Master', 'Grandmaster']);
    });

    it('should return the tier itself for unknown tier names', () => {
        const tiers = getAdjacentTiers('Unknown');
        expect(tiers).toEqual(['Unknown']);
    });
});

describe('RANK_TIERS', () => {
    it('should have exactly 8 tiers', () => {
        expect(RANK_TIERS).toHaveLength(8);
    });

    it('should be sorted by ascending XP', () => {
        for (let i = 1; i < RANK_TIERS.length; i++) {
            expect(RANK_TIERS[i].xp).toBeGreaterThan(RANK_TIERS[i - 1].xp);
        }
    });

    it('should start at 0 XP for Iron', () => {
        expect(RANK_TIERS[0].name).toBe('Iron');
        expect(RANK_TIERS[0].xp).toBe(0);
    });

    it('should end at 20000 XP for Grandmaster', () => {
        expect(RANK_TIERS[7].name).toBe('Grandmaster');
        expect(RANK_TIERS[7].xp).toBe(20000);
    });
});
