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

    static getPlotData() {
        const data = localStorage.getItem('plotData');
        return data ? JSON.parse(data) : null;
    }

    static getMembershipTariff() {
        return window.SNT_TARIFFS.membershipTariff;
    }

    static getElectricityTariff() {
        return window.SNT_TARIFFS.electricityTariff;
    }
}

// Создаем глобальный экземпляр
window.dataSync = new DataSync();
