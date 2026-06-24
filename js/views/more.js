/**
 * views/more.js — additional tables and notification DB (excluding app privileges).
 */

function renderMoreView(result, showSensitive, options) {
    const title = options?.title || 'Other';
    const subtitle = options?.subtitle || 'Quotas and other tables';
    const routedNotify = getRoutedNotificationTableNames();

    const tableNames = typeof getMoreTableNamesExcludingAppPrivileges === 'function'
        ? getMoreTableNamesExcludingAppPrivileges(Object.keys(result.tables))
        : getMoreTableNames(Object.keys(result.tables));

    const sections = [];

    for (const name of tableNames) {
        const data = result.tables[name];
        const rows = data?.rows || [];
        if (!rows.length) continue;

        const cols = data.columns?.length ? data.columns : Object.keys(rows[0] || {});
        const table = renderDataTable(cols, redactTableRows(rows, showSensitive), showSensitive, 'Empty');

        sections.push(renderDetailsBlock(
            `${escapeHtml(name)} <span class="section-count">${rows.length}</span>`,
            table
        ));
    }

    if (result.notificationDb) {
        for (const [name, data] of Object.entries(result.notificationDb.tables)) {
            if (routedNotify.has(name)) continue;
            const rows = data?.rows || [];
            if (!rows.length) continue;
            const cols = data.columns?.length ? data.columns : Object.keys(rows[0] || {});
            const table = renderDataTable(cols, rows, showSensitive, 'Empty');
            sections.push(renderDetailsBlock(
                `notification / ${escapeHtml(name)} <span class="section-count">${rows.length}</span>`,
                table
            ));
        }
    }

    const body = sections.length ? sections.join('') : `<div class="empty">No additional tables with data in this backup</div>`;

    return renderExtractorView(`
        <div class="view-body">${body}</div>
    `);
}
