'use strict';

var serviceModule = require('./service');
var renderer = require('./renderer');
var template = require('./template');
var constants = require('./constants');

var defaultService = serviceModule.createDefaultService();

module.exports = Object.assign({
    createService: serviceModule.createService,
    createMemoryStore: serviceModule.createMemoryStore,
    renderQuizDocument: renderer.renderQuizDocument,
    basicQuizTemplate: template.basicQuizTemplate,
    QUESTION_TYPES: constants.QUESTION_TYPES,
}, defaultService);
