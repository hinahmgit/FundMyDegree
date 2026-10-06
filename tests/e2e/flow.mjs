import { chromium } from "playwright";
import { execSync } from "node:child_process";

// End-to-end walkthrough of every phase against a running app + Supabase stack.
// See tests/e2e/README.md. DESTRUCTIVE: truncates all app data in $PG_URL first.
import fs from "node:fs";
const BASE = process.env.APP_URL ?? "http://localhost:3000";
const PG = process.env.PG_URL ?? "postgres://postgres@127.0.0.1:5499/supa";
const SHOTS = process.env.SHOTS_DIR ?? new URL("./shots", import.meta.url).pathname;
const PDF = new URL("./shots/sample.pdf", import.meta.url).pathname;
fs.mkdirSync(SHOTS, { recursive: true });
fs.writeFileSync(PDF, "%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF\n");
const run = Date.now().toString(36);
const sql = (q) => execSync(`psql "${PG}" -tAc "${q.replace(/"/g, '\\"')}"`).toString().trim();
const log = (...a) => console.log("✔", ...a);
sql("truncate audit_logs, notifications, user_blocks, message_reports, messages, conversations, student_updates, term_results, payment_attempts, saved_payment_methods, donations, disbursements, grants, documents, term_fees, student_profiles, universities, consents, profiles cascade; delete from auth.users;");

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function newUser(viewport = { width: 1280, height: 900 }) {
  const ctx = await browser.newContext({ viewport, timezoneId: "Europe/London" });
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.log("PAGE ERROR", e.message));
  return { ctx, page };
}
async function signup(page, { role, name, email, country, currency }) {
  await page.goto(`${BASE}/signup`);
  await page.locator(`label:has(input[value=${role}])`).click();
  await page.fill("#full_name", name);
  await page.fill("#email", email);
  await page.fill("#password", "correct-horse-battery");
  await page.selectOption("#country_code", country);
  if (currency) await page.selectOption("#preferred_currency", currency);
  for (const n of ["terms", "privacy", "data_processing"]) await page.check(`input[name=${n}]`);
  await page.click("button[type=submit]");
  await page.waitForURL((u) => !u.pathname.startsWith("/signup"));
}
const submitIn = async (page, scope) => { await scope.locator("button[type=submit]").first().click(); await page.waitForLoadState("networkidle"); };

// ── Admin ──
const admin = await newUser();
const adminEmail = `admin-${run}@example.org`;
await signup(admin.page, { role: "donor", name: "Ada Admin", email: adminEmail, country: "GB", currency: "GBP" });
sql(`update profiles set role='admin' where email='${adminEmail}'`);
await admin.page.goto(`${BASE}/admin/universities/new`);
await admin.page.fill("#name", `University of Nairobi ${run}`);
await admin.page.selectOption("#country_code", "KE");
await admin.page.selectOption("#fee_currency", "KES");
await admin.page.fill("#bank_name", "Kenya Commercial Bank");
await admin.page.fill("#bank_account_name", "University of Nairobi Fees");
await admin.page.fill("#iban", "KE12KCBL0000123456789");
await admin.page.fill("#swift_bic", "KCBLKENX");
await admin.page.fill("#payment_portal_url", "https://fees.example.ac.ke");
await admin.page.fill("#finance_contact_email", "finance@example.ac.ke");
await admin.page.click("main button[type=submit]");
await admin.page.getByText("University saved.").waitFor();
const uniId = sql(`select id from universities where name='University of Nairobi ${run}'`);
log("admin created university", uniId);

