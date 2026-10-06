// Hand-written row types for the tables in supabase/migrations.
// Regenerate-able with `supabase gen types typescript` if you prefer generated types.

export type UserRole = "student" | "donor" | "admin";
export type UniversityStatus = "pending" | "approved" | "rejected";
export type DegreeLevel = "undergraduate" | "masters" | "phd";
export type VerificationStatus = "draft" | "pending" | "verified" | "rejected";
export type StudentStatus = "active" | "graduated" | "withdrawn";
export type DocumentType =
  | "government_id"
  | "enrollment_proof"
  | "tuition_invoice"
  | "transcript"
  | "payment_proof"
  | "university_receipt"
  | "other";
export type GrantStatus = "pending_approval" | "open" | "funded" | "paid" | "rejected" | "cancelled";
export type DonationMethod = "platform" | "direct";
export type DonationStatus = "pending" | "confirmed" | "rejected" | "expired" | "disbursed" | "refunded";
export type ReviewStatus = "pending" | "approved" | "rejected";
export type TermKind = "semester" | "term" | "trimester" | "quarter" | "year";

export interface Profile {
  id: string;
  role: UserRole;
  full_name: string;
  email: string | null;
  country_code: string | null;
  preferred_currency: string;
  timezone: string;
  locale: string;
  avatar_path: string | null;
  suspended_at: string | null;
  suspended_reason: string | null;
  deleted_at: string | null;
  created_at: string;
}

export interface Country {
  code: string;
  name: string;
  default_currency: string | null;
}

export interface Currency {
  code: string;
  name: string;
  symbol: string;
  decimals: number;
}

export interface University {
  id: string;
  name: string;
  country_code: string;
  city: string | null;
  website: string | null;
  accreditation_body: string | null;
  accreditation_reference: string | null;
  fee_currency: string;
  status: UniversityStatus;
  rejection_reason: string | null;
  bank_name: string | null;
  bank_account_name: string | null;
  bank_account_number: string | null;
  iban: string | null;
  swift_bic: string | null;
  bank_address: string | null;
  payment_portal_url: string | null;
  payment_reference_instructions: string | null;
  finance_contact_name: string | null;
  finance_contact_email: string | null;
  finance_contact_phone: string | null;
  requested_by: string | null;
  created_at: string;
}

export interface StudentProfile {
  user_id: string;
  university_id: string | null;
  student_number: string | null;
  program_name: string | null;
  field_of_study: string | null;
  degree_level: DegreeLevel | null;
  term_kind: TermKind;
  current_term: number;
  total_terms: number;
  expected_graduation: string | null;
  story: string | null;
  total_degree_cost: number | null;
  photo_path: string | null;
  verification_status: VerificationStatus;
  verification_note: string | null;
  submitted_at: string | null;
  verified_at: string | null;
  status: StudentStatus;
  created_at: string;
}

export interface TermFee {
  id: string;
  student_id: string;
  term_number: number;
  label: string | null;
  amount: number;
  due_date: string | null;
}

export interface DocumentRow {
  id: string;
  owner_id: string | null;
  student_id: string | null;
  type: DocumentType;
  storage_path: string;
  file_name: string;
  mime_type: string | null;
  size_bytes: number | null;
  created_at: string;
}

export interface Grant {
  id: string;
  student_id: string;
  university_id: string;
  term_number: number;
  term_label: string | null;
  target_amount: number;
  currency: string;
  invoice_number: string | null;
  invoice_document_id: string | null;
  payment_deadline: string | null;
  status: GrantStatus;
  decision_reason: string | null;
  opened_at: string | null;
  funded_at: string | null;
  paid_at: string | null;
  created_at: string;
}

export interface GrantProgress {
  grant_id: string;
  target_amount: number;
  currency: string;
  confirmed_amount: number;
  pending_amount: number;
}

export interface Donation {
  id: string;
  donor_id: string | null;
  student_id: string;
  grant_id: string;
  method: DonationMethod;
  status: DonationStatus;
  anonymous: boolean;
  original_amount: number;
  original_currency: string;
  exchange_rate: number;
  grant_amount: number;
  confirmed_amount: number | null;
  usd_rate: number;
  pledge_expires_at: string | null;
  reminder_sent_at: string | null;
  proof_document_id: string | null;
  proof_reference: string | null;
  proof_date: string | null;
  proof_amount: number | null;
  proof_currency: string | null;
  proof_submitted_at: string | null;
  provider: string | null;
  provider_payment_id: string | null;
  failure_reason: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  rejection_reason: string | null;
  admin_note: string | null;
  reassigned_from_grant_id: string | null;
  refunded_at: string | null;
  disbursement_id: string | null;
  created_at: string;
}

export interface Disbursement {
  id: string;
  grant_id: string;
  platform_amount: number;
  currency: string;
  transfer_reference: string | null;
  receipt_document_id: string | null;
  paid_on: string;
  note: string | null;
  created_at: string;
}

export interface TermResult {
  id: string;
  student_id: string;
  grant_id: string;
  term_number: number;
  gpa: number | null;
  gpa_scale: number | null;
  transcript_document_id: string | null;
  summary: string | null;
  status: ReviewStatus;
  review_reason: string | null;
  reviewed_at: string | null;
  next_grant_id: string | null;
  created_at: string;
}

export interface StudentUpdate {
  id: string;
  student_id: string;
  term_result_id: string | null;
  body: string;
  created_at: string;
}

export interface Conversation {
  id: string;
  donor_id: string;
  student_id: string;
  last_message_at: string | null;
  created_at: string;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_id: string | null;
  kind: "text" | "result" | "update";
  body: string;
  ref_id: string | null;
  flagged: boolean;
  flag_reasons: string[];
  hidden: boolean;
  read_at: string | null;
  created_at: string;
}

export interface MessageReport {
  id: string;
  message_id: string | null;
  conversation_id: string;
  reporter_id: string | null;
  reported_user_id: string | null;
  reason: string;
  status: "open" | "resolved" | "dismissed";
  resolution_note: string | null;
  created_at: string;
}

export interface NotificationRow {
  id: string;
  user_id: string;
  type: string;
  params: Record<string, string | number>;
  link: string | null;
  read_at: string | null;
  created_at: string;
}

export interface AuditLog {
  id: number;
  actor_id: string | null;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}
