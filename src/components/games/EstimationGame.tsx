import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
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
  submissions: Submission[];
}

export default function EstimationGame({ round, room, player, submissions }: Props) {
  const [answer, setAnswer] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const hasSubmitted = submissions.some(s => s.player_id === player.id);
  const config = round.config as { question?: string; unit?: string };

  const handleSubmit = async () => {
    if (!answer.trim()) return;
    setSubmitting(true);
    try {
      const { error } = await supabase.functions.invoke('submit-answer', {
        body: { round_id: round.id, player_id: player.id, answer: { value: Number(answer) } },
      });
      if (error) throw error;
      toast.success('Réponse envoyée !');
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setSubmitting(false);
    }
  };

  if (round.status !== 'collecting') {
    return (
      <div className="text-center text-muted-foreground font-display">
        <span className="text-4xl block mb-2">⏳</span>
        Préparation de la question...
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
      <Card className="border-2 border-game-blue/30">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <span className="text-4xl block mb-3">🔢</span>
            <h2 className="text-xl font-display font-bold">{config.question || 'Question'}</h2>
            {config.unit && <p className="text-muted-foreground text-sm mt-1">Répondez en {config.unit}</p>}
          </div>

          {hasSubmitted ? (
            <div className="text-center py-4">
              <span className="text-3xl">✅</span>
              <p className="font-display font-semibold mt-2">Réponse envoyée !</p>
              <p className="text-muted-foreground text-sm">En attente des autres joueurs...</p>
            </div>
          ) : (
            <>
              <Input
                type="number"
                placeholder="Votre estimation"
                value={answer}
                onChange={(e) => setAnswer(e.target.value)}
                className="text-center text-2xl h-14 font-display"
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
