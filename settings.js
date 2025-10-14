let servers = [];
let currentCategory = 'all';

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
        });
    }
    
    renderServerList(currentCategory);
    setupEventListeners();
});

// Save servers to localStorage
function saveServers() {
    localStorage.setItem('ispServers', JSON.stringify(servers));
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
        const listItem = document.createElement('div');
        listItem.className = 'server-list-item';
        listItem.setAttribute('data-id', server.id);
        
        // Safely display the first category from the categories array
        const displayCategory = (server.categories && server.categories.length > 0) ? server.categories[0].charAt(0).toUpperCase() + server.categories[0].slice(1) : 'Others';

        listItem.innerHTML = `
            <div class="server-rank-number">${index + 1}</div>
            <div class="server-list-info">
                <div class="server-list-name">${server.name}</div>
                <div class="server-list-category">${displayCategory}</div>
            </div>
            <div class="server-list-actions">
                <button class="btn btn-sm btn-info move-up" data-id="${server.id}">
                    <i class="fas fa-chevron-up"></i>
                </button>
                <button class="btn btn-sm btn-info move-down" data-id="${server.id}">
                    <i class="fas fa-chevron-down"></i>
                </button>
            </div>
        `;
        
        serverList.appendChild(listItem);
    });
    
    // Add event listeners for move buttons
    document.querySelectorAll('.move-up').forEach(btn => {
        btn.addEventListener('click', handleMoveUp);
    });
    document.querySelectorAll('.move-down').forEach(btn => {
        btn.addEventListener('click', handleMoveDown);
    });
}

// Event handler for moving a server up
function handleMoveUp(event) {
    const id = parseInt(event.currentTarget.getAttribute('data-id'));
    const serverElement = event.currentTarget.closest('.server-list-item');
    const prevServerElement = serverElement.previousElementSibling;

    if (prevServerElement && prevServerElement.classList.contains('server-list-item')) {
        // Swap in the DOM
        serverElement.parentNode.insertBefore(serverElement, prevServerElement);
        
        // Update the ranks in the servers array and the displayed numbers
        updateRanksAndDOM(id, 'up');
    }
}

// Event handler for moving a server down
function handleMoveDown(event) {
    const id = parseInt(event.currentTarget.getAttribute('data-id'));
    const serverElement = event.currentTarget.closest('.server-list-item');
    const nextServerElement = serverElement.nextElementSibling;

    if (nextServerElement && nextServerElement.classList.contains('server-list-item')) {
        // Swap in the DOM
        serverElement.parentNode.insertBefore(nextServerElement, serverElement);
        
        // Update the ranks in the servers array and the displayed numbers
        updateRanksAndDOM(id, 'down');
    }
}

// Helper to update the displayed rank numbers in the DOM and the in-memory array
function updateRanksAndDOM(movedServerId, direction) {
    const listItems = Array.from(document.getElementById('serverList').children);
    const reorderedServerIds = listItems
        .filter(item => item.classList.contains('server-list-item'))
        .map(item => parseInt(item.getAttribute('data-id')));
        
    const idToServerMap = new Map(servers.map(s => [s.id, s]));

    // Update the rank numbers displayed in the DOM
    listItems.forEach((item, index) => {
        item.querySelector('.server-rank-number').textContent = index + 1;
    });
    
    // Update the in-memory 'servers' array to reflect the new order
    // This logic ensures that only visible servers' ranks are affected,
    // and hidden servers maintain their relative order.
    
    // 1. Separate servers that are visible (in reorderedServerIds) from others
    const otherServers = servers.filter(s => !new Set(reorderedServerIds).has(s.id));
    const otherServerIds = otherServers.map(s => s.id);

    // 2. Combine the lists to determine the new global order/rank
    // (Visible servers in new order, followed by hidden servers in their old relative order)
    const combinedOrderIds = [...reorderedServerIds, ...otherServerIds];

    // 3. Rebuild the main servers array and update ranks (rank: 1 to N)
    const newServers = combinedOrderIds.map(id => idToServerMap.get(id)).filter(s => s);
    newServers.forEach((server, index) => {
        server.rank = index + 1;
    });

    servers = newServers; // Update the global array
    // NOTE: We do not call saveServers() here, only when the user clicks 'Save Order'.
}

// Save the new order to localStorage
function saveNewOrder() {
    // The ranks in the 'servers' array are already updated by updateRanksAndDOM 
    // after any up/down button click. We just need to save the final state.
    saveServers(); // Save to localStorage
    showToast('Server order saved successfully!');
}


// Reset the order to default (alphabetical by name)
function resetToDefaultOrder() {
    // Sort the entire array alphabetically (which is the default order)
    servers.sort((a, b) => a.name.localeCompare(b.name));
    
    // Re-rank them from 1 to N
    servers.forEach((server, index) => {
        server.rank = index + 1;
    });
    
    saveServers();
    renderServerList(currentCategory);
    showToast('Order reset to alphabetical!');
}

// Set up event listeners for settings page
function setupEventListeners() {
    // Back button
    document.getElementById('backBtn').addEventListener('click', function() {
        window.location.href = 'index.html';
    });
    
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
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    // MODIFIED: Check for 'warning' and set background accordingly
    toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : 'var(--success)');
    // MODIFIED: Set text color for better contrast on warnings
    toast.style.color = type === 'warning' ? 'var(--dark)' : 'white';
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
