import Link from "next/link";
import { getT } from "@/i18n/server";
import { getFormatter, type Formatter } from "@/lib/server-format";
import { getStudentCards } from "@/lib/listing";
import { countryName } from "@/lib/format";
import { StudentCard } from "@/components/student-card";
import { Badge } from "@/components/ui";
import { CountUp, Reveal } from "@/components/motion";
import { impactStats, partnerUniversities, sampleStudents, testimonials, type SampleStudent } from "@/content/landing";
import type { Translator } from "@/i18n/translate";

export default async function Home() {
  const t = await getT();
  const f = await getFormatter().catch(() => null);
  const real = process.env.NEXT_PUBLIC_SUPABASE_URL
    ? await getStudentCards({ sort: "closest" }).then((c) => c.filter((s) => s.grant && s.remainingUsd > 0).slice(0, 6)).catch(() => [])
    : [];
  const samples = sampleStudents.slice(0, Math.max(0, 6 - real.length));
  const locale = f?.locale ?? "en";

  return (
    <div className="relative left-1/2 -my-8 w-screen -translate-x-1/2 overflow-x-clip">
      <Hero t={t} />
      <UniversityStrip t={t} />
      <Stats t={t} locale={locale} />
      <HowItWorks t={t} />

      <section id="students" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
        <SectionHeading eyebrow={t("home.featuredEyebrow")} title={t("home.featuredTitle")} body={t("home.featuredBody")} />
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {real.map((s, i) => (
            <Reveal key={s.id} delay={i * 80}>{f && <StudentCard s={s} t={t} f={f} />}</Reveal>
          ))}
          {samples.map((s, i) => (
            <Reveal key={s.name} delay={(real.length + i) * 80}>
              <SampleCard s={s} t={t} f={f} />
            </Reveal>
          ))}
        </div>
        <div className="mt-10 flex flex-col items-center gap-3">
          <Link href="/students" className="btn-primary px-6 py-3 text-base">{t("home.seeAll")} →</Link>
          {samples.length > 0 && <p className="text-xs text-stone-400">{t("home.sampleNote")}</p>}
        </div>
      </section>

      <WaysToGive t={t} />
      <MoneyFlow t={t} />
      <Achievements t={t} />
      <Testimonials t={t} />
      <Faq t={t} />
      <FinalCta t={t} />
    </div>
  );
}

/* ───────────────────────── Sections ───────────────────────── */

function SectionHeading({ eyebrow, title, body, light }: { eyebrow: string; title: string; body?: string; light?: boolean }) {
  return (
    <Reveal className="mx-auto max-w-2xl text-center">
      <p className={`text-sm font-semibold tracking-widest uppercase ${light ? "text-brand-300" : "text-brand-600"}`}>{eyebrow}</p>
      <h2 className={`mt-3 font-display text-3xl font-bold sm:text-4xl ${light ? "text-white" : ""}`}>{title}</h2>
      {body && <p className={`mt-4 text-lg ${light ? "text-stone-300" : "text-stone-600"}`}>{body}</p>}
    </Reveal>
  );
}

