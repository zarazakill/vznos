# File Inventory

Table contents were not copied or printed. REFERENCES are static source references found in workspace; runtime usage is not exhaustively proven. Every uncertain file has SAFE_TO_DELETE=NO.

| FILE | REFERENCES | REFERENCED_BY | RUNTIME_USAGE | FORMAT | PURPOSE | CONFIDENCE | SAFE_TO_DELETE |
|---|---|---|---|---|---|---|---|
| 50.ods | berezka2.js:178,1540,1788 | finance panel | loaded with finance bundle; generic ODS import also exists | ODS/ZIP | UNKNOWN | medium | NO |
| 51.ods | berezka2.js:179,1541,1789 | finance panel | loaded with finance bundle | ODS/ZIP | UNKNOWN | medium | NO |
| 71.ods | berezka2.js:180,1542,1790 | finance panel | loaded with finance bundle | ODS/ZIP | role UNKNOWN | medium | NO |
| 71-01.ods | none found | UNKNOWN | UNKNOWN; similar to referenced 71.ods | ODS/ZIP | UNKNOWN | low | NO |
| 71_01.ods | none found | UNKNOWN | UNKNOWN; similar to referenced variants | ODS/ZIP | UNKNOWN | low | NO |
| base.ods | index.html:879; berezka2.js:174,1537 | public and finance panels | direct raw GitHub fetch | ODS/ZIP | plot/owner inferred from parser | high | NO |
| debit.ods | index.html:877; berezka2.js:175,1538 | public and finance panels | direct raw GitHub fetch | ODS/ZIP | debt ledger inferred from parser | high | NO |
| ee.ods | index.html:878; berezka2.js:176,1539 | public and finance panels | direct raw GitHub fetch | ODS/ZIP | electricity readings inferred from parser | high | NO |
| debit.xlsx | no exact match | UNKNOWN | possible generic XLSX import; no filename binding | XLSX | UNKNOWN | low | NO |
| ee.xlsx | no exact match | UNKNOWN | possible generic XLSX import; no filename binding | XLSX | UNKNOWN | low | NO |
| smeta2026.xlsx | no exact match | UNKNOWN | possible generic workbook import | XLSX | filename suggests estimate only; not verified | low | NO |
| data.json | admin.js:196; app.js:440 | admin/payment | fetched; localStorage can also supply | JSON | plot data inferred from accessors | high | NO |
| Berezka2.apk | version.json:5 | external updater/consumer UNKNOWN | web runtime use not found | APK/ZIP | Android package; provenance UNKNOWN | low | NO |
| users.json | berezka2.js:21,52,180 | finance panel | remote GitHub read/write; absent locally | expected JSON | users/roles/hash per code | high | NO |
| index.html | project entry | browser root | public lookup/PWA | HTML | public app | high | NO |
| berezka2.html/js/css | HTML imports bundle | browser route | finance panel | HTML/JS/CSS | finance UI | high | NO |
| login.html/js; admin.html/js | login redirects to admin | browser routes | local CRUD/import/export/receipts | HTML/JS | admin UI | high | NO |
| payment.html; app.js; sync.js | script links | browser route/admin | local payment UI/tab sync | HTML/JS | payment app | high | NO |
| sw.js; manifest.json; version.json | index/manifest references | PWA/browser | cache/install/version metadata | JS/JSON | PWA metadata | high | NO |
| style.css; berezka2.css | HTML links | UI pages | styling | CSS | presentation | high | NO |
| logo.png; sberbank_logo_icon.png; favicon assets; apple-touch-icon.png | HTML/manifest references | UI | displayed/cached | PNG/ICO | visual assets | high | NO |

See BASELINE_MANIFEST for exact hashes. Hashes are integrity data, not backup. ODS/XLSX/JSON/APK were excluded from Git.