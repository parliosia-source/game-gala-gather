import { useState } from 'react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
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
  submissions: Submission[];
}

export default function HigherLowerGame({ round, player, submissions }: Props) {
  const [submitting, setSubmitting] = useState(false);
  const hasSubmitted = submissions.some(s => s.player_id === player.id);
  const config = round.config as { question?: string; reference_value?: number; unit?: string };

  const handleGuess = async (guess: 'higher' | 'lower') => {
    setSubmitting(true);
    try {
      await invokeFunction('submit-answer', {
        round_id: round.id, player_id: player.id, answer: { guess },
      });
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
        Préparation...
      </div>
    );
  }

  return (
    <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} className="w-full max-w-md">
      <Card className="border-2 border-game-yellow/30">
        <CardContent className="p-6 space-y-6">
          <div className="text-center">
            <span className="text-4xl block mb-3">⬆️⬇️</span>
            <h2 className="text-xl font-display font-bold">{config.question || 'Question'}</h2>
            <p className="text-muted-foreground text-sm mt-2">La vraie valeur est-elle...</p>
          </div>

          <div className="text-center py-4">
            <div className="inline-block px-6 py-3 rounded-2xl bg-muted">
              <p className="text-xs text-muted-foreground">Valeur de référence</p>
              <p className="text-4xl font-display font-bold text-primary">
                {config.reference_value ?? '?'}
              </p>
              {config.unit && <p className="text-sm text-muted-foreground">{config.unit}</p>}
            </div>
          </div>

          {hasSubmitted ? (
            <div className="text-center py-4">
              <span className="text-3xl">✅</span>
              <p className="font-display font-semibold mt-2">Réponse envoyée !</p>
              <p className="text-muted-foreground text-sm">En attente de l'autre joueur...</p>
            </div>
          ) : (
            <div className="flex gap-3">
              <Button
                onClick={() => handleGuess('higher')}
                disabled={submitting}
                className="flex-1 h-14 font-display text-lg"
                variant="outline"
              >
                ⬆️ Plus haut
              </Button>
              <Button
                onClick={() => handleGuess('lower')}
                disabled={submitting}
                className="flex-1 h-14 font-display text-lg"
                variant="outline"
              >
                ⬇️ Plus bas
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </motion.div>
  );
}
