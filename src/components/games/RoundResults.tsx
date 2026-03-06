import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { invokeFunction } from '@/lib/invokeFunction';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Round = Database['public']['Tables']['rounds']['Row'];
type Room = Database['public']['Tables']['rooms']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type Submission = Database['public']['Tables']['submissions']['Row'];
type ScoreEvent = Database['public']['Tables']['score_events']['Row'];

interface Props {
  round: Round;
  room: Room;
  player: Player;
  players: Player[];
  submissions: Submission[];
}

export default function RoundResults({ round, room, player, players }: Props) {
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [advancing, setAdvancing] = useState(false);
  const isHost = room.host_id === player.user_id;

  useEffect(() => {
    const fetchScores = async () => {
      const { data } = await supabase
        .from('score_events')
        .select('*')
        .eq('round_id', round.id)
        .order('points', { ascending: false });
      if (data) setScoreEvents(data);
    };
    fetchScores();
  }, [round.id, round.status]);

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await invokeFunction('advance-round', { room_id: room.id });
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
      setAdvancing(false);
    }
  };

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="text-center">
            <span className="text-4xl block mb-2">📊</span>
            <h2 className="text-xl font-display font-bold">Résultats de la manche</h2>
          </div>

          <div className="space-y-2">
            {scoreEvents.map((event, i) => {
              const eventPlayer = players.find(p => p.id === event.player_id);
              return (
                <motion.div
                  key={event.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: eventPlayer?.avatar_color, color: 'white' }}
                  >
                    {eventPlayer?.nickname[0]?.toUpperCase()}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{eventPlayer?.nickname}</p>
                    <p className="text-xs text-muted-foreground">{event.reason}</p>
                  </div>
                  <span className="font-display font-bold text-primary">
                    +{event.points}
                  </span>
                </motion.div>
              );
            })}
            {scoreEvents.length === 0 && (
              <p className="text-center text-muted-foreground text-sm">Aucun score pour cette manche</p>
            )}
          </div>

          {isHost && round.status === 'results' && (
            <Button
              onClick={handleAdvance}
              disabled={advancing}
              className="w-full h-12 font-display text-lg"
            >
              {advancing ? '⏳' : 'Manche suivante →'}
            </Button>
          )}

          {!isHost && round.status === 'results' && (
            <p className="text-center text-muted-foreground text-sm font-display">
              ⏳ L'hôte passe à la manche suivante...
            </p>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
