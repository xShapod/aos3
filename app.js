// Sample data for demonstration
let servers = [
    {
        id: 1,
        name: "Live Sports HD",
        address: "http://live.sports.isp.com",
        categories: ["live"],
        type: "bdix",
        status: "active",
        description: "",
        rank: 1,
        createdAt: new Date('2023-01-15').getTime(),
        isFavorite: false,
        performance: { uptime: 95, avgResponseTime: 120, lastWeekChecks: 42 }
    },
    {
        id: 2,
        name: "Movie Vault",
        address: "ftp://movies.isp.com:2020",
        categories: ["movies"],
        type: "bdix",
        status: "active",
        description: "",
        rank: 2,
        createdAt: new Date('2023-02-20').getTime(),
        isFavorite: false,
        performance: { uptime: 88, avgResponseTime: 180, lastWeekChecks: 38 }
    },
    {
        id: 3,
        name: "TV Series Archive",
        address: "http://series.isp.com:8080",
        categories: ["series"],
        type: "non-bdix",
        status: "inactive",
        description: "",
        rank: 3,
        createdAt: new Date('2023-03-10').getTime(),
        isFavorite: false,
        performance: { uptime: 45, avgResponseTime: 450, lastWeekChecks: 20 }
    }
];

let currentSort = 'manual';
let currentCategory = 'all';
let currentEditServerId = null;

// Performance tracking
let serverHistory = JSON.parse(localStorage.getItem('serverHistory')) || {};
let checkRateLimit = {};
const MAX_CHECKS_PER_MINUTE = 10;

// Load servers from localStorage if available
document.addEventListener('DOMContentLoaded', function() {
    const savedServers = localStorage.getItem('ispServers');
    if (savedServers) {
        servers = JSON.parse(savedServers);
        // Clean up old fields and initialize new ones
        servers.forEach(server => {
            if (!server.categories) {
                server.categories = [server.category || 'others'];
            }
            if (!server.description) {
                server.description = '';
            }
            if (!server.lastChecked) {
                server.lastChecked = null;
            }
            if (!server.lastResponseTime) {
                server.lastResponseTime = null;
            }
            if (!server.performance) {
                server.performance = { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 };
            }
        });
    } else {
        localStorage.setItem('ispServers', JSON.stringify(servers));
    }
    
    // Load server history
    const savedHistory = localStorage.getItem('serverHistory');
    if (savedHistory) {
        serverHistory = JSON.parse(savedHistory);
    }
    
    renderServers(currentCategory, currentSort);
    setupEventListeners();
    updateQuickStats();
    initializeTheme();
});

// ==================== THEME MANAGEMENT ====================

function initializeTheme() {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        const icon = themeToggle.querySelector('i');
        icon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        
        themeToggle.addEventListener('click', function() {
            const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
            const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', newTheme);
            localStorage.setItem('theme', newTheme);
            
            const icon = this.querySelector('i');
            icon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
        });
    }
}

// ==================== QUICK STATS ====================

function updateQuickStats() {
    const total = servers.length;
    const online = servers.filter(s => s.status === 'active').length;
    
    // Calculate average response time
    const serversWithResponse = servers.filter(s => s.lastResponseTime);
    const avgResponse = serversWithResponse.length > 0 
        ? Math.round(serversWithResponse.reduce((sum, s) => sum + s.lastResponseTime, 0) / serversWithResponse.length)
        : 0;
    
    // Calculate system health (average of all server health scores)
    const totalHealth = servers.reduce((sum, server) => sum + getServerHealthScore(server.id), 0);
    const systemHealth = servers.length > 0 ? Math.round(totalHealth / servers.length) : 0;
    
    // Update DOM elements if they exist
    if (document.getElementById('totalServers')) {
        document.getElementById('totalServers').textContent = total;
    }
    if (document.getElementById('onlineServers')) {
        document.getElementById('onlineServers').textContent = online;
    }
    if (document.getElementById('avgResponseTime')) {
        document.getElementById('avgResponseTime').textContent = `${avgResponse}ms`;
    }
    if (document.getElementById('systemHealth')) {
        document.getElementById('systemHealth').textContent = `${systemHealth}%`;
    }
}

// ==================== HEALTH SCORE FUNCTIONS ====================

function getServerHealthScore(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server || !server.performance) return 0;
    
    const { uptime, avgResponseTime } = server.performance;
    
    // Calculate score based on uptime (70%) and response time (30%)
    let score = uptime * 0.7;
    
    if (avgResponseTime) {
        const responseScore = Math.max(0, 100 - (avgResponseTime / 10));
        score += responseScore * 0.3;
    }
    
    return Math.round(score);
}

function getHealthLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
}

// ==================== ENHANCED STATUS CHECKING ====================

function isRateLimited(serverId) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    if (!checkRateLimit[serverId]) {
        checkRateLimit[serverId] = [];
    }
    
    checkRateLimit[serverId] = checkRateLimit[serverId].filter(time => time > oneMinuteAgo);
    
    if (checkRateLimit[serverId].length >= MAX_CHECKS_PER_MINUTE) {
        return true;
    }
    
    checkRateLimit[serverId].push(now);
    return false;
}

