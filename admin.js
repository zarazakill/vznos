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

    let plotData = [];
    let editingIndex = -1;
    const MEMBERSHIP_TARIFF = 1400; // 1400 руб за сотку

    // Элементы интерфейса
    const logoutBtn = document.getElementById('logoutBtn');
    const addPlotBtn = document.getElementById('addPlotBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const exportExcelBtn = document.getElementById('exportExcelBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importExcelBtn = document.getElementById('importExcelBtn');
    const importFileInput = document.getElementById('importFileInput');
    const importExcelInput = document.getElementById('importExcelInput');
    const massReceiptBtn = document.getElementById('massReceiptBtn');
    const plotDataTable = document.getElementById('plotDataTable').getElementsByTagName('tbody')[0];
    const changePasswordForm = document.getElementById('changePasswordForm');

    // Модальные окна
    const editPlotModal = document.getElementById('editPlotModal');
    const massReceiptModal = document.getElementById('massReceiptModal');
    const massReceiptPrintModal = document.getElementById('massReceiptPrintModal');

    // Загрузка данных
    loadPlotData();

    // Обработчики событий
    logoutBtn.addEventListener('click', logout);
    addPlotBtn.addEventListener('click', () => openEditModal());
    exportDataBtn.addEventListener('click', exportData);
    exportExcelBtn.addEventListener('click', exportExcel);
    importDataBtn.addEventListener('click', () => importFileInput.click());
    importExcelBtn.addEventListener('click', () => importExcelInput.click());
    importFileInput.addEventListener('change', importData);
    importExcelInput.addEventListener('change', importExcel);
    massReceiptBtn.addEventListener('click', openMassReceiptModal);
    if (changePasswordForm) {
        changePasswordForm.addEventListener('submit', changePassword);
    }

    // Обработчики модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    document.getElementById('editPlotForm').addEventListener('submit', savePlot);
    if (document.getElementById('selectAllPlots')) {
        document.getElementById('selectAllPlots').addEventListener('change', toggleSelectAllPlots);
    }
    if (document.getElementById('generateMassReceiptsBtn')) {
        document.getElementById('generateMassReceiptsBtn').addEventListener('click', generateMassReceipts);
    }
    if (document.getElementById('printMassReceiptsBtn')) {
        document.getElementById('printMassReceiptsBtn').addEventListener('click', () => {
            // Add a small delay to allow browser to render content before printing
            setTimeout(() => {
                window.print();
            }, 100); 
        });
    }

    // Функции
    function logout() {
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminLoginTime');
        window.location.href = 'login.html';
    }

    async function loadPlotData() {
        try {
            const response = await fetch('data.json');
            const data = await response.json();
            plotData = data.filter(plot => plot.plotNumber && plot.payerName); // Фильтруем пустые записи
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
            row.innerHTML = `
                <td><span class="editable-cell" data-field="plotNumber" data-index="${index}">${plot.plotNumber}</span></td>
                <td><span class="editable-cell" data-field="payerName" data-index="${index}">${plot.payerName}</span></td>
                <td><span class="editable-cell" data-field="membershipSum" data-index="${index}">${((plot.plotSotkas || 0) * MEMBERSHIP_TARIFF).toFixed(2)}</span></td>
                <td><span class="editable-cell" data-field="plotSotkas" data-index="${index}">${(plot.plotSotkas || 0).toFixed(2)}</span></td>
                <td><span class="editable-cell" data-field="targetSum" data-index="${index}">${plot.targetSum || 0}</span></td>
                <td><span class="editable-cell" data-field="meterReadingPrev" data-index="${index}">${plot.meterReadingPrev || 0}</span></td>
                <td><span class="editable-cell" data-field="meterReadingCurr" data-index="${index}">${plot.meterReadingCurr || 0}</span></td>
                <td class="table-actions">
                    <button onclick="openEditModal(${index})" class="edit-btn">✏️</button>
                    <button onclick="deletePlot(${index})" class="delete-btn">🗑️</button>
                </td>
            `;
        });

        // Добавляем обработчики для редактирования ячеек
        document.querySelectorAll('.editable-cell').forEach(cell => {
            cell.addEventListener('click', function() {
                if (this.querySelector('input')) return; // Уже редактируется
                
                const field = this.dataset.field;
                const index = parseInt(this.dataset.index);
                const currentValue = this.textContent;
                
                // Создаем input для редактирования
                const input = document.createElement('input');
                input.type = field.includes('Sum') || field.includes('Sotkas') || field.includes('Reading') ? 'number' : 'text';
                if (input.type === 'number') {
                    input.step = field.includes('Sotkas') || field.includes('Sum') ? '0.01' : '1';
                    input.min = '0';
                }
                input.value = currentValue;
                input.style.width = '100%';
                input.style.border = '1px solid var(--primary-color)';
                
                this.innerHTML = '';
                this.appendChild(input);
                input.focus();
                input.select();
                
                const saveEdit = () => {
                    const newValue = input.type === 'number' ? parseFloat(input.value) || 0 : input.value.trim();
                    
                    if (field === 'membershipSum') {
                        // Если редактируется сумма членских взносов, пересчитываем сотки
                        plotData[index].plotSotkas = newValue / MEMBERSHIP_TARIFF;
                    } else {
                        plotData[index][field] = newValue;
                    }
                    
                    saveDataToLocalStorage();
                    renderTable();
                    showNotification('Данные обновлены', 'success');
                };
                
                const cancelEdit = () => {
                    this.textContent = currentValue;
                };
                
                input.addEventListener('blur', saveEdit);
                input.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        saveEdit();
                    } else if (e.key === 'Escape') {
                        cancelEdit();
                    }
                });
            });
        });
    }

    function openEditModal(index = -1) {
        editingIndex = index;
        const modal = editPlotModal;
        const form = document.getElementById('editPlotForm');
        
        if (index >= 0) {
            const plot = plotData[index];
            document.getElementById('editModalTitle').textContent = 'Редактировать участок';
            document.getElementById('editPlotNumber').value = plot.plotNumber;
            document.getElementById('editPayerName').value = plot.payerName;
            document.getElementById('editPlotSotkas').value = plot.plotSotkas || '';
            document.getElementById('editTargetSum').value = plot.targetSum || '';
            document.getElementById('editMeterReading').value = plot.meterReadingPrev || '';
            document.getElementById('editMeterReadingCurr').value = plot.meterReadingCurr || '';
        } else {
            document.getElementById('editModalTitle').textContent = 'Добавить участок';
            form.reset();
        }
        
        modal.style.display = 'block';
    }

    function savePlot(e) {
        e.preventDefault();
        
        const plotData_new = {
            plotNumber: document.getElementById('editPlotNumber').value.trim(),
            payerName: document.getElementById('editPayerName').value.trim(),
            plotSotkas: parseFloat(document.getElementById('editPlotSotkas').value) || 0,
            targetSum: parseFloat(document.getElementById('editTargetSum').value) || 0,
            meterReadingPrev: parseFloat(document.getElementById('editMeterReading').value) || 0,
            meterReadingCurr: parseFloat(document.getElementById('editMeterReadingCurr').value) || 0
        };

        if (editingIndex >= 0) {
            plotData[editingIndex] = plotData_new;
        } else {
            plotData.push(plotData_new);
        }

        saveDataToLocalStorage();
        renderTable();
        closeEditModal();
        showNotification('Данные сохранены', 'success');
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
        const dataStr = JSON.stringify(plotData, null, 2);
        const dataBlob = new Blob([dataStr], {type: 'application/json'});
        const url = URL.createObjectURL(dataBlob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `snt_berezka_data_${new Date().toISOString().split('T')[0]}.json`;
        link.click();
        URL.revokeObjectURL(url);
        showNotification('Данные экспортированы в JSON', 'success');
    }

    function exportExcel() {
        // Подготавливаем данные для экспорта
        const exportData = plotData.map(plot => ({
            'Номер участка': plot.plotNumber,
            'ФИО плательщика': plot.payerName,
            'Размер участка (соток)': plot.plotSotkas || 0,
            'Целевые взносы (руб.)': plot.targetSum || 0,
            'Предыдущие показания': plot.meterReadingPrev || 0,
            'Текущие показания': plot.meterReadingCurr || 0
        }));

        // Создаем книгу Excel
        const wb = XLSX.utils.book_new();
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Добавляем лист в книгу
        XLSX.utils.book_append_sheet(wb, ws, 'Участки СНТ Березка-2');
        
        // Сохраняем файл
        const fileName = `snt_berezka_data_${new Date().toISOString().split('T')[0]}.xlsx`;
        XLSX.writeFile(wb, fileName);
        
        showNotification('Данные экспортированы в XLSX', 'success');
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const importedData = JSON.parse(e.target.result);
                if (Array.isArray(importedData)) {
                    // Добавляем поле meterReadingCurr если его нет
                    const updatedData = importedData.map(plot => ({
                        ...plot,
                        meterReadingCurr: plot.meterReadingCurr || plot.meterReadingPrev || 0
                    }));
                    plotData = updatedData;
                    saveDataToLocalStorage();
                    renderTable();
                    showNotification('Данные импортированы из JSON', 'success');
                } else {
                    throw new Error('Неверный формат файла');
                }
            } catch (error) {
                showNotification('Ошибка импорта: ' + error.message, 'error');
            }
        };
        reader.readAsText(file);
    }

    function importExcel(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, {type: 'array'});
                
                // Читаем первый лист
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                
                // Преобразуем в JSON
                const jsonData = XLSX.utils.sheet_to_json(worksheet);
                
                // Преобразуем в формат приложения
                const importedData = jsonData.map(row => ({
                    plotNumber: String(row['Номер участка'] || row.plotNumber || ''),
                    payerName: String(row['ФИО плательщика'] || row.payerName || ''),
                    plotSotkas: Number(row['Размер участка (соток)'] || row.plotSotkas || 0),
                    targetSum: Number(row['Целевые взносы (руб.)'] || row.targetSum || 0),
                    meterReadingPrev: Number(row['Предыдущие показания'] || row.meterReadingPrev || 0),
                    meterReadingCurr: Number(row['Текущие показания'] || row.meterReadingCurr || row.meterReadingPrev || 0)
                })).filter(plot => plot.plotNumber && plot.payerName); // Фильтруем пустые записи
                
                if (importedData.length > 0) {
                    plotData = importedData;
                    saveDataToLocalStorage();
                    renderTable();
                    showNotification(`Импортировано ${importedData.length} записей из XLSX`, 'success');
                } else {
                    throw new Error('Не найдено данных для импорта или неверный формат');
                }
                
            } catch (error) {
                console.error('Ошибка импорта Excel:', error);
                showNotification('Ошибка импорта XLSX: ' + error.message, 'error');
            }
        };
        reader.readAsArrayBuffer(file);
    }

    function openMassReceiptModal() {
        const modal = massReceiptModal;
        const checkboxList = document.getElementById('plotCheckboxList');
        
        if (!checkboxList) return;
        
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

        const ELECTRICITY_TARIFF = 3.5;

        for (let i = 0; i < selectedIndices.length; i += 2) {
            // Создаем страницу с двумя квитанциями
            const pageDiv = document.createElement('div');
            pageDiv.className = 'receipt-page';
            
            // Первая квитанция
            const index1 = selectedIndices[i];
            const plot1 = plotData[index1];
            if (plot1.plotNumber && plot1.payerName) {
                const receipt1 = await createReceiptForPlot(plot1, ELECTRICITY_TARIFF);
                pageDiv.appendChild(receipt1);
            }
            
            // Вторая квитанция (если есть)
            if (i + 1 < selectedIndices.length) {
                const index2 = selectedIndices[i + 1];
                const plot2 = plotData[index2];
                if (plot2.plotNumber && plot2.payerName) {
                    const receipt2 = await createReceiptForPlot(plot2, ELECTRICITY_TARIFF);
                    pageDiv.appendChild(receipt2);
                }
            }
            
            receiptsContainer.appendChild(pageDiv);
        }

        massReceiptModal.style.display = 'none';
        massReceiptPrintModal.style.display = 'block';
    }

    async function createReceiptForPlot(plot, ELECTRICITY_TARIFF) {
        const formData = {
            plotNumber: plot.plotNumber,
            payerName: plot.payerName,
            paymentTypes: [],
            totalAmount: 0,
            membershipSum: 0,
            targetSum: 0,
            electricitySum: 0
        };

        // Рассчитываем суммы
        if (plot.plotSotkas > 0) {
            formData.membershipSum = plot.plotSotkas * MEMBERSHIP_TARIFF;
            formData.paymentTypes.push('Членские взносы');
            formData.totalAmount += formData.membershipSum;
        }

        if (plot.targetSum > 0) {
            formData.targetSum = plot.targetSum;
            formData.paymentTypes.push('Целевые взносы');
            formData.totalAmount += formData.targetSum;
        }

        if (plot.meterReadingCurr && plot.meterReadingPrev && plot.meterReadingCurr > plot.meterReadingPrev) {
            const usage = plot.meterReadingCurr - plot.meterReadingPrev;
            formData.electricitySum = usage * ELECTRICITY_TARIFF;
            formData.paymentTypes.push('Электроэнергия');
            formData.totalAmount += formData.electricitySum;
        }

        if (formData.totalAmount > 0) {
            const today = new Date();
            const formattedDate = today.toLocaleDateString('ru-RU');
            const amountInWords = numberToWords(formData.totalAmount);

            // Генерируем QR код
            const qrCodeDataURL = await generateQrCodeDataURLForReceipt(formData);

            // Создаем контейнер для квитанции
            const receiptDiv = document.createElement('div');
            receiptDiv.className = 'mass-receipt-item';
            receiptDiv.innerHTML = 
                createReceiptPart('Извещение', formData, amountInWords, formattedDate, qrCodeDataURL) +
                '<div class="receipt-tear-line"></div>' +
                createReceiptPart('Квитанция', formData, amountInWords, formattedDate, null);
            
            return receiptDiv;
        }
        
        return document.createElement('div');
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
    window.openEditModal = openEditModal;
    window.deletePlot = deletePlot;
    window.closeEditModal = () => editPlotModal.style.display = 'none';
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
            purposeParts.push(`Электроэнергия: ${formData.electricitySum.toFixed(2)} руб.`);
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
        if (data.electricitySum > 0) paymentDetails.push(`Электроэнергия: ${data.electricitySum.toFixed(2)} руб.`);
        
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
                        <strong>Сумма прописью:</strong> ${amountInWords}
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