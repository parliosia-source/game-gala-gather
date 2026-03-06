

# Party Games Multijoueur — Plan révisé

## 1. Modèle de données

### Tables

**rooms**
- id (uuid, PK), code (text, unique, 6 chars), host_id (uuid), status (waiting/playing/finished), current_round (int), created_at

**players**
- id (uuid, PK), room_id (FK rooms), user_id (uuid), nickname, avatar_color, score (int, cumulé), is_host (bool), joined_at

**rounds**
- id (uuid, PK), room_id (FK rooms), round_number (int), game_type (estimation/bluff/vote), config (JSONB), status (pending/collecting/voting/results/finished), started_at

**submissions**
- id (uuid, PK), round_id (FK rounds), player_id (FK players), answer (JSONB), score_earned (int), submitted_at
- Contrainte unique : (round_id, player_id) — une seule réponse par joueur par round

**votes**
- id (uuid, PK), round_id (FK rounds), player_id (FK players), target_submission_id (FK submissions), created_at
- Contrainte unique : (round_id, player_id) — un seul vote par joueur par round
- Contrainte check : player_id != submission.player_id (serveur)

**score_events**
- id (uuid, PK), room_id (FK rooms), round_id (FK rounds), player_id (FK players), points (int), reason (text), created_at

### Relations score
- `players.score` = score cumulé (mis à jour par Edge Function)
- `score_events` = historique détaillé, traçabilité complète des points

---

## 2. Machine d'états des rounds

```text
  pending ──► collecting ──► voting ──► results ──► finished
                  │                        ▲
                  └────────────────────────┘
                    (si pas de phase vote)
```

Par mini-jeu :
- **Estimation** : pending → collecting → results → finished
- **Bluff** : pending → collecting → voting → results → finished
- **Vote social** : pending → collecting → voting → results → finished

Les transitions sont déclenchées exclusivement par les Edge Functions.

---

## 3. Edge Functions & sécurité

**start-game** (hôte uniquement)
- Vérifie que le caller est l'hôte
- Génère les rounds avec questions aléatoires
- Passe le premier round en `collecting`

**submit-answer**
- Vérifie : round en status `collecting`, joueur n'a pas déjà soumis
- Insère dans `submissions`

**submit-vote**
- Vérifie : round en status `voting`, joueur n'a pas déjà voté, ne vote pas pour sa propre submission
- Insère dans `votes`

**advance-round**
- Appelé par l'hôte ou automatiquement après timer
- Gère la transition d'état selon le `game_type`
- En transition vers `results` : appelle la logique de scoring

**calculate-scores** (interne, appelé par advance-round)
- Logique séparée par `game_type` :
  - **Estimation** : points = max(0, 1000 - écart)
  - **Bluff** : points par vote reçu sur ta fausse réponse
  - **Vote social** : points proportionnels aux votes reçus
- Crée les `score_events` avec raison détaillée
- Met à jour `players.score` (cumulé)
- Passe au round suivant ou termine la partie

---

## 4. Architecture frontend modulaire

```text
src/
  pages/
    Home.tsx              — Créer / rejoindre une room
    Lobby.tsx             — Liste joueurs, bouton lancer
    Game.tsx              — Écran de round générique
    Results.tsx           — Classement final
  components/
    games/
      GameRouter.tsx      — Charge le composant selon game_type
      EstimationGame.tsx  — UI estimation
      BluffGame.tsx       — UI bluff (2 phases)
      VoteSocialGame.tsx  — UI vote social
    RoundStatus.tsx       — Affiche état du round, timer
    PlayerList.tsx        — Liste des joueurs + scores
    Scoreboard.tsx        — Classement avec score_events
    Podium.tsx            — Podium final animé
  hooks/
    useRoom.ts            — Écoute Realtime sur la room
    useRound.ts           — État du round courant
    usePlayers.ts         — Liste joueurs temps réel
  lib/
    supabase.ts           — Client Supabase
    gameTypes.ts          — Registry des mini-jeux (config, composant, scoring)
```

**GameRouter.tsx** est le coeur modulaire : il reçoit le round courant et rend le composant correspondant au `game_type`. Ajouter un nouveau mini-jeu = ajouter un composant + l'enregistrer dans `gameTypes.ts`.

---

## 5. Temps réel

- Channel Realtime par room : `room:{code}`
- Écoute sur `rounds` (changement de status) pour synchroniser tous les joueurs
- Écoute sur `players` (nouveaux joueurs, scores mis à jour)
- Les transitions d'état sont broadcast après chaque Edge Function

---

## 6. Résumé des règles de sécurité (serveur)

| Règle | Où |
|---|---|
| 1 réponse par joueur par round | submit-answer + contrainte unique |
| 1 vote par joueur par round | submit-vote + contrainte unique |
| Pas de vote pour soi-même | submit-vote (vérification serveur) |
| Seul l'hôte lance la partie | start-game (vérification serveur) |
| Scores calculés côté serveur uniquement | calculate-scores (Edge Function) |

