'use strict';

function createTimer() {
    var started = Date.now();
    var marks = { start_ms: 0 };

    return {
        mark: function (name) {
            marks[name] = Date.now() - started;
        },
        toJSON: function () {
            var total = Date.now() - started;
            return Object.assign({}, marks, { total_ms: total });
        },
    };
}

module.exports = {
    createTimer: createTimer,
};
