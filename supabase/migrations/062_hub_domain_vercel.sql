-- Actualizar domínio HUB para subdomínio Vercel

UPDATE hub_offers
SET hub_domain = 'hub-dr-ecoom.vercel.app'
WHERE hub_domain = 'hub.dr.ecoom.pt' OR hub_domain IS NULL;

UPDATE hub_offer_domains
SET domain = 'hub-dr-ecoom.vercel.app'
WHERE domain = 'hub.dr.ecoom.pt' AND domain_type = 'hub';

INSERT INTO hub_offer_domains (offer_id, domain, domain_type, is_primary)
VALUES ('onda-prodigio', 'hub-dr-ecoom.vercel.app', 'hub', true)
ON CONFLICT (offer_id, domain, domain_type) DO NOTHING;
