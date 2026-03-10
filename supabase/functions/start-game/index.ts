import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

const QUESTIONS = {
  estimation: [
    { question: "Combien de pays existe-t-il dans le monde ?", answer: 195, unit: "pays" },
    { question: "Quelle est la hauteur de la Tour Eiffel en mètres ?", answer: 330, unit: "mètres" },
    { question: "En quelle année a été inventé le téléphone ?", answer: 1876, unit: "année" },
    { question: "Combien d'os possède un corps humain adulte ?", answer: 206, unit: "os" },
    { question: "Quelle est la température à la surface du Soleil en °C ?", answer: 5500, unit: "°C" },
  ],
  bluff: [
    { question: "Que signifie 'SPAM' à l'origine ?", real_answer: "Spiced Pork And Meat" },
    { question: "Quel animal peut dormir 3 ans d'affilée ?", real_answer: "L'escargot" },
    { question: "Quelle est la phobie du nombre 13 ?", real_answer: "Triskaidékaphobie" },
    { question: "Quel pays a le plus de lacs au monde ?", real_answer: "Le Canada" },
    { question: "Quel est le seul aliment qui ne périme jamais ?", real_answer: "Le miel" },
  ],
  vote: [
    { question: "Quel super-pouvoir choisiriez-vous ?" },
    { question: "Quel est le pire défaut chez quelqu'un ?" },
    { question: "Si vous pouviez dîner avec une personne historique, qui ?" },
    { question: "Quel serait votre talent caché idéal ?" },
    { question: "Quelle invention inutile aimeriez-vous créer ?" },
  ],
  guess_who: [
    { question: "Décrivez votre pire habitude secrète." },
    { question: "Quel est votre plaisir coupable ?" },
    { question: "Racontez un souvenir embarrassant en une phrase." },
    { question: "Quelle est votre opinion impopulaire ?" },
    { question: "Quel est le compliment le plus étrange qu'on vous a fait ?" },
  ],
  higher_lower: [
    { question: "Population de la France en millions", reference_value: 60, real_value: 68, unit: "millions" },
    { question: "Nombre de langues parlées dans le monde", reference_value: 5000, real_value: 7168, unit: "langues" },
    { question: "Vitesse maximale d'un guépard en km/h", reference_value: 100, real_value: 120, unit: "km/h" },
    { question: "Profondeur de la fosse des Mariannes en mètres", reference_value: 8000, real_value: 10994, unit: "mètres" },
    { question: "Nombre d'étoiles visibles à l'œil nu", reference_value: 3000, real_value: 9096, unit: "étoiles" },
  ],
  odd_answer: [
    { question: "Quelle est la chose la plus inutile que vous possédez ?" },
    { question: "Quel métier bizarre aimeriez-vous exercer ?" },
    { question: "Inventez un mot et donnez sa définition." },
    { question: "Quel animal seriez-vous et pourquoi ?" },
    { question: "Quelle serait votre dernière commande au restaurant ?" },
  ],
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Build a sequence of 5 game types avoiding consecutive repeats
function buildDuelSequence(): string[] {
  const duelTypes = ['estimation', 'bluff', 'guess_who', 'higher_lower', 'odd_answer'];
  const result: string[] = [];
  const pool = shuffle([...duelTypes]);
  
  for (let i = 0; i < 5; i++) {
    // Pick from shuffled pool, avoiding repeat of last
    let candidates = pool.filter(t => t !== result[result.length - 1]);
    if (candidates.length === 0) candidates = pool;
    const pick = candidates[Math.floor(Math.random() * candidates.length)];
    result.push(pick);
    // Remove from pool to maximize variety, refill if empty
    const idx = pool.indexOf(pick);
    if (idx !== -1) pool.splice(idx, 1);
    if (pool.length === 0) pool.push(...shuffle([...duelTypes]));
  }
  return result;
}

function buildNormalSequence(): string[] {
  return shuffle(['estimation', 'bluff', 'vote', 'estimation', 'vote']);
}

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
    if (room.host_id !== user.id) throw new Error('Seul l\'hôte peut lancer la partie');
    if (room.status !== 'waiting') throw new Error('La partie a déjà commencé');

    // Count players to detect duel mode
    const { count } = await supabase.from('players').select('id', { count: 'exact', head: true }).eq('room_id', room_id);
    const playerCount = count || 0;
    const isDuel = playerCount === 2;

    const gameTypes = isDuel ? buildDuelSequence() : buildNormalSequence();

    const rounds = gameTypes.map((type, i) => {
      const questions = QUESTIONS[type as keyof typeof QUESTIONS];
      const q = questions[Math.floor(Math.random() * questions.length)];
      return {
        room_id,
        round_number: i + 1,
        game_type: type,
        config: { ...q, is_duel: isDuel },
        status: i === 0 ? 'collecting' : 'pending',
        started_at: i === 0 ? new Date().toISOString() : null,
      };
    });

    const { error: roundsErr } = await supabase.from('rounds').insert(rounds);
    if (roundsErr) throw roundsErr;

    const { error: updateErr } = await supabase
      .from('rooms')
      .update({ status: 'playing', current_round: 1 })
      .eq('id', room_id);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true, is_duel: isDuel }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
