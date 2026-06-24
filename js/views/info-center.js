/**
 * views/info-center.js — Info Center sections (General, Network, Storage, Service).
 */

const SERVICE_ENABLE_KEYS = [
    ['SMB', 'CIFS_isEnableWinFileService'],
    ['AFP', 'AFP_isEnableAFP'],
    ['NFS', 'NFS_isEnableNFS'],
    ['FTP', 'FTP_isEnableFTP'],
    ['SFTP', 'FTP_isEnableSFTP'],
    ['rsync', 'NetBKP_isEnableNetBkp'],
    ['SSH', 'Terminal_isEnableSSH'],
    ['Telnet', 'Terminal_isEnableTelnet'],
    ['SNMP', 'SNMP_isEnableSNMP'],
];

function renderInfoCenterView(result, showSensitive, options) {
    const section = options?.section || 'general';
    const title = options?.title || 'Info Center';
    const subtitle = options?.subtitle || title;

    let body = '';

    if (section === 'general') {
        body = renderSection('General', renderKeyValueGrid([
            ['File', result.fileName],
            ['Size', formatFileSize(result.fileSize)],
            ['DSM version', getDsmVersionLabel(result.info)],
            ['Model', getModelLabel(result.info)],
            ['Hostname', result.hostname],
            ['OS', result.info.os_name || '—'],
            ['Config version', result.info.conf_version || '—'],
        ]));
    } else if (section === 'network') {
        const net = extractNetworkData(result.config);
        const pairs = net.generalPairs.length
            ? net.generalPairs
            : [['Hostname', result.hostname]];
        body = renderSection('Network status', renderKeyValueGrid(pairs));
    } else if (section === 'storage') {
        const volumeRows = rowsToObjects(result.tables.confbkp_volume_tb);
        const volumes = volumeRows.map((v) => {
            const fs = FSTYPE_LABELS[Number(v.fstype)] || `type ${v.fstype}`;
            return [v.mount_point || v.location || '—', `${fs} — ${v.location || ''}`];
        });
        body = renderSection(
            'Storage',
            renderKeyValueGrid(volumes.length ? volumes : [['—', 'No volumes']]),
            volumeRows.length
        );
    } else if (section === 'service') {
        const pairs = SERVICE_ENABLE_KEYS.map(([label, key]) => {
            const raw = result.config.get(key);
            return [label, raw === undefined ? '—' : formatBool(raw === '1' || raw === 'yes' || raw === true)];
        });
        body = renderSection('Enabled services', renderKeyValueGrid(pairs));
    }

    return renderExtractorView(`
        <div class="view-body">${body}</div>
    `);
}
