'use strict';

var checkoutBuilder = require('../lib/hub/checkout-builder');
var checkoutStarter = require('../lib/hub/checkout-starter-template');
var { getSupabaseAdmin } = require('../lib/supabase-admin');

var LEGACY_ONLY_OFFERS = ['onda-prodigio'];

async function listUniversalOffers() {
    var supabase = getSupabaseAdmin();

    if (!supabase) {
        throw new Error('Supabase indisponível — define SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY.');
    }

    var result = await supabase
        .from('hub_offer_checkouts')
        .select('offer_id, checkout_id, hub_offers(id, slug, name)')
        .eq('checkout_id', 'main');

    if (result.error) {
        throw new Error(result.error.message);
    }

    return (result.data || [])
        .map(function (row) {
            var offer = row.hub_offers || {};

            return {
                offer_id: row.offer_id,
                slug: offer.slug || row.offer_id,
                name: offer.name || row.offer_id,
            };
        })
        .filter(function (row) {
            return LEGACY_ONLY_OFFERS.indexOf(row.slug) === -1;
        });
}

async function main() {
    var offers = await listUniversalOffers();
    var seeded = 0;
    var skipped = 0;

    for (var i = 0; i < offers.length; i++) {
        var offer = offers[i];
        var existing = await checkoutBuilder.getTemplate(offer.offer_id);

        if (existing.has_custom) {
            skipped += 1;
            console.log('SKIP (já tem template):', offer.slug);
            continue;
        }

        var starter = checkoutStarter.buildStarterTemplate({
            offerName: offer.name,
        });

        await checkoutBuilder.saveTemplate(offer.offer_id, starter);
        seeded += 1;
        console.log('SEED OK:', offer.slug);
    }

    console.log('Concluído — seed:', seeded, 'skip:', skipped, 'total:', offers.length);
}

main().catch(function (error) {
    console.error(error.message || error);
    process.exit(1);
});
