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

    let membershipTariff;
    let electricityTariff;
    let plotData = [];

    // Элементы интерфейса
    const logoutBtn = document.getElementById('logoutBtn');
    const exportDataBtn = document.getElementById('exportDataBtn');
    const importDataBtn = document.getElementById('importDataBtn');
    const importFileInput = document.getElementById('importFileInput');
    const massReceiptBtn = document.getElementById('massReceiptBtn');
    const addPlotBtn = document.getElementById('addPlotBtn');
    const plotDataTable = document.getElementById('plotDataTable');
    const plotDataTableBody = plotDataTable.getElementsByTagName('tbody')[0];
    const changePasswordForm = document.getElementById('changePasswordForm');
    const settingsForm = document.getElementById('settingsForm');
    const electricityTariffInput = document.getElementById('electricityTariff');
    const membershipTariffInput = document.getElementById('membershipTariff');

    // Модальные окна
    const massReceiptModal = document.getElementById('massReceiptModal');
    const massReceiptPrintModal = document.getElementById('massReceiptPrintModal');
    const singleReceiptModal = document.getElementById('singleReceiptModal');

    // Добавление стилей для прогресс-бара
    function addProgressBarStyles() {
        if (!document.querySelector('#progress-bar-styles')) {
            const styleElement = document.createElement('style');
            styleElement.id = 'progress-bar-styles';
            styleElement.textContent = `
            .progress-container {
                padding: 20px;
                text-align: center;
            }
            .progress-bar {
                width: 0%;
                height: 30px;
                background-color: #4CAF50;
                text-align: center;
                line-height: 30px;
                color: white;
                border-radius: 15px;
                transition: width 0.3s ease;
                margin: 20px 0;
            }
            `;
            document.head.appendChild(styleElement);
        }
    }
    addProgressBarStyles();

    // Загрузка данных
    loadSettings();
    loadPlotData();

    // Обработчики событий
    logoutBtn.addEventListener('click', logout);
    exportDataBtn.addEventListener('click', exportData);
    importDataBtn.addEventListener('click', () => importFileInput.click());
    importFileInput.addEventListener('change', importData);
    massReceiptBtn.addEventListener('click', openMassReceiptSelectionModal);
    addPlotBtn.addEventListener('click', addNewPlotRow);
    changePasswordForm.addEventListener('submit', changePassword);
    settingsForm.addEventListener('submit', saveSettings);

    // Обработчики модальных окон
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', function() {
            this.closest('.modal').style.display = 'none';
        });
    });

    // Закрытие модальных окон по клику вне их
    window.addEventListener('click', function(event) {
        const modals = document.querySelectorAll('.modal');
        modals.forEach(modal => {
            if (event.target === modal) {
                modal.style.display = 'none';
            }
        });
    });

    document.getElementById('selectAllPlots').addEventListener('change', toggleSelectAllPlots);
    document.getElementById('selectAllPlotsCheckboxModal').addEventListener('change', toggleSelectAllPlotsModal);
    document.getElementById('generateMassReceiptsBtn').addEventListener('click', generateMassReceipts);
    document.getElementById('printMassReceiptsBtn').addEventListener('click', () => window.print());
    document.getElementById('printSingleReceiptBtn').addEventListener('click', () => window.print());

    // Функции
    function logout() {
        localStorage.removeItem('adminAuthenticated');
        localStorage.removeItem('adminLoginTime');
        window.location.href = 'login.html';
    }

    function loadSettings() {
        const savedElectricityTariff = localStorage.getItem('electricityTariff');
        electricityTariff = savedElectricityTariff ? parseFloat(savedElectricityTariff) : 3.5;
        if (electricityTariffInput) {
            electricityTariffInput.value = electricityTariff.toFixed(2);
        }

        const savedMembershipTariff = localStorage.getItem('membershipTariff');
        membershipTariff = savedMembershipTariff ? parseFloat(savedMembershipTariff) : 1400;
        if (membershipTariffInput) {
            membershipTariffInput.value = membershipTariff.toFixed(2);
        }
    }

    function saveSettings(e) {
        e.preventDefault();

        const newMembershipTariff = parseFloat(membershipTariffInput.value);
        const newElectricityTariff = parseFloat(electricityTariffInput.value);

        if (isNaN(newMembershipTariff) || newMembershipTariff < 0) {
            showNotification('Неверное значение тарифа на членские взносы', 'error');
            return;
        }

        if (isNaN(newElectricityTariff) || newElectricityTariff < 0) {
            showNotification('Неверное значение тарифа на электроэнергию', 'error');
            return;
        }

        const oldMembershipTariff = membershipTariff;
        const oldElectricityTariff = electricityTariff;

        membershipTariff = newMembershipTariff;
        electricityTariff = newElectricityTariff;

        // Используем DataSync для синхронизации с другими вкладками
        if (typeof DataSync !== 'undefined') {
            DataSync.saveMembershipTariff(membershipTariff);
            DataSync.saveElectricityTariff(electricityTariff);
        } else {
            localStorage.setItem('membershipTariff', membershipTariff.toString());
            localStorage.setItem('electricityTariff', electricityTariff.toString());
        }

        if (oldMembershipTariff !== membershipTariff) {
            recalculateAllMembershipFees();
        }

        if (oldElectricityTariff !== electricityTariff) {
            recalculateAllElectricityFees();
        }

        renderTable();
        showNotification('Настройки сохранены, данные пересчитаны', 'success');
    }

    function recalculateAllMembershipFees() {
        plotData.forEach(plot => {
            if (plot.plotSotkas && plot.plotSotkas > 0) {
                plot.membershipSum = plot.plotSotkas * membershipTariff;
            } else if (plot.membershipSum > 0) {
                plot.plotSotkas = plot.membershipSum / membershipTariff;
            }
        });
        saveDataToLocalStorage();
    }

    function recalculateAllElectricityFees() {
        plotData.forEach(plot => {
            if (plot.meterReadingCurr > plot.meterReadingPrev) {
                const usage = plot.meterReadingCurr - plot.meterReadingPrev;
                plot.electricitySum = usage * electricityTariff;
            }
        });
        saveDataToLocalStorage();
    }

    async function loadPlotData() {
        try {
            const storedData = localStorage.getItem('plotData');
            if (storedData) {
                plotData = JSON.parse(storedData);
                if (!Array.isArray(plotData)) {
                    plotData = [];
                }
            } else {
                const response = await fetch('data.json');
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}`);
                }
                const data = await response.json();
                if (!Array.isArray(data)) {
                    throw new Error('Файл data.json имеет неверный формат');
                }
                plotData = data
                .filter(plot => plot.plotNumber && plot.plotNumber.toString().trim() !== '' && plot.payerName)
                .map(plot => ({
                    ...plot,
                    meterReadingCurr: plot.meterReadingCurr !== undefined ? plot.meterReadingCurr : plot.meterReadingPrev,
                    electricitySum: plot.electricitySum !== undefined ? plot.electricitySum : 0,
                    workSum: plot.workSum !== undefined ? plot.workSum : 0,
                    workYear: plot.workYear || '',
                    membershipSum: plot.membershipSum !== undefined && plot.membershipSum !== null
                    ? parseFloat(plot.membershipSum)
                    : ((plot.plotSotkas !== undefined && plot.plotSotkas !== null) ? parseFloat(plot.plotSotkas) * membershipTariff : 0),
                              arrearsSum: plot.arrearsSum !== undefined && plot.arrearsSum !== null ? parseFloat(plot.arrearsSum) : 0,
                              membershipComment: plot.membershipComment || '',
                              targetComment: plot.targetComment || '',
                              workComment: plot.workComment || '',
                              electricityComment: plot.electricityComment || '',
                              arrearsComment: plot.arrearsComment || ''
                }));
                saveDataToLocalStorage();
            }

            if (plotData.length === 0) {
                showNotification('Нет данных для отображения', 'warning');
            }

            plotData.forEach(plot => {
                if (plot.membershipSum !== undefined && plot.membershipSum !== null && membershipTariff > 0) {
                    plot.plotSotkas = plot.membershipSum / membershipTariff;
                } else {
                    plot.plotSotkas = 0;
                }
            });

            renderTable();
        } catch (error) {
            console.error('Ошибка загрузки данных:', error);
            showNotification('Ошибка загрузки данных: ' + error.message, 'error');
            plotData = [];
            renderTable();
        }
    }

    function renderTable() {
        plotDataTableBody.innerHTML = '';
        if (plotData.length === 0) {
            const emptyRow = plotDataTableBody.insertRow();
            const emptyCell = emptyRow.insertCell();
            emptyCell.colSpan = 18;
            emptyCell.textContent = 'Нет данных. Добавьте участок или импортируйте данные.';
            emptyCell.style.textAlign = 'center';
            emptyCell.style.padding = '40px';
            emptyCell.style.color = '#666';
            return;
        }

        plotData.forEach((plot, index) => {
            const row = plotDataTableBody.insertRow();
            row.dataset.index = index;

            const checkboxCell = row.insertCell();
            const checkbox = document.createElement('input');
            checkbox.type = 'checkbox';
            checkbox.className = 'plot-checkbox';
            checkbox.value = index;
            checkboxCell.appendChild(checkbox);
            checkbox.title = "Для массовой печати квитанций";

            const createEditableCell = (field, type = 'text', step = null, min = null, pattern = null) => {
                const cell = row.insertCell();
                const input = document.createElement('input');
                input.type = type;
                input.value = plot[field] !== undefined && plot[field] !== null ? plot[field] : '';
                input.dataset.field = field;
                input.className = 'editable-cell-input';

                if (type === 'number') {
                    if (step !== null) input.step = step;
                    if (min !== null) input.min = min;
                    input.addEventListener('input', function() {
                        this.value = this.value.replace(',', '.');
                        if (this.value === '' || /^-?\d*\.?\d*$/.test(this.value)) {
                            // valid
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
                        mask: '*{1,30}',
                        placeholder: '',
                        greedy: false
                    }).mask(input);
                }

                input.addEventListener('input', () => {
                    const saveBtn = row.querySelector('.save-btn');
                    if (saveBtn) saveBtn.disabled = false;
                });

                    input.addEventListener('blur', () => {
                        saveRow(index);
                    });

                    cell.appendChild(input);
                    return cell;
            };

            const createReadOnlyCell = (value) => {
                const cell = row.insertCell();
                cell.textContent = value !== undefined && value !== null ? value.toFixed(2) : '0.00';
                cell.style.backgroundColor = '#f5f5f5';
                cell.style.color = '#666';
                return cell;
            };

            createEditableCell('plotNumber', 'text', null, null, '.*');
            createEditableCell('payerName');
            createEditableCell('membershipSum', 'number', '0.01', '0');
            createReadOnlyCell(plot.plotSotkas);
            createEditableCell('targetSum', 'number', '0.01', '0');
            createEditableCell('arrearsSum', 'number', '0.01', '0');
            createEditableCell('workSum', 'number', '0.01', '0');
            createEditableCell('workYear', 'number', '1', '2020');
            createReadOnlyCell(plot.meterReadingPrev);
            createEditableCell('meterReadingCurr', 'number', '1', '0');
            createEditableCell('electricitySum', 'number', '0.01', '0');
            createEditableCell('membershipComment', 'text');
            createEditableCell('targetComment', 'text');
            createEditableCell('arrearsComment', 'text');
            createEditableCell('workComment', 'text');
            createEditableCell('electricityComment', 'text');

            const actionsCell = row.insertCell();
            actionsCell.className = 'table-actions';

            const saveBtn = document.createElement('button');
            saveBtn.textContent = '💾';
            saveBtn.className = 'action-btn save-btn';
            saveBtn.title = 'Сохранить изменения';
            saveBtn.disabled = true;
            saveBtn.addEventListener('click', () => saveRow(index));
            actionsCell.appendChild(saveBtn);

            const printBtn = document.createElement('button');
            printBtn.textContent = '🖨️';
            printBtn.className = 'action-btn print-single-btn';
            printBtn.title = 'Напечатать квитанцию';
            printBtn.addEventListener('click', () => printSingleReceipt(index));
            actionsCell.appendChild(printBtn);

            const deleteBtn = document.createElement('button');
            deleteBtn.textContent = '🗑️';
            deleteBtn.className = 'delete-btn';
            deleteBtn.title = 'Удалить участок';
            deleteBtn.addEventListener('click', () => deletePlot(index));
            actionsCell.appendChild(deleteBtn);
        });
    }

    // Функция сохранения строки
    function saveRow(index) {
        const row = plotDataTableBody.rows[index];
        if (!row) {
            console.error('Row not found for index:', index);
            return;
        }

        const plot = plotData[index];
        if (!plot) {
            console.error('Plot data not found for index:', index);
            return;
        }

        let hasChanges = false;
        let isValid = true;
        let errorMessage = '';

        const inputs = row.querySelectorAll('.editable-cell-input');
        for (const input of inputs) {
            const field = input.dataset.field;
            let newValue;

            if (input.type === 'number') {
                newValue = parseFloat(input.value);
                if (isNaN(newValue)) newValue = 0;
            } else {
                newValue = input.value.trim();
                if ((field === 'plotNumber' || field === 'payerName') && newValue === '') {
                    isValid = false;
                    errorMessage = `Поле "${field === 'plotNumber' ? 'Номер участка' : 'ФИО плательщика'}" не может быть пустым`;
                    input.style.borderColor = 'var(--error-color)';
                    input.focus();
                    break;
                } else {
                    input.style.borderColor = '';
                }

                if (field === 'plotNumber' && newValue && !/^\d+[А-Яа-я]?$/.test(newValue) && !/^[А-Яа-я\s]+$/i.test(newValue)) {
                    showNotification('Номер участка в нестандартном формате', 'warning');
                }
            }

            if (plot[field] !== newValue) {
                plot[field] = newValue;
                hasChanges = true;
            }
        }

        if (!isValid) {
            showNotification(errorMessage, 'error');
            return;
        }

        // Пересчитываем plotSotkas на основе membershipSum
        if (membershipTariff > 0 && plot.membershipSum > 0) {
            const newPlotSotkas = plot.membershipSum / membershipTariff;
            if (Math.abs(plot.plotSotkas - newPlotSotkas) > 0.01) {
                plot.plotSotkas = newPlotSotkas;
                hasChanges = true;
            }
        } else if (plot.membershipSum === 0 && plot.plotSotkas !== 0) {
            plot.plotSotkas = 0;
            hasChanges = true;
        }

        // Пересчитываем electricitySum если изменились показания
        if (plot.meterReadingCurr > plot.meterReadingPrev && electricityTariff > 0) {
            const calculatedElectricity = (plot.meterReadingCurr - plot.meterReadingPrev) * electricityTariff;
            if (Math.abs(plot.electricitySum - calculatedElectricity) > 0.01) {
                plot.electricitySum = calculatedElectricity;
                hasChanges = true;
            }
        }

        if (hasChanges) {
            saveDataToLocalStorage();
            updateReadOnlyCells(row, plot);

            const saveBtn = row.querySelector('.save-btn');
            if (saveBtn) saveBtn.disabled = true;

            showNotification('Данные сохранены', 'success');
        } else {
            const saveBtn = row.querySelector('.save-btn');
            if (saveBtn) saveBtn.disabled = true;
        }
    }

    // Обновление read-only ячеек
    function updateReadOnlyCells(row, plot) {
        const cells = row.cells;
        // plotSotkas - колонка 4 (индекс 4: 0-чекбокс, 1-plotNumber, 2-payerName, 3-membershipSum, 4-plotSotkas)
        if (cells[4]) {
            cells[4].textContent = plot.plotSotkas ? plot.plotSotkas.toFixed(2) : '0.00';
        }
        // meterReadingPrev - колонка 11 (индекс 11)
        if (cells[11]) {
            cells[11].textContent = plot.meterReadingPrev ? plot.meterReadingPrev.toFixed(2) : '0.00';
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
        if (typeof DataSync !== 'undefined' && DataSync.savePlotData) {
            DataSync.savePlotData(plotData);
        }
    }

    function exportData() {
        try {
            if (plotData.length === 0) {
                showNotification('Нет данных для экспорта', 'warning');
                return;
            }

            const excelData = plotData.map(plot => ({
                'Номер участка': plot.plotNumber || '',
                'ФИО плательщика': plot.payerName || '',
                'Членские взносы (руб.)': plot.membershipSum || 0,
                                                    'Размер участка (соток)': plot.plotSotkas || 0,
                                                    'Целевые взносы (руб.)': plot.targetSum || 0,
                                                    'Задолженность прошлых лет (руб.)': plot.arrearsSum || 0,
                                                    'Отработка (руб.)': plot.workSum || 0,
                                                    'Год отработки': plot.workYear || '',
                                                    'Предыдущие показания (кВт)': plot.meterReadingPrev || 0,
                                                    'Текущие показания (кВт)': plot.meterReadingCurr || 0,
                                                    'Сумма электроэнергии (руб.)': plot.electricitySum || 0,
                                                    'Комментарий к членским взносам': plot.membershipComment || '',
                                                    'Комментарий к целевым взносам': plot.targetComment || '',
                                                    'Комментарий к задолженности': plot.arrearsComment || '',
                                                    'Комментарий к отработке': plot.workComment || '',
                                                    'Комментарий к электроэнергии': plot.electricityComment || ''
            }));

            const workbook = XLSX.utils.book_new();
            const worksheet = XLSX.utils.json_to_sheet(excelData);
            const columnWidths = [
                { wch: 15 }, { wch: 30 }, { wch: 25 }, { wch: 20 },
                { wch: 20 }, { wch: 30 }, { wch: 20 }, { wch: 15 },
                { wch: 25 }, { wch: 25 }, { wch: 25 }, { wch: 30 },
                { wch: 30 }, { wch: 30 }, { wch: 30 }, { wch: 30 }
            ];
            worksheet['!cols'] = columnWidths;
            XLSX.utils.book_append_sheet(workbook, worksheet, 'Участки СНТ');

            const date = new Date().toISOString().split('T')[0];
            const filename = `snt_berezka_2_uchastki_${date}.xlsx`;
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

        const importBtn = document.getElementById('importDataBtn');
        const originalText = importBtn.textContent;
        importBtn.disabled = true;
        importBtn.textContent = '⏳ Импорт...';

        const reader = new FileReader();
        reader.onload = function(e) {
            try {
                const data = new Uint8Array(e.target.result);
                const workbook = XLSX.read(data, { type: 'array' });
                const firstSheetName = workbook.SheetNames[0];
                const worksheet = workbook.Sheets[firstSheetName];
                const jsonData = XLSX.utils.sheet_to_json(worksheet);

                if (!jsonData || jsonData.length === 0) {
                    throw new Error('Файл не содержит данных');
                }

                const importedData = jsonData.map(row => {
                    const importedPlot = {
                        plotNumber: String(row['Номер участка'] || row['plotNumber'] || '').trim(),
                                                  payerName: String(row['ФИО плательщика'] || row['payerName'] || '').trim(),
                                                  membershipSum: parseFloat(row['Членские взносы (руб.)'] || row['membershipSum'] || 0),
                                                  targetSum: parseFloat(row['Целевые взносы (руб.)'] || row['targetSum'] || 0),
                                                  arrearsSum: parseFloat(row['Задолженность прошлых лет (руб.)'] || row['arrearsSum'] || 0),
                                                  workSum: parseFloat(row['Отработка (руб.)'] || row['workSum'] || 0),
                                                  workYear: String(row['Год отработки'] || row['workYear'] || '').trim(),
                                                  meterReadingPrev: parseFloat(row['Предыдущие показания (кВт)'] || row['meterReadingPrev'] || 0),
                                                  meterReadingCurr: parseFloat(row['Текущие показания (кВт)'] || row['meterReadingCurr'] || 0),
                                                  electricitySum: parseFloat(row['Сумма электроэнергии (руб.)'] || row['electricitySum'] || 0),
                                                  membershipComment: String(row['Комментарий к членским взносам'] || row['membershipComment'] || '').trim(),
                                                  targetComment: String(row['Комментарий к целевым взносам'] || row['targetComment'] || '').trim(),
                                                  arrearsComment: String(row['Комментарий к задолженности'] || row['arrearsComment'] || '').trim(),
                                                  workComment: String(row['Комментарий к отработке'] || row['workComment'] || '').trim(),
                                                  electricityComment: String(row['Комментарий к электроэнергии'] || row['electricityComment'] || '').trim()
                    };

                    if (membershipTariff > 0) {
                        importedPlot.plotSotkas = importedPlot.membershipSum / membershipTariff;
                    } else {
                        importedPlot.plotSotkas = 0;
                    }

                    return importedPlot;
                }).filter(plot => plot.plotNumber && plot.payerName);

                if (importedData.length === 0) {
                    throw new Error('В файле не найдено валидных записей с номером участка и ФИО');
                }

                if (confirm(`Найдено ${importedData.length} записей. Это заменит все существующие данные. Продолжить?`)) {
                    plotData = importedData;
                    saveDataToLocalStorage();
                    renderTable();
                    updateAllDerivedFields();
                    showNotification(`Импортировано ${importedData.length} записей`, 'success');
                }
            } catch (error) {
                showNotification('Ошибка импорта: ' + error.message, 'error');
            } finally {
                importBtn.disabled = false;
                importBtn.textContent = originalText;
            }
        };
        reader.onerror = function() {
            showNotification('Ошибка чтения файла', 'error');
            importBtn.disabled = false;
            importBtn.textContent = originalText;
        };
        reader.readAsArrayBuffer(file);
        e.target.value = '';
    }

    function updateAllDerivedFields() {
        plotData.forEach(plot => {
            if (membershipTariff > 0 && plot.membershipSum > 0) {
                plot.plotSotkas = plot.membershipSum / membershipTariff;
            }
            if (plot.meterReadingCurr > plot.meterReadingPrev && electricityTariff > 0) {
                const calculatedSum = (plot.meterReadingCurr - plot.meterReadingPrev) * electricityTariff;
                if (!plot.electricitySum || plot.electricitySum === 0) {
                    plot.electricitySum = calculatedSum;
                }
            }
        });
        saveDataToLocalStorage();
    }

    function toggleSelectAllPlots() {
        const selectAll = document.getElementById('selectAllPlots');
        const checkboxes = plotDataTableBody.querySelectorAll('.plot-checkbox');
        checkboxes.forEach(cb => cb.checked = selectAll.checked);
    }

    function toggleSelectAllPlotsModal() {
        const selectAllModal = document.getElementById('selectAllPlotsCheckboxModal');
        const checkboxes = document.querySelectorAll('#plotCheckboxList .plot-checkbox-modal');
        checkboxes.forEach(cb => cb.checked = selectAllModal.checked);
    }

    function getSelectedIndices() {
        const selectedIndices = [];
        const checkboxes = document.querySelectorAll('#plotCheckboxList .plot-checkbox-modal:checked');
        checkboxes.forEach(cb => {
            selectedIndices.push(parseInt(cb.value));
        });
        return selectedIndices;
    }

    function openMassReceiptSelectionModal() {
        const plotCheckboxList = document.getElementById('plotCheckboxList');
        plotCheckboxList.innerHTML = '';

        if (plotData.length === 0) {
            plotCheckboxList.innerHTML = '<p style="text-align:center; color:#666;">Нет данных для печати</p>';
            massReceiptModal.style.display = 'block';
            return;
        }

        const tableCheckboxes = plotDataTableBody.querySelectorAll('.plot-checkbox');

        plotData.forEach((plot, index) => {
            const label = document.createElement('label');
            label.className = 'checkbox-label';

            let isChecked = false;
            if (tableCheckboxes[index]) {
                isChecked = tableCheckboxes[index].checked;
            }
            label.innerHTML = `
            <input type="checkbox" class="plot-checkbox-modal" value="${index}" ${isChecked ? 'checked' : ''}>
            Участок № ${plot.plotNumber} - ${plot.payerName}
            `;
            plotCheckboxList.appendChild(label);
        });

        massReceiptModal.style.display = 'block';
    }

    async function generateMassReceipts() {
        const selectedIndices = getSelectedIndices();
        if (selectedIndices.length === 0) {
            showNotification('Выберите хотя бы один участок', 'error');
            return;
        }

        const modal = document.getElementById('massReceiptPrintModal');
        const contentWrapper = document.getElementById('massReceiptContent');
        contentWrapper.innerHTML = '<div class="progress-container"><div class="progress-bar"></div><p>Генерация квитанций...</p></div>';

        const receipts = [];
        const total = selectedIndices.length;

        for (let i = 0; i < total; i++) {
            const index = selectedIndices[i];
            const plot = plotData[index];

            const percent = ((i + 1) / total * 100).toFixed(0);
            const progressBar = document.querySelector('.progress-bar');
            if (progressBar) {
                progressBar.style.width = `${percent}%`;
                progressBar.textContent = `${percent}%`;
            }

            await new Promise(resolve => setTimeout(resolve, 10));
            const html = await generateReceiptHtml(plot, true);
            receipts.push(`<div class="mass-receipt-item">${html}</div>`);
        }

        contentWrapper.innerHTML = receipts.join('');
        massReceiptModal.style.display = 'none';
        modal.style.display = 'block';
    }

    async function printSingleReceipt(index) {
        const plot = plotData[index];
        if (!plot || !plot.plotNumber || !plot.payerName) {
            showNotification('Данные для этого участка неполные.', 'error');
            return;
        }

        const receiptContent = document.getElementById('singleReceiptContent');
        receiptContent.innerHTML = '<div style="text-align:center; padding:40px;">Генерация квитанции...</div>';
        const html = await generateReceiptHtml(plot, true);
        receiptContent.innerHTML = html;
        singleReceiptModal.style.display = 'block';
    }

    async function generateReceiptHtml(plot, includeQr) {
        const formData = {
            plotNumber: plot.plotNumber,
            payerName: plot.payerName,
            paymentTypes: [],
            totalAmount: 0,
            membershipSum: 0,
            targetSum: 0,
            arrearsSum: 0,
            workSum: 0,
            workYear: plot.workYear || '',
            electricitySum: 0,
            meterReadingPrev: plot.meterReadingPrev || 0,
            meterReadingCurr: plot.meterReadingCurr || 0,
            membershipComment: plot.membershipComment || '',
            targetComment: plot.targetComment || '',
            arrearsComment: plot.arrearsComment || '',
            workComment: plot.workComment || '',
            electricityComment: plot.electricityComment || ''
        };

        if (plot.membershipSum > 0) {
            formData.membershipSum = plot.membershipSum;
            formData.paymentTypes.push('Членские взносы');
            formData.totalAmount += formData.membershipSum;
        }
        if (plot.targetSum > 0) {
            formData.targetSum = plot.targetSum;
            formData.paymentTypes.push('Целевые взносы');
            formData.totalAmount += formData.targetSum;
        }
        if (plot.arrearsSum > 0) {
            formData.arrearsSum = plot.arrearsSum;
            formData.paymentTypes.push('Задолженность прошлых лет');
            formData.totalAmount += formData.arrearsSum;
        }
        if (plot.workSum > 0) {
            formData.workSum = plot.workSum;
            formData.workYear = plot.workYear || '';
            formData.paymentTypes.push('Отработка');
            formData.totalAmount += formData.workSum;
        }
        if (plot.electricitySum > 0) {
            formData.electricitySum = plot.electricitySum;
            formData.paymentTypes.push('Электроэнергия');
            formData.totalAmount += formData.electricitySum;
        } else if (formData.meterReadingCurr > formData.meterReadingPrev) {
            const usage = formData.meterReadingCurr - formData.meterReadingPrev;
            formData.electricitySum = usage * electricityTariff;
            formData.paymentTypes.push('Электроэнергия');
            formData.totalAmount += formData.electricitySum;
        }

        if (formData.totalAmount === 0) {
            return '<div style="text-align:center; padding:20px; color:#666;">Нет сумм для оплаты</div>';
        }

        const today = new Date();
        const formattedDate = today.toLocaleDateString('ru-RU');
        const amountInWords = numberToWords(formData.totalAmount);

        let qrCodeDataURL = null;
        if (includeQr) {
            qrCodeDataURL = await generateQrCodeDataURLForReceipt(formData);
        }

        return `
        ${createReceiptPart('Извещение', formData, amountInWords, formattedDate, qrCodeDataURL)}
        <div class="receipt-tear-line"></div>
        ${createReceiptPart('Квитанция', formData, amountInWords, formattedDate, null)}
        `;
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

    window.deletePlot = deletePlot;
    window.closeMassReceiptModal = () => massReceiptModal.style.display = 'none';
    window.closeMassReceiptPrintModal = () => massReceiptPrintModal.style.display = 'none';
    window.closeSingleReceiptModal = () => singleReceiptModal.style.display = 'none';

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
            purposeParts.push(`Членские взносы: ${formData.membershipSum.toFixed(2)} руб.${formData.membershipComment ? ` (${formData.membershipComment})` : ''}`);
        }
        if (formData.targetSum > 0) {
            purposeParts.push(`Целевые взносы: ${formData.targetSum.toFixed(2)} руб.${formData.targetComment ? ` (${formData.targetComment})` : ''}`);
        }
        if (formData.arrearsSum > 0) {
            purposeParts.push(`Задолженность прошлых лет: ${formData.arrearsSum.toFixed(2)} руб.${formData.arrearsComment ? ` (${formData.arrearsComment})` : ''}`);
        }
        if (formData.workSum > 0) {
            purposeParts.push(`Отработка: ${formData.workSum.toFixed(2)} руб. за ${formData.workYear} год${formData.workComment ? ` (${formData.workComment})` : ''}`);
        }
        if (formData.electricitySum > 0) {
            let kwhForPurpose = 0;
            if (formData.meterReadingCurr > formData.meterReadingPrev) {
                kwhForPurpose = formData.meterReadingCurr - formData.meterReadingPrev;
            } else if (electricityTariff > 0 && formData.electricitySum > 0) {
                kwhForPurpose = formData.electricitySum / electricityTariff;
            }
            purposeParts.push(`Электроэнергия: ${formData.electricitySum.toFixed(2)} руб. ${kwhForPurpose > 0 ? `(${Math.round(kwhForPurpose)} кВт)` : ''}${formData.electricityComment ? ` (${formData.electricityComment})` : ''}`);
        }

        const purposeString = purposeParts.join(', ') + ` за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;
        const finalPurposeString = purposeString.length > 150 ? purposeString.substring(0, 150) : purposeString;

        const paymentString = `ST00012|Name=${REQUISITES.Name}|PersonalAcc=${REQUISITES.PersonalAcc}|BankName=${REQUISITES.BankName}|BIC=${REQUISITES.BIC}|CorrespAcc=${REQUISITES.CorrespAcc}|PayeeINN=${REQUISITES.PayeeINN}|KPP=${REQUISITES.KPP}|Sum=${totalAmountKopecks}|Purpose=${finalPurposeString}`;

        try {
            return await QRCode.toDataURL(paymentString, { width: 450, errorCorrectionLevel: 'H', margin: 1 });
        } catch (error) {
            console.error('Error generating QR code:', error);
            return null;
        }
    }

    function createReceiptPart(title, data, amountInWords, formattedDate, qrCodeDataURL = null) {
        const purpose = data.paymentTypes.join(', ');

        let paymentDetails = [];
        if (data.membershipSum > 0) {
            paymentDetails.push(`Членские взносы: ${data.membershipSum.toFixed(2)} руб.${data.membershipComment ? ` (${data.membershipComment})` : ''}`);
        }
        if (data.targetSum > 0) {
            paymentDetails.push(`Целевые взносы: ${data.targetSum.toFixed(2)} руб.${data.targetComment ? ` (${data.targetComment})` : ''}`);
        }
        if (data.arrearsSum > 0) {
            paymentDetails.push(`Задолженность прошлых лет: ${data.arrearsSum.toFixed(2)} руб.${data.arrearsComment ? ` (${data.arrearsComment})` : ''}`);
        }
        if (data.workSum > 0) {
            paymentDetails.push(`Отработка: ${data.workSum.toFixed(2)} руб. за ${data.workYear} год${data.workComment ? ` (${data.workComment})` : ''}`);
        }
        if (data.electricitySum > 0) {
            let kwhForPurpose = 0;
            if (data.meterReadingCurr > data.meterReadingPrev) {
                kwhForPurpose = data.meterReadingCurr - data.meterReadingPrev;
            } else if (electricityTariff > 0 && data.electricitySum > 0) {
                kwhForPurpose = data.electricitySum / electricityTariff;
            }
            paymentDetails.push(`Электроэнергия: ${data.electricitySum.toFixed(2)} руб. ${kwhForPurpose > 0 ? `(${Math.round(kwhForPurpose)} кВт)` : ''}${data.electricityComment ? ` (${data.electricityComment})` : ''}`);
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

    // ИСПРАВЛЕННАЯ функция numberToWords - опечатка "вадцать" исправлена на "двадцать"
    function numberToWords(num) {
        const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
        const unitsFemale = ['', 'одна', 'две', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
        const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
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
                switch (thousands % 10) {
                    case 1: result += 'тысяча '; break;
                    case 2: case 3: case 4: result += 'тысячи '; break;
                    default: result += 'тысяч ';
                }
            }
        }

        if (rubles > 0 || (rubles === 0 && result === '')) {
            result += convertLessThanOneThousand(rubles, false) + ' ';
        }

        if (rubles % 100 >= 11 && rubles % 100 <= 19) {
            result += 'рублей';
        } else {
            switch (rubles % 10) {
                case 1: result += 'рубль'; break;
                case 2: case 3: case 4: result += 'рубля'; break;
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

        let bgColor = '#2196F3';
        if (type === 'error') bgColor = '#f44336';
        else if (type === 'success') bgColor = '#4CAF50';
        else if (type === 'warning') bgColor = '#ff9800';

        toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        padding: 12px 24px;
        background: ${bgColor};
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

    function addNewPlotRow() {
        const hasEmptyRow = plotData.some(plot => !plot.plotNumber && !plot.payerName);
        if (hasEmptyRow) {
            showNotification('Сначала заполните или удалите существующую пустую строку', 'warning');
            return;
        }

        const newPlot = {
            plotNumber: '',
            payerName: '',
            plotSotkas: 0,
            targetSum: 0,
            arrearsSum: 0,
            meterReadingPrev: 0,
            meterReadingCurr: 0,
            electricitySum: 0,
            workSum: 0,
            workYear: '',
            membershipSum: 0,
            membershipComment: '',
            targetComment: '',
            arrearsComment: '',
            workComment: '',
            electricityComment: ''
        };

        plotData.unshift(newPlot);
        renderTable();

        const firstInput = plotDataTableBody.rows[0]?.querySelector('input.editable-cell-input');
        if (firstInput) {
            firstInput.focus();
        }

        showNotification('Новая строка добавлена. Заполните данные и сохраните.', 'info');
    }
});
