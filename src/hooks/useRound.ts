import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';

type Round = Database['public']['Tables']['rounds']['Row'];
type Submission = Database['public']['Tables']['submissions']['Row'];

export function useRound(roomId: string | null, roundNumber: number) {
  const [round, setRound] = useState<Round | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  const fetchRound = useCallback(async () => {
    if (!roomId) return;
    const { data } = await supabase
      .from('rounds')
      .select('*')
      .eq('room_id', roomId)
      .eq('round_number', roundNumber)
      .single();
    if (data) setRound(data);
  }, [roomId, roundNumber]);

  const fetchSubmissions = useCallback(async () => {
    if (!round) return;
    const { data } = await supabase
      .from('submissions')
      .select('*')
      .eq('round_id', round.id);
    if (data) setSubmissions(data);
  }, [round?.id]);

  useEffect(() => {
    fetchRound();
  }, [fetchRound]);

  useEffect(() => {
    if (!round) return;
    fetchSubmissions();

    const channel = supabase
      .channel(`round:${round.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'rounds', filter: `id=eq.${round.id}` },
        (payload) => { if (payload.new) setRound(payload.new as Round); })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'submissions', filter: `round_id=eq.${round.id}` },
        () => { fetchSubmissions(); })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [round?.id, fetchSubmissions]);

  return { round, submissions, refetchRound: fetchRound };
}