// ── Student ──
const student = await newUser({ width: 390, height: 844 });
const studentEmail = `student-${run}@example.org`;
await signup(student.page, { role: "student", name: "Wanjiru Kamau", email: studentEmail, country: "KE" });
const sp = student.page;
await sp.goto(`${BASE}/student/profile`);
await sp.selectOption("#university_id", uniId);
await sp.fill("#student_number", "F56/1234/2024");
await sp.selectOption("#degree_level", "undergraduate");
await sp.fill("#program_name", "BSc Computer Science");
await sp.fill("#field_of_study", "Computer Science");
await sp.fill("#current_term", "3");
await sp.fill("#total_terms", "4");
await sp.fill("#expected_graduation", "2028-06-30");
await sp.fill("#story", "I am the first in my family to attend university. I study computer science and want to build software that helps farmers in my county get fair prices. My parents are smallholder farmers and cannot cover my fees this year.");
await sp.locator("input[name=fee_term]").first().fill("3");
await sp.locator("input[name=fee_amount]").first().fill("120000");
await sp.getByRole("button", { name: /Add term/ }).click();
await sp.locator("input[name=fee_amount]").nth(1).fill("125000");
await sp.locator("form").filter({ has: sp.locator("#story") }).locator("button[type=submit]").click();
await sp.getByText("Saved").first().waitFor();
for (const type of ["government_id", "enrollment_proof", "tuition_invoice"]) {
  const form = sp.locator(`form:has(input[name=type][value=${type}])`);
  await form.locator("input[type=file]").setInputFiles(PDF);
  await form.locator("button[type=submit]").click();
  await sp.waitForTimeout(800);
}
await sp.reload();
await sp.screenshot({ path: `${SHOTS}/01-student-profile-mobile.png`, fullPage: true });
await sp.getByRole("button", { name: "Submit for verification" }).click();
await sp.waitForURL(`${BASE}/student`); await sp.getByText("reviewing your documents").waitFor();
const studentId = sql(`select id from profiles where email='${studentEmail}'`);
log("student submitted", studentId);

// Hidden until verified
const anon = await newUser();
await anon.page.goto(`${BASE}/students/${studentId}`);
if (!(await anon.page.getByText("Page not found").isVisible())) throw new Error("unverified student is visible");
log("unverified profile hidden from public");

// ── Admin verifies ──
await admin.page.goto(`${BASE}/admin/students`);
await admin.page.screenshot({ path: `${SHOTS}/02-admin-verification-queue.png`, fullPage: true });
await admin.page.goto(`${BASE}/admin/students/${studentId}`);
await admin.page.fill("#target_amount", "120000");
await admin.page.fill("#invoice_number", "INV-2026-3381");
await admin.page.getByRole("button", { name: "Verify and open grant" }).click();
await admin.page.getByText("Verified", { exact: true }).first().waitFor();
const grantId = sql(`select id from grants where student_id='${studentId}' and term_number=3`);
log("student verified, grant opened", grantId);

// ── Donor A: platform payment in GBP ──
const donorA = await newUser();
const donorAEmail = `donor-a-${run}@example.org`;
await signup(donorA.page, { role: "donor", name: "Tom Hughes", email: donorAEmail, country: "GB", currency: "GBP" });
const da = donorA.page;
await da.goto(`${BASE}/students?country=KE`);
await da.screenshot({ path: `${SHOTS}/03-listing.png`, fullPage: true });
await da.goto(`${BASE}/students/${studentId}`);
await da.screenshot({ path: `${SHOTS}/04-student-public.png`, fullPage: true });
await da.goto(`${BASE}/donate/${grantId}`);
await da.fill("#amount", "300");
await da.fill("#card_number", "4000 0000 0000 0002");
await da.fill("#expiry", "12/30");
await da.fill("#cvc", "123");
await da.fill("#holder", "Tom Hughes");
await da.getByRole("button", { name: /^Pay [^t]/ }).click();
await da.getByText("Payment failed: your card was declined.").waitFor();
log("declined card handled");
// Over the remaining amount is refused
await da.fill("#amount", "5000");
if (!(await da.getByRole("button", { name: /^Pay [^t]/ }).isDisabled())) throw new Error("overfunding not blocked in UI");
await da.fill("#amount", "300");
await da.fill("#card_number", "4242 4242 4242 4242"); await da.fill("#expiry", "12/30"); await da.fill("#cvc", "123"); await da.fill("#holder", "Tom Hughes");
await da.screenshot({ path: `${SHOTS}/05-donate-platform.png`, fullPage: true });
await da.getByRole("button", { name: /^Pay [^t]/ }).click();
await da.getByText("Thank you!").waitFor();
console.log("   donations:", sql(`select method||' '||status||' '||original_amount||original_currency||' -> '||grant_amount from donations where grant_id='${grantId}'`).replace(/\n/g, " | "));
log("platform payment confirmed (held, awaiting disbursement)");

