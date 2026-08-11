var supabaseAdmin = require('../../supabase-admin');
var passwordResetToken = require('../password-reset-token');
var passwordResetEmail = require('../../email/password-reset-email');

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
        var memberResult = await admin
            .from('members')
            .select('email, full_name, auth_user_id')
            .eq('email', email)
            .maybeSingle();

        if (memberResult.error) {
            throw memberResult.error;
        }

        var adminProfile = await admin
            .from('admins')
            .select('email, name')
            .eq('email', email)
            .maybeSingle();

        if (adminProfile.error) {
            throw adminProfile.error;
        }

        if (!memberResult.data && !adminProfile.data) {
            return res.status(200).json({
                ok: true,
                message: 'Se este email tiver acesso, vais receber um link para redefinir a password.',
            });
        }

        var token = passwordResetToken.createPasswordResetToken(email);
        var fullName = (memberResult.data && memberResult.data.full_name) || (adminProfile.data && adminProfile.data.name) || '';
        var emailResult = await passwordResetEmail.sendPasswordResetEmail({
            email: email,
            fullName: fullName,
            token: token,
        });

        if (!emailResult.ok) {
            return res.status(500).json({
                error: emailResult.reason || 'Não foi possível enviar o email de redefinição.',
            });
        }

        return res.status(200).json({
            ok: true,
            message: 'Enviámos um email com o link para redefinir a password.',
        });
    } catch (error) {
        console.error('Erro ao pedir redefinição de password:', error);
        return res.status(500).json({ error: 'Não foi possível processar o pedido.' });
    }
};
