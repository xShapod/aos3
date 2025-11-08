let servers = [];
let currentCategory = 'all';
let sortable = null;

// Load servers from localStorage
document.addEventListener('DOMContentLoaded', function() {
    const savedServers = localStorage.getItem('ispServers');
    if (savedServers) {
        servers = JSON.parse(savedServers);
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
        filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(category));
    }
    
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
        
        const primaryCategory = server.categories && server.categories.length > 0 ? server.categories[0] : 'others';

        listItem.innerHTML = `
            <div class="server-rank-number">${index + 1}</div>
            <div class="server-list-info">
                <div class="server-list-name">${server.name}</div>
                <div class="server-list-address">${server.address}</div>
                <div class="server-list-meta">
                    <span class="server-type ${server.type}">${server.type === 'bdix' ? 'BDIX' : 'Non-BDIX'}</span>
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

// Move server up in the current filtered list
function moveServerUp(id) {
    const currentServer = servers.find(server => server.id === id);
    if (!currentServer) return;

    let filteredServers = servers;
    if (currentCategory !== 'all') {
        filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(currentCategory));
    }
    filteredServers.sort((a, b) => a.rank - b.rank);
    
    const filteredIndex = filteredServers.findIndex(server => server.id === id);
    if (filteredIndex === 0 || filteredIndex === -1) return;
    
    const aboveServer = filteredServers[filteredIndex - 1];

    const tempRank = currentServer.rank;
    currentServer.rank = aboveServer.rank;
    aboveServer.rank = tempRank;
    
    saveServers();
    renderServerList(currentCategory);
    showToast('Server moved up!');
}

// Move server down in the current filtered list
function moveServerDown(id) {
    const currentServer = servers.find(server => server.id === id);
    if (!currentServer) return;
    
    let filteredServers = servers;
    if (currentCategory !== 'all') {
        filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(currentCategory));
    }
    filteredServers.sort((a, b) => a.rank - b.rank);
    
    const filteredIndex = filteredServers.findIndex(server => server.id === id);
    if (filteredIndex === filteredServers.length - 1 || filteredIndex === -1) return;
    
    const belowServer = filteredServers[filteredIndex + 1];

    const tempRank = currentServer.rank;
    currentServer.rank = belowServer.rank;
    belowServer.rank = tempRank;
    
    saveServers();
    renderServerList(currentCategory);
    showToast('Server moved down!');
}

// Save the new order
function saveNewOrder() {
    let currentFilteredServers = servers;
    if (currentCategory !== 'all') {
        currentFilteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(currentCategory));
    }
    currentFilteredServers.sort((a, b) => a.rank - b.rank);
    
    currentFilteredServers.forEach((server, index) => {
        server.rank = index + 1;
    });

    saveServers();
    showToast('Server order saved successfully!');
}

// Reset to default order (by name)
function resetToDefaultOrder() {
    if (confirm('Are you sure you want to reset the order to alphabetical for all servers?')) {
        servers.sort((a, b) => a.name.localeCompare(b.name));
        
        servers.forEach((server, index) => {
            server.rank = index + 1;
        });
        
        saveServers();
        renderServerList(currentCategory);
        showToast('Order reset to alphabetical!');
    }
}

// ==================== BULK OPERATIONS (FROM app.js) ====================

// Delete all servers
function deleteAllServers() {
    if (confirm('Are you sure you want to delete ALL servers? This cannot be undone!')) {
        servers = [];
        saveServers();
        renderServerList(currentCategory);
        showToast('All servers deleted!');
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

// Check all servers status (imported from app.js)
async function checkAllServersStatus() {
    showToast('Checking status of all servers...');
    
    for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        await checkServerStatus(server);
        
        if (i < servers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    showToast('All servers status updated!');
}

// Quick check all servers (imported from app.js)
async function quickCheckAllStatus() {
    showToast('Quick checking all servers...');
    
    const promises = servers.map(async (server) => {
        await quickCheckServerStatus(server.id);
    });
    
    await Promise.all(promises);
    showToast('Quick status check completed!');
}

// Server status checking functions (imported from app.js)
async function checkServerStatus(server) {
    server.status = 'checking';
    server.lastChecked = Date.now();
    saveServers();

    const startTime = performance.now();
    
    try {
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
        
        const responseTime = performance.now() - startTime;
        server.status = 'active';
        server.lastChecked = Date.now();
        server.lastResponseTime = Math.round(responseTime);
        
    } catch (error) {
        await checkServerWithImage(server, startTime);
    } finally {
        saveServers();
    }
}

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
            const responseTime = performance.now() - startTime;
            server.status = 'active';
            server.lastChecked = Date.now();
            server.lastResponseTime = Math.round(responseTime);
            resolve();
        };

        img.src = server.address + '/favicon.ico?t=' + Date.now();
    });
}

async function quickCheckServerStatus(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    server.status = 'checking';

    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);

        await fetch(server.address, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal
        });

        clearTimeout(timeoutId);
        server.status = 'active';
    } catch (error) {
        server.status = 'inactive';
    } finally {
        server.lastChecked = Date.now();
        saveServers();
    }
}

// ==================== EVENT LISTENERS ====================

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
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : 'var(--success)');
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