// ── Donor B: direct pledge for the remainder ──
const donorB = await newUser();
const donorBEmail = `donor-b-${run}@example.org`;
await signup(donorB.page, { role: "donor", name: "Priya Shah", email: donorBEmail, country: "IN", currency: "INR" });
const db_ = donorB.page;
await db_.goto(`${BASE}/donate/${grantId}`);
await db_.getByRole("button", { name: /Pay the university directly/ }).click();
await db_.getByRole("button", { name: "Fund the rest of this term" }).click();
await db_.check("input[name=anonymous]");
await db_.getByRole("button", { name: /^Pledge/ }).click();
await db_.waitForURL(/\/donor\/pledges\//);
await db_.screenshot({ path: `${SHOTS}/06-pledge-payment-details.png`, fullPage: true });
await db_.locator("#file").setInputFiles(PDF);
await db_.fill("#reference", "FT2026100612345");
await db_.fill("#date", "2026-10-06");
await db_.getByRole("button", { name: "Upload proof" }).click();
await db_.getByText("under review").first().waitFor();
log("direct pledge + proof submitted");

// ── Admin confirms proof with adjusted amount ──
await admin.page.goto(`${BASE}/admin/proofs`);
await admin.page.screenshot({ path: `${SHOTS}/07-admin-proofs.png`, fullPage: true });
const remaining = Number(sql(`select grant_amount from donations where grant_id='${grantId}' and method='direct'`));
await admin.page.fill("input[name=confirmed_amount]", String(remaining - 500));
await admin.page.getByRole("button", { name: "Confirm payment" }).click();
await admin.page.waitForLoadState("networkidle");
console.log("   grant status after confirm:", sql(`select status from grants where id='${grantId}'`));

// ── Disbursement ──
await admin.page.goto(`${BASE}/admin/disbursements`);
await admin.page.screenshot({ path: `${SHOTS}/08-admin-disbursements.png`, fullPage: true });
await admin.page.fill("input[name=transfer_reference]", "SWIFT-MT103-889201");
await admin.page.locator("input[name=receipt]").setInputFiles(PDF);
await admin.page.getByRole("button", { name: "Record payment to university" }).click();
await admin.page.getByText("Queue is empty").waitFor();
console.log("   grant:", sql(`select status from grants where id='${grantId}'`), "| donations:", sql(`select string_agg(method||':'||status, ', ') from donations where grant_id='${grantId}' and status<>'rejected'`));
log("paid to university");

// ── Student results → next grant ──
await sp.goto(`${BASE}/student`);
await sp.screenshot({ path: `${SHOTS}/09-student-dashboard-mobile.png`, fullPage: true });
await sp.goto(`${BASE}/student/results/${grantId}`);
await sp.fill("#gpa", "3.6");
await sp.fill("#gpa_scale", "4.0");
await sp.locator("#transcript").setInputFiles(PDF);
await sp.fill("#summary", "Passed all units, top of my class in Algorithms!");
await sp.getByRole("button", { name: "Submit" }).click();
await sp.waitForURL(`${BASE}/student`); await sp.getByText("results are under review").waitFor();
await admin.page.goto(`${BASE}/admin/results`);
await admin.page.getByRole("button", { name: "Approve and open next grant" }).click();
await admin.page.waitForLoadState("networkidle");
const nextGrant = sql(`select id||' '||status||' '||target_amount from grants where student_id='${studentId}' and term_number=4`);
console.log("   next grant:", nextGrant);
log("results approved, next grant opened");

// ── Donor A: one-click renew + receipts + messaging ──
await da.goto(`${BASE}/donor`);
await da.screenshot({ path: `${SHOTS}/10-donor-dashboard.png`, fullPage: true });
await da.getByRole("button", { name: /^Renew/ }).click();
await da.getByText("Thank you for renewing your support!").waitFor();
log("one-click renewal charged saved card");
await da.goto(`${BASE}/notifications`);
await da.screenshot({ path: `${SHOTS}/11-donor-notifications.png`, fullPage: true });
await da.goto(`${BASE}/messages?with=${studentId}`);
await da.getByRole("button", { name: "Send a message" }).click();
await da.waitForURL(/\/messages\/.+/);
await da.fill("textarea[name=body]", "Email me at tom@example.com");
await da.getByRole("button", { name: "Send" }).click();
await da.getByText(/can't include email addresses/).waitFor();
log("message with email blocked");
await da.fill("textarea[name=body]", "Congratulations on your results, Wanjiru! Keep going.");
await da.getByRole("button", { name: "Send" }).click();
await da.getByText("Congratulations on your results").waitFor();
await sp.goto(`${BASE}/messages`);
await sp.locator("a[href^='/messages/']").first().click();
await sp.getByRole("button", { name: /Share my latest results/ }).click();
await sp.waitForLoadState("networkidle");
await sp.screenshot({ path: `${SHOTS}/12-student-messages-mobile.png`, fullPage: true });
log("messaging works");

// Anonymous donor is masked for the student
const masked = await sp.goto(`${BASE}/student`).then(() => sp.content());
if (masked.includes("Priya Shah")) throw new Error("anonymous donor name leaked to student");
log("anonymous donor masked on student dashboard");

// Document access control: donor A cannot open the student's ID
const idDoc = sql(`select id from documents where student_id='${studentId}' and type='government_id' limit 1`);
const resp = await da.request.get(`${BASE}/api/files/${idDoc}`, { maxRedirects: 0 });
if (resp.status() !== 404) throw new Error(`ID document exposed: ${resp.status()}`);
const receiptDoc = sql(`select receipt_document_id from disbursements where grant_id='${grantId}'`);
const r2 = await da.request.get(`${BASE}/api/files/${receiptDoc}`, { maxRedirects: 0 });
if (r2.status() !== 307) throw new Error(`receipt not visible to donor: ${r2.status()}`);
log("student ID private; university receipt visible to donor");

// ── Admin overview, exports, audit ──
await admin.page.goto(`${BASE}/admin`);
await admin.page.waitForTimeout(1000);
await admin.page.screenshot({ path: `${SHOTS}/13-admin-overview.png`, fullPage: true });
const csv = await admin.page.request.get(`${BASE}/admin/transactions/export`);
console.log("   csv lines:", (await csv.text()).trim().split("\n").length);
await admin.page.goto(`${BASE}/admin/audit`);
await admin.page.screenshot({ path: `${SHOTS}/14-admin-audit.png`, fullPage: true });
console.log("   audit actions:", sql(`select string_agg(distinct action, ', ') from audit_logs`));

// ── Refund a held platform donation (student withdrew scenario) ──
await admin.page.goto(`${BASE}/admin/transactions?method=platform&status=confirmed`);
await admin.page.locator("summary", { hasText: "Refund" }).first().click();
await admin.page.locator("input[name=reason]").first().fill("Student deferred the term");
await admin.page.getByRole("button", { name: "Refund", exact: true }).first().click();
await admin.page.waitForLoadState("networkidle");
console.log("   after refund:", sql(`select string_agg(d.status::text, ',') from donations d join grants g on g.id=d.grant_id where g.term_number=4 and d.method='platform'`), "| audit:", sql(`select count(*) from audit_logs where action='donation.refunded'`));
log("refund recorded and audited");

// ── Pledge expiry via cron ──
const p2 = sql(`select id from reserve_donation('${sql(`select id from grants where student_id='${studentId}' and term_number=4`)}', '${sql(`select id from profiles where email='${donorBEmail}'`)}', 'direct', 1000, 'KES', 1, 1000, 0.0077, false)`).split("|")[0];
sql(`update donations set pledge_expires_at = now() - interval '1 minute' where id='${p2}'`);
const cron = await fetch(`${BASE}/api/cron/daily`, { headers: { authorization: `Bearer ${process.env.CRON_SECRET ?? "test-cron"}` } }).then((r) => r.json());
console.log("   cron:", JSON.stringify(cron), "| pledge status:", sql(`select status from donations where id='${p2}'`));

// ── GDPR export ──
const exp = await da.request.get(`${BASE}/api/account/export`);
const data = await exp.json();
console.log("   export keys:", Object.keys(data).length, "donations:", data.donations_made.length);
await browser.close();
console.log("ALL GOOD");
