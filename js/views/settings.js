/**
 * views/settings.js — searchable config key/value list.
 */

const settingsViewState = {
    query: '',
};

function setSettingsQuery(query) {
    settingsViewState.query = query;
    rerenderSettingsResults();
}

function clearSettingsFilters() {
    settingsViewState.query = '';
    const input = document.getElementById('settings-search');
    if (input) input.value = '';
    rerenderSettingsResults();
}

function filterSettingsRows(config) {
    const q = settingsViewState.query.trim().toLowerCase();
    const rows = [];
    for (const [key, value] of config.entries()) {
        const label = formatConfigKeyLabel(key);
        if (q && !key.toLowerCase().includes(q) && !label.toLowerCase().includes(q)
            && !String(value ?? '').toLowerCase().includes(q)) continue;
        rows.push({ key, value });
    }
    rows.sort((a, b) => a.key.localeCompare(b.key));
    return rows;
}

function renderSettingsResultsBody(result, showSensitive) {
    const rows = filterSettingsRows(result.config);
    const grid = renderConfigKeyValueGrid(rows, showSensitive, 'No settings match your search');
    return renderSection('Configuration keys', grid, rows.length);
}

function rerenderSettingsResults() {
    if (_appPhase !== 'results' || !_parseResult || getActiveNavId() !== 'all-settings') {
        rerenderActiveView();
        return;
    }

    const results = document.getElementById('settings-results');
    if (results) {
        results.innerHTML = renderSettingsResultsBody(_parseResult, _showSensitive);
    }
}

function renderSettingsView(result, showSensitive, options) {
    const title = options?.title || 'All Settings';
    const subtitle = options?.subtitle || 'Search all configuration keys';

    return renderExtractorView(`
        <div class="view-body">
            <div class="settings-toolbar">
                <input type="search" id="settings-search" class="search-input" placeholder="Search keys and values…"
                       value="${escapeHtml(settingsViewState.query)}"
                       oninput="setSettingsQuery(this.value)">
                <button type="button" class="btn-ghost" onclick="clearSettingsFilters()">Clear search</button>
            </div>
            <div id="settings-results">${renderSettingsResultsBody(result, showSensitive)}</div>
        </div>
    `);
}
