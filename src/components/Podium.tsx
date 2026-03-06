import { motion } from 'framer-motion';
import type { Database } from '@/integrations/supabase/types';

type Player = Database['public']['Tables']['players']['Row'];

interface Props {
  players: Player[];
}

const PODIUM_CONFIG = [
  { order: 1, height: 'h-32', emoji: '🥇', delay: 0.3 },
  { order: 0, height: 'h-24', emoji: '🥈', delay: 0.5 },
  { order: 2, height: 'h-16', emoji: '🥉', delay: 0.7 },
];

export default function Podium({ players }: Props) {
  // Reorder: 2nd, 1st, 3rd for visual layout
  const ordered = [players[1], players[0], players[2]].filter(Boolean);

  return (
    <div className="flex items-end justify-center gap-3">
      {ordered.map((player, i) => {
        const config = PODIUM_CONFIG[i];
        if (!player || !config) return null;
        return (
          <motion.div
            key={player.id}
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: config.delay, type: 'spring' }}
            className="flex flex-col items-center"
          >
            <span className="text-2xl mb-1">{config.emoji}</span>
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold mb-2"
              style={{ backgroundColor: player.avatar_color, color: 'white' }}
            >
              {player.nickname[0]?.toUpperCase()}
            </div>
            <p className="font-display font-semibold text-sm mb-1 truncate max-w-[80px] text-center">
              {player.nickname}
            </p>
            <p className="text-xs font-display text-primary font-bold mb-2">{player.score} pts</p>
            <div className={`w-20 ${config.height} rounded-t-lg bg-primary/20`} />
          </motion.div>
        );
      })}
    </div>
  );
}
