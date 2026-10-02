/**
 * Investing abroad through India INX Global Access (IFSC, GIFT City), as Shri
 * Parasram Holdings' member page there publishes it (checked 2 Oct 2026).
 * Charges and terms are copied, not paraphrased; if the page changes, change
 * this file and CHECKED_ON together - the page shows both.
 */
export const INXGA_MEMBER_PAGE = "https://www.indiainxga.com/member/index.aspx?memberCode=100183";
export const INXGA_CHECKED_ON = "2 Oct 2026";

export const INXGA_LINKS = {
  openAccount: "https://trade.clientbridge.in/register?SPHP",
  login: "https://trade.clientbridge.in/login?SPHP",
  about: "https://www.indiainx.com/download/About_INXGA.pdf",
  faq: "https://www.indiainx.com/download/GAFAQFinal.pdf",
  residentManual: "https://www.indiainx.com/download/INXGA-Account-Registration-UserManual-for-Resident-Indian-Clients.pdf",
  nriManual: "https://www.indiainx.com/download/INXGA-Account-Registration-UserManual-for-Non-Resident-Indian-Clients.pdf",
  funding: "https://www.indiainx.com/download/Funding-Instructions-and-Beneficiary-details.pdf",
  android: "https://play.google.com/store/apps/details?id=com.indiainxga",
  ios: "https://apps.apple.com/in/app/indiainx-ga/id6753105611",
} as const;

export const INXGA_BANK_GUIDES = [
  { bank: "ICICI Bank", href: "https://www.indiainx.com/download/ICICI-Bank-Fund-UserGuide.pdf" },
  { bank: "HDFC Bank", href: "https://www.indiainx.com/download/HDFC-Bank-Fund-UserGuide.pdf" },
  { bank: "Axis Bank", href: "https://www.indiainx.com/download/Axis-Bank-Fund-UserGuide.pdf" },
] as const;

/** The member page's pricing table, row for row. */
export const INXGA_CHARGES = [
  { item: "Monthly charges", charge: "Nil" },
  { item: "Brokerage on US-listed stocks and ETFs", charge: "0.25% of trade value, minimum USD 1 per executed order" },
  { item: "Withdrawal to your bank, resident Indian", charge: "USD 0" },
  { item: "Withdrawal to your bank, non-resident", charge: "USD 10" },
  { item: "CAT fee", charge: "0.000035 × buy or sell quantity" },
  { item: "FINRA transaction fee", charge: "0.000166 × quantity sold" },
  { item: "IFSCA turnover fee", charge: "0.00005 × trade value" },
  { item: "GST", charge: "At GST rates, resident Indian clients only" },
] as const;

export const INXGA_CONTACT = {
  phone: "011-4700-0006",
  mobile: "9999796251",
  email: "raaj@sphpl.com",
  address: "Parasram House, B-7, Nimri Shopping Centre, Bharat Nagar, Ashok Vihar Phase IV, Delhi 110052",
} as const;
