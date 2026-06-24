/**
 * views/credits.js - project credits and acknowledgements.
 */

function renderCreditsView(result, showSensitive, options) {
    return renderExtractorView(`
        <div class="view-body credits-page">
            <section class="credits-section">
                <h3 class="section-title">Synology dss Backup Viewer</h3>
                <p class="credits-text">
                    A browser-based viewer for Synology DSM configuration backups (<code>.dss</code>).
                    Browse settings organized by DSM Control Panel categories. All parsing runs locally in your
                    browser. Nothing is uploaded.
                </p>
                <div class="credits-links">
                    <a href="https://github.com/Scampi-ml/Synology-dss-Backup-Viewer" target="_blank" rel="noopener noreferrer">github.com/Scampi-ml/Synology-dss-Backup-Viewer</a>
                </div>
            </section>

            <section class="credits-section">
                <h3 class="section-title">Original work</h3>
                <p class="credits-text">
                    Understanding of the Synology <code>.dss</code> backup format was informed by
                    <strong>Synology Inspector</strong>, a security audit tool for DSM configuration backups
                    by <strong>JKLP Consulting</strong>.
                </p>
                <div class="credits-links">
                    <a href="https://github.com/juergenbarth/synology-inspector" target="_blank" rel="noopener noreferrer">https://github.com/juergenbarth/synology-inspector</a>
                </div>
            </section>

            <section class="credits-section">
                <h3 class="section-title">Third-party libraries</h3>
                <div class="credits-links">
                    <a href="https://github.com/SteveSanderson/xzwasm" target="_blank" rel="noopener noreferrer">xz-decompress</a>
                    <span class="credits-meta">XZ decompression (MIT)</span>
                </div>
                <div class="credits-links">
                    <a href="https://github.com/101arrowz/fflate" target="_blank" rel="noopener noreferrer">fflate</a>
                    <span class="credits-meta">compression utilities (MIT)</span>
                </div>
            </section>

        </div>
    `);
}
