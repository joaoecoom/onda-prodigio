var supabaseAdmin = require('../../supabase-admin');

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

    if (!email) {
        return res.status(400).json({ error: 'Introduz o email usado na compra.' });
    }

    try {
        var adminProfile = await admin
            .from('admins')
            .select('email, name')
            .eq('email', email)
            .maybeSingle();

        if (adminProfile.error) {
            throw adminProfile.error;
        }

        if (adminProfile.data) {
            var adminAuth = await admin
                .from('members')
                .select('password_set')
                .eq('email', email)
                .maybeSingle();

            var adminNeedsPassword = !adminAuth.data || !adminAuth.data.password_set;

            return res.status(200).json({
                status: adminNeedsPassword ? 'needs_password' : 'login',
                role: 'admin',
                name: adminProfile.data.name,
            });
        }

        var memberResult = await admin
            .from('members')
            .select('email, full_name, password_set')
            .eq('email', email)
            .maybeSingle();

        if (memberResult.error) {
            throw memberResult.error;
        }

        if (!memberResult.data) {
            return res.status(200).json({
                status: 'no_access',
            });
        }

        return res.status(200).json({
            status: memberResult.data.password_set ? 'login' : 'needs_password',
            role: 'member',
            name: memberResult.data.full_name || '',
        });
    } catch (error) {
        console.error('Erro ao verificar email:', error);
        return res.status(500).json({ error: 'Não foi possível verificar o email.' });
    }
};
