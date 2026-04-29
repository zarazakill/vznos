document.addEventListener('DOMContentLoaded', function() {
    let electricityTariff = 3.82; // Default value, will be updated from localStorage
    let membershipTariff = 1450; // Default value, will be updated from localStorage

    // Function to load settings from localStorage
    function loadSettings() {
        const savedElectricityTariff = localStorage.getItem('electricityTariff');
        if (savedElectricityTariff) {
            electricityTariff = parseFloat(savedElectricityTariff);
        }
        const electricityLabelSpan = document.querySelector('#electricityFeeLabel span');
        if (electricityLabelSpan) {
            electricityLabelSpan.textContent = `Электроэнергия (${electricityTariff.toFixed(2)} руб/кВт·ч)`;
        }

        const savedMembershipTariff = localStorage.getItem('membershipTariff');
        if (savedMembershipTariff) {
            membershipTariff = parseFloat(savedMembershipTariff);
        }
        const membershipLabelSpan = document.querySelector('#membershipFeeLabel span');
        if (membershipLabelSpan) {
            membershipLabelSpan.textContent = `Членские взносы (${membershipTariff.toFixed(2)} руб/сотка)`;
        }
    }

    loadSettings();

    function updateTariffDisplay() {
        const membershipLabelSpan = document.querySelector('#membershipFeeLabel span');
        if (membershipLabelSpan) {
            membershipLabelSpan.textContent = `Членские взносы (${membershipTariff.toFixed(2)} руб/сотка)`;
        }
        const electricityLabelSpan = document.querySelector('#electricityFeeLabel span');
        if (electricityLabelSpan) {
            electricityLabelSpan.textContent = `Электроэнергия (${electricityTariff.toFixed(2)} руб/кВт·ч)`;
        }
    }

    // Слушать изменения тарифов в localStorage
    window.addEventListener('storage', function(e) {
        if (e.key === 'membershipTariff' && e.newValue) {
            membershipTariff = parseFloat(e.newValue);
            updateTariffDisplay();
            if (plotSotkasInput && plotSotkasInput.value && membershipCheck.checked) {
                const sotkas = parseFloat(plotSotkasInput.value);
                if (!isNaN(sotkas) && sotkas > 0) {
                    membershipSumInput.value = (sotkas * membershipTariff).toFixed(2);
                } else if (membershipSumInput.value && parseFloat(membershipSumInput.value) > 0) {
                    plotSotkasInput.value = (parseFloat(membershipSumInput.value) / membershipTariff).toFixed(2);
                }
                calculateTotal();
            }
        }
        if (e.key === 'electricityTariff' && e.newValue) {
            electricityTariff = parseFloat(e.newValue);
            updateTariffDisplay();
            if (meterReadingCurrInput.value && meterReadingPrevInput.value && electricityCheck.checked) {
                updateElectricityFields();
            } else if (electricitySumInput.value && parseFloat(electricitySumInput.value) > 0 && electricityCheck.checked) {
                const prev = parseFloat(meterReadingPrevInput.value) || 0;
                const sum = parseFloat(electricitySumInput.value);
                const kwh = sum / electricityTariff;
                meterReadingCurrInput.value = Math.round(prev + kwh);
                kwhUsedElement.textContent = Math.round(kwh);
                calculateTotal();
            }
        }
    });

    // Constants for element IDs
    const ELEM_PAYER_NAME = 'payerName';
    const ELEM_PLOT_NUMBER = 'plotNumber';
    const ELEM_MEMBERSHIP_CHECK = 'membershipCheck';
    const ELEM_TARGET_CHECK = 'targetCheck';
    const ELEM_ARREARS_CHECK = 'arrearsCheck';
    const ELEM_ELECTRICITY_CHECK = 'electricityCheck';
    const ELEM_WORK_CHECK = 'workCheck';
    const ELEM_PLOT_SOTKAS = 'plotSotkas';
    const ELEM_MEMBERSHIP_SUM = 'membershipSum';
    const ELEM_TARGET_SUM = 'targetSum';
    const ELEM_ARREARS_SUM = 'arrearsSum';
    const ELEM_WORK_SUM = 'workSum';
    const ELEM_WORK_YEAR = 'workYear';
    const ELEM_METER_PREV = 'meterReadingPrev';
    const ELEM_METER_CURR = 'meterReadingCurr';
    const ELEM_KWH_USED = 'kwhUsed';
    const ELEM_ELECTRICITY_SUM_INPUT = 'electricitySumInput';
    const ELEM_TOTAL_AMOUNT = 'totalAmount';
    const ELEM_PURPOSE_CHAR_COUNT = 'purposeCharCount';
    const ELEM_RECEIPT_MODAL = 'receiptModal';
    const ELEM_RECEIPT_CONTENT = 'receiptContent';
    const ELEM_PRINT_BTN = 'printBtn';

    // Elements for 2-step flow
    const plotSelectionContainer = document.getElementById('plot-selection-container');
    const ownerSelectionContainer = document.getElementById('owner-selection-container');
    const ownerListDiv = document.getElementById('owner-list');
    const mainContentWrapper = document.getElementById('main-content-wrapper');
    const findPlotBtn = document.getElementById('findPlotBtn');
    const plotNumberInputInitial = document.getElementById('plotNumberInput');

    // Elements for form
    const paymentForm = document.getElementById('paymentForm');
    const membershipCheck = document.getElementById(ELEM_MEMBERSHIP_CHECK);
    const targetCheck = document.getElementById(ELEM_TARGET_CHECK);
    const arrearsCheck = document.getElementById(ELEM_ARREARS_CHECK);
    const electricityCheck = document.getElementById(ELEM_ELECTRICITY_CHECK);
    const workCheck = document.getElementById(ELEM_WORK_CHECK);
    const membershipAmountDiv = document.getElementById('membershipAmount');
    const targetAmountDiv = document.getElementById('targetAmount');
    const arrearsAmountDiv = document.getElementById('arrearsAmount');
    const electricityInputsDiv = document.getElementById('electricityInputs');
    const workAmountDiv = document.getElementById('workAmount');
    const totalAmountElement = document.getElementById(ELEM_TOTAL_AMOUNT);
    const purposeCharCountElement = document.getElementById(ELEM_PURPOSE_CHAR_COUNT);
    const modal = document.getElementById(ELEM_RECEIPT_MODAL);
    const closeModalBtn = document.querySelector('.close-modal');
    const printBtn = document.getElementById(ELEM_PRINT_BTN);
    const qrCanvas = document.getElementById('qrCanvas');
    const downloadQrBtn = document.getElementById('downloadQrBtn');

    // Specific input fields
    const plotSotkasInput = document.getElementById(ELEM_PLOT_SOTKAS);
    const membershipSumInput = document.getElementById(ELEM_MEMBERSHIP_SUM);
    const targetSumInput = document.getElementById(ELEM_TARGET_SUM);
    const arrearsSumInput = document.getElementById(ELEM_ARREARS_SUM);
    const workSumInput = document.getElementById(ELEM_WORK_SUM);
    const workYearInput = document.getElementById(ELEM_WORK_YEAR);
    const meterReadingPrevInput = document.getElementById(ELEM_METER_PREV);
    const meterReadingCurrInput = document.getElementById(ELEM_METER_CURR);
    const kwhUsedElement = document.getElementById(ELEM_KWH_USED);
    const electricitySumInput = document.getElementById(ELEM_ELECTRICITY_SUM_INPUT);
    const plotNumberInput = document.getElementById(ELEM_PLOT_NUMBER);
    const payerNameInput = document.getElementById(ELEM_PAYER_NAME);

    // Comment input fields
    const membershipCommentInput = document.getElementById('membershipComment');
    const targetCommentInput = document.getElementById('targetComment');
    const arrearsCommentInput = document.getElementById('arrearsComment');
    const electricityCommentInput = document.getElementById('electricityComment');
    const workCommentInput = document.getElementById('workComment');

    // Data for plot number autofill
    let plotData = [];

    // Static Requisites for QR code generation
    const REQUISITES = {
        Name: 'СНТ «Березка-2»',
        PayeeINN: '5433118499',
        KPP: '543301001',
        BankName: 'Сибирский Банк ПАО Сбербанк',
        PersonalAcc: '40703810644050040322',
        BIC: '045004641',
        CorrespAcc: '30101810500000000641'
    };

    // Apply Inputmask if available - используем гибкую маску
    if (typeof Inputmask !== 'undefined') {
        Inputmask({
            mask: '*{1,30}',
            placeholder: '',
            greedy: false
        }).mask(plotNumberInputInitial);
    }

    // Toggles visibility of an element based on checkbox state
    const toggleVisibility = (check, element) => {
        if (element) element.style.display = check.checked ? 'block' : 'none';
    };

        // Calculate plot size based on membership fee
        function updateSotkasFromMembershipSum() {
            if (!membershipCheck.checked) {
                plotSotkasInput.value = '';
                calculateTotal();
                return;
            }
            const membershipSum = parseFloat(membershipSumInput.value) || 0;
            if (membershipTariff > 0) {
                const sotkas = membershipSum / membershipTariff;
                plotSotkasInput.value = sotkas.toFixed(2);
            } else {
                plotSotkasInput.value = '0.00';
            }
            calculateTotal();
        }

        // Function to update the character counter for the QR purpose string
        function updatePurposeStringCounter() {
            if (!purposeCharCountElement) return;

            const plotNumber = plotNumberInput.value.trim();
            const payerName = payerNameInput.value.trim();
            const kwhUsed = parseFloat(kwhUsedElement.textContent) || 0;

            let purposeParts = [];
            if (membershipCheck.checked) {
                const membershipSum = parseFloat(membershipSumInput.value) || 0;
                const membershipComment = membershipCommentInput.value.trim();
                if (membershipSum > 0) {
                    purposeParts.push(`Членские взносы: ${membershipSum.toFixed(2)} руб.${membershipComment ? ` (${membershipComment})` : ''}`);
                }
            }
            if (targetCheck.checked) {
                const targetSum = parseFloat(targetSumInput.value) || 0;
                const targetComment = targetCommentInput.value.trim();
                if (targetSum > 0) {
                    purposeParts.push(`Целевые взносы: ${targetSum.toFixed(2)} руб.${targetComment ? ` (${targetComment})` : ''}`);
                }
            }
            if (arrearsCheck.checked) {
                const arrearsSum = parseFloat(arrearsSumInput.value) || 0;
                const arrearsComment = arrearsCommentInput.value.trim();
                if (arrearsSum > 0) {
                    purposeParts.push(`Задолженность прошлых лет: ${arrearsSum.toFixed(2)} руб.${arrearsComment ? ` (${arrearsComment})` : ''}`);
                }
            }
            if (workCheck.checked) {
                const workSum = parseFloat(workSumInput.value) || 0;
                const workYear = workYearInput.value.trim();
                const workComment = workCommentInput.value.trim();
                if (workSum > 0) {
                    purposeParts.push(`Отработка: ${workSum.toFixed(2)} руб. за ${workYear} год${workComment ? ` (${workComment})` : ''}`);
                }
            }
            if (electricityCheck.checked) {
                const electricitySum = parseFloat(electricitySumInput.value) || 0;
                const electricityComment = electricityCommentInput.value.trim();
                if (electricitySum > 0) {
                    purposeParts.push(`Электроэнергия: ${electricitySum.toFixed(2)} руб. (${kwhUsed} кВт)${electricityComment ? ` (${electricityComment})` : ''}`);
                }
            }

            let purposeString = purposeParts.join(', ') + ` за участок № ${plotNumber}, ФИО: ${payerName}`;
            const currentLength = purposeString.length;
            purposeCharCountElement.textContent = `${currentLength} / 150 символов`;
            purposeCharCountElement.style.color = currentLength > 150 ? 'var(--error-color)' : 'var(--text-color)';
        }

        // Electricity calculation logic
        function updateElectricityFields() {
            if (!electricityCheck.checked) {
                meterReadingCurrInput.value = '';
                electricitySumInput.value = '';
                kwhUsedElement.textContent = '0';
                meterReadingCurrInput.readOnly = false;
                electricitySumInput.readOnly = false;
                calculateTotal();
                return;
            }

            const prev = parseFloat(meterReadingPrevInput.value) || 0;
            const curr = parseFloat(meterReadingCurrInput.value);
            const manualSum = parseFloat(electricitySumInput.value);

            let kwh = 0;
            let sum = 0;
            const isCurrValid = !isNaN(curr) && curr >= 0;
            const isSumValid = !isNaN(manualSum) && manualSum >= 0;

            if (document.activeElement === meterReadingCurrInput && isCurrValid) {
                if (isCurrValid && curr >= prev) {
                    kwh = curr - prev;
                    sum = kwh * electricityTariff;
                    electricitySumInput.value = sum.toFixed(2);
                    electricitySumInput.readOnly = true;
                } else {
                    electricitySumInput.value = '';
                    electricitySumInput.readOnly = false;
                    kwh = 0;
                }
            } else if (document.activeElement === electricitySumInput && isSumValid) {
                sum = manualSum;
                if (electricityTariff > 0) {
                    kwh = sum / electricityTariff;
                }
                meterReadingCurrInput.value = Math.round(prev + kwh);
                meterReadingCurrInput.readOnly = true;
            } else if (isCurrValid && curr >= prev) {
                kwh = curr - prev;
                sum = kwh * electricityTariff;
                electricitySumInput.value = sum.toFixed(2);
                electricitySumInput.readOnly = true;
                meterReadingCurrInput.readOnly = false;
            } else if (isSumValid) {
                sum = manualSum;
                if (electricityTariff > 0) {
                    kwh = sum / electricityTariff;
                }
                meterReadingCurrInput.value = Math.round(prev + kwh);
                meterReadingCurrInput.readOnly = true;
                electricitySumInput.readOnly = false;
            } else {
                meterReadingCurrInput.value = '';
                electricitySumInput.value = '';
                meterReadingCurrInput.readOnly = false;
                electricitySumInput.readOnly = false;
                kwh = 0;
                sum = 0;
            }

            kwhUsedElement.textContent = Math.round(kwh);
            calculateTotal();
        }

        // Function to calculate total sum
        function calculateTotal() {
            let total = 0;
            if (membershipCheck.checked) total += parseFloat(membershipSumInput.value) || 0;
            if (targetCheck.checked) total += parseFloat(targetSumInput.value) || 0;
            if (arrearsCheck.checked) total += parseFloat(arrearsSumInput.value) || 0;
            if (workCheck.checked) total += parseFloat(workSumInput.value) || 0;
            if (electricityCheck.checked) total += parseFloat(electricitySumInput.value) || 0;
            totalAmountElement.textContent = total.toFixed(2) + ' руб.';
            updatePurposeStringCounter();
        }

        // Initial setup
        const initFormState = () => {
            toggleVisibility(membershipCheck, membershipAmountDiv);
            toggleVisibility(targetCheck, targetAmountDiv);
            toggleVisibility(arrearsCheck, arrearsAmountDiv);
            toggleVisibility(workCheck, workAmountDiv);
            initElectricityInputs();
            calculateTotal();
        };

        function initElectricityInputs() {
            toggleVisibility(electricityCheck, electricityInputsDiv);
            updateElectricityFields();
        }

        // Handle owner selection
        ownerListDiv.addEventListener('click', function(e) {
            if (e.target.classList.contains('owner-selection-btn')) {
                const selectedIndex = parseInt(e.target.dataset.index);
                const selectedPlot = plotData[selectedIndex];
                plotNumberInput.value = selectedPlot.plotNumber.toUpperCase();
                autofillWithPlotObject(selectedPlot);
                plotSelectionContainer.style.display = 'none';
                ownerSelectionContainer.style.display = 'none';
                mainContentWrapper.style.display = 'block';
            }
        });

        // Function to autofill form with a specific plot object
        function autofillWithPlotObject(foundPlot) {
            if (foundPlot) {
                payerNameInput.value = foundPlot.payerName || '';

                const membershipValue = foundPlot.membershipSum !== undefined && foundPlot.membershipSum !== null
                ? foundPlot.membershipSum
                : ((foundPlot.plotSotkas !== undefined && foundPlot.plotSotkas !== null && foundPlot.plotSotkas > 0)
                ? (foundPlot.plotSotkas * membershipTariff)
                : 0);
                membershipSumInput.value = membershipValue > 0 ? membershipValue.toFixed(2) : '';
                plotSotkasInput.value = (foundPlot.plotSotkas !== undefined && foundPlot.plotSotkas !== null) ? foundPlot.plotSotkas.toFixed(2) : '';
                targetSumInput.value = (foundPlot.targetSum !== undefined && foundPlot.targetSum > 0) ? foundPlot.targetSum.toFixed(2) : '';
                arrearsSumInput.value = (foundPlot.arrearsSum !== undefined && foundPlot.arrearsSum > 0) ? parseFloat(foundPlot.arrearsSum).toFixed(2) : '';
                workSumInput.value = (foundPlot.workSum !== undefined && foundPlot.workSum > 0) ? foundPlot.workSum.toFixed(2) : '';
                workYearInput.value = foundPlot.workYear || '';
                meterReadingPrevInput.value = (foundPlot.meterReadingPrev !== undefined && foundPlot.meterReadingPrev !== null) ? foundPlot.meterReadingPrev : '';
                meterReadingCurrInput.value = '';
                electricitySumInput.value = (foundPlot.electricitySum !== undefined && foundPlot.electricitySum > 0) ? foundPlot.electricitySum.toFixed(2) : '';

                membershipCommentInput.value = foundPlot.membershipComment || '';
                targetCommentInput.value = foundPlot.targetComment || '';
                arrearsCommentInput.value = foundPlot.arrearsComment || '';
                electricityCommentInput.value = foundPlot.electricityComment || '';
                workCommentInput.value = foundPlot.workComment || '';

                membershipCheck.checked = parseFloat(membershipSumInput.value) > 0;
                targetCheck.checked = parseFloat(targetSumInput.value) > 0;
                arrearsCheck.checked = parseFloat(arrearsSumInput.value) > 0;
                workCheck.checked = parseFloat(workSumInput.value) > 0;
                electricityCheck.checked = (meterReadingPrevInput.value !== '' || parseFloat(electricitySumInput.value) > 0);
            } else {
                payerNameInput.value = '';
                plotSotkasInput.value = '';
                membershipSumInput.value = '';
                targetSumInput.value = '';
                arrearsSumInput.value = '';
                workSumInput.value = '';
                workYearInput.value = '';
                meterReadingPrevInput.value = '';
                meterReadingCurrInput.value = '';
                electricitySumInput.value = '';
                membershipCommentInput.value = '';
                targetCommentInput.value = '';
                arrearsCommentInput.value = '';
                electricityCommentInput.value = '';
                workCommentInput.value = '';
            }
            initFormState();
        }

        // Autocomplete/Autofill Logic for Plot Number
        function autofillPlotData(plotNum) {
            const foundPlots = plotData.filter(p => p.plotNumber &&
            p.plotNumber.toString().toUpperCase() === plotNum.toString().toUpperCase());

            if (foundPlots.length === 1) {
                autofillWithPlotObject(foundPlots[0]);
                plotSelectionContainer.style.display = 'none';
                ownerSelectionContainer.style.display = 'none';
                mainContentWrapper.style.display = 'block';
            } else if (foundPlots.length > 1) {
                ownerListDiv.innerHTML = '';
                foundPlots.forEach(plot => {
                    const originalIndex = plotData.findIndex(p => p === plot);
                    const button = document.createElement('button');
                    button.className = 'action-btn owner-selection-btn';
                    button.textContent = `${plot.payerName}${plot.plotSotkas ? ` (${plot.plotSotkas} сот.)` : ''}`;
                    button.dataset.index = originalIndex;
                    ownerListDiv.appendChild(button);
                });
                plotSelectionContainer.style.display = 'none';
                ownerSelectionContainer.style.display = 'block';
                mainContentWrapper.style.display = 'none';
            } else {
                autofillWithPlotObject(null);
                plotSelectionContainer.style.display = 'none';
                ownerSelectionContainer.style.display = 'none';
                mainContentWrapper.style.display = 'block';
                showNotification(`Участок "${plotNum}" не найден. Заполните данные вручную.`, 'info');
            }
        }

        // Load plot data from JSON file or localStorage
        function loadPlotData() {
            const storedData = localStorage.getItem('plotData');
            if (storedData) {
                try {
                    plotData = JSON.parse(storedData);
                    if (!Array.isArray(plotData)) plotData = [];
                } catch(e) {
                    plotData = [];
                }
            } else {
                fetch('data.json')
                .then(response => {
                    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
                    return response.json();
                })
                .then(data => {
                    plotData = Array.isArray(data) ? data : [];
                })
                .catch(error => {
                    console.error('Error loading plot data:', error);
                    showNotification('Не удалось загрузить данные участков. Введите данные вручную.', 'error');
                    plotData = [];
                });
            }
        }
        loadPlotData();

        // Event listener for the initial plot search
        findPlotBtn.addEventListener('click', () => {
            const plotNum = plotNumberInputInitial.value.trim();
            if (plotNum === '') {
                showNotification('Пожалуйста, введите номер участка.', 'error');
                plotNumberInputInitial.focus();
                return;
            }
            if (/[<>{}()\[\]\\\/]/.test(plotNum)) {
                showNotification('Номер участка содержит недопустимые символы.', 'error');
                plotNumberInputInitial.focus();
                return;
            }
            plotNumberInput.value = plotNum.toUpperCase();
            autofillPlotData(plotNum);
            plotSelectionContainer.style.display = 'none';
            mainContentWrapper.style.display = 'block';
        });

        // Download QR Code Handler
        downloadQrBtn.addEventListener('click', function() {
            if (this.disabled) return;
            const link = document.createElement('a');
            link.download = `QR_SNT_Berezka2_${plotNumberInput.value || 'payment'}.png`;
            link.href = qrCanvas.toDataURL('image/png');
            link.click();
        });

        // Кнопка "Назад к выбору участка" из главной формы
        const backToPlotSelectionBtn = document.getElementById('backToPlotSelectionBtn');
        if (backToPlotSelectionBtn) {
            backToPlotSelectionBtn.addEventListener('click', () => {
                paymentForm.reset();
                plotNumberInputInitial.value = '';
                membershipCheck.checked = false;
                targetCheck.checked = false;
                arrearsCheck.checked = false;
                workCheck.checked = false;
                electricityCheck.checked = false;
                mainContentWrapper.style.display = 'none';
                ownerSelectionContainer.style.display = 'none';
                plotSelectionContainer.style.display = 'block';
                if (qrCanvas) {
                    const ctx = qrCanvas.getContext('2d');
                    ctx.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
                    if (downloadQrBtn) downloadQrBtn.disabled = true;
                }
                if (totalAmountElement) totalAmountElement.textContent = '0.00 руб.';
                if (purposeCharCountElement) purposeCharCountElement.textContent = '0 / 150 символов';
                showNotification('Вернулись к выбору участка', 'info');
            });
        }

        // Кнопка "Назад" из окна выбора владельца
        const backToPlotFromOwnerBtn = document.getElementById('backToPlotFromOwnerBtn');
        if (backToPlotFromOwnerBtn) {
            backToPlotFromOwnerBtn.addEventListener('click', () => {
                plotNumberInputInitial.value = '';
                ownerSelectionContainer.style.display = 'none';
                plotSelectionContainer.style.display = 'block';
                ownerListDiv.innerHTML = '';
            });
        }

        // Event listeners for the main form
        membershipCheck.addEventListener('change', initFormState);
        targetCheck.addEventListener('change', initFormState);
        arrearsCheck.addEventListener('change', initFormState);
        workCheck.addEventListener('change', initFormState);
        electricityCheck.addEventListener('change', initElectricityInputs);

        membershipSumInput.addEventListener('input', updateSotkasFromMembershipSum);
        arrearsSumInput.addEventListener('input', calculateTotal);

        meterReadingCurrInput.addEventListener('input', updateElectricityFields);
        electricitySumInput.addEventListener('input', updateElectricityFields);
        meterReadingCurrInput.addEventListener('focus', updateElectricityFields);
        electricitySumInput.addEventListener('focus', updateElectricityFields);
        meterReadingCurrInput.addEventListener('blur', updateElectricityFields);
        electricitySumInput.addEventListener('blur', updateElectricityFields);

        targetSumInput.addEventListener('input', calculateTotal);
        workSumInput.addEventListener('input', calculateTotal);

        [
            plotNumberInput,
            payerNameInput,
            membershipCommentInput,
            targetCommentInput,
            arrearsCommentInput,
            workCommentInput,
            workYearInput,
            electricityCommentInput
        ].forEach(input => {
            if (input) input.addEventListener('input', updatePurposeStringCounter);
        });

            plotNumberInput.addEventListener('input', function() {
                autofillPlotData(this.value);
            });

            // Centralized validation function
            function validateForm() {
                if (payerNameInput.value.trim() === '') {
                    showNotification('Пожалуйста, введите ФИО плательщика.', 'error');
                    payerNameInput.focus();
                    return false;
                }
                const plotNumber = plotNumberInput.value.trim();
                if (plotNumber === '') {
                    showNotification('Пожалуйста, введите номер участка.', 'error');
                    plotNumberInput.focus();
                    return false;
                }
                if (/[<>{}()\[\]\\\/]/.test(plotNumber)) {
                    showNotification('Номер участка содержит недопустимые символы.', 'error');
                    plotNumberInput.focus();
                    return false;
                }

                const formData = {
                    payerName: payerNameInput.value.trim(),
                          plotNumber: plotNumberInput.value.trim(),
                          paymentTypes: [],
                          totalAmount: 0,
                          membershipSum: 0,
                          targetSum: 0,
                          arrearsSum: 0,
                          workSum: 0,
                          workYear: '',
                          electricitySum: 0,
                          membershipComment: '',
                          targetComment: '',
                          arrearsComment: '',
                          workComment: '',
                          electricityComment: ''
                };

                let calculatedTotal = 0;

                if (membershipCheck.checked) {
                    formData.paymentTypes.push('Членские взносы');
                    formData.membershipSum = parseFloat(membershipSumInput.value) || 0;
                    formData.membershipComment = membershipCommentInput.value.trim();
                    if (formData.membershipSum <= 0) {
                        showNotification('Сумма членских взносов должна быть больше нуля.', 'error');
                        membershipSumInput.focus();
                        return false;
                    }
                    calculatedTotal += formData.membershipSum;
                }
                if (targetCheck.checked) {
                    formData.paymentTypes.push('Целевые взносы');
                    formData.targetSum = parseFloat(targetSumInput.value) || 0;
                    formData.targetComment = targetCommentInput.value.trim();
                    if (formData.targetSum <= 0) {
                        showNotification('Сумма целевых взносов должна быть больше нуля.', 'error');
                        targetSumInput.focus();
                        return false;
                    }
                    calculatedTotal += formData.targetSum;
                }
                if (arrearsCheck.checked) {
                    formData.paymentTypes.push('Задолженность прошлых лет');
                    formData.arrearsSum = parseFloat(arrearsSumInput.value) || 0;
                    formData.arrearsComment = arrearsCommentInput.value.trim();
                    if (formData.arrearsSum <= 0) {
                        showNotification('Сумма задолженности должна быть больше нуля.', 'error');
                        arrearsSumInput.focus();
                        return false;
                    }
                    calculatedTotal += formData.arrearsSum;
                }
                if (workCheck.checked) {
                    formData.paymentTypes.push('Отработка');
                    formData.workSum = parseFloat(workSumInput.value) || 0;
                    formData.workYear = workYearInput.value.trim();
                    formData.workComment = workCommentInput.value.trim();
                    if (formData.workSum <= 0) {
                        showNotification('Сумма за отработку должна быть больше нуля.', 'error');
                        workSumInput.focus();
                        return false;
                    }
                    if (!formData.workYear || formData.workYear.length !== 4) {
                        showNotification('Укажите год для отработки (например, 2024).', 'error');
                        workYearInput.focus();
                        return false;
                    }
                    calculatedTotal += formData.workSum;
                }
                if (electricityCheck.checked) {
                    formData.paymentTypes.push('Электроэнергия');
                    formData.electricitySum = parseFloat(electricitySumInput.value) || 0;
                    formData.electricityComment = electricityCommentInput.value.trim();
                    if (formData.electricitySum <= 0) {
                        showNotification('Сумма за электроэнергию должна быть больше нуля.', 'error');
                        electricitySumInput.focus();
                        return false;
                    }
                    if (electricitySumInput.readOnly) {
                        const prevReading = parseFloat(meterReadingPrevInput.value);
                        const currReading = parseFloat(meterReadingCurrInput.value);
                        if (isNaN(currReading) || currReading < 0) {
                            showNotification('Пожалуйста, введите корректные текущие показания счетчика.', 'error');
                            meterReadingCurrInput.focus();
                            return false;
                        }
                        if (currReading < prevReading) {
                            showNotification('Текущие показания счетчика не могут быть меньше предыдущих.', 'error');
                            meterReadingCurrInput.focus();
                            return false;
                        }
                    }
                    calculatedTotal += formData.electricitySum;
                }

                formData.totalAmount = calculatedTotal;
                if (formData.paymentTypes.length === 0) {
                    showNotification('Пожалуйста, выберите хотя бы один тип платежа.', 'error');
                    return false;
                }
                if (formData.totalAmount <= 0) {
                    showNotification('Общая сумма должна быть больше нуля.', 'error');
                    return false;
                }
                return formData;
            }

            // Function to convert number to words - ИСПРАВЛЕНА опечатка "вадцать" -> "двадцать"
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

                if (rubles > 0 || result === '') {
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

            // QR code generation functions
            async function generateQrCodeDataURLForPrint(formData, purposeString) {
                const paymentString = buildPaymentString(formData, purposeString);
                try {
                    return await QRCode.toDataURL(paymentString, { width: 450, errorCorrectionLevel: 'H', margin: 1 });
                } catch (error) {
                    console.error('Error generating print QR code:', error);
                    return null;
                }
            }

            async function generateAndDisplayQrCode(formData, purposeString) {
                const paymentString = buildPaymentString(formData, purposeString);
                try {
                    await QRCode.toCanvas(qrCanvas, paymentString, { width: 250, errorCorrectionLevel: 'H', margin: 1 });
                    downloadQrBtn.disabled = false;
                } catch (err) {
                    console.error('Failed to generate QR on canvas:', err);
                    downloadQrBtn.disabled = true;
                }
            }

            function buildPaymentString(formData, purposeString) {
                const totalAmountKopecks = (formData.totalAmount * 100).toFixed(0);
                const finalPurposeString = purposeString.length > 150 ? purposeString.substring(0, 150) : purposeString;
                return `ST00012|Name=${REQUISITES.Name}|PersonalAcc=${REQUISITES.PersonalAcc}|BankName=${REQUISITES.BankName}|BIC=${REQUISITES.BIC}|CorrespAcc=${REQUISITES.CorrespAcc}|PayeeINN=${REQUISITES.PayeeINN}|KPP=${REQUISITES.KPP}|Sum=${totalAmountKopecks}|Purpose=${finalPurposeString}`;
            }

            function createReceiptPart(title, data, amountInWords, formattedDate, qrCodeDataURL = null) {
                const purpose = data.paymentTypes.join(', ');
                let paymentDetails = [];
                if (data.membershipSum > 0) paymentDetails.push(`Членские взносы: ${data.membershipSum.toFixed(2)} руб.${data.membershipComment ? ` (${data.membershipComment})` : ''}`);
                if (data.targetSum > 0) paymentDetails.push(`Целевые взносы: ${data.targetSum.toFixed(2)} руб.${data.targetComment ? ` (${data.targetComment})` : ''}`);
                if (data.arrearsSum > 0) paymentDetails.push(`Задолженность прошлых лет: ${data.arrearsSum.toFixed(2)} руб.${data.arrearsComment ? ` (${data.arrearsComment})` : ''}`);
                if (data.workSum > 0) paymentDetails.push(`Отработка: ${data.workSum.toFixed(2)} руб. за ${data.workYear} год${data.workComment ? ` (${data.workComment})` : ''}`);
                if (data.electricitySum > 0) paymentDetails.push(`Электроэнергия: ${data.electricitySum.toFixed(2)} руб.${data.electricityComment ? ` (${data.electricityComment})` : ''}`);

                const qrCodeHtml = (title === 'Извещение' && qrCodeDataURL) ?
                `<div class="receipt-qr-code-container"><img src="${qrCodeDataURL}" alt="QR Code" class="receipt-qr-code"><div class="receipt-qr-label">Сканируйте для оплаты</div></div>` : '';

                return `
                <div class="receipt-part">
                <div class="receipt-main-content">
                <div class="receipt-header"><div class="receipt-form-number"><span>Форма № ПД-4</span></div></div>
                <div class="receipt-field"><div class="receipt-field-value">СНТ «Березка-2»</div><div class="receipt-field-label">(наименование получателя платежа)</div></div>
                <div class="receipt-row"><div class="receipt-field" style="flex:2;"><div class="receipt-field-value">5433118499</div><div class="receipt-field-label">(ИНН получателя платежа)</div></div><div class="receipt-field" style="flex:3;"><div class="receipt-field-value">40703810644050040322</div><div class="receipt-field-label">(номер счёта получателя платежа)</div></div></div>
                <div class="receipt-field"><div class="receipt-field-value">Сибирский Банк ПАО Сбербанк г. Новосибирск</div><div class="receipt-field-label">(наименование банка получателя платежа)</div></div>
                <div class="receipt-row"><div class="receipt-field" style="flex:1;"><div class="receipt-field-value">045004641</div><div class="receipt-field-label">(БИК)</div></div><div class="receipt-field" style="flex:2;"><div class="receipt-field-value">30101810500000000641</div><div class="receipt-field-label">(номер кор./сч. банка получателя платежа)</div></div></div>
                <div class="receipt-field"><div class="receipt-field-value">${purpose} за участок № ${data.plotNumber}</div><div class="receipt-field-label">(наименование платежа)</div></div>
                <div class="receipt-field"><div class="receipt-field-value">${data.payerName}</div><div class="receipt-field-label">(Ф.И.О. плательщика, адрес)</div></div>
                <div class="receipt-amount-section">${paymentDetails.map(d => `<div class="receipt-amount-row"><span>${d}</span></div>`).join('')}<div class="receipt-total">Итого к доплате: ${data.totalAmount.toFixed(2)} руб.</div></div>
                <div class="receipt-amount-words"><strong>Сумма прописью:</strong> ${amountInWords}</div>
                <div class="receipt-footer"><div class="receipt-date-block"><div>Дата ${formattedDate}</div></div><div class="receipt-signatures-block"><div class="signature-entry"><span class="sig-label">Плательщик (подпись)</span><span class="sig-line"></span><span class="sig-separator">/</span><span class="sig-decipher-line"></span><span class="sig-decipher-text">(расшифровка)</span></div><div class="signature-entry"><span class="sig-label">Кассир</span><span class="sig-line"></span><span class="sig-separator">/</span><span class="sig-decipher-line"></span><span class="sig-decipher-text">(расшифровка)</span></div></div></div>
                </div>
                <div class="receipt-right-frame"><span class="receipt-title-right">${title}</span>${qrCodeHtml}<div class="cashier-label-right">Кассир</div></div>
                </div>`;
            }

            // Form submission
            paymentForm.addEventListener('submit', async function(e) {
                e.preventDefault();
                const formData = validateForm();
                if (!formData) return;

                const today = new Date();
                const formattedDate = today.toLocaleDateString('ru-RU');
                const amountInWords = numberToWords(formData.totalAmount);

                let purposeParts = [];
                if (formData.membershipSum > 0) purposeParts.push(`Членские взносы: ${formData.membershipSum.toFixed(2)} руб.${formData.membershipComment ? ` (${formData.membershipComment})` : ''}`);
                if (formData.targetSum > 0) purposeParts.push(`Целевые взносы: ${formData.targetSum.toFixed(2)} руб.${formData.targetComment ? ` (${formData.targetComment})` : ''}`);
                if (formData.arrearsSum > 0) purposeParts.push(`Задолженность прошлых лет: ${formData.arrearsSum.toFixed(2)} руб.${formData.arrearsComment ? ` (${formData.arrearsComment})` : ''}`);
                if (formData.workSum > 0) purposeParts.push(`Отработка: ${formData.workSum.toFixed(2)} руб. за ${formData.workYear} год${formData.workComment ? ` (${formData.workComment})` : ''}`);
                if (formData.electricitySum > 0) {
                    const kwhUsed = parseFloat(kwhUsedElement.textContent) || 0;
                    purposeParts.push(`Электроэнергия: ${formData.electricitySum.toFixed(2)} руб. (${kwhUsed} кВт)${formData.electricityComment ? ` (${formData.electricityComment})` : ''}`);
                }

                let purposeString = purposeParts.length > 0
                ? purposeParts.join(', ') + ` за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`
                : `Оплата за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;

                await generateAndDisplayQrCode(formData, purposeString);
                const qrCodeForReceipt = await generateQrCodeDataURLForPrint(formData, purposeString);

                document.getElementById(ELEM_RECEIPT_CONTENT).innerHTML = `
                ${createReceiptPart('Извещение', formData, amountInWords, formattedDate, qrCodeForReceipt)}
                <div class="receipt-tear-line"></div>
                ${createReceiptPart('Квитанция', formData, amountInWords, formattedDate, null)}`;
                modal.style.display = 'block';
            });

            // Notification function
            function showNotification(message, type = 'info') {
                const toast = document.createElement('div');
                toast.className = `toast toast-${type}`;
                toast.textContent = message;
                let bgColor = '#2196F3';
                if (type === 'error') bgColor = '#f44336';
                else if (type === 'success') bgColor = '#4CAF50';
                toast.style.cssText = `position:fixed;top:20px;right:20px;padding:12px 24px;background:${bgColor};color:white;border-radius:44px;z-index:10000;max-width:300px;box-shadow:0 2px 10px rgba(0,0,0,0.2);opacity:0;transform:translateX(100%);transition:all 0.3s ease;`;
                document.body.appendChild(toast);
                setTimeout(() => { toast.style.opacity = '1'; toast.style.transform = 'translateX(0)'; }, 10);
                setTimeout(() => {
                    toast.style.opacity = '0';
                    toast.style.transform = 'translateX(100%)';
                    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 300);
                }, 5000);
            }

            // Fix for number input fields
            document.querySelectorAll('input[type="number"]').forEach(input => {
                input.addEventListener('input', function() {
                    this.value = this.value.replace(',', '.');
                    if (this.value !== '' && !/^-?\d*\.?\d*$/.test(this.value)) {
                        this.value = this.value.match(/^-?\d*\.?\d*/)?.[0] || '';
                    }
                });
            });

            // Modal window event handlers
            closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
            window.addEventListener('click', (event) => { if (event.target == modal) modal.style.display = 'none'; });
            printBtn.addEventListener('click', () => window.print());
});
