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
        try {
            servers = JSON.parse(savedServers);
            // Ensure necessary fields are present for robustness
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
                if (!server.type) {
                    server.type = 'non-bdix'; // Default value if missing
                }
                if (server.lastVerified !== undefined) {
                    delete server.lastVerified; // Clean up old field
                }
            });
        } catch (e) {
            console.error("Error parsing stored server data:", e);
            showToast('Error loading saved data. Using default list.', 'error');
            // Revert to default servers
            localStorage.setItem('ispServers', JSON.stringify(servers));
        }
    } else {
        // Save default servers if first time
        localStorage.setItem('ispServers', JSON.stringify(servers));
    }
    
    // Initialize currentSort and currentCategory based on active tabs/buttons
    // Check if a category is already active in the DOM (e.g., after navigating back)
    const activeTab = document.querySelector('.category-tabs .tab.active');
    if (activeTab) {
        currentCategory = activeTab.getAttribute('data-category');
    }
    
    // Check if a sort button is already active
    const activeSortBtn = document.querySelector('.sort-btn.active[data-sort]');
    if (activeSortBtn) {
        currentSort = activeSortBtn.getAttribute('data-sort');
    }

    renderServers(currentCategory, currentSort);
    setupEventListeners();
});

// Render servers based on category and sort
function renderServers(category, sortBy) {
    const serverGrid = document.getElementById('serverGrid');
    serverGrid.innerHTML = '';
    
    let filteredServers = servers;
    
    // 1. Filter by Category
    if (category !== 'all') {
        if (category === 'favorites') {
            filteredServers = servers.filter(server => server.isFavorite);
        } else {
            // Filter by checking if the server's categories array includes the selected category
            filteredServers = filteredServers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(category));
        }
    }
    
    // 2. Filter by Search term
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filteredServers = filteredServers.filter(server => 
            server.name.toLowerCase().includes(searchTerm) || 
            (server.description && server.description.toLowerCase().includes(searchTerm)) ||
            server.address.toLowerCase().includes(searchTerm)
        );
    }
    
    // 3. Filter by BDIX/Non-BDIX type
    // Get the currently active type filter button's data-type attribute
    const typeFilterButton = document.querySelector('.type-filter-btn.active');
    const typeFilter = typeFilterButton ? typeFilterButton.getAttribute('data-type') : 'all';

    if (typeFilter !== 'all') {
        filteredServers = filteredServers.filter(server => server.type === typeFilter);
    }

    // 4. Sort servers
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
            <a href="${server.address}" target="_blank" class="server-address-link" title="Open ${server.address}">
                ${server.address}
            </a>
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
        // Use a partial update to avoid full re-render flickering
        const card = document.querySelector(`.server-card[data-id="${serverId}"]`);
        if (card) {
            const star = card.querySelector('.favorite-star');
            star.classList.toggle('favorited', server.isFavorite);
        }
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

// HELPER: Normalizes server address by removing protocol and trailing slash
function normalizeAddress(address) {
    if (!address) return '';
    let normalized = address.toLowerCase().trim();
    
    // Remove protocol (http://, https://, ftp://)
    normalized = normalized.replace(/^(https?|ftp):\/\//i, '');
    
    // Remove trailing slash
    normalized = normalized.replace(/\/$/, '');
    
    return normalized;
}

// Checks for address and category duplication
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
        const existingCategories = existingServer.categories || [];
        return existingCategories.some(cat => categories.includes(cat));
    });
}

// Save edit changes
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

            // --- DUPLICATE CHECK ---
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
            // --- END DUPLICATE CHECK ---

            // If not duplicate, save changes
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

// Close all management-related modals (FIX: Missing in previous version)
function closeAllManagementModals() {
    document.getElementById('exportImportModal').style.display = 'none';
    document.getElementById('importUrlModal').style.display = 'none';
    document.getElementById('manageServersModal').style.display = 'none';
}

