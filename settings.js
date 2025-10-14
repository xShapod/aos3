let servers = [];
let currentCategory = 'all';

// Load servers from localStorage
document.addEventListener('DOMContentLoaded', function() {
    const savedServers = localStorage.getItem('ispServers');
    if (savedServers) {
        servers = JSON.parse(savedServers);
        // Ensure all servers have a 'categories' array for filtering robustness
        servers.forEach(server => {
            if (!server.categories) {
                server.categories = [server.category || 'others'];
            }
        });
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
        // Ensure server.categories is treated as an array
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
        const listItem = document.createElement('div');
        listItem.className = 'server-list-item';
        listItem.setAttribute('data-id', server.id);
        
        // Safely display the first category from the categories array
        const primaryCategory = server.categories && server.categories.length > 0 ? server.categories[0] : 'others';

        listItem.innerHTML = `
            <div class="server-rank-number">${index + 1}</div>
            <div class="server-list-info">
                <div class="server-list-name">${server.name}</div>
                <div class="server-list-address">${server.address}</div>
            </div>
            <div class="server-list-category">${getCategoryDisplayName(primaryCategory)}</div>
            <div class="rank-controls">
                <button class="rank-btn" onclick="moveServerUp(${server.id})" ${index === 0 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-up"></i>
                </button>
                <button class="rank-btn" onclick="moveServerDown(${server.id})" ${index === filteredServers.length - 1 ? 'disabled' : ''}>
                    <i class="fas fa-arrow-down"></i>
                </button>
            </div>
        `;
        
        serverList.appendChild(listItem);
    });
}

// Get display name for category
function getCategoryDisplayName(category) {
    const categories = {
        'live': 'Live TV',
        'movies': 'Movies',
        'series': 'Series',
        'others': 'Others'
    };
    return categories[category] || category;
}

// Move server up in the current filtered list (manual rank order only)
function moveServerUp(id) {
    // We only modify the global 'servers' array, so we need to find the full server object.
    const currentServer = servers.find(server => server.id === id);
    if (!currentServer) return;

    // Filter and sort the servers based on the current category and rank order to find the neighbor
    let filteredServers = servers;
    if (currentCategory !== 'all') {
        filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(currentCategory));
    }
    filteredServers.sort((a, b) => a.rank - b.rank);
    
    const filteredIndex = filteredServers.findIndex(server => server.id === id);
    if (filteredIndex === 0 || filteredIndex === -1) return; // Cannot move up
    
    const aboveServer = filteredServers[filteredIndex - 1];

    // Swap ranks between the two servers in the *global* list
    const tempRank = currentServer.rank;
    currentServer.rank = aboveServer.rank;
    aboveServer.rank = tempRank;
    
    // Note: The move is only in rank, not array position. The next render will reflect the change.
    saveServers();
    renderServerList(currentCategory);
    showToast('Server moved up!');
}

// Move server down in the current filtered list (manual rank order only)
function moveServerDown(id) {
    const currentServer = servers.find(server => server.id === id);
    if (!currentServer) return;
    
    // Filter and sort the servers based on the current category and rank order to find the neighbor
    let filteredServers = servers;
    if (currentCategory !== 'all') {
        filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(currentCategory));
    }
    filteredServers.sort((a, b) => a.rank - b.rank);
    
    const filteredIndex = filteredServers.findIndex(server => server.id === id);
    if (filteredIndex === filteredServers.length - 1 || filteredIndex === -1) return; // Cannot move down
    
    const belowServer = filteredServers[filteredIndex + 1];

    // Swap ranks between the two servers in the *global* list
    const tempRank = currentServer.rank;
    currentServer.rank = belowServer.rank;
    belowServer.rank = tempRank;
    
    // Note: The move is only in rank, not array position. The next render will reflect the change.
    saveServers();
    renderServerList(currentCategory);
    showToast('Server moved down!');
}

// Save the new order
function saveNewOrder() {
    // Reassign ranks based on current order to ensure they're sequential
    // This is important after drag/drop or repeated moves to clean up the ranks
    let currentFilteredServers = servers;
    if (currentCategory !== 'all') {
        currentFilteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(currentCategory));
    }
    currentFilteredServers.sort((a, b) => a.rank - b.rank);
    
    // Reassign sequential ranks only to the filtered list
    currentFilteredServers.forEach((server, index) => {
        server.rank = index + 1;
    });

    // Re-save the entire list to ensure consistency
    saveServers();
    showToast('Server order saved successfully!');
}

// Reset to default order (by name)
function resetToDefaultOrder() {
    if (confirm('Are you sure you want to reset the order to alphabetical for all servers?')) {
        // Sort the entire list by name alphabetically
        servers.sort((a, b) => a.name.localeCompare(b.name));
        
        // Update ranks based on new order
        servers.forEach((server, index) => {
            server.rank = index + 1;
        });
        
        saveServers();
        renderServerList(currentCategory);
        showToast('Order reset to alphabetical!');
    }
}

// Set up event listeners for settings page
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

// Show toast notification
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