async function checkServerStatus(server) {
    if (isRateLimited(server.id)) {
        showToast(`Rate limit exceeded for ${server.name}. Please wait before checking again.`, 'warning');
        return;
    }
    
    server.status = 'checking';
    server.lastChecked = Date.now();
    saveServers();
    renderServers(currentCategory, currentSort);

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
        trackServerPerformance(server.id, server.lastResponseTime, server.status);
        saveServers();
        renderServers(currentCategory, currentSort);
        updateQuickStats();
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

// ==================== PERFORMANCE TRACKING ====================

function trackServerPerformance(serverId, responseTime, status) {
    if (!serverHistory[serverId]) {
        serverHistory[serverId] = [];
    }
    
    const record = {
        timestamp: Date.now(),
        responseTime: responseTime,
        status: status,
        uptime: status === 'active'
    };
    
    serverHistory[serverId].push(record);
    
    if (serverHistory[serverId].length > 1000) {
        serverHistory[serverId] = serverHistory[serverId].slice(-1000);
    }
    
    updateServerPerformanceMetrics(serverId);
    saveServerHistory();
}

function updateServerPerformanceMetrics(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server || !serverHistory[serverId]) return;
    
    const records = serverHistory[serverId];
    const lastWeek = Date.now() - (7 * 24 * 60 * 60 * 1000);
    const recentRecords = records.filter(r => r.timestamp > lastWeek);
    
    if (recentRecords.length === 0) return;
    
    const successfulChecks = recentRecords.filter(r => r.uptime).length;
    const uptimePercentage = (successfulChecks / recentRecords.length) * 100;
    
    const successfulResponses = recentRecords.filter(r => r.uptime && r.responseTime);
    const avgResponseTime = successfulResponses.length > 0 
        ? Math.round(successfulResponses.reduce((sum, r) => sum + r.responseTime, 0) / successfulResponses.length)
        : null;
    
    server.performance = {
        uptime: Math.round(uptimePercentage),
        avgResponseTime: avgResponseTime,
        lastWeekChecks: recentRecords.length
    };
    
    saveServers();
}

// ==================== CONTEXT MENU ====================

function setupContextMenu() {
    const contextMenu = document.getElementById('contextMenu');
    
    // Right-click on server rows
    document.addEventListener('contextmenu', function(e) {
        const serverRow = e.target.closest('.server-row');
        if (serverRow) {
            e.preventDefault();
            const serverId = parseInt(serverRow.getAttribute('data-id'));
            showContextMenu(e, serverId);
        }
    });
    
    // Hide context menu on click
    document.addEventListener('click', function() {
        contextMenu.style.display = 'none';
    });
    
    // Context menu actions
    contextMenu.addEventListener('click', function(e) {
        const menuItem = e.target.closest('.context-menu-item');
        if (menuItem) {
            const action = menuItem.getAttribute('data-action');
            const serverId = parseInt(contextMenu.getAttribute('data-server-id'));
            handleContextMenuAction(action, serverId);
        }
    });
}

function showContextMenu(e, serverId) {
    const contextMenu = document.getElementById('contextMenu');
    contextMenu.style.display = 'block';
    contextMenu.style.left = e.pageX + 'px';
    contextMenu.style.top = e.pageY + 'px';
    contextMenu.setAttribute('data-server-id', serverId);
}

function handleContextMenuAction(action, serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;
    
    switch(action) {
        case 'connect':
            connectToServer(server.address);
            break;
        case 'check':
            checkSingleServerStatus(serverId);
            break;
        case 'analytics':
            showServerAnalytics(serverId);
            break;
        case 'favorite':
            toggleFavorite(serverId);
            break;
        case 'edit':
            openEditModal(serverId);
            break;
        case 'delete':
            deleteServer(serverId);
            break;
    }
}

// ==================== BATCH IMPORT ====================

function importFromText() {
    const textArea = document.getElementById('batchImportText');
    const text = textArea.value.trim();
    
    if (!text) {
        showToast('Please enter server data to import', 'warning');
        return;
    }
    
    const lines = text.split('\n').filter(line => line.trim());
    const newServers = [];
    let importedCount = 0;
    let errorCount = 0;
    
    lines.forEach(line => {
        const parts = line.split('|').map(part => part.trim());
        if (parts.length >= 2) {
            const name = parts[0];
            const address = parts[1];
            const category = parts[2] || 'others';
            
            if (name && address && isValidURL(address)) {
                // Check for duplicates
                const normalizedAddress = normalizeAddress(address);
                const isDuplicate = servers.some(server => 
                    normalizeAddress(server.address) === normalizedAddress && 
                    server.categories.includes(category)
                );
                
                if (!isDuplicate) {
                    newServers.push({
                        id: Date.now() + Math.random(),
                        name: name,
                        address: address,
                        categories: [category],
                        type: address.includes('ftp') || address.includes('bdix') ? 'bdix' : 'non-bdix',
                        status: 'inactive',
                        description: '',
                        rank: servers.length + newServers.length + 1,
                        createdAt: Date.now(),
                        isFavorite: false,
                        lastChecked: null,
                        lastResponseTime: null,
                        performance: { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 }
                    });
                    importedCount++;
                } else {
                    errorCount++;
                }
            } else {
                errorCount++;
            }
        } else {
            errorCount++;
        }
    });
    
    if (newServers.length > 0) {
        servers = [...servers, ...newServers];
        saveServers();
        renderServers(currentCategory, currentSort);
        updateQuickStats();
        closeAllManagementModals();
    }
    
    showToast(`Imported ${importedCount} servers. ${errorCount} entries skipped.`, 
              importedCount > 0 ? 'success' : 'warning');
}

