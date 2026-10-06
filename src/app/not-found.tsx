import Link from "next/link";
import { getT } from "@/i18n/server";

export default async function NotFound() {
  const t = await getT();
  return (
    <div className="mx-auto max-w-md py-16 text-center">
      <h1 className="font-display text-3xl font-semibold">{t("errors.notFound")}</h1>
      <p className="mt-2 text-stone-600">{t("errors.notFoundBody")}</p>
      <Link href="/" className="btn-primary mt-6">{t("errors.goHome")}</Link>
    </div>
  );
}
