"use client";
import { useActionState, useState } from "react";
import { saveStudentProfile } from "@/actions/student";
import { useT } from "@/i18n/client";
import { ActionMessage, SubmitButton } from "@/components/forms";
import { Avatar } from "@/components/ui";
import type { ActionState } from "@/lib/action-state";
import type { StudentProfile, TermFee, TermKind } from "@/types/db";

type FeeRow = { key: number; term: number; label: string; amount: string; due: string };
const TERM_KINDS: TermKind[] = ["semester", "term", "trimester", "quarter", "year"];

export function ProfileForm({
  locked,
  student,
  fees,
  universities,
  photoUrl,
}: {
  locked: boolean;
  student: StudentProfile | null;
  fees: TermFee[];
  universities: { id: string; name: string; country: string; currency: string }[];
  photoUrl: string | null;
}) {
  const t = useT();
  const [state, action] = useActionState(saveStudentProfile, {} as ActionState);
  const [universityId, setUniversityId] = useState(student?.university_id ?? "");
  const [termKind, setTermKind] = useState<TermKind>(student?.term_kind ?? "semester");
  const [rows, setRows] = useState<FeeRow[]>(
    fees.length
      ? fees.map((f, i) => ({ key: i, term: f.term_number, label: f.label ?? "", amount: String(f.amount), due: f.due_date ?? "" }))
      : [{ key: 0, term: student?.current_term ?? 1, label: "", amount: "", due: "" }],
  );
  const currency = universities.find((u) => u.id === universityId)?.currency ?? "—";
  const update = (key: number, patch: Partial<FeeRow>) => setRows((r) => r.map((x) => (x.key === key ? { ...x, ...patch } : x)));

  return (
    <form action={action} className="space-y-6">
      <ActionMessage state={state} />

      <div className="flex items-center gap-4">
        <Avatar src={photoUrl} name="" size={64} />
        <div>
          <label className="label" htmlFor="photo">{t("studentProfile.photo")} <span className="font-normal text-stone-400">({t("common.optional")})</span></label>
          <input id="photo" name="photo" type="file" accept="image/jpeg,image/png,image/webp" className="text-sm" />
        </div>
      </div>

      <fieldset disabled={locked} className="grid gap-4 sm:grid-cols-2">
        <div className="sm:col-span-2">
          <label className="label" htmlFor="university_id">{t("studentProfile.university")}</label>
          <select id="university_id" name="university_id" className="input" value={universityId} onChange={(e) => setUniversityId(e.target.value)}>
            <option value="">—</option>
            {universities.map((u) => <option key={u.id} value={u.id}>{u.name} · {u.country} ({u.currency})</option>)}
          </select>
          <p className="hint">{t("studentProfile.universityHint")}</p>
        </div>
        <div>
          <label className="label" htmlFor="student_number">{t("studentProfile.studentNumber")}</label>
          <input id="student_number" name="student_number" className="input" defaultValue={student?.student_number ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="degree_level">{t("studentProfile.degreeLevel")}</label>
          <select id="degree_level" name="degree_level" className="input" defaultValue={student?.degree_level ?? ""}>
            <option value="">—</option>
            <option value="undergraduate">{t("degree.undergraduate")}</option>
            <option value="masters">{t("degree.masters")}</option>
            <option value="phd">{t("degree.phd")}</option>
          </select>
        </div>
        <div>
          <label className="label" htmlFor="program_name">{t("studentProfile.program")}</label>
          <input id="program_name" name="program_name" className="input" defaultValue={student?.program_name ?? ""} placeholder="BSc Computer Science" />
        </div>
        <div>
          <label className="label" htmlFor="field_of_study">{t("studentProfile.field")}</label>
          <input id="field_of_study" name="field_of_study" className="input" defaultValue={student?.field_of_study ?? ""} placeholder="Engineering" />
        </div>
        <div>
          <label className="label" htmlFor="term_kind">{t("studentProfile.termKind")}</label>
          <select id="term_kind" name="term_kind" className="input" value={termKind} onChange={(e) => setTermKind(e.target.value as TermKind)}>
            {TERM_KINDS.map((k) => <option key={k} value={k}>{t(`terms.kind_${k}`)}</option>)}
          </select>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="label" htmlFor="current_term">{t("studentProfile.currentTerm")}</label>
            <input id="current_term" name="current_term" type="number" min={1} max={20} className="input" defaultValue={student?.current_term ?? 1} />
          </div>
          <div>
            <label className="label" htmlFor="total_terms">{t("studentProfile.totalTerms")}</label>
            <input id="total_terms" name="total_terms" type="number" min={1} max={20} className="input" defaultValue={student?.total_terms ?? 8} />
          </div>
        </div>
        <div>
          <label className="label" htmlFor="expected_graduation">{t("studentProfile.expectedGraduation")}</label>
          <input id="expected_graduation" name="expected_graduation" type="date" className="input" defaultValue={student?.expected_graduation ?? ""} />
        </div>
        <div>
          <label className="label" htmlFor="total_degree_cost">{t("studentProfile.totalCost")} ({currency})</label>
          <input id="total_degree_cost" name="total_degree_cost" type="number" min={0} step="0.01" className="input" defaultValue={student?.total_degree_cost ?? ""} />
        </div>
      </fieldset>

      <div>
        <label className="label" htmlFor="story">{t("studentProfile.story")}</label>
        <textarea id="story" name="story" rows={6} maxLength={2000} className="input" defaultValue={student?.story ?? ""} />
        <p className="hint">{t("studentProfile.storyHint")}</p>
      </div>

      <fieldset disabled={locked}>
        <legend className="label">{t("studentProfile.fees")}</legend>
        <p className="hint mb-3">{t("studentProfile.feesHint", { currency })}</p>
        <div className="space-y-3">
          {rows.map((r) => (
            <div key={r.key} className="grid grid-cols-2 gap-2 rounded-xl bg-stone-50 p-3 sm:grid-cols-[5rem_1fr_9rem_10rem_auto] sm:items-end">
              <div>
                <label className="text-xs text-stone-500">#</label>
                <input name="fee_term" type="number" min={1} max={20} className="input" value={r.term} onChange={(e) => update(r.key, { term: Number(e.target.value) })} />
              </div>
              <div>
                <label className="text-xs text-stone-500">{t("studentProfile.feeLabel")}</label>
                <input name="fee_label" className="input" value={r.label} placeholder={t(`terms.${termKind}`, { n: r.term })} onChange={(e) => update(r.key, { label: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-stone-500">{t("studentProfile.feeAmount")} ({currency})</label>
                <input name="fee_amount" type="number" min={0} step="0.01" className="input" value={r.amount} onChange={(e) => update(r.key, { amount: e.target.value })} />
              </div>
              <div>
                <label className="text-xs text-stone-500">{t("studentProfile.feeDue")}</label>
                <input name="fee_due" type="date" className="input" value={r.due} onChange={(e) => update(r.key, { due: e.target.value })} />
              </div>
              <button type="button" className="btn-ghost text-red-600" onClick={() => setRows((x) => x.filter((y) => y.key !== r.key))} aria-label={t("common.delete")}>✕</button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn-secondary mt-3"
          onClick={() => setRows((x) => [...x, { key: Date.now(), term: (x.at(-1)?.term ?? 0) + 1, label: "", amount: "", due: "" }])}
        >
          + {t("studentProfile.addFee")}
        </button>
      </fieldset>

      <SubmitButton>{t("common.save")}</SubmitButton>
    </form>
  );
}
