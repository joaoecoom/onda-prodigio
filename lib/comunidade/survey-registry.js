var welcomeSurveyConfig = require('./welcome-survey-config');
var geniusTestConfig = require('./genius-test-config');

var configs = {
    'onda-prodigio-welcome': welcomeSurveyConfig,
    'onda-prodigio-genius-test': geniusTestConfig,
};

function getSurveyConfig(surveyId) {
    if (surveyId && configs[surveyId]) {
        return configs[surveyId];
    }

    return welcomeSurveyConfig;
}

module.exports = {
    getSurveyConfig: getSurveyConfig,
    DEFAULT_SURVEY_ID: welcomeSurveyConfig.SURVEY_ID,
};
