// Owner-confirmed current tariffs. effectiveFrom is omitted until provided.
window.SNT_TARIFFS = Object.freeze({
    schemaVersion: 1,
    currency: 'RUB',
    units: Object.freeze({
        membershipTariff: 'per sotka',
        electricityTariff: 'per kWh'
    }),
    membershipTariff: 1750,
    electricityTariff: 4.21
});
