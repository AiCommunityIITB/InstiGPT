/**
 * IIT Bombay Gymkhana SSO adapter.
 */
import type { Config } from "../../config";

export interface SSOProfile {
  id: string;
  username: string;
  first_name: string;
  last_name: string;
  email: string;
  roll_number: string;
}

export async function exchangeCodeForProfile(
  code: string,
  config: Config
): Promise<SSOProfile | null> {
  // Exchange code for access token
  const tokenRes = await fetch(config.sso.tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      code,
      redirect_uri: config.sso.redirectUrl,
      grant_type: "authorization_code",
      client_id: config.sso.clientId,
      client_secret: config.sso.clientSecret,
    }),
  });

  const tokenData = (await tokenRes.json()) as Record<string, string>;
  if (!tokenData.access_token) return null;

  // Get user profile
  const profileRes = await fetch(config.sso.profileUrl, {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  });

  const profile = (await profileRes.json()) as Partial<SSOProfile>;
  if (!profile.id || !profile.username) return null;

  return profile as SSOProfile;
}
