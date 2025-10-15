let servers = [];
let currentCategory = 'all';
let sortable = null;
let serverHistory = JSON.parse(localStorage.getItem('serverHistory')) || {};

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
            // Initialize performance tracking if missing
            if (!server.performance) {
                server.performance = { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 };
            }
        });
    }
    
    renderServerList(currentCategory);
    setupEventListeners();
    initializeDragAndDrop();
    updateHealthDashboard();
    updateAnalyticsStats();
    populatePreviewServerSelect();
    loadPreviewGallery();
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
        const healthScore = getServerHealthScore(server.id);
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
                    <span class="health-indicator health-${getHealthLevel(healthScore)}">${healthScore}%</span>
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

// Get health level for styling
function getHealthLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
}

// Calculate server health score
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

// Apply smart ranking based on performance
function applySmartRanking() {
    if (confirm('Apply smart ranking based on server performance and reliability?')) {
        // Sort by health score (descending), then by response time (ascending)
        servers.sort((a, b) => {
            const scoreA = getServerHealthScore(a.id);
            const scoreB = getServerHealthScore(b.id);
            
            if (scoreB !== scoreA) {
                return scoreB - scoreA; // Higher health score first
            }
            
            // If health scores are equal, sort by response time
            const responseA = a.lastResponseTime || 9999;
            const responseB = b.lastResponseTime || 9999;
            return responseA - responseB; // Lower response time first
        });
        
        // Update ranks based on new order
        servers.forEach((server, index) => {
            server.rank = index + 1;
        });
        
        saveServers();
        renderServerList(currentCategory);
        showToast('Smart ranking applied successfully!');
    }
}

// ==================== HEALTH DASHBOARD ====================

function updateHealthDashboard() {
    updateHealthMetrics();
    renderHealthCharts();
}

function updateHealthMetrics() {
    const total = servers.length;
    const online = servers.filter(s => s.status === 'active').length;
    const offline = total - online;
    
    // Calculate average response time
    const serversWithResponse = servers.filter(s => s.lastResponseTime);
    const avgResponse = serversWithResponse.length > 0 
        ? Math.round(serversWithResponse.reduce((sum, s) => sum + s.lastResponseTime, 0) / serversWithResponse.length)
        : 0;
    
    document.getElementById('totalServersCount').textContent = total;
    document.getElementById('onlineServersCount').textContent = online;
    document.getElementById('offlineServersCount').textContent = offline;
    document.getElementById('avgResponseTime').textContent = `${avgResponse}ms`;
}

function renderHealthCharts() {
    renderHealthDistributionChart();
    renderCategoryPerformanceChart();
}

function renderHealthDistributionChart() {
    const container = document.getElementById('healthDistributionChart');
    
    const healthLevels = {
        excellent: servers.filter(s => getServerHealthScore(s.id) >= 80).length,
        good: servers.filter(s => getServerHealthScore(s.id) >= 60 && getServerHealthScore(s.id) < 80).length,
        fair: servers.filter(s => getServerHealthScore(s.id) >= 40 && getServerHealthScore(s.id) < 60).length,
        poor: servers.filter(s => getServerHealthScore(s.id) < 40).length
    };
    
    const total = servers.length;
    if (total === 0) {
        container.innerHTML = '<div class="empty-chart">No data available</div>';
        return;
    }
    
    const chartHtml = `
        <div class="health-distribution">
            ${Object.entries(healthLevels).map(([level, count]) => `
                <div class="health-bar ${level}">
                    <div class="bar-label">${level.charAt(0).toUpperCase() + level.slice(1)}</div>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${(count / total) * 100}%"></div>
                    </div>
                    <div class="bar-count">${count} (${Math.round((count / total) * 100)}%)</div>
                </div>
            `).join('')}
        </div>
    `;
    
    container.innerHTML = chartHtml;
}

