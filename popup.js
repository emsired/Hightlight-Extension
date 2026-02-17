document.addEventListener('DOMContentLoaded', () => {
    // DOM Elements
    const listContainer = document.getElementById('highlights-list');
    const emptyState = document.getElementById('empty-state');
    const editorPanel = document.getElementById('editor-panel');
    const siteToggle = document.getElementById('site-toggle');
    const filterDots = document.querySelectorAll('.dot');
    
    // Editor Elements
    const editorText = document.getElementById('editor-text');
    const editorNote = document.getElementById('editor-note');
    const editorDate = document.getElementById('editor-date');
    const editorStrip = document.getElementById('editor-strip');
    const editorLink = document.getElementById('editor-link');
    const editorDelete = document.getElementById('editor-delete');
    const saveStatus = document.getElementById('save-status');

    let allHighlights = [];
    let currentFilter = 'all';
    let currentTabUrl = '';
    let selectedId = null;

    const colorMap = {
        'red': '#ffadad', 'orange': '#ffd6a5', 'yellow': '#fdffb6',
        'green': '#caffbf', 'blue': '#9bf6ff', 'indigo': '#a0c4ff',
        'purple': '#bdb2ff', 'strikethrough': '#555', 'underline': '#555'
    };

    // 1. INIT: Permission Check
    chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (tabs[0] && tabs[0].url.startsWith('http')) {
            currentTabUrl = new URL(tabs[0].url).hostname;
            checkPermission(currentTabUrl);
        } else {
            siteToggle.disabled = true;
        }
    });

    function checkPermission(hostname) {
        chrome.storage.local.get(['allowedSites'], (result) => {
            const allowedSites = result.allowedSites || [];
            siteToggle.checked = allowedSites.includes(hostname);
        });
    }

    // 2. TOGGLE PERMISSION
    siteToggle.addEventListener('change', (e) => {
        const isChecked = e.target.checked;
        chrome.storage.local.get(['allowedSites'], (result) => {
            let allowedSites = result.allowedSites || [];
            
            if (isChecked) {
                if (!allowedSites.includes(currentTabUrl)) allowedSites.push(currentTabUrl);
            } else {
                allowedSites = allowedSites.filter(site => site !== currentTabUrl);
            }
            
            chrome.storage.local.set({ allowedSites: allowedSites });
        });
    });

    // 3. DATA LOADING
    function loadHighlights() {
        chrome.storage.local.get(['highlights'], (result) => {
            allHighlights = result.highlights || [];
            renderList();
        });
    }

    // 4. RENDER LIST
    function renderList() {
        listContainer.innerHTML = '';
        
        let filtered = allHighlights;
        if (currentFilter !== 'all') {
            if (currentFilter === 'other') {
                filtered = allHighlights.filter(h => !['red','orange','yellow','green','blue','indigo','purple'].includes(h.color));
            } else {
                filtered = allHighlights.filter(h => h.color === currentFilter);
            }
        }
        filtered.sort((a, b) => b.timestamp - a.timestamp);

        filtered.forEach(item => {
            const el = document.createElement('div');
            el.className = `list-item ${item.timestamp === selectedId ? 'selected' : ''}`;
            el.style.borderLeftColor = colorMap[item.color] || '#ccc';
            el.innerHTML = `<div class="list-item-text">${item.text}</div>`;
            el.addEventListener('click', () => selectHighlight(item));
            listContainer.appendChild(el);
        });

        if (selectedId && !filtered.find(h => h.timestamp === selectedId)) {
            selectedId = null;
            showEditor(null);
        }
    }

    // 5. EDITOR LOGIC
    function selectHighlight(item) {
        selectedId = item.timestamp;
        renderList();
        showEditor(item);
    }

    function showEditor(item) {
        if (!item) {
            emptyState.classList.remove('hidden');
            editorPanel.classList.add('hidden');
            return;
        }
        emptyState.classList.add('hidden');
        editorPanel.classList.remove('hidden');

        editorDate.innerText = new Date(item.timestamp).toLocaleDateString('vi-VN');
        editorText.innerText = `"${item.text}"`;
        editorNote.value = item.note || '';
        editorLink.href = item.url;
        editorStrip.style.background = colorMap[item.color] || '#ccc';
        editorDelete.onclick = () => deleteHighlight(item.timestamp);
    }

    // Auto Save
    let timeoutId;
    editorNote.addEventListener('input', () => {
        if (!selectedId) return;
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => {
            const index = allHighlights.findIndex(h => h.timestamp === selectedId);
            if (index > -1) {
                allHighlights[index].note = editorNote.value;
                chrome.storage.local.set({ highlights: allHighlights }, () => {
                    saveStatus.classList.add('show');
                    setTimeout(() => saveStatus.classList.remove('show'), 2000);
                });
            }
        }, 500);
    });

    function deleteHighlight(timestamp) {
        if(confirm("Xóa highlight này?")) {
            allHighlights = allHighlights.filter(h => h.timestamp !== timestamp);
            chrome.storage.local.set({ highlights: allHighlights }, () => {
                selectedId = null;
                showEditor(null);
                renderList();
            });
        }
    }

    // Filters & Clear
    filterDots.forEach(dot => {
        dot.addEventListener('click', () => {
            filterDots.forEach(d => d.classList.remove('active'));
            dot.classList.add('active');
            currentFilter = dot.dataset.filter;
            renderList();
        });
    });

    document.getElementById('clear-all').addEventListener('click', () => {
        if(confirm("Xóa TẤT CẢ dữ liệu?")) {
            chrome.storage.local.set({ highlights: [] }, () => {
                allHighlights = [];
                selectedId = null;
                showEditor(null);
                renderList();
            });
        }
    });

    loadHighlights();
});