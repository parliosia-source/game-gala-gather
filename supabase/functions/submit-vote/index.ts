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

    const { round_id, player_id, target_submission_id, voted_real_answer } = await req.json();

    // Verify round is in voting
    const { data: round } = await supabase.from('rounds').select('*').eq('id', round_id).single();
    if (!round) throw new Error('Round introuvable');
    if (round.status !== 'voting') throw new Error('Le round n\'accepte pas de votes');

    // Verify player
    const { data: player } = await supabase.from('players').select('*').eq('id', player_id).single();
    if (!player) throw new Error('Joueur introuvable');
    if (player.user_id !== user.id) throw new Error('Non autorisé');

    // Check if already voted
    const { data: existing } = await supabase
      .from('votes')
      .select('id')
      .eq('round_id', round_id)
      .eq('player_id', player_id)
      .maybeSingle();
    if (existing) throw new Error('Vous avez déjà voté');

    // Handle bluff real answer vote (target_submission_id = null)
    if (voted_real_answer === true && round.game_type === 'bluff') {
      const { error: insertErr } = await supabase
        .from('votes')
        .insert({ round_id, player_id, target_submission_id: null });
      if (insertErr) throw insertErr;

      return new Response(JSON.stringify({ success: true }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Standard vote: verify not voting for own submission
    if (!target_submission_id) throw new Error('Cible de vote manquante');
    const { data: targetSub } = await supabase.from('submissions').select('*').eq('id', target_submission_id).single();
    if (!targetSub) throw new Error('Submission introuvable');
    if (targetSub.player_id === player_id) throw new Error('Vous ne pouvez pas voter pour votre propre réponse');

    // Insert vote
    const { error: insertErr } = await supabase
      .from('votes')
      .insert({ round_id, player_id, target_submission_id });
    if (insertErr) throw insertErr;

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
