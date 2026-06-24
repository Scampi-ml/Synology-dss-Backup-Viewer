/**
 * dss-pipeline.js — parse a Synology .dss backup (XZ → TAR → SQLite).
 */

async function decompressXz(bytes) {
    const XzStream = window['xz-decompress']?.XzReadableStream;
    if (!XzStream) throw new Error('XZ decompressor not loaded');

    const input = new ReadableStream({
        start(controller) {
            controller.enqueue(bytes);
            controller.close();
        },
    });

    const reader = new XzStream(input).getReader();
    const parts = [];
    while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        parts.push(value);
    }

    const total = parts.reduce((sum, part) => sum + part.length, 0);
    const out = new Uint8Array(total);
    let offset = 0;
    for (const part of parts) {
        out.set(part, offset);
        offset += part.length;
    }
    return out;
}

function decodeTextFile(bytes) {
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes);
}

function findTarEntry(entries, suffix) {
    return entries.find(entry => entry.name.endsWith(suffix) || entry.name.includes(suffix));
}

async function parseDSSFile(file) {
    const buffer = await file.arrayBuffer();
    const compressed = new Uint8Array(buffer);

    let tarBytes;
    try {
        tarBytes = await decompressXz(compressed);
    } catch (err) {
        throw new Error(`Failed to decompress backup: ${err.message}`);
    }

    const entries = parseTarArchive(tarBytes);
    const dbEntry = findTarEntry(entries, '_Syno_ConfBkp.db');
    if (!dbEntry) throw new Error('No configuration database found in backup');

    const infoEntry = findTarEntry(entries, 'config_info');
    const info = infoEntry ? parseConfigInfoText(infoEntry.data) : {};

    const mainTables = readAllSqliteTables(dbEntry.data);
    const config = buildConfigMap(mainTables);

    let tlsProfile = null;
    const tlsJsonEntry = findTarEntry(entries, 'tls_profile/datastore.json');
    if (tlsJsonEntry) {
        try {
            tlsProfile = JSON.parse(decodeTextFile(tlsJsonEntry.data));
        } catch (_) {}
    }

    const tlsFiles = {};
    for (const entry of entries) {
        if (entry.name.startsWith('ConfigBkp/tls_profile/') && !entry.name.endsWith('datastore.json')) {
            tlsFiles[entry.name] = decodeTextFile(entry.data);
        }
    }

    const tarFiles = {};
    for (const entry of entries) {
        if (entry.name.endsWith('.info') || entry.name.endsWith('.conf') || entry.name.endsWith('config_info')) {
            if (!entry.name.includes('tls_profile/')) {
                tarFiles[entry.name] = decodeTextFile(entry.data);
            }
        }
    }
    if (infoEntry) tarFiles['ConfigBkp/config_info'] = decodeTextFile(infoEntry.data);

    let notificationDb = null;
    const notifEntry = findTarEntry(entries, '_Syno_FilterSettings_v2.db');
    if (notifEntry) {
        notificationDb = { tables: readAllSqliteTables(notifEntry.data) };
    }

    const schedulerRows = rowsToObjects(mainTables.confbkp_scheduler_table);
    const schedulerTasks = decodeSchedulerTasks(schedulerRows);

    return {
        fileName: file.name,
        fileSize: file.size,
        info,
        hostname: getHostname(config),
        config,
        tables: mainTables,
        tlsProfile,
        tlsFiles,
        tarFiles,
        notificationDb,
        schedulerTasks,
    };
}
