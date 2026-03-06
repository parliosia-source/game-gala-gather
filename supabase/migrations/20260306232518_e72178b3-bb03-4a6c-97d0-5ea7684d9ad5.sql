
-- Create enums
CREATE TYPE public.room_status AS ENUM ('waiting', 'playing', 'finished');
CREATE TYPE public.round_status AS ENUM ('pending', 'collecting', 'voting', 'results', 'finished');
CREATE TYPE public.game_type AS ENUM ('estimation', 'bluff', 'vote');

-- Rooms table
CREATE TABLE public.rooms (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  host_id UUID NOT NULL,
  status room_status NOT NULL DEFAULT 'waiting',
  current_round INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Players table
CREATE TABLE public.players (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  nickname TEXT NOT NULL,
  avatar_color TEXT NOT NULL DEFAULT '#6366f1',
  score INT NOT NULL DEFAULT 0,
  is_host BOOLEAN NOT NULL DEFAULT false,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Rounds table
CREATE TABLE public.rounds (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_number INT NOT NULL,
  game_type game_type NOT NULL,
  config JSONB NOT NULL DEFAULT '{}',
  status round_status NOT NULL DEFAULT 'pending',
  started_at TIMESTAMP WITH TIME ZONE
);

-- Submissions table
CREATE TABLE public.submissions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  answer JSONB NOT NULL DEFAULT '{}',
  score_earned INT NOT NULL DEFAULT 0,
  submitted_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round_id, player_id)
);

-- Votes table
CREATE TABLE public.votes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  target_submission_id UUID NOT NULL REFERENCES public.submissions(id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(round_id, player_id)
);

-- Score events table
CREATE TABLE public.score_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  room_id UUID NOT NULL REFERENCES public.rooms(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES public.rounds(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  points INT NOT NULL DEFAULT 0,
  reason TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.rooms ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.submissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.score_events ENABLE ROW LEVEL SECURITY;

-- RLS Policies: rooms - anyone can read, authenticated can create
CREATE POLICY "Anyone can view rooms" ON public.rooms FOR SELECT USING (true);
CREATE POLICY "Authenticated users can create rooms" ON public.rooms FOR INSERT WITH CHECK (true);
CREATE POLICY "Host can update room" ON public.rooms FOR UPDATE USING (host_id = auth.uid());

-- RLS Policies: players - room members can read, anyone can join
CREATE POLICY "Anyone can view players in a room" ON public.players FOR SELECT USING (true);
CREATE POLICY "Users can join rooms" ON public.players FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "Server can update players" ON public.players FOR UPDATE USING (true);

-- RLS Policies: rounds - room members can read
CREATE POLICY "Anyone can view rounds" ON public.rounds FOR SELECT USING (true);
CREATE POLICY "Server can manage rounds" ON public.rounds FOR INSERT WITH CHECK (true);
CREATE POLICY "Server can update rounds" ON public.rounds FOR UPDATE USING (true);

-- RLS Policies: submissions - room members can read, players can submit
CREATE POLICY "Anyone can view submissions" ON public.submissions FOR SELECT USING (true);
CREATE POLICY "Players can submit answers" ON public.submissions FOR INSERT WITH CHECK (true);

-- RLS Policies: votes
CREATE POLICY "Anyone can view votes" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Players can vote" ON public.votes FOR INSERT WITH CHECK (true);

-- RLS Policies: score_events
CREATE POLICY "Anyone can view score events" ON public.score_events FOR SELECT USING (true);
CREATE POLICY "Server can create score events" ON public.score_events FOR INSERT WITH CHECK (true);

-- Enable realtime for key tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.rooms;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.rounds;
ALTER PUBLICATION supabase_realtime ADD TABLE public.submissions;
