// Sample data for demonstration
let servers = [
    {
        id: 1,
        name: "Live Sports HD",
        address: "http://live.sports.isp.com",
        categories: ["live"],
        type: "bdix",
        status: "active",
        description: "High-definition live sports channels",
        rank: 1,
        createdAt: new Date('2023-01-15').getTime(),
        isFavorite: false,
        lastVerified: new Date('2024-01-01').getTime() // NEW: Added lastVerified
    },
    {
        id: 2,
        name: "Movie Vault",
        address: "ftp://movies.isp.com:2020",
        categories: ["movies"],
        type: "bdix",
        status: "active",
        description: "Large collection of movies from various genres",
        rank: 2,
        createdAt: new Date('2023-02-20').getTime(),
        isFavorite: false,
        lastVerified: new Date('2024-01-01').getTime() // NEW: Added lastVerified
    },
    {
        id: 3,
        name: "TV Series Archive",
        address: "http://series.isp.com:8080",
        categories: ["series"],
        type: "non-bdix",
        status: "active",
        description: "Complete seasons of popular TV series",
        rank: 3,
        createdAt: new Date('2023-03-10').getTime(),
        isFavorite: false,
        lastVerified: new Date('2024-01-01').getTime() // NEW: Added lastVerified
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
    }
    
    // Ensure new fields exist for old data (migration)
    servers.forEach(server => {
        if (server.lastVerified === undefined) {
            server.lastVerified = server.createdAt || Date.now();
        }
    });

    renderServers(currentCategory, currentSort);
    setupEventListeners();
});

// Helper to get display name for category
function getCategoryDisplayName(key) {
    const names = {
        'live': 'Live TV',
        'movies': 'Movies',
        'series': 'Series',
        'others': 'Others',
        'favorites': 'Favorites'
    };
    return names[key] || key;
}

