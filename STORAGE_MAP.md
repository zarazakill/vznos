# Storage Map

Static source reference inventory. TTL UNKNOWN unless stated. No storage was cleared or migrated.

| KEY / store | PURPOSE | READERS | WRITERS | DATA_CLASS | TTL | MIGRATION | SECURITY |
|---|---|---|---|---|---|---|---|
| localStorage snt_gh_token | GitHub Contents API PAT | berezka2.js save flow | token form in berezka2.js | SECRET | until manually removed | UNKNOWN | Critical: browser-readable; sent to api.github.com |
| localStorage adminCredentials | local login credentials | login.js/admin.js | admin.js password change | CREDENTIAL | persistent | UNKNOWN | Critical: raw password JSON; default fallback exists |
| localStorage adminAuthenticated | UI auth marker | login.js/admin.js | login.js/admin.js logout | AUTH STATE | 24h check via timestamp | UNKNOWN | Client editable, not trusted session |
| localStorage adminLoginTime | TTL timestamp | admin.js | login.js | AUTH METADATA | checked at 24h | UNKNOWN | Client controlled |
| sessionStorage snt_current_user | UI identity/role/allowedTabs | berezka2.js | auth/user switching in berezka2.js | AUTH/ROLE | tab session | UNKNOWN | Client-controlled, not authorization |
| localStorage plotData | plot/owner/finance records | admin.js/app.js/sync.js | admin.js/sync.js | SENSITIVE PERSONAL/FINANCIAL | persistent | UNKNOWN; preserve schema | Browser-profile accessible |
| localStorage membershipTariff | legacy rate value; ignored by current code | none | none | LEGACY CONFIG | persistent; retained | tariffs.js is authoritative | Not read, written, or deleted by current tariff flow |
| localStorage electricityTariff | legacy rate value; ignored by current code | none | none | LEGACY CONFIG | persistent; retained | tariffs.js is authoritative | Not read, written, or deleted by current tariff flow |
| localStorage snt_consent_accepted, snt_consent_version | consent version gate | index inline | index inline | CONSENT STATE | persistent until removal | UNKNOWN | Not authorization |
| localStorage snt_ee_cols | electricity columns config | berezka2.js | berezka2.js | UI CONFIG | persistent | merge with defaults | Parse/mutation risk, low sensitivity |
| localStorage snt_debtor_cols | debtor columns config | berezka2.js | berezka2.js | UI CONFIG | persistent | merge with defaults | Client editable |
| localStorage snt_Name, snt_INN, snt_Acc, snt_BankName, snt_BIC, snt_Corr | payment requisites override | berezka2.js | settings UI | FINANCIAL CONFIG | persistent | UNKNOWN; preserve | Integrity sensitive/client editable |
| localStorage snt_Year, snt_QR, snt_Dup, snt_MinDebt | finance UI/receipt preferences | berezka2.js | settings UI | UI/BUSINESS CONFIG | persistent | code defaults | Client editable; minDebt affects output |
| CacheStorage berezka2-v2 | precache and successful GET responses | sw.js | sw.js install/fetch | MIXED assets + remote GET | no expiry shown; activation cleanup | cache version change currently removes other origin caches | Potential sensitive/stale cache; no classification |
| IndexedDB | no source references found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | no action | Static search only |
| Cookies | no source references found | UNKNOWN | UNKNOWN | UNKNOWN | UNKNOWN | no action | Platform/CDN cookies outside app not audited |

localStorage is not server-side secret storage. No migration is proposed in Phase 0.