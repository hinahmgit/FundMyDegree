// Detects contact and banking details in messages. Messages with hard matches
// are blocked; soft matches are delivered but flagged for admin review.

export type ModerationReason = "email" | "phone" | "iban" | "card_number" | "bank_details" | "off_platform";

export interface ModerationResult {
  block: boolean;
  flag: boolean;
  reasons: ModerationReason[];
}

const EMAIL = /[A-Z0-9._%+-]+\s*(?:@|\(at\)|\[at\]|\sat\s)\s*[A-Z0-9.-]+\s*(?:\.|\(dot\)|\[dot\]|\sdot\s)\s*[A-Z]{2,}/i;
const IBAN = /\b[A-Z]{2}\d{2}(?:\s?[A-Z0-9]{4}){2,7}(?:\s?[A-Z0-9]{1,4})?\b/;
const SWIFT_HINT = /\b(swift|bic|iban|routing number|sort code|account (?:no|number|#))\b/i;
const OFF_PLATFORM = /\b(whats\s?app|telegram|signal app|wechat|viber|paypal|venmo|cash\s?app|western union|moneygram|m-?pesa|crypto|bitcoin|usdt|send (?:me )?(?:the )?money (?:directly|to me))\b/i;

function digitRuns(text: string): string[] {
  // Collapse common separators so "+1 (555) 123-4567" is seen as one run.
  return (text.match(/\+?\d[\d\s().\-/]{6,}\d/g) ?? []).map((m) => m.replace(/\D/g, ""));
}

function luhn(num: string): boolean {
  let sum = 0;
  let dbl = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let d = Number(num[i]);
    if (dbl && (d *= 2) > 9) d -= 9;
    sum += d;
    dbl = !dbl;
  }
  return sum % 10 === 0;
}

export function moderateMessage(text: string): ModerationResult {
  const reasons = new Set<ModerationReason>();
  if (EMAIL.test(text)) reasons.add("email");
  if (IBAN.test(text.toUpperCase()) && /\d{4}/.test(text)) reasons.add("iban");
  for (const run of digitRuns(text)) {
    if (run.length >= 13 && run.length <= 19 && luhn(run)) reasons.add("card_number");
    else if (run.length >= 8 && run.length <= 15) reasons.add("phone");
    else if (run.length > 15) reasons.add("bank_details");
  }
  if (SWIFT_HINT.test(text)) reasons.add("bank_details");
  const block = reasons.size > 0;
  if (OFF_PLATFORM.test(text)) reasons.add("off_platform");
  return { block, flag: reasons.size > 0, reasons: [...reasons] };
}
