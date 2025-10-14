// Sample data for demonstration
let servers = [
    {
        id: 1,
        name: "Live Sports HD",
        address: "http://live.sports.isp.com",
        categories: ["live"],
        type: "bdix",
        status: "active",
        description: "Watch live cricket and football.",
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
        description: "Thousands of movies, regularly updated.",
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
        description: "All popular web series and TV shows.",
        rank: 3,
        createdAt: new Date('2023-03-10').getTime(),
        isFavorite: false,
    }
];

let currentSort = 'manual';
let currentCategory = 'all';
let currentEditServerId = null;

// Load servers from localStorage if available
document.addEventListener('DOMContentLoaded', function() {
    const savedServers = localStorage.getItem('ispServers');
    if (savedServers) {
        servers = JSON.parse(savedServers);
        // Ensure all servers have necessary fields for robustness
        servers.forEach(server => {
            if (!server.categories) {
                server.categories = [server.category || 'others'];
            }
            if (!server.status) {
                server.status = 'inactive';
            }
            if (server.rank === undefined || server.rank === null) {
                server.rank = Date.now() + Math.random();
            }
        });
    } else {
        // Save default servers if first time
        saveServers();
    }
    
    renderServers(currentCategory, currentSort);
    setupEventListeners();
});

// --- SERVER VERIFICATION FEATURE ---

/**
 * Helper function to dynamically update a single server card's status in the UI.
 * @param {number} serverId - The ID of the server.
 * @param {('active'|'inactive'|'verifying')} newStatus - The new status to display.
 */
function updateServerCardStatus(serverId, newStatus) {
    const card = document.querySelector(`.server-card[data-id="${serverId}"]`);
    if (card) {
        const statusDiv = card.querySelector('.server-status');
        
        let bdixBadgeHTML = '';
        if (statusDiv) {
             const bdixBadge = statusDiv.querySelector('.bdix-badge');
             if (bdixBadge) {
                 bdixBadgeHTML = bdixBadge.outerHTML;
             }
        }
        
        if (statusDiv) {
            statusDiv.classList.remove('active', 'inactive', 'verifying');
            statusDiv.classList.add(newStatus);
            
            const statusText = newStatus.charAt(0).toUpperCase() + newStatus.slice(1);
            
            // Update the status div content
            statusDiv.innerHTML = `
                <i class="fas fa-circle ${newStatus === 'verifying' ? 'fa-pulse' : ''}"></i>
                ${statusText}
                ${bdixBadgeHTML}
            `;
        }
        
        // Update the individual verify button icon/state
        const verifyButton = card.querySelector('.verify-btn');
        if (verifyButton) {
            verifyButton.disabled = (newStatus === 'verifying');
            verifyButton.innerHTML = (newStatus === 'verifying') 
                ? '<i class="fas fa-spinner fa-spin"></i> Verifying' 
                : '<i class="fas fa-sync-alt"></i> Verify';
        }
    }
}

/**
 * Function to check a single server's status (Individual Verify Button Logic).
 * Uses fetch with 'HEAD' method and 'no-cors' to check accessibility/liveness.
 * @param {number} serverId - The ID of the server to check.
 */
async function checkServerStatus(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;
    
    // 1. Set status to verifying and update UI
    server.status = 'verifying';
    updateServerCardStatus(serverId, 'verifying');
    
    let newStatus = 'inactive';
    
    try {
        // Use a 5-second timeout and a HEAD request for speed
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000); 

        // Use no-cors mode to allow checking addresses that don't support CORS headers
        const response = await fetch(server.address, { 
            method: 'HEAD', 
            mode: 'no-cors', 
            signal: controller.signal
        });
        
        clearTimeout(timeoutId);
        
        // In 'no-cors' mode, any successful network connection results in a 'type: opaque' response.
        // If the fetch completes without error or abort, we assume the server is 'active'.
        newStatus = 'active'; 

    } catch (error) {
        // Network errors, timeouts, or controller aborts result in 'inactive'
        newStatus = 'inactive';
    }

    // 2. Update server object and save
    const toastType = newStatus === 'active' ? 'success' : 'error';
    const toastMessage = `Server "${server.name}" status: ${newStatus === 'active' ? 'Active' : 'Inactive'}`;
    
    server.status = newStatus;
    saveServers();

    // 3. Update UI
    updateServerCardStatus(serverId, newStatus);
    showToast(toastMessage, toastType);
}

// --- CORE APPLICATION LOGIC (RESTORED/RETAINED) ---

