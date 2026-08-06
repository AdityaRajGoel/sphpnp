# Security Policy

This repository powers [www.sphpnp.com](https://www.sphpnp.com), the website of
**Shri Parasram Holdings Pvt. Ltd. Panipat** — a SEBI-registered stockbroker. Because the site
handles prospective-client data and displays market information, we take reports seriously
and would rather hear from you early.

The source is published so it *can* be reviewed. Responsible disclosure is welcome.

---

## Reporting a vulnerability

**Email [contact@adityarajgoel.com](mailto:contact@adityarajgoel.com)** — please do not open
a public GitHub issue, and do not disclose publicly until the issue is resolved.

Include whatever you have:

- what the issue is and why it matters
- the affected URL, endpoint, or file and line
- steps to reproduce, or a minimal proof of concept
- anything you know about impact — what data or function is exposed

If you believe the issue is actively being exploited, say so in the subject line.

### What to expect

| Stage | Target |
|---|---|
| Acknowledgement of your report | within 3 working days |
| Initial assessment and severity | within 7 working days |
| Fix or mitigation for critical issues | as quickly as we can, prioritised over other work |

We will keep you updated, and we are happy to credit you once a fix has shipped — tell us
how you would like to be named, or if you would rather stay anonymous.

---

## Scope

**In scope**

- this repository's application code
- the deployed site at `www.sphpnp.com`
- the Supabase Edge Functions under `supabase/functions/`
- database access rules — a Row Level Security bypass is always in scope

**Out of scope**

- third-party services we depend on (Supabase, Vercel, market-data providers) — report
  those to the vendor directly
- findings from automated scanners with no demonstrated impact
- missing hardening headers or best-practice suggestions that are not exploitable
- social engineering, physical attacks, or anything targeting our staff or offices
- reports about `parasramindia.com`, which is a separate corporate site

---

## Testing rules

We are a regulated financial intermediary. Please keep testing safe:

- **Do not** run denial-of-service, load, or stress tests.
- **Do not** attempt to access, modify, or exfiltrate real client data. If you encounter
  personal data, stop, do not save it, and tell us in your report.
- **Do not** interfere with trading, market-data, or account-opening flows.
- Use your own test data. Do not attempt to open accounts under someone else's identity.
- Keep automated scanning to a low request rate.

Stay within these rules and we will not pursue action against you for good-faith research.

---

## Known and accepted by design

Please do not report the following — they are intentional:

- **The Supabase URL and anon key are in the client bundle.** The anon key is public by
  design; it grants no privileged access and every table is protected by Row Level
  Security. A *bypass* of that RLS is in scope and we want to hear about it.
- **Regulatory identifiers, office addresses, and the compliance officer's contact details
  are public.** SEBI requires them to be published.

---

## Where else to write

| Topic | Contact |
|---|---|
| Security issues, this repository, licensing | [contact@adityarajgoel.com](mailto:contact@adityarajgoel.com) |
| Panipat branch — accounts, services, general queries | [anil@sphpnp.com](mailto:anil@sphpnp.com) |
| Compliance Officer — Mr. Vivek Sheel Aggarwal | [compliance@sphpl.com](mailto:compliance@sphpl.com) |
| Investor grievances | see [Investor Corner](https://www.sphpnp.com/investor-corner) and the escalation path in the [README](README.md#investor-grievance-redressal) |

Investor grievances and regulatory complaints are **not** security reports — please use the
official channels above so they are handled and recorded correctly.
