import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '@/hooks/useRoom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import Podium from '@/components/Podium';

export default function Results() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { room, players } = useRoom(code ?? null);

  const sorted = [...players].sort((a, b) => b.score - a.score);

  return (
    <div className="min-h-screen bg-background flex flex-col items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-md space-y-8"
      >
        <div className="text-center">
          <motion.span
            className="text-6xl inline-block"
            animate={{ rotate: [0, -10, 10, 0] }}
            transition={{ repeat: Infinity, duration: 2 }}
          >
            🏆
          </motion.span>
          <h1 className="text-3xl font-display font-bold mt-4">Classement final</h1>
        </div>

        <Podium players={sorted.slice(0, 3)} />

        <div className="space-y-2">
          {sorted.map((player, i) => (
            <motion.div
              key={player.id}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.1 }}
              className="flex items-center gap-3 p-3 rounded-lg bg-card border"
            >
              <span className="font-display font-bold text-lg w-8 text-center text-muted-foreground">
                {i + 1}
              </span>
              <div
                className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: player.avatar_color, color: 'white' }}
              >
                {player.nickname[0]?.toUpperCase()}
              </div>
              <span className="font-medium flex-1">{player.nickname}</span>
              <span className="font-display font-bold text-primary">{player.score} pts</span>
            </motion.div>
          ))}
        </div>

        <Button onClick={() => navigate('/')} className="w-full h-12 font-display text-lg">
          🏠 Retour à l'accueil
        </Button>
      </motion.div>
    </div>
  );
}
