import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { invokeFunction } from '@/lib/invokeFunction';
import { toast } from 'sonner';
import type { Database } from '@/integrations/supabase/types';

type Round = Database['public']['Tables']['rounds']['Row'];
type Room = Database['public']['Tables']['rooms']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type Submission = Database['public']['Tables']['submissions']['Row'];

interface Props {
  round: Round;
  room: Room;
  player: Player;
  players: Player[];
  submissions: Submission[];
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const a = [...arr];
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = ((h << 5) - h + seed.charCodeAt(i)) | 0;
  }
  for (let i = a.length - 1; i > 0; i--) {
    h = ((h << 5) - h + i) | 0;
    const j = Math.abs(h) % (i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export default function GuessWhoGame({ round, player, players, submissions }: Props) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(false);
  const hasSubmitted = submissions.some(s => s.player_id === player.id);
  const config = round.config as { question?: string };

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      await invokeFunction('submit-answer', {
        round_id: round.id, player_id: player.id, answer: { text: answer.trim() },
      });
      toast.success('Phrase envoyée !');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (submissionId: string) => {
    try {
      await invokeFunction('submit-vote', {
        round_id: round.id, player_id: player.id, target_submission_id: submissionId,
      });
      setVoted(true);
      toast.success('Vote enregistré !');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    }
  };

  // Shuffled submissions for voting (exclude own)
  const otherSubs = useMemo(() => {
    if (round.status !== 'voting') return [];
    const subs = submissions.filter(s => s.player_id !== player.id);
    return seededShuffle(subs, round.id);
  }, [round.status, round.id, submissions, player.id]);

  if (round.status === 'collecting') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <Card className="border-2 border-game-orange/30">
          <CardContent className="p-6 space-y-6">
            <div className="text-center">
              <span className="text-4xl block mb-3">🕵️</span>
              <h2 className="text-xl font-display font-bold">{config.question || 'Écrivez une phrase'}</h2>
              <p className="text-muted-foreground text-sm mt-1">Écrivez quelque chose de personnel !</p>
            </div>
            {hasSubmitted ? (
              <div className="text-center py-4">
                <span className="text-3xl">✅</span>
                <p className="font-display font-semibold mt-2">Phrase envoyée !</p>
                <p className="text-muted-foreground text-sm">En attente de l'autre joueur...</p>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Votre phrase..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="text-center text-lg h-12"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !answer.trim()}
                  className="w-full h-12 font-display text-lg"
                >
                  {submitting ? '⏳' : 'Envoyer'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (round.status === 'voting') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <Card className="border-2 border-game-orange/30">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <span className="text-4xl block mb-3">🤔</span>
              <h2 className="text-xl font-display font-bold">Qui a écrit ça ?</h2>
              <p className="text-muted-foreground text-sm mt-1">Sélectionnez la phrase de l'autre joueur</p>
            </div>
            {voted ? (
              <div className="text-center py-4">
                <span className="text-3xl">✅</span>
                <p className="font-display font-semibold mt-2">Vote enregistré !</p>
              </div>
            ) : (
              <div className="space-y-2">
                {otherSubs.map((sub, i) => {
                  const ans = sub.answer as { text?: string };
                  return (
                    <motion.div
                      key={sub.id}
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.15 }}
                    >
                      <Button
                        variant="outline"
                        onClick={() => handleVote(sub.id)}
                        className="w-full h-auto py-3 px-4 text-left justify-start font-medium"
                      >
                        « {ans.text || '???'} »
                      </Button>
                    </motion.div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  return (
    <div className="text-center text-muted-foreground font-display">
      <span className="text-4xl block mb-2">⏳</span>
      Préparation...
    </div>
  );
}
