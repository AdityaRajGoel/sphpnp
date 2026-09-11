// Lightweight i18n foundation (no external dep, prerender-safe).
// English is the source of truth; Hindi is the one supported translation.
// Hindi strings are IndicTrans2 output (the model BHASHINI serves) with
// short-label fixes where the sentence-tuned model mistranslated UI copy.

export type Lang = "en" | "hi";

export const DEFAULT_LANG: Lang = "en";

export const LANGUAGES: { code: Lang; label: string; native: string }[] = [
  { code: "en", label: "English", native: "English" },
  { code: "hi", label: "Hindi", native: "हिन्दी" },
];

// BCP-47 tags for the <html lang> attribute.
export const HTML_LANG: Record<Lang, string> = {
  en: "en-IN",
  hi: "hi-IN",
};

// Keys are stable ids; English is the source of truth and the fallback.
export const translations: Record<Lang, Record<string, string>> = {
  en: {
    "nav.services": "Services",
    "nav.unlistedSpace": "Unlisted Space",
    "nav.markets": "Markets",
    "nav.tools": "Tools",
    "nav.learn": "Learn",
    "nav.about": "About",
    "nav.contact": "Contact",
    "cta.clientLogin": "Client Login",
    "cta.webTrade": "Web Trade",
    "cta.parasramTrade": "Parasram Trade",
    "cta.parasramMoney": "Parasram Money",
    "cta.choosePlatform": "Choose a platform",
    "cta.openAccount": "Open Account",
    "lang.label": "Language",
    "hero.title1": "Your Trusted Partner",
    "hero.title2": "for Smart Investments",
    "hero.subtitle": "Parasram India brings decades of stock broking expertise to Panipat. Join thousands of investors who trust us with their financial future.",
    "hero.ctaInvest": "Open Account",
    "hero.ctaTrade": "Start Trading Now",
    "footer.ctaBand": "Open Free Demat Account",
    "footer.col.company": "Company",
    "footer.col.tools": "Markets & Tools",
    "footer.col.important": "Important Links",
    "footer.col.branch": "Panipat Branch",
    "page.services": "Our Services",
    "page.fno": "F&O Dashboard",
    "page.learn": "Learning Center",
    "page.screener": "Stock Screener",
    "page.marketIntel": "Market Intelligence",
    "page.recommendations": "Stock Recommendations",
    "mi.sentiment": "Sentiment & Institutional Flows",
    "mi.global": "Global Cues & Sectors",
    "mi.movers": "Movers & Commodities",
    "mi.currency": "Currency & Fund Flows",
    "mi.eyebrow": "Research & Analytics",
    "mi.subtitle": "Live market insights, institutional flows, and derivatives analytics",
    "services.eyebrow": "What We Offer",
    "contact.title1": "Get In",
    "contact.title2": "Touch",
    "contact.subtitle": "Visit our Panipat branch, call us, or send a message. We're here to help with all your investment needs.",
    "openAccount.title1": "Open Your",
    "openAccount.title2": "Demat Account",
    "openAccount.subtitle": "Start your investment journey with Parasram India - serving investors since 1970, in Panipat since 1997.",
  },
  hi: {
    "nav.services": "हमारी सेवाएँ",
    "nav.unlistedSpace": "गैर-सूचीबद्ध शेयर",
    "nav.markets": "बाज़ार",
    "nav.tools": "टूल्स",
    "nav.learn": "सीखें",
    "nav.about": "हमारे बारे में",
    "nav.contact": "संपर्क करें",
    "cta.clientLogin": "ग्राहक लॉगिन",
    "cta.webTrade": "वेब ट्रेड",
    "cta.parasramTrade": "पारसराम ट्रेड",
    "cta.parasramMoney": "पारसराम मनी",
    "cta.choosePlatform": "प्लेटफ़ॉर्म चुनें",
    "cta.openAccount": "खाता खोलें",
    "lang.label": "भाषा",
    "hero.title1": "आपका भरोसेमंद साथी",
    "hero.title2": "स्मार्ट निवेश के लिए",
    "hero.subtitle": "पारसराम इंडिया पानीपत में दशकों की स्टॉक ब्रोकिंग विशेषज्ञता लाता है। हज़ारों निवेशकों में शामिल हों जो अपने वित्तीय भविष्य के लिए हम पर भरोसा करते हैं।",
    "hero.ctaInvest": "खाता खोलें",
    "hero.ctaTrade": "अभी ट्रेडिंग शुरू करें",
    "footer.ctaBand": "मुफ़्त डीमैट खाता खोलें",
    "footer.col.company": "कंपनी",
    "footer.col.tools": "बाज़ार और टूल्स",
    "footer.col.important": "महत्वपूर्ण लिंक",
    "footer.col.branch": "पानीपत शाखा",
    "page.services": "हमारी सेवाएँ",
    "page.fno": "F&O डैशबोर्ड",
    "page.learn": "लर्निंग सेंटर",
    "page.screener": "स्टॉक स्क्रीनर",
    "page.marketIntel": "मार्केट इंटेलिजेंस",
    "page.recommendations": "स्टॉक सिफ़ारिशें",
    "mi.sentiment": "सेंटिमेंट और संस्थागत प्रवाह",
    "mi.global": "वैश्विक संकेत और सेक्टर",
    "mi.movers": "टॉप मूवर्स और कमोडिटीज़",
    "mi.currency": "करेंसी और फंड फ्लो",
    "mi.eyebrow": "रिसर्च और एनालिटिक्स",
    "mi.subtitle": "लाइव मार्केट अंतर्दृष्टि, संस्थागत प्रवाह और डेरिवेटिव्स विश्लेषण",
    "services.eyebrow": "हम क्या प्रदान करते हैं",
    "contact.title1": "हमसे",
    "contact.title2": "संपर्क करें",
    "contact.subtitle": "हमारी पानीपत शाखा में आएँ, हमें कॉल करें, या संदेश भेजें। हम आपकी सभी निवेश ज़रूरतों में मदद के लिए यहाँ हैं।",
    "openAccount.title1": "अपना",
    "openAccount.title2": "डीमैट खाता खोलें",
    "openAccount.subtitle": "पारसराम इंडिया के साथ अपनी निवेश यात्रा शुरू करें - 1970 से निवेशकों की सेवा में, 1997 से पानीपत में।",
  },
};

// Maps the English nav labels used in megaMenuData to translation keys, so the
// existing nav config doesn't need restructuring.
export const NAV_LABEL_KEYS: Record<string, string> = {
  "Services": "nav.services",
  "Unlisted Space": "nav.unlistedSpace",
  "Markets": "nav.markets",
  "Tools": "nav.tools",
  "Learn": "nav.learn",
  "About": "nav.about",
  "Contact": "nav.contact",
};
