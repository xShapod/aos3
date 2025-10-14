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
    }
];

let currentSort = 'manual';
let currentCategory = 'all';
let currentEditServerId = null;

// ==================== AUTO-REFRESH VARIABLES ====================
let autoRefreshInterval = null;
let autoRefreshEnabled = false;

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
        });
    } else {
        // Save default servers if first time
        localStorage.setItem('ispServers', JSON.stringify(servers));
    }
    
    renderServers(currentCategory, currentSort);
    setupEventListeners();
    initializeAutoRefresh(); // Initialize auto-refresh
});

// ==================== REAL SERVER STATUS CHECKING FUNCTIONS ====================

// Enhanced Real server status checking with response time measurement
async function checkServerStatus(server) {
    // Show checking status immediately
    server.status = 'checking';
    server.lastChecked = Date.now();
    saveServers();
    renderServers(currentCategory, currentSort);

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
        renderServers(currentCategory, currentSort);
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

// Quick status check (only checks if server is reachable, faster)
async function quickCheckServerStatus(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    server.status = 'checking';
    renderServers(currentCategory, currentSort);

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
        renderServers(currentCategory, currentSort);
    }
}

// Quick check all function
async function quickCheckAllStatus() {
    showToast('Quick checking all servers...');
    
    const promises = servers.map(async (server) => {
        await quickCheckServerStatus(server.id);
    });
    
    await Promise.all(promises);
    showToast('Quick status check completed!');
}

// Helper function for relative time display
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

// ==================== BULK OPERATIONS ====================

