-- Allow saving full checkout layouts in the reusable library
ALTER TABLE hub_saved_blocks
    DROP CONSTRAINT IF EXISTS hub_saved_blocks_kind_check;

ALTER TABLE hub_saved_blocks
    ADD CONSTRAINT hub_saved_blocks_kind_check
    CHECK (kind IN ('section', 'block', 'script', 'popup', 'page', 'checkout'));
