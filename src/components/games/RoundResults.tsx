import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
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

type RevealPhase = 'answers' | 'votes' | 'scores' | 'leaderboard';
const REVEAL_PHASES: RevealPhase[] = ['answers', 'votes', 'scores', 'leaderboard'];
const PHASE_DELAY = 800;

export default function RoundResults({ round, room, player, players, submissions }: Props) {
  const [scoreEvents, setScoreEvents] = useState<ScoreEvent[]>([]);
  const [advancing, setAdvancing] = useState(false);
  const [revealIndex, setRevealIndex] = useState(0);
  const isHost = room.host_id === player.user_id;
  const config = round.config as Record<string, any>;

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

  // Progressive reveal
  useEffect(() => {
    if (revealIndex < REVEAL_PHASES.length - 1) {
      const timer = setTimeout(() => setRevealIndex(i => i + 1), PHASE_DELAY);
      return () => clearTimeout(timer);
    }
  }, [revealIndex]);

  const currentPhase = REVEAL_PHASES[revealIndex];

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await invokeFunction('advance-round', { room_id: room.id });
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
      setAdvancing(false);
    }
  };

  const realSubmissions = submissions.filter(s => {
    const ans = s.answer as Record<string, any>;
    return !ans?.is_bot;
  });

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
      <Card>
        <CardContent className="p-6 space-y-4">
          <div className="text-center">
            <span className="text-4xl block mb-2">📊</span>
            <h2 className="text-xl font-display font-bold">Résultats de la manche</h2>
            {config.question && (
              <p className="text-sm text-muted-foreground mt-1">{config.question}</p>
            )}
          </div>

          <AnimatePresence mode="wait">
            {/* Phase 1: Answers */}
            {revealIndex >= 0 && (
              <motion.div
                key="answers"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide">
                  📝 Réponses
                </p>
                {round.game_type === 'estimation' && config.answer != null && (
                  <div className="text-center py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground">Bonne réponse</p>
                    <p className="text-2xl font-display font-bold text-primary">{config.answer} {config.unit || ''}</p>
                  </div>
                )}
                {round.game_type === 'bluff' && config.real_answer && (
                  <div className="text-center py-2 px-3 rounded-lg bg-primary/10 border border-primary/20">
                    <p className="text-xs text-muted-foreground">Vraie réponse</p>
                    <p className="text-lg font-display font-bold text-primary">{config.real_answer}</p>
                  </div>
                )}
                {realSubmissions.map((sub, i) => {
                  const p = players.find(pl => pl.id === sub.player_id);
                  const ans = sub.answer as Record<string, any>;
                  const display = ans?.value != null ? ans.value : ans?.text || '???';
                  return (
                    <motion.div
                      key={sub.id}
                      initial={{ opacity: 0, x: -15 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <div
                        className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                        style={{ backgroundColor: p?.avatar_color, color: 'white' }}
                      >
                        {p?.nickname[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{p?.nickname}</p>
                      </div>
                      <span className="text-sm font-display">{display}</span>
                    </motion.div>
                  );
                })}
              </motion.div>
            )}

            {/* Phase 2: Votes (for bluff/vote games) */}
            {revealIndex >= 1 && (round.game_type === 'bluff' || round.game_type === 'vote') && (
              <motion.div
                key="votes"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-1"
              >
                <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide mt-2">
                  🗳️ Votes reçus
                </p>
                {realSubmissions.map((sub) => {
                  const p = players.find(pl => pl.id === sub.player_id);
                  const voteCount = scoreEvents.filter(e => 
                    e.player_id === sub.player_id && e.reason.includes('voté') || e.reason.includes('vote')
                  ).length > 0 ? 
                    parseInt((scoreEvents.find(e => e.player_id === sub.player_id && (e.reason.includes('voté') || e.reason.includes('vote')))?.reason || '0').match(/\d+/)?.[0] || '0') 
                    : 0;
                  return (
                    <div key={sub.id} className="flex items-center gap-2 text-sm">
                      <span className="font-medium">{p?.nickname}</span>
                      <span className="text-muted-foreground">→ {voteCount} vote(s)</span>
                    </div>
                  );
                })}
              </motion.div>
            )}

            {/* Phase 3: Scores */}
            {revealIndex >= 2 && (
              <motion.div
                key="scores"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide mt-2">
                  ⭐ Points gagnés
                </p>
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
                        className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold shrink-0"
                        style={{ backgroundColor: eventPlayer?.avatar_color, color: 'white' }}
                      >
                        {eventPlayer?.nickname[0]?.toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm">{eventPlayer?.nickname}</p>
                        <p className="text-xs text-muted-foreground truncate">{event.reason}</p>
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
              </motion.div>
            )}

            {/* Phase 4: Leaderboard */}
            {revealIndex >= 3 && (
              <motion.div
                key="leaderboard"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-2"
              >
                <p className="text-xs font-display font-semibold text-muted-foreground uppercase tracking-wide mt-2">
                  🏅 Classement
                </p>
                {[...players].sort((a, b) => b.score - a.score).map((p, i) => (
                  <div key={p.id} className="flex items-center gap-3 p-2 rounded-lg">
                    <span className="text-lg font-display font-bold w-6 text-center">
                      {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`}
                    </span>
                    <div
                      className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold shrink-0"
                      style={{ backgroundColor: p.avatar_color, color: 'white' }}
                    >
                      {p.nickname[0]?.toUpperCase()}
                    </div>
                    <span className="flex-1 text-sm font-medium">{p.nickname}</span>
                    <span className="font-display font-bold">{p.score} pts</span>
                  </div>
                ))}
              </motion.div>
            )}
          </AnimatePresence>

          {isHost && round.status === 'results' && revealIndex >= 3 && (
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
