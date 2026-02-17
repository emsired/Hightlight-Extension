console.log("Rainbow Highlighter: Content script active.");

let selectionMenu = null;
let currentSelectionRange = null;
let isSiteAllowed = false;

const HIGHLIGHT_OPTIONS = [
    { id: 'red', color: '#ffadad', label: 'Đỏ' },
    { id: 'orange', color: '#ffd6a5', label: 'Cam' },
    { id: 'yellow', color: '#fdffb6', label: 'Vàng' },
    { id: 'green', color: '#caffbf', label: 'Xanh Lá' },
    { id: 'blue', color: '#9bf6ff', label: 'Xanh Dương' },
    { id: 'indigo', color: '#a0c4ff', label: 'Chàm' },
    { id: 'purple', color: '#bdb2ff', label: 'Tím' },
    { id: 'strikethrough', style: 'text-decoration: line-through !important;', label: 'Gạch ngang' },
    { id: 'underline', style: 'text-decoration: underline !important;', label: 'Gạch chân' }
];

// 0. INIT
function init() {
    const style = document.createElement('style');
    style.textContent = `
        .rh-highlighted-text { border-radius: 2px; cursor: pointer; transition: 0.2s; box-decoration-break: clone; -webkit-box-decoration-break: clone; }
        .rh-highlighted-text:hover { filter: brightness(0.9); }
    `;
    document.head.appendChild(style);
    checkPermissionAndInit();
}

function checkPermissionAndInit() {
    const hostname = window.location.hostname;
    chrome.storage.local.get(['allowedSites'], (result) => {
        const allowedSites = result.allowedSites || [];
        isSiteAllowed = allowedSites.includes(hostname);
        
        if (isSiteAllowed) {
            createMenu();
            restoreHighlights();
        } else {
            hideMenu();
        }
    });
}

chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local' && changes.allowedSites) {
        checkPermissionAndInit();
    }
});

// 1. UI
function createMenu() {
    if (document.getElementById('rh-highlight-menu')) return;
    const menu = document.createElement('div');
    menu.id = 'rh-highlight-menu';
    menu.style.display = 'none';
    
    const colorContainer = document.createElement('div');
    colorContainer.className = 'rh-options-container';

    HIGHLIGHT_OPTIONS.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'rh-color-btn';
        btn.title = opt.label;
        if (opt.color) btn.style.backgroundColor = opt.color;
        else if (opt.style) {
            btn.style.backgroundColor = '#fff';
            btn.style.border = '1px solid #ccc';
            if(opt.id === 'strikethrough') btn.innerHTML = '<b style="text-decoration:line-through">S</b>';
            if(opt.id === 'underline') btn.innerHTML = '<b style="text-decoration:underline">U</b>';
        }
        btn.addEventListener('mousedown', (e) => {
            e.preventDefault(); e.stopPropagation();
            showNoteInput(opt);
        });
        colorContainer.appendChild(btn);
    });

    menu.appendChild(colorContainer);
    const noteContainer = document.createElement('div');
    noteContainer.id = 'rh-note-container';
    noteContainer.style.display = 'none';
    const input = document.createElement('input');
    input.type = 'text';
    input.placeholder = 'Thêm ghi chú...';
    input.id = 'rh-note-input';
    const saveBtn = document.createElement('button');
    saveBtn.innerText = 'Lưu';
    saveBtn.id = 'rh-save-btn';
    noteContainer.appendChild(input);
    noteContainer.appendChild(saveBtn);
    menu.appendChild(noteContainer);
    document.body.appendChild(menu);
    selectionMenu = menu;
}

// 2. Interaction
document.addEventListener('mouseup', (e) => {
    if (!isSiteAllowed) return;
    if (selectionMenu && selectionMenu.contains(e.target)) return;
    const selection = window.getSelection();
    if (selection.toString().trim().length > 0) {
        currentSelectionRange = selection.getRangeAt(0);
        const rect = currentSelectionRange.getBoundingClientRect();
        const scrollTop = window.scrollY || document.documentElement.scrollTop;
        const scrollLeft = window.scrollX || document.documentElement.scrollLeft;
        if (rect.width > 0) showMenu(rect.left + scrollLeft, rect.bottom + scrollTop + 10);
    } else {
        hideMenu();
    }
});

function showMenu(x, y) {
    if (!selectionMenu) return;
    document.querySelector('.rh-options-container').style.display = 'flex';
    document.getElementById('rh-note-container').style.display = 'none';
    document.getElementById('rh-note-input').value = '';
    selectionMenu.style.display = 'block';
    selectionMenu.style.left = `${x}px`;
    selectionMenu.style.top = `${y}px`;
}

