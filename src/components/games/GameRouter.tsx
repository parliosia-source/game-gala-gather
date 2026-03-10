import type { Database } from '@/integrations/supabase/types';
import EstimationGame from './EstimationGame';
import BluffGame from './BluffGame';
import VoteSocialGame from './VoteSocialGame';
import GuessWhoGame from './GuessWhoGame';
import HigherLowerGame from './HigherLowerGame';
import OddAnswerGame from './OddAnswerGame';
import RoundResults from './RoundResults';

type Round = Database['public']['Tables']['rounds']['Row'];
type Room = Database['public']['Tables']['rooms']['Row'];
type Player = Database['public']['Tables']['players']['Row'];
type Submission = Database['public']['Tables']['submissions']['Row'];

interface Props {
  round: Round;
  room: Room;
  player: Player;
  players: Player[];
  submissions: Submission[];
}

export default function GameRouter({ round, room, player, players, submissions }: Props) {
  if (round.status === 'results' || round.status === 'finished') {
    return <RoundResults round={round} room={room} player={player} players={players} submissions={submissions} />;
  }

  switch (round.game_type) {
    case 'estimation':
      return <EstimationGame round={round} room={room} player={player} submissions={submissions} />;
    case 'bluff':
      return <BluffGame round={round} room={room} player={player} players={players} submissions={submissions} />;
    case 'vote':
      return <VoteSocialGame round={round} room={room} player={player} players={players} submissions={submissions} />;
    case 'guess_who':
      return <GuessWhoGame round={round} room={room} player={player} players={players} submissions={submissions} />;
    case 'higher_lower':
      return <HigherLowerGame round={round} room={room} player={player} submissions={submissions} />;
    case 'odd_answer':
      return <OddAnswerGame round={round} room={room} player={player} players={players} submissions={submissions} />;
    default:
      return <p className="text-muted-foreground">Mini-jeu inconnu</p>;
  }
}
