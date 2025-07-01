document.addEventListener('DOMContentLoaded', function() {
    // Проверка авторизации
    if (localStorage.getItem('adminAuthenticated') !== 'true') {
        window.location.href = 'login.html';
        return;
    }

    // Проверка времени сессии (24 часа)
    const loginTime = parseInt(localStorage.getItem('adminLoginTime') || '0');
    if (Date.now() - loginTime > 24 * 60 * 60 * 1000) {
        logout();
        return;
    }

    const MEMBERSHIP_TARIFF = 1400; // Define membership tariff for admin calculations
    const ELECTRICITY_TARIFF = 3.5; // Define electricity tariff for admin calculations

    let plotData = [];

    // Элементы интерфейса
    const logoutBtn = document.getElementById('logoutBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    const massReceiptBtn = document.getElementById('massReceiptBtn');
    const plotDataTable = document.getElementById('plotDataTable').getElementsByTagName('tbody')[0];
    const changePasswordForm = document.getElementById('changePasswordForm');

    // Модальные окна
    const massReceiptModal = document.getElementById('massReceiptModal');
    const massReceiptPrintModal = document.getElementById('massReceiptPrintModal');

    // Загрузка данных
    loadPlotData();

    // Обработчики событий
    logoutBtn.addEventListener('click', logout);
    exportDataBtn.addEventListener('click', exportData);
    importDataBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importData);
    massReceiptBtn.addEventListener('click', openMassReceiptModal);
    changePasswordForm.addEventListener('submit', changePassword);

    // Обработчики модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    document.getElementById('selectAllPlots').addEventListener('change', toggleSelectAllPlots);
    document.getElementById('generateMassReceiptsBtn').addEventListener('click', generateMassReceipts);
    document.getElementById('printMassReceiptsBtn').addEventListener('click', () => window.print());

    // Функции
    function logout() {
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminLoginTime');
        window.location.href = 'login.html';
    }

    async function loadPlotData() {
        try {
            const storedData = localStorage.getItem('plotData');
            if (storedData) {
                plotData = JSON.parse(storedData);
            } else {
                const response = await fetch('data.json');
                const data = await response.json();
                plotData = data
                    .filter(plot => plot.plotNumber && plot.payerName)
                    .map(plot => ({
                        ...plot,
                        meterReadingCurr: plot.meterReadingCurr !== undefined ? plot.meterReadingCurr : plot.meterReadingPrev,
                        electricitySum: plot.electricitySum !== undefined ? plot.electricitySum : 0,
                        // Initialize membershipSum. Prefer existing, otherwise calculate from plotSotkas from data.json.
                        membershipSum: plot.membershipSum !== undefined && plot.membershipSum !== null
                                       ? parseFloat(plot.membershipSum)
                                       : ((plot.plotSotkas !== undefined && plot.plotSotkas !== null) ? parseFloat(plot.plotSotkas) * MEMBERSHIP_TARIFF : 0)
                    }));
                saveDataToLocalStorage(); // Save fetched data to local storage for persistence
            }
            // After membershipSum is initialized, ensure plotSotkas is derived from it for consistency with UI.
            plotData.forEach(plot => {
                if (plot.membershipSum !== undefined && plot.membershipSum !== null && MEMBERSHIP_TARIFF > 0) {
                    plot.plotSotkas = plot.membershipSum / MEMBERSHIP_TARIFF;
                } else {
                    plot.plotSotkas = 0; // If membershipSum is 0 or invalid, plotSotkas is 0.
                }
            });

            renderTable();
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            showNotification('Ошибка загрузки данных', 'error');
        }
    }

    function renderTable() {
        plotDataTable.innerHTML = '';
        plotData.forEach((plot, index) => {
            const row = plotDataTable.insertRow();
            row.dataset.index = index; // Store index on the row

            // Function to create an editable cell
            const createEditableCell = (field, type = 'text', step = null, min = null, pattern = null) => {
                const cell = row.insertCell();
                const input = document.createElement('input');
                input.type = type;
                input.value = plot[field] !== undefined && plot[field] !== null ? plot[field] : '';
                input.dataset.field = field; // Store field name
                input.className = 'editable-cell-input';
                
                if (type === 'number') {
                    if (step !== null) input.step = step;
                    if (min !== null) input.min = min;
                    // Add input validation for numbers only, allowing empty string
                    input.addEventListener('input', function() {
                        this.value = this.value.replace(',', '.'); // Allow comma as decimal separator
                        if (this.value === '' || /^-?\d*\.?\d*$/.test(this.value)) {
                            // Valid input, do nothing special
                        } else {
                            this.value = this.value.match(/^-?\d*\.?\d*/)?.[0] || '';
                        }
                    });
                }
                if (pattern) {
                    input.pattern = pattern;
                }

                if (field === 'plotNumber' && typeof Inputmask !== 'undefined') {
                    Inputmask({
                        mask: '9{1,4}[A]',
                        placeholder: '',
                        definitions: {
                            'A': { validator: '[АAаа]', casing: 'upper' }
                        },
                        keepStatic: true // Important for pattern to work well
                    }).mask(input);
                }
                
                input.addEventListener('input', () => {
                    // Enable save button for this row
                    const saveBtn = row.querySelector('.save-btn');
                    if (saveBtn) saveBtn.disabled = false;
                });
                
                cell.appendChild(input);
                return cell;
            };

            // Function to create a read-only cell
            const createReadOnlyCell = (value) => {
                const cell = row.insertCell();
                cell.textContent = value !== undefined && value !== null ? value.toFixed(2) : '0.00';
                return cell;
            };

            createEditableCell('plotNumber', 'text', null, null, '[0-9]+[А-Яа-я]?'); // Apply pattern for plot number
            createEditableCell('payerName');
            
            // Make membershipSum editable
            createEditableCell('membershipSum', 'number', '0.01', '0');

            // Make plotSotkas read-only, derived from membershipSum
            createReadOnlyCell(plot.plotSotkas); // plot.plotSotkas is already updated to reflect membershipSum

            createEditableCell('targetSum', 'number', '0.01', '0');
            createEditableCell('meterReadingPrev', 'number', '1', '0');
            createEditableCell('meterReadingCurr', 'number', '1', '0');
            createEditableCell('electricitySum', 'number', '0.01', '0');

            const actionsCell = row.insertCell();
            actionsCell.className = 'table-actions';

            const saveBtn = document.createElement('button');
            saveBtn.textContent = '💾'; // Save icon
            saveBtn.className = 'action-btn save-btn';
            saveBtn.title = 'Сохранить изменения';
            saveBtn.disabled = true; // Initially disabled
            saveBtn.addEventListener('click', () => saveRow(index));
            actionsCell.appendChild(saveBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️'; // Delete icon
            deleteBtn.className = 'delete-btn';
            deleteBtn.title = 'Удалить участок';
            deleteBtn.addEventListener('click', () => deletePlot(index));
            actionsCell.appendChild(deleteBtn);
        });
    }

    function saveRow(index) {
        const row = plotDataTable.rows[index]; // Get the specific row
        const plot = plotData[index]; // Get the data object
        let hasChanges = false;
        let isValid = true;

        row.querySelectorAll('.editable-cell-input').forEach(input => {
            const field = input.dataset.field;
            let newValue;

            if (input.type === 'number') {
                // For number inputs, ensure value is a valid number or empty string
                newValue = parseFloat(input.value);
                if (isNaN(newValue)) {
                    newValue = 0; // Default to 0 if not a valid number
                }
            } else { // For text inputs
                newValue = input.value.trim();
                // Basic validation for plotNumber and payerName
                if ((field === 'plotNumber' || field === 'payerName') && newValue === '') {
                    isValid = false;
                    showNotification(`Поле "${field === 'plotNumber' ? 'Номер участка' : 'ФИО плательщика'}" не может быть пустым.`, 'error');
                    input.focus();
                } else if (field === 'plotNumber' && input.checkValidity && !input.checkValidity()) {
                    isValid = false;
                    showNotification('Номер участка должен содержать только цифры и может заканчиваться одной буквой (А-Яа-я).', 'error');
                    input.focus();
                }
            }
            
            if (plot[field] !== newValue) {
                plot[field] = newValue;
                hasChanges = true;
            }
        });

        if (!isValid) {
            return; // Stop if any validation fails
        }

        // Specific logic for membershipSum and plotSotkas relationship
        // plot.membershipSum is now directly from the editable input.
        // plot.plotSotkas must be derived from plot.membershipSum.
        if (plot.membershipSum !== undefined && plot.membershipSum !== null && MEMBERSHIP_TARIFF > 0) {
            const newPlotSotkas = plot.membershipSum / MEMBERSHIP_TARIFF;
            // Only update if it actually changes (comparing fixed values for precision)
            if (parseFloat(plot.plotSotkas).toFixed(2) !== newPlotSotkas.toFixed(2)) {
                plot.plotSotkas = newPlotSotkas;
                hasChanges = true;
            }
        } else { // If membershipSum is 0 or invalid, plotSotkas should be 0.
            if (plot.plotSotkas !== 0) {
                plot.plotSotkas = 0;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            saveDataToLocalStorage();
            renderTable(); // Re-render the whole table to update all states
            showNotification('Данные участка сохранены', 'success');
        } else {
            showNotification('Нет изменений для сохранения', 'info');
            const saveBtn = row.querySelector('.save-btn');
            if (saveBtn) saveBtn.disabled = true; // Disable save button if no changes
        }
    }

    function deletePlot(index) {
        if (confirm('Удалить данные этого участка?')) {
            plotData.splice(index, 1);
            saveDataToLocalStorage();
            renderTable();
            showNotification('Участок удален', 'success');
        }
    }

    function saveDataToLocalStorage() {
        localStorage.setItem('plotData', JSON.stringify(plotData));
    }

    function exportData() {
        try {
            // Подготавливаем данные для экспорта в Excel
            const excelData = plotData.map(plot => ({
                'Номер участка': plot.plotNumber || '',
                'ФИО плательщика': plot.payerName || '',
                'Членские взносы (руб.)': plot.membershipSum || 0, // Export membershipSum directly
                'Размер участка (соток)': plot.plotSotkas || 0, // Export plotSotkas (which is now derived)
                'Целевые взносы (руб.)': plot.targetSum || 0,
                'Предыдущие показания (кВт)': plot.meterReadingPrev || 0,
                'Текущие показания (кВт)': plot.meterReadingCurr || 0,
                'Сумма электроэнергии (руб.)': plot.electricitySum || 0
            }));

            // Создаем рабочую книгу
            const workbook = XLSX.utils.book_new();
            
            // Создаем лист из данных
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            
            // Устанавливаем ширину колонок (adjusted for new order)
            const columnWidths = [
                { wch: 15 }, // Номер участка
                { wch: 30 }, // ФИО плательщика
                { wch: 25 }, // Членские взносы (руб.)
                { wch: 20 }, // Размер участка (соток)
                { wch: 20 }, // Целевые взносы
                { wch: 25 }, // Предыдущие показания
                { wch: 25 }, // Текущие показания
                { wch: 25 }  // Сумма электроэнергии
            ];
            worksheet['!cols'] = columnWidths;
            
            // Добавляем лист в книгу
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Участки СНТ');
            
            // Генерируем имя файла с датой
            const date = new Date().toISOString().split('T')[0];
            const filename = `snt_berezka_2_uchastki_${date}.xlsx`;
            
            // Сохраняем файл
            XLSX.writeFile(workbook, filename);
            
            showNotification('Данные экспортированы в Excel', 'success');
            
        } catch (error) {
            console.error('Ошибка экспорта:', error);
            showNotification('Ошибка при экспорте данных', 'error');
        }
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        try {
            const reader = new FileReader();
            reader.onload = function(e) {
                try {
                    // Читаем Excel файл
                    const data = new Uint8Array(e.target.result);
                    const workbook = XLSX.read(data, { type: 'array' });
                    
                    // Берем первый лист
                    const firstSheetName = workbook.SheetNames[0];
                    const worksheet = workbook.Sheets[firstSheetName];
                    
                    // Конвертируем в JSON
                    const jsonData = XLSX.utils.sheet_to_json(worksheet);
                    
                    if (!Array.isArray(jsonData) || jsonData.length === 0) {
                        throw new Error('Файл не содержит данных или имеет неверный формат');
                    }
                    
                    // Преобразуем данные в нужный формат
                    const importedData = jsonData.map(row => {
                        const importedPlot = {
                            plotNumber: String(row['Номер участка'] || row['plotNumber'] || '').trim(),
                            payerName: String(row['ФИО плательщика'] || row['payerName'] || '').trim(),
                            // Prefer importing membershipSum if available from the new Excel structure
                            membershipSum: parseFloat(row['Членские взносы (руб.)'] || row['membershipSum'] || 0),
                            targetSum: parseFloat(row['Целевые взносы (руб.)'] || row['targetSum'] || 0),
                            meterReadingPrev: parseFloat(row['Предыдущие показания (кВт)'] || row['meterReadingPrev'] || 0),
                            meterReadingCurr: parseFloat(row['Текущие показания (кВт)'] || row['meterReadingCurr'] || 0),
                            electricitySum: parseFloat(row['Сумма электроэнергии (руб.)'] || row['electricitySum'] || 0)
                        };

                        // If membershipSum was not directly provided, try to derive from plotSotkas if present in imported row
                        if (importedPlot.membershipSum === 0 && (row['Размер участка (соток)'] !== undefined || row['plotSotkas'] !== undefined)) {
                             const importedSotkas = parseFloat(row['Размер участка (соток)'] || row['plotSotkas'] || 0);
                             if (importedSotkas > 0) {
                                 importedPlot.membershipSum = importedSotkas * MEMBERSHIP_TARIFF;
                             }
                        }

                        // Now, ensure plotSotkas is derived from membershipSum for consistency within the data model
                        if (importedPlot.membershipSum !== undefined && importedPlot.membershipSum !== null && MEMBERSHIP_TARIFF > 0) {
                            importedPlot.plotSotkas = importedPlot.membershipSum / MEMBERSHIP_TARIFF;
                        } else {
                            importedPlot.plotSotkas = 0;
                        }
                        
                        return importedPlot;
                    }).filter(plot => plot.plotNumber && plot.payerName); // Фильтруем пустые записи
                    
                    if (importedData.length === 0) {
                        throw new Error('В файле не найдено валидных записей с номером участка и ФИО');
                    }
                    
                    // Подтверждение импорта
                    const confirmMsg = `Найдено ${importedData.length} записей для импорта. Это заменит все существующие данные. Продолжить?`;
                    if (confirm(confirmMsg)) {
                        plotData = importedData;
                        saveDataToLocalStorage();
                        renderTable();
                        showNotification(`Импортировано ${importedData.length} записей`, 'success');
                    }
                    
                } catch (error) {
                    console.error('Ошибка обработки файла:', error);
                    showNotification('Ошибка импорта: ' + error.message, 'error');
                }
            };
            
            reader.readAsArrayBuffer(file);
            
        } catch (error) {
            console.error('Ошибка чтения файла:', error);
            showNotification('Ошибка при чтении файла', 'error');
        }
        
        // Очищаем input для возможности повторного выбора того же файла
        e.target.value = '';
    }

    function openMassReceiptModal() {
        const modal = massReceiptModal;
        const checkboxList = document.getElementById('plotCheckboxList');
        
        checkboxList.innerHTML = '';
        plotData.forEach((plot, index) => {
            if (plot.plotNumber && plot.payerName) {
                const checkbox = document.createElement('label');
                checkbox.className = 'checkbox-label';
                checkbox.innerHTML = `
                    <input type="checkbox" value="${index}" class="plot-checkbox">
                    Участок ${plot.plotNumber} - ${plot.payerName}
                `;
                checkboxList.appendChild(checkbox);
            }
        });
        
        modal.style.display = 'block';
    }

    function toggleSelectAllPlots() {
        const selectAll = document.getElementById('selectAllPlots');
        const checkboxes = document.querySelectorAll('.plot-checkbox');
        checkboxes.forEach(cb => cb.checked = selectAll.checked);
    }

    async function generateMassReceipts() {
        const selectedCheckboxes = document.querySelectorAll('.plot-checkbox:checked');
        if (selectedCheckboxes.length === 0) {
            showNotification('Выберите хотя бы один участок', 'error');
            return;
        }

        const selectedIndices = Array.from(selectedCheckboxes).map(cb => parseInt(cb.value));
        const receiptsContainer = document.getElementById('massReceiptContent');
        receiptsContainer.innerHTML = '';

        // Создаем контейнер для страниц
        let currentPage = document.createElement('div');
        currentPage.className = 'receipt-page';
        receiptsContainer.appendChild(currentPage);

        for (const index of selectedIndices) {
            const plot = plotData[index];
            if (!plot.plotNumber || !plot.payerName) continue;

            let kwhUsedForReceipt = 0; // Initialize kwhUsed for this receipt

            const formData = {
                plotNumber: plot.plotNumber,
                payerName: plot.payerName,
                paymentTypes: [],
                totalAmount: 0,
                membershipSum: 0,
                targetSum: 0,
                electricitySum: 0,
                meterReadingPrev: plot.meterReadingPrev || 0,
                meterReadingCurr: plot.meterReadingCurr || plot.meterReadingPrev || 0, // Ensure meterReadingCurr is at least prev if not set
                kwhUsed: 0 // Add kwhUsed to formData
            };

            // Рассчитываем суммы
            if (plot.membershipSum > 0) { // Use stored membershipSum directly
                formData.membershipSum = plot.membershipSum;
                formData.paymentTypes.push('Членские взносы');
                formData.totalAmount += formData.membershipSum;
            }
            if (plot.targetSum > 0) {
                formData.targetSum = plot.targetSum;
                formData.paymentTypes.push('Целевые взносы');
                formData.totalAmount += formData.targetSum;
            }
            // If electricitySum is directly provided in data, use it. Otherwise, calculate from readings.
            if (plot.electricitySum > 0) { // Prefer pre-calculated sum if available
                formData.electricitySum = plot.electricitySum;
                formData.paymentTypes.push('Электроэнергия');
                formData.totalAmount += formData.electricitySum;
                
                // If sum is provided, but readings are also present, calculate kWh for display
                if (formData.meterReadingCurr >= formData.meterReadingPrev) {
                     kwhUsedForReceipt = formData.meterReadingCurr - formData.meterReadingPrev;
                } else if (formData.electricitySum > 0 && ELECTRICITY_TARIFF > 0) {
                     kwhUsedForReceipt = formData.electricitySum / ELECTRICITY_TARIFF;
                }
            } else if (formData.meterReadingCurr > formData.meterReadingPrev) {
                kwhUsedForReceipt = formData.meterReadingCurr - formData.meterReadingPrev;
                formData.electricitySum = kwhUsedForReceipt * ELECTRICITY_TARIFF;
                formData.paymentTypes.push('Электроэнергия');
                formData.totalAmount += formData.electricitySum;
            }
            formData.kwhUsed = kwhUsedForReceipt; // Store calculated kWh usage

            // Always generate receipts, even if the total amount is zero
            // If total amount is 0, still print, user requested mass print
            { 
                const today = new Date();
                const formattedDate = today.toLocaleDateString('ru-RU');
                const amountInWords = numberToWords(formData.totalAmount);

                // Генерируем QR код
                const qrCodeDataURL = await generateQrCodeDataURLForReceipt(formData);

                // Создаем элемент квитанции
                const receiptDiv = document.createElement('div');
                receiptDiv.className = 'mass-receipt-item';
                receiptDiv.innerHTML =
                    createReceiptPart('Извещение', formData, amountInWords, formattedDate, qrCodeDataURL) +
                    '<div class="receipt-tear-line"></div>' +
                    createReceiptPart('Квитанция', formData, amountInWords, formattedDate, null);

                // Добавляем квитанцию на текущую страницу
                currentPage.appendChild(receiptDiv);

                // Если на странице уже 2 квитанции, создаем новую страницу
                if (currentPage.children.length >= 2) {
                    currentPage = document.createElement('div');
                    currentPage.className = 'receipt-page';
                    receiptsContainer.appendChild(currentPage);
                }
            }
        }

        massReceiptModal.style.display = 'none';
        massReceiptPrintModal.style.display = 'block';

        // Даем время на рендеринг перед печатью
        setTimeout(() => {
            window.print();
        }, 500);
    }

    function changePassword(e) {
        e.preventDefault();
        
        const currentPassword = document.getElementById('currentPassword').value;
        const newPassword = document.getElementById('newPassword').value;
        const confirmPassword = document.getElementById('confirmPassword').value;
        
        const savedCredentials = JSON.parse(localStorage.getItem('adminCredentials') || '{"username": "admin", "password": "admin"}');
        
        if (currentPassword !== savedCredentials.password) {
            showNotification('Неверный текущий пароль', 'error');
            return;
        }
        
        if (newPassword !== confirmPassword) {
            showNotification('Пароли не совпадают', 'error');
            return;
        }
        
        if (newPassword.length < 4) {
            showNotification('Пароль должен содержать минимум 4 символа', 'error');
            return;
        }
        
        savedCredentials.password = newPassword;
        localStorage.setItem('adminCredentials', JSON.stringify(savedCredentials));
        
        e.target.reset();
        showNotification('Пароль успешно изменен', 'success');
    }

    // Вспомогательные функции
    window.deletePlot = deletePlot;
    window.closeMassReceiptModal = () => massReceiptModal.style.display = 'none';

    // Функции для генерации квитанций 
    async function generateQrCodeDataURLForReceipt(formData) {
        const REQUISITES = {
            Name: 'СНТ «Березка-2»',
            PayeeINN: '5433118499',
            KPP: '543301001',
            BankName: 'Сибирский Банк ПАО Сбербанк',
            PersonalAcc: '40703810644050040322',
            BIC: '045004641',
            CorrespAcc: '30101810500000000641'
        };

        const totalAmountKopecks = (formData.totalAmount * 100).toFixed(0);
        let purposeParts = [];
        
        if (formData.membershipSum > 0) {
            purposeParts.push(`Членские взносы: ${formData.membershipSum.toFixed(2)} руб.`);
        }
        if (formData.targetSum > 0) {
            purposeParts.push(`Целевые взносы: ${formData.targetSum.toFixed(2)} руб.`);
        }
        if (formData.electricitySum > 0) {
            // In admin, we don't have kwhUsedElement. Use plot data for calculation if available.
            let kwhForPurpose = 0;
            const currentPlot = plotData.find(p => p.plotNumber === formData.plotNumber && p.payerName === formData.payerName);
            if (currentPlot && currentPlot.meterReadingCurr > currentPlot.meterReadingPrev) {
                kwhForPurpose = currentPlot.meterReadingCurr - currentPlot.meterReadingPrev;
            }
            purposeParts.push(`Электроэнергия: ${formData.electricitySum.toFixed(2)} руб. ${kwhForPurpose > 0 ? `(${kwhForPurpose} кВт)` : ''}`);
        }
        
        const purposeString = purposeParts.join(', ') + ` за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;

        const paymentString =
            `ST00012|Name=${REQUISITES.Name}` +
            `|PersonalAcc=${REQUISITES.PersonalAcc}` +
            `|BankName=${REQUISITES.BankName}` +
            `|BIC=${REQUISITES.BIC}` +
            `|CorrespAcc=${REQUISITES.CorrespAcc}` +
            `|PayeeINN=${REQUISITES.PayeeINN}` +
            `|KPP=${REQUISITES.KPP}` +
            `|Sum=${totalAmountKopecks}` +
            `|Purpose=${purposeString}`;

        try {
            return await QRCode.toDataURL(paymentString, { width: 90, errorCorrectionLevel: 'H' });
        } catch (error) {
            console.error('Error generating QR code:', error);
            return null;
        }
    }

    function createReceiptPart(title, data, amountInWords, formattedDate, qrCodeDataURL = null) {
        const purpose = data.paymentTypes.join(', ');
        
        let paymentDetails = [];
        if (data.membershipSum > 0) paymentDetails.push(`Членские взносы: ${data.membershipSum.toFixed(2)} руб.`);
        if (data.targetSum > 0) paymentDetails.push(`Целевые взносы: ${data.targetSum.toFixed(2)} руб.`);
        if (data.electricitySum > 0) {
            // Use kwhUsed from data if available, otherwise just print the sum
            const kwhDisplay = (data.kwhUsed !== undefined && data.kwhUsed > 0) ? ` (${Math.round(data.kwhUsed)} кВт)` : '';
            paymentDetails.push(`Электроэнергия: ${data.electricitySum.toFixed(2)} руб.${kwhDisplay}`);
        }
        
        const qrCodeHtml = (title === 'Извещение' && qrCodeDataURL) ?
            `<div class="receipt-qr-code-container">
                <img src="${qrCodeDataURL}" alt="QR Code" class="receipt-qr-code">
                <div class="receipt-qr-label">Сканируйте для оплаты</div>
            </div>` : '';

        return `
            <div class="receipt-part">
                <div class="receipt-main-content">
                    <div class="receipt-header">
                        <div class="receipt-form-number">
                            <span>Форма № ПД-4</span>
                        </div>
                    </div>
                    
                    <div class="receipt-field">
                        <div class="receipt-field-value">СНТ «Березка-2»</div>
                        <div class="receipt-field-label">(наименование получателя платежа)</div>
                    </div>
                    
                    <div class="receipt-row">
                        <div class="receipt-field" style="flex: 2;">
                            <div class="receipt-field-value">5433118499</div>
                            <div class="receipt-field-label">(ИНН получателя платежа)</div>
                        </div>
                        <div class="receipt-field" style="flex: 3;">
                            <div class="receipt-field-value">40703810644050040322</div>
                            <div class="receipt-field-label">(номер счёта получателя платежа)</div>
                        </div>
                    </div>
                    
                    <div class="receipt-field">
                        <div class="receipt-field-value">Сибирский Банк ПАО Сбербанк г. Новосибирск</div>
                        <div class="receipt-field-label">(наименование банка получателя платежа)</div>
                    </div>
                    
                    <div class="receipt-row">
                        <div class="receipt-field" style="flex: 1;">
                            <div class="receipt-field-value">045004641</div>
                            <div class="receipt-field-label">(БИК)</div>
                        </div>
                        <div class="receipt-field" style="flex: 2;">
                            <div class="receipt-field-value">30101810500000000641</div>
                            <div class="receipt-field-label">(номер кор./сч. банка получателя платежа)</div>
                        </div>
                    </div>
                    
                    <div class="receipt-field">
                        <div class="receipt-field-value">${purpose} за участок № ${data.plotNumber}</div>
                        <div class="receipt-field-label">(наименование платежа)</div>
                    </div>
                    
                    <div class="receipt-field">
                        <div class="receipt-field-value">${data.payerName}</div>
                        <div class="receipt-field-label">(Ф.И.О. плательщика, адрес)</div>
                    </div>
                    
                    <div class="receipt-amount-section">
                        ${paymentDetails.map(detail => `<div class="receipt-amount-row"><span>${detail}</span></div>`).join('')}
                        <div class="receipt-total">Итого к доплате: ${data.totalAmount.toFixed(2)} руб.</div>
                    </div>
                    
                    <div class="receipt-amount-words">
                        <strong>Sумма прописью:</strong> ${amountInWords}
                    </div>
                    
                    <div class="receipt-footer">
                        <div class="receipt-date-block">
                            <div>Дата ${formattedDate}</div>
                        </div>
                        <div class="receipt-signatures-block">
                            <div class="signature-entry">
                                <span class="sig-label">Плательщик (подпись)</span>
                                <span class="sig-line"></span>
                                <span class="sig-separator">/</span>
                                <span class="sig-decipher-line"></span>
                                <span class="sig-decipher-text">(расшифровка)</span>
                            </div>
                            <div class="signature-entry">
                                <span class="sig-label">Кассир</span>
                                <span class="sig-line"></span>
                                <span class="sig-separator">/</span>
                                <span class="sig-decipher-line"></span>
                                <span class="sig-decipher-text">(расшифровка)</span>
                            </div>
                        </div>
                    </div>
                </div>
                <div class="receipt-right-frame">
                    <span class="receipt-title-right">${title}</span>
                    ${qrCodeHtml} 
                    <div class="cashier-label-right">Кассир</div>
                </div>
            </div>
        `;
    }

    function numberToWords(num) {
        const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
        const unitsFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
        const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемьнадцать', 'девятнадцать'];
        const tens = ['', 'десять', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
        const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];

        function convertLessThanOneThousand(n, isFemale) {
            if (n === 0) return '';
            let result = '';

            if (n >= 100) {
                result += hundreds[Math.floor(n / 100)] + ' ';
                n %= 100;
            }

            if (n >= 20) {
                result += tens[Math.floor(n / 10)] + ' ';
                n %= 10;
            } else if (n >= 10) {
                result += teens[n - 10] + ' ';
                n = 0;
            }

            if (n > 0) {
                result += (isFemale ? unitsFemale[n] : units[n]) + ' ';
            }

            return result.trim();
        }

        let rubles = Math.floor(num);
        let kopecks = Math.round((num - rubles) * 100);
        let result = '';

        if (rubles >= 1000) {
            const thousands = Math.floor(rubles / 1000);
            rubles %= 1000;

            result += convertLessThanOneThousand(thousands, true) + ' ';

            if (thousands % 100 >= 11 && thousands % 100 <= 19) {
                result += 'тысяч ';
            } else {
                switch(thousands % 10) {
                    case 1: result += 'тысяча '; break;
                    case 2:
                    case 3:
                    case 4: result += 'тысячи '; break;
                    default: result += 'тысяч ';
                }
            }
        }

        if (rubles > 0 || result === '') {
            result += convertLessThanOneThousand(rubles, false) + ' ';
        }

        if (rubles % 100 >= 11 && rubles % 100 <= 19) {
            result += 'рублей';
        } else {
            switch(rubles % 10) {
                case 1: result += 'рубль'; break;
                case 2:
                case 3:
                case 4: result += 'рубля'; break;
                default: result += 'рублей';
            }
        }

        kopecks = kopecks.toString().padStart(2, '0');
        result += ` ${kopecks} коп.`;

        return result.charAt(0).toUpperCase() + result.slice(1);
    }

    function showNotification(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        toast.textContent = message;
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 24px;
            background: ${type === 'error' ? '#f44336' : (type === 'success' ? '#4CAF50' : '#2196F3')};
            color: white;
            border-radius: 44px; 
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.remove();
                }
            }, 300);
        }, 5000);
    }
});