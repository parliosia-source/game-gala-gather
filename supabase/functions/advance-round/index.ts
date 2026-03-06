import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) throw new Error('Non authentifié');
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) throw new Error('Non authentifié');

    const { room_id } = await req.json();

    // Get room
    const { data: room } = await supabase.from('rooms').select('*').eq('id', room_id).single();
    if (!room) throw new Error('Room introuvable');
    if (room.host_id !== user.id) throw new Error('Seul l\'hôte peut avancer');

    // Get current round
    const { data: currentRound } = await supabase
      .from('rounds')
      .select('*')
      .eq('room_id', room_id)
      .eq('round_number', room.current_round)
      .single();
    if (!currentRound) throw new Error('Round introuvable');

    const gameType = currentRound.game_type;
    const hasVoting = gameType === 'bluff' || gameType === 'vote';

    // State machine transitions
    if (currentRound.status === 'collecting') {
      if (hasVoting) {
        // Move to voting
        await supabase.from('rounds').update({ status: 'voting' }).eq('id', currentRound.id);
        return new Response(JSON.stringify({ success: true, next_status: 'voting' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Skip voting, calculate scores
        await calculateScores(supabase, currentRound, room_id);
        await supabase.from('rounds').update({ status: 'results' }).eq('id', currentRound.id);
        return new Response(JSON.stringify({ success: true, next_status: 'results' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    if (currentRound.status === 'voting') {
      // Calculate scores then show results
      await calculateScores(supabase, currentRound, room_id);
      await supabase.from('rounds').update({ status: 'results' }).eq('id', currentRound.id);
      return new Response(JSON.stringify({ success: true, next_status: 'results' }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    if (currentRound.status === 'results') {
      // Finish current round
      await supabase.from('rounds').update({ status: 'finished' }).eq('id', currentRound.id);

      // Check if there's a next round
      const { data: nextRound } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', room_id)
        .eq('round_number', room.current_round + 1)
        .maybeSingle();

      if (nextRound) {
        // Activate next round
        await supabase.from('rounds').update({ status: 'collecting', started_at: new Date().toISOString() }).eq('id', nextRound.id);
        await supabase.from('rooms').update({ current_round: room.current_round + 1 }).eq('id', room_id);
        return new Response(JSON.stringify({ success: true, next_status: 'next_round' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      } else {
        // Game finished
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', room_id);
        return new Response(JSON.stringify({ success: true, next_status: 'finished' }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    throw new Error('Transition invalide');
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

async function calculateScores(supabase: any, round: any, room_id: string) {
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .eq('round_id', round.id);

  if (!submissions || submissions.length === 0) return;

  const scoreEvents: any[] = [];

  if (round.game_type === 'estimation') {
    const correctAnswer = (round.config as any).answer;
    for (const sub of submissions) {
      const value = (sub.answer as any).value;
      const diff = Math.abs(value - correctAnswer);
      const points = Math.max(0, 1000 - diff);
      scoreEvents.push({
        room_id,
        round_id: round.id,
        player_id: sub.player_id,
        points,
        reason: `Écart de ${diff} (réponse: ${value}, correct: ${correctAnswer})`,
      });
    }
  }

  if (round.game_type === 'bluff') {
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('round_id', round.id);

    // Count votes per submission (duped players)
    const voteCounts: Record<string, number> = {};
    const foundRealPlayers: string[] = [];
    for (const vote of (votes || [])) {
      if (vote.target_submission_id === null) {
        // Voted for the real answer
        foundRealPlayers.push(vote.player_id);
      } else {
        voteCounts[vote.target_submission_id] = (voteCounts[vote.target_submission_id] || 0) + 1;
      }
    }

    // Points for duping other players (200 per duped player)
    for (const sub of submissions) {
      const received = voteCounts[sub.id] || 0;
      if (received > 0) {
        scoreEvents.push({
          room_id,
          round_id: round.id,
          player_id: sub.player_id,
          points: received * 200,
          reason: `${received} joueur(s) dupé(s) par votre bluff`,
        });
      }
    }

    // Points for finding the real answer (300 pts)
    for (const playerId of foundRealPlayers) {
      scoreEvents.push({
        room_id,
        round_id: round.id,
        player_id: playerId,
        points: 300,
        reason: 'A trouvé la vraie réponse !',
      });
    }

    // Players who didn't find the real answer and got 0 duped votes: 0 pts (no event needed)
    // But ensure all players have at least one score event for display
    const playersWithEvents = new Set(scoreEvents.map(e => e.player_id));
    for (const sub of submissions) {
      if (!playersWithEvents.has(sub.player_id)) {
        scoreEvents.push({
          room_id,
          round_id: round.id,
          player_id: sub.player_id,
          points: 0,
          reason: 'Aucun joueur dupé, vraie réponse non trouvée',
        });
      }
    }
  }

  if (round.game_type === 'vote') {
    const { data: votes } = await supabase
      .from('votes')
      .select('*')
      .eq('round_id', round.id);

    const voteCounts: Record<string, number> = {};
    for (const vote of (votes || [])) {
      if (vote.target_submission_id) {
        voteCounts[vote.target_submission_id] = (voteCounts[vote.target_submission_id] || 0) + 1;
      }
    }

    for (const sub of submissions) {
      const received = voteCounts[sub.id] || 0;
      const points = received * 200;
      scoreEvents.push({
        room_id,
        round_id: round.id,
        player_id: sub.player_id,
        points,
        reason: `${received} vote(s) reçu(s)`,
      });
    }
  }

  // Insert score events
  if (scoreEvents.length > 0) {
    await supabase.from('score_events').insert(scoreEvents);

    // Update cumulative scores
    for (const event of scoreEvents) {
      if (event.points > 0) {
        const { data: player } = await supabase
          .from('players')
          .select('score')
          .eq('id', event.player_id)
          .single();
        if (player) {
          await supabase
            .from('players')
            .update({ score: player.score + event.points })
            .eq('id', event.player_id);
        }
      }
    }

    // Update submission score_earned (sum all events per player)
    const playerTotals: Record<string, number> = {};
    for (const event of scoreEvents) {
      playerTotals[event.player_id] = (playerTotals[event.player_id] || 0) + event.points;
    }
    for (const [playerId, total] of Object.entries(playerTotals)) {
      await supabase
        .from('submissions')
        .update({ score_earned: total })
        .eq('round_id', round.id)
        .eq('player_id', playerId);
    }
  }
}
