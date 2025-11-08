// app.js (modified to use server-side probe)
// If you want to configure probe API at runtime, you can set localStorage.probeApiBase
// e.g. localStorage.setItem('probeApiBase', 'https://probe.yourdomain.com');
// and optional API key: localStorage.setItem('probeApiKey', 'your-key');

const DEFAULT_PROBE_API_BASE = ''; // e.g. 'https://probe.yourdomain.com' or '' to use relative path
const PROBE_API_BASE = (localStorage.getItem('probeApiBase') || DEFAULT_PROBE_API_BASE).replace(/\/$/, '');
const PROBE_API_KEY = localStorage.getItem('probeApiKey') || null; // optional - set if your probe requires x-probe-key

// --- existing code starts (unchanged unless noted) ---
// Sample data for demonstration
let servers = [
  {
    id: 1,
    name: "Live Sports HD",
    address: "http://live.sports.isp.com",
    categories: ["live"],
    type: "bdix",
    status: "active",
    description: "",
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
    description: "",
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
    description: "",
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
    servers.forEach(server => {
      if (!server.categories) {
        server.categories = [server.category || 'others'];
      }
      if (server.lastVerified !== undefined) {
        delete server.lastVerified;
      }
      if (!server.description) {
        server.description = '';
      }
      if (!server.lastChecked) {
        server.lastChecked = null;
      }
      if (!server.lastResponseTime) {
        server.lastResponseTime = null;
      }
    });
  } else {
    localStorage.setItem('ispServers', JSON.stringify(servers));
  }
  renderServers(currentCategory, currentSort);
  setupEventListeners();
});

// ==================== PROBE-BASED SERVER STATUS CHECKING ====================

// helper: call probe API
async function callProbeApi(target) {
  // Build probe URL
  let probeUrl = (PROBE_API_BASE ? PROBE_API_BASE : '') + '/probe?target=' + encodeURIComponent(target);
  // If PROBE_API_BASE is empty, use relative path (helpful during local deployments)
  if (!PROBE_API_BASE) {
    probeUrl = '/probe?target=' + encodeURIComponent(target);
  }

  const headers = {};
  if (PROBE_API_KEY) headers['x-probe-key'] = PROBE_API_KEY;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout for probe call
    const resp = await fetch(probeUrl, { method: 'GET', headers, signal: controller.signal });
    clearTimeout(timeoutId);
    if (!resp.ok) {
      const text = await resp.text();
      return { ok: false, error: `probe http ${resp.status} - ${text}` };
    }
    const json = await resp.json();
    return json;
  } catch (err) {
    return { ok: false, error: err && err.message ? err.message : String(err) };
  }
}

// Main check function – uses probe API; fallback to browser-side image if probe unreachable
async function checkServerStatus(server) {
  server.status = 'checking';
  server.lastChecked = Date.now();
  saveServers();
  renderServers(currentCategory, currentSort);

  const startTime = performance.now();

  try {
    // 1) Call the probe API
    const probeResult = await callProbeApi(server.address);

    if (probeResult && probeResult.ok) {
      // If probe indicates reachable
      const latency = probeResult.latencyMs || (performance.now() - startTime);
      server.status = 'active';
      server.lastChecked = Date.now();
      server.lastResponseTime = Math.round(latency);
      // If probe returned statusCode include it in lastResponseTime? keep latency only.
    } else {
      // probe reports not ok (could be unreachable or probe service error)
      // If probe returned an error message, we try browser-side fallback (image) to get a hint
      // But generally, probe result is authoritative.
      if (probeResult && probeResult.error && probeResult.error.toLowerCase().includes('timeout')) {
        // Treat as unknown and try image fallback
        await checkServerWithImage(server, startTime);
      } else if (probeResult && probeResult.error) {
        // probe ran but target unreachable from probe environment -> treat as inactive
        server.status = 'inactive';
        server.lastChecked = Date.now();
        server.lastResponseTime = null;
      } else {
        // probe failed to run (probe API not reachable). Use browser fallback as best-effort.
        await checkServerWithImage(server, startTime);
      }
    }
  } catch (err) {
    // Unexpected: fallback to image
    await checkServerWithImage(server, startTime);
  } finally {
    saveServers();
    renderServers(currentCategory, currentSort);
  }
}

