export type GameType = 'estimation' | 'bluff' | 'vote';

export interface GameTypeConfig {
  label: string;
  emoji: string;
  description: string;
  hasVotingPhase: boolean;
  color: string;
}

export const GAME_TYPES: Record<GameType, GameTypeConfig> = {
  estimation: {
    label: 'Estimation',
    emoji: '🔢',
    description: 'Devinez le nombre le plus proche !',
    hasVotingPhase: false,
    color: 'game-blue',
  },
  bluff: {
    label: 'Bluff',
    emoji: '🎭',
    description: 'Inventez une fausse réponse convaincante !',
    hasVotingPhase: true,
    color: 'game-pink',
  },
  vote: {
    label: 'Vote Social',
    emoji: '🗳️',
    description: 'Votez pour la meilleure réponse !',
    hasVotingPhase: true,
    color: 'game-green',
  },
};

export const AVATAR_COLORS = [
  '#8B5CF6', '#EC4899', '#3B82F6', '#10B981',
  '#F59E0B', '#EF4444', '#06B6D4', '#F97316',
];

export function generateRoomCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}
