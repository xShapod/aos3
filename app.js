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
        // Ensure all servers have a 'categories' array for filtering robustness
        servers.forEach(server => {
            if (!server.categories) {
                server.categories = [server.category || 'others'];
            }
        });
    }
    
    renderServers(currentCategory, currentSort);
    setupEventListeners();
});

// Save servers to localStorage
function saveServers() {
    localStorage.setItem('ispServers', JSON.stringify(servers));
}

// Generate a unique ID for new servers
function generateUniqueId() {
    return Date.now() + Math.floor(Math.random() * 1000);
}

// Render the server list based on category and sort order
function renderServers(category, sort) {
    const serverList = document.getElementById('serverList');
    serverList.innerHTML = '';
    
    let filteredServers = servers;
    
    // 1. Filter by category
    if (category !== 'all') {
        // Filter by checking if the server's categories array includes the selected category
        // Ensure server.categories is treated as an array
        filteredServers = servers.filter(server => server.categories && Array.isArray(server.categories) && server.categories.includes(category));
    }

    // 2. Sort the filtered list
    if (sort === 'manual') {
        // Sort by current rank
        filteredServers.sort((a, b) => a.rank - b.rank);
    } else if (sort === 'newest') {
        filteredServers.sort((a, b) => b.createdAt - a.createdAt);
    } else if (sort === 'oldest') {
        filteredServers.sort((a, b) => a.createdAt - b.createdAt);
    } else if (sort === 'name') {
        filteredServers.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'favorites') {
        // Favorites should be at the top, followed by the secondary sort (e.g., manual rank)
        filteredServers.sort((a, b) => {
            if (a.isFavorite && !b.isFavorite) return -1;
            if (!a.isFavorite && b.isFavorite) return 1;
            // Secondary sort by manual rank
            return a.rank - b.rank;
        });
    }

    if (filteredServers.length === 0) {
        serverList.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-server"></i>
                <h3>No servers found</h3>
                <p>Try changing your category filter or add a new server.</p>
            </div>
        `;
        return;
    }

    filteredServers.forEach(server => {
        const serverCard = document.createElement('div');
        serverCard.className = 'server-card';
        serverCard.setAttribute('data-id', server.id);
        serverCard.setAttribute('data-category', server.categories ? server.categories.join(' ') : 'others');
        
        // Determine status class
        const statusClass = server.status === 'active' ? 'status-active' : 'status-inactive';
        const statusIcon = server.status === 'active' ? 'fa-check-circle' : 'fa-times-circle';
        const statusText = server.status === 'active' ? 'Active' : 'Inactive';

        // Generate categories HTML
        const categoriesHtml = (server.categories || []).map(cat => `<span class="server-category">${cat.charAt(0).toUpperCase() + cat.slice(1)}</span>`).join('');

        serverCard.innerHTML = `
            <div class="server-header">
                <div class="server-info">
                    <span class="server-type">${server.type.toUpperCase()}</span>
                    <h2 class="server-name">${server.name}</h2>
                </div>
                <div class="server-actions">
                    <button class="favorite-star ${server.isFavorite ? 'favorited' : ''}" data-id="${server.id}">
                        <i class="fas fa-star"></i>
                    </button>
                    <button class="action-btn connect-btn btn-primary" data-address="${server.address}">
                        <i class="fas fa-play-circle"></i> Connect
                    </button>
                    <button class="action-btn edit-btn btn-info" data-id="${server.id}">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="action-btn delete-btn btn-danger" data-id="${server.id}">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            
            <div class="server-categories">
                ${categoriesHtml}
            </div>

            <div class="server-details">
                <p class="server-address">
                    <i class="fas fa-link"></i> ${server.address}
                </p>
                <div class="server-meta">
                    <span class="server-status ${statusClass}">
                        <i class="fas ${statusIcon}"></i> ${statusText}
                    </span>
                    <span class="server-rank">
                        <i class="fas fa-list-ol"></i> Rank: ${server.rank}
                    </span>
                    <span class="server-date">
                        <i class="fas fa-calendar-alt"></i> Added: ${new Date(server.createdAt).toLocaleDateString()}
                    </span>
                </div>
            </div>
            
            <p class="server-description">${server.description || 'No description provided.'}</p>
        `;
        
        serverList.appendChild(serverCard);
    });
}

// Show/Hide Add Server Modal
function toggleAddServerModal(show) {
    document.getElementById('addServerModal').style.display = show ? 'flex' : 'none';
    if (show) {
        document.getElementById('newServerName').focus();
    }
}

// Handle form submission for adding a new server
function handleAddServer(event) {
    event.preventDefault();
    
    const name = document.getElementById('newServerName').value.trim();
    const address = document.getElementById('newServerAddress').value.trim();
    const type = document.getElementById('newServerType').value;
    const status = document.getElementById('newServerStatus').checked ? 'active' : 'inactive';
    const description = document.getElementById('newDescription').value.trim();
    
    const selectedCategories = Array.from(document.querySelectorAll('input[name="newCategories"]:checked')).map(cb => cb.value);

    if (!name || !address || selectedCategories.length === 0) {
        showToast('Please fill in Name, Address, and select at least one Category.', 'error');
        return;
    }

    const newServer = {
        id: generateUniqueId(),
        name: name,
        address: address,
        categories: selectedCategories,
        type: type,
        status: status,
        description: description,
        rank: servers.length + 1, // Add to the end of the manual order
        createdAt: Date.now(),
        isFavorite: false,
    };

    servers.push(newServer);
    saveServers();
    renderServers(currentCategory, currentSort);
    toggleAddServerModal(false);
    document.getElementById('addServerForm').reset();
    showToast(`Server "${name}" added successfully!`);
}

// Show/Hide Edit Server Modal
function toggleEditServerModal(show) {
    document.getElementById('editServerModal').style.display = show ? 'flex' : 'none';
}

// Pre-fill and show the edit modal
function showEditModal(serverId) {
    currentEditServerId = serverId;
    const server = servers.find(s => s.id === serverId);

    if (!server) {
        showToast('Server not found.', 'error');
        return;
    }

    document.getElementById('editServerName').value = server.name;
    document.getElementById('editServerAddress').value = server.address;
    document.getElementById('editServerType').value = server.type;
    document.getElementById('editServerStatus').checked = server.status === 'active';
    document.getElementById('editDescription').value = server.description;
    
    // Handle categories checkboxes
    document.querySelectorAll('input[name="editCategories"]').forEach(cb => {
        cb.checked = server.categories && server.categories.includes(cb.value);
    });

    toggleEditServerModal(true);
    document.getElementById('editServerName').focus();
}

// Handle saving the edited server
function handleSaveEdit() {
    if (!currentEditServerId) return;

    const serverIndex = servers.findIndex(s => s.id === currentEditServerId);
    if (serverIndex === -1) {
        showToast('Error: Server ID not found.', 'error');
        return;
    }
    
    const name = document.getElementById('editServerName').value.trim();
    const address = document.getElementById('editServerAddress').value.trim();
    const type = document.getElementById('editServerType').value;
    const status = document.getElementById('editServerStatus').checked ? 'active' : 'inactive';
    const description = document.getElementById('editDescription').value.trim();
    
    const selectedCategories = Array.from(document.querySelectorAll('input[name="editCategories"]:checked')).map(cb => cb.value);

    if (!name || !address || selectedCategories.length === 0) {
        showToast('Please fill in Name, Address, and select at least one Category.', 'error');
        return;
    }
    
    servers[serverIndex].name = name;
    servers[serverIndex].address = address;
    servers[serverIndex].type = type;
    servers[serverIndex].status = status;
    servers[serverIndex].description = description;
    servers[serverIndex].categories = selectedCategories; // Update categories
    
    saveServers();
    renderServers(currentCategory, currentSort);
    toggleEditServerModal(false);
    showToast(`Server "${name}" updated successfully!`);
}

// Handle filter buttons
function handleCategoryFilter(category) {
    currentCategory = category;
    document.querySelectorAll('.filter-tab').forEach(tab => tab.classList.remove('active'));
    document.querySelector(`.filter-tab[data-category="${category}"]`).classList.add('active');
    renderServers(currentCategory, currentSort);
}

// Handle sort buttons
function handleSort(sort) {
    currentSort = sort;
    document.querySelectorAll('.sort-btn').forEach(btn => btn.classList.remove('active'));
    document.querySelector(`.sort-btn[data-sort="${sort}"]`).classList.add('active');
    renderServers(currentCategory, currentSort);
}

// Toggle favorite status
function toggleFavorite(id) {
    const server = servers.find(s => s.id == id);
    if (server) {
        server.isFavorite = !server.isFavorite;
        saveServers();
        renderServers(currentCategory, currentSort); // Rerender to apply sort if by favorites
        showToast(server.isFavorite ? `"${server.name}" added to favorites!` : `"${server.name}" removed from favorites!`, 'warning');
    }
}

// Delete server
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
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : 'var(--success)');
    toast.style.color = type === 'warning' ? 'var(--dark)' : 'white';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Set up all event listeners for the main page
function setupEventListeners() {
    // --- Header/Navigation ---
    document.getElementById('settingsBtn').addEventListener('click', function() {
        window.location.href = 'settings.html';
    });

    // --- Modals ---
    document.getElementById('addServerBtn').addEventListener('click', () => toggleAddServerModal(true));
    document.getElementById('closeAddModal').addEventListener('click', () => toggleAddServerModal(false));
    document.getElementById('addServerModal').addEventListener('click', function(e) {
        if (e.target === this) toggleAddServerModal(false);
    });

    document.getElementById('closeEditModal').addEventListener('click', () => toggleEditServerModal(false));
    document.getElementById('editServerModal').addEventListener('click', function(e) {
        if (e.target === this) toggleEditServerModal(false);
    });

    // --- Forms ---
    document.getElementById('addServerForm').addEventListener('submit', handleAddServer);
    document.getElementById('saveEdit').addEventListener('click', handleSaveEdit);
    
    // --- Filtering/Sorting/Search ---
    document.querySelectorAll('.filter-tab').forEach(tab => {
        tab.addEventListener('click', function() {
            handleCategoryFilter(this.getAttribute('data-category'));
        });
    });
    
    document.querySelectorAll('.sort-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            handleSort(this.getAttribute('data-sort'));
        });
    });

    document.getElementById('searchInput').addEventListener('input', function() {
        const query = this.value.toLowerCase();
        document.querySelectorAll('.server-card').forEach(card => {
            const name = card.querySelector('.server-name').textContent.toLowerCase();
            const address = card.querySelector('.server-address').textContent.toLowerCase();
            const description = card.querySelector('.server-description').textContent.toLowerCase();
            
            if (name.includes(query) || address.includes(query) || description.includes(query)) {
                card.style.display = '';
            } else {
                card.style.display = 'none';
            }
        });
    });

    // --- Dynamic Actions (Delegation) ---
    document.getElementById('serverList').addEventListener('click', function(e) {
        const target = e.target.closest('button');
        if (!target) return;

        const id = parseInt(target.getAttribute('data-id'));
        
        if (target.classList.contains('connect-btn')) {
            const address = target.getAttribute('data-address');
            connectToServer(address);
        } else if (target.classList.contains('favorite-star')) {
            const id = parseInt(target.closest('.server-card').getAttribute('data-id'));
            toggleFavorite(id);
        } else if (target.classList.contains('edit-btn')) {
            showEditModal(id);
        } else if (target.classList.contains('delete-btn')) {
            deleteServer(id);
        }
    });
    
    // --- File Upload/Download ---
    document.getElementById('exportBtn').addEventListener('click', exportServers);
    document.getElementById('importBtn').addEventListener('click', () => document.getElementById('fileUpload').click());
    document.getElementById('fileUpload').addEventListener('change', importServers);
}


// Export data to a JSON file
function exportServers() {
    const dataStr = JSON.stringify(servers, null, 4); // Use 4 spaces for pretty-printing
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    
    const exportFileDefaultName = 'isp_servers_backup.json';

    const linkElement = document.createElement('a');
    linkElement.setAttribute('href', dataUri);
    linkElement.setAttribute('download', exportFileDefaultName);
    linkElement.click();
    
    showToast('Server list exported successfully!');
}

// Import data from a JSON file
function importServers(event) {
    const file = event.target.files[0];
    if (!file) {
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const importedServers = JSON.parse(e.target.result);
            
            // Simple validation to ensure it looks like our data structure
            if (Array.isArray(importedServers) && importedServers.every(s => s.id && s.name && s.address)) {
                // Overwrite local servers with imported data
                servers = importedServers;
                saveServers();
                renderServers(currentCategory, currentSort);
                showToast('Server list imported successfully!');
            } else {
                showToast('Invalid file format. Please upload a valid JSON server list.', 'error');
            }
        } catch (error) {
            showToast('Error reading file. Please ensure it is a valid JSON file.', 'error');
            console.error('Import error:', error);
        }
        // Reset file input so the same file can be imported again if needed
        event.target.value = '';
    };

    reader.onerror = function() {
        showToast('Error reading file.', 'error');
        event.target.value = '';
    };

    reader.readAsText(file);
}