// Delete all servers
function deleteAllServers() {
    if (confirm('Are you sure you want to delete ALL servers? This cannot be undone!')) {
        servers = [];
        saveServers();
        renderServers(currentCategory, currentSort);
        showToast('All servers deleted!');
        closeAllManagementModals();
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
        renderServers(currentCategory, currentSort);
        showToast(`All ${categoryName} servers deleted!`);
        closeAllManagementModals();
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
    renderServers(currentCategory, currentSort);
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

// ==================== AUTO-REFRESH STATUS ====================

// Initialize auto-refresh from saved settings
function initializeAutoRefresh() {
    const savedAutoRefresh = localStorage.getItem('autoRefreshEnabled');
    const savedInterval = localStorage.getItem('autoRefreshInterval');
    
    if (savedAutoRefresh === 'true') {
        autoRefreshEnabled = true;
        const interval = savedInterval ? parseInt(savedInterval) : 5;
        startAutoRefresh(interval);
        updateAutoRefreshUI(true, interval);
    }
}

// Start auto-refresh
function startAutoRefresh(intervalMinutes = 5) {
    if (autoRefreshInterval) clearInterval(autoRefreshInterval);
    
    autoRefreshInterval = setInterval(() => {
        showToast(`Auto-refresh: Checking all servers...`, 'info');
        quickCheckAllStatus();
    }, intervalMinutes * 60 * 1000);
    
    autoRefreshEnabled = true;
    localStorage.setItem('autoRefreshEnabled', 'true');
    localStorage.setItem('autoRefreshInterval', intervalMinutes.toString());
    
    showToast(`Auto-refresh started (every ${intervalMinutes} minutes)`);
    updateAutoRefreshUI(true, intervalMinutes);
}

// Stop auto-refresh
function stopAutoRefresh() {
    if (autoRefreshInterval) {
        clearInterval(autoRefreshInterval);
        autoRefreshInterval = null;
    }
    
    autoRefreshEnabled = false;
    localStorage.setItem('autoRefreshEnabled', 'false');
    updateAutoRefreshUI(false, 0);
    showToast('Auto-refresh stopped');
}

// Toggle auto-refresh
function toggleAutoRefresh() {
    if (autoRefreshEnabled) {
        stopAutoRefresh();
    } else {
        const interval = parseInt(document.getElementById('autoRefreshInterval').value) || 5;
        startAutoRefresh(interval);
    }
}

// Update auto-refresh UI
function updateAutoRefreshUI(enabled, interval) {
    const toggleBtn = document.getElementById('autoRefreshToggle');
    const statusSpan = document.getElementById('autoRefreshStatus');
    const refreshBar = document.getElementById('autoRefreshBar');
    
    if (toggleBtn && statusSpan) {
        toggleBtn.innerHTML = enabled ? 
            '<i class="fas fa-stop"></i> Stop Auto-Refresh' : 
            '<i class="fas fa-play"></i> Start Auto-Refresh';
        toggleBtn.className = enabled ? 'btn btn-warning' : 'btn btn-success';
        statusSpan.textContent = enabled ? `Running (every ${interval} minutes)` : 'Stopped';
    }
    
    if (refreshBar) {
        refreshBar.style.display = enabled ? 'block' : 'none';
    }
}

// ==================== MAIN APPLICATION FUNCTIONS ====================

// Render servers based on category and sort
function renderServers(category, sortBy) {
    const serverGrid = document.getElementById('serverGrid');
    serverGrid.innerHTML = '';
    
    let filteredServers = servers;
    
    if (category !== 'all') {
        if (category === 'favorites') {
            filteredServers = servers.filter(server => server.isFavorite);
        } else {
            filteredServers = filteredServers.filter(server => server.categories.includes(category));
        }
    }
    
    // Apply search filter if any
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filteredServers = filteredServers.filter(server => 
            server.name.toLowerCase().includes(searchTerm) || 
            (server.description && server.description.toLowerCase().includes(searchTerm))
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
    
    filteredServers.forEach(server => {
        const serverCard = document.createElement('div');
        serverCard.className = 'server-card-compact';
        serverCard.setAttribute('data-id', server.id);
        
        serverCard.innerHTML = `
            <div class="favorite-star ${server.isFavorite ? 'favorited' : ''}" onclick="toggleFavorite(${server.id})">
                <i class="fas fa-star"></i>
            </div>
            <div class="server-card-header">
                <div class="server-card-icon">
                    <i class="fas fa-server"></i>
                </div>
                <div class="server-card-title">
                    <div class="server-card-name">${server.name}</div>
                    <div class="server-card-status ${server.status}">
                        <i class="fas fa-circle"></i>
                        ${server.status === 'active' ? 'Active' : (server.status === 'checking' ? 'Checking' : 'Inactive')}
                    </div>
                </div>
            </div>
            <div class="server-card-address" title="${server.address}">${server.address}</div>
            <div class="server-card-meta">
                <span class="bdix-badge ${server.type}">${server.type === 'bdix' ? 'BDIX' : 'Non-BDIX'}</span>
                ${server.lastResponseTime ? `<span class="response-time">${server.lastResponseTime}ms</span>` : ''}
            </div>
            <div class="server-card-actions">
                <button class="btn btn-primary" onclick="connectToServer('${server.address}')">
                    <i class="fas fa-external-link-alt"></i>
                </button>
                <button class="btn btn-info" onclick="checkSingleServerStatus(${server.id})">
                    <i class="fas fa-sync-alt"></i>
                </button>
            </div>
        `;
        serverGrid.appendChild(serverCard);
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

// Sort servers based on criteria
function sortServers(servers, sortBy) {
    const sortedServers = [...servers];
    
    switch(sortBy) {
        case 'manual':
            return sortedServers.sort((a, b) => a.rank - b.rank);
        case 'name':
            return sortedServers.sort((a, b) => a.name.localeCompare(b.name));
        case 'recent':
            return sortedServers.sort((a, b) => b.createdAt - a.createdAt);
        default:
            return sortedServers;
    }
}

// Toggle favorite
function toggleFavorite(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
        server.isFavorite = !server.isFavorite;
        saveServers();
        renderServers(currentCategory, currentSort);
        showToast(server.isFavorite ? 'Added to favorites!' : 'Removed from favorites!');
    }
}

// Enhanced Open edit modal
function openEditModal(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (server) {
        currentEditServerId = serverId;
        
        // Populate all fields
        document.getElementById('editServerName').value = server.name;
        document.getElementById('editServerAddress').value = server.address;
        document.getElementById('editStatus').value = server.status;
        document.getElementById('editType').value = server.type;
        document.getElementById('editDescription').value = server.description || '';
        
        // Populate categories checkboxes
        const categoryCheckboxes = document.querySelectorAll('#editModalBody input[name="editCategories"]');
        categoryCheckboxes.forEach(checkbox => {
            checkbox.checked = server.categories && server.categories.includes(checkbox.value);
        });
        
        document.getElementById('editServerModal').style.display = 'flex';
    }
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editServerModal').style.display = 'none';
    currentEditServerId = null;
}

// ----------------------------------------------------------------------
// HELPER: Normalizes server address by removing protocol and trailing slash
// ----------------------------------------------------------------------
function normalizeAddress(address) {
    if (!address) return '';
    let normalized = address.toLowerCase().trim();
    
    // Remove protocol (http://, https://, ftp://)
    normalized = normalized.replace(/^(https?|ftp):\/\//i, '');
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
}

// ----------------------------------------------------------------------
// FIX: Uses String() comparison for IDs to ensure edited server is excluded
// ----------------------------------------------------------------------
function isAddressDuplicateInAnyCategory(address, categories, currentId = null) {
    const normalizedNewAddress = normalizeAddress(address);
    if (!normalizedNewAddress) return false;

    // Convert the ID being edited to a string for safe comparison
    const currentIdStr = currentId ? String(currentId) : null;

    return servers.some(existingServer => {
        // 1. Ignore the server being edited
        // CRITICAL FIX: Ensure both IDs are compared as strings to avoid type-coercion bugs
        if (currentIdStr && String(existingServer.id) === currentIdStr) {
            return false;
        }
        
        // 2. Address must match after normalization
        const normalizedExistingAddress = normalizeAddress(existingServer.address);
        if (normalizedExistingAddress !== normalizedNewAddress) {
            return false;
        }

        // 3. Must have at least one common category
        // Find if any category of the existing server is included in the new/edited server's categories
        return existingServer.categories.some(cat => categories.includes(cat));
    });
}

// Enhanced Save edit changes
function saveEditChanges() {
    if (currentEditServerId) {
        const server = servers.find(s => s.id === currentEditServerId);
        if (server) {
            // Get selected categories first for duplicate check
            const selectedCategories = [];
            document.querySelectorAll('#editModalBody input[name="editCategories"]:checked').forEach(checkbox => {
                selectedCategories.push(checkbox.value);
            });
            const newCategories = selectedCategories.length > 0 ? selectedCategories : ['others'];

            const newAddress = document.getElementById('editServerAddress').value;

            // --- START CRITICAL FIX: Only perform duplicate check if unique identifiers change ---
            const originalNormalizedAddress = normalizeAddress(server.address);
            const newNormalizedAddress = normalizeAddress(newAddress);
            
            // Compare categories by sorting and joining them into a string for reliable comparison
            // Defensive check for Array.isArray added for robustness
            const originalCategoriesStr = (Array.isArray(server.categories) ? server.categories : []).sort().join(',');
            const newCategoriesStr = newCategories.sort().join(',');
            
            // Check if the unique identifiers (Address or Categories) have actually changed
            const uniqueIdentifiersChanged = (originalNormalizedAddress !== newNormalizedAddress) || (originalCategoriesStr !== newCategoriesStr);
            
            let isDuplicate = false;
            if (uniqueIdentifiersChanged) {
                // DUPLICATE CHECK: Only run the check if the address or categories are being modified.
                if (isAddressDuplicateInAnyCategory(newAddress, newCategories, currentEditServerId)) {
                    isDuplicate = true;
                }
            }
            
            if (isDuplicate) {
                showToast('Error: Duplicate server address found in a matching category!', 'error');
                return;
            }
            // --- END CRITICAL FIX ---


            // If not duplicate (or check was skipped), save changes
            server.name = document.getElementById('editServerName').value;
            server.address = newAddress;
            server.status = document.getElementById('editStatus').value;
            server.type = document.getElementById('editType').value;
            server.description = document.getElementById('editDescription').value.trim() || ''; 
            server.categories = newCategories;
            
            saveServers();
            renderServers(currentCategory, currentSort);
            closeEditModal();
            showToast('Server updated successfully!');
        }
    }
}

// ----------------------------------------------------------------------
// NEW HELPER FUNCTION: Close all management-related modals
// ----------------------------------------------------------------------
function closeAllManagementModals() {
    // 1. Close Export/Import Modal
    document.getElementById('exportImportModal').style.display = 'none';
    // 2. Close Import from URL Modal
    document.getElementById('importUrlModal').style.display = 'none';
    // 3. Close Manage Servers Modal (The parent container modal)
    document.getElementById('manageServersModal').style.display = 'none';
}

// Close Export/Import Modal (Manual close only)
function closeModal() {
    document.getElementById('exportImportModal').style.display = 'none';
}

// ----------------------------------------------------------------------
// EXPORT/IMPORT ACTIONS MODIFIED TO CALL closeAllManagementModals()
// ----------------------------------------------------------------------

// Copy export data to clipboard
function copyExportData() {
    const exportData = document.getElementById('exportData');
    exportData.select();
    document.execCommand('copy');
    showToast('Server data copied to clipboard!');
    // [MODIFIED] Close all relevant modals after action
    closeAllManagementModals();
}

// Download backup file
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
    // [MODIFIED] Close all relevant modals after action
    closeAllManagementModals();
}

// Trigger file upload (no change, just triggers input click)
function triggerUpload() {
    document.getElementById('fileUpload').click();
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const rawImportedServers = JSON.parse(e.target.result);
            if (Array.isArray(rawImportedServers)) {

                // Prepare imported servers (Assign new unique IDs and ensure default fields)
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
                    lastResponseTime: server.lastResponseTime || null
                }));
                importedServers = importedServers.filter(s => s.address);


                if (confirm('Do you want to replace all current servers with the uploaded backup?')) {
                    servers = importedServers;
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    showToast('Servers restored from backup!');
                    // [MODIFIED] Close all relevant modals after action
                    closeAllManagementModals(); 
                } else {
                    // MERGE Logic with DUPLICATE CHECKING
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
                    showToast(`Servers merged with backup! Added ${importedServers.length - duplicatesSkipped} new entries.`, duplicatesSkipped > 0 ? 'warning' : 'success');
                    // [MODIFIED] Close all relevant modals after action
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
    
    // Reset file input
    event.target.value = '';
}

// Replace all servers with imported data
function replaceServers() {
    const exportData = document.getElementById('exportData');
    try {
        const importedServers = JSON.parse(exportData.value);
        if (Array.isArray(importedServers)) {
            servers = importedServers;
            saveServers();
            renderServers(currentCategory, currentSort);
            // OLD: closeModal();
            // [MODIFIED] Close all relevant modals after action
            closeAllManagementModals();
            showToast('All servers replaced successfully!');
        } else {
            showToast('Invalid server data format!', 'error');
        }
    } catch (e) {
        showToast('Invalid JSON data!', 'error');
    }
}

// Merge imported data with existing servers
function mergeServers() {
    const exportData = document.getElementById('exportData');
    try {
        const rawImportedServers = JSON.parse(exportData.value);
        if (Array.isArray(rawImportedServers)) {
            
            // Prepare imported servers (Assign new unique IDs and ensure default fields)
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
                lastResponseTime: server.lastResponseTime || null
            }));
            importedServers = importedServers.filter(s => s.address);

            // MERGE Logic with DUPLICATE CHECKING
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
            // OLD: closeModal();
            // [MODIFIED] Close all relevant modals after action
            closeAllManagementModals();
            showToast(`Servers merged successfully! Added ${importedServers.length - duplicatesSkipped} new entries.`, duplicatesSkipped > 0 ? 'warning' : 'success');
        } else {
            showToast('Invalid server data format!', 'error');
        }
    } catch (e) {
        showToast('Invalid JSON data!', 'error');
    }
}

// ----------------------------------------------------------------------
// IMPORT FROM URL ACTION MODIFIED TO CALL closeAllManagementModals()
// ----------------------------------------------------------------------

/**
 * Parses the raw text content of a .txt file into an array of server objects.
 */
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
                categories: ['others'], // Default category for .txt imports
                type: address.includes('ftp') || address.includes('bdix') ? 'bdix' : 'non-bdix', // Simple type guess
                status: 'inactive',
                description: '',
                rank: servers.length + newServers.length + 1,
                createdAt: Date.now(),
                isFavorite: false,
                lastChecked: null,
                lastResponseTime: null
             });
        }
    }
    
    return newServers;
}

