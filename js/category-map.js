/**
 * category-map.js — nav ID → content descriptors and unmapped key helpers.
 */

const SD_UPNP_KEYS = [
    'SD_isEnableSSDP',
    'SD_isEnableAvahi',
];

const SD_FILE_SERVICES_ADVANCED_KEYS = [
    'SD_isEnableAFPTimeMachine',
    'SD_isEnableAvahi',
    'SD_isEnableSMBTimeMachine',
    'SD_isEnableSSDP',
    'SD_isEnableWSTransfer',
    'S2S_share_table',
    'S2S_task_table',
];

const NOTIFY_EMAIL_KEYS = [
    'NOTIFY_mailfrom',
    'NOTIFY_mails',
    'NOTIFY_sendnewusermail',
    'NOTIFY_smtp_mail_enabled',
    'NOTIFY_smtpconf',
    'NOTIFY_sms_enable',
    'NOTIFY_sms_phone1_prefix',
    'NOTIFY_sms_phone2_prefix',
    'NOTIFY_smsconf',
];

const NOTIFY_PUSH_KEYS = [
    'NOTIFY_pushservice_mail_account',
    'NOTIFY_pushservice_mail_enabled',
    'NOTIFY_pushservice_mobile_enabled',
    'NOTIFY_pushservice_sending_interval',
];

const NOTIFY_WEBHOOK_KEYS = [
    'NOTIFY_notify_http_url',
    'NOTIFY_webhookconf',
];

const W3_LOGIN_DSM_PREFIXES = ['w3_admin', 'DSMLOGINSTYLE'];
const W3_LOGIN_DSM_KEYS = ['w3_secure_admin_port'];

const W3_LOGIN_ADVANCED_KEYS = [
    'w3_redirectHTTPS',
    'w3_rproxy',
    'w3_https_compress',
    'w3_reuse_port',
    'w3_runsyshsts',
];

const W3_EXTERNAL_ADVANCED_KEYS = [
    'w3_external_host_ip',
    'w3_external_port_dsm_http',
    'w3_external_port_dsm_https',
];

const W3_NETWORK_CONNECTIVITY_KEYS = [
    'w3_runHTTP2',
    'w3_max_connections',
    'w3_server_header',
];

const APP_PRIVILEGE_TABLE_PATTERNS = [/privilege/i, /quota/i, /app_/i];

/** Notification SQLite tables routed from Other → System › Notification */
const NOTIFICATION_DB_TABLE_ROUTES = {
    tag: 'system.notification.events',
    target: 'system.notification.email',
    template_rule: 'system.notification.rules',
    profile_v2: 'system.notification.email',
    sqlite_sequence: 'system.notification.email',
    template: 'system.notification.rules',
};

function getRoutedNotificationTableNames() {
    return new Set(Object.keys(NOTIFICATION_DB_TABLE_ROUTES));
}

function getNotificationTablesForNav(navId) {
    return Object.entries(NOTIFICATION_DB_TABLE_ROUTES)
        .filter(([, routeNavId]) => routeNavId === navId)
        .map(([tableName]) => tableName);
}

function renderNotificationDbSections(result, tableNames, showSensitive) {
    if (!result.notificationDb || !tableNames.length) return '';

    return tableNames.map((name) => {
        const data = result.notificationDb.tables[name];
        const rows = data?.rows || [];
        if (!rows.length) return '';
        const cols = data.columns?.length ? data.columns : Object.keys(rows[0] || {});
        const table = renderDataTable(cols, rows, showSensitive, 'Empty');
        return renderSection(name, table, rows.length);
    }).filter(Boolean).join('');
}

