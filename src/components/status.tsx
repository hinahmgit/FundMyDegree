import { Badge, type Tone } from "@/components/ui";
import type { Translator } from "@/i18n/translate";
import type { Donation, GrantStatus, ReviewStatus, UniversityStatus, VerificationStatus } from "@/types/db";

const grantTones: Record<GrantStatus, Tone> = {
  pending_approval: "warn",
  open: "brand",
  funded: "trust",
  paid: "trust",
  rejected: "danger",
  cancelled: "neutral",
};
const verificationTones: Record<VerificationStatus, Tone> = { draft: "neutral", pending: "warn", verified: "trust", rejected: "danger" };
const reviewTones: Record<ReviewStatus, Tone> = { pending: "warn", approved: "trust", rejected: "danger" };

export function GrantStatusBadge({ status, t }: { status: GrantStatus; t: Translator }) {
  return <Badge tone={grantTones[status]}>{t(`status.grant.${status}`)}</Badge>;
}
export function VerificationBadge({ status, t }: { status: VerificationStatus; t: Translator }) {
  return <Badge tone={verificationTones[status]}>{t(`status.verification.${status}`)}</Badge>;
}
export function ReviewBadge({ status, t }: { status: ReviewStatus; t: Translator }) {
  return <Badge tone={reviewTones[status]}>{t(`status.review.${status}`)}</Badge>;
}
export function UniversityBadge({ status, t }: { status: UniversityStatus; t: Translator }) {
  return <Badge tone={status === "approved" ? "trust" : status === "pending" ? "warn" : "danger"}>{t(`status.university.${status}`)}</Badge>;
}

/** Donation status with the friendlier sub-states donors care about. */
export function DonationStatusBadge({ donation, t }: { donation: Pick<Donation, "status" | "method" | "proof_submitted_at">; t: Translator }) {
  const { status, method } = donation;
  if (status === "confirmed" && method === "platform") return <Badge tone="info">{t("status.donation.awaitingDisbursement")}</Badge>;
  if (status === "pending" && method === "direct") {
    return donation.proof_submitted_at ? <Badge tone="warn">{t("status.donation.proofUnderReview")}</Badge> : <Badge tone="brand">{t("status.donation.awaitingProof")}</Badge>;
  }
  const tone: Tone = status === "confirmed" || status === "disbursed" ? "trust" : status === "pending" ? "warn" : status === "refunded" ? "neutral" : "danger";
  return <Badge tone={tone}>{t(`status.donation.${status}`)}</Badge>;
}
