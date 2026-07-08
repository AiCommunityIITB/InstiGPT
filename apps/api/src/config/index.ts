/**
 * Centralized configuration.
 * All external bindings flow through here — makes testing trivial
 * (just pass a mock Config instead of mocking individual env vars).
 */
import type { Env } from "../types";

export interface Config {
  supabaseUrl: string;
  supabaseAnonKey: string;
  supabaseServiceKey: string;
  geminiApiKey: string;
  sso: {
    clientId: string;
    clientSecret: string;
    redirectUrl: string;
    tokenUrl: string;
    profileUrl: string;
  };
  isProduction: boolean;
}

export function createConfig(env: Env): Config {
  return {
    supabaseUrl: env.SUPABASE_URL,
    supabaseAnonKey: env.SUPABASE_ANON_KEY,
    supabaseServiceKey: env.SUPABASE_SERVICE_ROLE_KEY,
    geminiApiKey: env.GEMINI_API_KEY,
    sso: {
      clientId: env.SSO_CLIENT_ID,
      clientSecret: env.SSO_CLIENT_SECRET,
      redirectUrl: env.SSO_REDIRECT_URL,
      tokenUrl: "https://gymkhana.iitb.ac.in/profiles/oauth/token/",
      profileUrl:
        "https://gymkhana.iitb.ac.in/profiles/user/api/user/?fields=id,first_name,last_name,username,email,roll_number",
    },
    isProduction: env.ENVIRONMENT === "production",
  };
}
