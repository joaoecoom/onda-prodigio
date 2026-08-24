-- Add presell funnel + page types

ALTER TABLE funnels DROP CONSTRAINT IF EXISTS funnels_type_check;
ALTER TABLE funnels ADD CONSTRAINT funnels_type_check
    CHECK (type IN ('presell', 'vsl', 'quiz', 'advertorial', 'webinar', 'lead', 'custom'));

ALTER TABLE pages DROP CONSTRAINT IF EXISTS pages_type_check;
ALTER TABLE pages ADD CONSTRAINT pages_type_check
    CHECK (type IN (
        'sales', 'presell', 'vsl', 'landing', 'advertorial', 'checkout',
        'upsell', 'downsell', 'thank_you', 'webinar', 'custom'
    ));
