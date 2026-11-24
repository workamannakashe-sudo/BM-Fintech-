// splitBill.test.ts - Unit tests for Group Expense & Split Calculations
import { describe, it, expect } from "vitest";
import {
  calculateExactSplit,
  generateUpiLink,
  generateWhatsAppLink,
  type Participant,
} from "../utils/splitBill";

describe("Split the Bill Calculation Logic (Zero-Loss Rounding)", () => {
  it("splits a dinner bill equally among 4 people with zero penny lost", () => {
    const participants: Participant[] = [
      { id: "u1", name: "You (Payer)", isPayer: true },
      { id: "f1", name: "Rohan" },
      { id: "f2", name: "Sneha" },
      { id: "f3", name: "Priyansh" },
    ];
    const results = calculateExactSplit(1200, participants);
    expect(results).toHaveLength(4);
    const sum = results.reduce((acc, r) => acc + r.amount, 0);
    expect(sum).toBe(1200);
    results.forEach((r) => expect(r.amount).toBe(300));
  });

  it("handles non-divisible splits and allocates 1-cent remainder to the payer", () => {
    // 100 / 3 = 33.3333... Payer must get 33.34, others 33.33
    const participants: Participant[] = [
      { id: "u1", name: "Payer", isPayer: true },
      { id: "f1", name: "Friend 1" },
      { id: "f2", name: "Friend 2" },
    ];
    const results = calculateExactSplit(100, participants);
    expect(results).toHaveLength(3);
    const sum = Math.round(results.reduce((acc, r) => acc + r.amount, 0) * 100) / 100;
    expect(sum).toBe(100);

    const payer = results.find((r) => r.isPayer);
    expect(payer?.amount).toBe(33.34);

    const nonPayers = results.filter((r) => !r.isPayer);
    expect(nonPayers[0].amount).toBe(33.33);
    expect(nonPayers[1].amount).toBe(33.33);
  });

  it("accurately splits prime numbers and odd totals (e.g., 500 split 7 ways)", () => {
    const participants: Participant[] = Array.from({ length: 7 }, (_, i) => ({
      id: `p${i}`,
      name: `Person ${i}`,
      isPayer: i === 0,
    }));
    const total = 500;
    const results = calculateExactSplit(total, participants);
    const sum = Math.round(results.reduce((acc, r) => acc + r.amount, 0) * 100) / 100;
    expect(sum).toBe(500);
  });

  it("safely handles 0, negative, and invalid total amounts", () => {
    const participants: Participant[] = [{ id: "u1", name: "User" }];
    expect(calculateExactSplit(0, participants)).toEqual([]);
    expect(calculateExactSplit(-50, participants)).toEqual([]);
    expect(calculateExactSplit(NaN, participants)).toEqual([]);
    expect(calculateExactSplit(100, [])).toEqual([]);
  });

  it("ignores deselected participants", () => {
    const participants: Participant[] = [
      { id: "u1", name: "User", isPayer: true, selected: true },
      { id: "f1", name: "Friend 1", selected: true },
      { id: "f2", name: "Friend 2", selected: false },
    ];
    const results = calculateExactSplit(100, participants);
    expect(results).toHaveLength(2);
    const sum = results.reduce((acc, r) => acc + r.amount, 0);
    expect(sum).toBe(100);
    expect(results[0].amount).toBe(50);
    expect(results[1].amount).toBe(50);
  });
});

describe("Deep Link URI Generators", () => {
  it("generates a valid, properly encoded UPI payment URI", () => {
    const upiUri = generateUpiLink({
      payeeUpi: "merchant@bank",
      payeeName: "Chai & Snacks Co.",
      amount: 145.5,
      transactionNote: "Hostel Chai Split",
    });

    expect(upiUri).toContain("upi://pay?");
    expect(upiUri).toContain("pa=merchant%40bank");
    expect(upiUri).toContain("pn=Chai%20%26%20Snacks%20Co.");
    expect(upiUri).toContain("am=145.50");
    expect(upiUri).toContain("cu=INR");
    expect(upiUri).toContain("tn=Hostel%20Chai%20Split");
  });

  it("generates a valid WhatsApp click-to-chat URL with percent-encoded text", () => {
    const text = "BudgetMitra Split: ₹250.00 for Biryani Night!";
    const waUrl = generateWhatsAppLink(text);

    expect(waUrl.startsWith("https://api.whatsapp.com/send?text=")).toBe(true);
    const parsedUrl = new URL(waUrl);
    expect(parsedUrl.searchParams.get("text")).toBe(text);
  });
});
