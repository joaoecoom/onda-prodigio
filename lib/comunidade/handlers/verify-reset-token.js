var supabaseAdmin = require('../../supabase-admin');
var passwordResetToken = require('../password-reset-token');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var token = typeof req.query.token === 'string' ? req.query.token.trim() : '';

    if (!token) {
        return res.status(400).json({ valid: false, error: 'Token em falta.' });
    }

    var verified = passwordResetToken.verifyPasswordResetToken(token);

    if (!verified.valid) {
        return res.status(400).json({
            valid: false,
            error: 'Link inválido ou expirado.',
        });
    }

    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        return res.status(500).json({ valid: false, error: 'Supabase não configurado.' });
    }

    try {
        var email = supabaseAdmin.normalizeEmail(verified.email);
        var memberResult = await admin
            .from('members')
            .select('email')
            .eq('email', email)
            .maybeSingle();

        var adminProfile = await admin
            .from('admins')
            .select('email')
            .eq('email', email)
            .maybeSingle();

        if (!memberResult.data && !adminProfile.data) {
            return res.status(403).json({ valid: false, error: 'Este email não tem acesso.' });
        }

        return res.status(200).json({
            valid: true,
            email: email,
        });
    } catch (error) {
        console.error('Erro ao validar token de redefinição:', error);
        return res.status(500).json({ valid: false, error: 'Não foi possível validar o link.' });
    }
};
