/**
 * views/network.js — network sections (General, Interface, etc.).
 */

function renderNetworkView(result, showSensitive, options) {
    const section = options?.section;
    const title = options?.title || 'Network';
    const subtitle = options?.subtitle || title;
    const data = extractNetworkData(result.config);

    if (!data.hasData && section !== 'general') {
        return renderExtractorView(`
            <div class="view-body"><div class="empty">No network configuration found in backup.</div></div>
        `);
    }

    const interfaceCols = [
        'device', 'bootproto', 'ipaddr', 'netmask', 'gateway', 'dns',
        'gateway_db', 'dns_v6', 'gateway_v6', 'onboot', 'ipv6init',
    ];
    const interfaceRows = data.interfaces.map((iface) => ({
        ...iface,
        ipaddr: iface.ipaddr || '—',
        netmask: iface.netmask || '—',
        gateway: iface.gateway || '—',
        dns: iface.dns || '—',
        gateway_db: iface.gateway_db || '—',
        dns_v6: iface.dns_v6 || '—',
        gateway_v6: iface.gateway_v6 || '—',
    }));

    const gatewayCols = ['interface', 'dns', 'gateway', 'dns_v6', 'gateway_v6'];
    const gatewayRows = data.gateways.map((g) => ({
        interface: g.interface,
        dns: g.dns || '—',
        gateway: g.gateway || '—',
        dns_v6: g.dns_v6 || '—',
        gateway_v6: g.gateway_v6 || '—',
    }));

    const interfaceDetails = data.interfaces.map((iface) => renderDetailsBlock(
        `${escapeHtml(iface.device)} — ${escapeHtml(iface.bootproto)}`,
        renderKeyValueTable(Object.entries(parseIniStyleFile(iface.raw)).map(([k, v]) => [k, v]))
    )).join('');

    let body = '';

    if (!section || section === 'general') {
        body += renderSection('General', renderKeyValueGrid(data.generalPairs));
        if (!section) {
            const proxyPairs = Object.entries(data.proxy)
                .filter(([, value]) => value !== '')
                .map(([key, value]) => [key, value]);
            if (proxyPairs.length) body += renderSection('Proxy', renderKeyValueGrid(proxyPairs));
            if (data.related.length) body += renderSection('Related settings', renderKeyValueGrid(data.related));
        }
    }

    if (!section || section === 'interface') {
        if (interfaceRows.length) {
            body += renderSection(
                'Interfaces',
                renderDataTable(interfaceCols, interfaceRows, showSensitive, 'No interfaces'),
                interfaceRows.length
            );
        }
        if (gatewayRows.length) {
            body += renderSection(
                'Gateway & DNS (per interface)',
                renderDataTable(gatewayCols, gatewayRows, showSensitive, 'No gateway data'),
                gatewayRows.length
            );
        }
        if (interfaceDetails) {
            body += renderSection('Interface config files', interfaceDetails);
        }
    }

    if (!body) body = `<div class="empty">No network data for this section.</div>`;

    return renderExtractorView(`
        <div class="view-body">${body}</div>
    `);
}
