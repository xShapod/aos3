// Sample data for demonstration (MODIFIED: Descriptions and verification fields removed)
let servers = [
    {
        id: 1,
        name: "Live Sports HD",
        address: "http://live.sports.isp.com",
        categories: ["live"],
        type: "bdix",
        status: "active",
        description: "", // Now empty
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
        description: "", // Now empty
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
        description: "", // Now empty
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
            // Remove lastVerified field and ensure description is a string
            if (server.lastVerified !== undefined) {
                delete server.lastVerified;
            }
            if (!server.description) {
                server.description = '';
            }
            // Initialize new status checking fields
            if (!server.lastChecked) {
                server.lastChecked = null;
            }
            if (!server.lastResponseTime) {
                server.lastResponseTime = null;
            }
            // Initialize performance tracking
            if (!server.performance) {
                server.performance = { uptime: 0, avgResponseTime: null, lastWeekChecks: 0 };
            }
        });
    } else {
        // Save default servers if first time
        localStorage.setItem('ispServers', JSON.stringify(servers));
    }
    
    // Load server history
    const savedHistory = localStorage.getItem('serverHistory');
    if (savedHistory) {
        serverHistory = JSON.parse(savedHistory);
    }
    
    renderServers(currentCategory, currentSort);
    setupEventListeners();
    initializePerformanceTracking();
});

// ==================== ENHANCED STATUS CHECKING WITH RATE LIMITING ====================

// Rate limiting helper
function isRateLimited(serverId) {
    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    if (!checkRateLimit[serverId]) {
        checkRateLimit[serverId] = [];
    }
    
    // Remove old timestamps
    checkRateLimit[serverId] = checkRateLimit[serverId].filter(time => time > oneMinuteAgo);
    
    // Check if we've exceeded the rate limit
    if (checkRateLimit[serverId].length >= MAX_CHECKS_PER_MINUTE) {
        return true;
    }
    
    // Add current check timestamp
    checkRateLimit[serverId].push(now);
    return false;
}

// Enhanced server status checking with multiple methods
async function checkServerStatus(server) {
    // Rate limiting check
    if (isRateLimited(server.id)) {
        showToast(`Rate limit exceeded for ${server.name}. Please wait before checking again.`, 'warning');
        return;
    }
    
    // Show checking status immediately
    server.status = 'checking';
    server.lastChecked = Date.now();
    saveServers();
    renderServers(currentCategory, currentSort);

    const methods = [
        checkWithHeadRequest,
        checkWithGetRequest,
        checkWithImageRequest,
        checkWithTimeoutTest
    ];

    let bestResult = { status: 'inactive', responseTime: null, method: 'none' };

    for (let method of methods) {
        try {
            const result = await method(server);
            if (result.status === 'active') {
                bestResult = result;
                break; // Stop at first successful method
            }
        } catch (error) {
            console.log(`Method ${method.name} failed for ${server.address}:`, error);
        }
    }

    // Update server status and track performance
    server.status = bestResult.status;
    server.lastResponseTime = bestResult.responseTime;
    server.lastChecked = Date.now();
    
    // Track performance history
    trackServerPerformance(server.id, bestResult.responseTime, bestResult.status);
    
    saveServers();
    renderServers(currentCategory, currentSort);
}