// ==================== CLOUD SYNC ====================

function syncToCloud() {
    showToast('Syncing to cloud...', 'info');
    
    // Simulate cloud sync
    setTimeout(() => {
        const syncData = {
            servers: servers,
            timestamp: Date.now(),
            version: '1.0'
        };
        
        localStorage.setItem('cloudSync', JSON.stringify(syncData));
        showToast('Data synced to cloud successfully!');
    }, 1000);
}

// ==================== SERVER ANALYTICS ====================

function showServerAnalytics(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;
    
    const history = serverHistory[serverId] || [];
    const healthScore = getServerHealthScore(serverId);
    
    // Populate analytics modal
    document.getElementById('analyticsServerName').textContent = server.name;
    document.getElementById('analyticsHealthScore').textContent = `${healthScore}%`;
    document.getElementById('analyticsUptime').textContent = `${server.performance?.uptime || 0}%`;
    document.getElementById('analyticsAvgResponse').textContent = server.performance?.avgResponseTime ? `${server.performance.avgResponseTime}ms` : 'N/A';
    document.getElementById('analyticsTotalChecks').textContent = history.length;
    
    // Show analytics modal
    document.getElementById('serverAnalyticsModal').style.display = 'flex';
    
    // Render performance chart
    renderPerformanceChart(serverId);
}

function renderPerformanceChart(serverId) {
    const history = serverHistory[serverId] || [];
    const chartContainer = document.getElementById('performanceChart');
    
    if (history.length === 0) {
        chartContainer.innerHTML = '<div class="empty-chart">No performance data available</div>';
        return;
    }
    
    const recentData = history.slice(-20);
    const chartHtml = recentData.map((record, index) => `
        <div class="chart-bar" style="height: ${Math.min(100, (record.responseTime || 0) / 5)}%" 
             title="Response: ${record.responseTime || 'N/A'}ms - ${new Date(record.timestamp).toLocaleTimeString()}">
            <div class="bar-fill ${record.status === 'active' ? 'active' : 'inactive'}"></div>
        </div>
    `).join('');
    
    chartContainer.innerHTML = chartHtml;
}

// ==================== HELPER FUNCTIONS ====================

function getCategoryDisplayName(category) {
    const categories = {
        'live': 'Live TV',
        'movies': 'Movies',
        'series': 'Series',
        'others': 'Others'
    };
    return categories[category] || category;
}

function formatRelativeTime(timestamp) {
    if (!timestamp) return 'Never';
    
    const now = Date.now();
    const diff = now - timestamp;
    const minutes = Math.floor(diff / 60000);
    const hours = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);

    if (days > 0) return `${days} day${days > 1 ? 's' : ''} ago`;
    if (hours > 0) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
    if (minutes > 0) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
    return 'Just now';
}

function normalizeAddress(address) {
    if (!address) return '';
    let normalized = address.toLowerCase().trim();
    normalized = normalized.replace(/^(https?|ftp):\/\//i, '');
    normalized = normalized.replace(/\/$/, '');
    return normalized;
}

function isAddressDuplicateInAnyCategory(address, categories, currentId = null) {
    const normalizedNewAddress = normalizeAddress(address);
    if (!normalizedNewAddress) return false;

    const currentIdStr = currentId ? String(currentId) : null;

    return servers.some(existingServer => {
        if (currentIdStr && String(existingServer.id) === currentIdStr) {
            return false;
        }
        
        const normalizedExistingAddress = normalizeAddress(existingServer.address);
        if (normalizedExistingAddress !== normalizedNewAddress) {
            return false;
        }

        return existingServer.categories.some(cat => categories.includes(cat));
    });
}

function isValidURL(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ftp:';
    } catch (_) {
        return false;
    }
}

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, '');
}

// ==================== CORE FUNCTIONS ====================

