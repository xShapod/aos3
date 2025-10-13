// Sample data for demonstration
let servers = [
    {
        id: 1,
        name: "Live Sports HD",
        address: "http://live.sports.isp.com",
        category: "live",
        type: "bdix",
        status: "active",
        description: "High-definition live sports channels",
        rank: 1,
        createdAt: new Date('2023-01-15').getTime(),
        isFavorite: false
    },
    {
        id: 2,
        name: "Movie Vault",
        address: "ftp://movies.isp.com:2020",
        category: "movies",
        type: "bdix",
        status: "active",
        description: "Large collection of movies from various genres",
        rank: 2,
        createdAt: new Date('2023-02-20').getTime(),
        isFavorite: false
    },
    {
        id: 3,
        name: "TV Series Archive",
        address: "http://series.isp.com:8080",
        category: "series",
        type: "non-bdix",
        status: "active",
        description: "Complete seasons of popular TV series",
        rank: 3,
        createdAt: new Date('2023-03-10').getTime(),
        isFavorite: false
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
            filteredServers = servers.filter(server => server.category === category);
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
            <div class="server-actions">
                <button class="btn btn-primary" onclick="connectToServer('${server.address}')">
                    <i class="fas fa-external-link-alt"></i> Open
                </button>
                <button class="btn btn-danger" onclick="deleteServer(${server.id})">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
        serverGrid.appendChild(serverCard);
    });
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
        document.getElementById('editStatus').value = server.status;
        document.getElementById('editType').value = server.type;
        document.getElementById('editServerModal').style.display = 'flex';
    }
}

// Set up event listeners
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
    
    // Close modals when clicking outside
    document.getElementById('exportImportModal').addEventListener('click', function(e) {
        if (e.target === this) closeModal();
    });
    
    document.getElementById('editServerModal').addEventListener('click', function(e) {
        if (e.target === this) closeEditModal();
    });
    
    document.getElementById('importUrlModal').addEventListener('click', function(e) {
        if (e.target === this) document.getElementById('importUrlModal').style.display = 'none';
    });
}

// Import from URL function
function importFromURL() {
    const url = document.getElementById('importUrl').value;
    const method = document.querySelector('input[name="importMethod"]:checked').value;
    
    if (!url) {
        showToast('Please enter a valid URL', 'error');
        return;
    }
    
    showToast('Downloading server list...');
    
    // Simulate URL import (in real implementation, this would fetch from the URL)
    setTimeout(() => {
        try {
            const importedServers = [
                {
                    id: Date.now() + 1,
                    name: "Imported Live Server",
                    address: "http://imported.live.server.com",
                    category: "live",
                    type: "bdix",
                    status: "active",
                    description: "Imported from URL",
                    rank: servers.length + 1,
                    createdAt: Date.now(),
                    isFavorite: false
                }
            ];
            
            if (method === 'replace') {
                servers = importedServers;
                showToast('All servers replaced from URL!');
            } else {
                // Merge and avoid duplicates by address
                const serverMap = new Map();
                servers.forEach(server => serverMap.set(server.address, server));
                importedServers.forEach(server => serverMap.set(server.address, server));
                servers = Array.from(serverMap.values());
                showToast('Servers merged from URL!');
            }
            
            saveServers();
            renderServers(currentCategory, currentSort);
            document.getElementById('importUrlModal').style.display = 'none';
        } catch (e) {
            showToast('Error importing from URL!', 'error');
        }
    }, 2000);
}

// Close edit modal
function closeEditModal() {
    document.getElementById('editServerModal').style.display = 'none';
    currentEditServerId = null;
}

// Save edit changes
function saveEditChanges() {
    if (currentEditServerId) {
        const server = servers.find(s => s.id === currentEditServerId);
        if (server) {
            server.status = document.getElementById('editStatus').value;
            server.type = document.getElementById('editType').value;
            
            saveServers();
            renderServers(currentCategory, currentSort);
            closeEditModal();
            showToast('Server updated successfully!');
        }
    }
}

// Show export modal
function showExportModal() {
    const modal = document.getElementById('exportImportModal');
    const modalTitle = document.getElementById('modalTitle');
    const exportData = document.getElementById('exportData');
    const importActions = document.getElementById('importActions');
    const copyBtn = document.getElementById('copyData');
    
    modalTitle.textContent = 'Export Servers';
    exportData.value = JSON.stringify(servers, null, 2);
    importActions.style.display = 'none';
    copyBtn.style.display = 'block';
    modal.style.display = 'flex';
}

// Show import modal
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

// Close modal
function closeModal() {
    document.getElementById('exportImportModal').style.display = 'none';
}

// Copy export data to clipboard
function copyExportData() {
    const exportData = document.getElementById('exportData');
    exportData.select();
    document.execCommand('copy');
    showToast('Server data copied to clipboard!');
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
            const importedServers = JSON.parse(e.target.result);
            if (Array.isArray(importedServers)) {
                if (confirm('Do you want to replace all current servers with the uploaded backup?')) {
                    servers = importedServers;
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    showToast('Servers restored from backup!');
                } else {
                    // Merge instead
                    const serverMap = new Map();
                    servers.forEach(server => {
                        serverMap.set(server.address, server);
                    });
                    importedServers.forEach(server => {
                        serverMap.set(server.address, server);
                    });
                    servers = Array.from(serverMap.values());
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    showToast('Servers merged with backup!');
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
            closeModal();
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
        const importedServers = JSON.parse(exportData.value);
        if (Array.isArray(importedServers)) {
            // Create a map to avoid duplicates by address
            const serverMap = new Map();
            
            // Add existing servers
            servers.forEach(server => {
                serverMap.set(server.address, server);
            });
            
            // Add imported servers (overwriting duplicates by address)
            importedServers.forEach(server => {
                serverMap.set(server.address, server);
            });
            
            servers = Array.from(serverMap.values());
            saveServers();
            renderServers(currentCategory, currentSort);
            closeModal();
            showToast('Servers merged successfully!');
        } else {
            showToast('Invalid server data format!', 'error');
        }
    } catch (e) {
        showToast('Invalid JSON data!', 'error');
    }
}

// Add a new server
function addServer() {
    const name = document.getElementById('serverName').value;
    const address = document.getElementById('serverAddress').value;
    const category = document.getElementById('serverCategory').value;
    const type = document.getElementById('serverType').value;
    const description = document.getElementById('serverDescription').value;
    
    const newServer = {
        id: Date.now(), // Simple ID generation
        name,
        address,
        category,
        type,
        status: 'active',
        description: description || '',
        rank: servers.length + 1,
        createdAt: Date.now(),
        isFavorite: false
    };
    
    servers.push(newServer);
    saveServers();
    renderServers(currentCategory, currentSort);
    
    // Reset form
    document.getElementById('serverForm').reset();
    
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
    toast.style.background = type === 'error' ? 'var(--danger)' : 'var(--success)';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Save servers to localStorage
function saveServers() {
    localStorage.setItem('ispServers', JSON.stringify(servers));
}