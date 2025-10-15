let servers = [];
let currentCategory = 'all';
let sortable = null;

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
    initializeDragAndDrop();
});

// Initialize drag and drop functionality
function initializeDragAndDrop() {
    const serverList = document.getElementById('serverList');
    
    sortable = Sortable.create(serverList, {
        animation: 150,
        handle: '.server-list-item',
        ghostClass: 'sortable-ghost',
        chosenClass: 'sortable-chosen',
        dragClass: 'sortable-drag',
        onEnd: function(evt) {
            updateRanksAfterDrag();
            showToast('Order updated! Don\'t forget to save.', 'warning');
        }
    });
}

// Update ranks after drag and drop
function updateRanksAfterDrag() {
    const serverList = document.getElementById('serverList');
    const items = serverList.querySelectorAll('.server-list-item');
    
    items.forEach((item, index) => {
        const serverId = parseInt(item.getAttribute('data-id'));
        const server = servers.find(s => s.id === serverId);
        if (server) {
            server.rank = index + 1;
        }
    });
    
    // Update the displayed rank numbers
    updateRankNumbers();
}

// Update displayed rank numbers
function updateRankNumbers() {
    const items = document.querySelectorAll('.server-list-item');
    items.forEach((item, index) => {
        const rankNumber = item.querySelector('.server-rank-number');
        if (rankNumber) {
            rankNumber.textContent = index + 1;
        }
    });
}

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
                <div class="server-list-meta">
                    <span class="server-type ${server.type}">${server.type === 'bdix' ? 'BDIX' : 'Non-BDIX'}</span>
                    <span class="server-status ${server.status}">${server.status === 'active' ? 'Online' : 'Offline'}</span>
                    ${server.lastResponseTime ? `<span class="response-time">${server.lastResponseTime}ms</span>` : ''}
                </div>
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

// ==================== BULK OPERATIONS ====================

// Bulk status check for all servers
async function checkAllServersStatus() {
    showToast('Checking status of all servers...');
    
    for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        await checkServerStatus(server);
        
        // Add delay between checks to avoid overwhelming
        if (i < servers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    showToast('All servers status updated!');
    renderServerList(currentCategory);
}

// Enhanced Real server status checking with response time measurement
async function checkServerStatus(server) {
    // Show checking status immediately
    server.status = 'checking';
    server.lastChecked = Date.now();
    saveServers();
    renderServerList(currentCategory);

    const startTime = performance.now();
    
    try {
        // Use a more robust approach for BDIX servers
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 8000);
        
        const response = await fetch(server.address, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-cache',
            signal: controller.signal,
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        
        clearTimeout(timeoutId);
        
        // Even with no-cors, if we reach here, the server responded
        const responseTime = performance.now() - startTime;
        server.status = 'active';
        server.lastChecked = Date.now();
        server.lastResponseTime = Math.round(responseTime);
        
    } catch (error) {
        // Try alternative method - create image request
        await checkServerWithImage(server, startTime);
    } finally {
        saveServers();
        renderServerList(currentCategory);
    }
}

// Enhanced alternative method using Image request with response time
function checkServerWithImage(server, startTime) {
    return new Promise((resolve) => {
        const img = new Image();
        const timeout = setTimeout(() => {
            server.status = 'inactive';
            server.lastChecked = Date.now();
            server.lastResponseTime = null;
            resolve();
        }, 8000);

        img.onload = function() {
            clearTimeout(timeout);
            const responseTime = performance.now() - startTime;
            server.status = 'active';
            server.lastChecked = Date.now();
            server.lastResponseTime = Math.round(responseTime);
            resolve();
        };

        img.onerror = function() {
            clearTimeout(timeout);
            // Even on error, if we got this far, server might be reachable
            const responseTime = performance.now() - startTime;
            server.status = 'active'; // Many BDIX servers block image requests but are still up
            server.lastChecked = Date.now();
            server.lastResponseTime = Math.round(responseTime);
            resolve();
        };

        // Try to load a common path or the root
        img.src = server.address + '/favicon.ico?t=' + Date.now();
    });
}

// Delete all servers
function deleteAllServers() {
    if (confirm('Are you sure you want to delete ALL servers? This cannot be undone!')) {
        servers = [];
        saveServers();
        renderServerList(currentCategory);
        showToast('All servers deleted!');
    }
}

// Delete servers by category
function deleteServersByCategory(category) {
    const categoryName = getCategoryDisplayName(category);
    if (confirm(`Are you sure you want to delete all ${categoryName} servers? This cannot be undone!`)) {
        servers = servers.filter(server => !server.categories.includes(category));
        
        // Recalculate ranks
        servers.forEach((server, index) => {
            server.rank = index + 1;
        });
        
        saveServers();
        renderServerList(currentCategory);
        showToast(`All ${categoryName} servers deleted!`);
    }
}

// Bulk favorite/unfavorite
function bulkFavorite(action) {
    let count = 0;
    servers.forEach(server => {
        if (action === 'favorite' && !server.isFavorite) {
            server.isFavorite = true;
            count++;
        } else if (action === 'unfavorite' && server.isFavorite) {
            server.isFavorite = false;
            count++;
        }
    });
    
    saveServers();
    renderServerList(currentCategory);
    showToast(`${count} servers ${action === 'favorite' ? 'added to' : 'removed from'} favorites!`);
}

// Export servers by category
function exportServersByCategory(category) {
    let filteredServers = servers;
    if (category !== 'all') {
        filteredServers = servers.filter(server => server.categories.includes(category));
    }
    
    const dataStr = JSON.stringify(filteredServers, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const categoryName = category === 'all' ? 'all' : getCategoryDisplayName(category).toLowerCase().replace(' ', '-');
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `isp-servers-${categoryName}-backup.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast(`${filteredServers.length} servers exported!`);
}

// Set up event listeners for tools page
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
