import { useLocation } from "react-router-dom";
import { Helmet } from "react-helmet-async";

type BreadcrumbItem = {
  name: string;
  url?: string;
};

type FAQItem = {
  question: string;
  answer: string;
};

type SEOProps = {
  title: string;
  description: string;
  canonical?: string;
  ogImage?: string;
  type?: "website" | "article" | "profile" | "product";
  datePublished?: string;
  dateModified?: string;
  author?: string;
  jsonLd?: Record<string, unknown>;
  breadcrumbs?: BreadcrumbItem[];
  faqItems?: FAQItem[];
  noindex?: boolean;
};

const BASE_URL = "https://www.sphpnp.com";

const SEOHead = ({ 
  title, 
  description, 
  canonical, 
  ogImage, 
  jsonLd, 
  breadcrumbs, 
  faqItems, 
  noindex, 
  type = "website", 
  datePublished, 
  dateModified, 
  author 
}: SEOProps) => {
  const routerLocation = useLocation();
  const pathname = routerLocation.pathname.endsWith('/') && routerLocation.pathname !== '/' ? routerLocation.pathname.slice(0, -1) : routerLocation.pathname;
  const fullCanonical = canonical || `${BASE_URL}${pathname}`;
  const isHomepage = pathname === '/';
  const fullTitle = title.includes("Parasram") || title.length > 60 ? title : `${title} | Parasram India`;
  // Default to a 1200x630 branded banner (renders far better on social than the square logo)
  const finalOgImage = ogImage || "https://www.sphpnp.com/og-default.jpg";
  
  // Combine all JSON-LD scripts
  const schemaScripts = [];

  // Default LocalBusiness / FinancialService Schema
  schemaScripts.push({
    "@context": "https://schema.org",
    "@type": ["FinancialService", "LocalBusiness"],
    "name": "Shri Parasram Holdings Panipat",
    "image": "https://www.sphpnp.com/logo.png",
    "url": BASE_URL,
    "telephone": "+919416400314",
    "address": {
      "@type": "PostalAddress",
      "streetAddress": "Shakuntala Complex, Palika Bazaar",
      "addressLocality": "Panipat",
      "addressRegion": "Haryana",
      "postalCode": "132103",
      "addressCountry": "IN"
    },
    "geo": {
      "@type": "GeoCoordinates",
      "latitude": 29.3909,
      "longitude": 76.9635
    },
    "openingHoursSpecification": [
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": [
          "Monday",
          "Tuesday",
          "Wednesday",
          "Thursday",
          "Friday"
        ],
        "opens": "09:00",
        "closes": "18:00"
      },
      {
        "@type": "OpeningHoursSpecification",
        "dayOfWeek": "Saturday",
        "opens": "09:00",
        "closes": "14:00"
      }
    ],
    "priceRange": "₹₹",
    "email": "parasrampnp@gmail.com",
    "currenciesAccepted": "INR",
    "paymentAccepted": "Bank Transfer, UPI, Cheque",
    // No aggregateRating here on purpose. Google's review-snippet policy bars a
    // business from marking up its own aggregate rating, and bars markup for
    // content not visible on the page - this block was both. Real Google reviews
    // are surfaced in the local panel from GBP without any markup on our side.
    "sameAs": [
      "https://www.facebook.com/ParasramGroup/",
      "https://www.instagram.com/parasrampanipat/",
      "https://twitter.com/ParasramPanipat",
      "https://www.linkedin.com/company/parasram"
    ]
  });

  // WebSite schema (homepage only) - signals Google to generate Sitelinks
  if (isHomepage) {
    schemaScripts.push({
      "@context": "https://schema.org",
      "@type": "WebSite",
      "name": "Shri Parasram Holdings Panipat",
      "alternateName": ["Shri Parasram Holdings Pvt. Ltd.", "Parasram India"],
      "url": BASE_URL,
      "description": "Best stock broker in Panipat, Haryana. SEBI registered since 1970. Stocks, Mutual Funds, IPO, F&O, Commodities, Unlisted Shares.",
      "inLanguage": "en-IN",
      "potentialAction": {
        "@type": "SearchAction",
        "target": {
          "@type": "EntryPoint",
          "urlTemplate": `${BASE_URL}/screener?q={search_term_string}`
        },
        "query-input": "required name=search_term_string"
      },
      "sameAs": [
        "https://www.facebook.com/ParasramGroup/",
        "https://www.instagram.com/parasrampanipat/",
        "https://twitter.com/ParasramPanipat",
        "https://www.linkedin.com/company/parasram"
      ]
    });

    // SiteNavigationElement - helps Google understand the site structure for sitelinks
    schemaScripts.push({
      "@context": "https://schema.org",
      "@type": "ItemList",
      "itemListElement": [
        { "@type": "SiteNavigationElement", "position": 1, "name": "About Us", "url": `${BASE_URL}/about` },
        { "@type": "SiteNavigationElement", "position": 2, "name": "Services", "url": `${BASE_URL}/services` },
        { "@type": "SiteNavigationElement", "position": 3, "name": "Unlisted Space", "url": `${BASE_URL}/unlisted-space` },
        { "@type": "SiteNavigationElement", "position": 4, "name": "Open Account", "url": `${BASE_URL}/open-account` },
        { "@type": "SiteNavigationElement", "position": 5, "name": "Products", "url": `${BASE_URL}/products` },
        { "@type": "SiteNavigationElement", "position": 6, "name": "Depository Services", "url": `${BASE_URL}/depository-services` },
        { "@type": "SiteNavigationElement", "position": 7, "name": "Stock Screener", "url": `${BASE_URL}/screener` },
        { "@type": "SiteNavigationElement", "position": 8, "name": "F&O Dashboard", "url": `${BASE_URL}/fno` },
        { "@type": "SiteNavigationElement", "position": 9, "name": "Learning Center", "url": `${BASE_URL}/learn` },
        { "@type": "SiteNavigationElement", "position": 10, "name": "Contact", "url": `${BASE_URL}/contact` },
        { "@type": "SiteNavigationElement", "position": 11, "name": "Our Team", "url": `${BASE_URL}/team` },
        { "@type": "SiteNavigationElement", "position": 12, "name": "Careers", "url": `${BASE_URL}/careers` },
      ],
    });
  }

  // Custom JSON-LD from props
  if (jsonLd) {
    schemaScripts.push({ "@context": "https://schema.org", ...jsonLd });
  } else if (type === "article") {
    schemaScripts.push({
      "@context": "https://schema.org",
      "@type": "Article",
      "headline": title,
      "description": description,
      "image": finalOgImage,
      "datePublished": datePublished || new Date().toISOString(),
      "dateModified": dateModified || datePublished || new Date().toISOString(),
      "author": {
        "@type": "Person",
        "name": author || "Parasram India"
      },
      "publisher": {
        "@type": "Organization",
        "name": "Shri Parasram Holdings Panipat",
        "logo": {
          "@type": "ImageObject",
          "url": "https://www.sphpnp.com/logo.png"
        }
      }
    });
  }

  // BreadcrumbList schema
  const activeBreadcrumbs = breadcrumbs && breadcrumbs.length > 0 ? breadcrumbs : [
    { name: "Home", url: "/" },
    { name: fullTitle.split(" |")[0] }
  ];

  schemaScripts.push({
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": activeBreadcrumbs.map((item, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "name": item.name,
      ...(item.url ? { "item": item.url.startsWith("http") ? item.url : `${BASE_URL}${item.url}` } : {}),
    })),
  });

  // FAQPage schema
  if (faqItems && faqItems.length > 0) {
    schemaScripts.push({
      "@context": "https://schema.org",
      "@type": "FAQPage",
      "mainEntity": faqItems.map(faq => ({
        "@type": "Question",
        "name": faq.question,
        "acceptedAnswer": {
          "@type": "Answer",
          "text": faq.answer,
        },
      })),
    });
  }

  return (
    <Helmet>
      <title>{fullTitle}</title>
      <meta name="description" content={description} />
      <meta name="robots" content={noindex ? "noindex, nofollow" : "index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1"} />
      
      <link rel="canonical" href={fullCanonical} />
      <link rel="alternate" hrefLang="en-IN" href={fullCanonical} />
      <link rel="alternate" hrefLang="x-default" href={fullCanonical} />

      <meta property="og:title" content={fullTitle} />
      <meta property="og:description" content={description} />
      <meta property="og:url" content={fullCanonical} />
      <meta property="og:type" content={type} />
      <meta property="og:site_name" content="Shri Parasram Holdings Panipat" />
      <meta property="og:locale" content="en_IN" />
      <meta property="og:image" content={finalOgImage} />
      {finalOgImage.includes("og-default") && <meta property="og:image:width" content="1200" />}
      {finalOgImage.includes("og-default") && <meta property="og:image:height" content="630" />}
      <meta property="og:image:alt" content={fullTitle} />

      {type === "article" && datePublished && <meta property="article:published_time" content={datePublished} />}
      {type === "article" && dateModified && <meta property="article:modified_time" content={dateModified} />}
      {type === "article" && author && <meta property="article:author" content={author} />}

      <meta name="twitter:card" content="summary_large_image" />
      <meta name="twitter:site" content="@ParasramPanipat" />
      <meta name="twitter:title" content={fullTitle} />
      <meta name="twitter:description" content={description} />
      <meta name="twitter:image" content={finalOgImage} />

      {schemaScripts.map((schema, index) => (
        <script type="application/ld+json" key={index}>
          {JSON.stringify(schema)}
        </script>
      ))}
    </Helmet>
  );
};

export default SEOHead;
