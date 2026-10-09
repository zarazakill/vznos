# PHASE-0-AUDIT

Дата снимка: 2026-10-03. Аудит только чтением исходников и метаданных файлов. Функциональные файлы и исходные ODS/XLSX/JSON не изменялись.

## 1. Project structure
Статический multi-page проект без backend-кода в workspace. В корне находятся четыре разных UI-потока: публичный кабинет, финансово-административная панель, login/admin для локальной базы и отдельная платежная страница. Имеются две CSS-пары, скрипты, PWA-манифест, service worker, локальные таблицы и APK. Файла server.js нет.

## 2. Entry points
- index.html: публичный кабинет СНТ и регистрация ./sw.js; почти вся логика и CSS встроены inline. Загружает JSZip и QRCode.
- berezka2.html: финансовая панель; подключает berezka2.js, berezka2.css и CDN XLSX/QRCode/jsPDF/html2canvas/Chart.js.
- login.html -> login.js -> admin.html -> admin.js.
- payment.html: отдельный payment UI, inline-скрипт плюс sync.js и app.js.
- Android binary Berezka2.apk; version.json указывает на это имя.

## 3. Data sources
- Публичный кабинет загружает base.ods, debit.ods, ee.ods напрямую из raw GitHub URL.
- Финансовая панель загружает те же три ODS и 50.ods, 51.ods, 71.ods; smart fetch имеет jsDelivr fallback. Есть импорт локальных .ods/.xlsx/.xls.
- admin.js и app.js используют локальный data.json и/или localStorage.plotData.
- berezka2.js запрашивает users.json в GitHub repo (файла в workspace нет); тот же код записывает его через GitHub Contents API.
- debit.xlsx, ee.xlsx, smeta2026.xlsx, прочие пронумерованные ODS и APK имеют неподтвержденное назначение.
- Платежные реквизиты и конфигурация заданы в JS и частично переопределяются browser storage.

## 4. Data consumers
- index.html: участок/владелец, долг и детализация, электроэнергия/показания, реквизиты; UI поиска, QR и загрузки фото.
- berezka2.js: финансовые ODS/XLSX, таблицы операций, долги/участки, паспорт участков, пользователи/роли, квитанции и QR.
- admin.js/app.js: data.json и plotData, настройки тарифов, платежная форма, печать и экспорт.
- Service worker перехватывает GET в области действия и может кэшировать ответы источников.

## 5. Data writers
- admin.js: редактирует plotData, сохраняет в localStorage; импорт XLSX заменяет массив после подтверждения; экспорт XLSX; сохраняет тарифы.
- sync.js: writer plotData/тарифов в localStorage и межвкладочная рассылка.
- berezka2.js: меняет users list и пишет users.json в GitHub при наличии PAT; настройки и PAT сохраняет в localStorage.
- index.html отправляет multipart фото, номер участка и показание на внешний endpoint; серверная модель в проекте отсутствует.
- sw.js записывает успешные GET в CacheStorage.

## 6. Authentication
login.js/admin.js используют локальную пару username/password с дефолтом admin/admin, маркером adminAuthenticated и временем login в localStorage, TTL 24 часа. Это не серверная аутентификация. Независимо, berezka2.js загружает пользователей и сравнивает SHA-256 в браузере, содержит hard-coded fallback admin hash, хранит объект пользователя в sessionStorage. При недоступном/пустом users.json включается fallback. Это две системы с разными scope и механизмами.

## 7. Authorization
admin.js проверяет только browser localStorage marker. berezka2.js ограничивает вкладки по client-side role/allowedTabs. Источники ODS/JSON публично загружаются с raw GitHub; скрытие вкладки не защищает данные. Backend authorization отсутствует.

## 8. Storage
Найдены localStorage, sessionStorage и CacheStorage. IndexedDB/cookies в исходниках не найдены. Детальный список в STORAGE_MAP.md. localStorage содержит client credential material, auth marker, данные участков, GitHub PAT и настройки/реквизиты. Ничего не очищалось и не мигрировалось.

