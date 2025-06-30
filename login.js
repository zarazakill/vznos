document.addEventListener('DOMContentLoaded', function() {
    const loginForm = document.getElementById('loginForm');
    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');

    // Проверяем, не авторизован ли уже пользователь
    if (localStorage.getItem('adminAuthenticated') === 'true') {
        window.location.href = 'admin.html';
        return;
    }

    loginForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const username = usernameInput.value.trim();
        const password = passwordInput.value;
        
        // Получаем сохраненные учетные данные или используем дефолтные
        const savedCredentials = JSON.parse(localStorage.getItem('adminCredentials') || '{"username": "admin", "password": "admin"}');
        
        if (username === savedCredentials.username && password === savedCredentials.password) {
            // Успешная авторизация
            localStorage.setItem('adminAuthenticated', 'true');
            localStorage.setItem('adminLoginTime', Date.now().toString());
            
            showNotification('Добро пожаловать в админ панель!', 'success');
            
            setTimeout(() => {
                window.location.href = 'admin.html';
            }, 1000);
        } else {
            showNotification('Неверный логин или пароль!', 'error');
            passwordInput.value = '';
            passwordInput.focus();
        }
    });

    // Функция для показа уведомлений
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

