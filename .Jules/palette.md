## 2024-05-22 - [Tailwind v4 CSS Import Order]
**Learning:** `tailwindcss` v4 is strict about `@import` ordering in `globals.css`. Combining it with Google Fonts `@import` caused build failures.
**Action:** Always prefer `next/font` in `layout.tsx` for font loading in Next.js projects to avoid CSS ordering issues and gain performance benefits.
