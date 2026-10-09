# Configuration Conflicts

Owner-confirmed current tariffs are centralized in `tariffs.js`. Effective date was not supplied. Legacy tariff keys in localStorage are ignored and retained.

| Parameter | Location A | Value A | Location B | Value B | Runtime precedence | Storage override | Business owner | Decision required |
|---|---|---:|---|---:|---|---|---|---|
| Electricity tariff (resolved) | `tariffs.js` | 4.21 RUB/kWh | legacy `index.html`/`app.js`/`sync.js`/`admin.js`/`berezka2.js` values | 3.82 / 3.5 | `tariffs.js` loaded before consumers | legacy `electricityTariff` is ignored, not deleted | Owner confirmed 4.21 | Effective date not supplied |
| Membership tariff (resolved) | `tariffs.js` | 1750 RUB/sotka | legacy `app.js`/`sync.js`/`admin.js` values | 1450 / 1400 | `tariffs.js` loaded before consumers | legacy `membershipTariff` is ignored, not deleted | Owner confirmed 1750 | Effective date not supplied |
| QR schema/order | index.html | Purpose before Sum; no KPP | app.js/admin.js | Sum before Purpose; KPP included | independent UI implementations | some REQ settings local | UNKNOWN | Exact approved bank contract? |
| QR Purpose length | index.html | 200 JS chars | app.js/admin.js | 150 chars | separate generator | none | UNKNOWN | Required character/byte limit? |
| QR Purpose length | berezka2.js | 210 chars; ellipsis truncation | other variants | 200 / 150 | separate generator | custom purpose configurable | UNKNOWN | Select only with bank evidence/golden tests |
| QR requisites | index.html constants | source constants | berezka2.js REQ | localStorage overrides/source defaults | per page | snt_* overrides finance page | UNKNOWN | Which source/version authoritative? |
| Plot/debt data | raw GitHub ODS | base/debit/ee | local data.json/plotData | admin/app path | per entrypoint | local plotData may override JSON | UNKNOWN | Define authority and sync direction |

Conflict register records code behavior only; no current localStorage values were inspected.