function renderServers(category, sortBy) {
    const serverGrid = document.getElementById('serverGrid');
    if (!serverGrid) return;
    
    serverGrid.innerHTML = '';
    
    let filteredServers = servers;
    
    if (category !== 'all') {
        if (category === 'favorites') {
            filteredServers = servers.filter(server => server.isFavorite);
        } else if (category === 'healthy') {
            filteredServers = servers.filter(server => getServerHealthScore(server.id) >= 80);
        } else if (category === 'unhealthy') {
            filteredServers = servers.filter(server => getServerHealthScore(server.id) < 50);
        } else {
            filteredServers = filteredServers.filter(server => server.categories.includes(category));
        }
    }
    
    // Apply search filter if any
    const searchTerm = document.getElementById('searchInput')?.value.toLowerCase() || '';
    if (searchTerm) {
        filteredServers = filteredServers.filter(server => 
            server.name.toLowerCase().includes(searchTerm) || 
            (server.description && server.description.toLowerCase().includes(searchTerm)) ||
            server.address.toLowerCase().includes(searchTerm)
        );
    }
    
    // Sort servers
    filteredServers = sortServers(filteredServers, sortBy);
    
    if (filteredServers.length === 0) {
        serverGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-server"></i>
                <h3>No servers found</h3>
                <p>Try changing your filters or add a new server</p>
            </div>
        `;
        return;
    }

    const tableContainer = document.createElement('div');
    tableContainer.className = 'server-table-container';
    
    tableContainer.innerHTML = `
        <div class="table-header">
            <div class="table-row header-row">
                <div class="col-status">Status</div>
                <div class="col-name">Server Name</div>
                <div class="col-address">Address</div>
                <div class="col-type">Type</div>
                <div class="col-performance">Performance</div>
                <div class="col-response">Response</div>
                <div class="col-actions">Actions</div>
            </div>
        </div>
        <div class="table-body" id="tableBody"></div>
    `;
    
    serverGrid.appendChild(tableContainer);
    const tableBody = document.getElementById('tableBody');
    
    filteredServers.forEach(server => {
        const healthScore = getServerHealthScore(server.id);
        const tableRow = document.createElement('div');
        tableRow.className = `table-row server-row ${server.isFavorite ? 'favorite' : ''}`;
        tableRow.setAttribute('data-id', server.id);
        
        tableRow.innerHTML = `
            <div class="col-status">
                <div class="status-indicator ${server.status}">
                    <i class="fas fa-circle"></i>
                    <span class="status-text">${server.status === 'active' ? 'Online' : (server.status === 'checking' ? 'Checking' : 'Offline')}</span>
                </div>
            </div>
            <div class="col-name">
                <div class="server-name-wrapper">
                    <div class="server-name">${server.name}</div>
                    ${server.categories && server.categories.length > 0 ? `
                        <div class="server-categories">
                            ${server.categories.map(cat => `<span class="category-tag">${getCategoryDisplayName(cat)}</span>`).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="col-address">
                <div class="server-address" title="${server.address}">${server.address}</div>
            </div>
            <div class="col-type">
                <span class="type-badge ${server.type}">${server.type === 'bdix' ? 'BDIX' : 'Non-BDIX'}</span>
            </div>
            <div class="col-performance">
                <div class="performance-indicator">
                    <div class="health-score health-${getHealthLevel(healthScore)}" title="Health Score: ${healthScore}%">
                        <div class="health-bar">
                            <div class="health-fill" style="width: ${healthScore}%"></div>
                        </div>
                        <span class="health-text">${healthScore}%</span>
                    </div>
                    ${server.performance && server.performance.uptime ? `
                        <div class="uptime-indicator" title="Uptime: ${server.performance.uptime}%">
                            <i class="fas fa-chart-line"></i>
                            ${server.performance.uptime}%
                        </div>
                    ` : ''}
                </div>
            </div>
            <div class="col-response">
                ${server.lastResponseTime ? `
                    <div class="response-time">
                        <i class="fas fa-bolt"></i>
                        ${server.lastResponseTime}ms
                    </div>
                ` : '<div class="response-time na">N/A</div>'}
                ${server.lastChecked ? `<div class="last-checked">${formatRelativeTime(server.lastChecked)}</div>` : ''}
            </div>
            <div class="col-actions">
                <div class="action-buttons">
                    <button class="btn-action btn-connect" onclick="connectToServer('${server.address}')" title="Open Server">
                        <i class="fas fa-external-link-alt"></i>
                    </button>
                    <button class="btn-action btn-check" onclick="checkSingleServerStatus(${server.id})" title="Check Status">
                        <i class="fas fa-sync-alt"></i>
                    </button>
                    <button class="btn-action btn-chart" onclick="showServerAnalytics(${server.id})" title="View Analytics">
                        <i class="fas fa-chart-bar"></i>
                    </button>
                    <button class="btn-action btn-edit" onclick="openEditModal(${server.id})" title="Edit Server">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn-action btn-favorite ${server.isFavorite ? 'active' : ''}" onclick="toggleFavorite(${server.id})" title="${server.isFavorite ? 'Remove from favorites' : 'Add to favorites'}">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="btn-action btn-delete" onclick="deleteServer(${server.id})" title="Delete Server">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
        tableBody.appendChild(tableRow);
    });
}

function sortServers(servers, sortBy) {
    const sortedServers = [...servers];
    
    switch(sortBy) {
        case 'manual':
            return sortedServers.sort((a, b) => a.rank - b.rank);
        case 'name':
            return sortedServers.sort((a, b) => a.name.localeCompare(b.name));
        case 'recent':
            return sortedServers.sort((a, b) => b.createdAt - a.createdAt);
        case 'smart':
            return sortedServers.sort((a, b) => {
                const scoreA = getServerHealthScore(a.id);
                const scoreB = getServerHealthScore(b.id);
                return scoreB - scoreA;
            });
        case 'performance':
            return sortedServers.sort((a, b) => {
                const perfA = a.performance?.uptime || 0;
                const perfB = b.performance?.uptime || 0;
                return perfB - perfA;
            });
        default:
            return sortedServers;
    }
}

function setupEventListeners() {
    // Category tabs
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.getAttribute('data-category');
            renderServers(currentCategory, currentSort);
        });
    });
    
    // Sort buttons
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentSort = this.getAttribute('data-sort');
            renderServers(currentCategory, currentSort);
        });
    });
    
    // Search input
    const searchInput = document.getElementById('searchInput');
    if (searchInput) {
        searchInput.addEventListener('input', function() {
            renderServers(currentCategory, currentSort);
        });
    }
    
    // Add server form
    const serverForm = document.getElementById('serverForm');
    if (serverForm) {
        serverForm.addEventListener('submit', function(e) {
            e.preventDefault();
            addServer();
        });
    }
    
    // Tools button
    const toolsBtn = document.getElementById('toolsBtn');
    if (toolsBtn) {
        toolsBtn.addEventListener('click', function() {
            window.location.href = 'tools.html';
        });
    }

    // Manage Servers Modal
    const manageServersBtn = document.getElementById('manageServersBtn');
    if (manageServersBtn) {
        manageServersBtn.addEventListener('click', function() {
            document.getElementById('manageServersModal').style.display = 'flex';
        });
    }
    
    const closeManageModal = document.getElementById('closeManageModal');
    if (closeManageModal) {
        closeManageModal.addEventListener('click', function() {
            document.getElementById('manageServersModal').style.display = 'none';
        });
    }

    // Export/Import buttons
    const exportBtn = document.getElementById('exportBtn');
    if (exportBtn) exportBtn.addEventListener('click', showExportModal);
    
    const importBtn = document.getElementById('importBtn');
    if (importBtn) importBtn.addEventListener('click', showImportModal);
    
    const downloadBtn = document.getElementById('downloadBtn');
    if (downloadBtn) downloadBtn.addEventListener('click', downloadBackup);
    
    const uploadBtn = document.getElementById('uploadBtn');
    if (uploadBtn) uploadBtn.addEventListener('click', triggerUpload);
    
    const fileUpload = document.getElementById('fileUpload');
    if (fileUpload) fileUpload.addEventListener('change', handleFileUpload);
    
    // Import from URL
    const importUrlBtn = document.getElementById('importUrlBtn');
    if (importUrlBtn) {
        importUrlBtn.addEventListener('click', function() {
            document.getElementById('importUrlModal').style.display = 'flex';
        });
    }
    
    const closeUrlModal = document.getElementById('closeUrlModal');
    if (closeUrlModal) {
        closeUrlModal.addEventListener('click', function() {
            document.getElementById('importUrlModal').style.display = 'none';
        });
    }
    
    const confirmImportUrl = document.getElementById('confirmImportUrl');
    if (confirmImportUrl) confirmImportUrl.addEventListener('click', importFromURL);
    
    // Modal close events
    const closeModal = document.getElementById('closeModal');
    if (closeModal) closeModal.addEventListener('click', closeModalFunc);
    
    const copyData = document.getElementById('copyData');
    if (copyData) copyData.addEventListener('click', copyExportData);
    
    const replaceData = document.getElementById('replaceData');
    if (replaceData) replaceData.addEventListener('click', replaceServers);
    
    const mergeData = document.getElementById('mergeData');
    if (mergeData) mergeData.addEventListener('click', mergeServers);
    
    // Edit modal events
    const closeEditModal = document.getElementById('closeEditModal');
    if (closeEditModal) closeEditModal.addEventListener('click', closeEditModalFunc);
    
    const saveEdit = document.getElementById('saveEdit');
    if (saveEdit) saveEdit.addEventListener('click', saveEditChanges);
    
    // Analytics modal
    const closeAnalyticsModal = document.getElementById('closeAnalyticsModal');
    if (closeAnalyticsModal) {
        closeAnalyticsModal.addEventListener('click', function() {
            document.getElementById('serverAnalyticsModal').style.display = 'none';
        });
    }
    
    // Close modals when clicking outside
    setupModalCloseEvents();
    
    // Context menu
    setupContextMenu();
    
    // Character count for description
    const serverDescription = document.getElementById('serverDescription');
    if (serverDescription) {
        serverDescription.addEventListener('input', function() {
            document.getElementById('descCharCount').textContent = this.value.length;
        });
    }
    
    const editDescription = document.getElementById('editDescription');
    if (editDescription) {
        editDescription.addEventListener('input', function() {
            document.getElementById('editDescCharCount').textContent = this.value.length;
        });
    }
}

function setupModalCloseEvents() {
    // Close modals when clicking outside
    const modals = [
        'exportImportModal',
        'editServerModal', 
        'manageServersModal',
        'importUrlModal',
        'serverAnalyticsModal'
    ];
    
    modals.forEach(modalId => {
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.addEventListener('click', function(e) {
                if (e.target === this) {
                    this.style.display = 'none';
                }
            });
        }
    });
}

// ==================== MODAL FUNCTIONS ====================

function closeModalFunc() {
    document.getElementById('exportImportModal').style.display = 'none';
}

function closeEditModalFunc() {
    document.getElementById('editServerModal').style.display = 'none';
    currentEditServerId = null;
}

function closeAllManagementModals() {
    document.getElementById('exportImportModal').style.display = 'none';
    document.getElementById('importUrlModal').style.display = 'none';
    document.getElementById('manageServersModal').style.display = 'none';
    document.getElementById('serverAnalyticsModal').style.display = 'none';
}

// ==================== SERVER MANAGEMENT ====================

function addServer() {
    const name = sanitizeInput(document.getElementById('serverName').value);
    const address = sanitizeInput(document.getElementById('serverAddress').value);
    const type = document.getElementById('serverType').value;
    const description = sanitizeInput(document.getElementById('serverDescription').value);
    
    const selectedCategories = [];
    document.querySelectorAll('#serverForm input[name="serverCategories"]:checked').forEach(checkbox => {
        selectedCategories.push(checkbox.value);
    });
    
    const categories = selectedCategories.length > 0 ? selectedCategories : ['others'];

    if (!name || name.length < 2) {
        showToast('Server name must be at least 2 characters long', 'error');
        return;
    }
    
    if (!isValidURL(address)) {
        showToast('Please enter a valid URL (http, https, or ftp)', 'error');
        return;
    }
    
    if (isAddressDuplicateInAnyCategory(address, categories)) {
        showToast('Error: Duplicate server address found in a matching category!', 'error');
        return;
    }
    
    const newServer = {
        id: Date.now(),
        name,
        address: address.trim(),
        categories,
        type,
        status: 'inactive',
        description: description.trim() || '',
        rank: servers.length + 1,
        createdAt: Date.now(),
        isFavorite: false,
        lastChecked: null,
        lastResponseTime: null,
        performance: { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 }
    };
    
    servers.push(newServer);
    saveServers();
    renderServers(currentCategory, currentSort);
    updateQuickStats();
    
    document.getElementById('serverForm').reset();
    document.getElementById('descCharCount').textContent = '0';
    
    closeAllManagementModals();
    showToast(`Server "${name}" added successfully!`);
}

function openEditModal(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
        currentEditServerId = serverId;
        
        document.getElementById('editServerName').value = server.name;
        document.getElementById('editServerAddress').value = server.address;
        document.getElementById('editStatus').value = server.status;
        document.getElementById('editType').value = server.type;
        document.getElementById('editDescription').value = server.description || '';
        document.getElementById('editDescCharCount').textContent = server.description?.length || 0;
        
        const categoryCheckboxes = document.querySelectorAll('#editModalBody input[name="editCategories"]');
        categoryCheckboxes.forEach(checkbox => {
            checkbox.checked = server.categories && server.categories.includes(checkbox.value);
        });
        
        document.getElementById('editServerModal').style.display = 'flex';
    }
}

function saveEditChanges() {
    if (currentEditServerId) {
        const server = servers.find(s => s.id === currentEditServerId);
        if (server) {
            const selectedCategories = [];
            document.querySelectorAll('#editModalBody input[name="editCategories"]:checked').forEach(checkbox => {
                selectedCategories.push(checkbox.value);
            });
            const newCategories = selectedCategories.length > 0 ? selectedCategories : ['others'];

            const newAddress = document.getElementById('editServerAddress').value;

            const originalNormalizedAddress = normalizeAddress(server.address);
            const newNormalizedAddress = normalizeAddress(newAddress);
            
            const originalCategoriesStr = (Array.isArray(server.categories) ? server.categories : []).sort().join(',');
            const newCategoriesStr = newCategories.sort().join(',');
            
            const uniqueIdentifiersChanged = (originalNormalizedAddress !== newNormalizedAddress) || (originalCategoriesStr !== newCategoriesStr);
            
            if (uniqueIdentifiersChanged && isAddressDuplicateInAnyCategory(newAddress, newCategories, currentEditServerId)) {
                showToast('Error: Duplicate server address found in a matching category!', 'error');
                return;
            }

            server.name = document.getElementById('editServerName').value;
            server.address = newAddress;
            server.status = document.getElementById('editStatus').value;
            server.type = document.getElementById('editType').value;
            server.description = document.getElementById('editDescription').value.trim() || ''; 
            server.categories = newCategories;
            
            saveServers();
            renderServers(currentCategory, currentSort);
            closeEditModalFunc();
            showToast('Server updated successfully!');
        }
    }
}

function deleteServer(id) {
    if (confirm('Are you sure you want to delete this server?')) {
        const serverName = servers.find(server => server.id === id).name;
        servers = servers.filter(server => server.id !== id);
        
        servers.forEach((server, index) => {
            server.rank = index + 1;
        });
        
        saveServers();
        renderServers(currentCategory, currentSort);
        updateQuickStats();
        
        showToast(`Server "${serverName}" deleted successfully!`);
    }
}

function toggleFavorite(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
        server.isFavorite = !server.isFavorite;
        saveServers();
        renderServers(currentCategory, currentSort);
        showToast(server.isFavorite ? 'Added to favorites!' : 'Removed from favorites!');
    }
}

function checkSingleServerStatus(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
        checkServerStatus(server);
        showToast(`Status checked for ${server.name}`);
    }
}

function connectToServer(address) {
    showToast(`Opening: ${address}`);
    
    try {
        window.open(address, '_blank');
    } catch (e) {
        showToast(`Could not open automatically. Please copy and paste: ${address}`);
        navigator.clipboard.writeText(address).then(() => {
            showToast(`URL copied to clipboard: ${address}`);
        });
    }
}

// ==================== EXPORT/IMPORT ====================

function showExportModal() {
    const modal = document.getElementById('exportImportModal');
    const modalTitle = document.getElementById('modalTitle');
    const exportData = document.getElementById('exportData');
    const importActions = document.getElementById('importActions');
    const copyBtn = document.getElementById('copyData');
    
    modalTitle.textContent = 'Export Servers';
    exportData.value = JSON.stringify(servers, null, 2);
    exportData.readOnly = true;
    exportData.placeholder = '';
    importActions.style.display = 'none';
    copyBtn.style.display = 'block';
    modal.style.display = 'flex';
}

function showImportModal() {
    const modal = document.getElementById('exportImportModal');
    const modalTitle = document.getElementById('modalTitle');
    const exportData = document.getElementById('exportData');
    const importActions = document.getElementById('importActions');
    const copyBtn = document.getElementById('copyData');
    
    modalTitle.textContent = 'Import Servers';
    exportData.value = '';
    exportData.placeholder = 'Paste your server data here...';
    exportData.readOnly = false;
    importActions.style.display = 'flex';
    copyBtn.style.display = 'none';
    modal.style.display = 'flex';
    
    setTimeout(() => {
        exportData.focus();
    }, 100);
}

function copyExportData() {
    const exportData = document.getElementById('exportData');
    exportData.select();
    document.execCommand('copy');
    showToast('Server data copied to clipboard!');
    closeAllManagementModals();
}

function downloadBackup() {
    const dataStr = JSON.stringify(servers, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'isp-servers-backup.json';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    
    showToast('Backup file downloaded successfully!');
    closeAllManagementModals();
}

function triggerUpload() {
    document.getElementById('fileUpload').click();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const rawImportedServers = JSON.parse(e.target.result);
            if (Array.isArray(rawImportedServers)) {
                let importedServers = rawImportedServers.map(server => ({
                    id: Date.now() + Math.random(), 
                    name: server.name || 'Untitled Server',
                    address: (server.address || '').trim(),
                    description: server.description || '',
                    categories: Array.isArray(server.categories) ? server.categories : ['others'],
                    type: server.type || 'non-bdix',
                    status: server.status || 'inactive',
                    rank: servers.length + Math.random(),
                    createdAt: server.createdAt || Date.now(),
                    isFavorite: server.isFavorite || false,
                    lastChecked: server.lastChecked || null,
                    lastResponseTime: server.lastResponseTime || null,
                    performance: server.performance || { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 }
                }));
                importedServers = importedServers.filter(s => s.address);

                if (confirm('Do you want to replace all current servers with the uploaded backup?')) {
                    servers = importedServers;
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    updateQuickStats();
                    showToast('Servers restored from backup!');
                    closeAllManagementModals();
                } else {
                    const finalServers = [...servers];
                    let duplicatesSkipped = 0;

                    importedServers.forEach(importedServer => {
                        if (isAddressDuplicateInAnyCategory(importedServer.address, importedServer.categories)) {
                            duplicatesSkipped++;
                        } else {
                            finalServers.push(importedServer);
                        }
                    });

                    servers = finalServers;
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    updateQuickStats();
                    showToast(`Servers merged with backup! Added ${importedServers.length - duplicatesSkipped} new entries.`, duplicatesSkipped > 0 ? 'warning' : 'success');
                    closeAllManagementModals();
                }
            } else {
                showToast('Invalid backup file format!', 'error');
            }
        } catch (e) {
            showToast('Error reading backup file!', 'error');
        }
    };
    reader.readAsText(file);
    
    event.target.value = '';
}

function replaceServers() {
    const exportData = document.getElementById('exportData');
    try {
        const importedServers = JSON.parse(exportData.value);
        if (Array.isArray(importedServers)) {
            servers = importedServers;
            saveServers();
            renderServers(currentCategory, currentSort);
            updateQuickStats();
            closeAllManagementModals();
            showToast('All servers replaced successfully!');
        } else {
            showToast('Invalid server data format!', 'error');
        }
    } catch (e) {
        showToast('Invalid JSON data!', 'error');
    }
}

function mergeServers() {
    const exportData = document.getElementById('exportData');
    try {
        const rawImportedServers = JSON.parse(exportData.value);
        if (Array.isArray(rawImportedServers)) {
            let importedServers = rawImportedServers.map(server => ({
                id: Date.now() + Math.random(), 
                name: server.name || 'Untitled Server',
                address: (server.address || '').trim(),
                description: server.description || '',
                categories: Array.isArray(server.categories) ? server.categories : ['others'],
                type: server.type || 'non-bdix',
                status: server.status || 'inactive',
                rank: servers.length + Math.random(),
                createdAt: server.createdAt || Date.now(),
                isFavorite: server.isFavorite || false,
                lastChecked: server.lastChecked || null,
                lastResponseTime: server.lastResponseTime || null,
                performance: server.performance || { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 }
            }));
            importedServers = importedServers.filter(s => s.address);

            const finalServers = [...servers];
            let duplicatesSkipped = 0;

            importedServers.forEach(importedServer => {
                if (isAddressDuplicateInAnyCategory(importedServer.address, importedServer.categories)) {
                    duplicatesSkipped++;
                } else {
                    finalServers.push(importedServer);
                }
            });

            servers = finalServers;
            saveServers();
            renderServers(currentCategory, currentSort);
            updateQuickStats();
            closeAllManagementModals();
            showToast(`Servers merged successfully! Added ${importedServers.length - duplicatesSkipped} new entries.`, duplicatesSkipped > 0 ? 'warning' : 'success');
        } else {
            showToast('Invalid server data format!', 'error');
        }
    } catch (e) {
        showToast('Invalid JSON data!', 'error');
    }
}

function parseTxtServers(text) {
    const lines = text.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    const newServers = [];
    
    for (let i = 0; i < lines.length; i += 2) {
        const name = lines[i];
        const address = lines[i + 1] ? lines[i + 1].trim() : ''; 
        
        if (name && address && (address.startsWith('http') || address.startsWith('ftp'))) {
             newServers.push({
                id: Date.now() + Math.random(),
                name: name,
                address: address,
                categories: ['others'],
                type: address.includes('ftp') || address.includes('bdix') ? 'bdix' : 'non-bdix',
                status: 'inactive',
                description: '',
                rank: servers.length + newServers.length + 1,
                createdAt: Date.now(),
                isFavorite: false,
                lastChecked: null,
                lastResponseTime: null,
                performance: { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 }
             });
        }
    }
    
    return newServers;
}

async function importFromURL() {
    const url = document.getElementById('importUrl').value;
    const method = document.querySelector('input[name="importMethod"]:checked').value;
    
    if (!url) {
        showToast('Please enter a valid URL', 'error');
        return;
    }
    
    showToast('Downloading server list...');

    try {
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`Failed to fetch URL: HTTP ${response.status}`);
        }
        
        let importedServers = [];
        const fileExtension = url.split('.').pop().toLowerCase();
        
        if (fileExtension === 'json') {
            importedServers = await response.json();
            if (!Array.isArray(importedServers)) {
                throw new Error('JSON file is not a valid server list (expected a JSON array).');
            }
        } else if (fileExtension === 'txt') {
            const textContent = await response.text();
            importedServers = parseTxtServers(textContent);
            if (importedServers.length === 0) {
                 showToast('TXT file parsed but found no valid servers. Check format.', 'warning');
            }
        } else {
             throw new Error('Unsupported file extension. Only .json or .txt are supported.');
        }

        importedServers = importedServers.map(server => ({
            id: Date.now() + Math.random(), 
            name: server.name || 'Untitled Server',
            address: (server.address || '').trim(),
            description: server.description || '',
            categories: Array.isArray(server.categories) ? server.categories : ['others'],
            type: server.type || 'non-bdix',
            status: server.status || 'inactive',
            rank: servers.length + Math.random(),
            createdAt: server.createdAt || Date.now(),
            isFavorite: server.isFavorite || false,
            lastChecked: server.lastChecked || null,
            lastResponseTime: server.lastResponseTime || null,
            performance: server.performance || { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 }
        }));
        
        importedServers = importedServers.filter(s => s.address);

        if (method === 'replace') {
            servers = importedServers;
            showToast(`All servers replaced from URL! Loaded ${servers.length} entries.`);
        } else {
            const finalServers = [...servers];
            let duplicatesSkipped = 0;

            importedServers.forEach(importedServer => {
                if (isAddressDuplicateInAnyCategory(importedServer.address, importedServer.categories)) {
                    duplicatesSkipped++;
                } else {
                    finalServers.push(importedServer);
                }
            });

            servers = finalServers;
            showToast(`Servers merged from URL! Added ${importedServers.length - duplicatesSkipped} new entries. Total servers: ${servers.length}.`, duplicatesSkipped > 0 ? 'warning' : 'success');
        }
        
        saveServers();
        renderServers(currentCategory, currentSort);
        updateQuickStats();
        closeAllManagementModals();
        
    } catch (e) {
        console.error('Import Failed:', e);
        showToast(`Error importing from URL: ${e.message}`, 'error');
    }
}

// ==================== UTILITY FUNCTIONS ====================

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    toast.textContent = message;
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : (type === 'info' ? 'var(--primary)' : 'var(--success)'));
    toast.style.color = type === 'warning' ? 'var(--dark)' : 'white';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function saveServers() {
    localStorage.setItem('ispServers', JSON.stringify(servers));
}

function saveServerHistory() {
    localStorage.setItem('serverHistory', JSON.stringify(serverHistory));
}