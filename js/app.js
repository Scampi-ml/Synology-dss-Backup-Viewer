/**
 * app.js - Synology dss Backup Viewer bootstrap and UI state.
 */

let _appPhase = 'idle';
let _parseResult = null;
let _errorMessage = '';
let _navState = getInitialNavState();
let _showSensitive = false;
let _sensitiveWarningShown = false;

function getActiveNavId() {
    return resolveContentNavId(_navState);
}

function renderApp() {
    updateContextBar();
    const root = document.getElementById('app');
    if (!root) return;

    if (_appPhase === 'idle') root.innerHTML = renderDropZone();
    else if (_appPhase === 'loading') root.innerHTML = renderLoadingView();
    else if (_appPhase === 'results' && _parseResult) root.innerHTML = renderResultsShell();
    else if (_appPhase === 'error') root.innerHTML = renderErrorView(_errorMessage);
}

function renderResultsShell() {
    const content = renderNavContent(getActiveNavId(), _parseResult, _showSensitive);
    return `
        <div class="app-layout">
            ${renderSidebar(_navState)}
            <div class="main-panel">
                ${renderTabBars(_navState)}
                <div class="main-content" id="active-view-root">${content}</div>
            </div>
        </div>
    `;
}

function rerenderActiveView() {
    if (_appPhase !== 'results' || !_parseResult) return;
    const root = document.getElementById('active-view-root');
    if (root) root.innerHTML = renderNavContent(getActiveNavId(), _parseResult, _showSensitive);
}

function navigateToNavId(navId) {
    _navState = navStateFromNavId(navId);
    renderApp();
}

function switchUtility(utilityId) {
    _navState = { mode: 'utility', utilityId, mainId: null, subId: null, tabId: null, subTabId: null };
    renderApp();
}

function switchMain(mainId) {
    const subs = getSubSections(mainId);
    const sub = subs[0];
    if (!sub) {
        _navState = { mode: 'category', utilityId: null, mainId, subId: null, tabId: null, subTabId: null };
    } else if (sub.leaf) {
        _navState = { mode: 'category', utilityId: null, mainId, subId: sub.id, tabId: null, subTabId: null };
    } else {
        const tabs = getTabGroups(sub.id);
        const tab = tabs[0];
        _navState = {
            mode: 'category',
            utilityId: null,
            mainId,
            subId: sub.id,
            tabId: tab?.id || null,
            subTabId: tab && !tab.isLeaf && tab.children[0] ? tab.children[0].id : null,
        };
    }
    renderApp();
}

function switchSub(subId) {
    const parts = subId.split('.');
    const mainId = parts[0];
    const sub = findNavNode(subId);
    if (sub?.leaf) {
        _navState = { mode: 'category', utilityId: null, mainId, subId, tabId: null, subTabId: null };
    } else {
        const tabs = getTabGroups(subId);
        const tab = tabs[0];
        _navState = {
            mode: 'category',
            utilityId: null,
            mainId,
            subId,
            tabId: tab?.id || null,
            subTabId: tab && !tab.isLeaf && tab.children[0] ? tab.children[0].id : null,
        };
    }
    renderApp();
}

function switchTab(tabId) {
    const tabs = getTabGroups(_navState.subId);
    const tab = tabs.find((t) => t.id === tabId);
    _navState.tabId = tabId;
    _navState.subTabId = tab && !tab.isLeaf && tab.children[0] ? tab.children[0].id : null;
    renderApp();
}

function switchSubTab(subTabId) {
    _navState.subTabId = subTabId;
    renderApp();
}

