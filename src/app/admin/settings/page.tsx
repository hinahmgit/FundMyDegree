import { getT } from "@/i18n/server";
import { getSettings } from "@/lib/settings";
import { Card, PageHeader } from "@/components/ui";
import { ActionForm, SubmitButton } from "@/components/forms";
import { updateSettings } from "@/actions/admin";

export default async function AdminSettingsPage() {
  const [t, s] = await Promise.all([getT(), getSettings()]);
  return (
    <div className="max-w-xl">
      <PageHeader title={t("admin.settings.title")} />
      <Card>
        <ActionForm action={updateSettings}>
          <div>
            <label className="label" htmlFor="pledgeHoldDays">{t("admin.settings.pledgeHoldDays")}</label>
            <input id="pledgeHoldDays" name="pledgeHoldDays" type="number" min={1} max={90} className="input" defaultValue={s.pledgeHoldDays} />
          </div>
          <div>
            <label className="label" htmlFor="pledgeReminderDays">{t("admin.settings.pledgeReminderDays")}</label>
            <input id="pledgeReminderDays" name="pledgeReminderDays" type="number" min={0} max={30} className="input" defaultValue={s.pledgeReminderDays} />
          </div>
          <div>
            <label className="label" htmlFor="overfundTolerancePct">{t("admin.settings.overfundTolerancePct")}</label>
            <input id="overfundTolerancePct" name="overfundTolerancePct" type="number" min={0} max={20} step="0.1" className="input" defaultValue={s.overfundTolerancePct} />
          </div>
          <div>
            <label className="label" htmlFor="consentVersion">{t("admin.settings.consentVersion")}</label>
            <input id="consentVersion" name="consentVersion" className="input" defaultValue={s.consentVersion} />
          </div>
          <SubmitButton>{t("common.save")}</SubmitButton>
        </ActionForm>
      </Card>
    </div>
  );
}
