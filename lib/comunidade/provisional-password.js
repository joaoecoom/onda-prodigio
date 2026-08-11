var crypto = require('crypto');

var PASSWORD_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

function generateProvisionalPassword() {
    var bytes = crypto.randomBytes(12);
    var out = '';

    for (var i = 0; i < 12; i += 1) {
        out += PASSWORD_CHARS[bytes[i] % PASSWORD_CHARS.length];
    }

    return out;
}

async function setProvisionalPasswordIfNeeded(admin, authUser, member, options) {
    options = options || {};

    if (!admin || !authUser || !member) {
        return { set: false, password: null };
    }

    var force = options.force === true;

    if (!force && member.password_set) {
        return { set: false, password: null };
    }

    var password = generateProvisionalPassword();
    var updated = await admin.auth.admin.updateUserById(authUser.id, {
        password: password,
        user_metadata: Object.assign({}, authUser.user_metadata || {}, {
            password_set: true,
            provisional_password: true,
        }),
    });

    if (updated.error) {
        throw updated.error;
    }

    var memberUpdate = await admin.from('members').update({
        password_set: true,
        updated_at: new Date().toISOString(),
    }).eq('id', member.id);

    if (memberUpdate.error) {
        throw memberUpdate.error;
    }

    return { set: true, password: password };
}

module.exports = {
    generateProvisionalPassword: generateProvisionalPassword,
    setProvisionalPasswordIfNeeded: setProvisionalPasswordIfNeeded,
};
