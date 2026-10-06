// Writes .env.local from the running local Supabase stack (`npm run db:start`).
// Works on Windows, macOS and Linux.
import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";

let out;
try {
  out = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] });
} catch {
  console.error("Supabase isn't running. Start Docker Desktop, then run: npm run db:start");
  process.exit(1);
}
const vars = Object.fromEntries(
  out.split(/\r?\n/).map((l) => l.match(/^([A-Z_]+)="?(.*?)"?$/)).filter(Boolean).map((m) => [m[1], m[2]]),
);
const url = vars.API_URL;
const anon = vars.ANON_KEY ?? vars.PUBLISHABLE_KEY;
const service = vars.SERVICE_ROLE_KEY ?? vars.SECRET_KEY;
if (!url || !anon || !service) {
  console.error("Couldn't read keys from `npx supabase status`. Copy them into .env.local by hand (see .env.example).");
  process.exit(1);
}
writeFileSync(
  ".env.local",
  [
    `NEXT_PUBLIC_SUPABASE_URL=${url}`,
    `NEXT_PUBLIC_SUPABASE_ANON_KEY=${anon}`,
    `SUPABASE_SERVICE_ROLE_KEY=${service}`,
    "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
    "PAYMENT_PROVIDER=mock",
    "EXCHANGE_RATE_PROVIDER=manual",
    "EMAIL_PROVIDER=console",
    "CRON_SECRET=local-cron-secret",
    "",
  ].join("\n"),
);
console.log(`Wrote .env.local for ${url}`);
