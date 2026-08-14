async function wasEmailAlreadySent(admin, referenceId) {
    if (!admin || !referenceId) {
        return false;
    }

    try {
        var existing = await admin
            .from('purchase_email_log')
            .select('id')
            .eq('reference_id', referenceId)
            .maybeSingle();

        if (existing.error) {
            if (String(existing.error.message || '').toLowerCase().indexOf('purchase_email_log') !== -1) {
                return false;
            }

            throw existing.error;
        }

        return Boolean(existing.data);
    } catch (error) {
        console.warn('purchase_email_log indisponível:', error.message);
        return false;
    }
}

async function logSentEmail(admin, referenceId, memberId, emailType) {
    if (!admin || !referenceId) {
        return;
    }

    try {
        await admin.from('purchase_email_log').insert({
            reference_id: referenceId,
            member_id: memberId || null,
            email_type: emailType,
        });
    } catch (error) {
        console.warn('Não foi possível registar purchase_email_log:', error.message);
    }
}

module.exports = {
    wasEmailAlreadySent: wasEmailAlreadySent,
    logSentEmail: logSentEmail,
};
