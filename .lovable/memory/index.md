# Party Games - Design & Architecture

## Design System
- Font display: Fredoka
- Font body: Space Grotesk
- Primary: HSL 262 83% 58% (purple)
- Secondary: HSL 45 100% 60% (yellow)
- Accent: HSL 170 75% 45% (teal)
- Game colors: pink, blue, green, orange, yellow
- Border radius: 1rem

## Architecture
- Anonymous auth (no accounts)
- 6 tables: rooms, players, rounds, submissions, votes, score_events
- Edge Functions: start-game, submit-answer, submit-vote, advance-round
- Round state machine: pending → collecting → voting → results → finished
- 6 game types: estimation, bluff, vote, guess_who, higher_lower, odd_answer
- Duel mode: auto-detected when 2 players, shorter timers, bot answers, duel-specific mini-games
- Realtime channels per room
- Scoring: estimation (100-diff+bonuses), bluff (50/vote+100 most voted+75 real), vote (200/vote)