// Method 1: HEAD request (fastest)
async function checkWithHeadRequest(server) {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    try {
        const response = await fetch(server.address, {
            method: 'HEAD',
            mode: 'no-cors',
            signal: controller.signal,
            cache: 'no-cache'
        });
        clearTimeout(timeoutId);
        
        const responseTime = performance.now() - startTime;
        return { status: 'active', responseTime: Math.round(responseTime), method: 'head' };
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Method 2: GET request (more reliable)
async function checkWithGetRequest(server) {
    const startTime = performance.now();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    try {
        const response = await fetch(server.address, {
            method: 'GET',
            mode: 'no-cors',
            signal: controller.signal,
            cache: 'no-cache',
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            }
        });
        clearTimeout(timeoutId);
        
        const responseTime = performance.now() - startTime;
        return { status: 'active', responseTime: Math.round(responseTime), method: 'get' };
    } catch (error) {
        clearTimeout(timeoutId);
        throw error;
    }
}

// Method 3: Image request (works for some BDIX servers)
function checkWithImageRequest(server) {
    return new Promise((resolve) => {
        const startTime = performance.now();
        const img = new Image();
        const timeout = setTimeout(() => {
            resolve({ status: 'inactive', responseTime: null, method: 'image' });
        }, 8000);

        img.onload = function() {
            clearTimeout(timeout);
            const responseTime = performance.now() - startTime;
            resolve({ status: 'active', responseTime: Math.round(responseTime), method: 'image' });
        };

        img.onerror = function() {
            clearTimeout(timeout);
            // Even on error, if we got this far, server might be reachable
            const responseTime = performance.now() - startTime;
            resolve({ status: 'active', responseTime: Math.round(responseTime), method: 'image' });
        };

        img.src = server.address + '/favicon.ico?t=' + Date.now();
    });
}

// Method 4: Timeout test with multiple attempts
async function checkWithTimeoutTest(server) {
    const timeouts = [3000, 5000, 8000];
    
    for (let timeout of timeouts) {
        try {
            const startTime = performance.now();
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            await fetch(server.address, {
                method: 'GET',
                mode: 'no-cors',
                signal: controller.signal
            });

            clearTimeout(timeoutId);
            const responseTime = performance.now() - startTime;
            return { status: 'active', responseTime: Math.round(responseTime), method: 'timeout-test' };
        } catch (error) {
            // Continue to next timeout
        }
    }
    throw new Error('All timeout attempts failed');
}

// ==================== PERFORMANCE MONITORING & ANALYTICS ====================

function initializePerformanceTracking() {
    // Clean up old history records (keep only last 30 days)
    const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
    Object.keys(serverHistory).forEach(serverId => {
        serverHistory[serverId] = serverHistory[serverId].filter(record => record.timestamp > thirtyDaysAgo);
    });
    saveServerHistory();
}

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
    
    // Keep only last 1000 records per server
    if (serverHistory[serverId].length > 1000) {
        serverHistory[serverId] = serverHistory[serverId].slice(-1000);
    }
    
    // Update server performance metrics
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
    
    // Calculate uptime percentage
    const successfulChecks = recentRecords.filter(r => r.uptime).length;
    const uptimePercentage = (successfulChecks / recentRecords.length) * 100;
    
    // Calculate average response time (only successful checks)
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

function getServerUptime(serverId) {
    const server = servers.find(s => s.id === serverId);
    return server?.performance?.uptime || 0;
}

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

function saveServerHistory() {
    localStorage.setItem('serverHistory', JSON.stringify(serverHistory));
}

// ==================== SMART SERVER RANKING SYSTEM ====================

function calculateSmartRank(server) {
    const healthScore = getServerHealthScore(server.id);
    const isFavorite = server.isFavorite ? 1.2 : 1; // Boost favorite servers
    const responseTimeBonus = server.lastResponseTime ? Math.max(0, 500 - server.lastResponseTime) / 10 : 0;
    
    return healthScore * isFavorite + responseTimeBonus;
}

function sortServersBySmartRank(servers) {
    return servers.sort((a, b) => {
        const scoreA = calculateSmartRank(a);
        const scoreB = calculateSmartRank(b);
        return scoreB - scoreA; // Descending order
    });
}

// ==================== INPUT VALIDATION & SANITIZATION ====================

function sanitizeInput(input) {
    if (typeof input !== 'string') return '';
    return input.trim().replace(/[<>]/g, ''); // Basic sanitization
}

function isValidURL(string) {
    try {
        const url = new URL(string);
        return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'ftp:';
    } catch (_) {
        return false;
    }
}

function validateServerInput(name, address, categories) {
    const errors = [];
    
    if (!name || name.trim().length < 2) {
        errors.push('Server name must be at least 2 characters long');
    }
    
    if (!isValidURL(address)) {
        errors.push('Please enter a valid URL (http, https, or ftp)');
    }
    
    if (!categories || categories.length === 0) {
        errors.push('Please select at least one category');
    }
    
    return errors;
}

// ==================== PERFORMANCE OPTIMIZATIONS ====================

// Debounced search
let searchTimeout;
function debounceSearch() {
    clearTimeout(searchTimeout);
    searchTimeout = setTimeout(() => {
        renderServers(currentCategory, currentSort);
    }, 300);
}

// Virtual scrolling for large lists
let visibleServers = [];
const ITEMS_PER_PAGE = 50;

function renderVirtualServers(servers) {
    // Implementation for virtual scrolling
    // This would be called by renderServers for large datasets
}

// ==================== PROFESSIONAL TABLE RENDER FUNCTION ====================

// Render servers based on category and sort - PROFESSIONAL DESIGN
function renderServers(category, sortBy) {
    const serverGrid = document.getElementById('serverGrid');
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
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
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

    // Create professional table structure
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

function getHealthLevel(score) {
    if (score >= 80) return 'excellent';
    if (score >= 60) return 'good';
    if (score >= 40) return 'fair';
    return 'poor';
}

// ... (rest of the existing functions remain similar but with enhancements)

// Check status for a single server
async function checkSingleServerStatus(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
        await checkServerStatus(server);
        showToast(`Status checked for ${server.name}`);
    }
}

// Bulk status check for all servers
async function checkAllServersStatus() {
    showToast('Checking status of all servers...');
    
    // Reset rate limiting for bulk operations
    checkRateLimit = {};
    
    for (let i = 0; i < servers.length; i++) {
        const server = servers[i];
        await checkServerStatus(server);
        
        // Add delay between checks to avoid overwhelming
        if (i < servers.length - 1) {
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
    }
    
    showToast('All servers status updated!');
}

// Enhanced Add a new server with validation
function addServer() {
    const name = sanitizeInput(document.getElementById('serverName').value);
    const address = sanitizeInput(document.getElementById('serverAddress').value);
    const type = document.getElementById('serverType').value;
    const description = sanitizeInput(document.getElementById('serverDescription').value);
    
    // Get selected categories
    const selectedCategories = [];
    document.querySelectorAll('#serverForm input[name="serverCategories"]:checked').forEach(checkbox => {
        selectedCategories.push(checkbox.value);
    });
    
    // Ensure at least one category is selected, or default to 'others'
    const categories = selectedCategories.length > 0 ? selectedCategories : ['others'];

    // Input validation
    const validationErrors = validateServerInput(name, address, categories);
    if (validationErrors.length > 0) {
        showToast(`Error: ${validationErrors.join(', ')}`, 'error');
        return;
    }

    // DUPLICATE CHECK
    if (isAddressDuplicateInAnyCategory(address, categories)) {
        showToast('Error: Duplicate server address found in a matching category!', 'error');
        return;
    }
    
    const newServer = {
        id: Date.now(), // Simple ID generation
        name,
        address: address.trim(),
        categories,
        type,
        status: 'inactive', // Default to inactive
        description: description.trim() || '', // Ensures description is optional/empty string
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
    
    // Reset form
    document.getElementById('serverForm').reset();
    
    // Close modal
    closeAllManagementModals();

    // Show confirmation toast
    showToast(`Server "${name}" added successfully!`);
}

// Show server analytics modal
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
    
    // Render performance chart (simplified)
    renderPerformanceChart(serverId);
}

function renderPerformanceChart(serverId) {
    const history = serverHistory[serverId] || [];
    const chartContainer = document.getElementById('performanceChart');
    
    if (history.length === 0) {
        chartContainer.innerHTML = '<div class="empty-chart">No performance data available</div>';
        return;
    }
    
    // Simplified chart rendering - in a real implementation, you'd use a charting library
    const recentData = history.slice(-20); // Last 20 checks
    const chartHtml = recentData.map((record, index) => `
        <div class="chart-bar" style="height: ${Math.min(100, (record.responseTime || 0) / 5)}%" 
             title="Response: ${record.responseTime || 'N/A'}ms - ${new Date(record.timestamp).toLocaleTimeString()}">
            <div class="bar-fill ${record.status === 'active' ? 'active' : 'inactive'}"></div>
        </div>
    `).join('');
    
    chartContainer.innerHTML = chartHtml;
}

// ... (continue with the rest of the existing functions, adding enhancements where needed)