// Import from URL function
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

        
        // Prepare imported servers (Assign new unique IDs and ensure default fields)
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
            lastResponseTime: server.lastResponseTime || null
        }));
        
        // Filter out any entries that might be empty or invalid after preparation
        importedServers = importedServers.filter(s => s.address);


        if (method === 'replace') {
            servers = importedServers;
            showToast(`All servers replaced from URL! Loaded ${servers.length} entries.`);
        } else {
            // MERGE Logic with DUPLICATE CHECKING
            const finalServers = [...servers];
            let duplicatesSkipped = 0;

            importedServers.forEach(importedServer => {
                // Check if adding this importedServer creates a duplicate in the *current* state of servers (which includes finalServers)
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
        // OLD: document.getElementById('importUrlModal').style.display = 'none';
        // [MODIFIED] Close all relevant modals after action
        closeAllManagementModals();
        
    } catch (e) {
        console.error('Import Failed:', e);
        showToast(`Error importing from URL: ${e.message}`, 'error');
    }
}

// Show export modal (no change)
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

// Show import modal (no change)
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
    
    // Focus on the textarea immediately
    setTimeout(() => {
        exportData.focus();
    }, 100);
}

// Set up event listeners (no change, only action functions changed)
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
    document.getElementById('searchInput').addEventListener('input', function() {
        renderServers(currentCategory, currentSort);
    });
    
    // Add server form
    document.getElementById('serverForm').addEventListener('submit', function(e) {
        e.preventDefault();
        addServer();
    });
    
    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', function() {
        window.location.href = 'settings.html';
    });

    // Manage Servers Modal Open/Close
    document.getElementById('manageServersBtn').addEventListener('click', function() {
        document.getElementById('manageServersModal').style.display = 'flex';
    });
    
    document.getElementById('closeManageModal').addEventListener('click', function() {
        document.getElementById('manageServersModal').style.display = 'none';
    });

    // Export/Import buttons
    document.getElementById('exportBtn').addEventListener('click', showExportModal);
    document.getElementById('importBtn').addEventListener('click', showImportModal);
    document.getElementById('downloadBtn').addEventListener('click', downloadBackup);
    document.getElementById('uploadBtn').addEventListener('click', triggerUpload);
    document.getElementById('fileUpload').addEventListener('change', handleFileUpload);
    
    // Import from URL button
    document.getElementById('importUrlBtn').addEventListener('click', function() {
        document.getElementById('importUrlModal').style.display = 'flex';
    });
    
    document.getElementById('closeUrlModal').addEventListener('click', function() {
        document.getElementById('importUrlModal').style.display = 'none';
    });
    
    document.getElementById('confirmImportUrl').addEventListener('click', importFromURL);
    
    document.getElementById('closeModal').addEventListener('click', closeModal);
    document.getElementById('copyData').addEventListener('click', copyExportData);
    document.getElementById('replaceData').addEventListener('click', replaceServers);
    document.getElementById('mergeData').addEventListener('click', mergeServers);
    
    // Edit modal events
    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);
    document.getElementById('saveEdit').addEventListener('click', saveEditChanges);
    
    // Auto-refresh toggle
    document.getElementById('autoRefreshToggle').addEventListener('click', toggleAutoRefresh);
    
    // Close modals when clicking outside
    document.getElementById('exportImportModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    
    document.getElementById('editServerModal').addEventListener('click', function(e) {
        if (e.target === this) closeEditModal();
    });

    document.getElementById('manageServersModal').addEventListener('click', function(e) {
        if (e.target === this) document.getElementById('manageServersModal').style.display = 'none';
    });
    
    document.getElementById('importUrlModal').addEventListener('click', function(e) {
        if (e.target === this) document.getElementById('importUrlModal').style.display = 'none';
    });
}

