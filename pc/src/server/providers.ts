import "server-only";
import { getEnv, githubEnabled, googleEnabled } from "./env";

export type SocialProviderId = "google" | "github";

/** Social sign-in buttons appear only for providers with credentials set. */
export function enabledProviders(): SocialProviderId[] {
  const env = getEnv();
  const providers: SocialProviderId[] = [];
  if (googleEnabled(env)) providers.push("google");
  if (githubEnabled(env)) providers.push("github");
  return providers;
}