// Browser fallback using Image() — kept as fallback if probe is unreachable
function checkServerWithImage(server, startTime) {
  return new Promise((resolve) => {
    const img = new Image();
    // choose a small static resource (favicon) with cache-bust
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
      // We treat error as "unknown" instead of automatic active
      // Many BDIX servers block image requests but can still serve other content.
      // Here we mark as 'inactive' but you may want to mark 'unknown' for UI clarity if you prefer.
      server.status = 'inactive';
      server.lastChecked = Date.now();
      server.lastResponseTime = null;
      resolve();
    };
    try {
      // Ensure the address doesn't create a double-slash
      const root = server.address.replace(/\/+$/, '');
      img.src = root + '/favicon.ico?t=' + Date.now();
    } catch (e) {
      clearTimeout(timeout);
      server.status = 'inactive';
      server.lastChecked = Date.now();
      server.lastResponseTime = null;
      resolve();
    }
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
    // Delay to avoid overwhelming the probe endpoint
    if (i < servers.length - 1) {
      await new Promise(resolve => setTimeout(resolve, 500));
    }
  }
  showToast('All servers status updated!');
}

// Quick status check (calls probe but with lightweight handling)
async function quickCheckServerStatus(serverId) {
  const server = servers.find(s => s.id === serverId);
  if (!server) return;
  server.status = 'checking';
  renderServers(currentCategory, currentSort);

  try {
    const probeResult = await callProbeApi(server.address);
    if (probeResult && probeResult.ok) {
      server.status = 'active';
      server.lastResponseTime = probeResult.latencyMs ? Math.round(probeResult.latencyMs) : null;
    } else {
      // probe says unreachable — mark inactive
      server.status = 'inactive';
      server.lastResponseTime = null;
    }
  } catch (e) {
    // probe call failed — best-effort fallback to image
    const startTime = performance.now();
    await checkServerWithImage(server, startTime);
  } finally {
    server.lastChecked = Date.now();
    saveServers();
    renderServers(currentCategory, currentSort);
  }
}

// Quick check all function
async function quickCheckAllStatus() {
  showToast('Quick checking all servers...');
  const concurrency = 5;
  let idx = 0;

  async function worker() {
    while (idx < servers.length) {
      const i = idx++;
      try {
        await quickCheckServerStatus(servers[i].id);
      } catch (e) {
        // ignore individual errors
      }
    }
  }

  const workers = [];
  for (let i = 0; i < concurrency; i++) workers.push(worker());
  await Promise.all(workers);
  showToast('Quick status check completed!');
}

// ==================== (the rest of your original app.js remains unchanged) ====================

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

// (All other functions from your original file below — unchanged)
// I will paste the remaining functions unchanged to keep the file intact.


// ==================== BULK OPERATIONS ====================
function deleteAllServers() {
  if (confirm('Are you sure you want to delete ALL servers? This cannot be undone!')) {
    servers = [];
    saveServers();
    renderServers(currentCategory, currentSort);
    showToast('All servers deleted!');
    closeAllManagementModals();
  }
}
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

