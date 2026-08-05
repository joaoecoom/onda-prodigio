var SURVEY_ID = 'onda-prodigio-welcome';

var REQUIRED_FIELDS = [
    'child_age',
    'main_challenge',
    'daily_situation',
    'biggest_fear',
    'tried_alternatives',
    'purchase_reason',
    'priority_result',
    'relationship',
];

var OTHER_FIELDS = {
    child_age: 'child_age_other',
    main_challenge: 'main_challenge_other',
    daily_situation: 'daily_situation_other',
    priority_result: 'priority_result_other',
    relationship: 'relationship_other',
};

module.exports = {
    SURVEY_ID: SURVEY_ID,
    REQUIRED_FIELDS: REQUIRED_FIELDS,
    OTHER_FIELDS: OTHER_FIELDS,
    LESSON_TITLE_MATCH: 'Questionário Inicial',
};
