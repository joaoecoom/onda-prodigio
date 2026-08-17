#!/usr/bin/env node
/**
 * Substitui respostas automáticas antigas (template genérico) por respostas contextuais offline.
 *
 * Uso:
 *   set -a && source .env.vercel.tmp && set +a && node scripts/refresh-generic-comment-replies.js
 */
var commentAi = require('../lib/comunidade/comment-ai');
var supabaseAdmin = require('../lib/supabase-admin');

async function main() {
    var admin = supabaseAdmin.getSupabaseAdmin();

    if (!admin) {
        console.error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são necessários.');
        process.exit(1);
    }

    var result = await commentAi.refreshLegacyGenericReplies(admin);
    console.log(JSON.stringify(result, null, 2));
}

main().catch(function (error) {
    console.error(error);
    process.exit(1);
});
