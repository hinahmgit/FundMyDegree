// Promote an existing account to admin. Usage: npm run make-admin -- you@example.org
import { createClient } from "@supabase/supabase-js";

const email = process.argv[2];
if (!email) {
  console.error("Usage: npm run make-admin -- <email>");
  process.exit(1);
}
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const { data, error } = await db.from("profiles").update({ role: "admin" }).eq("email", email).select("id");
if (error) throw error;
if (!data.length) {
  console.error(`No account found for ${email}. Sign up in the app first.`);
  process.exit(1);
}
console.log(`${email} is now an admin. Sign out and back in if you were logged in.`);
