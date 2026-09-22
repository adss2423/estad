document.addEventListener('DOMContentLoaded', () => {
    const toggleButton = document.getElementById('btn-theme-toggle');
    if (!toggleButton) return;

    const applyTheme = (theme) => {
        const isDark = theme === 'dark';
        document.documentElement.setAttribute('data-theme', isDark ? 'dark' : 'light');
        toggleButton.innerHTML = isDark
            ? '<i class="bi bi-sun-fill me-1"></i> Modo claro'
            : '<i class="bi bi-moon-stars-fill me-1"></i> Modo oscuro';
    };

    const storedTheme = localStorage.getItem('theme');
    const currentTheme = document.documentElement.getAttribute('data-theme');
    const defaultTheme = storedTheme || currentTheme || (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
    applyTheme(defaultTheme);

    toggleButton.addEventListener('click', () => {
        const isDarkNow = document.documentElement.getAttribute('data-theme') === 'dark';
        const nextTheme = isDarkNow ? 'light' : 'dark';
        applyTheme(nextTheme);
        localStorage.setItem('theme', nextTheme);
    });
});
