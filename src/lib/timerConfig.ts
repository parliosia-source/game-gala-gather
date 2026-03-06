/**
 * Phase durations in seconds, keyed by game_type and round status.
 * Used client-side to compute countdown from round.started_at.
 */

export const PHASE_DURATIONS: Record<string, Record<string, number>> = {
  estimation: {
    collecting: 20,
  },
  bluff: {
    collecting: 25,
    voting: 15,
  },
  vote: {
    collecting: 20,
    voting: 15,
  },
};

/** Returns the duration in seconds for a given game type + phase, or null if no timer. */
export function getPhaseDuration(gameType: string, status: string): number | null {
  return PHASE_DURATIONS[gameType]?.[status] ?? null;
}