function Hero({ t }: { t: Translator }) {
  const w = sampleStudents[0];
  const pct = Math.round((w.confirmed / w.target) * 100);
  const pendingPct = Math.round((w.pending / w.target) * 100);
  return (
    <section className="relative isolate overflow-hidden bg-gradient-to-b from-brand-50 via-cream to-cream">
      <div className="bg-grid absolute inset-0 -z-10 [mask-image:radial-gradient(ellipse_at_top,black_30%,transparent_70%)]" />
      <div className="animate-blob absolute -top-24 -left-24 -z-10 h-96 w-96 rounded-full bg-brand-200/50 blur-3xl" />
      <div className="animate-blob absolute top-40 -right-20 -z-10 h-80 w-80 rounded-full bg-trust-100/70 blur-3xl [animation-delay:-6s]" />

      <div className="mx-auto grid max-w-6xl items-center gap-14 px-4 pt-16 pb-20 sm:pt-24 lg:grid-cols-[1.1fr_1fr] lg:pb-28">
        <div>
          <p className="animate-fade-up inline-flex items-center gap-2 rounded-full border border-brand-200 bg-white/80 px-3 py-1 text-sm font-medium text-brand-700 shadow-sm">
            <span className="h-2 w-2 rounded-full bg-trust-500 animate-pulse-ring" />
            {t("home.eyebrow")}
          </p>
          <h1 className="animate-fade-up mt-6 font-display text-5xl leading-[1.05] font-bold tracking-tight sm:text-6xl [animation-delay:100ms]">
            {t("home.heroTitle")}
            <br />
            <span className="bg-gradient-to-r from-brand-600 via-brand-500 to-trust-600 bg-clip-text text-transparent">{t("home.heroTitleAccent")}</span>
          </h1>
          <p className="animate-fade-up mt-6 max-w-xl text-lg leading-relaxed text-stone-600 [animation-delay:200ms]">{t("home.heroBody")}</p>
          <div className="animate-fade-up mt-8 flex flex-col gap-3 sm:flex-row [animation-delay:300ms]">
            <Link href="/students" className="btn-primary px-7 py-3.5 text-base shadow-lg shadow-brand-600/20 transition hover:-translate-y-0.5">{t("home.ctaDonor")} →</Link>
            <Link href="/signup?role=student" className="btn-secondary px-7 py-3.5 text-base transition hover:-translate-y-0.5">{t("home.ctaStudent")}</Link>
          </div>
          <ul className="animate-fade-up mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm text-stone-600 [animation-delay:400ms]">
            {[t("home.heroTrust1"), t("home.heroTrust2"), t("home.heroTrust3")].map((x) => (
              <li key={x} className="flex items-center gap-2"><Check />{x}</li>
            ))}
          </ul>
        </div>

        <div className="relative mx-auto w-full max-w-md lg:max-w-none">
          <div className="animate-pop relative rounded-3xl border border-stone-200 bg-white p-6 shadow-2xl shadow-stone-900/10 [animation-delay:250ms]">
            <div className="flex items-center gap-4">
              <Initials name={w.name} hue={w.hue} size={64} />
              <div>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-semibold">{w.name}</p>
                  <span className="rounded-full bg-trust-100 px-2 py-0.5 text-xs font-medium text-trust-700">✓ {t("student.verifiedBadge")}</span>
                </div>
                <p className="text-sm text-stone-500">{w.university} · {countryName(w.countryCode)}</p>
              </div>
            </div>
            <p className="mt-4 text-sm leading-relaxed text-stone-600">{w.story}</p>
            <div className="mt-5 rounded-2xl bg-stone-50 p-4">
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-medium">{t("home.heroCardTerm")}</span>
                <span className="font-semibold text-trust-700">{pct}% {t("home.heroCardFunded")}</span>
              </div>
              <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-stone-200">
                <div className="animate-grow h-full rounded-l-full bg-trust-500 [animation-delay:600ms]" style={{ width: `${pct}%` }} />
                <div className="animate-grow h-full bg-brand-300 [animation-delay:1200ms]" style={{ width: `${pendingPct}%` }} />
              </div>
              <div className="mt-3 flex items-center justify-between">
                <div className="flex -space-x-2">
                  {[200, 20, 280, 140].map((h, i) => <span key={h} className="h-7 w-7 rounded-full border-2 border-white" style={{ background: `linear-gradient(135deg, hsl(${h} 70% 70%), hsl(${h + 30} 60% 50%))`, zIndex: 4 - i }} />)}
                </div>
                <span className="text-xs text-stone-500">{t("home.heroCardDonors", { count: w.supporters })}</span>
              </div>
            </div>
          </div>

          <div className="animate-float absolute -top-12 -right-2 hidden rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-xl sm:block lg:-right-8">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-trust-100 text-trust-700"><ReceiptIcon /></span>
              <div>
                <p className="text-sm font-semibold">{t("home.heroReceipt")}</p>
                <p className="text-xs text-stone-500">{t("home.heroReceiptSub")}</p>
              </div>
            </div>
          </div>
          <div className="animate-float-slow absolute -bottom-8 -left-4 hidden rounded-2xl border border-stone-200 bg-white px-4 py-3 shadow-xl sm:block lg:-left-10 [animation-delay:-3s]">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-brand-100 text-brand-700"><CapIcon /></span>
              <div>
                <p className="text-sm font-semibold">{t("home.heroResult")}</p>
                <p className="text-xs text-stone-500">{t("home.heroResultSub")}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}

function UniversityStrip({ t }: { t: Translator }) {
  const list = [...partnerUniversities, ...partnerUniversities];
  return (
    <section className="border-y border-stone-200 bg-white py-8">
      <p className="px-4 text-center text-sm font-medium text-stone-500">{t("home.universitiesTitle", { count: impactStats.countries })}</p>
      <div className="marquee-mask mt-5 overflow-hidden">
        <div className="animate-marquee flex w-max gap-12 pr-12">
          {list.map((u, i) => (
            <span key={i} className="flex items-center gap-2 font-display text-lg font-semibold whitespace-nowrap text-stone-400">
              <CapIcon className="h-5 w-5 text-stone-300" />
              {u}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

function Stats({ t, locale }: { t: Translator; locale: string }) {
  const items = [
    { label: t("home.statFunded"), node: <CountUp value={impactStats.fundedUsd} prefix="$" compact locale={locale} /> },
    { label: t("home.statStudents"), node: <CountUp value={impactStats.students} locale={locale} /> },
    { label: t("home.statCountries"), node: <CountUp value={impactStats.countries} locale={locale} /> },
    { label: t("home.statUniversities"), node: <CountUp value={impactStats.universities} locale={locale} /> },
    { label: t("home.statGraduates"), node: <CountUp value={impactStats.graduates} locale={locale} /> },
    { label: t("home.statToUniversity"), node: <CountUp value={impactStats.toUniversityPct} suffix="%" locale={locale} /> },
  ];
  return (
    <section className="relative overflow-hidden bg-stone-900 py-20 sm:py-24">
      <div className="animate-blob absolute -top-32 left-1/3 h-96 w-96 rounded-full bg-brand-600/20 blur-3xl" />
      <div className="relative mx-auto max-w-6xl px-4">
        <SectionHeading eyebrow={t("home.statsEyebrow")} title={t("home.statsTitle")} light />
        <div className="mt-14 grid grid-cols-2 gap-px overflow-hidden rounded-3xl bg-white/10 md:grid-cols-3">
          {items.map((it, i) => (
            <Reveal key={it.label} delay={i * 80} className="bg-stone-900/80 p-6 text-center sm:p-8">
              <p className="font-display text-4xl font-bold text-white sm:text-5xl">{it.node}</p>
              <p className="mt-2 text-sm text-stone-400">{it.label}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function HowItWorks({ t }: { t: Translator }) {
  const tracks = [
    {
      title: t("home.forStudents"),
      tone: "brand" as const,
      steps: [1, 2, 3, 4].map((n) => ({ title: t(`home.sStep${n}Title` as never), body: t(`home.sStep${n}Body` as never) })),
    },
    {
      title: t("home.forDonors"),
      tone: "trust" as const,
      steps: [1, 2, 3, 4].map((n) => ({ title: t(`home.dStep${n}Title` as never), body: t(`home.dStep${n}Body` as never) })),
    },
  ];
  return (
    <section id="how" className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <SectionHeading eyebrow={t("home.howEyebrow")} title={t("home.howTitle")} body={t("home.howBody")} />
      <div className="mt-14 grid gap-8 lg:grid-cols-2">
        {tracks.map((track, ti) => (
          <Reveal key={track.title} delay={ti * 150} className="rounded-3xl border border-stone-200 bg-white p-6 shadow-sm sm:p-8">
            <Badge tone={track.tone}>{track.title}</Badge>
            <ol className="relative mt-6 space-y-7 before:absolute before:top-2 before:bottom-2 before:left-5 before:w-px before:bg-stone-200">
              {track.steps.map((s, i) => (
                <li key={s.title} className="relative flex gap-4">
                  <span className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold text-white shadow-md ${track.tone === "brand" ? "bg-brand-600" : "bg-trust-600"}`}>{i + 1}</span>
                  <div className="pt-1.5">
                    <p className="font-semibold">{s.title}</p>
                    <p className="mt-1 text-sm leading-relaxed text-stone-600">{s.body}</p>
                  </div>
                </li>
              ))}
            </ol>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function SampleCard({ s, t, f }: { s: SampleStudent; t: Translator; f: Formatter | null }) {
  const remaining = Math.max(0, s.target - s.confirmed - s.pending);
  const c = (s.confirmed / s.target) * 100;
  const p = (s.pending / s.target) * 100;
  const money = (n: number) => (f ? f.money(n, s.currency) : `${s.currency} ${n.toLocaleString()}`);
  const est = f?.estimate(remaining, s.currency);
  return (
    <article className="group flex h-full flex-col rounded-3xl border border-stone-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:shadow-xl">
      <div className="flex items-center gap-3">
        <Initials name={s.name} hue={s.hue} size={52} />
        <div className="min-w-0">
          <h3 className="truncate font-semibold group-hover:text-brand-700">{s.name}</h3>
          <p className="truncate text-sm text-stone-500">{s.university}</p>
          <p className="text-xs text-stone-400">{countryName(s.countryCode)}</p>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-1.5">
        <Badge tone="brand">{t(`degree.${s.degree}`)}</Badge>
        <Badge>{s.field}</Badge>
        <Badge>{t("common.termXofY", { x: s.term, y: s.totalTerms })}</Badge>
      </div>
      <p className="mt-4 flex-1 text-sm leading-relaxed text-stone-600">“{s.story}”</p>
      <div className="mt-5">
        <div className="flex h-2.5 overflow-hidden rounded-full bg-stone-200">
          <div className="grow-on-reveal h-full bg-trust-500" style={{ "--w": `${c}%`, width: `${c}%` } as React.CSSProperties} />
          <div className="grow-on-reveal h-full bg-brand-300" style={{ "--w": `${p}%`, width: `${p}%` } as React.CSSProperties} />
        </div>
        <div className="mt-2 flex items-baseline justify-between text-sm">
          <span className="font-semibold text-brand-700">{t("home.remaining", { amount: money(remaining) })}</span>
          <span className="text-xs text-stone-500">{t("home.heroCardDonors", { count: s.supporters })}</span>
        </div>
        {est && <p className="text-xs text-stone-400">{t("common.estimate", { amount: est })}</p>}
      </div>
      <Link href="/students" className="btn-secondary mt-5 w-full group-hover:border-brand-300 group-hover:text-brand-700">{t("home.viewProfile")}</Link>
    </article>
  );
}

function WaysToGive({ t }: { t: Translator }) {
  const cards = [
    { title: t("home.platformTitle"), body: t("home.platformBody"), points: [t("home.platformPoint1"), t("home.platformPoint2"), t("home.platformPoint3")], icon: <CardIcon />, tone: "brand" },
    { title: t("home.directTitle"), body: t("home.directBody"), points: [t("home.directPoint1"), t("home.directPoint2"), t("home.directPoint3")], icon: <BankIcon />, tone: "trust" },
  ];
  return (
    <section className="bg-gradient-to-b from-cream to-brand-50/60 py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading eyebrow={t("home.waysEyebrow")} title={t("home.waysTitle")} />
        <div className="mt-14 grid gap-6 md:grid-cols-2">
          {cards.map((c, i) => (
            <Reveal key={c.title} delay={i * 150} className="rounded-3xl border border-stone-200 bg-white p-8 shadow-sm transition hover:shadow-lg">
              <span className={`flex h-12 w-12 items-center justify-center rounded-2xl ${c.tone === "brand" ? "bg-brand-100 text-brand-700" : "bg-trust-100 text-trust-700"}`}>{c.icon}</span>
              <h3 className="mt-5 text-xl font-semibold">{c.title}</h3>
              <p className="mt-2 leading-relaxed text-stone-600">{c.body}</p>
              <ul className="mt-5 space-y-2.5">
                {c.points.map((p) => <li key={p} className="flex items-start gap-2.5 text-sm"><Check />{p}</li>)}
              </ul>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function MoneyFlow({ t }: { t: Translator }) {
  const steps = [
    { title: t("home.flow1"), sub: t("home.flow1Sub"), icon: <HeartIcon /> },
    { title: t("home.flow2"), sub: t("home.flow2Sub"), icon: <BankIcon /> },
    { title: t("home.flow3"), sub: t("home.flow3Sub"), icon: <ReceiptIcon /> },
    { title: t("home.flow4"), sub: t("home.flow4Sub"), icon: <CapIcon /> },
  ];
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <SectionHeading eyebrow={t("home.flowEyebrow")} title={t("home.flowTitle")} />
      <div className="relative mt-14">
        <div className="absolute top-8 right-[12%] left-[12%] hidden h-px border-t-2 border-dashed border-brand-200 md:block" />
        <ol className="relative grid gap-8 md:grid-cols-4">
          {steps.map((s, i) => (
            <Reveal as="li" key={s.title} delay={i * 180} className="text-center">
              <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-stone-200 bg-white text-brand-600 shadow-md">{s.icon}</span>
              <p className="mt-4 font-semibold">{s.title}</p>
              <p className="mt-1 text-sm text-stone-500">{s.sub}</p>
            </Reveal>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Achievements({ t }: { t: Translator }) {
  const items = [1, 2, 3, 4].map((n) => ({ title: t(`home.ach${n}Title` as never), body: t(`home.ach${n}Body` as never) }));
  const icons = [<CapIcon key="a" />, <ShieldIcon key="b" />, <ChartIcon key="c" />, <HeartIcon key="d" />];
  return (
    <section className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-6xl px-4">
        <SectionHeading eyebrow={t("home.achievementsEyebrow")} title={t("home.achievementsTitle")} />
        <div className="mt-14 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((it, i) => (
            <Reveal key={it.title} delay={i * 100} className="group rounded-3xl border border-stone-200 bg-cream p-6 transition hover:-translate-y-1 hover:border-brand-200 hover:shadow-lg">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-white text-brand-600 shadow-sm transition group-hover:bg-brand-600 group-hover:text-white">{icons[i]}</span>
              <h3 className="mt-5 font-semibold">{it.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{it.body}</p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

function Testimonials({ t }: { t: Translator }) {
  const kindLabel = { student: t("roles.student"), donor: t("roles.donor"), university: t("receipt.university") };
  return (
    <section className="mx-auto max-w-6xl px-4 py-20 sm:py-28">
      <SectionHeading eyebrow={t("home.testimonialsEyebrow")} title={t("home.testimonialsTitle")} />
      <div className="mt-14 columns-1 gap-6 sm:columns-2 lg:columns-3">
        {testimonials.map((q, i) => (
          <Reveal key={q.name} delay={(i % 3) * 120} className="mb-6 break-inside-avoid rounded-3xl border border-stone-200 bg-white p-6 shadow-sm">
            <svg width="32" height="24" viewBox="0 0 32 24" className="text-brand-200" aria-hidden><path fill="currentColor" d="M0 24V14C0 6 4 1 12 0l1 4C8 5 6 8 6 12h6v12H0zm19 0V14c0-8 4-13 12-14l1 4c-5 1-7 4-7 8h6v12H19z" /></svg>
            <p className="mt-3 leading-relaxed text-stone-700">{q.quote}</p>
            <div className="mt-5 flex items-center gap-3 border-t border-stone-100 pt-4">
              <Initials name={q.name} hue={q.hue} size={40} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold">{q.name}</p>
                <p className="truncate text-xs text-stone-500">{q.role} · {countryName(q.countryCode)}</p>
              </div>
              <Badge tone={q.kind === "student" ? "brand" : q.kind === "donor" ? "trust" : "info"}>{kindLabel[q.kind]}</Badge>
            </div>
          </Reveal>
        ))}
      </div>
    </section>
  );
}

function Faq({ t }: { t: Translator }) {
  const items = [1, 2, 3, 4, 5].map((n) => ({ q: t(`home.faq${n}Q` as never), a: t(`home.faq${n}A` as never) }));
  return (
    <section id="faq" className="bg-white py-20 sm:py-28">
      <div className="mx-auto max-w-3xl px-4">
        <SectionHeading eyebrow={t("home.faqEyebrow")} title={t("home.faqTitle")} />
        <Reveal className="mt-12 divide-y divide-stone-200 rounded-3xl border border-stone-200 bg-cream">
          {items.map((it, i) => (
            <details key={it.q} className="faq group px-6 py-5" open={i === 0}>
              <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-semibold">
                {it.q}
                <span className="faq-icon flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 shadow-sm transition-transform">+</span>
              </summary>
              <p className="mt-3 leading-relaxed text-stone-600">{it.a}</p>
            </details>
          ))}
        </Reveal>
      </div>
    </section>
  );
}

function FinalCta({ t }: { t: Translator }) {
  return (
    <section className="px-4 py-20 sm:py-24">
      <Reveal className="relative mx-auto max-w-5xl overflow-hidden rounded-[2rem] bg-gradient-to-br from-brand-600 via-brand-700 to-brand-900 px-6 py-14 text-center shadow-2xl shadow-brand-900/20 sm:px-12 sm:py-20">
        <div className="animate-blob absolute -top-20 -right-20 h-72 w-72 rounded-full bg-trust-500/30 blur-3xl" />
        <div className="animate-blob absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-brand-300/30 blur-3xl [animation-delay:-8s]" />
        <h2 className="relative mx-auto max-w-2xl font-display text-3xl font-bold text-white sm:text-4xl">{t("home.ctaTitle")}</h2>
        <p className="relative mx-auto mt-4 max-w-xl text-lg text-brand-100">{t("home.ctaBody")}</p>
        <div className="relative mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <Link href="/students" className="btn bg-white px-7 py-3.5 text-base text-brand-700 shadow-lg transition hover:-translate-y-0.5 hover:bg-brand-50">{t("home.ctaDonorButton")} →</Link>
          <Link href="/signup?role=student" className="btn border border-white/40 px-7 py-3.5 text-base text-white transition hover:-translate-y-0.5 hover:bg-white/10">{t("home.ctaStudentButton")}</Link>
        </div>
      </Reveal>
    </section>
  );
}

/* ───────────────────────── Small pieces ───────────────────────── */

function Initials({ name, hue, size }: { name: string; hue: number; size: number }) {
  const initials = name.split(/\s+/).slice(0, 2).map((p) => p[0]).join("");
  return (
    <span
      aria-hidden
      className="flex shrink-0 items-center justify-center rounded-full font-semibold text-white shadow-inner"
      style={{ width: size, height: size, fontSize: size / 2.6, background: `linear-gradient(135deg, hsl(${hue} 65% 62%), hsl(${hue + 25} 55% 42%))` }}
    >
      {initials}
    </span>
  );
}

const icon = (d: string, className = "h-5 w-5") => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden><path d={d} /></svg>
);
const Check = () => (
  <svg viewBox="0 0 20 20" className="mt-0.5 h-4 w-4 shrink-0 text-trust-600" aria-hidden><path fill="currentColor" d="M8 13.6 4.4 10l-1.4 1.4 5 5 9-9L15.6 6z" /></svg>
);
const CapIcon = ({ className }: { className?: string }) => icon("M22 10 12 5 2 10l10 5 10-5zM6 12v5c3 2 9 2 12 0v-5", className);
const ReceiptIcon = () => icon("M6 2h12v20l-3-2-3 2-3-2-3 2zM9 7h6M9 11h6M9 15h4");
const BankIcon = () => icon("M3 21h18M5 21V10m14 11V10M9 21v-7m6 7v-7M12 3 2 9h20z");
const CardIcon = () => icon("M2 6h20v12H2zM2 10h20M6 15h4");
const HeartIcon = () => icon("M12 21s-8-5-8-11a4.5 4.5 0 0 1 8-3 4.5 4.5 0 0 1 8 3c0 6-8 11-8 11z");
const ShieldIcon = () => icon("M12 2 4 5v6c0 5 3.5 9.5 8 11 4.5-1.5 8-6 8-11V5zM9 12l2 2 4-4");
const ChartIcon = () => icon("M3 3v18h18M7 15l4-4 3 3 5-6");
