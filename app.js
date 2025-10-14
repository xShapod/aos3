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

// Render the server grid
function renderServers(category, sortType) {
    const serverGrid = document.getElementById('serverGrid');
    serverGrid.innerHTML = '';

    let filteredServers = servers;
    let categoryName = '';

    // 1. Filter Servers by Category
    if (category !== 'all' && category !== 'favorites') {
        filteredServers = servers.filter(server => server.categories && server.categories.includes(category));
        categoryName = getCategoryDisplayName(category);
    } else if (category === 'favorites') {
        filteredServers = servers.filter(server => server.isFavorite);
        categoryName = 'Favorites';
    } else {
        categoryName = 'All Servers';
    }

    // 2. Sort Servers
    switch (sortType) {
        case 'name':
            filteredServers.sort((a, b) => a.name.localeCompare(b.name));
            break;
        case 'recent':
            // Sort from newest to oldest
            filteredServers.sort((a, b) => b.createdAt - a.createdAt);
            break;
        case 'manual':
        default:
            // Sort by current rank
            filteredServers.sort((a, b) => a.rank - b.rank);
            break;
    }

    if (filteredServers.length === 0) {
        serverGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-server"></i>
                <h3>No Servers in ${categoryName}</h3>
                <p>Try selecting a different category or add a new server.</p>
            </div>
        `;
        return;
    }

    filteredServers.forEach(server => {
        const card = document.createElement('div');
        card.className = `server-card ${server.status} ${server.type}`;
        card.setAttribute('data-id', server.id);

        const statusClass = server.status === 'active' ? 'status-active' : 'status-inactive';
        const typeClass = server.type === 'bdix' ? 'type-bdix' : 'type-non-bdix';
        
        // Build category pills
        const categoryPills = server.categories ? server.categories.map(cat => 
            `<span class="server-category">${getCategoryDisplayName(cat)}</span>`
        ).join('') : `<span class="server-category">Others</span>`;

        card.innerHTML = `
            <div class="server-header">
                <div class="server-name">${server.name}</div>
                <div class="server-actions">
                    <button class="favorite-star ${server.isFavorite ? 'favorited' : ''}" onclick="toggleFavorite(${server.id})">
                        <i class="${server.isFavorite ? 'fas' : 'far'} fa-star"></i>
                    </button>
                    <button class="edit-btn" onclick="openEditModal(${server.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteServer(${server.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="server-meta">
                <span class="${statusClass}">${server.status.toUpperCase()}</span>
                <span class="${typeClass}">${server.type.toUpperCase()}</span>
            </div>
            <div class="server-categories">${categoryPills}</div>
            <p class="server-description">${server.description || 'No description provided.'}</p>
            <div class="server-address">
                <i class="fas fa-link"></i>
                <a href="${server.address}" target="_blank" onclick="connectToServer('${server.address}'); return false;">
                    ${server.address}
                </a>
            </div>
            <button class="btn btn-primary connect-btn" onclick="connectToServer('${server.address}')">
                <i class="fas fa-plug"></i> Connect
            </button>
        `;

        serverGrid.appendChild(card);
    });
}

function getCategoryDisplayName(category) {
    const categories = {
        'live': 'Live TV',
        'movies': 'Movies',
        'series': 'Series',
        'others': 'Others'
    };
    return categories[category] || category;
}

// Search functionality
function handleSearch(query) {
    const lowerCaseQuery = query.toLowerCase();
    const allServers = servers;
    
    // Filter by name, address, or description
    const searchResults = allServers.filter(server => {
        const nameMatch = server.name.toLowerCase().includes(lowerCaseQuery);
        const addressMatch = server.address.toLowerCase().includes(lowerCaseQuery);
        const descriptionMatch = server.description.toLowerCase().includes(lowerCaseQuery);
        const categoryMatch = server.categories.some(cat => cat.toLowerCase().includes(lowerCaseQuery));
        
        return nameMatch || addressMatch || descriptionMatch || categoryMatch;
    });

    // Temporarily replace the current servers array for rendering the search results
    renderSearchResults(searchResults);
}

function renderSearchResults(results) {
    const serverGrid = document.getElementById('serverGrid');
    serverGrid.innerHTML = '';

    if (results.length === 0) {
        serverGrid.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-search"></i>
                <h3>No Search Results Found</h3>
                <p>Try refining your search terms.</p>
            </div>
        `;
        return;
    }
    
    // Render the search results using a temporary category/sort
    results.forEach(server => {
        const card = document.createElement('div');
        card.className = `server-card ${server.status} ${server.type}`;
        card.setAttribute('data-id', server.id);

        const statusClass = server.status === 'active' ? 'status-active' : 'status-inactive';
        const typeClass = server.type === 'bdix' ? 'type-bdix' : 'type-non-bdix';
        
        const categoryPills = server.categories ? server.categories.map(cat => 
            `<span class="server-category">${getCategoryDisplayName(cat)}</span>`
        ).join('') : `<span class="server-category">Others</span>`;


        card.innerHTML = `
            <div class="server-header">
                <div class="server-name">${server.name}</div>
                <div class="server-actions">
                    <button class="favorite-star ${server.isFavorite ? 'favorited' : ''}" onclick="toggleFavorite(${server.id})">
                        <i class="${server.isFavorite ? 'fas' : 'far'} fa-star"></i>
                    </button>
                    <button class="edit-btn" onclick="openEditModal(${server.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="delete-btn" onclick="deleteServer(${server.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
            <div class="server-meta">
                <span class="${statusClass}">${server.status.toUpperCase()}</span>
                <span class="${typeClass}">${server.type.toUpperCase()}</span>
            </div>
            <div class="server-categories">${categoryPills}</div>
            <p class="server-description">${server.description || 'No description provided.'}</p>
            <div class="server-address">
                <i class="fas fa-link"></i>
                <a href="${server.address}" target="_blank" onclick="connectToServer('${server.address}'); return false;">
                    ${server.address}
                </a>
            </div>
            <button class="btn btn-primary connect-btn" onclick="connectToServer('${server.address}')">
                <i class="fas fa-plug"></i> Connect
            </button>
        `;

        serverGrid.appendChild(card);
    });
}

