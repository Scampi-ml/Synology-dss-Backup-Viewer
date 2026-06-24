/**
 * navigation.js — 3-level nav: main category → sub category → content tabs.
 */

const UTILITY_NAV = [
    { id: 'all-settings', label: 'All Settings', breadcrumb: 'All Settings' },
    { id: 'other', label: 'Other', breadcrumb: 'Other' },
    { id: 'credits', label: 'Credits', breadcrumb: 'Credits' },
];

const INITIAL_NAV_ID = 'file-sharing.shared-folder';

function slugifyNavLabel(label) {
    return String(label)
        .toLowerCase()
        .replace(/&/g, 'and')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

function buildNavTree(categories) {
    const groups = [];
    for (const [groupLabel, sections] of Object.entries(categories || {})) {
        const groupId = slugifyNavLabel(groupLabel);
        groups.push({
            id: groupId,
            label: groupLabel,
            children: buildNavChildren(sections, [groupId], groupLabel),
        });
    }
    return groups;
}

function buildNavChildren(node, pathParts, breadcrumbPrefix) {
    const items = [];
    if (Array.isArray(node)) return items;

    for (const [sectionLabel, value] of Object.entries(node)) {
        const sectionId = slugifyNavLabel(sectionLabel);
        const sectionPath = [...pathParts, sectionId];
        const sectionBreadcrumb = `${breadcrumbPrefix} › ${sectionLabel}`;

        if (Array.isArray(value)) {
            if (value.length === 0) {
                items.push({
                    id: sectionPath.join('.'),
                    label: sectionLabel,
                    breadcrumb: sectionBreadcrumb,
                    leaf: true,
                });
            } else {
                items.push({
                    id: sectionPath.join('.'),
                    label: sectionLabel,
                    breadcrumb: sectionBreadcrumb,
                    children: value.map((leafLabel) => ({
                        id: [...sectionPath, slugifyNavLabel(leafLabel)].join('.'),
                        label: leafLabel,
                        breadcrumb: `${sectionBreadcrumb} › ${leafLabel}`,
                        leaf: true,
                    })),
                });
            }
        } else if (value && typeof value === 'object') {
            items.push({
                id: sectionPath.join('.'),
                label: sectionLabel,
                breadcrumb: sectionBreadcrumb,
                children: buildNavChildren(value, sectionPath, sectionBreadcrumb),
            });
        }
    }
    return items;
}

function getMainGroups() {
    return buildNavTree(window.DSM_CATEGORIES || {});
}

function findNavPath(navId) {
    function walk(nodes, path) {
        for (const node of nodes) {
            const next = [...path, node];
            if (node.id === navId) return next;
            if (node.children?.length) {
                const found = walk(node.children, next);
                if (found) return found;
            }
        }
        return null;
    }

    for (const group of getMainGroups()) {
        if (group.id === navId) return [group];
        const found = walk(group.children || [], [group]);
        if (found) return found;
    }
    return null;
}

function findNavNode(navId) {
    if (!navId) return null;
    const utility = UTILITY_NAV.find((u) => u.id === navId);
    if (utility) return { ...utility, leaf: true };

    const path = findNavPath(navId);
    return path ? path[path.length - 1] : null;
}

function getNavItemById(navId) {
    return findNavNode(navId);
}

function getSubSections(mainId) {
    const group = getMainGroups().find((g) => g.id === mainId);
    if (!group) return [];
    return (group.children || []).map((c) => ({
        id: c.id,
        label: c.label,
        leaf: !!c.leaf,
    }));
}

function getTabGroups(subId) {
    const node = findNavNode(subId);
    if (!node || node.leaf) return [];

    let children = node.children || [];
    if (children.length === 1 && !children[0].leaf && children[0].children?.length) {
        const inner = children[0];
        if (inner.children.every((c) => c.leaf)) {
            children = inner.children;
        }
    }

    return children.map((c) => ({
        id: c.id,
        label: c.label,
        isLeaf: !!c.leaf,
        children: c.leaf ? [] : (c.children || []).filter((ch) => ch.leaf),
    }));
}

function navStateFromNavId(navId) {
    if (UTILITY_NAV.some((u) => u.id === navId)) {
        return { mode: 'utility', utilityId: navId, mainId: null, subId: null, tabId: null, subTabId: null };
    }

    const path = findNavPath(navId);
    if (!path || path.length < 2) return getDefaultCategoryState();

    const main = path[0];
    const sub = path[1];
    const state = {
        mode: 'category',
        utilityId: null,
        mainId: main.id,
        subId: sub.id,
        tabId: null,
        subTabId: null,
    };

    if (sub.leaf) return state;

    const tabs = getTabGroups(sub.id);
    if (!tabs.length) return state;

    const target = path[path.length - 1];
    if (target.leaf) {
        const tabMatch = tabs.find((t) => t.id === target.id);
        if (tabMatch) {
            state.tabId = tabMatch.id;
            return state;
        }
        const parentTab = tabs.find((t) => t.children.some((c) => c.id === target.id));
        if (parentTab) {
            state.tabId = parentTab.id;
            state.subTabId = target.id;
            return state;
        }
    }

    const firstTab = tabs[0];
    state.tabId = firstTab.id;
    if (!firstTab.isLeaf && firstTab.children.length) {
        state.subTabId = firstTab.children[0].id;
    }
    return state;
}

function resolveContentNavId(state) {
    if (state.mode === 'utility') return state.utilityId;
    if (!state.subId) return state.mainId;

    const sub = findNavNode(state.subId);
    if (sub?.leaf) return state.subId;

    if (state.subTabId) return state.subTabId;

    const tabs = getTabGroups(state.subId);
    if (!tabs.length) return state.subId;

    const activeTab = tabs.find((t) => t.id === state.tabId) || tabs[0];
    if (activeTab.isLeaf) return activeTab.id;
    if (activeTab.children.length) return activeTab.children[0].id;
    return activeTab.id;
}

function renderSidebar(state) {
    const mainHtml = getMainGroups().map((main) => {
        const mainActive = state.mode === 'category' && state.mainId === main.id;
        const subs = getSubSections(main.id);
        const subsHtml = mainActive
            ? subs.map((sub) => {
                const subActive = state.subId === sub.id;
                const safeId = escapeHtml(sub.id).replace(/'/g, '&#39;');
                return `<button type="button" class="sidebar-sub${subActive ? ' is-active' : ''}" onclick="switchSub('${safeId}')">${escapeHtml(sub.label)}</button>`;
            }).join('')
            : '';

        return `
            <div class="sidebar-main">
                <button type="button" class="sidebar-main-title${mainActive ? ' is-active' : ''}" onclick="switchMain('${escapeHtml(main.id)}')">${escapeHtml(main.label)}</button>
                ${subsHtml}
            </div>
        `;
    }).join('');

    const utilityHtml = UTILITY_NAV.filter((item) => item.id !== 'credits').map((item) => {
        const active = state.mode === 'utility' && state.utilityId === item.id;
        return `<button type="button" class="sidebar-link${active ? ' is-active' : ''}" onclick="switchUtility('${item.id}')">${escapeHtml(item.label)}</button>`;
    }).join('');

    const creditsActive = state.mode === 'utility' && state.utilityId === 'credits';
    const creditsHtml = `<button type="button" class="sidebar-link${creditsActive ? ' is-active' : ''}" onclick="switchUtility('credits')">Credits</button>`;

    return `
        <nav class="sidebar" data-nav-sidebar aria-label="Categories">
            <div class="sidebar-body">${mainHtml}</div>
            <div class="sidebar-footer">
                <div class="sidebar-footer-util">${utilityHtml}</div>
                <div class="sidebar-footer-credits">${creditsHtml}</div>
            </div>
        </nav>
    `;
}

function renderTabBars(state) {
    if (state.mode !== 'category' || !state.subId) return '';

    const sub = findNavNode(state.subId);
    if (sub?.leaf) return '';

    const tabs = getTabGroups(state.subId);
    if (!tabs.length) return '';

    const activeTabId = state.tabId || tabs[0].id;
    const activeTab = tabs.find((t) => t.id === activeTabId) || tabs[0];

    const tabHtml = tabs.map((tab) => {
        const active = tab.id === activeTabId;
        const safeId = escapeHtml(tab.id).replace(/'/g, '&#39;');
        return `<button type="button" class="tab-btn${active ? ' is-active' : ''}" onclick="switchTab('${safeId}')">${escapeHtml(tab.label)}</button>`;
    }).join('');

    let subTabHtml = '';
    if (!activeTab.isLeaf && activeTab.children.length) {
        const subTabId = state.subTabId || activeTab.children[0].id;
        subTabHtml = `
            <div class="tab-bar tab-bar--sub">
                ${activeTab.children.map((st) => {
                    const active = st.id === subTabId;
                    const safeId = escapeHtml(st.id).replace(/'/g, '&#39;');
                    return `<button type="button" class="tab-btn${active ? ' is-active' : ''}" onclick="switchSubTab('${safeId}')">${escapeHtml(st.label)}</button>`;
                }).join('')}
            </div>
        `;
    }

    return `
        <div class="tab-bar">${tabHtml}</div>
        ${subTabHtml}
    `;
}

function getInitialNavState() {
    return navStateFromNavId(INITIAL_NAV_ID);
}

function getDefaultCategoryState() {
    return getInitialNavState();
}

function flattenNavLeaves(groups) {
    const leaves = [];
    function walk(nodes) {
        for (const node of nodes) {
            if (node.leaf) leaves.push(node);
            else if (node.children?.length) walk(node.children);
        }
    }
    for (const group of groups) walk(group.children || []);
    return leaves;
}

function getParentGroupIds(navId) {
    const parts = navId.split('.');
    const ids = [];
    for (let i = 1; i < parts.length; i += 1) {
        ids.push(parts.slice(0, i).join('.'));
    }
    return ids;
}
