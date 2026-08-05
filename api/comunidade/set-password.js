var supabaseAdmin = require('../../lib/supabase-admin');

module.exports = async function handler(req, res) {
    if (req.method !== 'POST') {
        res.setHeader('Allow', 'POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        return res.status(500).json({ error: 'Supabase não configurado.' });
    }

    var body = req.body || {};
    var email = supabaseAdmin.normalizeEmail(body.email);
    var password = typeof body.password === 'string' ? body.password : '';

    if (!email || password.length < 8) {
        return res.status(400).json({ error: 'Email válido e password com pelo menos 8 caracteres.' });
    }

    try {
        var adminProfile = await admin
            .from('admins')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        var memberResult = await admin
            .from('members')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (memberResult.error) {
            throw memberResult.error;
        }

        if (!adminProfile.data && !memberResult.data) {
            return res.status(403).json({ error: 'Este email não tem acesso. Usa o email da compra.' });
        }

        if (memberResult.data && memberResult.data.password_set) {
            return res.status(409).json({ error: 'Password já definida. Faz login normalmente.' });
        }

        var authUserId = memberResult.data && memberResult.data.auth_user_id;

        if (!authUserId) {
            var created = await admin.auth.admin.createUser({
                email: email,
                email_confirm: true,
                password: password,
                user_metadata: {
                    full_name: (memberResult.data && memberResult.data.full_name) || (adminProfile.data && adminProfile.data.name) || '',
                    password_set: true,
                },
            });

            if (created.error) {
                throw created.error;
            }

            authUserId = created.data.user.id;
        } else {
            var updated = await admin.auth.admin.updateUserById(authUserId, {
                password: password,
                user_metadata: {
                    password_set: true,
                },
            });

            if (updated.error) {
                throw updated.error;
            }
        }

        if (memberResult.data) {
            await admin.from('members').update({
                auth_user_id: authUserId,
                password_set: true,
                updated_at: new Date().toISOString(),
            }).eq('id', memberResult.data.id);
        } else {
            await admin.from('members').insert({
                email: email,
                auth_user_id: authUserId,
                full_name: adminProfile.data.name,
                password_set: true,
            });
        }

        if (adminProfile.data) {
            await admin.from('admins').update({
                auth_user_id: authUserId,
            }).eq('id', adminProfile.data.id);
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error('Erro ao definir password:', error);
        return res.status(500).json({ error: 'Não foi possível definir a password.' });
    }
};