// Setup all event listeners
function setupEventListeners() {
    const manageServersModal = document.getElementById('manageServersModal');
    const manageServersBtn = document.getElementById('manageServersBtn');
    const closeManageModal = document.getElementById('closeManageModal');
    const serverForm = document.getElementById('serverForm');
    const searchInput = document.getElementById('searchInput');
    const categoryTabs = document.querySelectorAll('.category-tabs .tab');
    const sortButtons = document.querySelectorAll('.sort-options .sort-btn');
    const settingsBtn = document.getElementById('settingsBtn');

    // Modals for Import/Export
    const exportImportModal = document.getElementById('exportImportModal');
    const closeExportModal = document.getElementById('closeModal'); // 'closeModal' is the ID for the export/import modal
    const exportBtn = document.getElementById('exportBtn');
    const importBtn = document.getElementById('importBtn');
    const replaceData = document.getElementById('replaceData');
    const mergeData = document.getElementById('mergeData');
    const copyData = document.getElementById('copyData');
    const downloadBtn = document.getElementById('downloadBtn');
    const uploadBtn = document.getElementById('uploadBtn');
    const fileUpload = document.getElementById('fileUpload');

    // Modals for URL Import
    const importUrlModal = document.getElementById('importUrlModal');
    const importUrlBtn = document.getElementById('importUrlBtn');
    const closeUrlModal = document.getElementById('closeUrlModal');
    const confirmImportUrl = document.getElementById('confirmImportUrl');
    const importUrlInput = document.getElementById('importUrl');

    // Edit Modal
    const editServerModal = document.getElementById('editServerModal');
    const closeEditModal = document.getElementById('closeEditModal');
    const saveEditBtn = document.getElementById('saveEdit');


    // Open Manage Servers Modal
    manageServersBtn.addEventListener('click', function() {
        manageServersModal.style.display = 'block';
        // Reset the form state every time it opens
        serverForm.reset();
        // Ensure 'Others' is checked by default
        document.querySelector('input[name="serverCategories"][value="others"]').checked = true;
    });

    // Close Manage Servers Modal
    closeManageModal.addEventListener('click', function() {
        manageServersModal.style.display = 'none';
    });
    window.addEventListener('click', function(event) {
        if (event.target == manageServersModal) {
            manageServersModal.style.display = 'none';
        }
    });

    // Add New Server Form Submission
    serverForm.addEventListener('submit', function(e) {
        e.preventDefault();
        
        const name = document.getElementById('serverName').value.trim();
        const address = document.getElementById('serverAddress').value.trim();
        const type = document.getElementById('serverType').value;
        const description = document.getElementById('serverDescription').value.trim();
        const categoryCheckboxes = document.querySelectorAll('input[name="serverCategories"]:checked');
        
        if (categoryCheckboxes.length === 0) {
            showToast('Please select at least one category.', 'error');
            return;
        }

        const categories = Array.from(categoryCheckboxes).map(cb => cb.value);

        // Check for duplicate server name or address
        const isDuplicate = servers.some(server => 
            server.name.toLowerCase() === name.toLowerCase() || 
            server.address.toLowerCase() === address.toLowerCase()
        );

        if (isDuplicate) {
            showToast('Server with this name or address already exists!', 'error');
            return;
        }
        
        const newServer = {
            id: Date.now(), // Use timestamp as a simple unique ID
            name,
            address,
            categories,
            type,
            status: 'active', // Default to active
            description,
            rank: servers.length + 1, // New server gets the lowest rank
            createdAt: Date.now(),
            isFavorite: false,
        };
        
        servers.push(newServer);
        saveServers();
        renderServers(currentCategory, currentSort);
        serverForm.reset();
        showToast(`Server "${name}" added successfully!`);

        // MODIFICATION 1: Close Manage Servers modal after successful add
        manageServersModal.style.display = 'none';
        // END MODIFICATION 1

        // Ensure 'Others' is checked by default again for the next time it opens
        document.querySelector('input[name="serverCategories"][value="others"]').checked = true;
    });

    // Search input
    searchInput.addEventListener('input', function() {
        const query = this.value.trim();
        if (query.length > 0) {
            handleSearch(query);
        } else {
            renderServers(currentCategory, currentSort); // Re-render current category view
        }
    });

    // Category tabs
    categoryTabs.forEach(tab => {
        tab.addEventListener('click', function() {
            // Only change categories if search is empty
            if (searchInput.value.trim() !== '') {
                searchInput.value = ''; // Clear search
            }
            categoryTabs.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            currentCategory = this.getAttribute('data-category');
            renderServers(currentCategory, currentSort);
        });
    });
    
    // Sort buttons
    sortButtons.forEach(btn => {
        btn.addEventListener('click', function() {
            sortButtons.forEach(b => b.classList.remove('active'));
            this.classList.add('active');
            currentSort = this.getAttribute('data-sort');
            renderServers(currentCategory, currentSort);
        });
    });

    // Settings button
    settingsBtn.addEventListener('click', function() {
        window.location.href = 'settings.html';
    });

    // --- Import/Export Modal Logic ---

    // Close Export/Import Modal
    closeExportModal.addEventListener('click', function() {
        exportImportModal.style.display = 'none';
    });
    window.addEventListener('click', function(event) {
        if (event.target == exportImportModal) {
            exportImportModal.style.display = 'none';
        }
    });
    
    // Export button (Show export data)
    exportBtn.addEventListener('click', function() {
        const exportData = document.getElementById('exportData');
        const importActions = document.getElementById('importActions');
        const copyDataBtn = document.getElementById('copyData');
        const modalTitle = document.getElementById('modalTitle');
        
        exportData.value = JSON.stringify(servers, null, 2); // Format JSON nicely
        exportData.readOnly = true;
        
        modalTitle.textContent = 'Export/Backup Data';
        importActions.style.display = 'none';
        copyDataBtn.style.display = 'block';
        
        exportImportModal.style.display = 'block';
    });

    // Import button (Show import text area)
    importBtn.addEventListener('click', function() {
        const exportData = document.getElementById('exportData');
        const importActions = document.getElementById('importActions');
        const copyDataBtn = document.getElementById('copyData');
        const modalTitle = document.getElementById('modalTitle');
        
        exportData.value = ''; // Clear for pasting
        exportData.readOnly = false;
        
        modalTitle.textContent = 'Import/Restore Data';
        importActions.style.display = 'flex';
        copyDataBtn.style.display = 'none';
        
        exportImportModal.style.display = 'block';
    });

    // Replace All button
    replaceData.addEventListener('click', function() {
        const exportData = document.getElementById('exportData');
        const importData = exportData.value.trim();
        
        if (importData) {
            try {
                const importedServers = JSON.parse(importData);
                if (!Array.isArray(importedServers)) {
                    showToast('Invalid JSON format: Data must be an array.', 'error');
                    return;
                }
                
                // Final check to ensure imported servers are valid objects
                const validServers = importedServers.filter(s => s.name && s.address);
                if (validServers.length === 0) {
                    showToast('No valid servers found in the imported data.', 'warning');
                    return;
                }

                // Apply necessary fields to imported servers
                const finalServers = validServers.map((server, index) => ({
                    id: server.id || Date.now() + index,
                    name: server.name,
                    address: server.address,
                    categories: server.categories || (server.category ? [server.category] : ['others']),
                    type: server.type || 'bdix',
                    status: server.status || 'active',
                    description: server.description || '',
                    rank: index + 1, // Reset rank for all imported servers
                    createdAt: server.createdAt || Date.now(),
                    isFavorite: server.isFavorite || false,
                }));
                
                servers = finalServers;
                saveServers();
                renderServers(currentCategory, currentSort);
                showToast('All servers replaced successfully!');
                
                // MODIFICATION 2: Close Import/Export modal after successful replace
                exportImportModal.style.display = 'none';
                // END MODIFICATION 2

            } catch (e) {
                showToast('Invalid JSON format. Please check the data.', 'error');
                console.error('Import Error:', e);
            }
        } else {
            showToast('Please paste server data to import.', 'warning');
        }
    });

    // Merge button
    mergeData.addEventListener('click', function() {
        const exportData = document.getElementById('exportData');
        const importData = exportData.value.trim();
        
        if (importData) {
            try {
                const importedServers = JSON.parse(importData);
                if (!Array.isArray(importedServers)) {
                    showToast('Invalid JSON format: Data must be an array.', 'error');
                    return;
                }
                
                let newServers = [];
                let skippedCount = 0;
                
                importedServers.forEach((importedServer, index) => {
                    // Check if a server with the same name or address already exists
                    const isDuplicate = servers.some(existingServer => 
                        existingServer.name.toLowerCase() === importedServer.name.toLowerCase() || 
                        existingServer.address.toLowerCase() === importedServer.address.toLowerCase()
                    );
                    
                    if (!isDuplicate && importedServer.name && importedServer.address) {
                        const newServer = {
                            id: importedServer.id || Date.now() + servers.length + index,
                            name: importedServer.name,
                            address: importedServer.address,
                            categories: importedServer.categories || (importedServer.category ? [importedServer.category] : ['others']),
                            type: importedServer.type || 'bdix',
                            status: importedServer.status || 'active',
                            description: importedServer.description || '',
                            rank: servers.length + newServers.length + 1, // Assign new rank
                            createdAt: importedServer.createdAt || Date.now(),
                            isFavorite: importedServer.isFavorite || false,
                        };
                        newServers.push(newServer);
                    } else {
                        skippedCount++;
                    }
                });
                
                if (newServers.length > 0) {
                    servers = servers.concat(newServers);
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    showToast(`Servers merged successfully! Added: ${newServers.length}, Skipped: ${skippedCount}`);
                } else if (skippedCount > 0) {
                    showToast(`No new servers added. All ${skippedCount} items were duplicates.`, 'warning');
                } else {
                    showToast('No valid servers found in the imported data.', 'warning');
                }
                
                // MODIFICATION 3: Close Import/Export modal after successful merge
                exportImportModal.style.display = 'none';
                // END MODIFICATION 3

            } catch (e) {
                showToast('Invalid JSON format. Please check the data.', 'error');
                console.error('Import Error:', e);
            }
        } else {
            showToast('Please paste server data to import.', 'warning');
        }
    });
    
    // Copy button
    copyData.addEventListener('click', function() {
        const exportData = document.getElementById('exportData');
        exportData.select();
        document.execCommand('copy');
        showToast('Data copied to clipboard!');
    });

    // Download button
    downloadBtn.addEventListener('click', function() {
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(servers, null, 2));
        const downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "isp_media_hub_backup.json");
        document.body.appendChild(downloadAnchorNode); // required for firefox
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
        showToast('Backup file downloaded!');
    });
    
    // Upload button
    uploadBtn.addEventListener('click', function() {
        fileUpload.click(); // Trigger the hidden file input
    });
    
    // File upload change listener
    fileUpload.addEventListener('change', function(e) {
        const file = e.target.files[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = function(event) {
            try {
                const importedServers = JSON.parse(event.target.result);
                
                if (!Array.isArray(importedServers)) {
                    showToast('Invalid file content: Data must be an array.', 'error');
                    return;
                }
                
                if (confirm('Do you want to REPLACE all existing servers or MERGE with them? (Cancel to do neither)')) {
                    // REPLACE logic (similar to replaceData)
                    const validServers = importedServers.filter(s => s.name && s.address);
                    if (validServers.length === 0) {
                        showToast('No valid servers found in the file.', 'warning');
                        return;
                    }

                    const finalServers = validServers.map((server, index) => ({
                        id: server.id || Date.now() + index,
                        name: server.name,
                        address: server.address,
                        categories: server.categories || (server.category ? [server.category] : ['others']),
                        type: server.type || 'bdix',
                        status: server.status || 'active',
                        description: server.description || '',
                        rank: index + 1,
                        createdAt: server.createdAt || Date.now(),
                        isFavorite: server.isFavorite || false,
                    }));
                    
                    servers = finalServers;
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    showToast('All servers replaced from file successfully!');
                } else if (confirm('Do you want to MERGE with existing servers?')) {
                    // MERGE logic (similar to mergeData)
                    let newServers = [];
                    let skippedCount = 0;
                    
                    importedServers.forEach((importedServer, index) => {
                        const isDuplicate = servers.some(existingServer => 
                            existingServer.name.toLowerCase() === importedServer.name.toLowerCase() || 
                            existingServer.address.toLowerCase() === importedServer.address.toLowerCase()
                        );
                        
                        if (!isDuplicate && importedServer.name && importedServer.address) {
                            const newServer = {
                                id: importedServer.id || Date.now() + servers.length + newServers.length + index,
                                name: importedServer.name,
                                address: importedServer.address,
                                categories: importedServer.categories || (importedServer.category ? [importedServer.category] : ['others']),
                                type: importedServer.type || 'bdix',
                                status: importedServer.status || 'active',
                                description: importedServer.description || '',
                                rank: servers.length + newServers.length + 1,
                                createdAt: importedServer.createdAt || Date.now(),
                                isFavorite: importedServer.isFavorite || false,
                            };
                            newServers.push(newServer);
                        } else {
                            skippedCount++;
                        }
                    });
                    
                    if (newServers.length > 0) {
                        servers = servers.concat(newServers);
                        saveServers();
                        renderServers(currentCategory, currentSort);
                        showToast(`Servers merged successfully from file! Added: ${newServers.length}, Skipped: ${skippedCount}`);
                    } else if (skippedCount > 0) {
                        showToast(`No new servers added from file. All ${skippedCount} items were duplicates.`, 'warning');
                    } else {
                        showToast('No valid servers found in the imported data.', 'warning');
                    }
                }

                // In all success cases (replace or merge), we close the modal
                exportImportModal.style.display = 'none';
                
            } catch (e) {
                showToast('Error reading or parsing file. Please ensure it is a valid JSON backup file.', 'error');
                console.error('File Upload Error:', e);
            } finally {
                // Clear the file input so the same file can be uploaded again
                e.target.value = null; 
            }
        };

        reader.readAsText(file);
    });

    // --- Import from URL Modal Logic ---

    importUrlBtn.addEventListener('click', function() {
        importUrlModal.style.display = 'block';
    });

    closeUrlModal.addEventListener('click', function() {
        importUrlModal.style.display = 'none';
    });
    window.addEventListener('click', function(event) {
        if (event.target == importUrlModal) {
            importUrlModal.style.display = 'none';
        }
    });

    confirmImportUrl.addEventListener('click', function() {
        const url = importUrlInput.value.trim();
        const importMethod = document.querySelector('input[name="importMethod"]:checked').value;
        
        if (!url) {
            showToast('Please enter a valid URL.', 'warning');
            return;
        }

        showToast('Fetching data from URL...', 'info');

        // Note: In a real-world scenario, you'd need a server-side proxy
        // to handle CORS issues for cross-origin fetches. This client-side
        // fetch may fail depending on the remote server's CORS policy.
        fetch(url)
            .then(response => {
                if (!response.ok) {
                    throw new Error('Network response was not ok: ' + response.statusText);
                }
                return response.json();
            })
            .then(importedServers => {
                if (!Array.isArray(importedServers)) {
                    showToast('Invalid data format: Expected an array from the URL.', 'error');
                    return;
                }

                let newServers = [];
                let skippedCount = 0;
                
                if (importMethod === 'replace') {
                    // REPLACE logic
                    const validServers = importedServers.filter(s => s.name && s.address);
                    
                    servers = validServers.map((server, index) => ({
                        id: server.id || Date.now() + index,
                        name: server.name,
                        address: server.address,
                        categories: server.categories || (server.category ? [server.category] : ['others']),
                        type: server.type || 'bdix',
                        status: server.status || 'active',
                        description: server.description || '',
                        rank: index + 1,
                        createdAt: server.createdAt || Date.now(),
                        isFavorite: server.isFavorite || false,
                    }));
                    
                    newServers = validServers;

                } else { // Merge logic
                    importedServers.forEach((importedServer, index) => {
                        const isDuplicate = servers.some(existingServer => 
                            existingServer.name.toLowerCase() === importedServer.name.toLowerCase() || 
                            existingServer.address.toLowerCase() === importedServer.address.toLowerCase()
                        );
                        
                        if (!isDuplicate && importedServer.name && importedServer.address) {
                            const newServer = {
                                id: importedServer.id || Date.now() + servers.length + newServers.length + index,
                                name: importedServer.name,
                                address: importedServer.address,
                                categories: importedServer.categories || (importedServer.category ? [importedServer.category] : ['others']),
                                type: importedServer.type || 'bdix',
                                status: importedServer.status || 'active',
                                description: importedServer.description || '',
                                rank: servers.length + newServers.length + 1,
                                createdAt: importedServer.createdAt || Date.now(),
                                isFavorite: importedServer.isFavorite || false,
                            };
                            newServers.push(newServer);
                        } else {
                            skippedCount++;
                        }
                    });
                    
                    if (newServers.length > 0) {
                        servers = servers.concat(newServers);
                    }
                }
                
                if (newServers.length > 0 || skippedCount > 0) {
                    saveServers();
                    renderServers(currentCategory, currentSort);
                    showToast(`Servers imported successfully! Added: ${newServers.length}, Skipped: ${skippedCount}`);
                    
                    // MODIFICATION 4: Close Import from URL modal after successful import
                    importUrlModal.style.display = 'none';
                    // END MODIFICATION 4

                } else {
                    showToast('No new servers found in the imported data.', 'warning');
                }

            })
            .catch(error => {
                showToast('Failed to fetch data from URL. Check URL or remote server CORS policy.', 'error');
                console.error('URL Import Error:', error);
            });
    });

    // --- Edit Server Modal Logic ---

    // Close Edit Server Modal
    closeEditModal.addEventListener('click', function() {
        editServerModal.style.display = 'none';
    });
    window.addEventListener('click', function(event) {
        if (event.target == editServerModal) {
            editServerModal.style.display = 'none';
        }
    });

    // Save Edit changes
    saveEditBtn.addEventListener('click', function() {
        if (currentEditServerId === null) {
            showToast('Error: No server selected for editing.', 'error');
            return;
        }

        const serverIndex = servers.findIndex(server => server.id === currentEditServerId);
        if (serverIndex === -1) {
            showToast('Error: Server not found.', 'error');
            return;
        }

        const name = document.getElementById('editServerName').value.trim();
        const address = document.getElementById('editServerAddress').value.trim();
        const status = document.getElementById('editStatus').value;
        const type = document.getElementById('editType').value;
        const description = document.getElementById('editDescription').value.trim();
        const categoryCheckboxes = document.querySelectorAll('input[name="editCategories"]:checked');
        
        if (categoryCheckboxes.length === 0) {
            showToast('Please select at least one category.', 'error');
            return;
        }

        const categories = Array.from(categoryCheckboxes).map(cb => cb.value);

        // Check for duplicate name/address, excluding the server being edited
        const isDuplicate = servers.some((server, index) => 
            index !== serverIndex &&
            (server.name.toLowerCase() === name.toLowerCase() || 
             server.address.toLowerCase() === address.toLowerCase())
        );

        if (isDuplicate) {
            showToast('Another server already uses this name or address!', 'error');
            return;
        }

        // Update the server object
        servers[serverIndex].name = name;
        servers[serverIndex].address = address;
        servers[serverIndex].status = status;
        servers[serverIndex].type = type;
        servers[serverIndex].categories = categories;
        servers[serverIndex].description = description;

        saveServers();
        renderServers(currentCategory, currentSort);
        editServerModal.style.display = 'none';
        showToast(`Server "${name}" updated successfully!`);
    });
}

// Function to open the edit modal and populate data
function openEditModal(id) {
    currentEditServerId = id;
    const server = servers.find(server => server.id === id);
    if (!server) {
        showToast('Server not found.', 'error');
        return;
    }

    // Populate fields
    document.getElementById('editServerName').value = server.name;
    document.getElementById('editServerAddress').value = server.address;
    document.getElementById('editStatus').value = server.status;
    document.getElementById('editType').value = server.type;
    document.getElementById('editDescription').value = server.description;

    // Populate categories
    const categoryCheckboxes = document.querySelectorAll('input[name="editCategories"]');
    categoryCheckboxes.forEach(checkbox => {
        checkbox.checked = server.categories.includes(checkbox.value);
    });

    document.getElementById('editServerModal').style.display = 'block';
}


// Toggle server favorite status
function toggleFavorite(id) {
    const server = servers.find(server => server.id === id);
    if (server) {
        server.isFavorite = !server.isFavorite;
        saveServers();
        renderServers(currentCategory, currentSort);
        showToast(server.isFavorite ? `"${server.name}" added to Favorites!` : `"${server.name}" removed from Favorites!`);
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
    // NEW: Set text color for better contrast on warnings
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
