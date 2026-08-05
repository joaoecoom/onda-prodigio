module.exports = async function handler(req, res) {
    if (req.method !== 'GET') {
        res.setHeader('Allow', 'GET');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var url = process.env.SUPABASE_URL || '';
    var anonKey = process.env.SUPABASE_ANON_KEY || '';

    if (!url || !anonKey) {
        return res.status(500).json({ error: 'Supabase não configurado.' });
    }

    return res.status(200).json({
        supabaseUrl: url,
        supabaseAnonKey: anonKey,
    });
};
