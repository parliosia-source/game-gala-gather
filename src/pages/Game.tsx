import { useParams, useNavigate } from 'react-router-dom';
import { useRoom } from '@/hooks/useRoom';
import { useRound } from '@/hooks/useRound';
import { useAuth } from '@/hooks/useAuth';
import { usePhaseTimer } from '@/hooks/usePhaseTimer';
import { useEffect, useCallback, useRef } from 'react';
import { motion } from 'framer-motion';
import GameRouter from '@/components/games/GameRouter';
import RoundStatus from '@/components/RoundStatus';
import PlayerList from '@/components/PlayerList';
import HostControls from '@/components/HostControls';
import { invokeFunction } from '@/lib/invokeFunction';

export default function Game() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { room, players } = useRoom(code ?? null);
  const { user } = useAuth();
  const currentRound = room?.current_round || 1;
  const { round, submissions } = useRound(room?.id ?? null, currentRound);

  const currentPlayer = players.find(p => p.user_id === user?.id);
  const isHost = room?.host_id === user?.id;
  const advancingRef = useRef(false);

  useEffect(() => {
    if (room?.status === 'finished') {
      navigate(`/results/${room.code}`);
    }
  }, [room?.status, room?.code, navigate]);

  const handleTimerExpired = useCallback(async () => {
    if (!isHost || !room || advancingRef.current) return;
    advancingRef.current = true;
    try {
      await invokeFunction('advance-round', { room_id: room.id });
    } catch {
      // Host may have already advanced manually
    } finally {
      advancingRef.current = false;
    }
  }, [isHost, room?.id]);

  // Reset advancing ref on phase change
  useEffect(() => {
    advancingRef.current = false;
  }, [round?.status, round?.started_at]);

  const { remaining } = usePhaseTimer({
    gameType: round?.game_type || '',
    status: round?.status || '',
    startedAt: round?.started_at || null,
    onExpired: handleTimerExpired,
  });

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
      <RoundStatus round={round} totalRounds={5} remaining={remaining} />
      
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
