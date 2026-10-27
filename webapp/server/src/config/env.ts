import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

export const env = {
  port: parseInt(process.env.PORT ?? "3000", 10),

  pg: {
    host: required("PGHOST"),
    port: parseInt(process.env.PGPORT ?? "5432", 10),
    database: required("PGDATABASE"),
    user: required("PGUSER"),
    password: required("PGPASSWORD")
  },

  auth: {
    username: required("AUTH_USERNAME"),
    passwordHash: required("AUTH_PASSWORD_HASH"),
    sessionSecret: required("SESSION_SECRET")
  },

  intervals: {
    apiBaseUrl: process.env.INTERVALS_API_BASE_URL ?? "https://intervals.icu/api/v1"
  },

  logging: {
    level: process.env.LOG_LEVEL ?? "info"
  }
};
