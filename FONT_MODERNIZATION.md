# Font Modernization Guide

## Current Setup
- **No custom fonts configured**
- Using browser default fonts (Times New Roman / Arial)
- Location: Browser defaults only

## Recommended Modern Fonts (Pick One)

### 🏆 Option 1: Inter (Most Popular, Clean)

**File: `app/layout.tsx`**

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";  // ADD THIS
import "../styles/globals.css";
import { AuthProvider } from "../contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap',
  variable: '--font-inter'
});  // ADD THIS

export const metadata: Metadata = {
  title: "MVP Portal",
  description: "Bare Minimum MVP Portal with Next.js, Supabase, Shadcn/ui",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>  {/* CHANGE THIS LINE */}
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

---

### 🎨 Option 2: Plus Jakarta Sans (Modern, Rounded)

```typescript
import { Plus_Jakarta_Sans } from "next/font/google";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  display: 'swap'
});
```

Then: `<body className={jakarta.className}>`

---

### ⚡ Option 3: Poppins (Bold, Friendly)

```typescript
import { Poppins } from "next/font/google";

const poppins = Poppins({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  display: 'swap'
});
```

Then: `<body className={poppins.className}>`

---

### 🔥 Option 4: Geist (Ultra Modern - Vercel's Font)

**First install:**
```bash
npm install geist
```

**Then in `app/layout.tsx`:**
```typescript
import { GeistSans } from "geist/font/sans";

const geist = GeistSans;
```

Then: `<body className={geist.className}>`

---

## Quick Apply (Copy-Paste Ready)

**Replace lines 1-22 in `app/layout.tsx` with:**

```typescript
import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "../styles/globals.css";
import { AuthProvider } from "../contexts/AuthContext";

const inter = Inter({
  subsets: ["latin"],
  display: 'swap'
});

export const metadata: Metadata = {
  title: "MVP Portal",
  description: "Bare Minimum MVP Portal with Next.js, Supabase, Shadcn/ui",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  );
}
```

## After Applying

1. Save the file
2. Browser will auto-reload
3. Font changes immediately!
4. No build restart needed

## Current Files Location

- **Font Config:** `app/layout.tsx` (lines 1-22)
- **Global Styles:** `styles/globals.css` (lines 28-36)
- **Tailwind Config:** `tailwind.config.js` (lines 1-17)
