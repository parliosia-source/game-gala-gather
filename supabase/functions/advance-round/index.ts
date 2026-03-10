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

    const { data: room } = await supabase.from('rooms').select('*').eq('id', room_id).single();
    if (!room) throw new Error('Room introuvable');
    if (room.host_id !== user.id) throw new Error('Seul l\'hôte peut avancer');

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
      // For bluff with few players, add bot submissions before moving on
      if (gameType === 'bluff') {
        await addBotBluffs(supabase, currentRound, room_id);
      }
      if (gameType === 'vote') {
        await addBotVoteAnswer(supabase, currentRound, room_id);
      }

      if (hasVoting) {
        await supabase.from('rounds').update({ status: 'voting', started_at: new Date().toISOString() }).eq('id', currentRound.id);
        return ok({ success: true, next_status: 'voting' });
      } else {
        await calculateScores(supabase, currentRound, room_id);
        await supabase.from('rounds').update({ status: 'results', started_at: new Date().toISOString() }).eq('id', currentRound.id);
        return ok({ success: true, next_status: 'results' });
      }
    }

    if (currentRound.status === 'voting') {
      await calculateScores(supabase, currentRound, room_id);
      await supabase.from('rounds').update({ status: 'results', started_at: new Date().toISOString() }).eq('id', currentRound.id);
      return ok({ success: true, next_status: 'results' });
    }

    if (currentRound.status === 'results') {
      await supabase.from('rounds').update({ status: 'finished' }).eq('id', currentRound.id);

      const { data: nextRound } = await supabase
        .from('rounds')
        .select('*')
        .eq('room_id', room_id)
        .eq('round_number', room.current_round + 1)
        .maybeSingle();

      if (nextRound) {
        await supabase.from('rounds').update({ status: 'collecting', started_at: new Date().toISOString() }).eq('id', nextRound.id);
        await supabase.from('rooms').update({ current_round: room.current_round + 1 }).eq('id', room_id);
        return ok({ success: true, next_status: 'next_round' });
      } else {
        await supabase.from('rooms').update({ status: 'finished' }).eq('id', room_id);
        return ok({ success: true, next_status: 'finished' });
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

function ok(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Bot answers for small games ───

const BLUFF_FAKES = [
  "Une ancienne tradition viking",
  "Un terme médical oublié",
  "Le nom d'un plat japonais rare",
  "Un acronyme militaire américain",
  "Une expression latine médiévale",
  "Le nom d'une constellation oubliée",
  "Un mot inventé par Shakespeare",
  "Une unité de mesure ancienne",
];

const VOTE_NEUTRAL = [
  "Aucun des deux",
  "Un peu de tout",
  "C'est relatif",
  "Ça dépend du contexte",
];

async function addBotBluffs(supabase: any, round: any, room_id: string) {
  const { data: players } = await supabase.from('players').select('id').eq('room_id', room_id);
  if (!players || players.length > 3) return;

  const { data: existing } = await supabase.from('submissions').select('id').eq('round_id', round.id);
  // Add 2 bot bluffs
  const shuffled = [...BLUFF_FAKES].sort(() => Math.random() - 0.5);
  const botSubs = [];
  for (let i = 0; i < 2; i++) {
    botSubs.push({
      round_id: round.id,
      player_id: players[0].id, // use first player as placeholder, marked as bot
      answer: { text: shuffled[i], is_bot: true },
    });
  }
  // We need a "bot" player. Use a deterministic approach: insert with a special marker
  // Actually, we can't create fake players without user_id. Instead, mark bot answers in the answer JSON
  // and use the host's player_id with is_bot flag
  await supabase.from('submissions').insert(botSubs);
}

async function addBotVoteAnswer(supabase: any, round: any, room_id: string) {
  const { data: players } = await supabase.from('players').select('id').eq('room_id', room_id);
  if (!players || players.length > 3) return;

  const neutral = VOTE_NEUTRAL[Math.floor(Math.random() * VOTE_NEUTRAL.length)];
  await supabase.from('submissions').insert({
    round_id: round.id,
    player_id: players[0].id,
    answer: { text: neutral, is_bot: true },
  });
}

// ─── Score calculations ───

async function calculateScores(supabase: any, round: any, room_id: string) {
  const { data: submissions } = await supabase
    .from('submissions')
    .select('*')
    .eq('round_id', round.id);

  if (!submissions || submissions.length === 0) return;

  const scoreEvents: any[] = [];

  if (round.game_type === 'estimation') {
    calculateEstimationScores(submissions, round, room_id, scoreEvents);
  }

  if (round.game_type === 'bluff') {
    await calculateBluffScores(supabase, submissions, round, room_id, scoreEvents);
  }

  if (round.game_type === 'vote') {
    await calculateVoteScores(supabase, submissions, round, room_id, scoreEvents);
  }

  if (scoreEvents.length > 0) {
    await supabase.from('score_events').insert(scoreEvents);

    // Update cumulative player scores
    const playerTotals: Record<string, number> = {};
    for (const event of scoreEvents) {
      playerTotals[event.player_id] = (playerTotals[event.player_id] || 0) + event.points;
    }

    for (const [playerId, total] of Object.entries(playerTotals)) {
      if (total > 0) {
        const { data: player } = await supabase
          .from('players')
          .select('score')
          .eq('id', playerId)
          .single();
        if (player) {
          await supabase
            .from('players')
            .update({ score: player.score + total })
            .eq('id', playerId);
        }
      }
      // Update submission score_earned
      await supabase
        .from('submissions')
        .update({ score_earned: total })
        .eq('round_id', round.id)
        .eq('player_id', playerId);
    }
  }
}

function calculateEstimationScores(submissions: any[], round: any, room_id: string, scoreEvents: any[]) {
  const correctAnswer = (round.config as any).answer;
  
  // Filter out bot submissions
  const realSubs = submissions.filter((s: any) => !(s.answer as any).is_bot);
  
  // Calculate diffs for each player
  const results: { sub: any; value: number; diff: number; points: number }[] = [];
  
  for (const sub of realSubs) {
    const value = (sub.answer as any).value;
    const diff = Math.abs(value - correctAnswer);
    // points = max(0, 100 - diff)
    const points = Math.max(0, 100 - diff);
    results.push({ sub, value, diff, points });
  }
  
  if (results.length === 0) return;
  
  // Find closest player(s)
  const minDiff = Math.min(...results.map(r => r.diff));
  
  for (const r of results) {
    let totalPoints = r.points;
    let reason = `Estimation: ${r.value} (correct: ${correctAnswer}, écart: ${r.diff}) → ${r.points} pts`;
    
    // Bonus +20 for closest
    if (r.diff === minDiff) {
      totalPoints += 20;
      reason += ' + 🎯 bonus le plus proche (+20)';
    }
    
    // Bonus +10 if under without exceeding
    if (r.value <= correctAnswer && r.diff > 0) {
      totalPoints += 10;
      reason += ' + ⬇️ sans dépasser (+10)';
    }
    
    scoreEvents.push({
      room_id,
      round_id: round.id,
      player_id: r.sub.player_id,
      points: totalPoints,
      reason,
    });
  }
}

async function calculateBluffScores(supabase: any, submissions: any[], round: any, room_id: string, scoreEvents: any[]) {
  const { data: votes } = await supabase
    .from('votes')
    .select('*')
    .eq('round_id', round.id);

  // Count votes per submission
  const voteCounts: Record<string, number> = {};
  const foundRealPlayers: string[] = [];
  
  for (const vote of (votes || [])) {
    if (vote.target_submission_id === null) {
      foundRealPlayers.push(vote.player_id);
    } else {
      voteCounts[vote.target_submission_id] = (voteCounts[vote.target_submission_id] || 0) + 1;
    }
  }

  // Find the most voted bluff (excluding bots)
  const realSubs = submissions.filter((s: any) => !(s.answer as any).is_bot);
  let maxVotes = 0;
  let mostVotedPlayerIds: string[] = [];
  
  for (const sub of realSubs) {
    const count = voteCounts[sub.id] || 0;
    if (count > maxVotes) {
      maxVotes = count;
      mostVotedPlayerIds = [sub.player_id];
    } else if (count === maxVotes && count > 0) {
      mostVotedPlayerIds.push(sub.player_id);
    }
  }

  const playersWithEvents = new Set<string>();

  // +50 per vote on your bluff
  for (const sub of realSubs) {
    const received = voteCounts[sub.id] || 0;
    if (received > 0) {
      let points = received * 50;
      let reason = `${received} joueur(s) ont voté pour ton bluff (+${received * 50})`;
      
      // +100 bonus for most voted bluff
      if (mostVotedPlayerIds.includes(sub.player_id) && maxVotes > 0) {
        points += 100;
        reason += ' + 🏆 bluff le plus voté (+100)';
      }
      
      scoreEvents.push({
        room_id,
        round_id: round.id,
        player_id: sub.player_id,
        points,
        reason,
      });
      playersWithEvents.add(sub.player_id);
    }
  }

  // +75 for finding the real answer
  for (const playerId of foundRealPlayers) {
    scoreEvents.push({
      room_id,
      round_id: round.id,
      player_id: playerId,
      points: 75,
      reason: '✅ A trouvé la vraie réponse (+75)',
    });
    playersWithEvents.add(playerId);
  }

  // Ensure all real players have a score event
  for (const sub of realSubs) {
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

async function calculateVoteScores(supabase: any, submissions: any[], round: any, room_id: string, scoreEvents: any[]) {
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

  const realSubs = submissions.filter((s: any) => !(s.answer as any).is_bot);
  
  for (const sub of realSubs) {
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
