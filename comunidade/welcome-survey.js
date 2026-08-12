(function () {
    var LESSON_TITLE_MATCH = 'Questionário Inicial';

    var QUESTIONS = [
        {
            id: 'child_age',
            otherId: 'child_age_other',
            label: 'Que idade exacta tem o teu filho ou filha actualmente?',
            type: 'radio',
            options: [
                '4 anos', '5 anos', '6 anos', '7 anos', '8 anos', '9 anos', '10 anos',
                '11 anos', '12 anos', '13 anos', '14 anos', '15 anos', '16 anos',
                { value: '__other__', label: 'Outro', hasOther: true },
            ],
        },
        {
            id: 'main_challenge',
            otherId: 'main_challenge_other',
            label: 'Qual é o principal desafio que o teu filho enfrenta hoje na aprendizagem?',
            type: 'radio',
            options: [
                'Falta de concentração e foco (Distrai-se com muita facilidade)',
                'Problemas com a leitura, escrita ou compreensão de textos',
                'Dificuldade extrema com matemática ou operações lógicas',
                'Baixa autoestima, insegurança ou medo de bloquear em exames',
                'Já tem um diagnóstico médico ou escolar (TDAH, dislexia, etc.)',
                { value: '__other__', label: 'Outro', hasOther: true },
            ],
        },
        {
            id: 'daily_situation',
            otherId: 'daily_situation_other',
            label: 'Com qual destas situações te identificas mais no dia a dia?',
            type: 'radio',
            options: [
                'Sinto que o meu filho é um «Estudante Zumbi»: está sentado à frente do caderno, mas a mente está completamente desligada.',
                'Vivemos presos num «Lodo Mental»: lê o mesmo parágrafo dez vezes e no fim a mente continua em branco.',
                'Os trabalhos que deviam levar 20 minutos transformam-se em batalhas de 3 horas cheias de choro e frustração.',
                'Parte-me o coração ver que o meu filho já acreditou na mentira de que «é burro» ou incapaz.',
                { value: '__other__', label: 'Outro', hasOther: true },
            ],
        },
        {
            id: 'biggest_fear',
            label: 'Honestamente, qual é o teu maior medo ou frustração actual em relação ao futuro do teu filho se não conseguir superar este bloqueio?',
            type: 'textarea',
        },
        {
            id: 'tried_alternatives',
            label: 'Que outras alternativas tentaste anteriormente para o ajudar?',
            type: 'radio',
            options: [
                'Explicações particulares, aulas de reforço ou apoio escolar',
                'Terapias com especialistas (psicopedagogia, terapia ocupacional, etc.)',
                'Medicação ou fármacos recomendados',
                'Rotinas em casa e conselhos que não deram resultados',
                'Nenhuma — o Onda Prodígio é a primeira coisa que tentámos',
            ],
        },
        {
            id: 'purchase_reason',
            label: 'O que foi que mais te chamou a atenção ou te convenceu a adquirir o Onda Prodígio?',
            type: 'textarea',
        },
        {
            id: 'priority_result',
            otherId: 'priority_result_other',
            label: 'Se pudesses pedir um único resultado prioritário para as próximas 3 semanas, qual seria?',
            type: 'radio',
            options: [
                'Que termine os trabalhos rápido (em 20 minutos) e sem brigas em casa.',
                'Vê-lo sorrir, perder o medo e recuperar a segurança em si próprio.',
                'Que a professora deixe de enviar queixas e eu possa voltar a sorrir.',
                'Que perceba as coisas à primeira e deixe de frustrar-se.',
                { value: '__other__', label: 'Outro', hasOther: true },
            ],
        },
        {
            id: 'relationship',
            otherId: 'relationship_other',
            label: 'Qual é a tua relação principal com a criança que vai usar o Onda Prodígio?',
            type: 'radio',
            options: [
                'Sou o pai / a mãe / tutor legal.',
                'Sou professor(a) / educador(a) / docente.',
                'Ambos (Sou pai/mãe e também me dedico à educação).',
                { value: '__other__', label: 'Outro (Terapeuta, psicopedagogo, psicólogo, etc.)', hasOther: true },
            ],
        },
    ];

    var activeMount = null;

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

    function isSurveyLesson(aulaItem) {
        return Boolean(aulaItem && aulaItem.title && aulaItem.title.indexOf(LESSON_TITLE_MATCH) !== -1);
    }

    function normalizeOption(option) {
        if (typeof option === 'string') {
            return { value: option, label: option, hasOther: false };
        }

        return option;
    }

    function renderQuestion(question, index) {
        var html = (
            '<div class="comunidade-survey__question" data-question-id="' + question.id + '">' +
                '<div class="comunidade-survey__question-label">' +
                    '<span class="comunidade-survey__question-num">' + (index + 1) + '.</span> ' +
                    escapeHtml(question.label) +
                    ' <span class="comunidade-survey__required">*</span>' +
                '</div>'
        );

        if (question.type === 'textarea') {
            html += (
                '<textarea class="comunidade-survey__textarea" name="' + question.id + '" rows="4" required></textarea>'
            );
        } else {
            html += '<div class="comunidade-survey__options">';

            question.options.forEach(function (option, optionIndex) {
                var normalized = normalizeOption(option);
                var inputId = question.id + '-' + optionIndex;

                html += (
                    '<label class="comunidade-survey__option" for="' + inputId + '">' +
                        '<input type="radio" id="' + inputId + '" name="' + question.id + '" value="' + escapeHtml(normalized.value) + '"' +
                            (normalized.hasOther ? ' data-has-other="true"' : '') +
                        ' required>' +
                        '<span>' + escapeHtml(normalized.label) + '</span>' +
                    '</label>'
                );

                if (normalized.hasOther && question.otherId) {
                    html += (
                        '<input class="comunidade-survey__other" type="text" name="' + question.otherId + '" ' +
                        'placeholder="Especifica aqui…" data-other-for="' + question.id + '" hidden>'
                    );
                }
            });

            html += '</div>';
        }

        html += '</div>';
        return html;
    }

    function bindOtherFields(form) {
        form.querySelectorAll('input[type="radio"][data-has-other="true"]').forEach(function (radio) {
            radio.addEventListener('change', function () {
                var otherInput = form.querySelector('[data-other-for="' + radio.name + '"]');

                if (otherInput) {
                    otherInput.hidden = false;
                    otherInput.required = true;
                    otherInput.focus();
                }
            });
        });

        form.querySelectorAll('input[type="radio"]:not([data-has-other="true"])').forEach(function (radio) {
            radio.addEventListener('change', function () {
                var otherInput = form.querySelector('[data-other-for="' + radio.name + '"]');

                if (otherInput) {
                    otherInput.hidden = true;
                    otherInput.required = false;
                    otherInput.value = '';
                }
            });
        });
    }

    function collectAnswers(form) {
        var answers = {};
        var index;

        for (index = 0; index < QUESTIONS.length; index += 1) {
            var question = QUESTIONS[index];

            if (question.type === 'textarea') {
                var textarea = form.elements[question.id];
                answers[question.id] = textarea ? textarea.value.trim() : '';
                continue;
            }

            var selected = form.querySelector('input[name="' + question.id + '"]:checked');
            answers[question.id] = selected ? selected.value : '';

            if (question.otherId) {
                var otherInput = form.elements[question.otherId];
                answers[question.otherId] = otherInput ? otherInput.value.trim() : '';
            }
        }

        return answers;
    }

    function renderSuccess(container, createdAt) {
        container.innerHTML = (
            '<div class="comunidade-survey__success">' +
                '<h2 class="comunidade-survey__success-title">Obrigado pelas tuas respostas!</h2>' +
                '<p class="comunidade-survey__success-text">Recebemos o teu questionário' +
                    (createdAt ? ' em ' + escapeHtml(formatDate(createdAt)) : '') +
                    '. A equipa vai usar estas informações para te dar o melhor apoio possível.</p>' +
            '</div>'
        );
    }

    function renderForm(container, options) {
        var previewMode = Boolean(options.previewMode);
        var previewBanner = previewMode ? (
            '<div class="comunidade-alert comunidade-alert--info comunidade-survey__preview-banner">' +
                '<strong>Pré-visualização de admin.</strong> Assim veem os membros. ' +
                'As respostas enviadas estão em <a href="/respostaquestionario">/respostaquestionario</a>.' +
            '</div>'
        ) : '';

        container.innerHTML = (
            '<div class="comunidade-survey">' +
                previewBanner +
                '<div class="comunidade-survey__hero">' +
                    '<img src="/comunidade/assets/mascot.png?v=20260812b" alt="Dr. Turbay, mascote Onda Prodígio" class="comunidade-mascot comunidade-mascot--survey" width="320" height="480">' +
                    '<h2 class="comunidade-survey__title">Questionário de Boas-vindas: Onda Prodígio</h2>' +
                    '<p class="comunidade-survey__intro">Damos-te as boas-vindas à família Onda Prodígio!</p>' +
                    '<p class="comunidade-survey__intro">Um grande cumprimento da professora Angela Campos e do Dr. Turbay. Queremos agradecer-te de coração a confiança que depositaste em nós para acompanhar o futuro do teu filho.</p>' +
                    '<p class="comunidade-survey__intro">Por favor, dedica apenas 3 minutos a responder a estas breves perguntas. As tuas respostas permitir-nos-ão conhecer melhor a situação do teu filho e garantir que te damos o apoio exacto de que precisas para despertar a genialidade dele.</p>' +
                    '<p class="comunidade-survey__note"><span>*</span> Pergunta obrigatória</p>' +
                '</div>' +
                '<div class="comunidade-alert comunidade-alert--error" id="survey-error" hidden></div>' +
                '<form class="comunidade-survey__form" id="welcome-survey-form">' +
                    QUESTIONS.map(renderQuestion).join('') +
                    (previewMode ?
                        '<p class="comunidade-survey__preview-note">Modo pré-visualização — apenas membros podem enviar respostas.</p>' :
                        '<button class="comunidade-btn comunidade-btn--primary comunidade-survey__submit" type="submit">Enviar respostas</button>') +
                '</form>' +
            '</div>'
        );

        if (previewMode) {
            container.querySelectorAll('input, textarea, select').forEach(function (field) {
                field.disabled = true;
            });
            return;
        }

        var form = container.querySelector('#welcome-survey-form');
        var errorBox = container.querySelector('#survey-error');
        var productId = options.productId;
        var moduleId = options.moduleId;

        bindOtherFields(form);

        form.addEventListener('submit', async function (event) {
            event.preventDefault();
            errorBox.hidden = true;

            var submitBtn = form.querySelector('.comunidade-survey__submit');
            submitBtn.disabled = true;
            submitBtn.textContent = 'A enviar…';

            var payload = {
                product_id: productId,
                module_id: moduleId,
                answers: collectAnswers(form),
            };

            var submitResponse = await window.ComunidadeAuth.apiFetch('/api/comunidade/survey', {
                method: 'POST',
                body: JSON.stringify(payload),
            });
            var submitData = await submitResponse.json();

            if (!submitResponse.ok) {
                submitBtn.disabled = false;
                submitBtn.textContent = 'Enviar respostas';
                errorBox.hidden = false;
                errorBox.textContent = submitData.error || 'Não foi possível enviar o questionário.';
                return;
            }

            renderSuccess(container, submitData.created_at);
        });
    }

    function renderAdminList(container, submissions, options) {
        options = options || {};

        if (!submissions.length) {
            container.innerHTML = (
                '<div class="comunidade-survey__admin">' +
                    (options.showHeader !== false ?
                        '<h1 class="comunidade-respostas__title">Respostas ao questionário inicial</h1>' +
                        '<p class="comunidade-survey__intro">Ainda não há respostas. Quando os membros preencherem o questionário, aparecem aqui.</p>' :
                        '<p class="comunidade-survey__intro">Ainda não há respostas.</p>') +
                '</div>'
            );
            return;
        }

        container.innerHTML = (
            '<div class="comunidade-survey__admin">' +
                (options.showHeader !== false ?
                    '<div class="comunidade-respostas__header">' +
                        '<div>' +
                            '<h1 class="comunidade-respostas__title">Respostas ao questionário inicial</h1>' +
                            '<p class="comunidade-survey__intro">' + submissions.length + ' resposta(s) · Onda Prodígio</p>' +
                        '</div>' +
                        '<a class="comunidade-btn comunidade-btn--ghost" href="/comunidade/produto?id=onda-prodigio">Ver questionário na aula</a>' +
                    '</div>' :
                    '') +
                submissions.map(function (submission, index) {
                    var answerLines = QUESTIONS.map(function (question) {
                        var value = submission.answers[question.id] || '—';

                        if (submission.answers[question.id] === '__other__' && question.otherId) {
                            value = 'Outro: ' + (submission.answers[question.otherId] || '—');
                        }

                        return (
                            '<div class="comunidade-survey__admin-row">' +
                                '<strong>' + escapeHtml(question.label) + '</strong>' +
                                '<span>' + escapeHtml(value) + '</span>' +
                            '</div>'
                        );
                    }).join('');

                    return (
                        '<article class="comunidade-survey__admin-card">' +
                            '<div class="comunidade-survey__admin-head">' +
                                '<div>' +
                                    '<strong>' + escapeHtml(submission.member_name || 'Membro') + '</strong>' +
                                    '<div class="comunidade-survey__admin-email">' + escapeHtml(submission.member_email || '') + '</div>' +
                                '</div>' +
                                '<span>' + escapeHtml(formatDate(submission.created_at)) + '</span>' +
                            '</div>' +
                            answerLines +
                        '</article>'
                    );
                }).join('') +
            '</div>'
        );
    }

    async function mountResponsesPage(container, productId) {
        container.innerHTML = '<p class="comunidade-panel__subtitle">A carregar respostas…</p>';

        var response = await window.ComunidadeAuth.apiFetch(
            '/api/comunidade/survey?product_id=' + encodeURIComponent(productId)
        );
        var data = await response.json();

        if (!response.ok) {
            container.innerHTML = '<div class="comunidade-alert comunidade-alert--error">' + escapeHtml(data.error || 'Erro ao carregar respostas.') + '</div>';
            return;
        }

        renderAdminList(container, data.submissions || [], { showHeader: true });
    }

    async function mount(container, options) {
        if (!container) {
            return;
        }

        activeMount = { container: container, options: options || {} };
        container.hidden = false;
        container.innerHTML = '<p class="comunidade-panel__subtitle" style="margin:0;">A carregar questionário…</p>';

        var productId = options.productId;
        var moduleId = options.moduleId;

        if (options.previewMode) {
            renderForm(container, {
                productId: productId,
                moduleId: moduleId,
                previewMode: true,
            });
            return;
        }

        var response = await window.ComunidadeAuth.apiFetch(
            '/api/comunidade/survey?product_id=' + encodeURIComponent(productId)
        );
        var data = await response.json();

        if (!response.ok) {
            container.innerHTML = '<div class="comunidade-alert comunidade-alert--error">' + escapeHtml(data.error || 'Erro ao carregar o questionário.') + '</div>';
            return;
        }

        if (data.submitted) {
            renderSuccess(container, data.created_at);
            return;
        }

        renderForm(container, {
            productId: productId,
            moduleId: moduleId,
            previewMode: false,
        });
    }

    function unmount(container) {
        if (container) {
            container.hidden = true;
            container.innerHTML = '';
        }

        activeMount = null;
    }

    window.ComunidadeWelcomeSurvey = {
        LESSON_TITLE_MATCH: LESSON_TITLE_MATCH,
        isSurveyLesson: isSurveyLesson,
        mount: mount,
        mountResponsesPage: mountResponsesPage,
        unmount: unmount,
    };
})();
