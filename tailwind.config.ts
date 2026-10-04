import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],
  // Compiles `hover:` to `@media (hover: hover)`, so a tap on a phone no
  // longer leaves elements stuck in their hover state after the finger
  // lifts. Applies to every hover utility on the site at once.
  future: {
    hoverOnlyWhenSupported: true,
  },
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1536px",
        "3xl": "1920px",
      },
    },
    extend: {
      // IBM Plex throughout: Sans for text and headings, Mono for the prices that
      // tick (ticker, quote headers). One family keeps the site reading as a
      // single instrument rather than a landing page stitched to a terminal.
      fontFamily: {
        sans: ["IBM Plex Sans Variable", "IBM Plex Sans", "IBM Plex Sans Fallback", "system-ui", "sans-serif"],
        heading: ["IBM Plex Sans Variable", "IBM Plex Sans", "IBM Plex Sans Fallback", "system-ui", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
      },
      // Plex's heaviest weight is 700. `bold` is its SemiBold, as in IBM's own
      // Carbon system: headings and emphasis stay firm without the shouting weight
      // the display font had, and extrabold/black no longer ask for weights the
      // font does not have.
      fontWeight: {
        bold: "600",
        extrabold: "700",
        black: "700",
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        brand: {
          navy: "hsl(var(--brand-navy))",
          green: "hsl(var(--brand-green))",
          lightBlue: "hsl(var(--brand-light-blue))",
          gold: "hsl(var(--brand-gold))",
          orange: "hsl(var(--brand-orange))",
          warm: "hsl(var(--brand-warm))",
          copper: "hsl(var(--brand-copper))",
          charcoal: "hsl(var(--brand-charcoal))",
        },
        sidebar: {
          DEFAULT: "hsl(var(--sidebar-background))",
          foreground: "hsl(var(--sidebar-foreground))",
          primary: "hsl(var(--sidebar-primary))",
          "primary-foreground": "hsl(var(--sidebar-primary-foreground))",
          accent: "hsl(var(--sidebar-accent))",
          "accent-foreground": "hsl(var(--sidebar-accent-foreground))",
          border: "hsl(var(--sidebar-border))",
          ring: "hsl(var(--sidebar-ring))",
        },
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Semantic roles: controls use lg/md/sm, surfaces use `surface`,
        // chips and tokens use `pill`. See the shape scale in index.css.
        surface: "var(--radius-surface)",
        pill: "var(--radius-pill)",
      },
      // Tailwind's scale, cast in the navy of the brand instead of pure black
      // (--shadow-tint, index.css). Grey-black shadows on the blue-white page
      // read as dirt; a tinted, two-layer shadow reads as a lifted surface.
      boxShadow: {
        sm: "0 1px 2px 0 hsl(var(--shadow-tint) / 0.06), 0 1px 3px 0 hsl(var(--shadow-tint) / 0.05)",
        DEFAULT: "0 1px 3px 0 hsl(var(--shadow-tint) / 0.08), 0 1px 2px -1px hsl(var(--shadow-tint) / 0.08)",
        md: "0 4px 6px -1px hsl(var(--shadow-tint) / 0.08), 0 2px 4px -2px hsl(var(--shadow-tint) / 0.06)",
        lg: "0 10px 15px -3px hsl(var(--shadow-tint) / 0.08), 0 4px 6px -4px hsl(var(--shadow-tint) / 0.06)",
        xl: "0 20px 25px -5px hsl(var(--shadow-tint) / 0.09), 0 8px 10px -6px hsl(var(--shadow-tint) / 0.06)",
        "2xl": "0 25px 50px -12px hsl(var(--shadow-tint) / 0.2)",
      },
      transitionTimingFunction: {
        // `ease-out` / `ease-in-out` are overridden on purpose: the CSS
        // defaults are too soft to read as deliberate.
        "out": "var(--ease-out)",
        "in-out": "var(--ease-in-out)",
        "drawer": "var(--ease-drawer)",
      },
      transitionDuration: {
        press: "var(--duration-press)",
        fast: "var(--duration-fast)",
        base: "var(--duration-base)",
        slow: "var(--duration-slow)",
        ambient: "var(--duration-ambient)",
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "slide-in-left": {
          from: { opacity: "0", transform: "translateX(-30px)" },
          to: { opacity: "1", transform: "translateX(0)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out forwards",
        "slide-in-left": "slide-in-left 0.5s ease-out forwards",
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config;
