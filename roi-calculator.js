// WARDEN ROI Calculator - Logic
// Pure Vanilla JS for maximum sparkles and zero dependencies! (◕‿◕)★

document.addEventListener('DOMContentLoaded', () => {
    // 1. Generate Cosmic Stars
    const starField = document.getElementById('star-field');
    if (starField) {
        for (let i = 0; i < 150; i++) {
            const star = document.createElement('div');
            star.className = 'star';
            const size = Math.random() * 2 + 'px';
            star.style.width = size;
            star.style.height = size;
            star.style.top = Math.random() * 100 + '%';
            star.style.left = Math.random() * 100 + '%';
            star.style.setProperty('--d', (Math.random() * 3 + 2) + 's');
            starField.appendChild(star);
        }
    }

    // 2. ROI Configuration
    const inputs = {
        agents: document.getElementById('in-agents'),
        hours: document.getElementById('in-hours'),
        cost: document.getElementById('in-cost')
    };

    const displays = {
        agents: document.getElementById('val-agents'),
        hours: document.getElementById('val-hours'),
        cost: document.getElementById('val-cost'),
        monthlyHours: document.getElementById('res-monthly-hours'),
        monthlyCash: document.getElementById('res-monthly-cash'),
        annualCash: document.getElementById('res-annual-cash')
    };

    // 3. Calculation Engine
    function update() {
        const agents = parseInt(inputs.agents.value) || 0;
        const hours = parseInt(inputs.hours.value) || 0;
        const cost = parseInt(inputs.cost.value) || 0;

        // Update Input Badges
        if (displays.agents) displays.agents.innerText = agents;
        if (displays.hours) displays.hours.innerText = hours;
        if (displays.cost) displays.cost.innerText = `$${cost}`;

        // The Magic Math ♪
        const monthlyHours = agents * hours;
        const monthlyCash = monthlyHours * cost;
        const annualCash = monthlyCash * 12;

        // Update Result Cards
        if (displays.monthlyHours) displays.monthlyHours.innerText = monthlyHours.toLocaleString();
        if (displays.monthlyCash) displays.monthlyCash.innerText = `$${monthlyCash.toLocaleString()}`;
        if (displays.annualCash) displays.annualCash.innerText = `$${annualCash.toLocaleString()}`;
    }

    // 4. Event Binding
    Object.values(inputs).forEach(input => {
        if (input) {
            input.addEventListener('input', update);
        }
    });

    // Initial Run
    update();
});
