# Source Of Truth Matrix

Текущее состояние, не целевая схема. UNKNOWN означает недостаток доказательств; решения не предполагаются.

| Data | Current source | Readers | Writers | Format | Visibility | Cache | Owner | Status |
|---|---|---|---|---|---|---|---|---|
| Plot | base.ods; также data.json/localStorage.plotData; локальный импорт | index.html, berezka2.js, admin.js, app.js | admin UI/localStorage; внешний publisher UNKNOWN | ODS/JSON/XLSX | raw GitHub + client storage | SW/localStorage | UNKNOWN | CONFLICT |
| Owner | base.ods, debit.ods, data.json/plotData | public, finance, admin, payment | admin import/edit; publisher UNKNOWN | ODS/JSON/XLSX | public URL/local | SW/localStorage | UNKNOWN | CONFLICT |
| Phone | base.ods и local JSON | index.html, berezka2.js, admin UI | repository/admin local data | ODS/JSON | potentially public raw URL | SW/localStorage | UNKNOWN | UNKNOWN |
| Debt | debit.ods; data.json/plotData | public/finance/admin/payment | repository update/admin edit | ODS/JSON/XLSX | public GitHub/local | SW/localStorage | UNKNOWN | CONFLICT |
| Electricity amount | ee.ods; possible JSON/admin data | public/finance/payment | repository update/admin UI | ODS/JSON | public/local | SW/localStorage | UNKNOWN | CONFLICT |
| Meter readings | ee.ods; user-entered reading/photo flow | public/finance/payment | repository update; endpoint receives submitted reading | ODS/form multipart | ODS public; photo external | SW cache; endpoint UNKNOWN | UNKNOWN | CONFLICT/privacy review |
| Electricity tariff | `tariffs.js`: 4.21 RUB/kWh, owner-confirmed; effective date UNKNOWN | index/app/admin/sync/berezka2/QR | owner-maintained JS config | JS number | client-visible | `localStorage.electricityTariff` is legacy, ignored and retained | Owner-confirmed | CENTRALIZED |
| Membership fee | `tariffs.js`: 1750 RUB/sotka, owner-confirmed; period/effective date UNKNOWN; plotData.membershipSum/debt categories remain persisted data | app/admin | owner-maintained JS config for new calculations; existing records preserved | JS/JSON/XLSX/ODS | client-visible | `localStorage.membershipTariff` is legacy, ignored and retained | Owner-confirmed | CENTRALIZED; no bulk repricing |
| Target fee | debt/plot data and imported values; no unique default | public/admin/QR | publisher/admin import/edit | ODS/JSON/XLSX | client-visible | SW/localStorage | UNKNOWN | UNKNOWN |
| Bank details | constants in index/app/admin; configurable REQ in berezka2; snt_* overrides | payment UIs/QR/receipts | source config and local settings | JS/localStorage | public/client-visible | localStorage/SW page cache | UNKNOWN | CONFLICT |
| Payment purpose | separately constructed in index/app/admin/berezka2 | QR/receipt | user form/code templates | JS string | client-visible | transient | UNKNOWN | CONFLICT |
| QR | three implementations in QR_CONTRACT.md | public/payment/admin/finance | generated client-side | ST00012 + QRCode | client-visible | transient | UNKNOWN | CONFLICT |
| Photos | selected browser file submitted to external /upload | browser preview/external endpoint | endpoint | multipart image | external service | server policy UNKNOWN | UNKNOWN | UNKNOWN/sensitive |
| Users | remote users.json, fallback user, current session object | berezka2.js auth/UI | GitHub Contents API via browser PAT | JSON with hashes/roles | remote raw source may be public | sessionStorage/CDN unknown | UNKNOWN | CONFLICT/client trust |
| Roles | users.json or fallback role/allowedTabs | berezka2.js | user management writes repo file | JSON | client-only | sessionStorage | UNKNOWN | Not server authorization |

No authoritative source or owner was established by code inspection. Resolve each conflict/unknown before migration or business value changes.