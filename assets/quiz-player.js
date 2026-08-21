(function () {
    'use strict';

    var config = window.__QUIZ__ || {};
    var root = document.getElementById('quiz-root');

    if (!root || !config.questions || !config.questions.length) {
        if (root) {
            root.innerHTML = '<p>Quiz indisponível.</p>';
        }
        return;
    }

    var state = {
        index: 0,
        answers: {},
        email: '',
        full_name: '',
        phone: '',
        submitting: false,
        result: null,
    };

    function track(name, payload) {
        if (window.OndaTracking && typeof window.OndaTracking.pushEvent === 'function') {
            window.OndaTracking.pushEvent(name, Object.assign({
                offer_id: config.offer_id,
                offer_slug: config.offer_slug,
                funnel_id: config.funnel_id,
                funnel_slug: config.funnel_slug,
            }, payload || {}), { meta: false });
        }
    }

    function escapeHtml(value) {
        return String(value || '')
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;');
    }

    function currentQuestion() {
        return config.questions[state.index];
    }

    function progressPercent() {
        return Math.round(((state.index + 1) / config.questions.length) * 100);
    }

    function getSelected(question) {
        return state.answers[question.id];
    }

    function setSelected(question, value) {
        state.answers[question.id] = value;

        if (question.question_type === 'email' && typeof value === 'string') {
            state.email = value;
        }

        track('quiz_answered', {
            question_id: question.id,
            question_type: question.question_type,
        });
    }

    function validateCurrent() {
        var question = currentQuestion();

        if (!question.required) {
            return true;
        }

        var value = getSelected(question);

        if (question.question_type === 'multiple') {
            return Array.isArray(value) && value.length > 0;
        }

        return Boolean(String(value || '').trim());
    }

    function renderOptions(question) {
        if (question.question_type === 'text' || question.question_type === 'email') {
            var inputType = question.question_type === 'email' ? 'email' : 'text';
            return '<input class="quiz-input" type="' + inputType + '" data-quiz-input value="' +
                escapeHtml(getSelected(question) || '') + '" placeholder="' +
                (question.question_type === 'email' ? 'O teu email' : 'A tua resposta') + '">';
        }

        var selected = getSelected(question);
        var multi = question.question_type === 'multiple';
        var inputType = multi ? 'checkbox' : 'radio';

        return '<div class="quiz-options">' + (question.answers || []).map(function (answer) {
            var isSelected = multi
                ? Array.isArray(selected) && selected.indexOf(answer.id) !== -1
                : selected === answer.id;

            return '<label class="quiz-option' + (isSelected ? ' is-selected' : '') + '">' +
                '<input type="' + inputType + '" name="q-' + escapeHtml(question.id) + '" value="' +
                escapeHtml(answer.id) + '"' + (isSelected ? ' checked' : '') + '>' +
                '<span>' + escapeHtml(answer.label) + '</span></label>';
        }).join('') + '</div>';
    }

    function renderQuestionView() {
        var question = currentQuestion();

        root.innerHTML =
            '<div class="quiz-progress"><div class="quiz-progress__bar" style="width:' +
            progressPercent() + '%"></div></div>' +
            '<div class="quiz-card">' +
                '<h2 class="quiz-question">' + escapeHtml(question.question) + '</h2>' +
                renderOptions(question) +
                '<p class="quiz-error" id="quiz-error" hidden></p>' +
                '<div class="quiz-actions">' +
                    (state.index > 0
                        ? '<button type="button" class="quiz-button quiz-button--ghost" data-quiz-back>Voltar</button>'
                        : '<span></span>') +
                    '<button type="button" class="quiz-button quiz-button--primary" data-quiz-next>' +
                    (state.index === config.questions.length - 1 ? 'Ver resultado' : 'Continuar') +
                    '</button></div></div>';

        track('quiz_question_viewed', { question_id: question.id, step: state.index + 1 });

        root.querySelectorAll('.quiz-option input').forEach(function (input) {
            input.addEventListener('change', function () {
                if (question.question_type === 'multiple') {
                    var values = Array.from(root.querySelectorAll('.quiz-option input:checked'))
                        .map(function (node) { return node.value; });
                    setSelected(question, values);
                } else {
                    setSelected(question, input.value);
                }
                renderQuestionView();
            });
        });

        var textInput = root.querySelector('[data-quiz-input]');

        if (textInput) {
            textInput.addEventListener('input', function () {
                setSelected(question, textInput.value);
            });
        }

        var backBtn = root.querySelector('[data-quiz-back]');

        if (backBtn) {
            backBtn.addEventListener('click', function () {
                state.index -= 1;
                renderQuestionView();
            });
        }

        root.querySelector('[data-quiz-next]').addEventListener('click', function () {
            if (!validateCurrent()) {
                var errorEl = document.getElementById('quiz-error');
                errorEl.hidden = false;
                errorEl.textContent = 'Responde à pergunta para continuar.';
                return;
            }

            if (state.index < config.questions.length - 1) {
                state.index += 1;
                renderQuestionView();
                return;
            }

            submitQuiz();
        });
    }

    function resolveResult(totalScore) {
        var rows = config.results || [];
        var match = rows.find(function (row) {
            return totalScore >= row.min_score && totalScore <= row.max_score;
        });

        return match || rows[0] || null;
    }

    function renderResultView(result, totalScore) {
        track('quiz_result_viewed', {
            result_id: result.id,
            total_score: totalScore,
        });

        var ctaHref = result.checkout_url || '/checkout/?offer=' + encodeURIComponent(config.offer_slug);

        root.innerHTML =
            '<div class="quiz-card quiz-result">' +
                '<h2 class="quiz-result__title">' + escapeHtml(result.title || 'Resultado') + '</h2>' +
                '<p class="quiz-result__desc">' + escapeHtml(result.description || '') + '</p>' +
                '<button type="button" class="quiz-button quiz-button--primary" data-quiz-cta>' +
                escapeHtml(result.cta_label || 'Continuar') + '</button></div>';

        root.querySelector('[data-quiz-cta]').addEventListener('click', function () {
            track('quiz_completed', {
                total_score: totalScore,
                result_id: result.id,
            });

            if (result.cta_action === 'checkout') {
                window.location.href = ctaHref;
                return;
            }

            window.location.href = ctaHref;
        });
    }

    async function submitQuiz() {
        if (state.submitting) {
            return;
        }

        state.submitting = true;
        root.innerHTML = '<div class="quiz-card"><p>A calcular resultado…</p></div>';

        try {
            var response = await fetch(config.submit_url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    offer: config.offer_slug,
                    funnel: config.funnel_slug,
                    answers: state.answers,
                    email: state.email,
                    full_name: state.full_name,
                    phone: state.phone,
                    metadata: {},
                }),
            });

            var payload = await response.json();

            if (!response.ok) {
                throw new Error(payload.error || 'Não foi possível submeter o quiz.');
            }

            track('quiz_completed', {
                submission_id: payload.submission_id,
                total_score: payload.total_score,
            });

            var result = payload.result || resolveResult(payload.total_score || 0);
            renderResultView(result, payload.total_score || 0);
        } catch (error) {
            state.submitting = false;
            var fallback = resolveResult(0);
            renderResultView(fallback, 0);
        }
    }

    function renderIntro() {
        root.innerHTML =
            '<h1 class="quiz-headline">' + escapeHtml(config.headline || 'Quiz') + '</h1>' +
            '<p class="quiz-intro">' + escapeHtml(config.intro || '') + '</p>' +
            '<div class="quiz-card">' +
                '<button type="button" class="quiz-button quiz-button--primary" data-quiz-start>Começar quiz</button>' +
            '</div>';

        root.querySelector('[data-quiz-start]').addEventListener('click', function () {
            track('quiz_started');
            renderQuestionView();
        });
    }

    track('page_view', { page_type: 'quiz' });
    renderIntro();
})();
