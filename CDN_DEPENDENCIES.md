# CDN Dependency Inventory

Version inventory from HTML references. No dependency was updated. SRI/integrity attributes were not found on the listed script tags. Replacement means "not selected" unless noted; do not substitute without independent golden/regression tests.

| library | version | URL | purpose | integrity | used_by | replacement |
|---|---|---|---|---|---|---|
| JSZip | 3.10.1 | https://cdn.jsdelivr.net/npm/jszip@3.10.1/dist/jszip.min.js | unzip ODS/content.xml | absent | index.html, sw.js precache | none selected |
| qrcode | 1.5.1 | https://cdn.jsdelivr.net/npm/qrcode@1.5.1/build/qrcode.min.js | ST00012 payment QR rendering | absent | index.html, admin.html, payment.html; berezka dependency | none selected |
| SheetJS/XLSX | 0.18.5 | https://cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js | ODS/XLSX import/export | absent | berezka2.html | none selected |
| SheetJS/XLSX | 0.18.5 | https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js | XLSX import/export | absent | admin.html | same library/version via different CDN; consolidation not authorized |
| jsPDF | 2.5.1 | https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js | PDF output | absent | berezka2.html | none selected |
| html2canvas | 1.4.1 | https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js | canvas/print output | absent | berezka2.html | none selected |
| Chart.js | 4.4.0 | https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js | charts | absent | berezka2.html | none selected |
| Inputmask | 5.0.8 | https://cdnjs.cloudflare.com/ajax/libs/inputmask/5.0.8/inputmask.min.js | masked inputs | absent | admin.html, payment.html | none selected |
| Noto Sans | URL family variable | https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;500;700&display=swap | UI font | N/A stylesheet | admin.html, login.html, payment.html | system font fallback exists; no replacement decision |

Note: exact reference usage of QRCode in berezka is through page global loaded by HTML. Network availability and CDN response integrity were not probed. No remote URL was fetched during audit.