const NAV_CONTENT_MAP = {
    'file-sharing.shared-folder': { type: 'view', view: 'shares' },
    'file-sharing.file-services.smb': { type: 'settings', prefixes: ['CIFS'] },
    'file-sharing.file-services.afp': { type: 'settings', prefixes: ['AFP'] },
    'file-sharing.file-services.nfs': { type: 'settings', prefixes: ['NFS'] },
    'file-sharing.file-services.ftp': { type: 'settings', prefixes: ['FTP'] },
    'file-sharing.file-services.rsync': { type: 'settings', prefixes: ['NetBKP'] },
    'file-sharing.file-services.advanced': { type: 'settings', keys: SD_FILE_SERVICES_ADVANCED_KEYS },
    'file-sharing.user-and-group.user': { type: 'users', section: 'user' },
    'file-sharing.user-and-group.group': { type: 'users', section: 'group' },
    'file-sharing.user-and-group.advanced': { type: 'settings', prefixes: ['Passwdstrength', 'Passwdexpiry', 'Homeservice'] },
    'file-sharing.domain-ldap.domain-ldap': { type: 'settings', prefixes: ['LDAP', 'Ad'] },
    'file-sharing.domain-ldap.sso-client': { type: 'settings', prefixes: ['SSOCLIENT'] },

    'connectivity.external-access.quickconnect': { type: 'settings', prefixes: ['QUICKCONNECT'] },
    'connectivity.external-access.ddns': { type: 'settings', prefixes: ['DDNS'] },
    'connectivity.external-access.router-configuration.upnp': { type: 'settings', keys: SD_UPNP_KEYS },
    'connectivity.external-access.router-configuration.port-forwarding': { type: 'settings', prefixes: ['PORTFORWARD'] },
    'connectivity.external-access.advanced': { type: 'settings', keys: W3_EXTERNAL_ADVANCED_KEYS },
    'connectivity.network.general': { type: 'network', section: 'general', keys: ['NETWORK_GENERAL_config'] },
    'connectivity.network.network-interface': { type: 'network', section: 'interface', keys: ['NETWORK_INTERFACE_config'] },
    'connectivity.network.traffic-control': { type: 'settings', prefixes: ['TC'] },
    'connectivity.network.static-route': { type: 'settings', prefixes: ['STATIC'] },
    'connectivity.network.connectivity': { type: 'settings', keys: W3_NETWORK_CONNECTIVITY_KEYS },
    'connectivity.security.security.security': { type: 'settings', prefixes: ['SECURITY'] },
    'connectivity.security.security.account': { type: 'settings', prefixes: ['AutoBlock', 'lock', 'retain'] },
    'connectivity.security.security.firewall': { type: 'settings', prefixes: ['FIREWALL'] },
    'connectivity.security.security.protection': { type: 'settings', prefixes: ['DOS'] },
    'connectivity.security.security.certificate': { type: 'view', view: 'tls' },
    'connectivity.security.security.advanced': { type: 'settings', prefixes: ['ACL', 'ADV'] },
    'connectivity.security.security.kmip': { type: 'placeholder' },
    'connectivity.terminal-and-snmp.terminal': { type: 'settings', prefixes: ['Terminal'] },
    'connectivity.terminal-and-snmp.snmp': { type: 'settings', prefixes: ['SNMP'] },

    'system.info-center.general': { type: 'info-center', section: 'general' },
    'system.info-center.network': { type: 'info-center', section: 'network' },
    'system.info-center.storage': { type: 'info-center', section: 'storage' },
    'system.info-center.service': { type: 'info-center', section: 'service' },
    'system.info-center.device-analytics': { type: 'placeholder' },
    'system.login-portal.dsm': { type: 'settings', prefixes: W3_LOGIN_DSM_PREFIXES, keys: W3_LOGIN_DSM_KEYS },
    'system.login-portal.applications': { type: 'settings', keys: ['w3_acl_profile'] },
    'system.login-portal.advanced': { type: 'settings', keys: W3_LOGIN_ADVANCED_KEYS },
    'system.regional-options.time': { type: 'settings', keys: ['REGION_timezone', 'REGION_date_time_format'] },
    'system.regional-options.language': { type: 'settings', prefixPatterns: [/^REGION_lang_/] },
    'system.regional-options.ntp-service': { type: 'settings', prefixPatterns: [/^REGION_ntp_/] },
    'system.notification.email': { type: 'settings', keys: NOTIFY_EMAIL_KEYS },
    'system.notification.push-service': { type: 'settings', keys: NOTIFY_PUSH_KEYS },
    'system.notification.webhooks': { type: 'settings', keys: NOTIFY_WEBHOOK_KEYS },
    'system.notification.rules': { type: 'settings', prefixes: ['NOTIFY'], excludeKeys: ['NOTIFY_filter'] },
    'system.notification.events': { type: 'notify-events' },
    'system.hardware-and-power.general': { type: 'hardware', section: 'general' },
    'system.hardware-and-power.power-schedule': { type: 'placeholder' },
    'system.hardware-and-power.drive-hibernation': { type: 'placeholder' },
    'system.hardware-and-power.ups': { type: 'placeholder' },
    'system.external-devices.external-devices': { type: 'placeholder' },
    'system.external-devices.printer': { type: 'settings', keys: ['SD_isEnableBonjourPrinter'] },
    'system.update-and-restore.dsm-update': { type: 'settings', prefixes: ['UPDATE'] },
    'system.update-and-restore.configuration-backup': { type: 'table', tables: ['confbkp_auto_config_backup_table'] },
    'system.update-and-restore.reset-options': { type: 'placeholder' },

    'services.synology-account': { type: 'placeholder' },
    'services.application-privileges': { type: 'app-privileges' },
    'services.indexing-service.media-indexing': { type: 'settings', prefixes: ['MEDIA'] },
    'services.task-scheduler': { type: 'view', view: 'scheduler' },

    'all-settings': { type: 'view', view: 'settings' },
    other: { type: 'view', view: 'more' },
    credits: { type: 'view', view: 'credits' },
};

