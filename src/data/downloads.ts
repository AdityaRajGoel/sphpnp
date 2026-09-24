/**
 * Forms and documents Shri Parasram Holdings publishes on parasramindia.com
 * (its Downloads pages: KYC related, DP downloads, Distribution, Misc, Software
 * setups), linked rather than copied so a client always gets the firm's current
 * file. Every link was checked live on 24 Sep 2026 (92 of 93 answered 200).
 *
 * Left out on purpose: the "Equity ... in <language>" rows for nine languages,
 * which all point to one missing file on the parent site; the 2022 investor
 * charters for depositories, superseded by the Nov 2025 charters linked from
 * Investor Corner; the legacy NSEL documents; and an IPO/bond form served from
 * a bare IP address. Dates are as the parent site lists them.
 */
const PI = "https://www.parasramindia.com";
const U = `${PI}/wp-content/uploads`;

export type DownloadKind = "PDF" | "DOC" | "ZIP" | "JPG" | "EXE" | "App" | "Page";
export type DownloadItem = { title: string; date: string; href: string; kind: DownloadKind; note?: string };
export type DownloadSection = { id: string; title: string; intro: string; items: DownloadItem[] };
export type LanguagePack = { language: string; href: string };

export const DOWNLOADS_SOURCE = `${PI}/kyc-related/`;
export const DOWNLOADS_CHECKED_ON = "24 Sep 2026";

