/**
 * parse-result.js — normalize parsed DSS data and sensitive-field helpers.
 */

const SENSITIVE_COLUMNS = new Set(['passwd', 'LMPW', 'NTPW']);

const FSTYPE_LABELS = {
    0: 'ext3',
    1: 'ext4',
    2: 'ext2',
    3: 'btrfs',
    4: 'hfsplus',
};

function parseConfigInfoText(bytes) {
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    const info = {};
    for (const line of text.split('\n')) {
        const match = line.match(/^(\w+)="([^"]*)"/);
        if (match) info[match[1]] = match[2];
    }
    return info;
}

function rowsToObjects(tableData) {
    if (!tableData) return [];
    return tableData.rows || [];
}

function buildConfigMap(tables) {
    const configTable = tables.confbkp_config_tb;
    const map = new Map();
    if (!configTable) return map;
    for (const row of configTable.rows) {
        if (row.key) map.set(row.key, row.value ?? null);
    }
    return map;
}

function getHostname(config) {
    try {
        const raw = config.get('NETWORK_GENERAL_config');
        if (!raw) return '—';
        const parsed = JSON.parse(raw);
        return parsed?.config?.server_name || '—';
    } catch (_) {
        return '—';
    }
}

function getModelLabel(info) {
    if (!info.unique) return '—';
    return info.unique.replace(/^synology_[^_]+_/, '').toUpperCase();
}

function getDsmVersionLabel(info) {
    if (!info.dsm_majorversion) return '—';
    return `${info.dsm_majorversion}.${info.dsm_minorversion || '0'} (Build ${info.dsm_buildnumber || '?'})`;
}

function decodeSchedulerTasks(rows) {
    const decodeInner = (value) => {
        if (typeof value !== 'string') return '';
        try { return JSON.parse(value.trim()); } catch (_) { return value.trim(); }
    };

    return rows.map(row => {
        let name = '';
        let app = '';
        let state = '';
        try {
            const outer = JSON.parse(row.json_config || '{}');
            name = decodeInner(outer.name);
            app = decodeInner(outer.app);
            state = decodeInner(outer.state);
        } catch (_) {}
        return { id: row.id, name, app, state, raw: row.json_config };
    });
}

function decodeSchedulerFieldValue(value) {
    if (value === null || value === undefined) return '';
    if (typeof value !== 'string') return String(value);

    const trimmed = value.trim();
    if (!trimmed) return '';

    try {
        const inner = JSON.parse(trimmed);
        if (typeof inner === 'object' && inner !== null) {
            return JSON.stringify(inner, null, 2);
        }
        return String(inner);
    } catch (_) {
        return trimmed;
    }
}

function getSchedulerTaskFields(raw) {
    try {
        const outer = JSON.parse(raw || '{}');
        return Object.keys(outer)
            .sort((a, b) => a.localeCompare(b))
            .map(key => [key, decodeSchedulerFieldValue(outer[key])]);
    } catch (_) {
        return [];
    }
}

function expireStatus(expire) {
    const n = Number(expire);
    if (n === -1) return 'Active';
    if (n === 1) return 'Disabled';
    return String(expire ?? '—');
}

function formatBool(value) {
    if (value === true || value === 'true' || value === 'yes' || value === '1') return '✓';
    if (value === false || value === 'false' || value === 'no' || value === '0') return '✗';
    return String(value ?? '—');
}

function isTruthyBool(value) {
    return value === true || value === 'true' || value === 'yes' || value === '1';
}

function isFalsyBool(value) {
    return value === false || value === 'false' || value === 'no' || value === '0';
}

function isBoolLikeValue(value) {
    if (value === true || value === false) return true;
    const s = String(value ?? '').trim().toLowerCase();
    return s === '0' || s === '1' || s === 'yes' || s === 'no' || s === 'true' || s === 'false';
}

const CONFIG_KEY_PREFIXES = [
    'REGION', 'NOTIFY', 'CIFS', 'AFP', 'NFS', 'FTP', 'NETWORK', 'SECURITY',
    'DDNS', 'QUICKCONNECT', 'UPDATE', 'SNMP', 'TERMINAL', 'W3', 'SD', 'AD',
    'LDAP', 'SSOCLIENT', 'NETBKP', 'FIREWALL', 'DOS', 'ACL', 'ADV', 'TC',
    'STATIC', 'MEDIA', 'PORTFORWARD', 'PASSWDSTRENGTH', 'PASSWDEXPIRY', 'HOMESERVICE',
    'PASSWD', 'AUTO', 'TERMINAL', 'DSMLOGINSTYLE',
];

