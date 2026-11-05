import { homedir } from "node:os";
import { basename, join } from "node:path";

export const AUTH0_DOMAIN = "https://login.papayaglobal.com";
export const CLIENT_ID = "NNu0aY4wwC27R1ciCDB7qAYIvF65CR1I";
export const REDIRECT_URI =
  "com.papaya.papayapersonal://login.papayaglobal.com/android/com.papaya.papayapersonal/callback";
export const SCOPE = "openid email offline_access";
export const AUDIENCE = "https://papaya.eu.auth0.com/api/v2/";
export const MOBILE_API = "https://papaya.papayaglobal.com/mobile-api/public";
export const AUTH_API = "https://service.papayaglobal.com";
export const APP_VERSION = "android_2.1.13";

export const PAPAYA_DIR = join(homedir(), ".papaya");
export const STORE = join(PAPAYA_DIR, "session.json");
export const KEYRING_SERVICE = "papaya-cli";
export const KEYRING_ACCOUNT = "session";
export const CHROME_PROFILE = join(PAPAYA_DIR, "chrome-profile");

export const CDP_PORTS = [9222, 9223, 9224];
export const CHROME_CANDIDATES = [
  "google-chrome",
  "google-chrome-stable",
  "chromium",
  "chromium-browser",
];

export const ME_PATHS = ["/api/v1/worker/me", "/workers/me", "/api/v1/me"];

export const tenantApi = (slug: string) => `https://${slug}.papayaglobal.com`;

export const cmdName = () =>
  basename(process.argv[1] ?? "").replace(/\.[cm]?[jt]s$/, "") || "papaya-cli";