// ----------------------------------------------------------------------
// ADD SERVER ACTION MODIFIED TO CALL closeAllManagementModals()
// ----------------------------------------------------------------------
// Enhanced Add a new server with multiple categories
function addServer() {
    const name = document.getElementById('serverName').value;
    const address = document.getElementById('serverAddress').value;
    const type = document.getElementById('serverType').value;
    const description = document.getElementById('serverDescription').value;
    
    // Get selected categories
    const selectedCategories = [];
    document.querySelectorAll('#serverForm input[name="serverCategories"]:checked').forEach(checkbox => {
        selectedCategories.push(checkbox.value);
    });
    
    // Ensure at least one category is selected, or default to 'others'
    const categories = selectedCategories.length > 0 ? selectedCategories : ['others'];

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
        lastResponseTime: null
    };
    
    servers.push(newServer);
    saveServers();
    renderServers(currentCategory, currentSort);
    
    // Reset form
    document.getElementById('serverForm').reset();
    
    // OLD: document.getElementById('manageServersModal').style.display = 'none';
    // [MODIFIED] Close all relevant modals after action
    closeAllManagementModals();

    // Show confirmation toast
    showToast(`Server "${name}" added successfully!`);
}

// Delete a server
function deleteServer(id) {
    if (confirm('Are you sure you want to delete this server?')) {
        const serverName = servers.find(server => server.id === id).name;
        servers = servers.filter(server => server.id !== id);
        
        // Recalculate ranks
        servers.forEach((server, index) => {
            server.rank = index + 1;
        });
        
        saveServers();
        renderServers(currentCategory, currentSort);
        
        showToast(`Server "${serverName}" deleted successfully!`);
    }
}

// Connect to server - ACTUALLY OPENS THE URL
function connectToServer(address) {
    showToast(`Opening: ${address}`);
    
    // Actually open the URL in a new tab
    try {
        window.open(address, '_blank');
    } catch (e) {
        // Fallback if window.open is blocked
        showToast(`Could not open automatically. Please copy and paste: ${address}`);
        // Copy to clipboard as fallback
        navigator.clipboard.writeText(address).then(() => {
            showToast(`URL copied to clipboard: ${address}`);
        });
    }
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