/**
 * Pay-in details for a Shri Parasram Holdings trading account, exactly as the
 * firm publishes them at parasramindia.com/fund-transfer/ (checked 24 Sep 2026).
 * Money details are copied, never paraphrased: a wrong digit here sends a
 * client's funds somewhere else. If the parent page changes, change this file
 * and CHECKED_ON together - the page shows both.
 */
export const FUND_TRANSFER_SOURCE = "https://www.parasramindia.com/fund-transfer/";
export const CLIENT_BANK_ACCOUNTS_PDF = "https://www.parasramindia.com/wp-content/uploads/2025/07/CLIENT-BANK-ACCOUNTS-2025.pdf";
export const CHECKED_ON = "24 Sep 2026";

/** Parasram's own gateway (NetBanking or UPI, via Atom Paynetz). HTTP-only upstream. */
export const PAYMENT_GATEWAY = "http://trade.parasramindia.com:9002/FundTransfer.aspx";
/** ₹7 + 18% GST, per transaction, as published. */
export const GATEWAY_CHARGE = "₹8.26 per transaction (₹7 + 18% GST)";

export const WITHDRAWAL_EMAIL = "accounts@sphpl.com";

export const BANK = {
  beneficiary: "SHRI PARASRAM HOLDINGS PVT. LTD.",
  bank: "HDFC Bank Ltd.",
  virtualPrefix: "PRSM99",
  pooledAccount: "00030340008301",
  accountType: "Current account",
  ifsc: "HDFC0000003",
  micr: "400234009",
  branch: "New Delhi – Surya Kiran, K.G. Marg",
  address: "H.T House, Connaught Place, 18/20, K.G. Marg, New Delhi - 110001",
} as const;

export type VirtualAccount = { ok: true; code: string; account: string } | { ok: false; error: string };

/**
 * The client's own account number at HDFC: PRSM99 followed by the trading code
 * ("if trading code is CSAMB then account no. is PRSM99CSAMB"). Codes are letters
 * and digits. The published template shows eight placeholder characters but does
 * not state a limit, so only an implausible length is refused - turning away a
 * real client's code would be worse than letting a long one through.
 */
export function virtualAccountFor(input: string): VirtualAccount {
  const code = input.trim().toUpperCase();
  if (!code) return { ok: false, error: "Enter your trading code." };
  if (!/^[A-Z0-9]+$/.test(code)) return { ok: false, error: "Letters and digits only, as printed on your contract note." };
  if (code.length > 16) return { ok: false, error: "That is longer than a trading code - check your contract note." };
  return { ok: true, code, account: `${BANK.virtualPrefix}${code}` };
}
