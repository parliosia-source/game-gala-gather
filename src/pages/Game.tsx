import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '@/hooks/useRoom';
import { useRound } from '@/hooks/useRound';
import { useAuth } from '@/hooks/useAuth';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import GameRouter from '@/components/games/GameRouter';
import RoundStatus from '@/components/RoundStatus';
import PlayerList from '@/components/PlayerList';
import HostControls from '@/components/HostControls';

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { room, players } = useRoom(code ?? null);
  const { user } = useAuth();
  const currentRound = room?.current_round || 1;
  const { round, submissions } = useRound(room?.id ?? null, currentRound);

  const currentPlayer = players.find(p => p.user_id === user?.id);
  const isHost = room?.host_id === user?.id;

  useEffect(() => {
    if (room?.status === 'finished') {
      navigate(`/results/${room.code}`);
    }
  }, [room?.status, room?.code, navigate]);

  if (!room || !round || !currentPlayer) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div animate={{ scale: [1, 1.2, 1] }} transition={{ repeat: Infinity, duration: 1.5 }}>
          <span className="text-4xl">🎮</span>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <RoundStatus round={round} totalRounds={5} />
      
      <div className="flex-1 flex flex-col items-center justify-center p-4 gap-4">
        <GameRouter
          round={round}
          room={room}
          player={currentPlayer}
          players={players}
          submissions={submissions}
        />

        {isHost && (round.status === 'collecting' || round.status === 'voting') && (
          <HostControls room={room} round={round} players={players} submissions={submissions} />
        )}
      </div>

      <PlayerList players={players} compact />
    </div>
  );
}
