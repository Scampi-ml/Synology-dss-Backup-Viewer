/**
 * views/users-groups.js
 */

function renderUsersGroupsView(result, showSensitive, options) {
    const section = options?.section;
    const title = options?.title || 'Users & Groups';
    const subtitle = options?.subtitle || title;

    const users = redactTableRows(rowsToObjects(result.tables.confbkp_user_tb), showSensitive)
        .map((u) => ({
            ...u,
            expire: expireStatus(u.expire),
        }));
    const groups = rowsToObjects(result.tables.confbkp_group_tb);
    const members = rowsToObjects(result.tables.confbkp_group_member_list_tb);

    const userCols = ['name', 'uid', 'gid', 'description', 'expire', 'authType', 'pwd_no_expiry', 'passwd', 'LMPW', 'NTPW'];
    const groupCols = ['name', 'gid', 'description'];
    const memberCols = ['group_name', 'member_name'];

    let body = '';
    let countLabel = `${users.length} users, ${groups.length} groups`;

    if (section === 'user') {
        body = renderSection(
            'Users',
            renderDataTable(userCols, users, showSensitive, 'No users in backup'),
            users.length
        );
        countLabel = `${users.length} user(s)`;
    } else if (section === 'group') {
        body = renderSection('Groups', renderDataTable(groupCols, groups, showSensitive, 'No groups in backup'), groups.length)
            + renderSection(
                'Group membership',
                renderDataTable(memberCols, members, showSensitive, 'No group memberships'),
                members.length
            );
        countLabel = `${groups.length} group(s)`;
    } else {
        body = renderSection('Users', renderDataTable(userCols, users, showSensitive, 'No users in backup'), users.length)
            + renderSection('Groups', renderDataTable(groupCols, groups, showSensitive, 'No groups in backup'), groups.length)
            + renderSection(
                'Group membership',
                renderDataTable(memberCols, members, showSensitive, 'No group memberships'),
                members.length
            );
    }

    return renderExtractorView(`
        <div class="view-body">${body}</div>
    `);
}
