/**
 * export.js — JSON and CSV ZIP export.
 */

function downloadBlob(filename, blob) {
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
}

function rowsToCsv(columns, rows) {
    const esc = (value) => {
        const text = value === null || value === undefined ? '' : String(value);
        if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
        return text;
    };
    const lines = [columns.map(esc).join(',')];
    for (const row of rows) {
        lines.push(columns.map(col => esc(row[col])).join(','));
    }
    return lines.join('\r\n');
}

function exportToJSON() {
    if (!_parseResult) return;
    const payload = serializeParseResult(_parseResult, _showSensitive);
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const base = _parseResult.fileName.replace(/\.dss$/i, '') || 'backup';
    downloadBlob(`${base}-extract.json`, blob);
}

function exportToCSVZip() {
    if (!_parseResult || typeof fflate === 'undefined') return;
    const data = serializeParseResult(_parseResult, _showSensitive);
    const files = {};

    const addTable = (name, tableData) => {
        if (!tableData?.rows?.length) return;
        const cols = tableData.columns?.length ? tableData.columns : Object.keys(tableData.rows[0]);
        files[`${name}.csv`] = new TextEncoder().encode(rowsToCsv(cols, tableData.rows));
    };

    addTable('settings', {
        columns: ['key', 'value'],
        rows: Object.entries(data.config).map(([key, value]) => ({ key, value })),
    });

    for (const [tableName, tableData] of Object.entries(data.tables)) {
        addTable(tableName.replace(/^confbkp_/, ''), tableData);
    }

    if (data.notificationDb) {
        for (const [tableName, tableData] of Object.entries(data.notificationDb.tables)) {
            addTable(`notification_${tableName}`, tableData);
        }
    }

    if (data.schedulerTasks?.length) {
        files['scheduler_tasks.csv'] = new TextEncoder().encode(
            rowsToCsv(['id', 'name', 'app', 'state'], data.schedulerTasks)
        );
    }

    if (_parseResult?.config) {
        const net = extractNetworkData(_parseResult.config);
        if (net.interfaces.length) {
            files['network_interfaces.csv'] = new TextEncoder().encode(
                rowsToCsv(
                    ['device', 'bootproto', 'ipaddr', 'netmask', 'gateway', 'dns', 'gateway_db', 'dns_v6', 'gateway_v6', 'onboot', 'ipv6init'],
                    net.interfaces
                )
            );
        }
        if (net.gateways.length) {
            files['network_gateways.csv'] = new TextEncoder().encode(
                rowsToCsv(['interface', 'dns', 'gateway', 'dns_v6', 'gateway_v6'], net.gateways)
            );
        }
    }

    if (data.tlsProfile) {
        files['tls_profile.json'] = new TextEncoder().encode(JSON.stringify(data.tlsProfile, null, 2));
    }

    for (const [path, content] of Object.entries(data.tarFiles || {})) {
        const name = path.replace(/^ConfigBkp\//, '').replace(/[\\/]/g, '_');
        files[`tar_${name}`] = new TextEncoder().encode(content);
    }

    for (const [path, content] of Object.entries(data.tlsFiles || {})) {
        const name = path.replace(/^ConfigBkp\/tls_profile\//, '').replace(/[\\/]/g, '_');
        files[`tls_${name}`] = new TextEncoder().encode(content);
    }

    const zipped = fflate.zipSync(files, { level: 6 });
    const base = _parseResult.fileName.replace(/\.dss$/i, '') || 'backup';
    downloadBlob(`${base}-extract.zip`, new Blob([zipped], { type: 'application/zip' }));
}
