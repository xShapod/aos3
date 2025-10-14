let servers = [];
let currentCategory = 'all';

// Load servers from localStorage
document.addEventListener('DOMContentLoaded', function() {
    const savedServers = localStorage.getItem('ispServers');
    if (savedServers) {
        try {
            servers = JSON.parse(savedServers);
            // Ensure all servers have a 'categories' array for filtering robustness
            servers.forEach(server => {
                if (!server.categories) {
                    server.categories = [server.category || 'others'];
                }
            });
        } catch (e) {
            console.error("Error parsing stored server data in settings:", e);
            // If data is corrupt, stop here but don't overwrite if we don't know the state
        }
    }
    
    renderServerList(currentCategory);
    setupEventListeners();
});

// Render server list for sorting
function renderServerList(category) {
    const serverList = document.getElementById('serverList');
    serverList.innerHTML = '';
    
    let filteredServers = servers;
    
    if (category !== 'all') {
        // Filter by checking if the server's categories array includes the selected category
        filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(category));
    }
    
    // Sort by current rank
    filteredServers.sort((a, b) => a.rank - b.rank);
    
    if (filteredServers.length === 0) {
        serverList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-server"></i>
                <h3>No servers found</h3>
                <p>Add some servers in the main page first</p>
            </div>
        `;
        return;
    }
    
    filteredServers.forEach((server, index) => {
        const serverListItem = document.createElement('div');
        serverListItem.className = 'server-list-item';
        serverListItem.setAttribute('data-id', server.id);
        
        serverListItem.innerHTML = `
            <div class="server-rank-number" data-rank="${server.rank}">${server.rank}</div>
            <div class="server-list-info">
                <div class="server-list-name">${server.name}</div>
                <div class="server-list-address">${server.address}</div>
                <div class="server-list-category">${getCategoryDisplayNames(server.categories).join(', ')}</div>
            </div>
            <div class="rank-controls">
                <button class="rank-btn move-up" onclick="moveServerUp(${server.id}, '${category}')" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button class="rank-btn move-down" onclick="moveServerDown(${server.id}, '${category}')" ${index === filteredServers.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        `;
        serverList.appendChild(serverListItem);
    });
}

// Helper to get array of display names
function getCategoryDisplayNames(categories) {
    const displayNames = {
        'live': 'Live TV',
        'movies': 'Movies',
        'series': 'Series',
        'others': 'Others'
    };
    return categories.map(cat => displayNames[cat] || cat);
}

// Move server up in the ranked list
function moveServerUp(id, category) {
    const serverIndex = servers.findIndex(s => s.id === id);
    if (serverIndex > 0) {
        // Find the full list of servers for the current category, sorted by rank
        let filteredServers = servers;
        if (category !== 'all') {
             filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(category));
        }
        filteredServers.sort((a, b) => a.rank - b.rank);

        const currentServerIndexInFiltered = filteredServers.findIndex(s => s.id === id);

        if (currentServerIndexInFiltered > 0) {
            const currentServer = filteredServers[currentServerInFiltered];
            const prevServer = filteredServers[currentServerInFiltered - 1];

            // Swap ranks in the main servers array
            [currentServer.rank, prevServer.rank] = [prevServer.rank, currentServer.rank];
            
            // Re-sort the main array by the new ranks
            servers.sort((a, b) => a.rank - b.rank);

            saveServers();
            renderServerList(category);
            showToast(`Moved "${currentServer.name}" up!`);
        }
    }
}

// Move server down in the ranked list
function moveServerDown(id, category) {
    const serverIndex = servers.findIndex(s => s.id === id);
    if (serverIndex !== -1) {
        // Find the full list of servers for the current category, sorted by rank
        let filteredServers = servers;
        if (category !== 'all') {
             filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(category));
        }
        filteredServers.sort((a, b) => a.rank - b.rank);
        
        const currentServerIndexInFiltered = filteredServers.findIndex(s => s.id === id);

        if (currentServerIndexInFiltered < filteredServers.length - 1) {
            const currentServer = filteredServers[currentServerIndexInFiltered];
            const nextServer = filteredServers[currentServerIndexInFiltered + 1];

            // Swap ranks in the main servers array
            [currentServer.rank, nextServer.rank] = [nextServer.rank, currentServer.rank];
            
            // Re-sort the main array by the new ranks
            servers.sort((a, b) => a.rank - b.rank);

            saveServers();
            renderServerList(category);
            showToast(`Moved "${currentServer.name}" down!`);
        }
    }
}

// Save New Order (already handled by move functions, but this is a confirmation step)
function saveNewOrder() {
    // The ranks are already updated in localStorage by moveServerUp/Down.
    // This function can be used to ensure the final sorted state is written cleanly.
    
    // 1. Re-calculate ranks sequentially just in case of any gaps/errors
    servers.sort((a, b) => a.rank - b.rank);
    servers.forEach((server, index) => {
        server.rank = index + 1;
    });

    saveServers();
    renderServerList(currentCategory);
    showToast('Manual order saved successfully!', 'success');
}

// Reset ranks to default creation order
function resetToDefaultOrder() {
    if (!confirm("Are you sure you want to reset the manual order to the order servers were added?")) {
        return;
    }
    
    // Sort by createdAt time, which is the default/creation time.
    servers.sort((a, b) => a.createdAt - b.createdAt);
    
    // Apply new sequential ranks
    servers.forEach((server, index) => {
        server.rank = index + 1;
    });
    
    saveServers();
    renderServerList(currentCategory);
    showToast('Manual order reset to default (creation order).', 'warning');
}


function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    
    // Category tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.getAttribute('data-category');
            renderServerList(currentCategory);
        });
    });
    
    // Save order button
    document.getElementById('saveOrder').addEventListener('click', saveNewOrder);
    
    // Reset order button
    document.getElementById('resetOrder').addEventListener('click', resetToDefaultOrder);
}

// Show toast notification (Copied from app.js for isolated functionality)
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    // MODIFIED: Check for 'warning' and set background accordingly
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : 'var(--success)');
    // MODIFIED: Set text color for better contrast on warnings
    toast.style.color = type === 'warning' ? 'var(--dark)' : 'white';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Save servers to localStorage
function saveServers() {
    localStorage.setItem('ispServers', JSON.stringify(servers));
}

