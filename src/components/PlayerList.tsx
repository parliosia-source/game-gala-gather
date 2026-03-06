import type { Database } from '@/integrations/supabase/types';

type Player = Database['public']['Tables']['players']['Row'];

interface Props {
  players: Player[];
  compact?: boolean;
}

export default function PlayerList({ players, compact }: Props) {
  const sorted = [...players].sort((a, b) => b.score - a.score);

  if (compact) {
    return (
      <div className="bg-card border-t p-3">
        <div className="max-w-md mx-auto flex gap-2 overflow-x-auto">
          {sorted.map(p => (
            <div
              key={p.id}
              className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-muted/50 shrink-0 text-sm"
            >
              <div
                className="w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                style={{ backgroundColor: p.avatar_color, color: 'white' }}
              >
                {p.nickname[0]?.toUpperCase()}
              </div>
              <span className="font-medium">{p.nickname}</span>
              <span className="text-muted-foreground font-display">{p.score}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {sorted.map(p => (
        <div key={p.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/50">
          <div
            className="w-10 h-10 rounded-full flex items-center justify-center text-lg font-bold"
            style={{ backgroundColor: p.avatar_color, color: 'white' }}
          >
            {p.nickname[0]?.toUpperCase()}
          </div>
          <span className="font-medium flex-1">{p.nickname}</span>
          <span className="font-display font-bold text-primary">{p.score} pts</span>
        </div>
      ))}
    </div>
  );
}
