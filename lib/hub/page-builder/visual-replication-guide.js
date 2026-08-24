'use strict';

var FB_LIKE_SVG = '<span style="display:inline-flex;align-items:center;justify-content:center;width:18px;height:18px;border-radius:50%;background:#0866FF;flex-shrink:0;margin:0 4px 0 8px;">' +
    '<svg viewBox="0 0 20 20" width="10" height="10" fill="#fff" aria-hidden="true">' +
    '<path d="M2 10.5c0-.8.7-1.5 1.5-1.5h2.2V18H3.5A1.5 1.5 0 0 1 2 16.5v-6zm5.2-1.3 3.4-6.2c.3-.6 1-.8 1.6-.5.5.3.7.9.5 1.4L11.8 7.5h4.7c1.2 0 2.1 1.1 1.9 2.3l-1 6A2 2 0 0 1 15.5 18H7.2V9.2z"/>' +
    '</svg></span>';

function getCoreVisualRules() {
    return [
        '═══ FIDELIDADE PIXEL À REFERÊNCIA (OBRIGATÓRIO) ═══',
        'Quando há screenshot/imagem anexada: o HTML tem de parecer a MESMA captura.',
        'Copia: layout, alinhamento, cores exactas, tipografia, padding, gaps, avatars, bolhas, linhas de thread, ícones.',
        'PROIBIDO: layout genérico, cards inventados, emoji 👍, nomes pretos se a ref tem azul Facebook, texto centrado se a ref está à esquerda.',
        'Usa 1× create_section type "custom" + blocks[{type:"html", content:{html:"..."}}] com HTML completo inline.',
        '',
        '═══ FUNDOS FULL-BLEED (OBRIGATÓRIO) ═══',
        'O fundo da secção (preto, cinza, #F0F2F5, etc.) VAI SEMPRE em section.styles.backgroundColor — NUNCA só num <div max-width> dentro do HTML.',
        'Exemplo correcto: section.styles = { backgroundColor:"#f9f9f9", padding:"40px 16px" }',
        'O HTML interno NÃO deve envolver o conteúdo num wrapper com background+max-width: isso faz a cor "parar a meio".',
        'Cards brancos (ex.: comentários FB) podem ter background:#fff + max-width no card; o FUNDO da página/secção atrás deles fica em section.styles.',
        'Para comentários Facebook: section.styles = { backgroundColor:"#F0F2F5", padding:"24px 16px" } + card branco no HTML.',
    ].join('\n');
}

function getFacebookCommentHtmlTemplate() {
    return [
        'TEMPLATE HTML OBRIGATÓRIO (copiar estrutura; preencher textos/avatars/likes da referência):',
        '',
        '<div style="box-sizing:border-box;width:100%;max-width:680px;margin:0 auto;background:#fff;border:1px solid #e4e6eb;border-radius:8px;padding:12px 16px;font-family:Helvetica,Arial,sans-serif;color:#1c1e21;text-align:left;">',
        '  <!-- COMENTÁRIO PRINCIPAL -->',
        '  <div style="display:flex;align-items:flex-start;gap:8px;margin-bottom:4px;">',
        '    <img src="AVATAR_URL" alt="" width="40" height="40" style="width:40px;height:40px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block;">',
        '    <div style="flex:1;min-width:0;">',
        '      <div style="display:inline-block;background:#F0F2F5;border-radius:18px;padding:8px 12px;text-align:left;max-width:100%;">',
        '        <span style="display:block;font-weight:600;font-size:13px;line-height:1.23;color:#385898;">Nome</span>',
        '        <span style="display:block;font-size:15px;line-height:1.3333;color:#1c1e21;margin-top:2px;">Texto do comentário…</span>',
        '      </div>',
        '      <div style="display:flex;align-items:center;flex-wrap:wrap;gap:2px 0;margin-top:4px;padding-left:12px;font-size:12px;line-height:1.3;color:#65676B;">',
        '        <a href="#" style="font-weight:600;color:#65676B;text-decoration:none;margin-right:10px;">Gosto</a>',
        '        <a href="#" style="font-weight:600;color:#65676B;text-decoration:none;margin-right:10px;">Responder</a>',
        '        ' + FB_LIKE_SVG,
        '        <span style="font-size:12px;color:#65676B;margin-right:8px;">74</span>',
        '        <span style="font-size:12px;color:#65676B;">5 h</span>',
        '      </div>',
        '    </div>',
        '  </div>',
        '',
        '  <!-- REPLIES (indentados + linha vertical) -->',
        '  <div style="margin-left:48px;padding-left:12px;border-left:2px solid #CED0D4;">',
        '    <div style="display:flex;align-items:flex-start;gap:8px;margin:8px 0;">',
        '      <img src="AVATAR_URL" alt="" width="32" height="32" style="width:32px;height:32px;border-radius:50%;object-fit:cover;flex-shrink:0;display:block;">',
        '      <div style="flex:1;min-width:0;">',
        '        <div style="display:inline-block;background:#F0F2F5;border-radius:18px;padding:8px 12px;text-align:left;">',
        '          <span style="display:block;font-weight:600;font-size:13px;color:#385898;">Nome reply</span>',
        '          <span style="display:block;font-size:15px;color:#1c1e21;margin-top:2px;">Texto…</span>',
        '        </div>',
        '        <div style="display:flex;align-items:center;flex-wrap:wrap;margin-top:4px;padding-left:12px;font-size:12px;color:#65676B;">',
        '          <a href="#" style="font-weight:600;color:#65676B;text-decoration:none;margin-right:10px;">Gosto</a>',
        '          <a href="#" style="font-weight:600;color:#65676B;text-decoration:none;margin-right:10px;">Responder</a>',
        '          ' + FB_LIKE_SVG + '<span style="margin-right:8px;">26</span><span>4 h</span>',
        '        </div>',
        '      </div>',
        '    </div>',
        '  </div>',
        '</div>',
        '',
        'REGRAS FB (não negociáveis):',
        '1. Bolha cinza #F0F2F5 + border-radius 18px à volta de NOME+TEXTO (não texto solto).',
        '2. Nome #385898 bold 13px — NÃO preto.',
        '3. Texto #1c1e21 15px, text-align:left sempre.',
        '4. Avatar 40px principal / 32px reply, circular.',
        '5. Replies: margin-left 48px + border-left 2px #CED0D4.',
        '6. Gosto = SVG azul #0866FF (snippet acima) — NUNCA emoji 👍.',
        '7. Acções: Gosto | Responder | ícone+número | tempo (5 h / 30 m).',
        '8. Extrai da imagem: nomes, textos, likes, tempos, avatars (usa URLs da ref se visíveis; senão placeholders https://i.pravatar.cc/80?u=NOME).',
        '9. Um único block html com TODOS os comentários da referência — não fragments soltos.',
        '10. section.styles OBRIGATÓRIO: { backgroundColor:"#F0F2F5", padding:"24px 16px" } — o card branco fica no HTML; o cinza FB é fundo da secção (full-bleed).',
    ].join('\n');
}