// HELPER FUNCTION: Calculates time ago for status display
function timeAgo(timestamp) {
    if (!timestamp) return 'Never checked';
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

// ACTION: Copy Address
function copyAddress(address) {
    navigator.clipboard.writeText(address).then(() => {
        showToast('Server address copied to clipboard!');
    }).catch(() => {
        showToast('Could not copy address. Try again.', 'error');
    });
}

// CORE FEATURE: Check Server Status (Verification logic)
async function checkServerStatus(server) {
    const serverElement = servers.find(s => s.id === server.id);
    if (!serverElement || serverElement.isChecking) return;
    
    // 1. Mark as checking and update UI immediately
    serverElement.isChecking = true;
    updateCardStatus(serverElement, 'checking');
    
    // 2. Perform the fetch
    const timeout = 15000; // 15 seconds timeout
    let isReachable = false;
    
    try {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeout);
        
        // Use 'HEAD' method and 'no-cors' mode. 
        // A successful promise resolution indicates the server is reachable, regardless of the response content.
        await fetch(server.address, { 
            method: 'HEAD', 
            mode: 'no-cors',
            signal: controller.signal 
        });
        
        clearTimeout(timeoutId);
        isReachable = true;

    } catch (error) {
        // Fetch failed (network error, timeout, or aborted)
        isReachable = false;
    }
    
    // 3. Update server data
    if (serverElement) {
        serverElement.isChecking = false;
        serverElement.lastChecked = Date.now();
        serverElement.status = isReachable ? 'active' : 'inactive';
        saveServers();
        
        // 4. Update UI
        updateCardStatus(serverElement, serverElement.status, serverElement.lastChecked);
    }
}

// UI HELPER: Update a single card's status block (to avoid full re-render)
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

