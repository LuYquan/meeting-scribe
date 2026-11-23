import { initializeApp, type FirebaseApp } from "firebase/app";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";
import { getAI, GoogleAIBackend, type AI } from "firebase/ai";

/**
 * Firebase setup for Meeting Scribe.
 *
 * Configuration comes from environment variables (see .env.example).
 * Until a real Firebase project is connected, every value is a clearly
 * marked placeholder and `isFirebaseConfigured()` returns false — the app
 * then runs in setup mode and AI features stay disabled instead of failing
 * with a cryptic error.
 *
 * App Check: Firebase AI Logic enforces App Check. When a reCAPTCHA v3 site
 * key is provided we initialize it; when `VITE_FIREBASE_APPCHECK_DEBUG_TOKEN`
 * is "true" we enable the debug provider instead (debug tokens are accepted
 * for #BuildHybridAI submissions). With no site key at all, App Check init
 * is skipped so the app still works when enforcement is off in the console —
 * see SUBMISSION.md for the recommended console setting for the hosted demo.
 */

function getEnv(name: string): string {
  const viteEnv = (import.meta as unknown as { env?: Record<string, string | undefined> })
    .env;
  return viteEnv?.[name] ?? "";
}

export interface FirebaseConfigValues {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket: string;
  messagingSenderId: string;
  appId: string;
  recaptchaSiteKey: string;
  appCheckDebug: boolean;
}

export function readFirebaseConfig(): FirebaseConfigValues {
  return {
    apiKey: getEnv("VITE_FIREBASE_API_KEY"),
    authDomain: getEnv("VITE_FIREBASE_AUTH_DOMAIN"),
    projectId: getEnv("VITE_FIREBASE_PROJECT_ID"),
    storageBucket: getEnv("VITE_FIREBASE_STORAGE_BUCKET"),
    messagingSenderId: getEnv("VITE_FIREBASE_MESSAGING_SENDER_ID"),
    appId: getEnv("VITE_FIREBASE_APP_ID"),
    recaptchaSiteKey: getEnv("VITE_FIREBASE_RECAPTCHA_SITE_KEY"),
    appCheckDebug: getEnv("VITE_FIREBASE_APPCHECK_DEBUG_TOKEN") === "true",
  };
}

function isPlaceholder(value: string): boolean {
  const v = value.trim();
  return v === "" || v.startsWith("YOUR_") || v === "placeholder";
}

export function isFirebaseConfigured(): boolean {
  const c = readFirebaseConfig();
  return (
    !isPlaceholder(c.apiKey) &&
    !isPlaceholder(c.projectId) &&
    !isPlaceholder(c.appId)
  );
}

export function missingConfigKeys(): string[] {
  const c = readFirebaseConfig();
  const missing: string[] = [];
  if (isPlaceholder(c.apiKey)) missing.push("VITE_FIREBASE_API_KEY");
  if (isPlaceholder(c.authDomain)) missing.push("VITE_FIREBASE_AUTH_DOMAIN");
  if (isPlaceholder(c.projectId)) missing.push("VITE_FIREBASE_PROJECT_ID");
  if (isPlaceholder(c.storageBucket)) missing.push("VITE_FIREBASE_STORAGE_BUCKET");
  if (isPlaceholder(c.messagingSenderId))
    missing.push("VITE_FIREBASE_MESSAGING_SENDER_ID");
  if (isPlaceholder(c.appId)) missing.push("VITE_FIREBASE_APP_ID");
  return missing;
}

let app: FirebaseApp | null = null;
let ai: AI | null = null;
let appCheckInitialized = false;

export function getFirebaseApp(): FirebaseApp {
  if (app) return app;
  const c = readFirebaseConfig();
  app = initializeApp({
    apiKey: c.apiKey,
    authDomain: c.authDomain,
    projectId: c.projectId,
    storageBucket: c.storageBucket,
    messagingSenderId: c.messagingSenderId,
    appId: c.appId,
  });
  return app;
}

/** Initialize App Check (debug provider when requested, reCAPTCHA otherwise). */
export function initAppCheck(): void {
  if (appCheckInitialized) return;
  const c = readFirebaseConfig();
  const firebaseApp = getFirebaseApp();
  try {
    if (c.appCheckDebug) {
      (self as unknown as Record<string, unknown>).FIREBASE_APPCHECK_DEBUG_TOKEN =
        true;
    }
    if (!isPlaceholder(c.recaptchaSiteKey)) {
      initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider(c.recaptchaSiteKey),
      });
      appCheckInitialized = true;
    } else if (c.appCheckDebug) {
      // Debug provider is enabled via the global flag above; still call
      // initializeAppCheck so the debug token is minted. The provider
      // argument is required by the API but unused in debug mode.
      initializeAppCheck(firebaseApp, {
        provider: new ReCaptchaV3Provider("debug-token-provider"),
      });
      appCheckInitialized = true;
    }
    // No site key and no debug flag: skip App Check entirely. The app works
    // when App Check enforcement is off in the Firebase console.
  } catch (err) {
    console.warn("App Check initialization failed; continuing without it.", err);
  }
}

/**
 * The Firebase AI Logic service (Gemini Developer API backend).
 * This is the ONLY way the app reaches any AI model.
 */
export function getAIService(): AI {
  if (ai) return ai;
  initAppCheck();
  ai = getAI(getFirebaseApp(), { backend: new GoogleAIBackend() });
  return ai;
}