// ==================== PROFESSIONAL TABLE RENDER FUNCTION ====================
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
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  if (searchTerm) {
    filteredServers = filteredServers.filter(server => server.name.toLowerCase().includes(searchTerm) || (server.description && server.description.toLowerCase().includes(searchTerm)) );
  }
  filteredServers = sortServers(filteredServers, sortBy);
  if (filteredServers.length === 0) {
    serverGrid.innerHTML = `
### No servers found

Try changing your filters or add a new server

`;
    return;
  }
  const tableContainer = document.createElement('div');
  tableContainer.className = 'server-table-container';
  tableContainer.innerHTML = `

Status

Server Name

Address

Type

Response

Actions

`;
  serverGrid.appendChild(tableContainer);
  const tableBody = document.getElementById('tableBody');
  filteredServers.forEach(server => {
    const tableRow = document.createElement('div');
    tableRow.className = `table-row server-row ${server.isFavorite ? 'favorite' : ''}`;
    tableRow.setAttribute('data-id', server.id);
    tableRow.innerHTML = `

${server.status === 'active' ? 'Online' : (server.status === 'checking' ? 'Checking' : 'Offline')}

${server.name}

${server.categories && server.categories.length > 0 ? `
${server.categories.map(cat => `${getCategoryDisplayName(cat)}`).join('')}

` : ''}

${server.address}

${server.type === 'bdix' ? 'BDIX' : 'Non-BDIX'}

${server.lastResponseTime ? `

${server.lastResponseTime}ms

` : '

N/A

'} ${server.lastChecked ? `

${formatRelativeTime(server.lastChecked)}

` : ''}
`;
    tableBody.appendChild(tableRow);
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
function sortServers(servers, sortBy) {
  const sortedServers = [...servers];
  switch(sortBy) {
    case 'manual': return sortedServers.sort((a, b) => a.rank - b.rank);
    case 'name': return sortedServers.sort((a, b) => a.name.localeCompare(b.name));
    case 'recent': return sortedServers.sort((a, b) => b.createdAt - a.createdAt);
    default: return sortedServers;
  }
}
function toggleFavorite(serverId) {
  const server = servers.find(s => s.id === serverId);
  if (server) {
    server.isFavorite = !server.isFavorite;
    saveServers();
    renderServers(currentCategory, currentSort);
    showToast(server.isFavorite ? 'Added to favorites!' : 'Removed from favorites!');
  }
}
function openEditModal(serverId) {
  const server = servers.find(s => s.id === serverId);
  if (server) {
    currentEditServerId = serverId;
    document.getElementById('editServerName').value = server.name;
    document.getElementById('editServerAddress').value = server.address;
    document.getElementById('editStatus').value = server.status;
    document.getElementById('editType').value = server.type;
    document.getElementById('editDescription').value = server.description || '';
    const categoryCheckboxes = document.querySelectorAll('#editModalBody input[name="editCategories"]');
    categoryCheckboxes.forEach(checkbox => {
      checkbox.checked = server.categories && server.categories.includes(checkbox.value);
    });
    document.getElementById('editServerModal').style.display = 'flex';
  }
}
function closeEditModal() {
  document.getElementById('editServerModal').style.display = 'none';
  currentEditServerId = null;
}
function normalizeAddress(address) {
  if (!address) return '';
  let normalized = address.toLowerCase().trim();
  normalized = normalized.replace(/^(https?|ftp):\/\//i, '');
  normalized = normalized.replace(/\/$/, '');
  return normalized;
}
function isAddressDuplicateInAnyCategory(address, categories, currentId = null) {
  const normalizedNewAddress = normalizeAddress(address);
  if (!normalizedNewAddress) return false;
  const currentIdStr = currentId ? String(currentId) : null;
  return servers.some(existingServer => {
    if (currentIdStr && String(existingServer.id) === currentIdStr) {
      return false;
    }
    const normalizedExistingAddress = normalizeAddress(existingServer.address);
    if (normalizedExistingAddress !== normalizedNewAddress) {
      return false;
    }
    return existingServer.categories.some(cat => categories.includes(cat));
  });
}
function saveEditChanges() {
  if (currentEditServerId) {
    const server = servers.find(s => s.id === currentEditServerId);
    if (server) {
      const selectedCategories = [];
      document.querySelectorAll('#editModalBody input[name="editCategories"]:checked').forEach(checkbox => {
        selectedCategories.push(checkbox.value);
      });
      const newCategories = selectedCategories.length > 0 ? selectedCategories : ['others'];
      const newAddress = document.getElementById('editServerAddress').value;
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
function closeAllManagementModals() {
  document.getElementById('exportImportModal').style.display = 'none';
  document.getElementById('importUrlModal').style.display = 'none';
  document.getElementById('manageServersModal').style.display = 'none';
}
function closeModal() {
  document.getElementById('exportImportModal').style.display = 'none';
}
function copyExportData() {
  const exportData = document.getElementById('exportData');
  exportData.select();
  document.execCommand('copy');
  showToast('Server data copied to clipboard!');
  closeAllManagementModals();
}
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
function triggerUpload() {
  document.getElementById('fileUpload').click();
}
function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = function(e) {
    try {
      const rawImportedServers = JSON.parse(e.target.result);
      if (Array.isArray(rawImportedServers)) {
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
          closeAllManagementModals();
        } else {
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
  event.target.value = '';
}
function replaceServers() {
  const exportData = document.getElementById('exportData');
  try {
    const importedServers = JSON.parse(exportData.value);
    if (Array.isArray(importedServers)) {
      servers = importedServers;
      saveServers();
      renderServers(currentCategory, currentSort);
      closeAllManagementModals();
      showToast('All servers replaced successfully!');
    } else {
      showToast('Invalid server data format!', 'error');
    }
  } catch (e) {
    showToast('Invalid JSON data!', 'error');
  }
}
function mergeServers() {
  const exportData = document.getElementById('exportData');
  try {
    const rawImportedServers = JSON.parse(exportData.value);
    if (Array.isArray(rawImportedServers)) {
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
      closeAllManagementModals();
      showToast(`Servers merged successfully! Added ${importedServers.length - duplicatesSkipped} new entries.`, duplicatesSkipped > 0 ? 'warning' : 'success');
    } else {
      showToast('Invalid server data format!', 'error');
    }
  } catch (e) {
    showToast('Invalid JSON data!', 'error');
  }
}
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
        categories: ['others'],
        type: address.includes('ftp') || address.includes('bdix') ? 'bdix' : 'non-bdix',
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
        showToast('TXT file parsed but found no valid servers.\nCheck format.', 'warning');
      }
    } else {
      throw new Error('Unsupported file extension.\nOnly .json or .txt are supported.');
    }
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
    importedServers = importedServers.filter(s => s.address);
    if (method === 'replace') {
      servers = importedServers;
      showToast(`All servers replaced from URL! Loaded ${servers.length} entries.`);
    } else {
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
      showToast(`Servers merged from URL! Added ${importedServers.length - duplicatesSkipped} new entries.\nTotal servers: ${servers.length}.`, duplicatesSkipped > 0 ? 'warning' : 'success');
    }
    saveServers();
    renderServers(currentCategory, currentSort);
    closeAllManagementModals();
  } catch (e) {
    console.error('Import Failed:', e);
    showToast(`Error importing from URL: ${e.message}`, 'error');
  }
}
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
  setTimeout(() => {
    exportData.focus();
  }, 100);
}
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

  // Close modals when clicking outside
  document.getElementById('exportImportModal').addEventListener('click', function(e) { if (e.target === this) closeModal(); });
  document.getElementById('editServerModal').addEventListener('click', function(e) { if (e.target === this) closeEditModal(); });
  document.getElementById('manageServersModal').addEventListener('click', function(e) { if (e.target === this) document.getElementById('manageServersModal').style.display = 'none'; });
  document.getElementById('importUrlModal').addEventListener('click', function(e) { if (e.target === this) document.getElementById('importUrlModal').style.display = 'none'; });
}
function addServer() {
  const name = document.getElementById('serverName').value;
  const address = document.getElementById('serverAddress').value;
  const type = document.getElementById('serverType').value;
  const description = document.getElementById('serverDescription').value;
  const selectedCategories = [];
  document.querySelectorAll('#serverForm input[name="serverCategories"]:checked').forEach(checkbox => {
    selectedCategories.push(checkbox.value);
  });
  const categories = selectedCategories.length > 0 ? selectedCategories : ['others'];
  if (isAddressDuplicateInAnyCategory(address, categories)) {
    showToast('Error: Duplicate server address found in a matching category!', 'error');
    return;
  }
  const newServer = {
    id: Date.now(),
    name,
    address: address.trim(),
    categories,
    type,
    status: 'inactive',
    description: description.trim() || '',
    rank: servers.length + 1,
    createdAt: Date.now(),
    isFavorite: false,
    lastChecked: null,
    lastResponseTime: null
  };
  servers.push(newServer);
  saveServers();
  renderServers(currentCategory, currentSort);
  document.getElementById('serverForm').reset();
  closeAllManagementModals();
  showToast(`Server "${name}" added successfully!`);
}
function deleteServer(id) {
  if (confirm('Are you sure you want to delete this server?')) {
    const serverName = servers.find(server => server.id === id).name;
    servers = servers.filter(server => server.id !== id);
    servers.forEach((server, index) => {
      server.rank = index + 1;
    });
    saveServers();
    renderServers(currentCategory, currentSort);
    showToast(`Server "${serverName}" deleted successfully!`);
  }
}
function connectToServer(address) {
  // Basic validation to avoid javascript: scheme
  try {
    const parsed = new URL(address);
    if (!['http:', 'https:', 'ftp:'].includes(parsed.protocol)) {
      throw new Error('Unsupported protocol');
    }
    showToast(`Opening: ${address}`);
    window.open(address, '_blank');
  } catch (e) {
    showToast(`Could not open automatically.\nPlease copy and paste: ${address}`);
    navigator.clipboard.writeText(address).then(() => { showToast(`URL copied to clipboard: ${address}`); });
  }
}
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.style.background = type === 'error' ? 'var(--danger)' : (type === 'warning' ? 'var(--warning)' : (type === 'info' ? 'var(--primary)' : 'var(--success)'));
  toast.style.color = type === 'warning' ? 'var(--dark)' : 'white';
  toast.classList.add('show');
  setTimeout(() => { toast.classList.remove('show'); }, 3000);
}
function saveServers() {
  localStorage.setItem('ispServers', JSON.stringify(servers));
}