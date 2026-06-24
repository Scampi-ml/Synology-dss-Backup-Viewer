/**
 * views/hardware.js — Hardware & Power (system, storage, updates).
 */

function renderHardwareView(result, showSensitive, options) {
    const title = options?.title || 'Hardware & Power';
    const subtitle = options?.subtitle || 'General hardware and power settings';
    const data = extractHardwareData(result.config, result.info, result.tables);

    return renderExtractorView(`
        <div class="view-body">
            ${renderSection('System', renderKeyValueGrid(data.systemPairs))}
            ${data.storageSummary.length
                ? renderSection('Storage volumes', renderKeyValueGrid(data.storageSummary), data.storageSummary.length)
                : ''}
            ${data.updatePairs.length
                ? renderSection('Updates & SMART', renderKeyValueGrid(data.updatePairs))
                : ''}
        </div>
    `);
}
