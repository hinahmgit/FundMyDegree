#!/usr/bin/env bash
# Writes .env.local from the running local Supabase stack (`npx supabase start`).
set -euo pipefail
cd "$(dirname "$0")/.."
eval "$(npx supabase status -o env 2>/dev/null | grep -E '^(API_URL|ANON_KEY|SERVICE_ROLE_KEY)=')"
cat > .env.local <<ENV
NEXT_PUBLIC_SUPABASE_URL=${API_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${ANON_KEY}
SUPABASE_SERVICE_ROLE_KEY=${SERVICE_ROLE_KEY}
NEXT_PUBLIC_SITE_URL=http://localhost:3000
PAYMENT_PROVIDER=mock
EXCHANGE_RATE_PROVIDER=manual
EMAIL_PROVIDER=console
CRON_SECRET=local-cron-secret
ENV
echo "Wrote .env.local for ${API_URL}"
