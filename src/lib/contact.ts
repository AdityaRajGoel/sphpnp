/**
 * The branch's email addresses, in the order to show them: the two branch
 * addresses first, the Gmail inbox after. One list so the header, footer,
 * contact pages and structured data cannot disagree.
 */
export const BRANCH_EMAILS = ["anil@sphpnp.com", "ajay@sphpnp.com", "parasrampnp@gmail.com"] as const;

/** The trading back office's login, which is not this website's account. */
export const CLIENT_LOGIN_URL = "https://dashboard.parasramindia.com/Account/Login";

/** Where a single address fits (structured data, mailto buttons, policy text). */
export const PRIMARY_EMAIL = BRANCH_EMAILS[0];