function keyMatchesPrefix(key, prefix) {
    return key === prefix || key.startsWith(`${prefix}_`);
}

function collectMappedKeySet() {
    const mapped = new Set();

    const addPrefix = (prefix) => {
        mapped.add(`prefix:${prefix}`);
    };
    const addKey = (key) => {
        mapped.add(`key:${key}`);
    };
    const addPattern = (pattern) => {
        mapped.add(`pattern:${pattern}`);
    };

    for (const descriptor of Object.values(NAV_CONTENT_MAP)) {
        if (descriptor.type === 'placeholder' || descriptor.type === 'view') {
            continue;
        }
        for (const prefix of descriptor.prefixes || []) addPrefix(prefix);
        for (const key of descriptor.keys || []) addKey(key);
        for (const pattern of descriptor.prefixPatterns || []) addPattern(pattern.source);
    }

    addKey('NOTIFY_filter');
    for (const key of SD_FILE_SERVICES_ADVANCED_KEYS) addKey(key);
    for (const key of SD_UPNP_KEYS) addKey(key);

    return mapped;
}

const _mappedKeySet = collectMappedKeySet();

function isKeyMapped(key) {
    for (const entry of _mappedKeySet) {
        if (entry.startsWith('prefix:')) {
            const prefix = entry.slice(7);
            if (keyMatchesPrefix(key, prefix)) return true;
        } else if (entry.startsWith('key:')) {
            if (key === entry.slice(4)) return true;
        } else if (entry.startsWith('pattern:')) {
            const re = new RegExp(entry.slice(8));
            if (re.test(key)) return true;
        }
    }
    return false;
}

function getUnmappedConfigEntries(config) {
    const rows = [];
    for (const [key, value] of config.entries()) {
        if (!isKeyMapped(key)) {
            rows.push({ key, value });
        }
    }
    rows.sort((a, b) => a.key.localeCompare(b.key));
    return rows;
}

function filterConfigEntries(config, descriptor) {
    const rows = [];
    const exclude = new Set(descriptor.excludeKeys || []);

    for (const [key, value] of config.entries()) {
        if (exclude.has(key)) continue;

        let match = false;
        for (const prefix of descriptor.prefixes || []) {
            if (keyMatchesPrefix(key, prefix)) match = true;
        }
        for (const exactKey of descriptor.keys || []) {
            if (key === exactKey) match = true;
        }
        for (const pattern of descriptor.prefixPatterns || []) {
            if (pattern.test(key)) match = true;
        }

        if (match) rows.push({ key, value });
    }

    rows.sort((a, b) => a.key.localeCompare(b.key));
    return rows;
}

function parseNotifyFilterEvents(raw) {
    if (!raw) return [];
    const events = [];
    const re = /([A-Za-z0-9_]+)="([^"]*)"/g;
    let match;
    while ((match = re.exec(raw)) !== null) {
        events.push({ name: match[1], channels: match[2] });
    }
    return events.sort((a, b) => a.name.localeCompare(b.name));
}

function getAppPrivilegeTableNames(allTableNames) {
    const moreNames = getMoreTableNames(allTableNames);
    return moreNames.filter((name) => APP_PRIVILEGE_TABLE_PATTERNS.some((re) => re.test(name)));
}