function updateContextBar() {
    const bar = document.getElementById('context-bar');
    if (!bar) return;

    if (_appPhase === 'results' && _parseResult) {
        bar.className = 'context-bar';
        bar.innerHTML = `
            <div class="context-meta">
                <div class="context-item">
                    <span class="context-label">File</span>
                    <span class="context-value">${escapeHtml(_parseResult.fileName)}</span>
                </div>
                <div class="context-item">
                    <span class="context-label">Size</span>
                    <span class="context-value">${formatFileSize(_parseResult.fileSize)}</span>
                </div>
                <div class="context-item">
                    <span class="context-label">DSM</span>
                    <span class="context-value">${escapeHtml(getDsmVersionLabel(_parseResult.info))}</span>
                </div>
                <div class="context-item">
                    <span class="context-label">Model</span>
                    <span class="context-value">${escapeHtml(getModelLabel(_parseResult.info))}</span>
                </div>
                <div class="context-item">
                    <span class="context-label">Hostname</span>
                    <span class="context-value">${escapeHtml(_parseResult.hostname)}</span>
                </div>
            </div>
            <div class="context-actions">
                <label class="label-check">
                    <input type="checkbox" ${_showSensitive ? 'checked' : ''} onchange="toggleSensitiveFields(this.checked)">
                    Show sensitive fields
                </label>
                <button type="button" class="btn-ghost" onclick="exportToJSON()">Export JSON</button>
                <button type="button" class="btn-ghost" onclick="exportToCSVZip()">Export CSV</button>
                <button type="button" class="btn" onclick="resetApp()">New file</button>
            </div>
        `;
    } else {
        bar.className = 'context-bar is-hidden';
        bar.innerHTML = '';
    }
}

function toggleSensitiveFields(enabled) {
    if (enabled && !_sensitiveWarningShown) {
        const ok = window.confirm(
            'This backup may contain password hashes and other sensitive data. ' +
            'Only enable this on a trusted device. Continue?'
        );
        if (!ok) {
            renderApp();
            return;
        }
        _sensitiveWarningShown = true;
    }
    _showSensitive = enabled;
    rerenderActiveView();
    updateContextBar();
}

function renderDropZone() {
    return `
        <div class="drop-page"
             ondragover="onDragOver(event)"
             ondragleave="onDragLeave(event)"
             ondrop="onDrop(event)">
            <div class="drop-zone" id="drop-zone" onclick="document.getElementById('file-input').click()">
                <div class="drop-title">Drop your Synology .dss backup here</div>
                <div class="drop-hint">or <span class="link">browse for file</span></div>
                <div class="drop-note">Supported: Synology configuration backup (.dss) — DSM 7+</div>
                <div class="drop-privacy">Processed entirely in your browser. Nothing is uploaded.</div>
            </div>
        </div>
        <input type="file" id="file-input" accept=".dss" hidden onchange="onFileInputChange(event)">
    `;
}

function renderLoadingView() {
    return `
        <div class="loading-page">
            <div class="spinner"></div>
            <div class="drop-title">Parsing backup…</div>
            <div class="muted">Decompressing and reading database — this may take a few seconds.</div>
        </div>
    `;
}

function renderErrorView(message) {
    return `
        <div class="error-page">
            <div class="error-icon">!</div>
            <div class="drop-title">Could not parse backup</div>
            <div class="error-box">${escapeHtml(message)}</div>
            <button type="button" class="btn-primary" onclick="resetApp()">Try another file</button>
        </div>
    `;
}

async function processFile(file) {
    if (!file) return;
    _appPhase = 'loading';
    renderApp();

    try {
        _parseResult = await parseDSSFile(file);
        _appPhase = 'results';
        _navState = getInitialNavState();
        settingsViewState.query = '';
        schedulerViewState.mode = 'table';
    } catch (err) {
        _errorMessage = err.message || String(err);
        _appPhase = 'error';
    }
    renderApp();
}

function resetApp() {
    _appPhase = 'idle';
    _parseResult = null;
    _errorMessage = '';
    _navState = getInitialNavState();
    _showSensitive = false;
    schedulerViewState.mode = 'table';
    renderApp();
}

function setDropZoneActive(active) {
    const zone = document.getElementById('drop-zone');
    if (!zone) return;
    zone.classList.toggle('is-active', active);
}

function onDragOver(event) {
    event.preventDefault();
    event.stopPropagation();
    setDropZoneActive(true);
}

function onDragLeave(event) {
    event.preventDefault();
    if (!event.currentTarget.contains(event.relatedTarget)) setDropZoneActive(false);
}

function onDrop(event) {
    event.preventDefault();
    event.stopPropagation();
    setDropZoneActive(false);
    const file = event.dataTransfer?.files?.[0];
    if (file) processFile(file);
}

function onFileInputChange(event) {
    const file = event.target?.files?.[0];
    if (file) processFile(file);
}

document.addEventListener('DOMContentLoaded', () => {
    renderApp();
});
