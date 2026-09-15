# Design tokens — Lifeline Achham

Chosen deliberately for a Nepal-based NGO's admin platform, not the default
SaaS-card kit or cream/terracotta AI-generated look.

**Color**
- `paper` #F7F5F1 — warm, neutral background (not stark white, not cream-cliché)
- `ink` #1B2233 — primary text
- `navy` #1B2A4A — structural color: sidebar, headers, primary buttons
- `crimson` #A6192E — single accent, drawn from Nepal's flag; used sparingly
  for the active/important actions and alerts, never decoratively
- `sage` #5C7A63 — reserved for positive/success states (verified payments,
  approved applications) so crimson stays meaningful as "attention," not
  "the brand color"

**Type**
- Display: Fraunces (serif) — used only for page titles and card values,
  giving the platform a printed-document feel appropriate to an org that
  issues certificates and receipts
- Body/UI: IBM Plex Sans — legible at small sizes for dense tables and forms

**Layout**
- Left-aligned content, fixed sidebar (not a floating rounded nav), sharp-ish
  corners (2–4px radius) rather than the uniform pill/rounded-card look —
  reads as a records/registry system rather than a marketing SaaS product
- Cards use hairline borders instead of soft drop shadows

**Principles**
- Numbers and IDs (member IDs, receipt numbers) are treated as first-class
  typographic content, not muted metadata — they matter to this domain
- Motion is limited to state changes (loading, hover, focus) — no entrance
  animations
