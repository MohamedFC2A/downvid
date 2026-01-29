## 2024-05-22 - [Refactoring Google Fonts to Next/Font]
**Learning:** Legacy `@import` styles for Google Fonts cause Flash of Unstyled Text (FOUT) and layout shifts. Moving to `next/font/google` eliminates this and allows variable-based Tailwind integration.
**Action:** Use `next/font` for all typography and inject via CSS variables in `layout.tsx`.

## 2024-05-22 - [Framer Motion Entry Animations]
**Learning:** Staggered entry animations (`delay: 0.1`) make the UI feel much more responsive and "premium" than instant rendering.
**Action:** Use `motion.div` with simple opacity/y-axis transitions for all major content blocks.
