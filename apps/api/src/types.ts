import type { Config } from "./config";

export interface Env {
  GROQ_API_KEY: string;
  SUPABASE_URL: string;
  SUPABASE_ANON_KEY: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  SSO_CLIENT_ID: string;
  SSO_CLIENT_SECRET: string;
  SSO_REDIRECT_URL: string;
  ENVIRONMENT: string;
  AI?: Ai;
}

/**
 * Request-scoped context available to all handlers.
 * This is the "dependency injection" — each request gets a fresh context.
 */
export interface AppContext {
  config: Config;
  user?: UserContext;
  ai: Ai;
}

export interface UserContext {
  id: string;
  username: string;
  name: string;
  email: string;
  roll_number: string;
  department?: string;
  year?: number;
  program?: string;
}
