import { useState } from 'react';
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

export default function BluffGame({ round, player, submissions }: Props) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [voted, setVoted] = useState(false);
  const hasSubmitted = submissions.some(s => s.player_id === player.id);
  const config = round.config as { question?: string; real_answer?: string };

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      await invokeFunction('submit-answer', {
        round_id: round.id, player_id: player.id, answer: { text: answer.trim() },
      });
      toast.success('Bluff envoyé !');
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

  if (round.status === 'collecting') {
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <Card className="border-2 border-game-pink/30">
          <CardContent className="p-6 space-y-6">
            <div className="text-center">
              <span className="text-4xl block mb-3">🎭</span>
              <h2 className="text-xl font-display font-bold">{config.question || 'Question'}</h2>
              <p className="text-muted-foreground text-sm mt-1">Inventez une fausse réponse crédible !</p>
            </div>
            {hasSubmitted ? (
              <div className="text-center py-4">
                <span className="text-3xl">✅</span>
                <p className="font-display font-semibold mt-2">Bluff envoyé !</p>
                <p className="text-muted-foreground text-sm">En attente des autres joueurs...</p>
              </div>
            ) : (
              <>
                <Input
                  placeholder="Votre fausse réponse..."
                  value={answer}
                  onChange={(e) => setAnswer(e.target.value)}
                  className="text-center text-lg h-12"
                />
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !answer.trim()}
                  className="w-full h-12 font-display text-lg"
                >
                  {submitting ? '⏳' : 'Envoyer le bluff'}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </motion.div>
    );
  }

  if (round.status === 'voting') {
    const otherSubmissions = submissions.filter(s => s.player_id !== player.id);
    return (
      <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
        <Card className="border-2 border-game-pink/30">
          <CardContent className="p-6 space-y-4">
            <div className="text-center">
              <span className="text-4xl block mb-3">🗳️</span>
              <h2 className="text-xl font-display font-bold">Quelle est la vraie réponse ?</h2>
            </div>
            {voted ? (
              <div className="text-center py-4">
                <span className="text-3xl">✅</span>
                <p className="font-display font-semibold mt-2">Vote enregistré !</p>
              </div>
            ) : (
              <div className="space-y-2">
                {otherSubmissions.map(s => {
                  const answerData = s.answer as { text?: string };
                  return (
                    <Button
                      key={s.id}
                      variant="outline"
                      onClick={() => handleVote(s.id)}
                      className="w-full h-auto py-3 text-left justify-start"
                    >
                      {answerData.text || '???'}
                    </Button>
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
