/**
 * views/tls.js
 */

function renderTlsView(result, showSensitive, options) {
    const title = options?.title || 'Certificate';
    const subtitle = options?.subtitle || 'SSL/TLS certificates and service levels';
    const profileJson = result.tlsProfile
        ? `<pre class="pre-block">${escapeHtml(JSON.stringify(result.tlsProfile, null, 2))}</pre>`
        : `<div class="empty">No TLS profile datastore in backup</div>`;

    const fileEntries = Object.entries(result.tlsFiles || {});
    const filesHtml = fileEntries.length
        ? fileEntries.map(([path, content]) => renderDetailsBlock(
            escapeHtml(path.replace(/^ConfigBkp\/tls_profile\//, '')),
            `<pre class="pre-block">${escapeHtml(content)}</pre>`
        )).join('')
        : `<div class="empty">No additional TLS config files</div>`;

    return renderExtractorView(`
        <div class="view-body">
            ${renderSection('datastore.json', profileJson)}
            ${renderSection('Service config files', filesHtml, fileEntries.length)}
        </div>
    `);
}