## 9. Calculations
index.html считает consumption как max(0, current - previous), использует тариф 3.82 для публичной электроэнергии; долг парсится/категоризуется из debit ODS. app.js задает defaults membership 1450 и electricity 3.82; sync.js возвращает те же defaults. admin.js использует fallback membership 1400 и electricity 3.5 с теми же storage keys. Площадь/членский взнос в admin связаны пересчетом сумма / тариф. Это CONFIGURATION CONFLICT; решения владельца нет. См. CONFIGURATION_CONFLICTS.md.

## 10. QR generation
Найдены отдельные генераторы в index.html, app.js/admin.js и berezka2.js. Все формируют ST00012, но отличаются порядком/набором реквизитов, Purpose maxlength и составом текста. Реальные платежные значения в аудит не копировались. См. QR_CONTRACT.md. Не унифицировать.

## 11. Import/export
admin.js экспортирует plotData в XLSX; импорт использует FileReader + XLSX.read + sheet_to_json, нормализует некоторые поля и предлагает заменить целый массив. Явные проверки размера, schema/типа каждой ячейки и atomic commit не подтверждены. berezka2.js загружает ODS/XLSX, преобразует через XLSX, генерирует XLSX exports. Поврежденные/огромные файлы не проверялись.

## 12. Service Worker
sw.js использует cache name berezka2-v2, precache root/index/icons/JSZip/QRCode. Network-first для любого GET, успешные ответы пишутся в один CacheStorage; при ошибке идет общий cache lookup. Activate удаляет все кеши origin, чье имя не равно текущему. Нет разделения public/private/API, нет явной expiration. Зарегистрирован из index.html.

## 13. External services
- Raw GitHub и jsDelivr fallback для данных; GitHub Contents API для users.json.
- https://wwcat.duckdns.org:12580/upload: multipart POST plot_number, reading_value, photo. В найденной функции нет timeout/retry/auth; проверяется response.ok, при ошибке читается поле error из JSON. Сервер не проверен, SECURITY_STATUS=UNKNOWN.
- CDN и fonts.googleapis.com перечислены ниже. Все запросы внешние.

## 14. CDN dependencies
- JSZip 3.10.1: ODS extraction, index.
- QRCode 1.5.1: payment strings/QR, index/admin/payment/berezka.
- SheetJS/XLSX 0.18.5: ODS/XLSX parsing/export, app/admin/berezka; jsDelivr и cdnjs URL.
- Inputmask 5.0.8: admin/payment forms.
- jsPDF 2.5.1, html2canvas 1.4.1, Chart.js 4.4.0: berezka finance UI/exports/charts.
- Google Fonts Noto Sans: admin/login/payment.
- В найденных CDN tags нет integrity. Обновления не выполнялись.

## 15. Security sinks
- index.html: innerHTML в строках 1614, 1639, 1697, 1865, 1904, 2064; источники включают ODS fields, plot, пользовательские формы и status. Есть escapeHtml helper, но каждый interpolation не проверен. Строка 71 очищает innerHTML.
- admin.js: innerHTML строки 247, 648, 651, 666, 685-721. Данные local plot/import/receipt; часть HTML статическая, динамическое экранирование не подтверждено.
- app.js: innerHTML строки 408, 517, 836; owner/receipt markup.
- berezka2.js: innerHTML и шаблоны в строках 317, 506, 511-513, 1529, 1580-1591, 1858-1941, 2031-2034, 2204, 2351, 2713-2732, 2789, 2880-2982, 3049, 3313-3326, 3558-3589, 3718. Источники remote ODS/XLSX, local imports, finance data, user input/users config. Несколько строк используют document.write для печати.
- berezka2.js:2043 создает tel href после удаления символов кроме цифр/плюса; текст экранируется.
- index.html:1529 fetch(img.src) по генерируемому image URL; index.html:1777 внешний multipart POST.
- Функции eval/new Function и string timers статическим поиском не найдены.

| File / line | Input | Sink | Sanitization evidence | Risk / replacement review |
|---|---|---|---|---|
| index.html:1614,1639,1697,1865,1904,2064 | ODS, user form, plot/status | innerHTML | helper есть; контекст покрытия UNKNOWN | XSS; проверять каждый template локально |
| admin.js:247,648,651,666,685-721 | local plot/import/receipt | innerHTML | mixed static/dynamic, coverage UNKNOWN | XSS через импортированные поля |
| app.js:408,517,836 | owner/payment fields | innerHTML | не полностью проверено | XSS |
| berezka2.js:317,506,511-513,1529,1580-1591,1858-1941,2031-2034,2204,2351,2713-2732,2789,2880-2982,3049,3313-3326,3558-3589,3718 | remote/import/user/finance | innerHTML/document.write | escape usage mixed/UNKNOWN | широкий injection surface |
| index.html:1777 | plot/readings/photo | external request | no timeout/retry/auth visible | privacy and endpoint trust |
| berezka2.js:2043 | owner phone | tel href | href normalized; displayed text escaped | validate URI context if changed |

