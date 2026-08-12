var commentAi = require('../comment-ai');

module.exports = async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        res.setHeader('Allow', 'GET, POST');
        return res.status(405).json({ error: 'Método não permitido.' });
    }

    var secret = String(process.env.CRON_SECRET || '').trim();
    var authHeader = String(req.headers.authorization || '');
    var token = authHeader.indexOf('Bearer ') === 0 ? authHeader.slice(7).trim() : '';

    if (!secret || token !== secret) {
        return res.status(401).json({ error: 'Não autorizado.' });
    }

    try {
        var result = await commentAi.runDailyAiBatch();
        return res.status(200).json({ ok: true, result: result });
    } catch (error) {
        console.error('Erro no cron de comentários IA:', error);
        return res.status(500).json({ error: 'Não foi possível processar respostas automáticas.' });
    }
};
