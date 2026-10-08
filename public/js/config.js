// ===== Banda World Islands — settings =====
// Fill these in before deploying. Everything works without them in "local mode"
// (multiplayer then only works between tabs of the same browser).
export const CONFIG = {
  // Firebase Realtime Database (multiplayer sync only — no Firebase Authentication needed).
  // Firebase console → Project settings → Your apps → Web app config.
  firebase: null,
  // Example:
  // firebase: {
  //   apiKey: '...',
  //   authDomain: 'banda-worldislands.firebaseapp.com',
  //   databaseURL: 'https://banda-worldislands-default-rtdb.firebaseio.com',
  //   projectId: 'banda-worldislands',
  //   appId: '...',
  // },

  // Google sign-in through the school's Google Workspace (the4workspace).
  // Google Cloud console → APIs & Services → Credentials → OAuth client ID (Web),
  // authorized JavaScript origin: https://banda-worldislands.web.app
  googleClientId: '',
  // Only accounts from this Workspace domain may sign in (e.g. 'the4workspace.com'). Empty = any Google account.
  workspaceDomain: '',
  // Allow "play as guest" (name only). Set false once Google sign-in is configured.
  allowGuests: true,

  // Teachers: these Google accounts become teachers automatically on /teachers ...
  teacherEmails: [],
  // ... everyone else must type the teacher code. Stored as SHA-256 (default code: "banda-teacher").
  // Generate a new one in a terminal: echo -n "your-code" | sha256sum
  teacherCodeSha256: '3c251876efc08ca365bcf9a22a76ea93acc39b5035d014eae2d7fc1e66e81c8f',

  starsPerPoint: 30,
};
