-- Garante buckets existem com config correta
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
    ('vouchers', 'vouchers', false, 2097152, ARRAY['application/pdf']),
    ('product-photos', 'product-photos', true, 5242880, ARRAY['image/jpeg','image/png','image/webp'])
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- ==========================================================
-- Policies storage.objects
-- ==========================================================

-- VOUCHERS (privado): só service_role pode ler/escrever. Anon/authenticated bloqueados.
DROP POLICY IF EXISTS "vouchers_service_role_all" ON storage.objects;
CREATE POLICY "vouchers_service_role_all" ON storage.objects
    FOR ALL TO service_role
    USING (bucket_id = 'vouchers')
    WITH CHECK (bucket_id = 'vouchers');

DROP POLICY IF EXISTS "vouchers_anon_deny" ON storage.objects;
-- (sem policy = sem acesso por padrão para anon/authenticated; signed URLs bypassam RLS)

-- PRODUCT-PHOTOS (público read): anyone read, service_role write.
DROP POLICY IF EXISTS "product_photos_public_read" ON storage.objects;
CREATE POLICY "product_photos_public_read" ON storage.objects
    FOR SELECT TO anon, authenticated
    USING (bucket_id = 'product-photos');

DROP POLICY IF EXISTS "product_photos_service_role_write" ON storage.objects;
CREATE POLICY "product_photos_service_role_write" ON storage.objects
    FOR ALL TO service_role
    USING (bucket_id = 'product-photos')
    WITH CHECK (bucket_id = 'product-photos');
