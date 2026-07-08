export const config = {
  apiUrl: process.env.NEXT_PUBLIC_API_URL || "http://localhost:8787",
  ssoUrl: process.env.NEXT_PUBLIC_SSO_URL || "",
  isDev: process.env.NODE_ENV === "development",
} as const;
