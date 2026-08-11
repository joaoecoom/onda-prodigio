async function recordLogin(admin, memberId) {
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
        var updateResult = await admin.from('members').update({
            last_login_at: new Date().toISOString(),
            login_count: nextCount,
            updated_at: new Date().toISOString(),
        }).eq('id', memberId);

        if (updateResult.error) {
            throw updateResult.error;
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
