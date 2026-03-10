/**
 * Phase durations in seconds, keyed by game_type and round status.
 * Duel mode uses shorter timers for faster gameplay.
 */

const NORMAL: Record<string, Record<string, number>> = {
  estimation: { collecting: 20 },
  bluff: { collecting: 25, voting: 15 },
  vote: { collecting: 20, voting: 15 },
  guess_who: { collecting: 20, voting: 15 },
  higher_lower: { collecting: 10 },
  odd_answer: { collecting: 20, voting: 15 },
};

const DUEL: Record<string, Record<string, number>> = {
  estimation: { collecting: 15 },
  bluff: { collecting: 20, voting: 12 },
  vote: { collecting: 15, voting: 12 },
  guess_who: { collecting: 15, voting: 10 },
  higher_lower: { collecting: 8 },
  odd_answer: { collecting: 15, voting: 12 },
};

/** Returns the duration in seconds for a given game type + phase, or null if no timer. */
export function getPhaseDuration(gameType: string, status: string, isDuel = false): number | null {
  const table = isDuel ? DUEL : NORMAL;
  return table[gameType]?.[status] ?? null;
}
