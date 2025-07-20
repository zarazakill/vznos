document.addEventListener('DOMContentLoaded', function() {
    const ELECTRICITY_TARIFF = 3.5; // 3.5 руб за кВт·ч
    const MEMBERSHIP_TARIFF = 1400; // 1400 руб за сотку

    // Constants for element IDs (helps with readability and refactoring)
    const ELEM_PAYER_NAME = 'payerName';
    const ELEM_PLOT_NUMBER = 'plotNumber';
    const ELEM_MEMBERSHIP_CHECK = 'membershipCheck';
    const ELEM_TARGET_CHECK = 'targetCheck';
    const ELEM_ELECTRICITY_CHECK = 'electricityCheck';
    const ELEM_WORK_CHECK = 'workCheck';
    const ELEM_PLOT_SOTKAS = 'plotSotkas'; // Now readonly, derived from membershipSum
    const ELEM_MEMBERSHIP_SUM = 'membershipSum'; // Primary input for membership
    const ELEM_TARGET_SUM = 'targetSum';
    const ELEM_WORK_SUM = 'workSum';
    const ELEM_WORK_YEAR = 'workYear';
    const ELEM_METER_PREV = 'meterReadingPrev'; // Now readonly, informational
    const ELEM_METER_CURR = 'meterReadingCurr';
    const ELEM_KWH_USED = 'kwhUsed';
    const ELEM_ELECTRICITY_SUM_INPUT = 'electricitySumInput';
    const ELEM_TOTAL_AMOUNT = 'totalAmount';
    const ELEM_PURPOSE_CHAR_COUNT = 'purposeCharCount';
    const ELEM_RECEIPT_MODAL = 'receiptModal';
    const ELEM_RECEIPT_CONTENT = 'receiptContent';
    const ELEM_PRINT_BTN = 'printBtn';

    // Elements for form
    const paymentForm = document.getElementById('paymentForm');
    const membershipCheck = document.getElementById(ELEM_MEMBERSHIP_CHECK);
    const targetCheck = document.getElementById(ELEM_TARGET_CHECK);
    const electricityCheck = document.getElementById(ELEM_ELECTRICITY_CHECK);
    const workCheck = document.getElementById(ELEM_WORK_CHECK);
    const membershipAmountDiv = document.getElementById('membershipAmount'); // This is the div container for membership inputs
    const targetAmountDiv = document.getElementById('targetAmount'); // This is the div container for target sum input
    const electricityInputsDiv = document.getElementById('electricityInputs'); // This is the div container for electricity inputs
    const workAmountDiv = document.getElementById('workAmount'); // This is the div container for work inputs
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
    const electricityCommentInput = document.getElementById('electricityComment');
    const workCommentInput = document.getElementById('workComment');

    // Data for plot number autofill
    let plotData = [];

    // Static Requisites for QR code generation (extracted from HTML)
    const REQUISITES = {
        Name: 'СНТ «Березка-2»',
        PayeeINN: '5433118499', // qrcod.ru uses PayeeINN
        KPP: '543301001',
        BankName: 'Сибирский Банк ПАО Сбербанк',
        PersonalAcc: '40703810644050040322',
        BIC: '045004641',
        CorrespAcc: '30101810500000000641'
    };

    // Apply Inputmask if available
    if (typeof Inputmask !== 'undefined') {
        Inputmask({
            mask: '9{1,4}[A]',
            placeholder: '',
            definitions: {
                'A': { validator: '[АAаa]', casing: 'upper' }
            }
        }).mask(plotNumberInput);
    }

    // Toggles visibility of an element based on checkbox state
    const toggleVisibility = (check, element) => {
        element.style.display = check.checked ? 'block' : 'none';
    };

    // Calculate plot size based on membership fee (main driver now)
    function updateSotkasFromMembershipSum() {
        if (!membershipCheck.checked) {
            plotSotkasInput.value = ''; // Clear sotkas if checkbox is unchecked
            calculateTotal();
            return;
        }
        const membershipSum = parseFloat(membershipSumInput.value) || 0;
        if (MEMBERSHIP_TARIFF > 0) {
            const sotkas = membershipSum / MEMBERSHIP_TARIFF;
            plotSotkasInput.value = sotkas.toFixed(2);
        } else {
            plotSotkasInput.value = '0.00';
        }
        calculateTotal();
    }

    // --- NEW --- Function to update the character counter for the QR purpose string
    function updatePurposeStringCounter() {
        if (!purposeCharCountElement) return;

        // This logic mirrors how the purposeString is built for the QR code.
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

        if (currentLength > 150) {
            purposeCharCountElement.style.color = 'var(--error-color)';
        } else {
            purposeCharCountElement.style.color = 'var(--text-color)';
        }
    }

    // --- Electricity calculation logic ---
    function updateElectricityFields() {
        if (!electricityCheck.checked) {
            // If checkbox is unchecked, clear and reset states
            meterReadingCurrInput.value = '';
            electricitySumInput.value = '';
            kwhUsedElement.textContent = '0';
            meterReadingCurrInput.readOnly = false;
            electricitySumInput.readOnly = false;
            calculateTotal();
            return;
        }

        const prev = parseFloat(meterReadingPrevInput.value) || 0; // meterReadingPrev is always readonly
        const curr = parseFloat(meterReadingCurrInput.value);
        const manualSum = parseFloat(electricitySumInput.value);

        let kwh = 0;
        let sum = 0;

        // Determine which input the user is actively filling or has filled meaningfully
        const isCurrValid = !isNaN(curr) && curr >= 0;
        const isSumValid = !isNaN(manualSum) && manualSum >= 0;

        if (document.activeElement === meterReadingCurrInput && isCurrValid) {
            // User is actively typing in current reading
            if (isCurrValid && curr >= prev) {
                kwh = curr - prev;
                sum = kwh * ELECTRICITY_TARIFF;
                electricitySumInput.value = sum.toFixed(2);
                electricitySumInput.readOnly = true; // Make sum readonly
            } else {
                // Invalid current reading, clear calculated fields and enable sum
                electricitySumInput.value = '';
                electricitySumInput.readOnly = false;
                kwh = 0;
            }
        } else if (document.activeElement === electricitySumInput && isSumValid) {
            // User is actively typing in manual sum
            sum = manualSum;
            if (ELECTRICITY_TARIFF > 0) {
                kwh = sum / ELECTRICITY_TARIFF;
            }
            meterReadingCurrInput.value = Math.round(prev + kwh);
            meterReadingCurrInput.readOnly = true; // Make current reading readonly
        } else if (isCurrValid && curr >= prev) {
            // Current reading has a valid value (e.g., from autofill + subsequent entry, or just valid input)
            kwh = curr - prev;
            sum = kwh * ELECTRICITY_TARIFF;
            electricitySumInput.value = sum.toFixed(2);
            electricitySumInput.readOnly = true;
            meterReadingCurrInput.readOnly = false;
        } else if (isSumValid) {
            // Manual sum has a valid value
            sum = manualSum;
            if (ELECTRICITY_TARIFF > 0) {
                kwh = sum / ELECTRICITY_TARIFF;
            }
            meterReadingCurrInput.value = Math.round(prev + kwh);
            meterReadingCurrInput.readOnly = true;
            electricitySumInput.readOnly = false;
        } else {
            // Nothing valid entered in current or sum, or both cleared. Reset to editable.
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
    // --- End Electricity calculation logic ---

    // Function to calculate total sum
    function calculateTotal() {
        let total = 0;
        let membershipSum = 0;
        let targetSum = 0;
        let workSum = 0;
        let electricitySum = 0;

        if (membershipCheck.checked) {
            membershipSum = parseFloat(membershipSumInput.value) || 0;
            total += membershipSum;
        }

        if (targetCheck.checked) {
            targetSum = parseFloat(targetSumInput.value) || 0;
            total += targetSum;
        }

        if (workCheck.checked) {
            workSum = parseFloat(workSumInput.value) || 0;
            total += workSum;
        }

        if (electricityCheck.checked) {
            electricitySum = parseFloat(electricitySumInput.value) || 0;
            total += electricitySum;
        }

        totalAmountElement.textContent = total.toFixed(2) + ' руб.';
        updatePurposeStringCounter(); // Update char counter whenever total is calculated
    }

    // Initial setup (run once on load)
    const initFormState = () => {
        toggleVisibility(membershipCheck, membershipAmountDiv);
        toggleVisibility(targetCheck, targetAmountDiv);
        toggleVisibility(workCheck, workAmountDiv);
        initElectricityInputs(); // Initialize electricity specific inputs/logic
        
        calculateTotal(); // Final total calculation after initial states
    };

    // Initialize electricity inputs (on load or checkbox change)
    function initElectricityInputs() {
        toggleVisibility(electricityCheck, electricityInputsDiv);
        // meterReadingPrevInput is now permanently readonly as per HTML
        updateElectricityFields(); // Apply logic to set states correctly
    }

    // --- Autocomplete/Autofill Logic for Plot Number ---
    function autofillPlotData(plotNum) {
        const foundPlot = plotData.find(p => p.plotNumber.toUpperCase() === plotNum.toUpperCase());

        if (foundPlot) {
            payerNameInput.value = foundPlot.payerName || '';
            
            // Set membership sum and derive plot sotkas
            membershipSumInput.value = (foundPlot.plotSotkas !== undefined && foundPlot.plotSotkas !== null && foundPlot.plotSotkas > 0) 
                                       ? (foundPlot.plotSotkas * MEMBERSHIP_TARIFF).toFixed(2) 
                                       : '';
            
            plotSotkasInput.value = (foundPlot.plotSotkas !== undefined && foundPlot.plotSotkas !== null) ? foundPlot.plotSotkas.toFixed(2) : '';

            targetSumInput.value = (foundPlot.targetSum !== undefined && foundPlot.targetSum !== null) ? foundPlot.targetSum.toFixed(2) : '';
            workSumInput.value = (foundPlot.workSum !== undefined && foundPlot.workSum !== null) ? foundPlot.workSum.toFixed(2) : '';
            workYearInput.value = foundPlot.workYear || '';
            meterReadingPrevInput.value = (foundPlot.meterReadingPrev !== undefined && foundPlot.meterReadingPrev !== null) ? foundPlot.meterReadingPrev : '';
            meterReadingCurrInput.value = ''; // Always clear current reading for new input
            electricitySumInput.value = ''; // Always clear manual electricity sum for new autofill

            // Set comment fields
            membershipCommentInput.value = foundPlot.membershipComment || '';
            targetCommentInput.value = foundPlot.targetComment || '';
            electricityCommentInput.value = foundPlot.electricityComment || '';
            workCommentInput.value = foundPlot.workComment || '';

            // Also check checkboxes if corresponding sums/data are present
            membershipCheck.checked = (parseFloat(membershipSumInput.value) > 0);
            targetCheck.checked = parseFloat(targetSumInput.value) > 0;
            workCheck.checked = parseFloat(workSumInput.value) > 0;
            electricityCheck.checked = meterReadingPrevInput.value !== ''; // Check if there's a previous reading
        } else {
            // Clear fields if no matching plot is found
            payerNameInput.value = '';
            plotSotkasInput.value = '';
            membershipSumInput.value = ''; // Also clear derived sum
            targetSumInput.value = '';
            workSumInput.value = '';
            workYearInput.value = '';
            meterReadingPrevInput.value = '';
            meterReadingCurrInput.value = '';
            electricitySumInput.value = ''; // Also clear derived sum

            // Clear comment fields
            membershipCommentInput.value = '';
            targetCommentInput.value = '';
            electricityCommentInput.value = '';
            workCommentInput.value = '';

            // Do not uncheck checkboxes automatically, let user decide payment types
            // membershipCheck.checked = false;
            // targetCheck.checked = false;
            // workCheck.checked = false;
            // electricityCheck.checked = false;
        }
        initFormState(); // Re-initialize form state and calculations based on new values
    }

    // Load plot data from JSON file
    fetch('data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            plotData = data;
            // No initial autofill needed on load, wait for user input
        })
        .catch(error => {
            console.error('Error loading plot data:', error);
            showNotification('Не удалось загрузить данные участков для автозаполнения. Пожалуйста, введите данные вручную.', 'error');
        });
    // --- End Autocomplete/Autofill Logic ---

    // Download QR Code Handler
    downloadQrBtn.addEventListener('click', function() {
        if (this.disabled) return;
        const link = document.createElement('a');
        link.download = `QR_SNT_Berezka2_${plotNumberInput.value || 'payment'}.png`;
        link.href = qrCanvas.toDataURL('image/png');
        link.click();
    });

    initFormState(); // Call initial setup once after data is potentially loaded

    // Event listeners
    membershipCheck.addEventListener('change', initFormState);
    targetCheck.addEventListener('change', initFormState);
    workCheck.addEventListener('change', initFormState);
    electricityCheck.addEventListener('change', initElectricityInputs); // Direct call for more precise control

    // plotSotkasInput is now readonly, its value is derived from membershipSumInput
    membershipSumInput.addEventListener('input', updateSotkasFromMembershipSum);

    // Electricity input handlers
    meterReadingCurrInput.addEventListener('input', updateElectricityFields);
    electricitySumInput.addEventListener('input', updateElectricityFields);
    meterReadingCurrInput.addEventListener('focus', updateElectricityFields); // Trigger update on focus to set readonly
    electricitySumInput.addEventListener('focus', updateElectricityFields); // Trigger update on focus to set readonly
    meterReadingCurrInput.addEventListener('blur', updateElectricityFields); // Trigger update on blur to reset readonly if empty
    electricitySumInput.addEventListener('blur', updateElectricityFields); // Trigger update on blur to reset readonly if empty

    targetSumInput.addEventListener('input', calculateTotal);
    workSumInput.addEventListener('input', calculateTotal);

    // Add event listeners to all fields that affect the purpose string
    [
        plotNumberInput,
        payerNameInput,
        membershipCommentInput,
        targetCommentInput,
        workCommentInput,
        workYearInput,
        electricityCommentInput
    ].forEach(input => input.addEventListener('input', updatePurposeStringCounter));

    // Event listener for plot number input to trigger autofill
    plotNumberInput.addEventListener('input', function() {
        autofillPlotData(this.value);
    });

    // Centralized validation function
    function validateForm() {
        // Validate payer name
        if (payerNameInput.value.trim() === '') {
            showNotification('Пожалуйста, введите ФИО плательщика.', 'error');
            payerNameInput.focus();
            return false;
        }

        // Validate plot number using the pattern
        const plotNumber = plotNumberInput.value.trim();
        if (!plotNumberInput.checkValidity()) {
            showNotification('Номер участка должен содержать только цифры и может заканчиваться одной буквой (А-Яа-я).', 'error');
            plotNumberInput.focus();
            return false;
        }

        const formData = {
            payerName: payerNameInput.value.trim(), // Trim payer name
            plotNumber: plotNumberInput.value.trim(), // Trim plot number
            paymentTypes: [],
            totalAmount: 0, // Will be calculated dynamically below
            membershipSum: 0,
            targetSum: 0,
            workSum: 0,
            workYear: '',
            electricitySum: 0,
            membershipComment: '',
            targetComment: '',
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
            // Additional check for meter readings if electricity is selected and not in manual sum mode
            if (electricitySumInput.readOnly) { // If electricity sum is read-only, it means meter readings are the primary input
                const prevReading = parseFloat(meterReadingPrevInput.value);
                const currReading = parseFloat(meterReadingCurrInput.value);
                
                if (isNaN(currReading) || currReading < 0) {
                    showNotification('Пожалуйста, введите корректные текущие показания счетчика (целое число).', 'error');
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

        formData.totalAmount = calculatedTotal; // Assign the calculated total

        if (formData.paymentTypes.length === 0) {
            showNotification('Пожалуйста, выберите хотя бы один тип платежа.', 'error');
            return false;
        }

        if (formData.totalAmount <= 0) {
            showNotification('Общая сумма должна быть больше нуля. Проверьте введенные суммы.', 'error');
            return false;
        }

        return formData; // Return collected data if validation passes
    }

    // Function to convert number to words (for rubles and kopecks)
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

        // Thousands
        if (rubles >= 1000) {
            const thousands = Math.floor(rubles / 1000);
            rubles %= 1000;

            result += convertLessThanOneThousand(thousands, true) + ' ';

            // Correct declension for thousands
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

        // Rubles
        if (rubles > 0 || result === '') { // If rubles are 0 but total sum is 0, still add "рублей"
            result += convertLessThanOneThousand(rubles, false) + ' ';
        }

        // Correct declension for rubles
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

        // Kopecks (digits only)
        kopecks = kopecks.toString().padStart(2, '0');
        result += ` ${kopecks} коп.`;

        // Capitalize first letter
        return result.charAt(0).toUpperCase() + result.slice(1);
    }
    
    // Function to generate QR code data URL for the printable receipt
    async function generateQrCodeDataURLForPrint(formData, purposeString) {
        const paymentString = buildPaymentString(formData, purposeString);
        try {
            // Larger QR for print, ~38mm on A4
            return await QRCode.toDataURL(paymentString, { width: 450, errorCorrectionLevel: 'H', margin: 1 });
        } catch (error) {
            console.error('Error generating print QR code data URL:', error);
            return null;
        }
    }

    // Function to generate and display QR code on the main page canvas
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

    // Function to build the payment string for the QR code
    function buildPaymentString(formData, purposeString) {
         const totalAmountKopecks = (formData.totalAmount * 100).toFixed(0);
        // Truncate purpose string to 150 characters
        const finalPurposeString = purposeString.length > 150 ? purposeString.substring(0, 150) : purposeString;

        return `ST00012|Name=${REQUISITES.Name}` +
            `|PersonalAcc=${REQUISITES.PersonalAcc}` +
            `|BankName=${REQUISITES.BankName}` +
            `|BIC=${REQUISITES.BIC}` +
            `|CorrespAcc=${REQUISITES.CorrespAcc}` +
            `|PayeeINN=${REQUISITES.PayeeINN}` +
            (REQUISITES.KPP ? `|KPP=${REQUISITES.KPP}` : '') +
            `|Sum=${totalAmountKopecks}` +
            `|Purpose=${finalPurposeString}`;
    }
    
    // Function to create one part of the receipt (Notice or Receipt)
    function createReceiptPart(title, data, amountInWords, formattedDate, qrCodeDataURL = null) {
        const purpose = data.paymentTypes.join(', ');
        
        // Form payment details
        let paymentDetails = [];
        if (data.membershipSum > 0) {
            const membershipText = `Членские взносы: ${data.membershipSum.toFixed(2)} руб.${data.membershipComment ? ` (${data.membershipComment})` : ''}`;
            paymentDetails.push(membershipText);
        }
        if (data.targetSum > 0) {
            const targetText = `Целевые взносы: ${data.targetSum.toFixed(2)} руб.${data.targetComment ? ` (${data.targetComment})` : ''}`;
            paymentDetails.push(targetText);
        }
        if (data.workSum > 0) {
            const workText = `Отработка: ${data.workSum.toFixed(2)} руб. за ${data.workYear} год${data.workComment ? ` (${data.workComment})` : ''}`;
            paymentDetails.push(workText);
        }
        if (data.electricitySum > 0) {
            const electricityText = `Электроэнергия: ${data.electricitySum.toFixed(2)} руб.${data.electricityComment ? ` (${data.electricityComment})` : ''}`;
            paymentDetails.push(electricityText);
        }
        
        // Conditional QR code display for the "Извещение" part
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
                    ${qrCodeHtml} <!-- Insert QR code here if applicable -->
                    <div class="cashier-label-right">Кассир</div>
                </div>
            </div>
        `;
    }

    // Form validation and receipt generation
    paymentForm.addEventListener('submit', async function(e) { // Make the function async
        e.preventDefault();

        const formData = validateForm();
        if (!formData) return; // Stop if validation fails

        const today = new Date();
        const formattedDate = today.toLocaleDateString('ru-RU');
        const amountInWords = numberToWords(formData.totalAmount);
        
        // Generate the purpose string for QR code
        let purposeParts = [];
        if (formData.membershipSum > 0) {
            purposeParts.push(`Членские взносы: ${formData.membershipSum.toFixed(2)} руб.${formData.membershipComment ? ` (${formData.membershipComment})` : ''}`);
        }
        if (formData.targetSum > 0) {
            purposeParts.push(`Целевые взносы: ${formData.targetSum.toFixed(2)} руб.${formData.targetComment ? ` (${formData.targetComment})` : ''}`);
        }
        if (formData.workSum > 0) {
            purposeParts.push(`Отработка: ${formData.workSum.toFixed(2)} руб. за ${formData.workYear} год${formData.workComment ? ` (${formData.workComment})` : ''}`);
        }
        if (formData.electricitySum > 0) {
            const kwhUsed = parseFloat(kwhUsedElement.textContent) || 0; // Get actual displayed kWh
            purposeParts.push(`Электроэнергия: ${formData.electricitySum.toFixed(2)} руб. (${kwhUsed} кВт)${formData.electricityComment ? ` (${formData.electricityComment})` : ''}`);
        }
        let purposeString = '';
        if (purposeParts.length > 0) {
            purposeString = purposeParts.join(', ') + ` за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;
        } else {
            // Fallback if no payment types are selected (though validation should prevent this)
            purposeString = `Оплата за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;
        }

        // --- NEW --- Generate QR code for main page display
        await generateAndDisplayQrCode(formData, purposeString);

        // Generate QR code data URL for the printable receipt (larger size)
        const qrCodeForReceipt = await generateQrCodeDataURLForPrint(formData, purposeString);

        // Create receipt content for modal
        const receiptContentHTML = `
            ${createReceiptPart('Извещение', formData, amountInWords, formattedDate, qrCodeForReceipt)}
            <div class="receipt-tear-line"></div>
            ${createReceiptPart('Квитанция', formData, amountInWords, formattedDate, null)} <!-- No QR for Kvitantsiya -->
        `;

        document.getElementById(ELEM_RECEIPT_CONTENT).innerHTML = receiptContentHTML;
        modal.style.display = 'block';
    });

    // Вспомогательная функция для уведомлений (renamed from showToast)
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
            border-radius: 44px; /* Changed to more pill-like */
            z-index: 10000;
            max-width: 300px;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(toast);
        
        // Анимация появления
        setTimeout(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(0)';
        }, 10);
        
        // Автоматическое удаление через 5 секунд
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

    // Fix for number input fields to allow only valid numbers
    document.querySelectorAll('input[type="number"]').forEach(input => {
        input.addEventListener('input', function() {
            // Allow empty string, or numbers (including decimals)
            // Replace comma with dot for decimal input for consistent parsing
            this.value = this.value.replace(',', '.');
            if (this.value === '' || /^-?\d*\.?\d*$/.test(this.value)) {
                // Valid input, do nothing special
            } else {
                // Invalid input, remove invalid characters
                this.value = this.value.match(/^-?\d*\.?\d*/)?.[0] || '';
            }
        });
    });
    
    // Modal window event handlers
    closeModalBtn.addEventListener('click', () => modal.style.display = 'none');
    window.addEventListener('click', (event) => {
        if (event.target == modal) {
            modal.style.display = 'none';
        }
    });

    printBtn.addEventListener('click', () => window.print());
});