/**
 * views/category-settings.js — filtered config key/value table for DSM leaves.
 */

function renderCategorySettingsView(result, showSensitive, title, subtitle, descriptor, navId) {
    const rows = filterConfigEntries(result.config, descriptor);
    const configGrid = renderConfigKeyValueGrid(
        rows,
        showSensitive,
        'No settings found for this section in the backup'
    );

    const notifySections = renderNotificationDbSections(
        result,
        getNotificationTablesForNav(navId),
        showSensitive
    );

    let body = '';
    if (rows.length) {
        body += renderSection('Configuration', configGrid, rows.length);
    }
    body += notifySections;
    if (!body) {
        body = '<div class="empty">No settings found for this section in the backup</div>';
    }

    return renderExtractorView(`
        <div class="view-body">${body}</div>
    `);
}
