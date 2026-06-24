/**
 * views/scheduler.js
 */

const schedulerViewState = {
    mode: 'table',
};

function setSchedulerViewMode(mode) {
    schedulerViewState.mode = mode;
    rerenderActiveView();
}

function schedulerModeBtn(mode, label) {
    const active = schedulerViewState.mode === mode;
    return `<button type="button" class="${active ? 'is-active' : ''}" onclick="setSchedulerViewMode('${mode}')">${label}</button>`;
}

function renderSchedulerViewModeToggle() {
    return `
        <div class="mode-toggle" role="group" aria-label="Scheduler view mode">
            ${schedulerModeBtn('table', 'Table')}
            ${schedulerModeBtn('detailed', 'Detailed')}
            ${schedulerModeBtn('raw', 'Raw JSON')}
        </div>
    `;
}

function renderSchedulerRawView(tasks) {
    if (!tasks.length) return `<div class="empty">No scheduler tasks</div>`;

    return tasks.map((task, index) => {
        let pretty = task.raw || '';
        try {
            pretty = JSON.stringify(JSON.parse(task.raw || '{}'), null, 2);
        } catch (_) {}

        return renderDetailsBlock(
            `Task ${escapeHtml(String(task.id ?? index + 1))}: ${escapeHtml(task.name || 'Unnamed')}`,
            `<pre class="pre-block">${escapeHtml(pretty)}</pre>`
        );
    }).join('');
}

function renderSchedulerDetailedView(tasks) {
    if (!tasks.length) return `<div class="empty">No scheduler tasks</div>`;

    return tasks.map((task, index) => renderDetailsBlock(
        `Task ${escapeHtml(String(task.id ?? index + 1))}: ${escapeHtml(task.name || 'Unnamed')}`,
        renderKeyValueTable(getSchedulerTaskFields(task.raw))
    )).join('');
}

function renderSchedulerTableView(tasks) {
    return renderDataTable(['id', 'name', 'app', 'state'], tasks, true, 'No scheduler tasks');
}

function renderSchedulerSectionTitle(mode) {
    if (mode === 'raw') return 'Raw task JSON';
    if (mode === 'detailed') return 'Task details';
    return 'Tasks';
}

function renderSchedulerView(result, showSensitive, options) {
    const title = options?.title || 'Task Scheduler';
    const subtitle = options?.subtitle || title;
    const tasks = result.schedulerTasks || [];
    const mode = schedulerViewState.mode;

    let content;
    if (mode === 'raw') content = renderSchedulerRawView(tasks);
    else if (mode === 'detailed') content = renderSchedulerDetailedView(tasks);
    else content = renderSchedulerTableView(tasks);

    return renderExtractorView(`
        <div class="view-body">
            <div class="view-toolbar-row">${renderSchedulerViewModeToggle()}</div>
            ${renderSection(renderSchedulerSectionTitle(mode), content, tasks.length)}
        </div>
    `);
}
