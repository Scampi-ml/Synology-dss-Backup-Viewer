/**
 * views/shares.js
 */

function renderSharesView(result, showSensitive, options) {
    const title = options?.title || 'Shared Folder';
    const subtitle = options?.subtitle || title;
    const shares = rowsToObjects(result.tables.confbkp_share_tb);
    const privileges = rowsToObjects(result.tables.confbkp_share_privilege_id_tb);
    const nfsRules = rowsToObjects(result.tables.confbkp_share_nfs_rule_tb);

    const shareCols = ['share_name', 'path', 'description', 'ShareStatus', 'fType', 'quota'];
    const privCols = ['share_name', 'name', 'user_or_group', 'privilege'];
    const nfsCols = ['share_path', 'host', 'privilege', 'root_squash', 'sync', 'insecure'];

    return renderExtractorView(`
        <div class="view-body">
            ${renderSection('Shared folders', renderDataTable(shareCols, shares, showSensitive, 'No shares'), shares.length)}
            ${renderSection('Share privileges', renderDataTable(privCols, privileges, showSensitive, 'No privileges'), privileges.length)}
            ${renderSection('NFS rules', renderDataTable(nfsCols, nfsRules, showSensitive, 'No NFS rules'), nfsRules.length)}
        </div>
    `);
}
