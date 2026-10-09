# QR Contract Inventory

Inventory, not selection or a new contract. No real recipient/account data or payment amount is duplicated. No QR was regenerated.

## QR-A: Public lookup (index.html)
- Library: QRCode 1.5.1 CDN.
- Prefix ST00012.
- Field order: Name, PersonalAcc, BankName, BIC, CorrespAcc, PayeeINN, Purpose, Sum.
- KPP absent.
- Sum: Math.round(amount * 100) integer kopecks.
- Purpose: custom input + plot suffix, electricity text, debt category short text or generic payment. sanitizePurpose replaces | ; newline CR tab with spaces and folds whitespace. Truncates at 200 JS characters. No explicit byte encoding.
- Render options: width 280, margin 1, error correction H.

## QR-B: payment.html via app.js and admin.js
- Library: QRCode 1.5.1 CDN.
- Prefix ST00012.
- Field order: Name, PersonalAcc, BankName, BIC, CorrespAcc, PayeeINN, KPP, Sum, Purpose.
- Sum: (totalAmount * 100).toFixed(0) string.
- Purpose: positive membership/target/arrears/work/electricity components, plot and payer; truncates at 150 JS characters. Comments can contain user text. No explicit byte encoding.
- Render options: data URL width 450 or canvas width 250; error correction H, margin 1.
- admin.js composition is a separate path and must be characterized independently.

## QR-C: Finance receipts (berezka2.js)
- Library QRCode 1.5.1 CDN; prefix ST00012.
- Field order: Name, PersonalAcc, BankName, BIC, CorrespAcc, PayeeINN, Sum, Purpose. KPP absent.
- Sum: Math.round(totalDebt * 100) integer kopecks.
- Purpose: custom override or components plus plot; max 210 JS characters, truncated with ellipsis. No explicit byte encoding.
- Requisites configurable in source and localStorage.
- Render options: width 320, margin 1, error correction H.

## Golden-test fields before any change
- Exact UTF-8 payload bytes and literal synthetic payload per implementation.
- Field order, optional fields, separators, escaping/sanitization, Unicode/delimiters.
- Character versus encoded-byte boundary and truncation.
- Sum conversion/rounding at half-kopeck boundaries, zero/negative/large amounts.
- Requisites precedence; expected values must be supplied by owner.
- QR matrix/image behavior and pinned library/options.

## Conflicts / unknowns
- Variants disagree on field order, KPP inclusion, Purpose length 150/200/210.
- Index places Purpose before Sum; other variants place Sum first.
- Payment requisites and payment semantics may differ.
- Code comments cite a bank standard, not independently verified.
- Cyrillic character count differs from encoded byte count; no explicit encoding step found.
- No golden fixture exists and no variant is approved. STOP before consolidation.