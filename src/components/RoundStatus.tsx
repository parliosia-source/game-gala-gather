import { motion } from 'framer-motion';
import { GAME_TYPES, type GameType } from '@/lib/gameTypes';
import type { Database } from '@/integrations/supabase/types';

type Round = Database['public']['Tables']['rounds']['Row'];

interface Props {
  round: Round;
  totalRounds: number;
  remaining: number | null;
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'Préparation...',
  collecting: 'Répondez !',
  voting: 'Votez !',
  results: 'Résultats',
  finished: 'Terminé',
};

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}:${s.toString().padStart(2, '0')}` : `${s}s`;
}

export default function RoundStatus({ round, totalRounds, remaining }: Props) {
  const gameConfig = GAME_TYPES[round.game_type as GameType];
  const isUrgent = remaining !== null && remaining <= 5;

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

        <div className="flex items-center gap-2">
          {remaining !== null && (
            <motion.div
              key={remaining}
              initial={isUrgent ? { scale: 1.3 } : {}}
              animate={{ scale: 1 }}
              transition={{ duration: 0.2 }}
              className={`px-3 py-1 rounded-full font-display text-sm font-bold tabular-nums ${
                isUrgent
                  ? 'bg-destructive/15 text-destructive'
                  : 'bg-accent text-accent-foreground'
              }`}
            >
              ⏱ {formatTime(remaining)}
            </motion.div>
          )}
          <div className="px-3 py-1 rounded-full bg-primary/10 text-primary font-display text-sm font-semibold">
            {STATUS_LABELS[round.status] || round.status}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
