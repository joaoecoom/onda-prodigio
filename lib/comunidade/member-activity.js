async function recordLogin(admin, memberId, options) {
    options = options || {};

    if (!admin || !memberId) {
        return { skipped: true };
    }

    try {
        var memberResult = await admin
            .from('members')
            .select('login_count')
            .eq('id', memberId)
            .maybeSingle();

        if (memberResult.error) {
            throw memberResult.error;
        }

        if (!memberResult.data) {
            return { skipped: true, reason: 'member_not_found' };
        }

        var nextCount = Number(memberResult.data.login_count || 0) + 1;
        var nowIso = new Date().toISOString();
        var updateResult = await admin.from('members').update({
            last_login_at: nowIso,
            login_count: nextCount,
            updated_at: nowIso,
        }).eq('id', memberId);

        if (updateResult.error) {
            throw updateResult.error;
        }

        try {
            await admin.from('member_login_events').insert({
                member_id: memberId,
                logged_in_at: nowIso,
                source: options.source || 'comunidade_me',
            });
        } catch (eventError) {
            if (String(eventError.message || '').toLowerCase().indexOf('member_login_events') === -1) {
                console.warn('member_login_events ignorado:', eventError.message);
            }
        }

        try {
            var neverLoggedInQueue = require('./never-logged-in-queue');
            await neverLoggedInQueue.cancelPendingForMember(admin, memberId, 'logged_in');
        } catch (queueError) {
            console.warn('cancel never_logged_in queue ignorado:', queueError.message);
        }

        return { ok: true, login_count: nextCount };
    } catch (error) {
        console.warn('recordLogin ignorado:', error.message);
        return { skipped: true, reason: error.message };
    }
}

module.exports = {
    recordLogin: recordLogin,
};
