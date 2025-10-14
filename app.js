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

// Load servers from localStorage if available
document.addEventListener('DOMContentLoaded', function() {
    const savedServers = localStorage.getItem('ispServers');
    if (savedServers) {
        servers = JSON.parse(savedServers);
        // Clean up old fields (for a clean migration from previous versions)
        servers.forEach(server => {
            if (!server.categories) {
                server.categories = [server.category || 'others'];
            }
            // Ensure necessary new fields are present
            if (!server.description) {
                server.description = '';
            }
            if (!server.lastChecked) {
                server.lastChecked = null;
            }
            // Remove old lastVerified field if present
            if (server.lastVerified !== undefined) {
                delete server.lastVerified;
            }
        });
    } else {
        // Save default servers if first time
        localStorage.setItem('ispServers', JSON.stringify(servers));
    }
    
    renderServers(currentCategory, currentSort);
    setupEventListeners();
});

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
    
    // Apply BDIX/Non-BDIX filter
    const typeFilter = document.querySelector('.type-filter-btn.active').getAttribute('data-type');
    if (typeFilter !== 'all') {
        filteredServers = filteredServers.filter(server => server.type === typeFilter);
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
        
        // Determine display status and icon for the card
        let statusText = server.status === 'active' ? 'Active' : 'Inactive';
        let statusClass = server.status;
        let statusIcon = '<i class="fas fa-circle"></i>';

        let lastCheckedDisplay = server.lastChecked ? 
            `<span class="last-checked" title="Last checked: ${new Date(server.lastChecked).toLocaleString()}">
                (${timeAgo(server.lastChecked)})
            </span>` : '';
        
        serverCard.innerHTML = `
            <div class="edit-icon" onclick="openEditModal(${server.id})">
                <i class="fas fa-edit"></i>
            </div>
            <div class="favorite-star ${server.isFavorite ? 'favorited' : ''}" onclick="toggleFavorite(${server.id})">
                <i class="fas fa-star"></i>
            </div>
            <div class="server-header">
                <div>
                    <div class="server-name">${server.name}</div>
                    <div class="server-status ${statusClass}">
                        ${statusIcon}
                        ${statusText}
                        <span class="bdix-badge ${server.type}">${server.type === 'bdix' ? 'BDIX' : 'Non-BDIX'}</span>
                        ${lastCheckedDisplay}
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
                <button class="btn btn-primary" onclick="connectToServer('${server.address}')">
                    <i class="fas fa-external-link-alt"></i> Open
                </button>
                <button class="btn btn-secondary" onclick="copyAddress('${server.address}')">
                    <i class="fas fa-copy"></i> Copy
                </button>
                <button class="btn btn-danger" onclick="deleteServer(${server.id})">
                    <i class="fas fa-trash"></i>
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

// Close edit modal
function closeEditModal() {
    document.getElementById('editServerModal').style.display = 'none';
    currentEditServerId = null;
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

// ----------------------------------------------------------------------
// NEW HELPER FUNCTION: Calculates time ago for status display
// ----------------------------------------------------------------------
function timeAgo(timestamp) {
    const seconds = Math.floor((new Date() - timestamp) / 1000);
    if (seconds < 60) return seconds + "s ago";
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + "y ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + "mo ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + "d ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + "h ago";
    interval = seconds / 60;
    return Math.floor(interval) + "m ago";
}

// ----------------------------------------------------------------------
// NEW ACTION: Copy Address
// ----------------------------------------------------------------------
function copyAddress(address) {
    navigator.clipboard.writeText(address).then(() => {
        showToast('Server address copied to clipboard!');
    }).catch(() => {
        showToast('Could not copy address. Try again.', 'error');
    });
}

// ----------------------------------------------------------------------
// NEW CORE FEATURE: Check Server Status (asynchronously)
// ----------------------------------------------------------------------
async function checkServerStatus(server) {
    // 1. Mark as checking and update UI immediately
    const serverElement = servers.find(s => s.id === server.id);
    if (serverElement) {
        serverElement.isChecking = true;
        updateCardStatus(serverElement, 'checking');
    }
    
    // 2. Perform the fetch
    const timeout = 10000; // 10 seconds timeout
    let isReachable = false;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Use 'no-cors' for cross-origin resources. A successful fetch() resolution 
        // (even with an opaque response) means the server is reachable.
        await fetch(server.address, { 
            method: 'HEAD', 
            mode: 'no-cors',
            signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        isReachable = true;

    } catch (error) {
        // Fetch failed (network error, CORS block, timeout, etc.)
        isReachable = false;
    }
    
    // 3. Update server data
    if (serverElement) {
        serverElement.isChecking = false;
        serverElement.lastChecked = Date.now();
        serverElement.status = isReachable ? 'active' : 'inactive'; // Auto-set status
        saveServers();
        
        // 4. Update UI
        updateCardStatus(serverElement, serverElement.status, serverElement.lastChecked);
    }
}

// ----------------------------------------------------------------------
// NEW UI HELPER: Update a single card's status block (to avoid full re-render)
// ----------------------------------------------------------------------
function updateCardStatus(server, newStatusClass, lastChecked = null) {
    const card = document.querySelector(`.server-card[data-id="${server.id}"]`);
    if (!card) return;

    const statusDiv = card.querySelector('.server-status');
    if (!statusDiv) return;

    // Remove previous status classes and add the new one
    statusDiv.classList.remove('active', 'inactive', 'checking');
    statusDiv.classList.add(newStatusClass);

    let statusText = newStatusClass === 'active' ? 'Active' : (newStatusClass === 'inactive' ? 'Inactive' : 'Checking...');
    let statusIcon = newStatusClass === 'checking' ? '<i class="fas fa-sync fa-spin"></i>' : '<i class="fas fa-circle"></i>';

    let lastCheckedDisplay = lastChecked ? 
        `<span class="last-checked" title="Last checked: ${new Date(lastChecked).toLocaleString()}">
            (${timeAgo(lastChecked)})
        </span>` : '';

    statusDiv.innerHTML = `
        ${statusIcon}
        ${statusText}
        <span class="bdix-badge ${server.type}">${server.type === 'bdix' ? 'BDIX' : 'Non-BDIX'}</span>
        ${lastCheckedDisplay}
    `;
}

// ----------------------------------------------------------------------
// NEW ACTION: Check all servers
// ----------------------------------------------------------------------
function checkAllServers() {
    showToast('Starting server verification. This may take a moment...', 'warning');
    // Filter to only check active/non-checking servers to prevent redundant network calls
    const serversToCheck = servers.filter(s => !s.isChecking);
    
    // Create an array of promises for sequential checking to avoid overwhelming the browser/network
    const checkPromises = serversToCheck.reduce((promiseChain, server) => {
        return promiseChain.then(() => checkServerStatus(server));
    }, Promise.resolve());
    
    checkPromises.then(() => {
        showToast('All servers have been verified!', 'success');
    }).catch(error => {
        showToast('An error occurred during verification.', 'error');
        console.error("Verification error:", error);
    });
}


// Add server logic
function addServer(event) {
    event.preventDefault();
    
    const name = document.getElementById('serverName').value.trim();
    const address = document.getElementById('serverAddress').value.trim();
    const status = document.getElementById('status').value;
    const type = document.getElementById('type').value;
    const description = document.getElementById('description').value.trim() || '';

    const selectedCategories = [];
    document.querySelectorAll('#serverForm input[name="categories"]:checked').forEach(checkbox => {
        selectedCategories.push(checkbox.value);
    });
    const categories = selectedCategories.length > 0 ? selectedCategories : ['others'];

    // Check for duplicates
    if (isAddressDuplicateInAnyCategory(address, categories)) {
        showToast('Error: Duplicate server address found in a matching category!', 'error');
        return;
    }
    
    const newServer = {
        id: Date.now() + Math.random(), // Unique ID generation
        name: name,
        address: address,
        categories: categories,
        type: type,
        status: status,
        description: description,
        rank: servers.length + 1, // Add to the end of manual rank order
        createdAt: Date.now(),
        isFavorite: false,
        lastChecked: null, // New field
    };

    servers.push(newServer);
    saveServers();
    
    // Clear the form
    document.getElementById('serverForm').reset();
    
    // Re-render the list
    renderServers(currentCategory, currentSort);
    
    showToast(`Server "${name}" added successfully!`);
}

// Delete server logic
function deleteServer(id) {
    const serverIndex = servers.findIndex(server => server.id === id);
    if (serverIndex > -1) {
        const serverName = servers[serverIndex].name;
        
        // Use confirm dialog for safety
        if (!confirm(`Are you sure you want to delete server "${serverName}"?`)) {
            return;
        }

        servers = servers.filter(server => server.id !== id);
        
        // Recalculate ranks to keep manual order sequential
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


// Event listeners setup
function setupEventListeners() {
    // Tab filtering
    document.querySelectorAll('.category-tabs .tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.category-tabs .tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.getAttribute('data-category');
            renderServers(currentCategory, currentSort);
        });
    });
    
    // Sort options
    document.querySelectorAll('.sort-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentSort = this.getAttribute('data-sort');
            renderServers(currentCategory, currentSort);
        });
    });
    
    // Add server form submission
    document.getElementById('serverForm').addEventListener('submit', addServer);
    
    // Manage Servers modal
    document.getElementById('manageServersBtn').addEventListener('click', function() {
        document.getElementById('manageServersModal').style.display = 'flex';
    });

    document.getElementById('closeManageModal').addEventListener('click', function() {
        document.getElementById('manageServersModal').style.display = 'none';
    });
    
    // Settings button
    document.getElementById('settingsBtn').addEventListener('click', function() {
        window.location.href = 'settings.html';
    });
    
    // Save edit changes
    document.getElementById('saveEdit').addEventListener('click', saveEditChanges);
    
    // Close edit modal
    document.getElementById('closeEditModal').addEventListener('click', closeEditModal);

    // Export/Import buttons
    document.getElementById('exportBtn').addEventListener('click', openExportModal);
    document.getElementById('importBtn').addEventListener('click', openImportModal);
    document.getElementById('importUrlBtn').addEventListener('click', openImportUrlModal);

    // Close Export/Import modal (parent)
    document.getElementById('closeModal').addEventListener('click', closeModal);

    // File upload trigger
    document.getElementById('fileUploadTrigger').addEventListener('click', triggerUpload);
    document.getElementById('fileUpload').addEventListener('change', handleFileUpload);
    
    // Import from URL button
    document.getElementById('importUrlSubmit').addEventListener('click', importFromURL);

    // Close Import URL modal
    document.getElementById('closeImportUrlModal').addEventListener('click', closeImportUrlModal);

    // Download/Copy actions
    document.getElementById('downloadBackup').addEventListener('click', downloadBackup);
    document.getElementById('copyExportData').addEventListener('click', copyExportData);

    // Search input for live filtering
    document.getElementById('searchInput').addEventListener('input', () => renderServers(currentCategory, currentSort));
    
    // NEW: Check All Servers button
    document.getElementById('checkAllServersBtn').addEventListener('click', checkAllServers);

    // NEW: Type Filter buttons (BDIX/Non-BDIX/All)
    document.querySelectorAll('.type-filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderServers(currentCategory, currentSort);
        });
    });
}
