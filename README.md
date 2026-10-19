# Banda World Islands

A 3D multiplayer world for a school, in English and Russian. Students and teachers sign in with their The4Workspace account. They pick a server and an avatar, then travel between islands by metro to play learning games and class minigames.

| Address | Who |
|---|---|
| `banda-worldislands.web.app` (also `/student`) | Students |
| `banda-worldislands.web.app/teachers` | Teachers. Teacher tools come from a teacher account on The4Workspace. |

## How it works

- **Sign-in: The4Workspace.** The game sends players to `the4workspace.web.app`, which sends them back signed in. The hand-off works the same way as in LearnKyrgyz, Quoldek and the other apps. A player's teacher or student role comes from their The4Workspace profile, so there is no teacher code.
  - The hub must trust `banda-worldislands.web.app`. That is a one-line change, in [erdanthecoder/copilot#1](https://github.com/erdanthecoder/copilot/pull/1).
- **Servers: Supabase.** This is the same Supabase project as The4Workspace and LearnKyrgyz.
  - **Live multiplayer** uses Supabase Realtime. Each server (Server 1–4) is its own channel. Player positions, chat and minigame events go over broadcast, and the player list comes from presence.
  - **Saved data** lives in Postgres, in tables `banda_*` (`supabase/migrations/banda_0001_init.sql`, already applied):
    - `banda_players`: name, avatar, stars, points.
    - `banda_commands`: teacher commands. Only teachers can insert them, which the database checks with row-level security. Players receive them live.
    - `banda_award`, `banda_give`, `banda_claim`: the only way stars and points change. Players earn at most 10 stars at a time and 300 a day. Only teachers can give points. Each giveaway can be claimed once.
- **Hosting:** Firebase Hosting (`firebase.json`).

## The game

- **Avatar creator:** skin, hair style and colour, top, colours, trousers, shoes, hat, glasses and height. It is saved to the player's account.
- **Islands:**
  - Central Square: school, fountain, Quiz Battle, Hide & Seek, Star Hunt.
  - Math Island: Math Academy.
  - Language Island: Language Library.
  - Arcade Island: Arcade Hall, Mini-Craft, Impostor.
  - Sports Island: stadium and dodgeball court.
  - Teacher Island: Teachers' Hall.
- **Banda Metro:** every island has a station. Walk down to the underground platform, wait for the train, choose a stop and ride through the tunnel.
- **Learning games, with 4 levels each:**
  - Math: addition, subtraction, multiplication, division, order of operations, fractions, percentages, equations.
  - English and Russian: words, translation, spelling, grammar.
  - Speed Math, Times Tables and Word Match.
  - Harder levels give more stars. 30 stars = 1 house point.
- **Multiplayer minigames:** every player on the server takes part. They are moved to the arena, a 5, 7 or 10 minute timer runs, and then they go back and see the results.
  - Football, Dodgeball, Hide & Seek, Star Hunt.
  - **Impostor**, an Among Us-style game in an underground research station. Crewmates finish tasks by answering questions. Impostors eliminate crewmates. Anyone can report a body or call a meeting, and players vote someone out.
  - **Quiz Battle:** a live quiz for everyone. Faster correct answers score more.
- **Teacher tools** (T key):
  - Announcements, read aloud.
  - Admin abuse: star rain, fireworks, night, disco, moon gravity, super speed, giants, summon everyone, freeze, lock chat.
  - Star giveaways.
  - Start and end minigames, and choose the Quiz Battle subject and level.
  - 5 songs and sound effects.
  - Give stars or points to each student.
- **Graphics:** a physically based sky with environment lighting, a reflective ocean, wind-blown grass, trees, real buildings, and day and night. The monitor button switches to low quality for weaker computers.

## Deploy

```bash
npm i -g firebase-tools
firebase login
firebase deploy --only hosting
```

Then merge [erdanthecoder/copilot#1](https://github.com/erdanthecoder/copilot/pull/1) so The4Workspace sends players back to the game.

## Local testing

Serve `public/` so that every path falls back to `index.html`, for example with `npx serve -s public`. Then open `http://localhost:3000/?dev=1` and `http://localhost:3000/?dev=1&teacher=1` in two tabs. Dev mode skips sign-in, and multiplayer runs between tabs of the same browser.

## Limits

The Supabase free plan allows about 100 realtime messages per second for the whole project, which is enough for a class or two at once. Positions are sent 5 times a second, and only while a player moves. For several full classes at the same time, the Pro plan raises the limit.
