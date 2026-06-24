/**
 * sqlite-reader.js — minimal SQLite 3 table reader (no WASM, works on file://).
 */

function sqliteReadU16(bytes, offset) {
    return (bytes[offset] << 8) | bytes[offset + 1];
}

function sqliteReadU32(bytes, offset) {
    return (((bytes[offset] << 24) | (bytes[offset + 1] << 16) |
        (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0);
}

function sqliteReadVarint(bytes, offset) {
    let value = 0;
    let length = 0;
    for (let i = 0; i < 9; i++) {
        const byte = bytes[offset + i];
        length++;
        if (i < 8) {
            value = value * 128 + (byte & 0x7f);
            if (!(byte & 0x80)) break;
        } else {
            value = value * 256 + byte;
        }
    }
    return { value, length };
}

function sqliteUsablePageSize(bytes, pageSize) {
    return pageSize - (bytes[20] || 0);
}

function sqliteReadOverflowChain(bytes, pageSize, firstPage, byteCount) {
    const chunks = [];
    let remaining = byteCount;
    let pageNum = firstPage;

    while (pageNum > 0 && remaining > 0) {
        const pageOffset = (pageNum - 1) * pageSize;
        const nextPage = sqliteReadU32(bytes, pageOffset);
        const dataSize = Math.min(remaining, pageSize - 4);
        chunks.push(bytes.slice(pageOffset + 4, pageOffset + 4 + dataSize));
        remaining -= dataSize;
        pageNum = nextPage;
    }

    const total = byteCount - remaining;
    const result = new Uint8Array(total);
    let offset = 0;
    for (const chunk of chunks) {
        result.set(chunk, offset);
        offset += chunk.length;
    }
    return result;
}

function sqliteMaxLocalPayload(bytes, pageSize) {
    const usable = sqliteUsablePageSize(bytes, pageSize);
    // Schema format 4+ table leaf cells (Synology DSM backups use this layout).
    if (usable >= 65536) return usable - 35;
    const headerMaxFrac = bytes[21] || 64;
    if (headerMaxFrac === 64) return usable - 35;
    return Math.floor(((usable - 12) * 64) / 255) - 23;
}

function sqliteReadCellPayload(bytes, pageSize, payloadStart, payloadLen) {
    const maxLocal = sqliteMaxLocalPayload(bytes, pageSize);

    if (payloadLen <= maxLocal) {
        return bytes.slice(payloadStart, payloadStart + payloadLen);
    }

    const localSize = maxLocal - 4;
    const local = bytes.slice(payloadStart, payloadStart + localSize);
    const overflowPage = sqliteReadU32(bytes, payloadStart + localSize);
    const overflow = sqliteReadOverflowChain(bytes, pageSize, overflowPage, payloadLen - localSize);
    const full = new Uint8Array(payloadLen);
    full.set(local, 0);
    full.set(overflow, localSize);
    return full;
}

function sqliteDecodeRecord(payload) {
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let pos = 0;
    const headerSizeInfo = sqliteReadVarint(payload, pos);
    const headerSize = headerSizeInfo.value;
    pos += headerSizeInfo.length;

    const serialTypes = [];
    while (pos < headerSize) {
        const serial = sqliteReadVarint(payload, pos);
        serialTypes.push(serial.value);
        pos += serial.length;
    }

    pos = headerSize;
    const values = [];

    for (const serialType of serialTypes) {
        if (pos > payload.length) {
            values.push(null);
            continue;
        }

        if (serialType === 0) values.push(null);
        else if (serialType === 1) { values.push(payload[pos]); pos += 1; }
        else if (serialType === 2) { values.push((payload[pos] << 8) | payload[pos + 1]); pos += 2; }
        else if (serialType === 3) {
            values.push((payload[pos] << 16) | (payload[pos + 1] << 8) | payload[pos + 2]);
            pos += 3;
        }
        else if (serialType === 4) { values.push(sqliteReadU32(payload, pos)); pos += 4; }
        else if (serialType === 5) {
            let num = 0;
            for (let i = 0; i < 6; i++) num = num * 256 + payload[pos + i];
            values.push(num);
            pos += 6;
        }
        else if (serialType === 6 || serialType === 7) { values.push(null); pos += 8; }
        else if (serialType === 127) {
            let len = 0;
            for (let i = 0; i < 8; i++) len = len * 256 + payload[pos + i];
            pos += 8;
            values.push(decoder.decode(payload.slice(pos, pos + len)));
            pos += len;
        } else if (serialType === 8) values.push(0);
        else if (serialType === 9) values.push(1);
        else if (serialType >= 12 && serialType % 2 === 0) {
            const len = (serialType - 12) / 2;
            values.push(payload.slice(pos, pos + len));
            pos += len;
        }
        else if (serialType >= 13 && serialType % 2 === 1) {
            const len = (serialType - 13) / 2;
            values.push(decoder.decode(payload.slice(pos, pos + len)));
            pos += len;
        } else {
            values.push(null);
        }
    }

    return values;
}

function sqliteScanLeafAndInterior(bytes, pageNum, pageSize) {
    const results = [];
    const pageOffset = (pageNum - 1) * pageSize;
    const headerOffset = pageNum === 1 ? pageOffset + 100 : pageOffset;
    const pageType = bytes[headerOffset];
    const cellCount = sqliteReadU16(bytes, headerOffset + 3);

    if (pageType === 0x0d) {
        const cellPtrBase = headerOffset + 8;
        for (let i = 0; i < cellCount; i++) {
            const cellPtr = sqliteReadU16(bytes, cellPtrBase + i * 2);
            let cellOffset = pageOffset + cellPtr;
            const payloadLenV = sqliteReadVarint(bytes, cellOffset);
            cellOffset += payloadLenV.length;
            const rowIdV = sqliteReadVarint(bytes, cellOffset);
            cellOffset += rowIdV.length;
            const payload = sqliteReadCellPayload(bytes, pageSize, cellOffset, payloadLenV.value);
            try {
                results.push(sqliteDecodeRecord(payload));
            } catch (_) {}
        }
    } else if (pageType === 0x05) {
        const rightChild = sqliteReadU32(bytes, headerOffset + 8);
        const cellPtrBase = headerOffset + 12;
        for (let i = 0; i < cellCount; i++) {
            const cellPtr = sqliteReadU16(bytes, cellPtrBase + i * 2);
            const childPage = sqliteReadU32(bytes, pageOffset + cellPtr);
            results.push(...sqliteScanLeafAndInterior(bytes, childPage, pageSize));
        }
        results.push(...sqliteScanLeafAndInterior(bytes, rightChild, pageSize));
    }

    return results;
}

function sqliteReadMasterRows(bytes, pageSize) {
    return sqliteScanLeafAndInterior(bytes, 1, pageSize);
}

function parseCreateTableColumns(sql) {
    if (!sql) return [];
    const match = sql.match(/\(([\s\S]+)\)\s*$/);
    if (!match) return [];
    const body = match[1];
    const columns = [];
    for (const part of body.split(',')) {
        const trimmed = part.trim();
        if (!trimmed || /^(CONSTRAINT|PRIMARY|UNIQUE|CHECK|FOREIGN)\b/i.test(trimmed)) continue;
        const nameMatch = trimmed.match(/^["`]?([^"`\s]+)["`]?/);
        if (nameMatch) columns.push(nameMatch[1]);
    }
    return columns;
}

function openSqliteDatabase(bytes) {
    const data = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const magic = new TextDecoder('ascii', { fatal: false }).decode(data.slice(0, 15));
    if (magic !== 'SQLite format 3') throw new Error('Not a SQLite 3 database');

    let pageSize = sqliteReadU16(data, 16);
    if (pageSize === 1) pageSize = 65536;

    const masterRows = sqliteReadMasterRows(data, pageSize);
    const tables = {};

    for (const row of masterRows) {
        if (row[0] !== 'table' || !row[1]) continue;
        const tableName = row[1];
        const rootPage = Number(row[3]);
        const columns = parseCreateTableColumns(typeof row[4] === 'string' ? row[4] : '');
        const rawRows = sqliteScanLeafAndInterior(data, rootPage, pageSize);
        const objects = rawRows.map(values => {
            const obj = {};
            columns.forEach((col, index) => {
                obj[col] = values[index] ?? null;
            });
            return obj;
        });
        tables[tableName] = { columns, rows: objects };
    }

    return tables;
}

function readAllSqliteTables(bytes) {
    return openSqliteDatabase(bytes);
}
