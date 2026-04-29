// sync.js - синхронизация данных между вкладками
class DataSync {
    constructor() {
        this.listeners = [];
        this.setupListener();
    }

    setupListener() {
        window.addEventListener('storage', (e) => {
            if (e.key === 'plotData' && e.newValue) {
                try {
                    const newData = JSON.parse(e.newValue);
                    this.notifyListeners('plotData', newData);
                } catch (err) {
                    console.error('Error parsing plotData:', err);
                }
            }
            if (e.key === 'membershipTariff' && e.newValue) {
                this.notifyListeners('membershipTariff', parseFloat(e.newValue));
            }
            if (e.key === 'electricityTariff' && e.newValue) {
                this.notifyListeners('electricityTariff', parseFloat(e.newValue));
            }
        });
    }

    subscribe(callback) {
        this.listeners.push(callback);
    }

    notifyListeners(key, value) {
        this.listeners.forEach(cb => {
            try {
                cb(key, value);
            } catch (err) {
                console.error('Error in sync listener:', err);
            }
        });
    }

    static savePlotData(data) {
        localStorage.setItem('plotData', JSON.stringify(data));
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'plotData',
            newValue: JSON.stringify(data)
        }));
    }

    static saveMembershipTariff(value) {
        localStorage.setItem('membershipTariff', value.toString());
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'membershipTariff',
            newValue: value.toString()
        }));
    }

    static saveElectricityTariff(value) {
        localStorage.setItem('electricityTariff', value.toString());
        window.dispatchEvent(new StorageEvent('storage', {
            key: 'electricityTariff',
            newValue: value.toString()
        }));
    }

    static getPlotData() {
        const data = localStorage.getItem('plotData');
        return data ? JSON.parse(data) : null;
    }

    static getMembershipTariff() {
        const tariff = localStorage.getItem('membershipTariff');
        return tariff ? parseFloat(tariff) : 1450;
    }

    static getElectricityTariff() {
        const tariff = localStorage.getItem('electricityTariff');
        return tariff ? parseFloat(tariff) : 3.82;
    }
}

// Создаем глобальный экземпляр
window.dataSync = new DataSync();
