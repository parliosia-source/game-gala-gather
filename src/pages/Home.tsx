import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { generateRoomCode, AVATAR_COLORS } from '@/lib/gameTypes';
import { Users, Sparkles } from 'lucide-react';

export default function Home() {
  const navigate = useNavigate();
  const { user, signInAnonymously } = useAuth();
  const [nickname, setNickname] = useState('');
  const [joinCode, setJoinCode] = useState('');
  const [mode, setMode] = useState<'menu' | 'create' | 'join'>('menu');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const ensureAuth = async () => {
    if (user) return user;
    return await signInAnonymously();
  };

  const handleCreate = async () => {
    if (!nickname.trim()) { setError('Choisis un pseudo !'); return; }
    setLoading(true);
    setError('');
    try {
      const authUser = await ensureAuth();
      if (!authUser) throw new Error('Auth failed');
      const code = generateRoomCode();
      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];

      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .insert({ code, host_id: authUser.id })
        .select()
        .single();
      if (roomErr) throw roomErr;

      const { error: playerErr } = await supabase
        .from('players')
        .insert({ room_id: room.id, user_id: authUser.id, nickname: nickname.trim(), avatar_color: color, is_host: true });
      if (playerErr) throw playerErr;

      navigate(`/lobby/${code}`);
    } catch (e: any) {
      setError(e.message || 'Erreur lors de la création');
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    if (!nickname.trim()) { setError('Choisis un pseudo !'); return; }
    if (!joinCode.trim()) { setError('Entre un code !'); return; }
    setLoading(true);
    setError('');
    try {
      const authUser = await ensureAuth();
      if (!authUser) throw new Error('Auth failed');

      const { data: room, error: roomErr } = await supabase
        .from('rooms')
        .select('*')
        .eq('code', joinCode.toUpperCase().trim())
        .single();
      if (roomErr || !room) throw new Error('Room introuvable');
      if (room.status !== 'waiting') throw new Error('La partie a déjà commencé');

      const color = AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
      const { error: playerErr } = await supabase
        .from('players')
        .insert({ room_id: room.id, user_id: authUser.id, nickname: nickname.trim(), avatar_color: color });
      if (playerErr) throw playerErr;

      navigate(`/lobby/${room.code}`);
    } catch (e: any) {
      setError(e.message || 'Erreur');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ repeat: Infinity, duration: 3, ease: 'easeInOut' }}
            className="inline-block text-6xl mb-4"
          >
            🎮
          </motion.div>
          <h1 className="text-4xl font-bold font-display text-foreground mb-2">Party Games</h1>
          <p className="text-muted-foreground">Mini-jeux multijoueur en temps réel</p>
        </div>

        {mode === 'menu' && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
            <Button
              onClick={() => setMode('create')}
              className="w-full h-16 text-lg font-display bg-primary hover:bg-primary/90"
              size="lg"
            >
              <Sparkles className="mr-2 h-5 w-5" /> Créer une partie
            </Button>
            <Button
              onClick={() => setMode('join')}
              variant="outline"
              className="w-full h-16 text-lg font-display"
              size="lg"
            >
              <Users className="mr-2 h-5 w-5" /> Rejoindre une partie
            </Button>
          </motion.div>
        )}

        {(mode === 'create' || mode === 'join') && (
          <motion.div initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            <Card className="border-2 border-primary/20">
              <CardContent className="p-6 space-y-4">
                <h2 className="text-xl font-display font-semibold text-center">
                  {mode === 'create' ? '🎉 Nouvelle partie' : '🚀 Rejoindre'}
                </h2>
                <Input
                  placeholder="Ton pseudo"
                  value={nickname}
                  onChange={(e) => setNickname(e.target.value)}
                  maxLength={20}
                  className="text-center text-lg h-12"
                />
                {mode === 'join' && (
                  <Input
                    placeholder="Code de la room"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    maxLength={6}
                    className="text-center text-lg h-12 tracking-[0.3em] font-mono"
                  />
                )}
                {error && <p className="text-destructive text-sm text-center">{error}</p>}
                <Button
                  onClick={mode === 'create' ? handleCreate : handleJoin}
                  disabled={loading}
                  className="w-full h-12 text-lg font-display"
                >
                  {loading ? '⏳' : mode === 'create' ? 'Créer' : 'Rejoindre'}
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => { setMode('menu'); setError(''); }}
                  className="w-full"
                >
                  ← Retour
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}
