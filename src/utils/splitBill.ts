// src/utils/splitBill.ts - Exact Group Expense Splitting & Deep Link Generators

export interface Participant {
  id: string;
  name: string;
  isPayer?: boolean;
  avatar?: string;
  upiId?: string;
  selected?: boolean;
}

export interface SplitResult {
  participantId: string;
  name: string;
  amount: number;
  isPayer: boolean;
}

/**
 * Calculates equal splits ensuring that the sum of all individual splits
 * exactly equals the total bill amount (down to the exact cent / paisa).
 * Any remainder due to non-divisible cents is distributed starting with
 * the designated payer (or the first participant).
 */
export function calculateExactSplit(
  total: number,
  participants: Participant[]
): SplitResult[] {
  const activeParticipants = participants.filter((p) => p.selected !== false);
  if (total <= 0 || isNaN(total) || activeParticipants.length === 0) {
    return [];
  }

  const count = activeParticipants.length;
  // Convert to lowest integer denomination (cents / paise)
  const totalCents = Math.round(total * 100);
  const baseCents = Math.floor(totalCents / count);
  const remainderCents = totalCents % count;

  // Locate the designated payer index among active participants (default to 0)
  const payerIndex = activeParticipants.findIndex((p) => p.isPayer);
  const effectivePayerIndex = payerIndex >= 0 ? payerIndex : 0;

  // Indices that receive 1 extra cent to perfectly match totalCents
  const bonusIndices = new Set<number>();
  for (let i = 0; i < remainderCents; i++) {
    bonusIndices.add((effectivePayerIndex + i) % count);
  }

  return activeParticipants.map((p, index) => {
    const cents = baseCents + (bonusIndices.has(index) ? 1 : 0);
    return {
      participantId: p.id,
      name: p.name,
      amount: cents / 100,
      isPayer: Boolean(p.isPayer),
    };
  });
}

/**
 * Generates an NPCI compliant UPI deep-link URI with properly encoded parameters.
 */
export function generateUpiLink(options: {
  payeeUpi: string;
  payeeName: string;
  amount: number;
  transactionNote?: string;
}): string {
  const { payeeUpi, payeeName, amount, transactionNote = "BudgetMitra Split" } = options;
  const cleanUpi = payeeUpi.trim();
  const cleanName = payeeName.trim();
  const cleanNote = transactionNote.trim();
  const formattedAmt = amount.toFixed(2);

  return `upi://pay?pa=${encodeURIComponent(cleanUpi)}&pn=${encodeURIComponent(
    cleanName
  )}&am=${encodeURIComponent(formattedAmt)}&cu=INR&tn=${encodeURIComponent(cleanNote)}`;
}

/**
 * Generates an official WhatsApp click-to-chat share URL with encoded message text.
 */
export function generateWhatsAppLink(message: string): string {
  return `https://api.whatsapp.com/send?text=${encodeURIComponent(message.trim())}`;
}
