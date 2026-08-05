# Deploying Riptide (first-time cloud setup)

Dev and tests run against the local emulators (`npm run emulators`, `npm run test:emulator`).
These steps create the real (free, Spark-tier) Firebase project and deploy — done once, by you.

1. **Create the project** at https://console.firebase.google.com → Add project (free Spark plan; no card).
2. **Enable Google sign-in:** Authentication → Sign-in method → enable **Google**.
   - Later, add your deployed hosting domain under Authentication → Settings → Authorized domains.
3. **Enable Firestore:** Build → Firestore Database → Create database → **production mode** → pick a region.
4. **Register a Web app:** Project settings → General → Your apps → Web (</>) → copy the config values into `web/.env`
   (copy `web/.env.example` to `web/.env` first) and set `VITE_USE_EMULATOR=0` there.
5. **Link the CLI and deploy** (from `web/`):
   ```
   export PATH="$(brew --prefix openjdk)/bin:$PATH"   # only needed if you also run emulators
   npm exec -- firebase login
   npm exec -- firebase use --add        # select the project; alias it "default" (writes .firebaserc)
   npm run deploy
   ```
6. **Smoke test:** open the printed Hosting URL, sign in with a real Google account, change the rest-timer
   value on More, reload → it persists. Add the Hosting domain to Authorized domains (step 2) if sign-in is blocked.
7. **Install to phone:** open the URL in Safari → Share → Add to Home Screen.