// ACTION: Check all servers
function checkAllServers() {
    showToast('Starting server verification. This may take a moment...', 'warning');
    // Filter to only check servers that are not currently being checked
    const serversToCheck = servers.filter(s => !s.isChecking);
    
    // Check servers sequentially to prevent network overload
    const checkPromises = serversToCheck.reduce((promiseChain, server) => {
        // Wait for the previous promise (or the initial Promise.resolve()) to complete
        // then start the next check, ensuring sequential execution.
        return promiseChain.then(() => checkServerStatus(server));
    }, Promise.resolve()); // Initial promise resolves immediately

    checkPromises.then(() => {
        showToast('All servers have been verified!', 'success');
        // Re-render to ensure any status filtering based on 'active' is up to date
        renderServers(currentCategory, currentSort); 
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
        isChecking: false,
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

// =========================================================================
// DATA MANAGEMENT (IMPORT/EXPORT) FUNCTIONS - RESTORED FROM BASE CODE
// =========================================================================

// Open Export Modal
function openExportModal() {
    closeAllManagementModals();
    document.getElementById('modalTitle').textContent = 'Export/Backup Data';
    document.getElementById('exportImportModal').style.display = 'flex';
    document.getElementById('importData').style.display = 'none';
    document.getElementById('importSubmit').style.display = 'none';
    document.getElementById('fileUploadTrigger').style.display = 'none';

    document.getElementById('exportData').style.display = 'block';
    document.getElementById('copyExportData').style.display = 'inline-flex';
    document.getElementById('downloadBackup').style.display = 'inline-flex';
    
    // Display current server data
    document.getElementById('exportData').value = JSON.stringify(servers, null, 2);
}

// Open Import Modal (Paste Data)
function openImportModal() {
    closeAllManagementModals();
    document.getElementById('modalTitle').textContent = 'Import/Restore Data';
    document.getElementById('exportImportModal').style.display = 'flex';
    
    document.getElementById('exportData').style.display = 'none';
    document.getElementById('copyExportData').style.display = 'none';
    document.getElementById('downloadBackup').style.display = 'none';

    document.getElementById('importData').style.display = 'block';
    document.getElementById('importData').value = ''; // Clear previous data
    document.getElementById('importSubmit').style.display = 'inline-flex';
    document.getElementById('fileUploadTrigger').style.display = 'inline-flex';

    // Set up click handler for paste import
    document.getElementById('importSubmit').removeEventListener('click', importFromPaste);
    document.getElementById('importSubmit').addEventListener('click', importFromPaste);
}

// Import logic from pasted data
function importFromPaste() {
    const dataString = document.getElementById('importData').value.trim();
    if (!dataString) {
        showToast('Please paste the JSON data first.', 'error');
        return;
    }
    
    processImportedData(dataString);
}

// Open Import from URL Modal
function openImportUrlModal() {
    closeAllManagementModals();
    document.getElementById('importUrlModal').style.display = 'flex';
}

// Close Import from URL Modal
function closeImportUrlModal() {
    document.getElementById('importUrlModal').style.display = 'none';
}

// Download Backup file
function downloadBackup() {
    const data = JSON.stringify(servers, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `isp_servers_backup_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast('Server list downloaded successfully!', 'success');
}

// Copy Export Data to clipboard
function copyExportData() {
    const data = document.getElementById('exportData').value;
    navigator.clipboard.writeText(data).then(() => {
        showToast('Data copied to clipboard!', 'success');
    }).catch(err => {
        showToast('Failed to copy data. Check console.', 'error');
        console.error('Copy failed:', err);
    });
}

// Trigger file upload input
function triggerUpload() {
    document.getElementById('fileUpload').click();
}

// Handle file upload
function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        const dataString = e.target.result;
        processImportedData(dataString);
    };
    reader.onerror = function() {
        showToast('Error reading file.', 'error');
    };
    reader.readAsText(file);
    // Clear file input so the same file can be uploaded again
    event.target.value = '';
}

// Import data from URL
async function importFromURL() {
    const url = document.getElementById('importUrl').value.trim();
    const method = document.querySelector('input[name="importMethod"]:checked').value;
    
    if (!url) {
        showToast('Please enter a valid URL.', 'error');
        return;
    }
    
    try {
        showToast('Fetching data from URL...', 'warning');
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const dataString = await response.text();
        processImportedData(dataString, method);
    } catch (error) {
        showToast(`Error fetching from URL: ${error.message}`, 'error');
        console.error('URL Fetch Error:', error);
    }
}

// Central function to process imported JSON data
function processImportedData(dataString, method = 'merge') {
    try {
        const importedServers = JSON.parse(dataString);

        if (!Array.isArray(importedServers)) {
            throw new Error('Imported data is not a valid list (Array) of servers.');
        }

        // Validate structure of imported servers (optional but recommended)
        const validatedServers = importedServers.map(s => {
            // Ensure ID and category/type fields exist and are valid
            if (!s.id) s.id = Date.now() + Math.random();
            if (!s.categories) s.categories = [s.category || 'others'];
            if (!s.type) s.type = 'non-bdix';
            if (!s.status) s.status = 'inactive';
            if (!s.rank) s.rank = servers.length + 1; // Temporary rank

            return s;
        });

        if (method === 'replace') {
            servers = validatedServers;
            showToast(`Successfully replaced all ${servers.length} servers!`, 'success');
        } else { // Merge
            let addedCount = 0;
            validatedServers.forEach(newServer => {
                const isDuplicate = servers.some(existingServer => 
                    normalizeAddress(existingServer.address) === normalizeAddress(newServer.address)
                );
                
                if (!isDuplicate) {
                    // Ensure new servers are added with a unique rank at the end
                    newServer.rank = servers.length + 1;
                    servers.push(newServer);
                    addedCount++;
                }
            });
            showToast(`Successfully merged ${addedCount} new servers! Total: ${servers.length}`, 'success');
        }

        // Re-establish sequential ranks after merging/replacing
        servers.sort((a, b) => a.rank - b.rank);
        servers.forEach((server, index) => {
            server.rank = index + 1;
        });

        saveServers();
        renderServers(currentCategory, currentSort);
        closeAllManagementModals();

    } catch (e) {
        console.error('Data processing error:', e);
        showToast(`Error: Invalid data format. Check console. (${e.message})`, 'error');
    }
}
// =========================================================================
// END DATA MANAGEMENT FUNCTIONS
// =========================================================================


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
    document.querySelectorAll('.sort-btn[data-sort]').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.sort-btn[data-sort]').forEach(b => b.classList.remove('active'));
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
    document.getElementById('closeModal').addEventListener('click', closeAllManagementModals); // Use common closer

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
    
    // Check All Servers button
    document.getElementById('checkAllServersBtn').addEventListener('click', checkAllServers);

    // Type Filter buttons (BDIX/Non-BDIX/All)
    document.querySelectorAll('.type-filter-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.type-filter-btn').forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            renderServers(currentCategory, currentSort);
        });
    });
}