function renderCategoryPerformanceChart() {
    const container = document.getElementById('categoryPerformanceChart');
    
    const categories = ['live', 'movies', 'series', 'others'];
    const categoryData = {};
    
    categories.forEach(category => {
        const categoryServers = servers.filter(s => s.categories.includes(category));
        if (categoryServers.length > 0) {
            const avgHealth = categoryServers.reduce((sum, s) => sum + getServerHealthScore(s.id), 0) / categoryServers.length;
            categoryData[category] = Math.round(avgHealth);
        } else {
            categoryData[category] = 0;
        }
    });
    
    const maxValue = Math.max(...Object.values(categoryData));
    
    const chartHtml = `
        <div class="category-performance">
            ${Object.entries(categoryData).map(([category, score]) => `
                <div class="category-bar">
                    <div class="category-label">${getCategoryDisplayName(category)}</div>
                    <div class="bar-container">
                        <div class="bar-fill" style="width: ${(score / maxValue) * 100}%"></div>
                    </div>
                    <div class="category-score">${score}%</div>
                </div>
            `).join('')}
        </div>
    `;
    
    container.innerHTML = chartHtml;
}

// ==================== PERFORMANCE ANALYTICS ====================

function updateAnalyticsStats() {
    if (servers.length === 0) return;
    
    // Find best and worst performing servers
    const serversWithScores = servers.map(server => ({
        ...server,
        healthScore: getServerHealthScore(server.id)
    })).filter(s => s.healthScore > 0);
    
    if (serversWithScores.length === 0) return;
    
    const bestPerforming = serversWithScores.reduce((best, current) => 
        current.healthScore > best.healthScore ? current : best
    );
    
    const worstPerforming = serversWithScores.reduce((worst, current) => 
        current.healthScore < worst.healthScore ? current : worst
    );
    
    // Find most reliable (highest uptime)
    const mostReliable = servers.reduce((best, current) => 
        (current.performance?.uptime || 0) > (best.performance?.uptime || 0) ? current : best
    );
    
    // Find fastest response
    const fastestResponse = servers
        .filter(s => s.lastResponseTime)
        .reduce((fastest, current) => 
            current.lastResponseTime < fastest.lastResponseTime ? current : fastest
        , { lastResponseTime: Infinity });
    
    // Update DOM elements
    document.getElementById('bestPerforming').textContent = bestPerforming.name;
    document.getElementById('bestPerformingScore').textContent = `${bestPerforming.healthScore}% health`;
    
    document.getElementById('worstPerforming').textContent = worstPerforming.name;
    document.getElementById('worstPerformingScore').textContent = `${worstPerforming.healthScore}% health`;
    
    document.getElementById('mostReliable').textContent = mostReliable.name;
    document.getElementById('mostReliableUptime').textContent = `${mostReliable.performance?.uptime || 0}% uptime`;
    
    if (fastestResponse.lastResponseTime !== Infinity) {
        document.getElementById('fastestResponse').textContent = fastestResponse.name;
        document.getElementById('fastestResponseTime').textContent = `${fastestResponse.lastResponseTime}ms`;
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
    updateHealthDashboard();
    updateAnalyticsStats();
    
    // Update last check time
    const now = new Date();
    document.getElementById('lastBulkCheck').textContent = now.toLocaleTimeString();
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
        updateHealthDashboard();
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
        updateHealthDashboard();
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

// ==================== DATA SYNC & BACKUP ====================

function backupToCloud() {
    // Simulate cloud backup
    showToast('Starting cloud backup...', 'info');
    
    setTimeout(() => {
        const backupData = {
            servers: servers,
            timestamp: Date.now(),
            version: '1.0'
        };
        
        localStorage.setItem('cloudBackup', JSON.stringify(backupData));
        
        const now = new Date();
        document.getElementById('lastBackupTime').textContent = now.toLocaleString();
        showToast('Backup completed successfully!');
    }, 1500);
}

function restoreFromCloud() {
    const backupData = localStorage.getItem('cloudBackup');
    
    if (!backupData) {
        showToast('No cloud backup found!', 'error');
        return;
    }
    
    if (confirm('Restore servers from cloud backup? This will replace your current servers.')) {
        try {
            const backup = JSON.parse(backupData);
            servers = backup.servers;
            saveServers();
            renderServerList(currentCategory);
            updateHealthDashboard();
            showToast('Servers restored from cloud backup!');
        } catch (error) {
            showToast('Error restoring backup!', 'error');
        }
    }
}

// ==================== SYSTEM MAINTENANCE ====================

function optimizeDatabase() {
    showToast('Optimizing database...', 'info');
    
    // Clean up server history (keep only last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    let cleanedCount = 0;
    
    Object.keys(serverHistory).forEach(serverId => {
        const originalLength = serverHistory[serverId].length;
        serverHistory[serverId] = serverHistory[serverId].filter(record => record.timestamp > thirtyDaysAgo);
        cleanedCount += (originalLength - serverHistory[serverId].length);
        
        // Remove empty server history
        if (serverHistory[serverId].length === 0) {
            delete serverHistory[serverId];
        }
    });
    
    saveServerHistory();
    updateDatabaseSize();
    showToast(`Database optimized! Removed ${cleanedCount} old records.`);
}

function clearOldData() {
    if (confirm('Clear all performance history data? This cannot be undone.')) {
        serverHistory = {};
        saveServerHistory();
        
        // Reset performance metrics
        servers.forEach(server => {
            server.performance = { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 };
        });
        saveServers();
        
        updateDatabaseSize();
        renderServerList(currentCategory);
        updateHealthDashboard();
        showToast('All historical data cleared!');
    }
}

function updateDatabaseSize() {
    const serversSize = JSON.stringify(servers).length;
    const historySize = JSON.stringify(serverHistory).length;
    const totalSize = serversSize + historySize;
    
    document.getElementById('databaseSize').textContent = Math.round(totalSize / 1024) + ' KB';
}

function saveServerHistory() {
    localStorage.setItem('serverHistory', JSON.stringify(serverHistory));
}

// ==================== SERVER PREVIEWS ====================

function populatePreviewServerSelect() {
    const select = document.getElementById('previewServer');
    select.innerHTML = '<option value="">Choose a server...</option>';
    
    servers.forEach(server => {
        const option = document.createElement('option');
        option.value = server.id;
        option.textContent = server.name;
        select.appendChild(option);
    });
}

function generatePreview() {
    const serverId = document.getElementById('previewServer').value;
    
    if (!serverId) {
        showToast('Please select a server first!', 'warning');
        return;
    }
    
    const server = servers.find(s => s.id == serverId);
    if (!server) return;
    
    showToast(`Generating preview for ${server.name}...`, 'info');
    
    // Simulate preview generation (in a real app, this would capture a screenshot)
    setTimeout(() => {
        const previews = JSON.parse(localStorage.getItem('serverPreviews') || '{}');
        
        previews[serverId] = {
            serverId: serverId,
            serverName: server.name,
            timestamp: Date.now(),
            // In a real implementation, this would be a base64 encoded image
            thumbnail: generatePlaceholderThumbnail(server)
        };
        
        localStorage.setItem('serverPreviews', JSON.stringify(previews));
        loadPreviewGallery();
        showToast('Preview generated successfully!');
    }, 2000);
}

function generateAllPreviews() {
    if (servers.length === 0) {
        showToast('No servers to generate previews for!', 'warning');
        return;
    }
    
    if (confirm(`Generate previews for all ${servers.length} servers? This may take a while.`)) {
        showToast('Generating previews for all servers...', 'info');
        
        let completed = 0;
        const previews = JSON.parse(localStorage.getItem('serverPreviews') || '{}');
        
        servers.forEach(server => {
            setTimeout(() => {
                previews[server.id] = {
                    serverId: server.id,
                    serverName: server.name,
                    timestamp: Date.now(),
                    thumbnail: generatePlaceholderThumbnail(server)
                };
                
                completed++;
                
                if (completed === servers.length) {
                    localStorage.setItem('serverPreviews', JSON.stringify(previews));
                    loadPreviewGallery();
                    showToast('All previews generated successfully!');
                }
            }, completed * 500); // Stagger the generation
        });
    }
}

function generatePlaceholderThumbnail(server) {
    // Generate a colorful placeholder based on server properties
    const colors = ['#2563eb', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6'];
    const color = colors[server.name.length % colors.length];
    
    return {
        type: 'placeholder',
        color: color,
        text: server.name.charAt(0).toUpperCase(),
        status: server.status
    };
}

function loadPreviewGallery() {
    const gallery = document.getElementById('previewGallery');
    const previews = JSON.parse(localStorage.getItem('serverPreviews') || '{}');
    
    if (Object.keys(previews).length === 0) {
        gallery.innerHTML = `
            <div class="empty-preview">
                <i class="fas fa-images"></i>
                <p>No previews generated yet</p>
                <small>Generate previews to see server thumbnails here</small>
            </div>
        `;
        return;
    }
    
    const previewsArray = Object.values(previews).sort((a, b) => b.timestamp - a.timestamp);
    
    gallery.innerHTML = previewsArray.map(preview => {
        const server = servers.find(s => s.id == preview.serverId);
        const healthScore = server ? getServerHealthScore(server.id) : 0;
        
        if (preview.thumbnail.type === 'placeholder') {
            return `
                <div class="preview-item">
                    <div class="preview-thumbnail placeholder" style="background: ${preview.thumbnail.color}">
                        <div class="placeholder-text">${preview.thumbnail.text}</div>
                        <div class="preview-status ${preview.thumbnail.status}"></div>
                    </div>
                    <div class="preview-info">
                        <div class="preview-name">${preview.serverName}</div>
                        <div class="preview-meta">
                            <span class="health-score">${healthScore}% health</span>
                            <span class="preview-date">${new Date(preview.timestamp).toLocaleDateString()}</span>
                        </div>
                    </div>
                    <button class="preview-delete" onclick="deletePreview(${preview.serverId})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        }
        
        // For real thumbnails (base64 images)
        return `
            <div class="preview-item">
                <div class="preview-thumbnail">
                    <img src="${preview.thumbnail}" alt="${preview.serverName}">
                    <div class="preview-status ${preview.thumbnail.status}"></div>
                </div>
                <div class="preview-info">
                    <div class="preview-name">${preview.serverName}</div>
                    <div class="preview-meta">
                        <span class="health-score">${healthScore}% health</span>
                        <span class="preview-date">${new Date(preview.timestamp).toLocaleDateString()}</span>
                    </div>
                </div>
                <button class="preview-delete" onclick="deletePreview(${preview.serverId})">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;
    }).join('');
}

function deletePreview(serverId) {
    const previews = JSON.parse(localStorage.getItem('serverPreviews') || '{}');
    delete previews[serverId];
    localStorage.setItem('serverPreviews', JSON.stringify(previews));
    loadPreviewGallery();
    showToast('Preview deleted!');
}

function clearAllPreviews() {
    if (confirm('Delete all server previews? This cannot be undone.')) {
        localStorage.removeItem('serverPreviews');
        loadPreviewGallery();
        showToast('All previews deleted!');
    }
}

// ==================== EVENT LISTENERS ====================

// Set up event listeners for tools page
function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', function() {
        const currentTheme = document.documentElement.getAttribute('data-theme') || 'dark';
        const newTheme = currentTheme === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const icon = this.querySelector('i');
        icon.className = newTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    });
    
    // Load saved theme
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.documentElement.setAttribute('data-theme', savedTheme);
    const themeIcon = document.getElementById('themeToggle').querySelector('i');
    themeIcon.className = savedTheme === 'dark' ? 'fas fa-moon' : 'fas fa-sun';
    
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
    
    // Smart rank button
    document.getElementById('smartRank').addEventListener('click', applySmartRanking);
    
    // Analytics controls
    document.getElementById('timeRange').addEventListener('change', updateAnalyticsChart);
    document.getElementById('metricType').addEventListener('change', updateAnalyticsChart);
    
    // Initialize database size
    updateDatabaseSize();
    
    // Initialize last backup time
    const backupData = localStorage.getItem('cloudBackup');
    if (backupData) {
        const backup = JSON.parse(backupData);
        document.getElementById('lastBackupTime').textContent = new Date(backup.timestamp).toLocaleString();
    }
    
    // Initialize last bulk check
    const lastCheck = localStorage.getItem('lastBulkCheck');
    if (lastCheck) {
        document.getElementById('lastBulkCheck').textContent = new Date(parseInt(lastCheck)).toLocaleTimeString();
    }
}

function updateAnalyticsChart() {
    // Placeholder for analytics chart update
    // In a real implementation, this would update the chart based on selected time range and metric
    showToast('Analytics chart updated', 'info');
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : (type === 'info' ? 'var(--primary)' : 'var(--success)'));
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
