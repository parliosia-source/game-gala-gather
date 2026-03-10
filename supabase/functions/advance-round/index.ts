import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const GAME_HAS_VOTING: Record<string, boolean> = {
  bluff: true,
  vote: true,
  guess_who: true,
  odd_answer: true,
  estimation: false,
  higher_lower: false,
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
      .from('rounds').select('*')
      .eq('room_id', room_id).eq('round_number', room.current_round).single();
    if (!currentRound) throw new Error('Round introuvable');

    const gameType = currentRound.game_type;
    const hasVoting = GAME_HAS_VOTING[gameType] ?? false;

    // State machine
    if (currentRound.status === 'collecting') {
      await addBotsIfNeeded(supabase, currentRound, room_id);

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

      const { data: nextRound } = await supabase.from('rounds').select('*')
        .eq('room_id', room_id).eq('round_number', room.current_round + 1).maybeSingle();

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
      status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

function ok(data: any) {
  return new Response(JSON.stringify(data), {
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// ─── Bot injection ───

const BLUFF_FAKES = [
  "Une ancienne tradition viking", "Un terme médical oublié",
  "Le nom d'un plat japonais rare", "Un acronyme militaire américain",
  "Une expression latine médiévale", "Le nom d'une constellation oubliée",
  "Un mot inventé par Shakespeare", "Une unité de mesure ancienne",
];

const VOTE_NEUTRAL = [
  "Aucun des deux", "Un peu de tout", "C'est relatif",
  "Ça dépend du contexte", "Pourquoi pas les deux ?",
];

const ODD_BOTS = [
  "Un collecteur de bruits de porte", "Une cuillère en chocolat comestible",
  "Être champion du monde de cache-cache", "Un parapluie pour chien",
];

async function addBotsIfNeeded(supabase: any, round: any, room_id: string) {
  const { data: players } = await supabase.from('players').select('id').eq('room_id', room_id);
  if (!players) return;
  const playerCount = players.length;
  const isDuel = playerCount === 2;
  const isSmall = playerCount <= 3;

  if (!isSmall) return;

  const hostId = players[0].id; // Use first player as bot anchor
  const gameType = round.game_type;

  if (gameType === 'bluff') {
    const count = isDuel ? 3 : 2;
    const shuffled = [...BLUFF_FAKES].sort(() => Math.random() - 0.5);
    const bots = [];
    for (let i = 0; i < count; i++) {
      bots.push({ round_id: round.id, player_id: hostId, answer: { text: shuffled[i], is_bot: true } });
    }
    await supabase.from('submissions').insert(bots);
  }

  if (gameType === 'vote') {
    const count = isDuel ? 2 : 1;
    const shuffled = [...VOTE_NEUTRAL].sort(() => Math.random() - 0.5);
    const bots = [];
    for (let i = 0; i < count; i++) {
      bots.push({ round_id: round.id, player_id: hostId, answer: { text: shuffled[i], is_bot: true } });
    }
    await supabase.from('submissions').insert(bots);
  }

  if (gameType === 'odd_answer' && isDuel) {
    const shuffled = [...ODD_BOTS].sort(() => Math.random() - 0.5);
    const bots = [];
    for (let i = 0; i < 2; i++) {
      bots.push({ round_id: round.id, player_id: hostId, answer: { text: shuffled[i], is_bot: true } });
    }
    await supabase.from('submissions').insert(bots);
  }
}

// ─── Score calculations ───

async function calculateScores(supabase: any, round: any, room_id: string) {
  const { data: submissions } = await supabase.from('submissions').select('*').eq('round_id', round.id);
  if (!submissions || submissions.length === 0) return;

  const scoreEvents: any[] = [];
  const config = round.config as any;
  const isDuel = config.is_duel === true;

  switch (round.game_type) {
    case 'estimation':
      calcEstimation(submissions, round, room_id, isDuel, scoreEvents);
      break;
    case 'bluff':
      await calcBluff(supabase, submissions, round, room_id, scoreEvents);
      break;
    case 'vote':
    case 'odd_answer':
      await calcVote(supabase, submissions, round, room_id, scoreEvents);
      break;
    case 'guess_who':
      await calcGuessWho(supabase, submissions, round, room_id, scoreEvents);
      break;
    case 'higher_lower':
      calcHigherLower(submissions, round, room_id, scoreEvents);
      break;
  }

  if (scoreEvents.length > 0) {
    await supabase.from('score_events').insert(scoreEvents);

    const playerTotals: Record<string, number> = {};
    for (const e of scoreEvents) {
      playerTotals[e.player_id] = (playerTotals[e.player_id] || 0) + e.points;
    }

    for (const [playerId, total] of Object.entries(playerTotals)) {
      if (total > 0) {
        const { data: p } = await supabase.from('players').select('score').eq('id', playerId).single();
        if (p) await supabase.from('players').update({ score: p.score + total }).eq('id', playerId);
      }
      await supabase.from('submissions').update({ score_earned: total })
        .eq('round_id', round.id).eq('player_id', playerId);
    }
  }
}

// ── Estimation ──
function calcEstimation(submissions: any[], round: any, room_id: string, isDuel: boolean, scoreEvents: any[]) {
  const correctAnswer = (round.config as any).answer;
  const realSubs = submissions.filter((s: any) => !(s.answer as any).is_bot);

  const results = realSubs.map((sub: any) => {
    const value = (sub.answer as any).value;
    const diff = Math.abs(value - correctAnswer);
    const points = Math.max(0, 100 - diff);
    return { sub, value, diff, points };
  });

  if (results.length === 0) return;
  const minDiff = Math.min(...results.map((r: any) => r.diff));
  const closestBonus = isDuel ? 30 : 20;

  for (const r of results) {
    let totalPoints = r.points;
    let reason = `Estimation: ${r.value} (correct: ${correctAnswer}, écart: ${r.diff}) → ${r.points} pts`;

    if (r.diff === minDiff) {
      totalPoints += closestBonus;
      reason += ` + 🎯 le plus proche (+${closestBonus})`;
    }
    if (r.value <= correctAnswer && r.diff > 0) {
      totalPoints += 10;
      reason += ' + ⬇️ sans dépasser (+10)';
    }

    scoreEvents.push({ room_id, round_id: round.id, player_id: r.sub.player_id, points: totalPoints, reason });
  }
}

// ── Bluff ──
async function calcBluff(supabase: any, submissions: any[], round: any, room_id: string, scoreEvents: any[]) {
  const { data: votes } = await supabase.from('votes').select('*').eq('round_id', round.id);

  const voteCounts: Record<string, number> = {};
  const foundRealPlayers: string[] = [];
  for (const vote of (votes || [])) {
    if (vote.target_submission_id === null) {
      foundRealPlayers.push(vote.player_id);
    } else {
      voteCounts[vote.target_submission_id] = (voteCounts[vote.target_submission_id] || 0) + 1;
    }
  }

  const realSubs = submissions.filter((s: any) => !(s.answer as any).is_bot);
  let maxVotes = 0;
  let mostVotedIds: string[] = [];
  for (const sub of realSubs) {
    const c = voteCounts[sub.id] || 0;
    if (c > maxVotes) { maxVotes = c; mostVotedIds = [sub.player_id]; }
    else if (c === maxVotes && c > 0) mostVotedIds.push(sub.player_id);
  }

  const withEvents = new Set<string>();

  for (const sub of realSubs) {
    const received = voteCounts[sub.id] || 0;
    if (received > 0) {
      let points = received * 50;
      let reason = `${received} joueur(s) ont voté pour ton bluff (+${received * 50})`;
      if (mostVotedIds.includes(sub.player_id) && maxVotes > 0) {
        points += 100;
        reason += ' + 🏆 bluff le plus voté (+100)';
      }
      scoreEvents.push({ room_id, round_id: round.id, player_id: sub.player_id, points, reason });
      withEvents.add(sub.player_id);
    }
  }

  for (const pid of foundRealPlayers) {
    scoreEvents.push({ room_id, round_id: round.id, player_id: pid, points: 75, reason: '✅ A trouvé la vraie réponse (+75)' });
    withEvents.add(pid);
  }

  for (const sub of realSubs) {
    if (!withEvents.has(sub.player_id)) {
      scoreEvents.push({ room_id, round_id: round.id, player_id: sub.player_id, points: 0, reason: 'Aucun joueur dupé, vraie réponse non trouvée' });
    }
  }
}

// ── Vote / Odd Answer ──
async function calcVote(supabase: any, submissions: any[], round: any, room_id: string, scoreEvents: any[]) {
  const { data: votes } = await supabase.from('votes').select('*').eq('round_id', round.id);
  const voteCounts: Record<string, number> = {};
  for (const vote of (votes || [])) {
    if (vote.target_submission_id) voteCounts[vote.target_submission_id] = (voteCounts[vote.target_submission_id] || 0) + 1;
  }
  const realSubs = submissions.filter((s: any) => !(s.answer as any).is_bot);
  for (const sub of realSubs) {
    const received = voteCounts[sub.id] || 0;
    scoreEvents.push({ room_id, round_id: round.id, player_id: sub.player_id, points: received * 200, reason: `${received} vote(s) reçu(s)` });
  }
}

// ── Guess Who ──
async function calcGuessWho(supabase: any, submissions: any[], round: any, room_id: string, scoreEvents: any[]) {
  const { data: votes } = await supabase.from('votes').select('*').eq('round_id', round.id);
  // In guess_who, voting for a submission means "I think THIS is the other player's answer"
  // If a player votes for a submission that IS from the other player → correct
  for (const vote of (votes || [])) {
    if (!vote.target_submission_id) continue;
    const targetSub = submissions.find((s: any) => s.id === vote.target_submission_id);
    if (!targetSub) continue;
    // Correct if the submission belongs to someone else (not the voter)
    const isCorrect = targetSub.player_id !== vote.player_id;
    scoreEvents.push({
      room_id, round_id: round.id, player_id: vote.player_id,
      points: isCorrect ? 100 : 0,
      reason: isCorrect ? '✅ Bien deviné ! (+100)' : '❌ Mauvaise attribution',
    });
  }
  // Ensure all submitters have an event
  const withEvents = new Set(scoreEvents.map((e: any) => e.player_id));
  for (const sub of submissions) {
    if (!withEvents.has(sub.player_id)) {
      scoreEvents.push({ room_id, round_id: round.id, player_id: sub.player_id, points: 0, reason: 'Pas de vote effectué' });
    }
  }
}

// ── Higher or Lower ──
function calcHigherLower(submissions: any[], round: any, room_id: string, scoreEvents: any[]) {
  const config = round.config as any;
  const realValue = config.real_value;
  const refValue = config.reference_value;
  const correctGuess = realValue > refValue ? 'higher' : realValue < refValue ? 'lower' : 'equal';

  for (const sub of submissions) {
    const guess = (sub.answer as any).guess;
    const isCorrect = guess === correctGuess;
    scoreEvents.push({
      room_id, round_id: round.id, player_id: sub.player_id,
      points: isCorrect ? 100 : 0,
      reason: isCorrect
        ? `✅ Correct ! ${realValue} est bien ${correctGuess === 'higher' ? 'plus haut' : 'plus bas'} que ${refValue} (+100)`
        : `❌ Raté ! ${realValue} est ${correctGuess === 'higher' ? 'plus haut' : 'plus bas'} que ${refValue}`,
    });
  }
}
