'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var orderMetrics = require('../lib/hub/order-metrics');

function sale(overrides) {
    return Object.assign({
        status: 'paid',
        is_hub_order: true,
        amount_eur: 10,
        funnel_slug: '',
        page_slug: '',
    }, overrides);
}

test('summarizeFunnelBreakdown groups quiz and vsl', function () {
    var rows = orderMetrics.summarizeFunnelBreakdown([
        sale({ funnel_slug: 'quiz-fruta', page_slug: 'quiz', amount_eur: 10 }),
        sale({ funnel_slug: 'quiz-fruta', page_slug: 'quiz', amount_eur: 12 }),
        sale({ funnel_slug: 'vsl-fruta', page_slug: 'sales', amount_eur: 14 }),
        sale({ funnel_slug: 'vsl-fruta', page_slug: 'sales', amount_eur: 16 }),
    ]);

    assert.equal(rows.length, 2);

    var quiz = rows.find(function (row) { return row.funnel_slug === 'quiz-fruta'; });
    var vsl = rows.find(function (row) { return row.funnel_slug === 'vsl-fruta'; });

    assert.equal(quiz.orders, 2);
    assert.equal(quiz.revenue_eur, 22);
    assert.equal(quiz.aov_eur, 11);
    assert.equal(quiz.page_label, 'quiz');

    assert.equal(vsl.orders, 2);
    assert.equal(vsl.revenue_eur, 30);
    assert.equal(vsl.aov_eur, 15);
});

test('summarizeFunnelBreakdown marks missing funnel as Desconhecido', function () {
    var rows = orderMetrics.summarizeFunnelBreakdown([
        sale({ amount_eur: 10 }),
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].funnel_slug, 'unknown');
    assert.equal(rows[0].funnel_label, 'Desconhecido');
});

test('summarizeFunnelBreakdown excludes refunded orders', function () {
    var rows = orderMetrics.summarizeFunnelBreakdown([
        sale({ funnel_slug: 'vsl-fruta', page_slug: 'sales', amount_eur: 16, status: 'refunded' }),
        sale({ funnel_slug: 'quiz-fruta', page_slug: 'quiz', amount_eur: 10 }),
    ]);

    assert.equal(rows.length, 1);
    assert.equal(rows[0].funnel_slug, 'quiz-fruta');
    assert.equal(rows[0].orders, 1);
});

test('summarizeOrderMetrics computes gross refunds and net', function () {
    var summary = orderMetrics.summarizeOrderMetrics([
        sale({ amount_eur: 10 }),
        sale({ amount_eur: 16, status: 'refunded' }),
    ]);

    assert.equal(summary.orders, 1);
    assert.equal(summary.gross_revenue_eur, 10);
    assert.equal(summary.refunds_eur, 16);
    assert.equal(summary.net_revenue_eur, -6);
});

test('orderRowToSale extracts funnel_slug from metadata', function () {
    var row = orderMetrics.orderRowToSale({
        id: 'ord-1',
        stripe_payment_intent_id: 'pi_1',
        created_at: new Date().toISOString(),
        amount_cents: 1000,
        customer_email: 'a@b.com',
        offer_id: 'fruta-da-epoca',
        product_id: 'fruta-da-epoca',
        status: 'paid',
        currency: 'eur',
        metadata: {
            funnel_slug: 'quiz-fruta',
            page_slug: 'quiz',
            utm_source: 'meta',
        },
    }, 'fruta-da-epoca');

    assert.equal(row.funnel_slug, 'quiz-fruta');
    assert.equal(row.page_slug, 'quiz');
});
