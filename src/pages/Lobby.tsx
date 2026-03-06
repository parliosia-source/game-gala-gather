import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { useRoom } from '@/hooks/useRoom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Copy, Play, Users } from 'lucide-react';
import { toast } from 'sonner';
import { useEffect, useState } from 'react';

export default function Lobby() {
  const { code } = useParams<{ code: string }>();
  const navigate = useNavigate();
  const { room, players, loading } = useRoom(code ?? null);
  const { user } = useAuth();
  const [starting, setStarting] = useState(false);

  const isHost = room?.host_id === user?.id;

  useEffect(() => {
    if (room?.status === 'playing') {
      navigate(`/game/${room.code}`);
    }
    if (room?.status === 'finished') {
      navigate(`/results/${room.code}`);
    }
  }, [room?.status, room?.code, navigate]);

  const copyCode = () => {
    navigator.clipboard.writeText(code || '');
    toast.success('Code copié !');
  };

  const startGame = async () => {
    if (!room) return;
    setStarting(true);
    try {
      const { error } = await supabase.functions.invoke('start-game', {
        body: { room_id: room.id },
      });
      if (error) throw error;
    } catch (e: any) {
      toast.error(e.message || 'Erreur au lancement');
      setStarting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 1 }}>
          🎮
        </motion.div>
      </div>
    );
  }

  if (!room) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardContent className="p-6 text-center">
            <p className="text-xl mb-4">Room introuvable 😕</p>
            <Button onClick={() => navigate('/')}>Retour à l'accueil</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md space-y-6"
      >
        <div className="text-center">
          <h1 className="text-3xl font-display font-bold mb-2">Salon d'attente</h1>
          <button
            onClick={copyCode}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-primary/10 text-primary font-mono text-2xl tracking-[0.3em] font-bold hover:bg-primary/20 transition-colors"
          >
            {code} <Copy className="h-5 w-5" />
          </button>
          <p className="text-muted-foreground text-sm mt-2">Partage ce code à tes amis !</p>
        </div>

        <Card className="border-2 border-border">
          <CardContent className="p-4">
            <div className="flex items-center gap-2 mb-4">
              <Users className="h-5 w-5 text-muted-foreground" />
              <span className="font-display font-semibold">
                Joueurs ({players.length})
              </span>
            </div>
            <div className="space-y-2">
              <AnimatePresence>
                {players.map((player, i) => (
                  <motion.div
                    key={player.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-center gap-3 p-3 rounded-lg bg-muted/50"
                  >
                    <div
                      className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
                      style={{ backgroundColor: player.avatar_color, color: 'white' }}
                    >
                      {player.nickname[0]?.toUpperCase()}
                    </div>
                    <span className="font-medium flex-1">{player.nickname}</span>
                    {player.is_host && (
                      <span className="text-xs bg-secondary text-secondary-foreground px-2 py-1 rounded-full font-semibold">
                        👑 Hôte
                      </span>
                    )}
                  </motion.div>
                ))}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>

        {isHost && (
          <Button
            onClick={startGame}
            disabled={starting || players.length < 2}
            className="w-full h-14 text-lg font-display"
            size="lg"
          >
            <Play className="mr-2 h-5 w-5" />
            {starting ? 'Lancement...' : players.length < 2 ? 'En attente de joueurs...' : 'Lancer la partie !'}
          </Button>
        )}

        {!isHost && (
          <div className="text-center text-muted-foreground font-display">
            ⏳ En attente que l'hôte lance la partie...
          </div>
        )}
      </motion.div>
    </div>
  );
}
