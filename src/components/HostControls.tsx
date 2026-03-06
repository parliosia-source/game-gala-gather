import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { invokeFunction } from '@/lib/invokeFunction';
import type { Database } from '@/integrations/supabase/types';

type Round = Database['public']['Tables']['rounds']['Row'];
type Room = Database['public']['Tables']['rooms']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type Submission = Database['public']['Tables']['submissions']['Row'];

interface Props {
  room: Room;
  round: Round;
  players: Player[];
  submissions: Submission[];
}

export default function HostControls({ room, round, players, submissions }: Props) {
  const [advancing, setAdvancing] = useState(false);

  const submissionCount = submissions.length;
  const playerCount = players.length;
  const allSubmitted = submissionCount >= playerCount;

  const handleAdvance = async () => {
    setAdvancing(true);
    try {
      await invokeFunction('advance-round', { room_id: room.id });
    } catch (e: any) {
      toast.error(e.message || 'Erreur');
    } finally {
      setAdvancing(false);
    }
  };

  if (round.status === 'collecting') {
    return (
      <div className="w-full max-w-md space-y-2">
        <p className="text-center text-sm text-muted-foreground">
          📝 {submissionCount}/{playerCount} réponses reçues
        </p>
        <Button
          onClick={handleAdvance}
          disabled={advancing || submissionCount === 0}
          variant={allSubmitted ? 'default' : 'outline'}
          className="w-full h-11 font-display"
        >
          {advancing ? '⏳' : allSubmitted ? 'Tout le monde a répondu → Continuer' : 'Forcer la suite →'}
        </Button>
      </div>
    );
  }

  if (round.status === 'voting') {
    return (
      <div className="w-full max-w-md space-y-2">
        <p className="text-center text-sm text-muted-foreground">
          🗳️ Phase de vote en cours
        </p>
        <Button
          onClick={handleAdvance}
          disabled={advancing}
          variant="outline"
          className="w-full h-11 font-display"
        >
          {advancing ? '⏳' : 'Passer aux résultats →'}
        </Button>
      </div>
    );
  }

  return null;
}
