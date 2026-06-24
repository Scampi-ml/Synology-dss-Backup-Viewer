/**
 * hardware-parse.js — system, SNMP, update/SMART, and storage data.
 */

function parseUpdateSettings(raw) {
    if (!raw) return [];
    try {
        const data = JSON.parse(raw);
        const pairs = [];
        if (data.autoupdate_type) pairs.push(['Update type', data.autoupdate_type]);
        if (data.smart_nano_enabled !== undefined) {
            pairs.push(['SMART nano enabled', formatBool(data.smart_nano_enabled)]);
        }
        if (data.schedule) {
            const s = data.schedule;
            const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
            const dayLabel = days[Number(s.week_day)] || s.week_day || '—';
            pairs.push(['Update schedule', `${dayLabel} ${String(s.hour ?? 0).padStart(2, '0')}:${String(s.minute ?? 0).padStart(2, '0')}`]);
        }
        return pairs;
    } catch (_) {
        return [['Raw value', raw]];
    }
}

function extractHardwareData(config, info, tables) {
    const snmpPairs = [
        ['SNMP enabled', formatBool(config.get('SNMP_isEnableSNMP') === '1')],
        ['System name', config.get('SNMP_Nname') || '—'],
        ['Contact', config.get('SNMP_Contact') || '—'],
        ['Location', config.get('SNMP_Location') || '—'],
        ['Community (v1/v2c)', config.get('SNMP_V1V2cRocommunity') || '—'],
    ];

    const systemPairs = [
        ['Model', getModelLabel(info || {})],
        ['Platform ID', info?.unique || '—'],
        ['DSM version', getDsmVersionLabel(info || {})],
        ['Config version', info?.conf_version || '—'],
    ];

    const volumeRows = rowsToObjects(tables?.confbkp_volume_tb);
    const storageSummary = volumeRows.map(v => {
        const fs = FSTYPE_LABELS[Number(v.fstype)] || `type ${v.fstype}`;
        return [v.mount_point || v.location || '—', `${fs} — ${v.location || ''}`];
    });

    const updatePairs = parseUpdateSettings(config.get('UPDATE_setting_v4'));

    return {
        systemPairs,
        snmpPairs,
        updatePairs,
        storageSummary,
        hasData: Boolean(
            systemPairs.length
            || snmpPairs.some(([, v]) => v && v !== '—')
            || updatePairs.length
            || storageSummary.length
        ),
    };
}