## 16. Unknown files
См. FILE_INVENTORY.md. Содержимое таблиц не парсилось и не копировалось в отчет. Нет users.json, server.js, package/build configuration, .websim.json или .websim-manifest.json в workspace listing. Zero-dependency Node tests and synthetic fixtures/goldens are now present under tests/, fixtures/ and golden/.

## 17. Unknown behavior
- Live GitHub content/users.json/permissions, GitHub branch state, внешний endpoint не проверялись.
- Владельцы тарифов/реквизитов, debt definitions, политика уменьшения показаний, import behavior, legacy schema, выбор QR неизвестны.
- Install/offline/update не запускались; browser checks не выполнялись.
- APK provenance и связь с web кодом неизвестны.
- Публичность finance sheets и намерение публиковать данные требуют решения владельца.

## 18. Regression risks
- Несовпадающие sources/defaults/calculations/auth/QR между entrypoints.
- Публичные repository files доступны независимо от UI roles.
- Общий SW cache может сохранять чувствительные или устаревшие GET.
- XLSX import заменяет весь локальный массив; размер/schema/atomicity не доказаны.
- Динамическая HTML из таблиц/import/user sources.
- Кража browser PAT позволяет запись в пределах token scope.
- Photo endpoint получает участок/показание/фото без видимого timeout/auth.
- Не все таблицы имеют установленных consumers; нельзя удалять/переименовывать.

## 19. Proposed migration order
1. Согласовать аудит, data ownership и baseline manifest.
2. Расширить synthetic characterization harness на uncovered QR variants, import/export, PWA and auth before any functional change.
3. Получить решения по тарифам, реквизитам, QR и source of truth.
4. Исправлять отдельные security issues независимо и с тестом; не соединять auth/PAT/XSS/import в одном patch.
5. Спроектировать backend/private migration после согласования ownership; сохранить старые форматы через adapters.
6. Нормализовать storage только после characterization и migration tests.
7. Добавлять adapters и сверять с golden fixtures до расчетной/QR консолидации.
8. Определить cache classes и offline contract до service worker изменений.
9. Декомпозировать после тестов; удалять legacy только после proof of unused.

## Baseline execution
Локальный Git создан. baseline/pre-websim указывает на commit 64eb6b7 (снимок исходников и статических assets до документов). ODS/XLSX/data.json/APK исключены из Git ради защиты потенциально персональных данных и неизвестного содержимого бинарного файла; их pre-doc SHA-256 есть в BASELINE_MANIFEST. Remote не настроен, публикации не было. Функциональный код не менялся. Commit record: baseline commit WHY=preserve pre-phase source; CHANGED=Git snapshot of source/static assets; NOT_CHANGED=data tables/APK excluded; TESTS=post-snapshot SHA-256 verification and JS syntax; RESULT=local ref available; RISKS=data restore depends on protected originals; ROLLBACK=checkout ref baseline/pre-websim. Audit-doc commit WHY=document observed behavior; CHANGED=Phase 0 reports only; NOT_CHANGED=runtime/data; TESTS=hash and source diff verification; RESULT=docs committed locally; RISKS=static-only unknowns remain; ROLLBACK=revert only documentation commit if requested. Synthetic characterization harness: 10/10 subtests pass for a partial subset of TEST-001–016; TEST-017–022/browser and import/export coverage remain pending. Details in REGRESSION_TEST_PLAN.md. Test commit WHY=freeze observed pure-function behavior; CHANGED=synthetic tests/fixtures/golden only; NOT_CHANGED=application/data; TESTS=10/10 characterization subtests, SHA-256 manifest, JS syntax, tracked-source diff; RESULT=partial baseline gate available; RISKS=import/PWA/remaining QR contracts untested; ROLLBACK=revert test-artifact commit only.