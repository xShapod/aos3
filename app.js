// =====================
// DATA STORAGE
// =====================
let servers = [];

// Load servers from localStorage if available
if (localStorage.getItem('servers')) {
    servers = JSON.parse(localStorage.getItem('servers'));
}

// =====================
// DOM ELEMENTS
// =====================
const serverGrid = document.getElementById('serverGrid');
const addServerBtn = document.getElementById('addServerBtn');
const saveServerBtn = document.getElementById('saveServerBtn');
const searchInput = document.querySelector('.search input');
const sortButtons = document.querySelectorAll('.sort-btn');

// Add Server Form Inputs
const serverNameInput = document.getElementById('serverName');
const serverAddressInput = document.getElementById('serverAddress');
const serverDescInput = document.getElementById('serverDesc');
const categoryCheckboxes = document.querySelectorAll('.categories-checkboxes input[type="checkbox"]');

// =====================
// RENDER SERVERS
// =====================
function renderServers(filter = '', status = 'All') {
    serverGrid.innerHTML = '';

    let filteredServers = servers.filter(server => 
        server.name.toLowerCase().includes(filter.toLowerCase())
    );

    if (status !== 'All') {
        filteredServers = filteredServers.filter(server => server.status === status);
    }

    if (filteredServers.length === 0) {
        serverGrid.innerHTML = `<div class="empty-state"><i class="fas fa-server"></i><p>No servers found.</p></div>`;
        return;
    }

    filteredServers.forEach((server, index) => {
        const serverCard = document.createElement('div');
        serverCard.classList.add('server-card');

        serverCard.innerHTML = `
            <div class="server-header">
                <div>
                    <div class="server-name">${server.name}</div>
                    <div class="server-status ${server.status.toLowerCase()}">${server.status}</div>
                </div>
                <div class="favorite-star ${server.favorite ? 'favorited' : ''}">
                    <i class="fas fa-star"></i>
                </div>
            </div>
            <div class="server-address">${server.address}</div>
            <div class="server-description">${server.description}</div>
            <div class="server-categories">
                ${server.categories.map(cat => `<span class="server-category">${cat}</span>`).join('')}
            </div>
        `;

        // Toggle favorite
        serverCard.querySelector('.favorite-star').addEventListener('click', () => {
            server.favorite = !server.favorite;
            saveServers();
            renderServers(searchInput.value, getActiveSort());
        });

        serverGrid.appendChild(serverCard);
    });
}

// =====================
// SAVE SERVERS
// =====================
function saveServers() {
    localStorage.setItem('servers', JSON.stringify(servers));
}

// =====================
// ADD NEW SERVER
// =====================
saveServerBtn.addEventListener('click', () => {
    const name = serverNameInput.value.trim();
    const address = serverAddressInput.value.trim();
    const description = serverDescInput.value.trim();
    const categories = Array.from(categoryCheckboxes)
        .filter(cb => cb.checked)
        .map(cb => cb.value);

    if (!name || !address) {
        alert('Please fill server name and address!');
        return;
    }

    const newServer = {
        name,
        address,
        description,
        categories,
        status: 'Active',
        favorite: false
    };

    servers.push(newServer);
    saveServers();
    renderServers();
    resetForm();
    alert('Server added successfully!');
});

// Reset Add Server Form
function resetForm() {
    serverNameInput.value = '';
    serverAddressInput.value = '';
    serverDescInput.value = '';
    categoryCheckboxes.forEach(cb => cb.checked = false);
}

// =====================
// SEARCH FILTER
// =====================
searchInput.addEventListener('input', (e) => {
    renderServers(e.target.value, getActiveSort());
});

// =====================
// SORT BUTTONS
// =====================
sortButtons.forEach(btn => {
    btn.addEventListener('click', () => {
        sortButtons.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        renderServers(searchInput.value, getActiveSort());
    });
});

function getActiveSort() {
    const activeBtn = document.querySelector('.sort-btn.active');
    return activeBtn ? activeBtn.textContent : 'All';
}

// =====================
// INITIAL RENDER
// =====================
renderServers();