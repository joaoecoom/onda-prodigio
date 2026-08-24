'use strict';

var schema = require('./schema');

var SYSTEM_PROMPT = [
    'Analysa o screenshot de uma landing page / sales page.',
    'Devolve APENAS JSON válido (sem markdown) com esta forma:',
    '{',
    '  "page_type": "sales",',
    '  "confidence": "high|medium|low",',
    '  "notes": "observações curtas",',
    '  "sections": [',
    '    {',
    '      "type": "hero|benefits|cta|custom",',
    '      "settings": { "label": "Hero" },',
    '      "blocks": [',
    '        { "type": "heading|text|button|image|video|spacer", "content": {}, "settings": {} }',
    '      ]',
    '    }',
    '  ]',
    '}',
    '',
    'Regras:',
    '- Usa apenas block types: heading, text, button, image, video, spacer.',
    '- Extrai textos visíveis (headlines, parágrafos, labels de botões).',
    '- Não inventes URLs de imagem — deixa src/url vazio se não souberes.',
    '- Mantém a ordem vertical das sections.',
    '- Máximo 8 sections.',
    '- Escreve textos em português de Portugal se o screenshot estiver em PT.',
].join('\n');

function getVisionModel() {
    return String(process.env.OPENAI_VISION_MODEL || process.env.OPENAI_SCREENSHOT_MODEL || 'gpt-4o-mini').trim();
}

async function analyzeScreenshotVision(imageBase64, mimeType) {
    var apiKey = String(process.env.OPENAI_API_KEY || '').trim();

    if (!apiKey) {
        return null;
    }

    var response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
            Authorization: 'Bearer ' + apiKey,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            model: getVisionModel(),
            temperature: 0.2,
            response_format: { type: 'json_object' },
            messages: [{
                role: 'user',
                content: [
                    { type: 'text', text: SYSTEM_PROMPT },
                    {
                        type: 'image_url',
                        image_url: {
                            url: 'data:' + mimeType + ';base64,' + imageBase64,
                        },
                    },
                ],
            }],
        }),
    });

    var payload = await response.json().catch(function () {
        return {};
    });

    if (!response.ok) {
        var message = payload.error && payload.error.message
            ? payload.error.message
            : 'Vision API falhou.';
        throw Object.assign(new Error(message), { code: 'VISION_API_ERROR' });
    }

    var content = payload.choices &&
        payload.choices[0] &&
        payload.choices[0].message &&
        payload.choices[0].message.content;

    return schema.parseVisionPayload(content);
}

module.exports = {
    SYSTEM_PROMPT: SYSTEM_PROMPT,
    getVisionModel: getVisionModel,
    analyzeScreenshotVision: analyzeScreenshotVision,
};
