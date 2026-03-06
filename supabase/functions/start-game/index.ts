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
};

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
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

    // Verify host
    const { data: room } = await supabase.from('rooms').select('*').eq('id', room_id).single();
    if (!room) throw new Error('Room introuvable');
    if (room.host_id !== user.id) throw new Error('Seul l\'hôte peut lancer la partie');
    if (room.status !== 'waiting') throw new Error('La partie a déjà commencé');

    // Generate 5 rounds with mixed game types
    const gameTypes: Array<'estimation' | 'bluff' | 'vote'> = shuffle(['estimation', 'bluff', 'vote', 'estimation', 'vote']);
    const rounds = gameTypes.map((type, i) => {
      const questions = QUESTIONS[type];
      const q = questions[Math.floor(Math.random() * questions.length)];
      return {
        room_id,
        round_number: i + 1,
        game_type: type,
        config: q,
        status: i === 0 ? 'collecting' : 'pending',
        started_at: i === 0 ? new Date().toISOString() : null,
      };
    });

    const { error: roundsErr } = await supabase.from('rounds').insert(rounds);
    if (roundsErr) throw roundsErr;

    // Update room status
    const { error: updateErr } = await supabase
      .from('rooms')
      .update({ status: 'playing', current_round: 1 })
      .eq('id', room_id);
    if (updateErr) throw updateErr;

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
