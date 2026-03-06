import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Room = Database['public']['Tables']['rooms']['Row'];
type Player = Database['public']['Tables']['players']['Row'];

export function useRoom(roomCode: string | null) {
  const [room, setRoom] = useState<Room | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchRoom = useCallback(async () => {
    if (!roomCode) return;
    const { data } = await supabase
      .from('rooms')
      .select('*')
      .eq('code', roomCode)
      .single();
    if (data) setRoom(data);
    setLoading(false);
  }, [roomCode]);

  const fetchPlayers = useCallback(async () => {
    if (!room) return;
    const { data } = await supabase
      .from('players')
      .select('*')
      .eq('room_id', room.id)
      .order('joined_at', { ascending: true });
    if (data) setPlayers(data);
  }, [room?.id]);

  useEffect(() => {
    fetchRoom();
  }, [fetchRoom]);

  useEffect(() => {
    if (!room) return;
    fetchPlayers();

    const channel = supabase
      .channel(`room:${room.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rooms', filter: `id=eq.${room.id}` },
        (payload) => { if (payload.new) setRoom(payload.new as Room); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'players', filter: `room_id=eq.${room.id}` },
        () => { fetchPlayers(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [room?.id, fetchPlayers]);

  return { room, players, loading, refetchPlayers: fetchPlayers };
}