const CONFIG_WORD_ACRONYMS = {
    dns: 'DNS', ip: 'IP', ipv6: 'IPv6', ipv4: 'IPv4', smb: 'SMB', afp: 'AFP',
    nfs: 'NFS', ftp: 'FTP', smtp: 'SMTP', sso: 'SSO', ldap: 'LDAP', dsm: 'DSM',
    ntp: 'NTP', ups: 'UPS', snmp: 'SNMP', http: 'HTTP', https: 'HTTPS',
    upnp: 'UPnP', arp: 'ARP', dhcp: 'DHCP', vpn: 'VPN', acl: 'ACL', tc: 'TC',
    ssdp: 'SSDP', avahi: 'Avahi', cifs: 'CIFS', ad: 'AD', id: 'ID', uuid: 'UUID',
    kmip: 'KMIP', json: 'JSON', csv: 'CSV', url: 'URL', uri: 'URI', api: 'API',
};

function formatConfigWord(word) {
    if (!word) return '';
    const lower = word.toLowerCase();
    if (CONFIG_WORD_ACRONYMS[lower]) return CONFIG_WORD_ACRONYMS[lower];
    if (word.length > 1 && word === word.toUpperCase()) return word;
    return lower.charAt(0).toUpperCase() + lower.slice(1);
}

function splitConfigKeySuffix(suffix) {
    const isEnable = suffix.match(/^is([A-Z][A-Za-z0-9]*)/);
    if (isEnable) {
        const tail = isEnable[1].replace(/([A-Z])/g, ' $1').trim().split(/\s+/);
        return ['Enable', ...tail];
    }
    return suffix.split('_').filter(Boolean);
}

function formatConfigKeyLabel(key) {
    if (!key) return '';

    let remainder = key;
    for (const prefix of CONFIG_KEY_PREFIXES) {
        if (key === prefix) return formatConfigWord(prefix);
        if (key.startsWith(`${prefix}_`)) {
            remainder = key.slice(prefix.length + 1);
            break;
        }
    }

    const words = splitConfigKeySuffix(remainder);
    return words.map(formatConfigWord).join(' ');
}

function isSensitiveColumn(name) {
    return SENSITIVE_COLUMNS.has(name);
}

function redactValue(column, value, showSensitive) {
    if (!isSensitiveColumn(column)) return value;
    if (showSensitive) return value;
    if (value === null || value === undefined || value === '') return value;
    return '••••••••';
}

function redactRow(row, showSensitive) {
    const out = { ...row };
    for (const key of Object.keys(out)) {
        out[key] = redactValue(key, out[key], showSensitive);
    }
    return out;
}

function redactTableRows(rows, showSensitive) {
    return rows.map(row => redactRow(row, showSensitive));
}

function serializeParseResult(result, showSensitive) {
    const configObj = {};
    for (const [key, value] of result.config.entries()) {
        configObj[key] = value;
    }

    const tables = {};
    for (const [name, data] of Object.entries(result.tables)) {
        tables[name] = {
            columns: data.columns,
            rows: redactTableRows(data.rows, showSensitive),
        };
    }

    let notificationDb = null;
    if (result.notificationDb) {
        notificationDb = { tables: {} };
        for (const [name, data] of Object.entries(result.notificationDb.tables)) {
            notificationDb.tables[name] = {
                columns: data.columns,
                rows: redactTableRows(data.rows, showSensitive),
            };
        }
    }

    return {
        fileName: result.fileName,
        fileSize: result.fileSize,
        info: result.info,
        hostname: result.hostname,
        config: configObj,
        tables,
        tlsProfile: result.tlsProfile,
        tlsFiles: result.tlsFiles,
        tarFiles: result.tarFiles,
        notificationDb,
        schedulerTasks: result.schedulerTasks,
    };
}


function getMoreTableNames(allTableNames) {
    const primary = new Set([
        'confbkp_config_tb',
        'confbkp_user_tb',
        'confbkp_group_tb',
        'confbkp_group_member_list_tb',
        'confbkp_share_tb',
        'confbkp_share_privilege_id_tb',
        'confbkp_share_nfs_rule_tb',
        'confbkp_volume_tb',
        'confbkp_scheduler_table',
        'confbkp_auto_config_backup_table',
    ]);
    return allTableNames.filter(name => !primary.has(name));
}