/**
 * Render servers based on category, search term, and sort order.
 * (MODIFIED to include the verify button in the card HTML).
 * @param {string} category - The category filter.
 * @param {string} sortBy - The sort criteria.
 */
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
        serverCard.className = 'server-card';
        serverCard.setAttribute('data-id', server.id);
        
        const isVerifying = server.status === 'verifying';
        
        serverCard.innerHTML = `
            <div class="favorite-star ${server.isFavorite ? 'favorited' : ''}" onclick="toggleFavorite(${server.id})">
                <i class="fas fa-star"></i>
            </div>
            <div class="server-header">
                <div>
                    <div class="server-name">${server.name}</div>
                    <div class="server-status ${server.status}">
                        <i class="fas fa-circle ${isVerifying ? 'fa-pulse' : ''}"></i>
                        ${isVerifying ? 'Verifying' : (server.status === 'active' ? 'Active' : 'Inactive')}
                        <span class="bdix-badge ${server.type}">${server.type === 'bdix' ? 'BDIX' : 'Non-BDIX'}</span>
                    </div>
                </div>
            </div>
            <div class="server-address">${server.address}</div>
            ${server.description ? `<div class="server-description">${server.description}</div>` : ''}
            ${server.categories && server.categories.length > 0 ? `
                <div class="server-categories">
                    ${server.categories.map(cat => `<span class="server-category">${getCategoryDisplayName(cat)}</span>`).join('')}
                </div>
            ` : ''}
            <div class="server-actions">
                <button class="btn btn-warning verify-btn" onclick="checkServerStatus(${server.id})" ${isVerifying ? 'disabled' : ''}>
                    <i class="fas ${isVerifying ? 'fa-spinner fa-spin' : 'fa-sync-alt'}"></i> ${isVerifying ? 'Verifying' : 'Verify'}
                </button>
                
                <button class="btn btn-primary" onclick="connectToServer('${server.address}')">
                    <i class="fas fa-external-link-alt"></i> Open
                </button>
                
                <button class="btn btn-info" onclick="openEditModal(${server.id})">
                    <i class="fas fa-edit"></i> Edit
                </button>
                
                <button class="btn btn-danger" onclick="deleteServer(${server.id})">
                    <i class="fas fa-trash"></i> Delete
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

// Open edit modal
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
        const categoryCheckboxes = document.querySelectorAll('#editServerModal input[name="editCategories"]');
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

// Helper: Normalizes server address by removing protocol and trailing slash
function normalizeAddress(address) {
    if (!address) return '';
    let normalized = address.toLowerCase().trim();
    
    // Remove protocol (http://, https://, ftp://)
    normalized = normalized.replace(/^(https?|ftp):\/\//i, '');
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
}

// Check for duplicate address in same category
function isAddressDuplicateInAnyCategory(address, categories, currentId = null) {
    const normalizedNewAddress = normalizeAddress(address);
    if (!normalizedNewAddress) return false;

    const currentIdStr = currentId ? String(currentId) : null;

    return servers.some(existingServer => {
        // 1. Ignore the server being edited
        if (currentIdStr && String(existingServer.id) === currentIdStr) {
            return false;
        }
        
        // 2. Address must match after normalization
        const normalizedExistingAddress = normalizeAddress(existingServer.address);
        if (normalizedExistingAddress !== normalizedNewAddress) {
            return false;
        }

        // 3. Must have at least one common category
        return existingServer.categories.some(cat => categories.includes(cat));
    });
}

// Save edit changes
function saveEditChanges() {
    if (currentEditServerId) {
        const server = servers.find(s => s.id === currentEditServerId);
        if (server) {
            // Get selected categories first for duplicate check
            const selectedCategories = [];
            document.querySelectorAll('#editServerModal input[name="editCategories"]:checked').forEach(checkbox => {
                selectedCategories.push(checkbox.value);
            });
            const newCategories = selectedCategories.length > 0 ? selectedCategories : ['others'];

            const newAddress = document.getElementById('editServerAddress').value;

            // Check if the unique identifiers (Address or Categories) have actually changed
            const originalNormalizedAddress = normalizeAddress(server.address);
            const newNormalizedAddress = normalizeAddress(newAddress);
            const originalCategoriesStr = (Array.isArray(server.categories) ? server.categories : []).sort().join(',');
            const newCategoriesStr = newCategories.sort().join(',');
            
            const uniqueIdentifiersChanged = (originalNormalizedAddress !== newNormalizedAddress) || (originalCategoriesStr !== newCategoriesStr);
            
            let isDuplicate = false;
            if (uniqueIdentifiersChanged) {
                if (isAddressDuplicateInAnyCategory(newAddress, newCategories, currentEditServerId)) {
                    isDuplicate = true;
                }
            }
            
            if (isDuplicate) {
                showToast('Error: Duplicate server address found in a matching category!', 'error');
                return;
            }

            // Save changes
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

// Close all management-related modals
function closeAllManagementModals() {
    document.getElementById('exportImportModal').style.display = 'none';
    document.getElementById('importUrlModal').style.display = 'none';
    document.getElementById('manageServersModal').style.display = 'none';
}

// Close Export/Import Modal (Manual close only)
function closeModal() {
    document.getElementById('exportImportModal').style.display = 'none';
}

// Open Import URL Modal
function openImportUrlModal() {
    document.getElementById('manageServersModal').style.display = 'none';
    document.getElementById('importUrlModal').style.display = 'flex';
}

// Close Manage Servers Modal
function closeManageModal() {
    document.getElementById('manageServersModal').style.display = 'none';
}

// Copy export data to clipboard
function copyExportData() {
    const exportData = document.getElementById('exportData');
    exportData.select();
    document.execCommand('copy');
    showToast('Server data copied to clipboard!');
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
    closeAllManagementModals();
}

// Trigger file upload
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
                    isFavorite: server.isFavorite || false
                }));

                importedServers = importedServers.filter(s => s.address);
                
                if (confirm('Do you want to replace all current servers with the uploaded backup?')) {
                    servers = importedServers;
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    showToast('Servers restored from backup!');
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
            // Add or ensure 'status' field for imported servers
            servers = importedServers.map(server => ({
                ...server,
                status: server.status || 'inactive'
            }));
            
            saveServers();
            renderServers(currentCategory, currentSort);
            closeAllManagementModals(); 
            showToast('All servers replaced successfully!');
        } else {
            showToast('Invalid JSON format for import!', 'error');
        }
    } catch (e) {
        showToast('Error parsing JSON data!', 'error');
    }
}

// Merge imported data with existing servers
function mergeServers() {
    const exportData = document.getElementById('exportData');
    try {
        const importedServers = JSON.parse(exportData.value);

        if (Array.isArray(importedServers)) {
            const finalServers = [...servers];
            let duplicatesSkipped = 0;
            
            importedServers.forEach(rawServer => {
                // Prepare raw imported server for merge (Assign new unique ID and ensure default fields)
                const importedServer = {
                    id: Date.now() + Math.random(),
                    name: rawServer.name || 'Untitled Server',
                    address: (rawServer.address || '').trim(),
                    description: rawServer.description || '',
                    categories: Array.isArray(rawServer.categories) ? rawServer.categories : ['others'],
                    type: rawServer.type || 'non-bdix',
                    status: rawServer.status || 'inactive',
                    rank: servers.length + Math.random(),
                    createdAt: rawServer.createdAt || Date.now(),
                    isFavorite: rawServer.isFavorite || false
                };

                if (!importedServer.address) return;

                if (isAddressDuplicateInAnyCategory(importedServer.address, importedServer.categories)) {
                    duplicatesSkipped++;
                } else {
                    finalServers.push(importedServer);
                }
            });

            servers = finalServers;
            saveServers();
            renderServers(currentCategory, currentSort);
            closeAllManagementModals();
            showToast(`Servers merged! Added ${importedServers.length - duplicatesSkipped} new entries.`, duplicatesSkipped > 0 ? 'warning' : 'success');

        } else {
            showToast('Invalid JSON format for merge!', 'error');
        }
    } catch (e) {
        showToast('Error parsing JSON data!', 'error');
    }
}

// Show Export/Import Modal
function showExportImportModal(mode) {
    const modal = document.getElementById('exportImportModal');
    const modalTitle = document.getElementById('eiModalTitle');
    const modalBody = document.getElementById('exportData');
    const modalFooter = document.getElementById('eiModalFooter');
    
    modalBody.value = '';
    modalFooter.innerHTML = '';
    
    if (mode === 'export') {
        modalTitle.innerHTML = '<i class="fas fa-file-export"></i> Export Servers';
        modalBody.value = JSON.stringify(servers, null, 2);
        modalBody.readOnly = true;
        modalFooter.innerHTML = `
            <button class="btn btn-primary" onclick="copyExportData()">
                <i class="fas fa-copy"></i> Copy Data
            </button>
            <button class="btn btn-secondary" onclick="downloadBackup()">
                <i class="fas fa-download"></i> Download Backup
            </button>
        `;
    } else if (mode === 'import') {
        modalTitle.innerHTML = '<i class="fas fa-file-import"></i> Import Servers';
        modalBody.readOnly = false;
        modalBody.placeholder = 'Paste server JSON data here...';
        modalFooter.innerHTML = `
            <button class="btn btn-warning" onclick="mergeServers()">
                <i class="fas fa-code-merge"></i> Merge
            </button>
            <button class="btn btn-danger" onclick="replaceServers()">
                <i class="fas fa-exclamation-triangle"></i> Replace All
            </button>
            <button class="btn btn-info" onclick="triggerUpload()">
                <i class="fas fa-upload"></i> Upload File
            </button>
        `;
    }
    
    modal.style.display = 'flex';
}

// Import servers from a URL (using proxy to bypass CORS if possible, or direct fetch)
async function importFromUrl() {
    const url = document.getElementById('importUrl').value;
    if (!url) {
        showToast('Please enter a valid URL.', 'error');
        return;
    }
    
    closeAllManagementModals();
    showToast('Fetching server list from URL...', 'warning');
    
    try {
        // Direct fetch attempt (will work if the server has proper CORS headers)
        let response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const rawImportedServers = await response.json();
        
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
                isFavorite: server.isFavorite || false
            }));

            importedServers = importedServers.filter(s => s.address);

            // Merge logic
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
            showToast(`Servers merged from URL! Added ${importedServers.length - duplicatesSkipped} new entries.`, duplicatesSkipped > 0 ? 'warning' : 'success');

        } else {
            showToast('Invalid JSON data format from URL!', 'error');
        }
    } catch (e) {
        console.error('Import from URL error:', e);
        showToast(`Error fetching/parsing URL: ${e.message}. Check URL or CORS policy.`, 'error');
    }
}

// Setup all event listeners
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

    // Search input listener
    document.getElementById('searchInput').addEventListener('input', () => {
        renderServers(currentCategory, currentSort);
    });

    // Add Server form submission
    document.getElementById('serverForm').addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('serverName').value;
        const address = document.getElementById('serverAddress').value;
        const status = document.getElementById('serverStatus').value;
        const type = document.getElementById('serverType').value;
        const description = document.getElementById('serverDescription').value.trim();
        
        const selectedCategories = [];
        document.querySelectorAll('input[name="serverCategories"]:checked').forEach(checkbox => {
            selectedCategories.push(checkbox.value);
        });
        const categories = selectedCategories.length > 0 ? selectedCategories : ['others'];
        
        // DUPLICATE CHECK: Check if the address already exists in any of the selected categories
        if (isAddressDuplicateInAnyCategory(address, categories)) {
            showToast('Error: Server address already exists in a matching category!', 'error');
            return;
        }

        const newServer = {
            id: Date.now(),
            name,
            address: address.trim(),
            description,
            categories,
            type,
            status,
            rank: servers.length + 1, // Add new server to the end
            createdAt: Date.now(),
            isFavorite: false,
        };
        
        servers.push(newServer);
        saveServers();
        renderServers(currentCategory, currentSort);
        
        // Reset form and close modal
        this.reset();
        closeManageModal();
        showToast(`Server "${name}" added successfully!`);
    });

    // Edit Server form submission (using the saveEdit button)
    document.getElementById('saveEdit').addEventListener('click', saveEditChanges);

    // Manage Servers Modal toggle
    document.getElementById('manageServersBtn').addEventListener('click', function() {
        document.getElementById('manageServersModal').style.display = 'flex';
    });
    
    // Close Manage Servers Modal
    document.getElementById('closeManageModal').addEventListener('click', closeManageModal);

    // Close Modals when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === document.getElementById('manageServersModal')) {
            document.getElementById('manageServersModal').style.display = 'none';
        }
        if (event.target === document.getElementById('editServerModal')) {
            document.getElementById('editServerModal').style.display = 'none';
        }
        if (event.target === document.getElementById('exportImportModal')) {
            document.getElementById('exportImportModal').style.display = 'none';
        }
        if (event.target === document.getElementById('importUrlModal')) {
            document.getElementById('importUrlModal').style.display = 'none';
        }
    });

    // Handle file upload selection
    document.getElementById('fileUpload').addEventListener('change', handleFileUpload);
    
    // Settings button listener
    document.getElementById('settingsBtn').addEventListener('click', function() {
        window.location.href = 'settings.html';
    });
}

// Function to delete a server
function deleteServer(id) {
    const server = servers.find(s => s.id === id);
    if (!server) return;
    
    const serverName = server.name;
    
    if (confirm(`Are you sure you want to delete server: "${serverName}"?`)) {
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