// Render server cards
function renderServers(category, sortBy) {
    const serverGrid = document.getElementById('serverGrid');
    serverGrid.innerHTML = '';
    
    let filteredServers = servers;
    
    // 1. Filter by category
    if (category === 'favorites') {
        filteredServers = servers.filter(server => server.isFavorite);
    } else if (category !== 'all') {
        filteredServers = servers.filter(server => server.categories.includes(category));
    }

    // 2. Filter by search input
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    if (searchTerm) {
        filteredServers = filteredServers.filter(server => 
            server.name.toLowerCase().includes(searchTerm) || 
            server.description.toLowerCase().includes(searchTerm)
        );
    }

    // 3. Sort
    if (sortBy === 'name') {
        filteredServers.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortBy === 'newest') {
        filteredServers.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sortBy === 'manual') {
        filteredServers.sort((a, b) => a.rank - b.rank);
    }
    
    if (filteredServers.length === 0) {
        serverGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-server"></i>
                <h3>No servers found</h3>
                <p>Try changing your filter, search, or add a new server!</p>
            </div>
        `;
        return;
    }

    filteredServers.forEach(server => {
        const serverCard = document.createElement('div');
        serverCard.className = `server-card ${server.status} ${server.type}`;
        
        // NEW: Check if lastVerified is present before converting
        const lastVerifiedTime = server.lastVerified ? new Date(server.lastVerified).toLocaleString() : 'Never';
        
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
                    <div class="server-status ${server.status}">
                        <i class="fas fa-circle"></i>
                        ${server.status === 'active' ? 'Active' : 'Inactive'}
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
            
            <div class="server-last-verified">
                Verified: ${lastVerifiedTime}
            </div>
            
            <div class="server-actions">
                <button class="btn btn-primary" onclick="connectToServer('${server.address}')">
                    <i class="fas fa-external-link-alt"></i> Open
                </button>
                
                <button class="btn btn-warning" onclick="verifyStatus(${server.id})">
                    <i class="fas fa-check-circle"></i> Verify
                </button>

                <button class="btn btn-danger" onclick="deleteServer(${server.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        serverGrid.appendChild(serverCard);
    });
}

// NEW FUNCTION: Manually verify server status
function verifyStatus(serverId) {
    const server = servers.find(s => s.id === serverId);
    if (!server) return;

    // 1. Attempt to open the server for the user to check (in a new tab)
    connectToServer(server.address);

    // 2. Prompt the user for confirmation inside their ISP network
    const isWorking = confirm(`Attempted to open: ${server.name} (${server.address}).\n\nWas the server accessible?\n\n(Click 'OK' for Active, 'Cancel' for Inactive)`);

    // 3. Update the server status and timestamp based on user's in-network knowledge
    server.status = isWorking ? 'active' : 'inactive';
    server.lastVerified = Date.now(); 

    saveServers();
    renderServers(currentCategory, currentSort);
    
    if (isWorking) {
        showToast(`${server.name} verified as Active!`);
    } else {
        showToast(`${server.name} marked as Inactive.`, 'error');
    }
}

// NEW FUNCTION: Verify all active servers
function verifyAllActiveServers() {
    const activeServers = servers.filter(s => s.status === 'active');
    
    if (activeServers.length === 0) {
        showToast('No active servers to check.');
        return;
    }

    if (confirm(`You are about to manually verify the status of ${activeServers.length} active servers. This will open each one in a new tab for you to check. Continue?`)) {
        showToast(`Starting manual verification for ${activeServers.length} servers...`);
        activeServers.forEach((server, index) => {
            // Use a short delay so the browser doesn't block all pop-ups at once
            // The user will check them one by one
            setTimeout(() => {
                verifyStatus(server.id); 
            }, index * 200); 
        });
    }
}


// Server Management Functions

function addServer() {
    const name = document.getElementById('serverName').value.trim();
    const address = document.getElementById('serverAddress').value.trim();
    const type = document.querySelector('input[name="serverType"]:checked').value;
    const description = document.getElementById('serverDescription').value.trim();
    
    const categoryCheckboxes = document.querySelectorAll('input[name="addCategories"]:checked');
    const categories = Array.from(categoryCheckboxes).map(cb => cb.value);

    if (!name || !address || categories.length === 0) {
        showToast('Please fill in Name, Address, and select at least one Category.', 'error');
        return;
    }

    const newServer = {
        id: Date.now(), // Simple ID generation
        name,
        address,
        categories,
        type,
        status: 'active',
        description: description || '',
        rank: servers.length + 1,
        createdAt: Date.now(),
        isFavorite: false,
        lastVerified: Date.now() // NEW: Initialize lastVerified
    };

    servers.push(newServer);
    saveServers();
    renderServers(currentCategory, currentSort);
    closeModal('addModal');
    showToast(`Server "${name}" added successfully!`);
}

function openEditModal(id) {
    const server = servers.find(s => s.id === id);
    if (!server) return;

    currentEditServerId = id;
    
    document.getElementById('editName').value = server.name;
    document.getElementById('editAddress').value = server.address;
    document.getElementById('editDescription').value = server.description;

    // Set radio buttons
    document.querySelector(`input[name="editServerType"][value="${server.type}"]`).checked = true;
    document.querySelector(`input[name="editStatus"][value="${server.status}"]`).checked = true;

    // Set checkboxes
    document.querySelectorAll('input[name="editCategories"]').forEach(checkbox => {
        checkbox.checked = server.categories.includes(checkbox.value);
    });

    document.getElementById('editModal').style.display = 'flex';
}

function saveEdit() {
    const server = servers.find(s => s.id === currentEditServerId);
    if (!server) return;

    const name = document.getElementById('editName').value.trim();
    const address = document.getElementById('editAddress').value.trim();
    const description = document.getElementById('editDescription').value.trim();
    const type = document.querySelector('input[name="editServerType"]:checked').value;
    const status = document.querySelector('input[name="editStatus"]:checked').value;
    
    const categoryCheckboxes = document.querySelectorAll('input[name="editCategories"]:checked');
    const categories = Array.from(categoryCheckboxes).map(cb => cb.value);

    if (!name || !address || categories.length === 0) {
        showToast('Please fill in Name, Address, and select at least one Category.', 'error');
        return;
    }

    server.name = name;
    server.address = address;
    server.description = description;
    server.type = type;
    server.status = status;
    server.categories = categories;

    saveServers();
    renderServers(currentCategory, currentSort);
    closeModal('editModal');
    showToast(`Server "${name}" updated successfully!`);
}

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

// Toast and LocalStorage Helpers

function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--success)';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

function saveServers() {
    localStorage.setItem('ispServers', JSON.stringify(servers));
}

function toggleFavorite(id) {
    const server = servers.find(s => s.id === id);
    if (server) {
        server.isFavorite = !server.isFavorite;
        saveServers();
        renderServers(currentCategory, currentSort);
        showToast(server.isFavorite ? `${server.name} added to Favorites!` : `${server.name} removed from Favorites!`);
    }
}

// Modal Functions

function openModal(id) {
    document.getElementById(id).style.display = 'flex';
}

function closeModal(id) {
    document.getElementById(id).style.display = 'none';
}

function showExportModal() {
    const exportDataArea = document.getElementById('exportDataArea');
    exportDataArea.value = JSON.stringify(servers, null, 2);
    openModal('importExportModal');
}

// Import/Export Logic

function copyExportData() {
    const exportDataArea = document.getElementById('exportDataArea');
    exportDataArea.select();
    document.execCommand('copy');
    showToast('Data copied to clipboard!');
}

function downloadJson() {
    const dataStr = JSON.stringify(servers, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,' + encodeURIComponent(dataStr);
    const exportFileDefaultName = 'isp_servers_backup.json';
    
    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    showToast('Download started!');
}

function uploadJson() {
    document.getElementById('fileUpload').click();
}

function handleFileUpload(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const uploadedData = JSON.parse(e.target.result);
            mergeAndImportServers(uploadedData);
            showToast('File uploaded and data merged successfully!');
        } catch (error) {
            showToast('Error parsing JSON file.', 'error');
            console.error(error);
        }
    };
    reader.readAsText(file);
}

function importData() {
    const importDataArea = document.getElementById('importDataArea').value;
    if (!importDataArea) {
        showToast('Please paste data to import.', 'error');
        return;
    }
    try {
        const importedData = JSON.parse(importDataArea);
        mergeAndImportServers(importedData);
        closeModal('importExportModal');
        document.getElementById('importDataArea').value = '';
        showToast('Data imported and merged successfully!');
    } catch (error) {
        showToast('Invalid JSON data format.', 'error');
        console.error(error);
    }
}

function importFromUrl() {
    const url = document.getElementById('importUrlInput').value.trim();
    if (!url) {
        showToast('Please enter a valid URL.', 'error');
        return;
    }
    
    showToast('Fetching data from URL...');
    fetch(url)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            mergeAndImportServers(data);
            closeModal('importExportModal');
            document.getElementById('importUrlInput').value = '';
            showToast('Data imported from URL and merged successfully!');
        })
        .catch(error => {
            showToast(`Error fetching from URL: ${error.message}`, 'error');
            console.error('Fetch error:', error);
        });
}

function mergeAndImportServers(newServers) {
    if (!Array.isArray(newServers)) {
        showToast('Import failed: Data is not a list of servers.', 'error');
        return;
    }
    
    let importedCount = 0;
    
    newServers.forEach(newServer => {
        // Simple check to prevent adding duplicates based on name and address
        const isDuplicate = servers.some(existingServer => 
            existingServer.name === newServer.name && existingServer.address === newServer.address
        );
        
        if (!isDuplicate) {
            // Assign a new ID and rank to the imported server
            newServer.id = Date.now() + Math.floor(Math.random() * 1000); 
            newServer.rank = servers.length + 1;
            // Ensure essential fields exist
            newServer.createdAt = newServer.createdAt || Date.now();
            newServer.isFavorite = newServer.isFavorite || false;
            newServer.status = newServer.status || 'active';
            newServer.type = newServer.type || 'bdix';
            newServer.categories = newServer.categories || [];
            newServer.lastVerified = newServer.lastVerified || newServer.createdAt; // NEW: Handle lastVerified for imports

            servers.push(newServer);
            importedCount++;
        }
    });

    if (importedCount > 0) {
        saveServers();
        renderServers(currentCategory, currentSort);
        showToast(`${importedCount} new server(s) imported and merged!`);
    } else {
        showToast('No new servers were found to import. All seem to be duplicates.');
    }
}


// Event Listeners Setup
function setupEventListeners() {
    // --- Server Actions ---
    document.getElementById('addServerBtn').addEventListener('click', () => openModal('addModal'));
    document.getElementById('saveServer').addEventListener('click', addServer);
    document.getElementById('saveEdit').addEventListener('click', saveEdit);
    
    // --- New Feature Listener ---
    document.getElementById('verifyAllBtn').addEventListener('click', verifyAllActiveServers); // NEW: Verify All button
    
    // --- Sorting and Filtering ---
    document.querySelectorAll('.sort-btn').forEach(button => {
        button.addEventListener('click', function() {
            document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
            this.classList.add('active');
            currentSort = this.getAttribute('data-sort');
            renderServers(currentCategory, currentSort);
        });
    });

    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', function() {
            document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.getAttribute('data-category');
            renderServers(currentCategory, currentSort);
        });
    });

    document.getElementById('searchInput').addEventListener('input', () => {
        renderServers(currentCategory, currentSort);
    });

    // --- Modal and Settings ---
    document.getElementById('settingsBtn').addEventListener('click', () => {
        window.location.href = 'settings.html';
    });

    document.getElementById('importExportBtn').addEventListener('click', showExportModal);
    
    // --- Import/Export Listeners ---
    document.getElementById('copyDataBtn').addEventListener('click', copyExportData);
    document.getElementById('downloadJsonBtn').addEventListener('click', downloadJson);
    document.getElementById('uploadJsonBtn').addEventListener('click', uploadJson);
    document.getElementById('fileUpload').addEventListener('change', handleFileUpload);
    document.getElementById('importDataBtn').addEventListener('click', importData);
    document.getElementById('importUrlBtn').addEventListener('click', importFromUrl);
}