function hideMenu() {
    if (selectionMenu) selectionMenu.style.display = 'none';
}

function showNoteInput(option) {
    document.querySelector('.rh-options-container').style.display = 'none';
    const noteContainer = document.getElementById('rh-note-container');
    noteContainer.style.display = 'flex';
    const input = document.getElementById('rh-note-input');
    input.focus();
    const saveBtn = document.getElementById('rh-save-btn');
    const newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    const saveAction = () => { applyHighlight(option, input.value); hideMenu(); };
    newBtn.addEventListener('click', saveAction);
    input.onkeydown = (e) => { if(e.key === 'Enter') saveAction(); };
}

// 3. Logic Highlighting
function applyHighlight(option, note) {
    if (!currentSelectionRange) return;
    const fullText = currentSelectionRange.toString();
    const textNodes = [];

    if (currentSelectionRange.commonAncestorContainer.nodeType === Node.TEXT_NODE) {
        textNodes.push(currentSelectionRange.commonAncestorContainer);
    } else {
        const treeWalker = document.createTreeWalker(
            currentSelectionRange.commonAncestorContainer,
            NodeFilter.SHOW_TEXT,
            {
                acceptNode: function(node) {
                    return currentSelectionRange.intersectsNode(node) 
                        ? NodeFilter.FILTER_ACCEPT 
                        : NodeFilter.FILTER_REJECT;
                }
            }
        );
        while (treeWalker.nextNode()) textNodes.push(treeWalker.currentNode);
    }

    textNodes.forEach(node => {
        const subRange = document.createRange();
        let start = (node === currentSelectionRange.startContainer) ? currentSelectionRange.startOffset : 0;
        let end = (node === currentSelectionRange.endContainer) ? currentSelectionRange.endOffset : node.length;

        if (start < end) {
            subRange.setStart(node, start);
            subRange.setEnd(node, end);
            const span = document.createElement('span');
            span.className = 'rh-highlighted-text';
            span.title = note || "";
            
            if (option.color) {
                span.style.setProperty('background-color', option.color, 'important');
                span.style.setProperty('color', '#000', 'important'); 
            } else if (option.style) {
                span.style.cssText = option.style;
            }
            try { subRange.surroundContents(span); } catch(e){}
        }
    });

    saveToStorage({
        id: Date.now(),
        text: fullText,
        note: note,
        color: option.id,
        colorHex: option.color || 'style',
        style: option.style || null,
        url: window.location.href,
        title: document.title,
        timestamp: Date.now()
    });
    window.getSelection().removeAllRanges();
}

function saveToStorage(data) {
    chrome.storage.local.get(['highlights'], (result) => {
        const highlights = result.highlights || [];
        highlights.push(data);
        chrome.storage.local.set({ highlights: highlights });
    });
}

// 4. Persistence
function restoreHighlights() {
    chrome.storage.local.get(['highlights'], (result) => {
        const highlights = result.highlights || [];
        const currentUrl = window.location.href;
        const pageHighlights = highlights.filter(h => h.url === currentUrl);
        if (pageHighlights.length === 0) return;

        const textGroups = {};
        pageHighlights.forEach(h => {
            if (!textGroups[h.text]) textGroups[h.text] = [];
            textGroups[h.text].push(h);
        });

        const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT, null, false);
        let node;

        while(node = walker.nextNode()) {
            const nodeText = node.nodeValue;
            for (const [searchText, dataArray] of Object.entries(textGroups)) {
                if (dataArray.length === 0) continue;
                let searchIndex = 0;
                while (true) {
                    const index = nodeText.indexOf(searchText, searchIndex);
                    if (index === -1) break;
                    const parent = node.parentElement;
                    if (parent && parent.classList.contains('rh-highlighted-text')) {
                        searchIndex = index + 1;
                        continue; 
                    }
                    const dataToApply = dataArray.shift();
                    if (!dataToApply) break;

                    try {
                        const range = document.createRange();
                        range.setStart(node, index);
                        range.setEnd(node, index + searchText.length);
                        const span = document.createElement('span');
                        span.className = 'rh-highlighted-text';
                        span.title = dataToApply.note || "";
                        if (dataToApply.colorHex && dataToApply.colorHex !== 'style') {
                            span.style.setProperty('background-color', dataToApply.colorHex, 'important');
                            span.style.setProperty('color', '#000', 'important');
                        } else if (dataToApply.style) {
                            span.style.cssText = dataToApply.style;
                        }
                        range.surroundContents(span);
                        break; 
                    } catch (e) {}
                    searchIndex = index + 1;
                }
                if (dataArray.length === 0) delete textGroups[searchText];
            }
        }
    });
}

init();