function getMoreTableNamesExcludingAppPrivileges(allTableNames) {
    const privilegeNames = new Set(getAppPrivilegeTableNames(allTableNames));
    return getMoreTableNames(allTableNames).filter((name) => !privilegeNames.has(name));
}

function getNavDescriptor(navId) {
    return NAV_CONTENT_MAP[navId] || null;
}

function renderNavContent(navId, result, showSensitive) {
    const navItem = getNavItemById(navId) || UTILITY_NAV.find((item) => item.id === navId);
    const title = navItem?.label || navId;
    const subtitle = navItem?.breadcrumb || title;
    const descriptor = getNavDescriptor(navId);

    if (!descriptor) {
        return renderPlaceholderView(title, subtitle, 'No content mapping for this section.');
    }

    switch (descriptor.type) {
        case 'view':
            return VIEW_RENDERERS[descriptor.view](result, showSensitive, { title, subtitle });
        case 'settings':
            return renderCategorySettingsView(result, showSensitive, title, subtitle, descriptor, navId);
        case 'network':
            return renderNetworkView(result, showSensitive, { title, subtitle, section: descriptor.section });
        case 'users':
            return renderUsersGroupsView(result, showSensitive, { title, subtitle, section: descriptor.section });
        case 'hardware':
            return renderHardwareView(result, showSensitive, { title, subtitle, section: descriptor.section });
        case 'info-center':
            return renderInfoCenterView(result, showSensitive, { title, subtitle, section: descriptor.section });
        case 'table':
            return renderCategoryTableView(result, showSensitive, title, subtitle, descriptor.tables);
        case 'notify-events':
            return renderNotifyEventsView(result, showSensitive, title, subtitle, navId);
        case 'app-privileges':
            return renderAppPrivilegesView(result, showSensitive, title, subtitle);
        case 'placeholder':
            return renderPlaceholderView(title, subtitle);
        default:
            return renderPlaceholderView(title, subtitle, 'Unsupported section type.');
    }
}

const VIEW_RENDERERS = {
    shares: renderSharesView,
    scheduler: renderSchedulerView,
    tls: renderTlsView,
    settings: renderSettingsView,
    more: renderMoreView,
    credits: renderCreditsView,
};

function renderPlaceholderView(title, subtitle, message) {
    return renderExtractorView(`
        <div class="view-body">
            <div class="empty">${escapeHtml(message || 'No data available for this section in the backup.')}</div>
        </div>
    `);
}

function renderCategoryTableView(result, showSensitive, title, subtitle, tableNames) {
    const sections = (tableNames || []).map((tableName) => {
        const data = result.tables[tableName];
        const rows = rowsToObjects(data);
        const cols = data?.columns?.length ? data.columns : Object.keys(rows[0] || {});
        const table = renderDataTable(cols, redactTableRows(rows, showSensitive), showSensitive, 'No data');
        return renderSection(tableName.replace(/^confbkp_/, '').replace(/_tb$/, ''), table, rows.length);
    }).join('');

    return renderExtractorView(`
        <div class="view-body">${sections || `<div class="empty">No data</div>`}</div>
    `);
}

function renderNotifyEventsView(result, showSensitive, title, subtitle, navId) {
    const raw = result.config.get('NOTIFY_filter') || '';
    const events = parseNotifyFilterEvents(raw);
    const eventsTable = events.length
        ? renderDataTable(['name', 'channels'], events, showSensitive, 'No notification events')
        : '<div class="empty">No notification events in backup</div>';

    const dbSections = renderNotificationDbSections(result, getNotificationTablesForNav(navId), showSensitive);
    const body = renderSection('Notification events', eventsTable, events.length) + dbSections;

    return renderExtractorView(`
        <div class="view-body">${body || '<div class="empty">No notification data in backup</div>'}</div>
    `);
}

function renderAppPrivilegesView(result, showSensitive, title, subtitle) {
    const tableNames = getAppPrivilegeTableNames(Object.keys(result.tables));
    if (!tableNames.length) {
        return renderPlaceholderView(title, subtitle, 'No application privilege tables in this backup.');
    }
    return renderCategoryTableView(result, showSensitive, title, subtitle, tableNames);
}