export const DOWNLOAD_SECTIONS: DownloadSection[] = [
  {
    id: "account",
    title: "Account opening and KYC",
    intro: "Forms to open a trading and demat account, update your details or reactivate a dormant account.",
    items: [
      { title: "New client registration form: trading and demat (individual)", date: "Sep 2026", href: `${U}/2026/09/Parasram-TradingCum-Demat-Individual-2026.-pc_OK__44PG-1-9-2026__-For-Approval.pdf`, kind: "PDF" },
      { title: "SARAL account opening form", date: "May 2026", href: `${U}/2026/05/SARAL-AOF-2026.pdf`, kind: "PDF" },
      { title: "Rights and obligations of stock broker, DP and client", date: "May 2026", href: `${U}/2026/05/RIGHT-AND-OBLIGATION-POLICY-PROCEDURE-2026.pdf`, kind: "PDF" },
      { title: "Most important terms and conditions (MITC)", date: "2024", href: `${U}/2024/04/Most-Important-Terms-and-Conditions.pdf`, kind: "PDF" },
      { title: "Client updation form (CUF)", date: "30 Dec 2023", href: `${PI}/downloads/kyc-related/SPHPL-Client-Updation-Form-CUF.pdf`, kind: "PDF" },
      { title: "DDPI format, NSDL and CDSL (replaces the POA)", date: "2025", href: `${U}/2025/02/DDPI.pdf`, kind: "PDF" },
      { title: "BSDA declaration", date: "2024", href: `${U}/2024/12/BSDA-DECLARATION.pdf`, kind: "PDF" },
      { title: "Mobile number and email update form", date: "10 May 2018", href: `${U}/2022/07/Mobile-No-and-E-mail-Id-Updation-Form-.pdf`, kind: "PDF" },
      { title: "Name correction format", date: "17 Dec 2018", href: `${U}/2022/07/NAME-CORRECTION-FORMAT-converted.pdf`, kind: "PDF" },
      { title: "Reactivation letter for a dormant trading account", date: "20 Feb 2020", href: `${U}/2022/07/Reactivation-Letter-for-activation-of-Dormant-Trading-Account.pdf`, kind: "PDF" },
      { title: "KRA form, individual", date: "2024", href: `${PI}/downloads/kyc-related/KRA-Individual.pdf`, kind: "PDF" },
      { title: "KRA form, non-individual", date: "2024", href: `${PI}/downloads/kyc-related/KRA-Non-Individual.pdf`, kind: "PDF" },
      { title: "How to fill the KRA form (individual)", date: "10 May 2018", href: `${U}/2022/07/How-To-Fill-KRA_Individual.pdf`, kind: "PDF" },
      { title: "How to fill the KYC form", date: "10 May 2018", href: `${U}/2022/07/How-to-fill-kyc.pdf`, kind: "PDF" },
      { title: "FAQ on KRA", date: "10 May 2018", href: `${U}/2022/07/FAQ-on-KRA.pdf`, kind: "PDF" },
      { title: "FATCA and CRS declaration", date: "10 May 2018", href: `${U}/2022/07/FATCA-FOR-NON-INDIVIDUAL.pdf`, kind: "PDF" },
      { title: "KYC annexure 4", date: "10 May 2018", href: `${U}/2022/07/Annexure-4.pdf`, kind: "PDF" },
      { title: "KYC annexure 5", date: "10 May 2018", href: `${U}/2022/07/Annexure-5.pdf`, kind: "PDF" },
      { title: "KYC annexure 6", date: "10 May 2018", href: `${U}/2022/07/Annexure-6.pdf`, kind: "PDF" },
      { title: "Margin trading agreement", date: "10 May 2018", href: `${U}/2022/07/Margin_Trading_Agreement.pdf`, kind: "PDF" },
      { title: "Rights and obligations for the margin trading facility", date: "5 Jun 2018", href: `${U}/2022/07/Rights-Obligation-for-Margin-Trading-Facility.pdf`, kind: "PDF" },
      { title: "NBFC IPO document", date: "10 May 2018", href: `${U}/2022/07/NBFC-IPO-DOCUMENT.pdf`, kind: "PDF" },
    ],
  },
  {
    id: "demat",
    title: "Demat account (depository) forms",
    intro: "Nominee, transmission, off-market transfer, pledge and closure forms for NSDL and CDSL accounts.",
    items: [
      { title: "Nomination form (NSDL)", date: "Sep 2026", href: `${U}/2026/09/NSDL-NOMINATION-FORM.pdf`, kind: "PDF" },
      { title: "Transmission request form, with undertaking (QTP)", date: "Sep 2026", href: `${U}/2026/09/Transmission-Request-form-Undertaking-for-QTP-.pdf`, kind: "PDF" },
      { title: "Transmission request form, other than QTP", date: "Sep 2026", href: `${U}/2026/09/Transmission-Request-form-for-Under-Other-than-QTP.pdf`, kind: "PDF" },
      { title: "Notifier intimation format for transmission cases", date: "8 Apr 2026", href: `${U}/2026/04/Format-for-Notifier-Intimation-for-Transmisson-case-.pdf`, kind: "PDF" },
      { title: "Transmission along with dematerialisation", date: "26 Jun 2018", href: `${U}/2022/07/TRANSMISSION-ALONGWITH-DEMATERIALISATION.doc`, kind: "DOC" },
      { title: "Undertaking for pledge creation and invocation", date: "8 Apr 2026", href: `${U}/2026/04/Undertaking-for-pledge-creation-and-pledge-invocation.pdf`, kind: "PDF" },
      { title: "Ultimate lender or debenture issuer, and reason code, for an encumbrance", date: "8 Apr 2026", href: `${U}/2026/04/Name-of-ultimate-lender-debenture-issuer-in-case-encumbrance-is-in-favor-of-a-Trustee-and-reason-code-for-encumbrance.pdf`, kind: "PDF" },
      { title: "Off-market transfer format (NSDL)", date: "10 Jan 2024", href: `${PI}/downloads/dp-downloads/NSDL-OFF-MARKET-FORMAT.pdf`, kind: "PDF" },
      { title: "Off-market transfer format (CDSL)", date: "10 Jan 2024", href: `${PI}/downloads/dp-downloads/CDSL-off-market-format.pdf`, kind: "PDF" },
      { title: "Off-market sale annexure", date: "11 Nov 2019", href: `${U}/2022/07/Annexure-Off-Market-Sale.jpg`, kind: "JPG" },
      { title: "BSDA option and charge structure", date: "Sep 2024", href: `${PI}/downloads/dp-downloads/BSDA-option-charge-structure.pdf`, kind: "PDF" },
      { title: "Signature update format", date: "20 Sep 2019", href: `${U}/2022/07/SIGN-UPDATION-FORMAT.pdf`, kind: "PDF" },
      { title: "Transposition form", date: "20 Dec 2018", href: `${U}/2022/07/TRANSPOSITION-FORM.pdf`, kind: "PDF" },
      { title: "Change of address", date: "5 Jun 2018", href: `${U}/2022/07/CHANGE-IN-ADDRESS.pdf`, kind: "PDF" },
      { title: "Account closure form (NSDL)", date: "15 Mar 2018", href: `${U}/2022/07/Account-closing-Form.pdf`, kind: "PDF" },
      { title: "Account closure form (CDSL)", date: "31 Aug 2017", href: `${U}/2022/07/Cdsl-Account-Closing.pdf`, kind: "PDF" },
      { title: "Rematerialisation (remat) form", date: "6 Aug 2016", href: `${U}/2022/07/REMAT-FORM.pdf`, kind: "PDF" },
      { title: "Rights and obligations of the beneficial owner and DP", date: "27 Jun 2017", href: `${U}/2022/07/Rights-and-Obligations-of-the-BO-and-DP.pdf`, kind: "PDF" },
      { title: "Rights and obligations for a depository account", date: "6 Aug 2016", href: `${U}/2022/07/Rights-and-Obligations-of-for-Depository-Account-final.pdf`, kind: "PDF" },
    ],
  },
  {
    id: "bonds",
    title: "Bonds and mutual funds",
    intro: "Section 54EC capital gains bonds, and mutual fund application forms.",
    items: [
      { title: "REC capital gains bond (54EC)", date: "2026", href: `${U}/2026/04/REC.pdf`, kind: "PDF" },
      { title: "PFC capital gains bond (54EC)", date: "2026", href: `${U}/2026/04/PFC.pdf`, kind: "PDF" },
      { title: "IRFC capital gains bond (54EC)", date: "2026", href: `${U}/2026/04/IRFC.pdf`, kind: "PDF" },
      { title: "NHAI capital gains bond (54EC)", date: "2024", href: `${PI}/downloads/distribution/NHAI.pdf`, kind: "PDF" },
      { title: "Mutual fund application forms", date: "", href: "https://parasrammf.com/downloads/#mf_forms", kind: "Page", note: "on parasrammf.com" },
    ],
  },
  {
    id: "software",
    title: "Trading software",
    intro: "Desktop setups and the files they need. The apps themselves, with guides, are on the Apps page.",
    items: [
      { title: "Parasram Money Dealer (desktop, ClickOnce)", date: "2026", href: "https://money.parasramindia.com:8088/CTCL/ClientStation.application", kind: "App" },
      { title: "NEAT contract files", date: "2026", href: `${PI}/downloads/contract.zip`, kind: "ZIP" },
      { title: "XTS update", date: "2026", href: `${PI}/downloads/XTSTWSConfig.exe`, kind: "EXE" },
      { title: ".NET Framework 4.7.2", date: "2025", href: `${PI}/downloads/Dotnet-framework-472.zip`, kind: "ZIP" },
      { title: "Microsoft Visual C++ 2022 runtime", date: "2025", href: `${PI}/downloads/vcredist-x86.exe`, kind: "EXE" },
    ],
  },
  {
    id: "policies",
    title: "Policies and circulars",
    intro: "The firm's own policies, and SEBI circulars it asks clients to read.",
    items: [
      { title: "Policies and procedures", date: "10 May 2018", href: `${U}/2022/07/Policies-Procedure.pdf`, kind: "PDF" },
      { title: "Risk management system (RMS) policy", date: "24 Feb 2022", href: `${PI}/downloads/misc/Risk-Management-System-Policy.pdf`, kind: "PDF" },
      { title: "PMLA policy", date: "2025", href: `${U}/2025/01/PMLA-POLICY-REVISED.pdf`, kind: "PDF" },
      { title: "Surveillance policy of the depository participant", date: "1 Oct 2021", href: `${U}/2022/07/Obligation-Surveillance-Policy-of-Depository-Participant-sphpl-converted.pdf`, kind: "PDF" },
      { title: "Cyber security policy", date: "18 Oct 2019", href: `${U}/2022/07/Policy-on-Cyber_security-SPHPL.pdf`, kind: "PDF" },
      { title: "Authority letter to trade", date: "23 May 2018", href: `${U}/2022/07/Authority-Letter-to-Trade-.pdf`, kind: "PDF" },
      { title: "SEBI circular: prevention of unauthorised trading by stock brokers (26 Sep 2017)", date: "11 Dec 2017", href: `${U}/2022/07/Prevention-of-Unauthorised-Trading-by-Stock-Brokers.pdf`, kind: "PDF" },
      { title: "SEBI circular: clarification on preventing unauthorised trading (30 Nov 2017)", date: "11 Dec 2017", href: `${U}/2022/07/Clarification_Circular-on-Prevention-of-Unauthorised-Trading-by-Stock-Brokers.pdf`, kind: "PDF" },
      { title: "GST registration", date: "24 Jul 2017", href: `${U}/2022/07/GstRegistrationh.pdf`, kind: "PDF" },
    ],
  },
];

