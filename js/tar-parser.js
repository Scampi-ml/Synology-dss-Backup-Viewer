/**
 * tar-parser.js — read regular files from a POSIX/UStar TAR byte buffer.
 */

function parseTarArchive(buffer) {
    const data = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);
    const BLOCK = 512;
    const utf8 = new TextDecoder('utf-8', { fatal: false });
    const files = [];
    let pos = 0;

    function isZeroBlock(offset) {
        for (let i = 0; i < BLOCK; i++) {
            if (data[offset + i] !== 0) return false;
        }
        return true;
    }

    function readCString(bytes, start, maxLen) {
        const slice = bytes.subarray(start, start + maxLen);
        const end = slice.indexOf(0);
        return utf8.decode(slice.subarray(0, end === -1 ? maxLen : end));
    }

    function readOctalSize(bytes, start) {
        const raw = readCString(bytes, start, 12).trim();
        return raw ? parseInt(raw, 8) : 0;
    }

    while (pos + BLOCK <= data.length) {
        if (isZeroBlock(pos)) break;

        let path = readCString(data, pos, 100);
        const magic = readCString(data, pos + 257, 6);
        if (magic.startsWith('ustar')) {
            const prefix = readCString(data, pos + 345, 155);
            if (prefix) path = `${prefix}/${path}`;
        }

        const size = readOctalSize(data, pos + 124);
        const typeFlag = data[pos + 156];
        const isFile = typeFlag === 0x30 || typeFlag === 0x00;

        pos += BLOCK;

        if (isFile && size > 0 && path) {
            files.push({ name: path, data: data.slice(pos, pos + size) });
        }

        if (size > 0) {
            pos += Math.ceil(size / BLOCK) * BLOCK;
        }
    }

    return files;
}
