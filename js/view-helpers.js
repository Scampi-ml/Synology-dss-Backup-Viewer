/**
 * view-helpers.js — shared HTML utilities and table renderers.
 */

function escapeHtml(str) {
    if (str === null || str === undefined) return '';
    return String(str)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

function formatFileSize(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function looksLikeJson(value) {
    if (typeof value !== 'string') return false;
    const trimmed = value.trim();
    return (trimmed.startsWith('{') && trimmed.endsWith('}'))
        || (trimmed.startsWith('[') && trimmed.endsWith(']'));
}

function formatCellValue(value, showSensitive, column, row) {
    if (column === 'value' && row?.key !== undefined) {
        return renderFormattedConfigValue(row.key, value, showSensitive);
    }
    const display = redactValue(column, value, showSensitive);
    if (display === null || display === undefined || display === '') return '<span class="text-empty">—</span>';
    const text = String(display);
    if (looksLikeJson(text)) {
        try {
            const pretty = JSON.stringify(JSON.parse(text), null, 2);
            return `<details><summary class="link">JSON</summary><pre class="pre-block">${escapeHtml(pretty)}</pre></details>`;
        } catch (_) {}
    }
    if (text.length > 120) {
        return `<details><summary class="link">${escapeHtml(text.slice(0, 80))}…</summary><pre class="pre-block">${escapeHtml(text)}</pre></details>`;
    }
    return escapeHtml(text);
}

function renderFormattedConfigValue(key, value, showSensitive) {
    const display = redactValue(key, value, showSensitive);
    if (display === null || display === undefined || display === '') {
        return '<span class="text-empty">—</span>';
    }
    if (isBoolLikeValue(display)) {
        const yes = isTruthyBool(display);
        return `<span class="bool-mark ${yes ? 'bool-mark--yes' : 'bool-mark--no'}" aria-label="${yes ? 'Yes' : 'No'}">${yes ? '✓' : '✗'}</span>`;
    }
    const text = String(display);
    if (looksLikeJson(text)) {
        try {
            const pretty = JSON.stringify(JSON.parse(text), null, 2);
            return `<details><summary class="link">JSON</summary><pre class="pre-block">${escapeHtml(pretty)}</pre></details>`;
        } catch (_) {}
    }
    if (text.length > 120) {
        return `<details><summary class="link">${escapeHtml(text.slice(0, 80))}…</summary><pre class="pre-block">${escapeHtml(text)}</pre></details>`;
    }
    return escapeHtml(text);
}

function renderConfigKeyValueGrid(rows, showSensitive, emptyMessage) {
    if (!rows.length) {
        return `<div class="empty">${escapeHtml(emptyMessage || 'No data')}</div>`;
    }
    const body = rows.map(({ key, value }) => `
        <div class="kv-row">
            <div class="kv-label">${escapeHtml(formatConfigKeyLabel(key))}</div>
            <div class="kv-value">${renderFormattedConfigValue(key, value, showSensitive)}</div>
        </div>
    `).join('');
    return `<div class="kv-grid">${body}</div>`;
}

function renderDataTable(columns, rows, showSensitive, emptyMessage) {
    if (!rows.length) {
        return `<div class="empty">${escapeHtml(emptyMessage || 'No data')}</div>`;
    }

    const head = columns.map((col) => `<th>${escapeHtml(col)}</th>`).join('');
    const body = rows.map((row) => {
        const cells = columns.map((col) => `<td>${formatCellValue(row[col], showSensitive, col, row)}</td>`).join('');
        return `<tr>${cells}</tr>`;
    }).join('');

    return `
        <div class="table-wrap">
            <table class="data-table">
                <thead><tr>${head}</tr></thead>
                <tbody>${body}</tbody>
            </table>
        </div>
    `;
}

function renderSection(title, content, count) {
    const badge = count !== undefined ? `<span class="section-count">${count}</span>` : '';
    return `
        <section class="section">
            <h3 class="section-title">${escapeHtml(title)}${badge}</h3>
            ${content}
        </section>
    `;
}

function renderKeyValueDisplayValue(value) {
    if (isBoolLikeValue(value) || value === '✓' || value === '✗') {
        const yes = isTruthyBool(value) || value === '✓';
        return `<span class="bool-mark ${yes ? 'bool-mark--yes' : 'bool-mark--no'}" aria-label="${yes ? 'Yes' : 'No'}">${yes ? '✓' : '✗'}</span>`;
    }
    return escapeHtml(value);
}

function renderKeyValueGrid(pairs) {
    if (!pairs.length) return '<div class="empty">No data</div>';
    const rows = pairs.map(([label, value]) => `
        <div class="kv-row">
            <div class="kv-label">${escapeHtml(label)}</div>
            <div class="kv-value">${renderKeyValueDisplayValue(value)}</div>
        </div>
    `).join('');
    return `<div class="kv-grid">${rows}</div>`;
}

function renderKeyValueTable(pairs, showSensitive) {
    if (!pairs.length) return '<div class="empty">No data</div>';
    const sensitive = showSensitive !== false;
    const rows = pairs.map(([key, value]) => {
        const label = formatConfigKeyLabel(key);
        const valueCell = String(value).includes('\n')
            ? `<pre class="pre-block">${escapeHtml(value)}</pre>`
            : renderFormattedConfigValue(key, value, sensitive);
        return `<tr><td class="kv-label">${escapeHtml(label)}</td><td class="kv-value">${valueCell}</td></tr>`;
    }).join('');
    return `
        <div class="table-wrap">
            <table class="data-table"><tbody>${rows}</tbody></table>
        </div>
    `;
}

function renderExtractorView(innerHtml) {
    return `<div class="view-shell">${innerHtml}</div>`;
}

function renderDetailsBlock(summaryHtml, bodyHtml) {
    return `
        <details class="details-block">
            <summary>${summaryHtml}</summary>
            <div>${bodyHtml}</div>
        </details>
    `;
}
