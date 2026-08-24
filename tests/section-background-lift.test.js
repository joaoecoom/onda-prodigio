'use strict';

var test = require('node:test');
var assert = require('node:assert/strict');
var lift = require('../lib/hub/page-builder/section-background-lift');

test('lifts facebook feed background onto section styles', function () {
    var html = '<div style="max-width:680px;background:#fff">Gosto Responder #385898 #F0F2F5</div>';
    var styles = lift.liftSectionBackgroundFromHtml(html, {});
    assert.equal(styles.backgroundColor, '#F0F2F5');
    assert.equal(styles.padding, '24px 16px');
});

test('lifts constrained band background', function () {
    var html = '<div style="max-width:800px;margin:0 auto;background-color:#f9f9f9"><h2>Refs</h2></div>';
    var styles = lift.liftSectionBackgroundFromHtml(html, {});
    assert.equal(styles.backgroundColor, '#f9f9f9');
    assert.equal(styles.padding, '40px 16px');
});

test('preserves existing section backgroundColor', function () {
    var html = '<div style="max-width:800px;background:#ccc">x</div>';
    var styles = lift.liftSectionBackgroundFromHtml(html, { backgroundColor: '#000000', padding: '10px' });
    assert.equal(styles.backgroundColor, '#000000');
    assert.equal(styles.padding, '10px');
});