function getFacebookCommentsGuide() {
    return [
        'PADRÃO — COMENTÁRIOS FACEBOOK (a referência mostra isto):',
        getFacebookCommentHtmlTemplate(),
    ].join('\n');
}

function getStyledHeadlineGuide() {
    return [
        'HEADLINE MULTI-COR (quando a referência tem palavras coloridas / gradientes):',
        '- update_block ou create_section com type:"html" + spans coloridos.',
        '- Gradiente: background:linear-gradient(...);-webkit-background-clip:text;-webkit-text-fill-color:transparent',
        '- Destaque caixa: background:#00E5FF;color:#000;padding:2px 8px',
    ].join('\n');
}

function looksLikeFacebookComments(message, references) {
    var text = String(message || '').toLowerCase();

    if (/facebook|coment[aá]rio|comentarios|fb\b|gosto|responder|reac[cç][aã]o|social\s*proof|testemunho/.test(text)) {
        return true;
    }

    if (/igual|exact|exata|r[eé]plica|como\s+(na|esta|essa)|fiel|screenshot|refer[eê]ncia/.test(text)) {
        return Boolean(references && references.some(function (row) {
            return row && row.type === 'image';
        }));
    }

    return false;
}

function looksLikeHeadline(message) {
    return /headline|t[ií]tulo|hero|gradiente|destaque\s+cyan|vsl/i.test(String(message || ''));
}

function buildReferenceReplicationPrompt(references, message) {
    var refs = references || [];
    var hasImages = refs.some(function (row) { return row && row.type === 'image'; });

    if (!hasImages) {
        return '';
    }

    var lines = [
        getCoreVisualRules(),
        '',
        'Pedido do utilizador: ' + String(message || '(replicar referência)'),
        'Acção: create_section custom + html FIEL · ou update_block se já existe o bloco alvo.',
        'NÃO apagues/recries à toa. NÃO peças confirmação. EXECUTA.',
    ];

    if (looksLikeFacebookComments(message, refs)) {
        lines.push('');
        lines.push(getFacebookCommentsGuide());
    }

    if (looksLikeHeadline(message)) {
        lines.push('');
        lines.push(getStyledHeadlineGuide());
    }

    if (!looksLikeFacebookComments(message, refs) && !looksLikeHeadline(message)) {
        lines.push('');
        lines.push('Se a imagem for comentários/social proof → usa o padrão Facebook (bolha #F0F2F5, nome #385898, linha de replies, SVG Gosto).');
        lines.push(getFacebookCommentsGuide());
    }

    return lines.join('\n');
}

module.exports = {
    getCoreVisualRules: getCoreVisualRules,
    getFacebookCommentsGuide: getFacebookCommentsGuide,
    getFacebookCommentHtmlTemplate: getFacebookCommentHtmlTemplate,
    getStyledHeadlineGuide: getStyledHeadlineGuide,
    looksLikeFacebookComments: looksLikeFacebookComments,
    buildReferenceReplicationPrompt: buildReferenceReplicationPrompt,
    FB_LIKE_SVG: FB_LIKE_SVG,
};
