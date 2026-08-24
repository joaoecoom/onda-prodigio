var serviceModule = require('./service');

var defaultService = serviceModule.createService();

module.exports = Object.assign({
    createService: serviceModule.createService,
    createMemoryStore: serviceModule.createMemoryStore,
}, defaultService);
