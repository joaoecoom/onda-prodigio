'use strict';

var crypto = require('crypto');
var validation = require('./validation');
var constants = require('./constants');

function createMemoryStore() {
    var state = {
        quiz_questions: [],
        quiz_answers: [],
        quiz_results: [],
        quiz_submissions: [],
        funnels: [],
    };

    function uuid() {
        return crypto.randomUUID();
    }

    return {
        state: state,
        setFunnels: function (rows) {
            state.funnels = rows.slice();
        },
        async insertRow(table, row) {
            var record = Object.assign({}, row, {
                id: row.id || uuid(),
                created_at: row.created_at || new Date().toISOString(),
                updated_at: row.updated_at || new Date().toISOString(),
            });
            state[table].push(record);
            return Object.assign({}, record);
        },
        async updateRow(table, id, patch) {
            var index = state[table].findIndex(function (row) { return row.id === id; });

            if (index === -1) {
                throw new Error('Registo não encontrado.');
            }

            state[table][index] = Object.assign({}, state[table][index], patch, {
                updated_at: new Date().toISOString(),
            });

            return Object.assign({}, state[table][index]);
        },
        async deleteRow(table, id) {
            if (table === 'quiz_questions') {
                state.quiz_answers = state.quiz_answers.filter(function (row) {
                    return row.question_id !== id;
                });
            }

            state[table] = state[table].filter(function (row) { return row.id !== id; });
        },
        async getById(table, id) {
            var row = state[table].find(function (item) { return item.id === id; });
            return row ? Object.assign({}, row) : null;
        },
        async listQuestions(funnelId) {
            return state.quiz_questions
                .filter(function (row) { return row.funnel_id === funnelId; })
                .sort(function (a, b) { return a.position - b.position; })
                .map(function (row) { return Object.assign({}, row); });
        },
        async listAnswersForQuestions(questionIds) {
            return state.quiz_answers
                .filter(function (row) { return questionIds.indexOf(row.question_id) !== -1; })
                .sort(function (a, b) { return a.position - b.position; })
                .map(function (row) { return Object.assign({}, row); });
        },
        async listResults(funnelId) {
            return state.quiz_results
                .filter(function (row) { return row.funnel_id === funnelId; })
                .sort(function (a, b) { return a.sort_order - b.sort_order; })
                .map(function (row) { return Object.assign({}, row); });
        },
        async insertSubmission(row) {
            return this.insertRow('quiz_submissions', row);
        },
        async deleteQuestionsByFunnel(funnelId) {
            var questionIds = state.quiz_questions
                .filter(function (row) { return row.funnel_id === funnelId; })
                .map(function (row) { return row.id; });

            state.quiz_answers = state.quiz_answers.filter(function (row) {
                return questionIds.indexOf(row.question_id) === -1;
            });
            state.quiz_questions = state.quiz_questions.filter(function (row) {
                return row.funnel_id !== funnelId;
            });
        },
        async deleteResultsByFunnel(funnelId) {
            state.quiz_results = state.quiz_results.filter(function (row) {
                return row.funnel_id !== funnelId;
            });
        },
    };
}

