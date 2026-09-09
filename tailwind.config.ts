import type { Config } from "tailwindcss";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      /* Les deux familles de la charte, nommées.
         `sans` : le texte courant. Il était posé sur `body` en CSS, mais toute
         classe `font-sans` (le blog en portait une) rebasculait le bloc sur la
         pile système du navigateur — deux polices de texte sur le même site
         selon la page.
         `titrage` : Poppins, la police d'affichage. Elle est la SEULE des deux
         chargée en graisse 900. Les filigranes et les grands chiffres
         demandaient `font-black` sans préciser de famille : ils héritaient donc
         d'Inter Tight, qui s'arrête à 700, et le navigateur fabriquait lui-même
         la graisse manquante en épaississant les contours. Ce faux gras n'a ni
         le même dessin ni les mêmes chasses d'un moteur à l'autre — d'où des
         lettrages plus larges (et rognés) sur téléphone que sur ordinateur. */
      fontFamily: {
        sans: ["'Inter Tight'", "system-ui", "sans-serif"],
        titrage: ["Poppins", "system-ui", "sans-serif"],
      },
      colors: {
        border: "hsl(var(--border) / <alpha-value>)",
        input: "hsl(var(--input) / <alpha-value>)",
        ring: "hsl(var(--ring) / <alpha-value>)",
        background: "hsl(var(--background) / <alpha-value>)",
        foreground: "hsl(var(--foreground) / <alpha-value>)",
        'ms-blue': "hsl(var(--ms-blue) / <alpha-value>)",
        'ms-green': "hsl(var(--ms-green) / <alpha-value>)",
        'ms-mauve': "hsl(var(--ms-mauve) / <alpha-value>)",
        'ms-pink': "hsl(var(--ms-pink) / <alpha-value>)",
        'ms-dark': "hsl(var(--ms-dark) / <alpha-value>)",
        'ms-surface': "hsl(var(--ms-surface) / <alpha-value>)",
        'ms-ink': "hsl(var(--ms-ink) / <alpha-value>)",
        'ms-paper': "hsl(var(--ms-paper) / <alpha-value>)",
        primary: {
          DEFAULT: "hsl(var(--primary) / <alpha-value>)",
          foreground: "hsl(var(--primary-foreground) / <alpha-value>)",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary) / <alpha-value>)",
          foreground: "hsl(var(--secondary-foreground) / <alpha-value>)",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive) / <alpha-value>)",
          foreground: "hsl(var(--destructive-foreground) / <alpha-value>)",
        },
        muted: {
          DEFAULT: "hsl(var(--muted) / <alpha-value>)",
          foreground: "hsl(var(--muted-foreground) / <alpha-value>)",
        },
        accent: {
          DEFAULT: "hsl(var(--accent) / <alpha-value>)",
          foreground: "hsl(var(--accent-foreground) / <alpha-value>)",
        },
        popover: {
          DEFAULT: "hsl(var(--popover) / <alpha-value>)",
          foreground: "hsl(var(--popover-foreground) / <alpha-value>)",
        },
        card: {
          DEFAULT: "hsl(var(--card) / <alpha-value>)",
          foreground: "hsl(var(--card-foreground) / <alpha-value>)",
        },
      },
      backgroundImage: {
        'gradient-hero': 'var(--gradient-hero)',
        'gradient-glow': 'var(--gradient-glow)',
      },
      boxShadow: {
        'glow': 'var(--shadow-glow)',
        'card': 'var(--shadow-card)',
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
      },
      /* Cadence du panel d'administration. Nommées plutôt qu'écrites en clair :
         `ease-[cubic-bezier(0.22,1,0.36,1)]` est ambigu pour Tailwind, qui ne
         sait pas s'il s'agit d'une transition ou d'une animation, et le prévient
         à chaque construction. Les mêmes valeurs vivent en variables CSS dans
         src/admin/admin.css, où le raisonnement est exposé. */
      transitionTimingFunction: {
        sortie: "cubic-bezier(0.22, 1, 0.36, 1)",
        ressort: "cubic-bezier(0.34, 1.42, 0.64, 1)",
      },
      transitionDuration: {
        260: "260ms",
        900: "900ms",
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
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "slide-up": {
          "0%": { opacity: "0", transform: "translateY(30px)" },
          "100%": { opacity: "1", transform: "translateY(0)" }
        },
        "glow-pulse": {
          "0%, 100%": { opacity: "0.5" },
          "50%": { opacity: "1" }
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" }
        },
        "marquee": {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" }
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.6s ease-out",
        "slide-up": "slide-up 0.8s ease-out",
        "glow-pulse": "glow-pulse 3s ease-in-out infinite",
        "float": "float 3s ease-in-out infinite",
        "marquee": "marquee 30s linear infinite",
      },
    },
  },
  // typography : fournit les classes `prose` qui mettent en forme le corps des
  // articles du blog, converti depuis Markdown (titres, listes, tableaux,
  // citations) sans avoir à styler chaque balise à la main.
  plugins: [require("tailwindcss-animate"), require("@tailwindcss/typography")],
} satisfies Config;
