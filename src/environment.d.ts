declare global {
  namespace NodeJS {
    interface ProcessEnv {
      PAYLOAD_SECRET: string
      /** SQLite file, used only when POSTGRES_URL is unset. */
      DATABASE_URL: string
      /** Supabase Postgres. When set, it takes precedence over DATABASE_URL. */
      POSTGRES_URL?: string
      NEXT_PUBLIC_SERVER_URL: string
      VERCEL_PROJECT_PRODUCTION_URL: string
    }
  }
}

// If this file has no import/export statements (i.e. is a script)
// convert it into a module by adding an empty export statement.
export {}
