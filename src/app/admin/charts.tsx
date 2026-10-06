"use client";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useFormat, useT } from "@/i18n/client";
import { countryName } from "@/lib/format";
import type { AdminStats } from "@/lib/stats";

// Two validated categorical slots (CVD ΔE 12.2, normal ΔE 24.0 on the light surface).
const SERIES_1 = "#d96f27";
const SERIES_2 = "#1f9a8a";
const GRID = "#e7e5e4";
const AXIS = { fontSize: 12, fill: "#78716c" };

function ChartCard({ title, children, empty }: { title: string; children: React.ReactNode; empty?: boolean }) {
  const t = useT();
  return (
    <section className="card">
      <h3 className="mb-3 text-sm font-semibold text-stone-700">{title}</h3>
      {empty ? <p className="py-10 text-center text-sm text-stone-400">{t("common.noResults")}</p> : <div className="h-64">{children}</div>}
    </section>
  );
}

export function AdminCharts({ charts }: { charts: AdminStats["charts"] }) {
  const t = useT();
  const fmt = useFormat();
  const usd = (v: number) => fmt.money(v, "USD");
  const compact = (v: number) => new Intl.NumberFormat(fmt.locale, { notation: "compact", style: "currency", currency: "USD" }).format(v);
  const country = (c: string) => countryName(c, fmt.locale) || c;
  const tooltipStyle = { borderRadius: 8, border: "1px solid #e7e5e4", fontSize: 12 };

  const hbar = (data: { name: string; value: number }[], label: (n: string) => string = (n) => n) => (
    <ResponsiveContainer>
      <BarChart data={data.map((d) => ({ ...d, label: label(d.name) }))} layout="vertical" margin={{ left: 8, right: 16 }}>
        <CartesianGrid horizontal={false} stroke={GRID} />
        <XAxis type="number" tick={AXIS} tickFormatter={compact} axisLine={false} tickLine={false} />
        <YAxis type="category" dataKey="label" tick={AXIS} width={120} axisLine={false} tickLine={false} />
        <Tooltip formatter={(v) => usd(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f4" }} />
        <Bar dataKey="value" name="USD" fill={SERIES_1} radius={[0, 4, 4, 0]} maxBarSize={18} />
      </BarChart>
    </ResponsiveContainer>
  );

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <ChartCard title={t("admin.charts.overTime")} empty={!charts.overTime.length}>
        <ResponsiveContainer>
          <LineChart data={charts.overTime} margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} tickFormatter={compact} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v) => usd(Number(v))} contentStyle={tooltipStyle} />
            <Line type="monotone" dataKey="total" name={t("common.total")} stroke={SERIES_1} strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
          </LineChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t("admin.charts.split")} empty={!charts.overTime.length}>
        <ResponsiveContainer>
          <BarChart data={charts.overTime} margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="month" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} tickFormatter={compact} axisLine={false} tickLine={false} width={60} />
            <Tooltip formatter={(v) => usd(Number(v))} contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f4" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} />
            <Bar dataKey="platform" name={t("admin.stats.platform")} stackId="a" fill={SERIES_1} stroke="#fff" strokeWidth={2} maxBarSize={32} />
            <Bar dataKey="direct" name={t("admin.stats.direct")} stackId="a" fill={SERIES_2} stroke="#fff" strokeWidth={2} radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t("admin.charts.perTerm")} empty={!charts.studentsPerTerm.length}>
        <ResponsiveContainer>
          <BarChart data={charts.studentsPerTerm} margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="name" tick={AXIS} axisLine={false} tickLine={false} />
            <YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f4" }} />
            <Bar dataKey="value" name={t("admin.stats.studentsFunded")} fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={32} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t("admin.charts.donorVsStudent")} empty={!charts.donorVsStudent.length}>
        <ResponsiveContainer>
          <BarChart data={charts.donorVsStudent.map((d) => ({ ...d, label: country(d.name) }))} margin={{ left: 8, right: 16, top: 8 }}>
            <CartesianGrid vertical={false} stroke={GRID} />
            <XAxis dataKey="label" tick={AXIS} axisLine={false} tickLine={false} interval={0} angle={-30} textAnchor="end" height={60} />
            <YAxis tick={AXIS} allowDecimals={false} axisLine={false} tickLine={false} width={40} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "#f5f5f4" }} />
            <Legend wrapperStyle={{ fontSize: 12 }} verticalAlign="top" />
            <Bar dataKey="donors" name={t("admin.charts.donorCountries")} fill={SERIES_1} radius={[4, 4, 0, 0]} maxBarSize={18} />
            <Bar dataKey="students" name={t("admin.charts.studentCountries")} fill={SERIES_2} radius={[4, 4, 0, 0]} maxBarSize={18} />
          </BarChart>
        </ResponsiveContainer>
      </ChartCard>

      <ChartCard title={t("admin.charts.byCountry")} empty={!charts.byCountry.length}>{hbar(charts.byCountry, country)}</ChartCard>
      <ChartCard title={t("admin.charts.byUniversity")} empty={!charts.byUniversity.length}>{hbar(charts.byUniversity)}</ChartCard>
      <ChartCard title={t("admin.charts.byField")} empty={!charts.byField.length}>{hbar(charts.byField)}</ChartCard>
    </div>
  );
}
