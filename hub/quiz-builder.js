(function () {
    'use strict';

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function defaultQuestion() {
        return {
            question: '',
            question_type: 'single',
            required: true,
            answers: [
                { label: '', value: '', score: 0 },
                { label: '', value: '', score: 0 },
            ],
        };
    }

    function defaultResult() {
        return {
            title: 'Plano ideal encontrado',
            description: 'Com base nas tuas respostas, este é o plano recomendado.',
            min_score: 0,
            max_score: 9999,
            cta_label: 'Quero o meu plano',
            cta_action: 'checkout',
        };
    }

    function renderResultEditor(result, index) {
        return '<article class="hub-quiz-result" data-result-index="' + index + '">' +
            '<div class="hub-form-grid">' +
                '<label class="hub-field"><span class="hub-field__label">Título do resultado</span>' +
                '<input class="hub-login__input" data-result-title value="' + escapeHtml(result.title) + '"></label>' +
                '<label class="hub-field"><span class="hub-field__label">CTA</span>' +
                '<input class="hub-login__input" data-result-cta value="' + escapeHtml(result.cta_label || '') + '"></label>' +
                '<label class="hub-field"><span class="hub-field__label">Score mín.</span>' +
                '<input class="hub-login__input" data-result-min type="number" value="' +
                escapeHtml(result.min_score != null ? result.min_score : 0) + '"></label>' +
                '<label class="hub-field"><span class="hub-field__label">Score máx.</span>' +
                '<input class="hub-login__input" data-result-max type="number" value="' +
                escapeHtml(result.max_score != null ? result.max_score : 9999) + '"></label>' +
            '</div>' +
            '<label class="hub-field"><span class="hub-field__label">Descrição</span>' +
            '<input class="hub-login__input" data-result-description value="' +
            escapeHtml(result.description || '') + '"></label>' +
            '<button type="button" class="hub-button hub-button--ghost" data-remove-result="' + index + '">Remover resultado</button>' +
        '</article>';
    }

    function renderQuestionEditor(question, index, total) {
        var answersHtml = (question.answers || []).map(function (answer, answerIndex) {
            return '<div class="hub-quiz-answer">' +
                '<input class="hub-login__input" data-answer-label="' + answerIndex + '" value="' +
                escapeHtml(answer.label) + '" placeholder="Resposta">' +
                '<input class="hub-login__input hub-quiz-score" data-answer-score="' + answerIndex + '" type="number" value="' +
                escapeHtml(answer.score || 0) + '" placeholder="Score">' +
                '<button type="button" class="hub-button hub-button--ghost" data-remove-answer="' + answerIndex + '">✕</button>' +
            '</div>';
        }).join('');

        return '<article class="hub-quiz-question" data-question-index="' + index + '">' +
            '<div class="hub-panel__head">' +
                '<h4>Pergunta ' + (index + 1) + '</h4>' +
                '<div class="hub-quiz-question__actions">' +
                    '<button type="button" class="hub-button hub-button--ghost" data-move-up ' +
                    (index === 0 ? 'disabled' : '') + '>↑</button>' +
                    '<button type="button" class="hub-button hub-button--ghost" data-move-down ' +
                    (index >= total - 1 ? 'disabled' : '') + '>↓</button>' +
                '</div>' +
            '</div>' +
            '<label class="hub-field"><span class="hub-field__label">Pergunta</span>' +
            '<input class="hub-login__input" data-question-text value="' + escapeHtml(question.question) + '"></label>' +
            '<label class="hub-field"><span class="hub-field__label">Tipo</span>' +
            '<select class="hub-login__input" data-question-type>' +
                ['single', 'multiple', 'text', 'email'].map(function (type) {
                    return '<option value="' + type + '"' + (question.question_type === type ? ' selected' : '') + '>' + type + '</option>';
                }).join('') +
            '</select></label>' +
            '<div class="hub-quiz-answers" data-answers-wrap>' + answersHtml + '</div>' +
            '<button type="button" class="hub-button hub-button--ghost" data-add-answer>+ Resposta</button>' +
        '</article>';
    }

    function mount(container, options) {
        var offer = options.offer;
        var funnel = options.funnel;
        var apiFetch = options.apiFetch;
        var onStatus = options.onStatus || function () {};
        var state = {
            headline: '',
            intro: '',
            questions: [],
            results: [],
        };

        container.innerHTML = '<p class="hub-panel__sub">A carregar quiz…</p>';

        async function load() {
            var payload = await apiFetch(
                '/api/sales-attribution?action=hub_quiz_get&offer=' +
                    encodeURIComponent(offer.slug) + '&funnel=' + encodeURIComponent(funnel.slug)
            );

            state.headline = (payload.funnel.settings && payload.funnel.settings.headline) || funnel.name;
            state.intro = (payload.funnel.settings && payload.funnel.settings.intro) || '';
            state.questions = (payload.quiz && payload.quiz.questions) || [];
            state.results = (payload.quiz && payload.quiz.results) || [];

            if (!state.questions.length) {
                state.questions = [defaultQuestion()];
            }

            if (!state.results.length) {
                state.results = [defaultResult()];
            }

            render();
        }

        function render() {
            var previewUrl = '/preview/' + encodeURIComponent(offer.slug) + '/' +
                encodeURIComponent(funnel.slug) + '/quiz?preview=1';

            container.innerHTML =
                '<div class="hub-quiz-builder">' +
                    '<div class="hub-form-grid">' +
                        '<label class="hub-field"><span class="hub-field__label">Headline</span>' +
                        '<input class="hub-login__input" id="hub-quiz-headline" value="' + escapeHtml(state.headline) + '"></label>' +
                        '<label class="hub-field"><span class="hub-field__label">Intro</span>' +
                        '<input class="hub-login__input" id="hub-quiz-intro" value="' + escapeHtml(state.intro) + '"></label>' +
                    '</div>' +
                    '<div id="hub-quiz-questions">' +
                        state.questions.map(function (question, index) {
                            return renderQuestionEditor(question, index, state.questions.length);
                        }).join('') +
                    '</div>' +
                    '<h4 class="hub-quiz-builder__section">Resultados por score</h4>' +
                    '<div id="hub-quiz-results">' +
                        state.results.map(function (result, index) {
                            return renderResultEditor(result, index);
                        }).join('') +
                    '</div>' +
                    '<div class="hub-actions">' +
                        '<button type="button" class="hub-button hub-button--ghost" id="hub-quiz-add">+ Pergunta</button>' +
                        '<button type="button" class="hub-button hub-button--ghost" id="hub-quiz-add-result">+ Resultado</button>' +
                        '<button type="button" class="hub-button" id="hub-quiz-save">Guardar</button>' +
                        '<button type="button" class="hub-button hub-button--ghost" id="hub-quiz-publish">Publicar</button>' +
                        '<a class="hub-link" href="' + previewUrl + '" target="_blank" rel="noopener">Preview Quiz</a>' +
                    '</div>' +
                    '<p class="hub-form-message" id="hub-quiz-message" hidden></p>' +
                '</div>';

            bindEvents();
        }

        function syncFromDom() {
            state.headline = container.querySelector('#hub-quiz-headline').value.trim();
            state.intro = container.querySelector('#hub-quiz-intro').value.trim();

            state.questions = Array.from(container.querySelectorAll('.hub-quiz-question')).map(function (node) {
                var answers = Array.from(node.querySelectorAll('.hub-quiz-answer')).map(function (answerNode) {
                    var labelInput = answerNode.querySelector('[data-answer-label]');
                    var scoreInput = answerNode.querySelector('[data-answer-score]');
                    var label = labelInput.value.trim();

                    return {
                        label: label,
                        value: label,
                        score: Number(scoreInput.value) || 0,
                    };
                });

                return {
                    question: node.querySelector('[data-question-text]').value.trim(),
                    question_type: node.querySelector('[data-question-type]').value,
                    required: true,
                    answers: answers,
                };
            });

            state.results = Array.from(container.querySelectorAll('.hub-quiz-result')).map(function (node) {
                return {
                    title: node.querySelector('[data-result-title]').value.trim(),
                    description: node.querySelector('[data-result-description]').value.trim(),
                    min_score: Number(node.querySelector('[data-result-min]').value) || 0,
                    max_score: Number(node.querySelector('[data-result-max]').value) || 9999,
                    cta_label: node.querySelector('[data-result-cta]').value.trim() || 'Continuar',
                    cta_action: 'checkout',
                };
            });
        }

        function bindEvents() {
            container.querySelector('#hub-quiz-add').addEventListener('click', function () {
                syncFromDom();
                state.questions.push(defaultQuestion());
                render();
            });

            container.querySelector('#hub-quiz-add-result').addEventListener('click', function () {
                syncFromDom();
                state.results.push(defaultResult());
                render();
            });

            container.querySelector('#hub-quiz-save').addEventListener('click', saveQuiz);
            container.querySelector('#hub-quiz-publish').addEventListener('click', publishQuiz);

            container.querySelectorAll('[data-remove-result]').forEach(function (button) {
                button.addEventListener('click', function () {
                    var index = Number(button.getAttribute('data-remove-result'));
                    syncFromDom();
                    state.results.splice(index, 1);

                    if (!state.results.length) {
                        state.results = [defaultResult()];
                    }

                    render();
                });
            });

            container.querySelectorAll('[data-move-up]').forEach(function (button) {
                button.addEventListener('click', function () {
                    var index = Number(button.closest('.hub-quiz-question').getAttribute('data-question-index'));
                    syncFromDom();

                    if (index > 0) {
                        var tmp = state.questions[index - 1];
                        state.questions[index - 1] = state.questions[index];
                        state.questions[index] = tmp;
                        render();
                    }
                });
            });

            container.querySelectorAll('[data-move-down]').forEach(function (button) {
                button.addEventListener('click', function () {
                    var index = Number(button.closest('.hub-quiz-question').getAttribute('data-question-index'));
                    syncFromDom();

                    if (index < state.questions.length - 1) {
                        var tmp = state.questions[index + 1];
                        state.questions[index + 1] = state.questions[index];
                        state.questions[index] = tmp;
                        render();
                    }
                });
            });

            container.querySelectorAll('[data-add-answer]').forEach(function (button) {
                button.addEventListener('click', function () {
                    var index = Number(button.closest('.hub-quiz-question').getAttribute('data-question-index'));
                    syncFromDom();
                    state.questions[index].answers = state.questions[index].answers || [];
                    state.questions[index].answers.push({ label: '', value: '', score: 0 });
                    render();
                });
            });

            container.querySelectorAll('[data-remove-answer]').forEach(function (button) {
                button.addEventListener('click', function () {
                    var questionNode = button.closest('.hub-quiz-question');
                    var questionIndex = Number(questionNode.getAttribute('data-question-index'));
                    var answerIndex = Number(button.getAttribute('data-remove-answer'));
                    syncFromDom();
                    state.questions[questionIndex].answers.splice(answerIndex, 1);
                    render();
                });
            });
        }

        async function saveQuiz() {
            var messageEl = container.querySelector('#hub-quiz-message');
            messageEl.hidden = true;
            syncFromDom();

            try {
                onStatus('A guardar quiz…');
                await apiFetch('/api/sales-attribution?action=hub_quiz_save', {
                    method: 'POST',
                    body: {
                        offer: offer.slug,
                        funnel: funnel.slug,
                        settings: {
                            headline: state.headline,
                            intro: state.intro,
                        },
                        questions: state.questions,
                        results: state.results.length ? state.results : [defaultResult()],
                    },
                });
                onStatus('');
                messageEl.textContent = 'Quiz guardado.';
                messageEl.hidden = false;
                await load();
            } catch (error) {
                onStatus('');
                messageEl.textContent = error.message;
                messageEl.hidden = false;
            }
        }

        async function publishQuiz() {
            await saveQuiz();

            try {
                onStatus('A publicar quiz…');
                var payload = await apiFetch('/api/sales-attribution?action=hub_quiz_publish', {
                    method: 'POST',
                    body: {
                        offer: offer.slug,
                        funnel: funnel.slug,
                        page: 'quiz',
                    },
                });
                onStatus('');
                var messageEl = container.querySelector('#hub-quiz-message');
                messageEl.textContent = 'Quiz publicado: ' + (payload.public_url || '');
                messageEl.hidden = false;
            } catch (error) {
                onStatus('');
                var messageEl = container.querySelector('#hub-quiz-message');
                messageEl.textContent = error.message;
                messageEl.hidden = false;
            }
        }

        return load().catch(function (error) {
            container.innerHTML = '<p class="hub-panel__sub">' + escapeHtml(error.message) + '</p>';
        });
    }

    window.HubQuizBuilder = {
        mount: mount,
    };
})();
