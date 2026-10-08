# 🏝️ Banda World Islands

A 3D multiplayer world in the browser for kids, with islands, portals, learning games, minigames and teacher powers. It is available in English and Russian.

| URL | Who |
|---|---|
| `banda-worldislands.web.app` | Students (default) |
| `banda-worldislands.web.app/student` | Students |
| `banda-worldislands.web.app/teachers` (or `/teacher`) | Teachers (needs a teacher account or the teacher code) |

A student can also type **`/teacher <code>`** in chat (for example `/teacher banda-teacher`) to switch to teacher mode.

## What's inside

- **Language menu** at the start. When a player picks English or Русский, the whole game switches to that language. The 🌐 button switches it later.
- **3D islands** with procedural terrain, an animated ocean, a sky with a sun, trees, rocks and clouds. Walk between them with portals or 🗺️ fast travel:
  - 🏝️ **Star Hub**: the spawn island, with portals to every other island.
  - 🧮 **Math Island**: Math Quiz (+ − × ÷ squares mixed), Speed Math, Times Tables.
  - 🔤 **Language Island**: English Quiz, Russian Quiz, Word Match. Words are read aloud.
  - 🕹️ **Arcade Island**: Mini-Craft (a 3D block builder), Flappy Bird, Snake.
  - 🏟️ **Sports Island**: one football pitch and a dodgeball court.
  - 🏰 **Teacher Island**: a castle and a stage where teachers play with kids.
- **Stars ⭐ and house points 🏆.** Players earn stars in the learning games, admin-abuse events and minigames. **30 stars = 1 house point.** Teachers can also give or take house points directly. There are no groups, only each student's own score. The 🏆 button shows the leaderboard.
- **Multiplayer minigames**: ⚽ Football, 🔴 Dodgeball 3D (2+ players), 🙈 Hide & Seek (2+), ⭐ Star Hunt. Everyone is teleported to the arena and a 5/7/10-minute timer starts. When it ends, everyone goes back to where they were and sees the scores. Winners get stars. In football the ball moves when a player runs into it, and **F** does a power kick. In dodgeball, **F** throws.
- **Teacher powers** (🛠️ button or **T**):
  - 📢 Announcements: a big banner for everyone, read aloud.
  - ⚡ Admin abuse: Star rain (kids collect stars), Fireworks, Night, Disco party, Moon gravity, Super speed, Giant mode, Summon everyone, Freeze, Lock chat.
  - 🎁 Stars giveaway: +1 / +5 / +10 / +30 stars to every student.
  - 🎮 Minigames: start football, dodgeball, hide & seek or star hunt with a timer, or end one early.
  - 🎵 Music: 5 original songs (Champions Anthem, Dai Dai Dance, Island Party, Victory March, Chill Waves) plus sounds ("Champions!", "Дай-дай!", cheer, air horn, drum roll, whistle, goal).
  - 👧 Kids: give stars or house points to each online student.
- **Audio**: all music and sound effects are made in the browser with WebAudio, so there are no files to download. Voices use the browser's speech engine.
- **Phones and tablets**: joystick, jump and action buttons.

## Setup

Everything is in `public/js/config.js`.

1. **Multiplayer (Firebase Realtime Database).** Firebase Authentication is **not** used. Create a Realtime Database in the `banda-worldislands` Firebase project and paste the web app config into `CONFIG.firebase`. Without it, the game runs in *local mode*, where multiplayer only works between tabs of the same browser.
2. **Google sign-in with the4workspace.** Create an OAuth *Web* client ID in Google Cloud and add `https://banda-worldislands.web.app` as an authorized JavaScript origin. Then set:
   - `googleClientId`
   - `workspaceDomain`: your Workspace domain, so only school accounts can sign in.
   - `allowGuests: false`, to turn off name-only login.
3. **Teachers.** Put teacher emails in `teacherEmails`, or change the teacher code: `echo -n "new-code" | sha256sum` and paste the result into `teacherCodeSha256`. The default code is `banda-teacher`, so **change it**.
4. **Deploy.**
   ```bash
   npm i -g firebase-tools
   firebase login
   firebase deploy        # hosting + database rules
   ```

### Security note

The client decides who is a teacher and how many stars a player gets, and the database rules are open because Firebase Auth isn't used. This is fine for a classroom game. A determined student could still cheat by editing data in the browser. For real security you would need server-side checks, for example Firebase Auth with stricter rules, or Cloud Functions.

## Running locally

Serve the `public` folder so that every path falls back to `index.html`, for example with `firebase serve` or `npx serve -s public`. Then open `http://localhost:5000` and `http://localhost:5000/teachers` in two tabs.
