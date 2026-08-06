(function () {
    var SURVEY_ID = 'onda-prodigio-genius-test';
    var LESSON_TITLE_MATCH = 'Teste para Descobrir o Génio';

    var PROFILES = {
        creative: {
            label: 'Génio Criativo',
            emoji: '🎨',
            summary: 'O teu filho pensa em imagens, histórias e possibilidades. Aprende melhor quando pode inventar, expressar-se e ligar o novo ao imaginário.',
            tips: 'Usa desenhos, mapas visuais, histórias e desafios abertos. Deixa espaço para criar antes de pedir respostas «certas».',
        },
        logical: {
            label: 'Génio Lógico',
            emoji: '🔢',
            summary: 'Gosta de padrões, sequências e desafios com regras claras. Entende o mundo quando consegue organizar, comparar e resolver problemas passo a passo.',
            tips: 'Divide tarefas em etapas, usa jogos de lógica e mostra o «porquê» por trás de cada passo. Elogia o raciocínio, não só o resultado.',
        },
        linguistic: {
            label: 'Génio Linguístico',
            emoji: '📖',
            summary: 'Tem facilidade com palavras, leitura, conversa e explicação. Aprende ouvindo, lendo, contando e transformando ideias em linguagem.',
            tips: 'Lê em voz alta, faz resumos verbais, usa rimas ou histórias. Pede-lhe que explique o que aprendeu com as próprias palavras.',
        },
        spatial: {
            label: 'Génio Espacial',
            emoji: '🧩',
            summary: 'Pensa em formas, espaços e relações visuais. Aprende melhor vendo, construindo, desenhando esquemas ou experimentando na prática.',
            tips: 'Usa materiais concretos, blocos, mapas mentais e demonstrações visuais. Deixa-o mover-se e manipular enquanto estuda.',
        },
        social: {
            label: 'Génio Social',
            emoji: '🤝',
            summary: 'Aprende com pessoas, emoções e relações. Motiva-se quando se sente compreendido, quando coopera e quando vê o impacto do que faz nos outros.',
            tips: 'Estuda em pequenos grupos, usa exemplos reais, conversa sobre sentimentos e celebra progressos em conjunto.',
        },
        naturalist: {
            label: 'Génio Naturalista',
            emoji: '🌿',
            summary: 'Observa, classifica e conecta-se com a natureza, animais e detalhes do mundo real. Aprende melhor com exemplos vivos e experiências concretas.',
            tips: 'Liga os conteúdos à natureza, passeios, animais ou curiosidades do dia a dia. Valoriza a observação antes da explicação teórica.',
        },
    };

    var QUESTIONS = [
        {
            id: 'play_style',
            label: 'Quando tem tempo livre, o teu filho prefere…',
            options: [
                { value: 'creative', label: 'Inventar histórias, desenhar ou criar coisas novas' },
                { value: 'logical', label: 'Jogos de lógica, puzzles ou desafios com regras' },
                { value: 'linguistic', label: 'Ler, contar histórias ou conversar durante horas' },
                { value: 'spatial', label: 'Construir, montar peças ou explorar espaços' },
                { value: 'social', label: 'Brincar com amigos ou cuidar de alguém' },
                { value: 'naturalist', label: 'Observar animais, plantas ou o mundo lá fora' },
            ],
        },
        {
            id: 'learn_style',
            label: 'Aprende melhor quando…',
            options: [
                { value: 'spatial', label: 'Vê exemplos, imagens ou demonstrações práticas' },
                { value: 'linguistic', label: 'Ouve explicações claras e pode fazer perguntas' },
                { value: 'logical', label: 'Percebe a sequência lógica e a ordem dos passos' },
                { value: 'creative', label: 'Pode inventar, associar ou imaginar cenários' },
                { value: 'social', label: 'Aprende com outras pessoas ou em grupo' },
                { value: 'naturalist', label: 'Relaciona o conteúdo com coisas reais do dia a dia' },
            ],
        },
        {
            id: 'memory_style',
            label: 'Memoriza melhor quando…',
            options: [
                { value: 'linguistic', label: 'Repete em voz alta ou escreve frases' },
                { value: 'spatial', label: 'Vê esquemas, cores ou organiza visualmente' },
                { value: 'logical', label: 'Entende a lógica por trás da informação' },
                { value: 'creative', label: 'Cria uma história ou associação engraçada' },
                { value: 'naturalist', label: 'Liga a factos concretos, objectos ou experiências' },
                { value: 'social', label: 'Explica a alguém ou aprende em conversa' },
            ],
        },
        {
            id: 'challenge_style',
            label: 'Quando não percebe algo de imediato, tende a…',
            options: [
                { value: 'logical', label: 'Tentar outra estratégia ou dividir o problema' },
                { value: 'social', label: 'Pedir ajuda ou conversar sobre o que sente' },
                { value: 'spatial', label: 'Precisar de ver, mexer ou experimentar na prática' },
                { value: 'creative', label: 'Procurar uma forma diferente e original de entender' },
                { value: 'linguistic', label: 'Pedir mais explicações com palavras diferentes' },
                { value: 'naturalist', label: 'Comparar com exemplos reais que já conhece' },
            ],
        },
        {
            id: 'strength_signal',
            label: 'O que os outros costumam elogiar nele?',
            options: [
                { value: 'creative', label: 'Imaginação, criatividade ou ideias originais' },
                { value: 'logical', label: 'Raciocínio rápido, organização ou persistência' },
                { value: 'linguistic', label: 'Facilidade para falar, ler ou explicar' },
                { value: 'spatial', label: 'Capacidade para construir, desenhar ou visualizar' },
                { value: 'social', label: 'Empatia, liderança ou espírito de equipa' },
                { value: 'naturalist', label: 'Curiosidade, observação ou ligação à natureza' },
            ],
        },
        {
            id: 'focus_style',
            label: 'Concentra-se melhor quando…',
            options: [
                { value: 'spatial', label: 'Tem materiais visuais ou pode mexer enquanto pensa' },
                { value: 'linguistic', label: 'Ouve instruções claras e pode verbalizar o processo' },
                { value: 'logical', label: 'Sabe exactamente qual é o objectivo e as regras' },
                { value: 'creative', label: 'O desafio parece divertido, diferente ou inspirador' },
                { value: 'social', label: 'Sente apoio, encorajamento ou companhia' },
                { value: 'naturalist', label: 'O tema liga a algo concreto que lhe interessa' },
            ],
        },
        {
            id: 'motivation_style',
            label: 'Motiva-se mais quando…',
            options: [
                { value: 'social', label: 'Sente que alguém acredita nele e o acompanha' },
                { value: 'logical', label: 'Vê progresso claro e pequenas vitórias mensuráveis' },
                { value: 'creative', label: 'Pode escolher a forma de fazer ou expressar' },
                { value: 'linguistic', label: 'Recebe feedback claro através de palavras' },
                { value: 'spatial', label: 'Pode ver o resultado concreto do esforço' },
                { value: 'naturalist', label: 'Percebe utilidade real no que está a aprender' },
            ],
        },
        {
            id: 'dream_activity',
            label: 'Se pudesse escolher uma actividade ideal, seria…',
            options: [
                { value: 'creative', label: 'Criar uma história, música, desenho ou projecto original' },
                { value: 'logical', label: 'Resolver um grande desafio ou jogo estratégico' },
                { value: 'linguistic', label: 'Ler, escrever ou apresentar algo a outras pessoas' },
                { value: 'spatial', label: 'Construir, inventar ou planear algo com as mãos' },
                { value: 'social', label: 'Trabalhar em equipa e ajudar outras pessoas' },
                { value: 'naturalist', label: 'Explorar a natureza, animais ou experimentar no mundo real' },
            ],
        },
    ];

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function formatDate(value) {
        try {
            return new Intl.DateTimeFormat('pt-PT', {
                dateStyle: 'short',
                timeStyle: 'short',
            }).format(new Date(value));
        } catch (error) {
            return value;
        }
    }

    function isGeniusTestLesson(aulaItem) {
        return Boolean(aulaItem && aulaItem.title && aulaItem.title.indexOf(LESSON_TITLE_MATCH) !== -1);
    }

    function renderQuestion(question, index) {
        var html = (
            '<div class="comunidade-survey__question" data-question-id="' + question.id + '">' +
                '<div class="comunidade-survey__question-label">' +
                    '<span class="comunidade-survey__question-num">' + (index + 1) + '.</span> ' +
                    escapeHtml(question.label) +
                    ' <span class="comunidade-survey__required">*</span>' +
                '</div>' +
                '<div class="comunidade-survey__options">'
        );

        question.options.forEach(function (option, optionIndex) {
            var inputId = question.id + '-' + optionIndex;

            html += (
                '<label class="comunidade-survey__option" for="' + inputId + '">' +
                    '<input type="radio" id="' + inputId + '" name="' + question.id + '" value="' + escapeHtml(option.value) + '" required>' +
                    '<span>' + escapeHtml(option.label) + '</span>' +
                '</label>'
            );
        });

        html += '</div></div>';
        return html;
    }

    function collectAnswers(form) {
        var answers = {};
        var index;

        for (index = 0; index < QUESTIONS.length; index += 1) {
            var question = QUESTIONS[index];
            var selected = form.querySelector('input[name="' + question.id + '"]:checked');
            answers[question.id] = selected ? selected.value : '';
        }

        return answers;
    }

    function computeResult(answers) {
        var scores = {
            creative: 0,
            logical: 0,
            linguistic: 0,
            spatial: 0,
            social: 0,
            naturalist: 0,
        };
        var index;

        for (index = 0; index < QUESTIONS.length; index += 1) {
            var field = QUESTIONS[index].id;
            var value = answers[field];

            if (value && Object.prototype.hasOwnProperty.call(scores, value)) {
                scores[value] += 1;
            }
        }

        var winner = 'creative';
        var winnerScore = -1;
        var keys = Object.keys(scores);

        keys.forEach(function (key) {
            if (scores[key] > winnerScore) {
                winner = key;
                winnerScore = scores[key];
            }
        });

        return Object.assign({ scores: scores }, PROFILES[winner]);
    }

    function renderResult(container, result, createdAt, options) {
        options = options || {};

        container.innerHTML = (
            '<div class="comunidade-survey__success comunidade-genius-result">' +
                '<div class="comunidade-genius-result__badge">' + escapeHtml(result.emoji) + '</div>' +
                '<h2 class="comunidade-survey__success-title">O perfil de génio do teu filho é: ' + escapeHtml(result.label) + '</h2>' +
                (createdAt ?
                    '<p class="comunidade-genius-result__meta">Resultado guardado em ' + escapeHtml(formatDate(createdAt)) + '</p>' :
                    '') +
                '<p class="comunidade-survey__success-text">' + escapeHtml(result.summary) + '</p>' +
                '<div class="comunidade-genius-result__tips">' +
                    '<strong>Como apoiar este perfil:</strong>' +
                    '<p>' + escapeHtml(result.tips) + '</p>' +
                '</div>' +
                (options.showGuideHint !== false ?
                    '<p class="comunidade-genius-result__next">Consulta também o «Guia para descobrir o Génio 🧠» neste módulo para aprofundar e aplicar no dia a dia.</p>' :
                    '') +
            '</div>'
        );
    }

    function renderForm(container, options) {
        var previewMode = Boolean(options.previewMode);
        var previewBanner = previewMode ? (
            '<div class="comunidade-alert comunidade-alert--info comunidade-survey__preview-banner">' +
                '<strong>Pré-visualização de admin.</strong> Assim veem os membros. ' +
                'As respostas ficam guardadas por membro na base de dados.' +
            '</div>'
        ) : '';

        container.innerHTML = (
            '<div class="comunidade-survey">' +
                previewBanner +
                '<div class="comunidade-survey__hero">' +
                    '<h2 class="comunidade-survey__title">Teste para Descobrir o Génio 🧠</h2>' +
                    '<p class="comunidade-survey__intro">Responde pensando no teu filho ou filha. Este teste rápido ajuda-te a identificar o perfil de aprendizagem dominante e a perceber como despertar o génio que já existe nele.</p>' +
                    '<p class="comunidade-survey__intro">São 8 perguntas simples. No fim, vais receber o perfil de génio mais provável e sugestões práticas para aplicares já no dia a dia.</p>' +
                    '<p class="comunidade-survey__note"><span>*</span> Pergunta obrigatória</p>' +
                '</div>' +
                '<div class="comunidade-alert comunidade-alert--error" id="genius-test-error" hidden></div>' +
                '<form class="comunidade-survey__form" id="genius-test-form">' +
                    QUESTIONS.map(renderQuestion).join('') +
                    (previewMode ?
                        '<p class="comunidade-survey__preview-note">Modo pré-visualização — apenas membros podem enviar respostas.</p>' :
                        '<button class="comunidade-btn comunidade-btn--primary comunidade-survey__submit" type="submit">Ver o meu resultado</button>') +
                '</form>' +
            '</div>'
        );

        if (previewMode) {
            container.querySelectorAll('input, textarea, select').forEach(function (field) {
                field.disabled = true;
            });
            return;
        }

        var form = container.querySelector('#genius-test-form');
        var errorBox = container.querySelector('#genius-test-error');
        var productId = options.productId;
        var moduleId = options.moduleId;

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            errorBox.hidden = true;

            var submitBtn = form.querySelector('.comunidade-survey__submit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'A calcular…';

            var payload = {
                product_id: productId,
                module_id: moduleId,
                survey_id: SURVEY_ID,
                answers: collectAnswers(form),
            };

            var submitResponse = await window.ComunidadeAuth.apiFetch('/api/comunidade/survey', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            var submitData = await submitResponse.json();

            if (!submitResponse.ok) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Ver o meu resultado';
                errorBox.hidden = false;
                errorBox.textContent = submitData.error || 'Não foi possível enviar o teste.';
                return;
            }

            if (typeof options.onComplete === 'function') {
                options.onComplete();
            }

            renderResult(container, submitData.result || computeResult(payload.answers), submitData.created_at);
        });
    }

    async function mount(container, options) {
        if (!container) {
            return;
        }

        options = options || {};
        container.hidden = false;
        container.innerHTML = '<p class="comunidade-panel__subtitle" style="margin:0;">A carregar teste…</p>';

        if (options.previewMode) {
            renderForm(container, options);
            return;
        }

        var response = await window.ComunidadeAuth.apiFetch(
            '/api/comunidade/survey?product_id=' + encodeURIComponent(options.productId) +
            '&survey_id=' + encodeURIComponent(SURVEY_ID)
        );
        var data = await response.json();

        if (!response.ok) {
            container.innerHTML = '<div class="comunidade-alert comunidade-alert--error">' + escapeHtml(data.error || 'Erro ao carregar o teste.') + '</div>';
            return;
        }

        if (data.submitted) {
            if (typeof options.onComplete === 'function') {
                options.onComplete();
            }

            renderResult(container, data.result || computeResult(data.answers || {}), data.created_at);
            return;
        }

        renderForm(container, options);
    }

    function unmount(container) {
        if (container) {
            container.hidden = true;
            container.innerHTML = '';
        }
    }

    window.ComunidadeGeniusTest = {
        SURVEY_ID: SURVEY_ID,
        LESSON_TITLE_MATCH: LESSON_TITLE_MATCH,
        isGeniusTestLesson: isGeniusTestLesson,
        mount: mount,
        unmount: unmount,
    };
})();
