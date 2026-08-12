#!/usr/bin/env node

var adminMembers = require('../lib/admin/members');

adminMembers.syncAllMembersFromStripe()
    .then(function (result) {
        console.log(JSON.stringify(result, null, 2));
        process.exit(result.failed ? 1 : 0);
    })
    .catch(function (error) {
        console.error(error.message || error);
        process.exit(1);
    });
