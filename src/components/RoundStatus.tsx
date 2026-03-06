import { motion } from 'framer-motion';
import { GAME_TYPES, type GameType } from '@/lib/gameTypes';
import type { Database } from '@/integrations/supabase/types';

type Round = Database['public']['Tables']['rounds']['Row'];

interface Props {
  round: Round;
  totalRounds: number;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Préparation...',
  collecting: 'Répondez !',
  voting: 'Votez !',
  results: 'Résultats',
  finished: 'Terminé',
};

export default function RoundStatus({ round, totalRounds }: Props) {
  const gameConfig = GAME_TYPES[round.game_type as GameType];

  return (
    <motion.div
      initial={{ y: -50 }}
      animate={{ y: 0 }}
      className="bg-card border-b p-4"
    >
      <div className="max-w-md mx-auto flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{gameConfig?.emoji}</span>
          <div>
            <p className="font-display font-semibold text-sm">{gameConfig?.label}</p>
            <p className="text-xs text-muted-foreground">
              Manche {round.round_number}/{totalRounds}
            </p>
          </div>
        </div>
        <div className="px-3 py-1 rounded-full bg-primary/10 text-primary font-display text-sm font-semibold">
          {STATUS_LABELS[round.status] || round.status}
        </div>
      </div>
    </motion.div>
  );
}
