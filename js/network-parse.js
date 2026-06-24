/**
 * network-parse.js — extract network / NIC / DNS data from DSM config keys.
 */

function parseConfigJsonBlob(config, key) {
    const raw = config.get(key);
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch (_) {
        if (key === 'NETWORK_INTERFACE_config') return parseNetworkInterfaceFallback(raw);
        return null;
    }
}

function parseNetworkInterfaceFallback(raw) {
    const result = {
        BOND: {},
        ETH: {},
        GATEWAY_DATABASE: {},
        DEFAULT_GATEWAY: {},
        PPPOE: {},
        IPV6_ROUTER: {},
    };

    const ethRe = /"(\/etc\/sysconfig\/network-scripts\/ifcfg-[^"]+)"\s*:\s*"([\s\S]*?)"(?=,\s*"\/etc\/sysconfig\/network-scripts\/ifcfg-|\s*\}\s*,\s*"GATEWAY_DATABASE")/g;
    let match;
    while ((match = ethRe.exec(raw)) !== null) {
        result.ETH[match[1]] = unescapeDsmJsonString(match[2]);
    }

    const gwMatch = raw.match(
        /"GATEWAY_DATABASE"\s*:\s*\{[^"]*"([^"]+)"\s*:\s*"([\s\S]*?)"\s*\}\s*,\s*"IPV6_ROUTER"/
    );
    if (gwMatch) {
        result.GATEWAY_DATABASE[gwMatch[1]] = unescapeDsmJsonString(gwMatch[2]);
    }

    const dgMatch = raw.match(
        /"DEFAULT_GATEWAY"\s*:\s*\{[^"]*"([^"]+)"\s*:\s*"([\s\S]*?)"\s*\}\s*,\s*"ETH"/
    );
    if (dgMatch) {
        result.DEFAULT_GATEWAY[dgMatch[1]] = unescapeDsmJsonString(dgMatch[2]);
    }

    return result;
}

function unescapeDsmJsonString(value) {
    return String(value)
        .replace(/\\n/g, '\n')
        .replace(/\\t/g, '\t')
        .replace(/\\"/g, '"')
        .replace(/\\\\/g, '\\');
}

function parseIniStyleFile(text) {
    const result = {};
    if (!text) return result;
    for (const line of text.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eq = trimmed.indexOf('=');
        if (eq === -1) continue;
        const name = trimmed.slice(0, eq).trim();
        const value = trimmed.slice(eq + 1).trim();
        result[name] = value;
    }
    return result;
}

function parseGatewayDatabase(text) {
    const entries = [];
    if (!text) return entries;

    let current = null;
    for (const line of text.split('\n')) {
        const section = line.match(/^\[([^\]]+)\]/);
        if (section) {
            current = { interface: section[1], dns: '', gateway: '', dns_v6: '', gateway_v6: '' };
            entries.push(current);
            continue;
        }
        if (!current) continue;
        const kv = line.match(/^\s*([a-z0-9_]+)\s*=\s*(.*)$/i);
        if (kv) current[kv[1]] = kv[2].trim();
    }
    return entries;
}

function deviceFromIfcfgPath(path) {
    const match = path.match(/ifcfg-([^\s/]+)$/);
    return match ? match[1] : path.split('/').pop() || '—';
}

function parseNetworkInterfaces(interfaceConfig) {
    const interfaces = [];
    if (!interfaceConfig) return interfaces;

    const addFromSection = (sectionName, sectionData) => {
        if (!sectionData || typeof sectionData !== 'object') return;
        for (const [path, content] of Object.entries(sectionData)) {
            if (typeof content !== 'string') continue;
            const parsed = parseIniStyleFile(content);
            interfaces.push({
                section: sectionName,
                device: parsed.DEVICE || deviceFromIfcfgPath(path),
                bootproto: (parsed.BOOTPROTO || '—').toUpperCase(),
                ipaddr: parsed.IPADDR || '',
                netmask: parsed.NETMASK || '',
                gateway: parsed.GATEWAY || '',
                onboot: parsed.ONBOOT || '',
                ipv6init: parsed.IPV6INIT || '',
                config_file: path.replace(/^.*network-scripts\//, ''),
                raw: content.trim(),
            });
        }
    };

    addFromSection('ETH', interfaceConfig.ETH);
    addFromSection('BOND', interfaceConfig.BOND);
    addFromSection('PPPOE', interfaceConfig.PPPOE);

    return interfaces.sort((a, b) => a.device.localeCompare(b.device));
}

function extractNetworkData(config) {
    const generalBlob = parseConfigJsonBlob(config, 'NETWORK_GENERAL_config');
    const interfaceBlob = parseConfigJsonBlob(config, 'NETWORK_INTERFACE_config')
        || parseNetworkInterfaceFallback(config.get('NETWORK_INTERFACE_config') || '');

    const general = generalBlob?.config || {};
    const generalPairs = [
        ['Hostname', general.server_name || '—'],
        ['DNS manual', formatBool(general.dns_manual)],
        ['Use DHCP domain', formatBool(general.use_dhcp_domain)],
        ['IPv4 preferred', formatBool(general.ipv4_first)],
        ['Multi gateway', formatBool(general.multi_gateway)],
        ['IP conflict detection', formatBool(general.enable_ip_conflict_detect)],
        ['ARP ignore', formatBool(general.arp_ignore)],
    ];

    let gatewayText = '';
    if (interfaceBlob?.GATEWAY_DATABASE) {
        const gwEntry = Object.values(interfaceBlob.GATEWAY_DATABASE)[0];
        if (typeof gwEntry === 'string') gatewayText = gwEntry;
    }
    const gateways = parseGatewayDatabase(gatewayText);

    const interfaces = parseNetworkInterfaces(interfaceBlob);

    // Merge gateway/DNS into interface rows when device names match
    const gatewayByIface = new Map(gateways.map(g => [g.interface, g]));
    for (const iface of interfaces) {
        const gw = gatewayByIface.get(iface.device);
        if (gw) {
            iface.dns = gw.dns || '';
            iface.gateway_db = gw.gateway || '';
            iface.dns_v6 = gw.dns_v6 || '';
            iface.gateway_v6 = gw.gateway_v6 || '';
        }
    }

    const related = [];
    const relatedKeys = [
        ['w3_external_host_ip', 'External host IP (DSM)'],
        ['Ad_DNS', 'Active Directory DNS'],
        ['Ad_DC_IP', 'Active Directory DC IP'],
        ['FTP_szExtIP', 'FTP external IP'],
    ];
    for (const [key, label] of relatedKeys) {
        const value = config.get(key);
        if (value) related.push([label, value]);
    }

    const ddnsProvider = config.get('DDNS_provider') || '';
    const ddnsConf = config.get('DDNS_conf') || '';
    const ddnsConfigured = ddnsProvider.trim() && !ddnsProvider.trim().startsWith('#');

    const proxyConf = generalBlob?.proxy_config
        ? Object.values(generalBlob.proxy_config)[0]
        : '';

    return {
        hasData: Boolean(generalBlob || interfaceBlob || related.length),
        generalPairs,
        interfaces,
        gateways,
        related,
        ddns: {
            configured: ddnsConfigured,
            provider: ddnsProvider,
            conf: ddnsConf,
        },
        proxy: parseIniStyleFile(typeof proxyConf === 'string' ? proxyConf : ''),
        defaultGateway: interfaceBlob?.DEFAULT_GATEWAY
            ? Object.values(interfaceBlob.DEFAULT_GATEWAY)[0]
            : '',
    };
}

function hasNetworkConfig(config) {
    return config.has('NETWORK_GENERAL_config')
        || config.has('NETWORK_INTERFACE_config');
}
