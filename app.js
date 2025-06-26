document.addEventListener('DOMContentLoaded', function() {
    const ELECTRICITY_TARIFF = 3.5; // 3.5 руб за кВт·ч
    const MEMBERSHIP_TARIFF = 1400; // 1400 руб за сотку

    // Constants for element IDs (helps with readability and refactoring)
    const ELEM_PAYER_NAME = 'payerName';
    const ELEM_PLOT_NUMBER = 'plotNumber';
    const ELEM_MEMBERSHIP_CHECK = 'membershipCheck';
    const ELEM_TARGET_CHECK = 'targetCheck';
    const ELEM_ELECTRICITY_CHECK = 'electricityCheck';
    const ELEM_PLOT_SOTKAS = 'plotSotkas';
    const ELEM_MEMBERSHIP_SUM = 'membershipSum';
    const ELEM_TARGET_SUM = 'targetSum';
    const ELEM_METER_PREV = 'meterReadingPrev';
    const ELEM_METER_CURR = 'meterReadingCurr';
    const ELEM_KWH_USED = 'kwhUsed';
    const ELEM_ELECTRICITY_SUM_INPUT = 'electricitySumInput';
    const ELEM_TOTAL_AMOUNT = 'totalAmount';
    const ELEM_RECEIPT_MODAL = 'receiptModal';
    const ELEM_RECEIPT_CONTENT = 'receiptContent';
    const ELEM_PRINT_BTN = 'printBtn';
    const ELEM_GENERATE_QR_BTN = 'generateQrBtn'; // New QR button
    const ELEM_QR_CANVAS = 'qrCanvas'; // New QR Canvas ID
    const ELEM_DOWNLOAD_QR_BTN = 'downloadQrBtn'; // New Download Button ID

    // Elements for form
    const paymentForm = document.getElementById('paymentForm');
    const membershipCheck = document.getElementById(ELEM_MEMBERSHIP_CHECK);
    const targetCheck = document.getElementById(ELEM_TARGET_CHECK);
    const electricityCheck = document.getElementById(ELEM_ELECTRICITY_CHECK);
    const membershipAmountDiv = document.getElementById('membershipAmount'); // This is the div container for membership inputs
    const targetAmountDiv = document.getElementById('targetAmount'); // This is the div container for target sum input
    const electricityInputsDiv = document.getElementById('electricityInputs'); // This is the div container for electricity inputs
    const totalAmountElement = document.getElementById(ELEM_TOTAL_AMOUNT);
    const modal = document.getElementById(ELEM_RECEIPT_MODAL);
    const closeModalBtn = document.querySelector('.close-modal');
    const printBtn = document.getElementById(ELEM_PRINT_BTN);
    const generateQrBtn = document.getElementById(ELEM_GENERATE_QR_BTN); // New QR button

    // QR code elements
    const qrCanvas = document.getElementById(ELEM_QR_CANVAS);
    const downloadQrBtn = document.getElementById(ELEM_DOWNLOAD_QR_BTN);

    // Specific input fields
    const plotSotkasInput = document.getElementById(ELEM_PLOT_SOTKAS);
    const membershipSumInput = document.getElementById(ELEM_MEMBERSHIP_SUM);
    const targetSumInput = document.getElementById(ELEM_TARGET_SUM);
    const meterReadingPrevInput = document.getElementById(ELEM_METER_PREV);
    const meterReadingCurrInput = document.getElementById(ELEM_METER_CURR);
    const kwhUsedElement = document.getElementById(ELEM_KWH_USED);
    const electricitySumInput = document.getElementById(ELEM_ELECTRICITY_SUM_INPUT);
    const plotNumberInput = document.getElementById(ELEM_PLOT_NUMBER);
    const payerNameInput = document.getElementById(ELEM_PAYER_NAME);

    // Elements for breakdown display
    const membershipDisplay = document.getElementById('membershipDisplay');
    const targetDisplay = document.getElementById('targetDisplay');
    const electricityDisplay = document.getElementById('electricityDisplay');
    const membershipBreakdown = document.getElementById('membershipBreakdown');
    const targetBreakdown = document.getElementById('targetBreakdown');
    const electricityBreakdown = document.getElementById('electricityBreakdown');

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

    // Calculate membership fee based on plot size (sotkas)
    function updateMembershipSumFromSotkas() {
        if (!membershipCheck.checked) {
            membershipSumInput.value = '0.00'; // Clear sum if checkbox is unchecked
            calculateTotal();
            return;
        }
        const sotkas = parseFloat(plotSotkasInput.value) || 0;
        const membershipSum = sotkas * MEMBERSHIP_TARIFF;
        membershipSumInput.value = membershipSum.toFixed(2);
        calculateTotal();
    }

    // Calculate plot size based on membership fee
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

    // --- Electricity calculation logic ---
    // Calculates electricity based on meter readings
    function calculateElectricityFromMeterReadings() {
        const prev = parseFloat(meterReadingPrevInput.value) || 0;
        const curr = parseFloat(meterReadingCurrInput.value) || 0; // curr is now integer from input
        let kwh = 0;
        let sum = 0;

        if (curr >= prev) {
            kwh = curr - prev;
            sum = kwh * ELECTRICITY_TARIFF;
        }
        kwhUsedElement.textContent = Math.round(kwh); // Display as whole number
        electricitySumInput.value = sum.toFixed(2);
    }

    // Calculates electricity based on manual sum input and previous reading if available
    function calculateElectricityFromSum() {
        const sum = parseFloat(electricitySumInput.value) || 0;
        let kwh = 0;

        if (ELECTRICITY_TARIFF > 0) {
            kwh = sum / ELECTRICITY_TARIFF;
        }
        kwhUsedElement.textContent = Math.round(kwh); // Display as whole number

        // If previous reading exists, calculate current reading as a whole number
        const prev = parseFloat(meterReadingPrevInput.value);
        if (!isNaN(prev) && prev >= 0) {
            meterReadingCurrInput.value = Math.round(prev + kwh); // Round to nearest whole number
        } else {
            meterReadingCurrInput.value = ''; // Clear current if prev is not there
        }
    }

    // Handles input for meter reading fields, setting readOnly states
    function handleMeterInput() {
        if (!electricityCheck.checked) return;

        const prev = parseFloat(meterReadingPrevInput.value);
        const curr = parseFloat(meterReadingCurrInput.value); // curr is now integer from input

        if ((!isNaN(prev) && prev >= 0) && (!isNaN(curr) && curr >= 0)) {
            // User is providing both meter readings
            electricitySumInput.readOnly = true;
            calculateElectricityFromMeterReadings();
        } else {
            // User has cleared one or both meter readings, or input is incomplete.
            // Revert to allowing manual sum input.
            electricitySumInput.readOnly = false;
            electricitySumInput.value = ''; // Clear sum value
            kwhUsedElement.textContent = '0'; // Clear kwh display
            // Don't clear meter inputs here, user might be in middle of typing
            // If meterReadingCurr is cleared by user, it's fine.
        }
        calculateTotal();
    }

    // Handles input for manual electricity sum, setting readOnly states
    function handleSumInput() {
        if (!electricityCheck.checked) return;

        const sum = parseFloat(electricitySumInput.value);
        const prev = parseFloat(meterReadingPrevInput.value);

        if (!isNaN(sum) && sum > 0) {
            // User is entering manual sum
            calculateElectricityFromSum(); // This now updates kwhUsed and meterReadingCurrInput (rounded)
            meterReadingCurrInput.readOnly = true; // Current reading is always calculated or empty in this mode
            if (isNaN(prev) || prev < 0) {
                // If no valid previous reading, then previous also becomes read-only and cleared
                meterReadingPrevInput.readOnly = true;
                meterReadingPrevInput.value = '';
            } else {
                meterReadingPrevInput.readOnly = false; // Prev reading can be edited
            }
        } else {
            // User has cleared manual sum
            electricitySumInput.readOnly = false;
            meterReadingPrevInput.readOnly = false; // Allow editing of all meter inputs
            meterReadingCurrInput.readOnly = false;
            kwhUsedElement.textContent = '0';
            meterReadingCurrInput.value = ''; // Clear current reading as it's no longer derived
        }
        calculateTotal();
    }

    // Initializes the state of electricity inputs based on checkbox and existing values
    function initElectricityInputs() {
        if (!electricityCheck.checked) {
            electricityInputsDiv.style.display = 'none';
            meterReadingPrevInput.value = '';
            meterReadingCurrInput.value = '';
            electricitySumInput.value = '';
            kwhUsedElement.textContent = '0';
            meterReadingPrevInput.readOnly = false;
            meterReadingCurrInput.readOnly = false;
            electricitySumInput.readOnly = false;
        } else {
            electricityInputsDiv.style.display = 'block';
            const hasPrevReading = meterReadingPrevInput.value !== '';
            const hasCurrReading = meterReadingCurrInput.value !== '';
            const hasManualSum = electricitySumInput.value !== '';

            // Prioritize input states. If values are pre-filled, try to match a mode.
            if (hasManualSum && parseFloat(electricitySumInput.value) > 0) { // Check value if it's set
                handleSumInput(); // Re-evaluate based on sum
            } else if (hasPrevReading && hasCurrReading && parseFloat(meterReadingCurrInput.value) >= parseFloat(meterReadingPrevInput.value)) { // Check values if they are set
                handleMeterInput(); // Re-evaluate based on meters
            } else if (hasPrevReading && parseFloat(meterReadingPrevInput.value) >= 0) {
                // Only previous reading was pre-filled (common after autofill).
                // Leave sum and current empty, allow user to fill either.
                meterReadingCurrInput.value = ''; // Ensure current is cleared
                electricitySumInput.value = ''; // Ensure sum is cleared
                meterReadingPrevInput.readOnly = false;
                meterReadingCurrInput.readOnly = false;
                electricitySumInput.readOnly = false;
                kwhUsedElement.textContent = '0';
            } else {
                // No values pre-filled or invalid, clear everything and make editable.
                meterReadingPrevInput.value = '';
                meterReadingCurrInput.value = '';
                electricitySumInput.value = '';
                kwhUsedElement.textContent = '0';
                meterReadingPrevInput.readOnly = false;
                meterReadingCurrInput.readOnly = false;
                electricitySumInput.readOnly = false;
            }
        }
        calculateTotal();
    }
    // --- End Electricity calculation logic ---

    // Function to calculate total sum
    function calculateTotal() {
        let total = 0;
        let membershipSum = 0;
        let targetSum = 0;
        let electricitySum = 0;

        if (membershipCheck.checked) {
            membershipSum = parseFloat(membershipSumInput.value) || 0;
            total += membershipSum;
            membershipDisplay.textContent = membershipSum.toFixed(2) + ' руб.';
            membershipBreakdown.style.display = 'flex';
        } else {
            membershipBreakdown.style.display = 'none';
        }

        if (targetCheck.checked) {
            targetSum = parseFloat(targetSumInput.value) || 0;
            total += targetSum;
            targetDisplay.textContent = targetSum.toFixed(2) + ' руб.';
            targetBreakdown.style.display = 'flex';
        } else {
            targetBreakdown.style.display = 'none';
        }

        if (electricityCheck.checked) {
            electricitySum = parseFloat(electricitySumInput.value) || 0;
            total += electricitySum;
            electricityDisplay.textContent = electricitySum.toFixed(2) + ' руб.';
            electricityBreakdown.style.display = 'flex';
        } else {
            electricityBreakdown.style.display = 'none';
        }

        totalAmountElement.textContent = total.toFixed(2) + ' руб.';
    }

    // Initial setup (run once on load)
    const initFormState = () => {
        toggleVisibility(membershipCheck, membershipAmountDiv);
        toggleVisibility(targetCheck, targetAmountDiv);
        initElectricityInputs(); // Initialize electricity specific inputs/logic
        
        // Ensure breakdown sections are visible if their checkboxes are checked
        membershipBreakdown.style.display = membershipCheck.checked ? 'flex' : 'none';
        targetBreakdown.style.display = targetCheck.checked ? 'flex' : 'none';
        electricityBreakdown.style.display = electricityCheck.checked ? 'flex' : 'none';
        
        calculateTotal(); // Final total calculation after initial states
    };

    // --- Autocomplete/Autofill Logic for Plot Number ---
    function autofillPlotData(plotNum) {
        const foundPlot = plotData.find(p => p.plotNumber.toUpperCase() === plotNum.toUpperCase());

        if (foundPlot) {
            payerNameInput.value = foundPlot.payerName || '';
            plotSotkasInput.value = (foundPlot.plotSotkas !== undefined && foundPlot.plotSotkas !== null) ? foundPlot.plotSotkas.toFixed(2) : '';
            membershipSumInput.value = (foundPlot.plotSotkas !== undefined && foundPlot.plotSotkas !== null && foundPlot.plotSotkas > 0) ? (foundPlot.plotSotkas * MEMBERSHIP_TARIFF).toFixed(2) : '';

            targetSumInput.value = (foundPlot.targetSum !== undefined && foundPlot.targetSum !== null) ? foundPlot.targetSum.toFixed(2) : '';
            meterReadingPrevInput.value = (foundPlot.meterReadingPrev !== undefined && foundPlot.meterReadingPrev !== null) ? foundPlot.meterReadingPrev : '';
            meterReadingCurrInput.value = ''; // Always clear current reading for new input
            electricitySumInput.value = ''; // Always clear manual electricity sum for new autofill

            // Also check checkboxes if corresponding sums/data are present
            membershipCheck.checked = (parseFloat(plotSotkasInput.value) > 0) || (parseFloat(membershipSumInput.value) > 0);
            targetCheck.checked = parseFloat(targetSumInput.value) > 0;
            electricityCheck.checked = meterReadingPrevInput.value !== ''; // Check if there's a previous reading
        } else {
            // Clear fields if no matching plot is found
            payerNameInput.value = '';
            plotSotkasInput.value = '';
            membershipSumInput.value = ''; // Also clear derived sum
            targetSumInput.value = '';
            meterReadingPrevInput.value = '';
            meterReadingCurrInput.value = '';
            electricitySumInput.value = ''; // Also clear derived sum

            // Do not uncheck checkboxes automatically, let user decide payment types
            // membershipCheck.checked = false;
            // targetCheck.checked = false;
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
            alert('Не удалось загрузить данные участков для автозаполнения. Пожалуйста, введите данные вручную.');
        });
    // --- End Autocomplete/Autofill Logic ---

    initFormState(); // Call initial setup once after data is potentially loaded

    // Centralized validation function
    function validateForm() {
        // Validate payer name
        if (payerNameInput.value.trim() === '') {
            alert('Пожалуйста, введите ФИО плательщика.');
            payerNameInput.focus();
            return false;
        }

        // Validate plot number using the pattern
        const plotNumber = plotNumberInput.value.trim();
        if (!plotNumberInput.checkValidity()) {
            alert('Номер участка должен содержать только цифры и может заканчиваться одной буквой (А-Яа-я).');
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
            electricitySum: 0
        };

        let calculatedTotal = 0;

        if (membershipCheck.checked) {
            formData.paymentTypes.push('Членские взносы');
            formData.membershipSum = parseFloat(membershipSumInput.value) || 0;
            if (formData.membershipSum <= 0) {
                alert('Сумма членских взносов должна быть больше нуля.');
                membershipSumInput.focus();
                return false;
            }
            calculatedTotal += formData.membershipSum;
        }
        
        if (targetCheck.checked) {
            formData.paymentTypes.push('Целевые взносы');
            formData.targetSum = parseFloat(targetSumInput.value) || 0;
            if (formData.targetSum <= 0) {
                alert('Сумма целевых взносов должна быть больше нуля.');
                targetSumInput.focus();
                return false;
            }
            calculatedTotal += formData.targetSum;
        }
        
        if (electricityCheck.checked) {
            formData.paymentTypes.push('Электроэнергия');
            formData.electricitySum = parseFloat(electricitySumInput.value) || 0;
            if (formData.electricitySum <= 0) {
                alert('Сумма за электроэнергию должна быть больше нуля.');
                electricitySumInput.focus();
                return false;
            }
            // Additional check for meter readings if electricity is selected and not in manual sum mode
            if (electricitySumInput.readOnly) { // If electricity sum is read-only, it means meter readings are the primary input
                const prevReading = parseFloat(meterReadingPrevInput.value);
                const currReading = parseFloat(meterReadingCurrInput.value);
                if (isNaN(prevReading) || prevReading < 0) {
                    alert('Пожалуйста, введите корректные предыдущие показания счетчика.');
                    meterReadingPrevInput.focus();
                    return false;
                }
                if (isNaN(currReading) || currReading < 0) {
                    alert('Пожалуйста, введите корректные текущие показания счетчика (целое число).');
                    meterReadingCurrInput.focus();
                    return false;
                }
                if (currReading < prevReading) {
                    alert('Текущие показания счетчика не могут быть меньше предыдущих.');
                    meterReadingCurrInput.focus();
                    return false;
                }
            }
            calculatedTotal += formData.electricitySum;
        }

        formData.totalAmount = calculatedTotal; // Assign the calculated total

        if (formData.paymentTypes.length === 0) {
            alert('Пожалуйста, выберите хотя бы один тип платежа.');
            return false;
        }

        if (formData.totalAmount <= 0) {
            alert('Общая сумма должна быть больше нуля. Проверьте введенные суммы.');
            return false;
        }

        return formData; // Return collected data if validation passes
    }

    // Event listeners
    membershipCheck.addEventListener('change', initFormState);
    targetCheck.addEventListener('change', initFormState);
    electricityCheck.addEventListener('change', initElectricityInputs); // Direct call for more precise control

    // Specific handler for plotSotkasInput (now type="text")
    plotSotkasInput.addEventListener('input', function() {
        this.value = this.value.replace(',', '.'); // Replace comma with dot for decimal input
        // Ensure value is not negative (mimicking min="0" from original type="number")
        if (parseFloat(this.value) < 0) {
            this.value = '0';
        }
        updateMembershipSumFromSotkas(); // Recalculate based on potentially changed value
    });

    membershipSumInput.addEventListener('input', updateSotkasFromMembershipSum);

    meterReadingPrevInput.addEventListener('input', handleMeterInput);
    meterReadingCurrInput.addEventListener('input', handleMeterInput);
    electricitySumInput.addEventListener('input', handleSumInput);

    targetSumInput.addEventListener('input', calculateTotal);

    // Event listener for plot number input to trigger autofill
    plotNumberInput.addEventListener('input', function() {
        autofillPlotData(this.value);
    });

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
    
    // Function to generate QR code data URL
    async function generateQrCodeDataURLForPayment(formData, purposeString) {
        const totalAmountKopecks = (formData.totalAmount * 100).toFixed(0);

        const paymentString =
            `ST00012|Name=${REQUISITES.Name}` +
            `|PersonalAcc=${REQUISITES.PersonalAcc}` +
            `|BankName=${REQUISITES.BankName}` +
            `|BIC=${REQUISITES.BIC}` +
            `|CorrespAcc=${REQUISITES.CorrespAcc}` +
            `|PayeeINN=${REQUISITES.PayeeINN}` +
            (REQUISITES.KPP ? `|KPP=${REQUISITES.KPP}` : '') +
            `|Sum=${totalAmountKopecks}` +
            `|Purpose=${purposeString}`;

        try {
            // Generate QR code data URL with a size suitable for the receipt
            const qrDataURL = await QRCode.toDataURL(paymentString, { width: 90, errorCorrectionLevel: 'H' }); // 90px source will be around 25mm print
            return qrDataURL;
        } catch (error) {
            console.error('Error generating QR code data URL:', error);
            return null;
        }
    }

    // Function to generate QR code and display it on the main canvas
    async function displayQrCodeOnCanvas() {
        const formData = validateForm();
        if (!formData) {
            const context = qrCanvas.getContext('2d');
            context.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
            if (downloadQrBtn) downloadQrBtn.disabled = true;
            return;
        }

        let purposeParts = [];
        if (formData.membershipSum > 0) {
            purposeParts.push(`Членские взносы: ${formData.membershipSum.toFixed(2)} руб.`);
        }
        if (formData.targetSum > 0) {
            purposeParts.push(`Целевые взносы: ${formData.targetSum.toFixed(2)} руб.`);
        }
        if (formData.electricitySum > 0) {
            const kwhUsed = parseFloat(kwhUsedElement.textContent) || 0; // Get actual displayed kWh
            purposeParts.push(`Электроэнергия: ${formData.electricitySum.toFixed(2)} руб. (${kwhUsed} кВт)`);
        }
        let purposeString = '';
        if (purposeParts.length > 0) {
            purposeString = purposeParts.join(', ') + ` за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;
        } else {
            // Fallback if no payment types are selected (though validation should prevent this)
            purposeString = `Оплата за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;
        }

        const totalAmountKopecks = (formData.totalAmount * 100).toFixed(0);

        const paymentString =
            `ST00012|Name=${REQUISITES.Name}` +
            `|PersonalAcc=${REQUISITES.PersonalAcc}` +
            `|BankName=${REQUISITES.BankName}` +
            `|BIC=${REQUISITES.BIC}` +
            `|CorrespAcc=${REQUISITES.CorrespAcc}` +
            `|PayeeINN=${REQUISITES.PayeeINN}` +
            (REQUISITES.KPP ? `|KPP=${REQUISITES.KPP}` : '') +
            `|Sum=${totalAmountKopecks}` +
            `|Purpose=${purposeString}`;
        
        QRCode.toCanvas(qrCanvas, paymentString, { width: 280, errorCorrectionLevel: 'H' }, function (error) {
            if (error) {
                console.error('Error generating QR code:', error);
                alert('Ошибка при генерации QR-кода!');
                if (downloadQrBtn) downloadQrBtn.disabled = true;
                const context = qrCanvas.getContext('2d');
                context.clearRect(0, 0, qrCanvas.width, qrCanvas.height);
            } else {
                if (downloadQrBtn) downloadQrBtn.disabled = false;
            }
        });
    }
    
    // Function to create one part of the receipt (Notice or Receipt)
    function createReceiptPart(title, data, amountInWords, formattedDate, qrCodeDataURL = null) {
        const purpose = data.paymentTypes.join(', ');
        
        // Form payment details
        let paymentDetails = [];
        if (data.membershipSum > 0) paymentDetails.push(`Членские взносы: ${data.membershipSum.toFixed(2)} руб.`);
        if (data.targetSum > 0) paymentDetails.push(`Целевые взносы: ${data.targetSum.toFixed(2)} руб.`);
        if (data.electricitySum > 0) paymentDetails.push(`Электроэнергия: ${data.electricitySum.toFixed(2)} руб.`);
        
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
                        <div class="receipt-field-value"> ${purpose} за участок № ${data.plotNumber}</div>
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
            purposeParts.push(`Членские взносы: ${formData.membershipSum.toFixed(2)} руб.`);
        }
        if (formData.targetSum > 0) {
            purposeParts.push(`Целевые взносы: ${formData.targetSum.toFixed(2)} руб.`);
        }
        if (formData.electricitySum > 0) {
            const kwhUsed = parseFloat(kwhUsedElement.textContent) || 0; // Get actual displayed kWh
            purposeParts.push(`Электроэнергия: ${formData.electricitySum.toFixed(2)} руб. (${kwhUsed} кВт)`);
        }
        let purposeString = '';
        if (purposeParts.length > 0) {
            purposeString = purposeParts.join(', ') + ` за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;
        } else {
            // Fallback if no payment types are selected (though validation should prevent this)
            purposeString = `Оплата за участок № ${formData.plotNumber}, ФИО: ${formData.payerName}`;
        }

        // Generate QR code data URL for the receipt
        const qrCodeForReceipt = await generateQrCodeDataURLForPayment(formData, purposeString);

        // Create receipt content
        const receiptContentHTML = `
            ${createReceiptPart('Извещение', formData, amountInWords, formattedDate, qrCodeForReceipt)}
            <div class="receipt-tear-line"></div>
            ${createReceiptPart('Квитанция', formData, amountInWords, formattedDate, null)} <!-- No QR for Kvitantsiya -->
        `;

        document.getElementById(ELEM_RECEIPT_CONTENT).innerHTML = receiptContentHTML;
        modal.style.display = 'block';
    });

    // QR code generation handler (for the main page QR display)
    generateQrBtn.addEventListener('click', displayQrCodeOnCanvas);

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
            border-radius: 4px;
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

    // QR code download handler
    downloadQrBtn.addEventListener('click', function() {
        if (!qrCanvas || qrCanvas.width === 0 || qrCanvas.height === 0) {
            alert('Сначала сгенерируйте QR-код!');
            return;
        }
        const link = document.createElement('a');
        const fileNamePlot = plotNumberInput.value.replace(/[^a-zA-Zа-яА-Я0-9]/g, '_'); // Sanitize plot number
        const fileNamePayer = payerNameInput.value.replace(/[^a-zA-Zа-яА-Я0-9\s]/g, '').replace(/\s+/g, '_'); // Sanitize payer name
        link.download = `snt-beryozka-2_plot-${fileNamePlot}_${fileNamePayer}.png`;
        link.href = qrCanvas.toDataURL('image/png');
        link.click();
    });

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