function createService(store) {
    var repo = store;

    function notFound(message) {
        var error = new Error(message || 'Não encontrado.');
        error.code = 'NOT_FOUND';
        return error;
    }

    function crossOfferError() {
        var error = new Error('Operação recusada: recurso não pertence à oferta.');
        error.code = 'CROSS_OFFER_ACCESS';
        return error;
    }

    async function assertFunnelBelongsToOffer(funnelId, offerId) {
        var funnel = await repo.getById('funnels', funnelId);

        if (!funnel) {
            throw notFound('Funnel não encontrado.');
        }

        if (funnel.offer_id !== offerId) {
            throw crossOfferError();
        }

        if (funnel.type !== 'quiz') {
            var typeError = new Error('Funnel não é do tipo quiz.');
            typeError.code = 'INVALID_FUNNEL_TYPE';
            throw typeError;
        }

        return funnel;
    }

    async function assertQuestionBelongsToOffer(questionId, offerId) {
        var question = await repo.getById('quiz_questions', questionId);

        if (!question) {
            throw notFound('Pergunta não encontrada.');
        }

        if (question.offer_id !== offerId) {
            throw crossOfferError();
        }

        return question;
    }

    async function loadQuizBundle(funnelId, offerId) {
        await assertFunnelBelongsToOffer(funnelId, offerId);

        var questions = await repo.listQuestions(funnelId);
        var questionIds = questions.map(function (q) { return q.id; });
        var answers = await repo.listAnswersForQuestions(questionIds);
        var results = await repo.listResults(funnelId);

        var answersByQuestion = {};

        answers.forEach(function (answer) {
            if (!answersByQuestion[answer.question_id]) {
                answersByQuestion[answer.question_id] = [];
            }

            answersByQuestion[answer.question_id].push(answer);
        });

        return {
            questions: questions.map(function (question) {
                return Object.assign({}, question, {
                    answers: answersByQuestion[question.id] || [],
                });
            }),
            results: results,
        };
    }

    async function getQuizBySlugs(offerId, funnelSlug) {
        var funnel = await repo.getFunnelByOfferAndSlug(offerId, funnelSlug);

        if (!funnel) {
            throw notFound('Funnel não encontrado.');
        }

        return loadQuizBundle(funnel.id, offerId);
    }

    async function saveQuizDefinition(offerId, funnelId, payload) {
        var funnel = await assertFunnelBelongsToOffer(funnelId, offerId);
        var questions = Array.isArray(payload.questions) ? payload.questions : [];
        var results = Array.isArray(payload.results) ? payload.results : [];

        await repo.deleteQuestionsByFunnel(funnelId);
        await repo.deleteResultsByFunnel(funnelId);

        var savedQuestions = [];

        for (var qIndex = 0; qIndex < questions.length; qIndex += 1) {
            var normalizedQuestion = validation.normalizeQuestion(questions[qIndex]);
            var questionRow = await repo.insertRow('quiz_questions', Object.assign({}, normalizedQuestion, {
                funnel_id: funnelId,
                offer_id: offerId,
                position: (qIndex + 1) * 100,
            }));

            var answers = Array.isArray(questions[qIndex].answers) ? questions[qIndex].answers : [];
            var savedAnswers = [];

            for (var aIndex = 0; aIndex < answers.length; aIndex += 1) {
                var normalizedAnswer = validation.normalizeAnswer(answers[aIndex]);
                var answerRow = await repo.insertRow('quiz_answers', Object.assign({}, normalizedAnswer, {
                    question_id: questionRow.id,
                    offer_id: offerId,
                    position: (aIndex + 1) * 100,
                }));
                savedAnswers.push(answerRow);
            }

            savedQuestions.push(Object.assign({}, questionRow, { answers: savedAnswers }));
        }

        var savedResults = [];

        for (var rIndex = 0; rIndex < results.length; rIndex += 1) {
            var normalizedResult = validation.normalizeResult(results[rIndex]);
            var resultRow = await repo.insertRow('quiz_results', Object.assign({}, normalizedResult, {
                funnel_id: funnelId,
                offer_id: offerId,
                sort_order: (rIndex + 1) * 100,
            }));
            savedResults.push(resultRow);
        }

        if (!savedResults.length) {
            var defaultResult = await repo.insertRow('quiz_results', Object.assign({}, constants.DEFAULT_RESULT, {
                funnel_id: funnelId,
                offer_id: offerId,
                sort_order: 100,
            }));
            savedResults.push(defaultResult);
        }

        return {
            funnel: funnel,
            questions: savedQuestions,
            results: savedResults,
        };
    }

    async function createQuestion(offerId, funnelId, input) {
        await assertFunnelBelongsToOffer(funnelId, offerId);
        var normalized = validation.normalizeQuestion(input);
        var row = await repo.insertRow('quiz_questions', Object.assign({}, normalized, {
            funnel_id: funnelId,
            offer_id: offerId,
        }));
        return Object.assign({}, row, { answers: [] });
    }

    async function updateQuestion(offerId, questionId, input) {
        await assertQuestionBelongsToOffer(questionId, offerId);
        var normalized = validation.normalizeQuestion(input);
        var row = await repo.updateRow('quiz_questions', questionId, normalized);
        var answers = await repo.listAnswersForQuestions([questionId]);
        return Object.assign({}, row, { answers: answers });
    }

    async function createAnswer(offerId, questionId, input) {
        var question = await assertQuestionBelongsToOffer(questionId, offerId);
        var normalized = validation.normalizeAnswer(input);
        var row = await repo.insertRow('quiz_answers', Object.assign({}, normalized, {
            question_id: questionId,
            offer_id: offerId,
        }));
        return row;
    }

    async function updateAnswer(offerId, answerId, input) {
        var answer = await repo.getById('quiz_answers', answerId);

        if (!answer) {
            throw notFound('Resposta não encontrada.');
        }

        if (answer.offer_id !== offerId) {
            throw crossOfferError();
        }

        var normalized = validation.normalizeAnswer(input);
        return repo.updateRow('quiz_answers', answerId, normalized);
    }

    function resolveResultForScore(results, totalScore) {
        var rows = results || [];
        var match = rows.find(function (row) {
            return totalScore >= row.min_score && totalScore <= row.max_score;
        });

        return match || rows[0] || null;
    }

    function computeScore(questions, answersPayload) {
        var total = 0;
        var answerMap = answersPayload || {};

        (questions || []).forEach(function (question) {
            var selected = answerMap[question.id];

            if (!selected) {
                return;
            }

            if (question.question_type === 'single') {
                var single = (question.answers || []).find(function (answer) {
                    return answer.id === selected || answer.value === selected;
                });

                if (single) {
                    total += Number(single.score) || 0;
                }
            }

            if (question.question_type === 'multiple' && Array.isArray(selected)) {
                selected.forEach(function (value) {
                    var multi = (question.answers || []).find(function (answer) {
                        return answer.id === value || answer.value === value;
                    });

                    if (multi) {
                        total += Number(multi.score) || 0;
                    }
                });
            }
        });

        return total;
    }

    async function submitQuiz(offerId, funnelId, payload) {
        var funnel = await repo.getById('funnels', funnelId);

        if (!funnel || funnel.offer_id !== offerId) {
            throw crossOfferError();
        }

        var bundle = await loadQuizBundle(funnelId, offerId);
        var totalScore = computeScore(bundle.questions, payload.answers || {});
        var result = resolveResultForScore(bundle.results, totalScore);
        var submission = await repo.insertSubmission({
            funnel_id: funnelId,
            offer_id: offerId,
            email: String(payload.email || '').trim(),
            full_name: String(payload.full_name || '').trim(),
            phone: String(payload.phone || '').trim(),
            answers: payload.answers || {},
            total_score: totalScore,
            result_id: result ? result.id : null,
            metadata: payload.metadata || {},
        });

        return {
            submission: submission,
            total_score: totalScore,
            result: result,
        };
    }

    return {
        loadQuizBundle: loadQuizBundle,
        getQuizBySlugs: getQuizBySlugs,
        saveQuizDefinition: saveQuizDefinition,
        createQuestion: createQuestion,
        updateQuestion: updateQuestion,
        createAnswer: createAnswer,
        updateAnswer: updateAnswer,
        submitQuiz: submitQuiz,
        resolveResultForScore: resolveResultForScore,
        computeScore: computeScore,
    };
}

function createDefaultService() {
    var repo = require('./repository');
    var funnelRepo = require('../funnel-engine/repository');

    return createService(Object.assign({}, repo, {
        getFunnelByOfferAndSlug: funnelRepo.getFunnelByOfferAndSlug,
        getById: function (table, id) {
            if (table === 'funnels') {
                return funnelRepo.getById('funnels', id);
            }

            return repo.getById(table, id);
        },
    }));
}

module.exports = {
    createService: createService,
    createMemoryStore: createMemoryStore,
    createDefaultService: createDefaultService,
};
