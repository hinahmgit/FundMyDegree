// Central access to environment variables. Read lazily so builds work without them.
function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`Missing environment variable ${name}. See .env.example.`);
  return value;
}

export const env = {
  supabaseUrl: () => required("NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: () => required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  supabaseServiceKey: () => required("SUPABASE_SERVICE_ROLE_KEY"),
  siteUrl: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
  paymentProvider: () => process.env.PAYMENT_PROVIDER ?? "mock",
  exchangeRateProvider: () => process.env.EXCHANGE_RATE_PROVIDER ?? "stored",
  emailProvider: () => process.env.EMAIL_PROVIDER ?? "console",
  resendApiKey: () => process.env.RESEND_API_KEY ?? "",
  emailFrom: () => process.env.EMAIL_FROM ?? "FundMyDegree <no-reply@fundmydegree.org>",
  cronSecret: () => process.env.CRON_SECRET ?? "",
};