/** Rights & obligations, risk disclosure, do's and don'ts and registration documents, per language (2017). */
export const LANGUAGE_PACKS: { segment: string; packs: LanguagePack[] }[] = [
  {
    segment: "Equity",
    packs: [
      { language: "Hindi", href: `${U}/2022/07/client-registration-Hindi.zip` },
      { language: "Assamese", href: `${U}/2022/07/Assamese.zip` },
      { language: "Bengali", href: `${U}/2022/07/Bengali-june-2017.zip` },
      { language: "Gujarati", href: `${U}/2022/07/gujrati-27-Jun-2017.zip` },
      { language: "Kannada", href: `${U}/2022/07/Kanada-27-Jun-2017.zip` },
      { language: "Kashmiri", href: `${U}/2022/07/Kashmiri-27-Jun-2017.zip` },
      { language: "Konkani", href: `${U}/2022/07/Konkani-27-Jun-2017.zip` },
    ],
  },
  {
    segment: "Commodities",
    packs: [
      { language: "Hindi", href: `${U}/2022/07/hindi.zip` },
      { language: "Assamese", href: `${U}/2022/07/assame.zip` },
      { language: "Bengali", href: `${U}/2022/07/bengali.zip` },
      { language: "Gujarati", href: `${U}/2022/07/gujarati.zip` },
      { language: "Kannada", href: `${U}/2022/07/kannada.zip` },
      { language: "Kashmiri", href: `${U}/2022/07/kashmiri.zip` },
      { language: "Konkani", href: `${U}/2022/07/konkani.zip` },
      { language: "Malayalam", href: `${U}/2022/07/malayalam.zip` },
      { language: "Marathi", href: `${U}/2022/07/marathi.zip` },
      { language: "Odia", href: `${U}/2022/07/oriya.zip` },
      { language: "Punjabi", href: `${U}/2022/07/punjabi.zip` },
      { language: "Sindhi", href: `${U}/2022/07/sindhi.zip` },
      { language: "Tamil", href: `${U}/2022/07/tamil.zip` },
      { language: "Telugu", href: `${U}/2022/07/telegu.zip` },
      { language: "Urdu", href: `${U}/2022/07/urdu.zip` },
    ],
  },
];

/** Case-insensitive match on the title (and note), for the page's filter box. */
export function filterDownloads(sections: DownloadSection[], query: string): DownloadSection[] {
  const q = query.trim().toLowerCase();
  if (!q) return sections;
  return sections
    .map((s) => ({ ...s, items: s.items.filter((i) => `${i.title} ${i.note ?? ""}`.toLowerCase().includes(q)) }))
    .filter((s) => s.items.length > 0);
}
