# Wheelman Deployment Handoff

## Environment Variables

Mirror these from `.env.local.example` into Vercel Project Settings:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`
- `ANTHROPIC_API_KEY`
- `NEXT_PUBLIC_APP_URL`
- `SENTRY_DSN`
- `NEXT_PUBLIC_SENTRY_DSN`
- `SENTRY_ORG`
- `SENTRY_PROJECT`
- `SENTRY_AUTH_TOKEN`

## Production Notes

- `next.config.ts` includes CSP and security headers tuned for Supabase, Anthropic, and Google OAuth.
- Sentry is initialized for client/server/edge and a root `global-error` boundary is present.
- API routes capture exceptions through Sentry.
- Re-run `npm run lint && npm run build` before each production deployment.
