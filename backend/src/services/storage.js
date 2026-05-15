// Supabase Storage adapter — upload + signed URL
import { getDb } from '../db/client.js';
import { randomUUID } from 'node:crypto';

const BUCKET = 'vouchers';
const PRODUCT_PHOTOS_BUCKET = 'product-photos';

const VOUCHER_TTL_SECONDS = 7 * 24 * 3600; // 7 dias

/**
 * Faz upload de PDF voucher (bucket PRIVADO, LGPD) e retorna signed URL TTL 7d.
 * Bucket criado on-the-fly. Renovação via getVoucherSignedUrl().
 * @param {string} reservationId
 * @param {Uint8Array} pdfBytes
 * @returns {Promise<string>}
 */
export async function uploadVoucher(reservationId, pdfBytes) {
    const db = getDb();
    const path = `${reservationId}.pdf`;

    try {
        await db.storage.createBucket(BUCKET, {
            public: false,
            allowedMimeTypes: ['application/pdf'],
            fileSizeLimit: 2 * 1024 * 1024,
        });
    } catch (_) { /* já existe */ }

    const { error } = await db.storage
        .from(BUCKET)
        .upload(path, Buffer.from(pdfBytes), {
            contentType: 'application/pdf',
            upsert: true,
        });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    return await getVoucherSignedUrl(reservationId);
}

/**
 * Gera signed URL para voucher existente (TTL 7d). Use para renovar URL expirada.
 * @param {string} reservationId
 * @returns {Promise<string>}
 */
export async function getVoucherSignedUrl(reservationId) {
    const db = getDb();
    const path = `${reservationId}.pdf`;
    const { data, error } = await db.storage
        .from(BUCKET)
        .createSignedUrl(path, VOUCHER_TTL_SECONDS);
    if (error) throw new Error(`Signed URL failed: ${error.message}`);
    return data.signedUrl;
}

const ALLOWED_PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

/**
 * Upload de foto de produto. Bucket público (fotos são para exibição no site).
 * @param {string} productId
 * @param {Buffer} fileBytes
 * @param {string} mimeType
 * @returns {Promise<{ url: string, path: string }>}
 */
export async function uploadProductPhoto(productId, fileBytes, mimeType) {
    if (!ALLOWED_PHOTO_MIMES.includes(mimeType)) {
        throw new Error(`Tipo não permitido: ${mimeType}. Use jpeg/png/webp.`);
    }
    const db = getDb();
    const ext = mimeType === 'image/jpeg' ? 'jpg' : mimeType.split('/')[1];
    const path = `${productId}/${randomUUID()}.${ext}`;

    try {
        await db.storage.createBucket(PRODUCT_PHOTOS_BUCKET, {
            public: true,
            allowedMimeTypes: ALLOWED_PHOTO_MIMES,
            fileSizeLimit: 5 * 1024 * 1024,
        });
    } catch (_) { /* já existe */ }

    const { error } = await db.storage
        .from(PRODUCT_PHOTOS_BUCKET)
        .upload(path, fileBytes, { contentType: mimeType, upsert: false });
    if (error) throw new Error(`Storage upload failed: ${error.message}`);

    const { data } = db.storage.from(PRODUCT_PHOTOS_BUCKET).getPublicUrl(path);
    return { url: data.publicUrl, path };
}

/**
 * Remove foto do bucket dado URL pública (extrai path).
 * Legacy URLs (./assets/*) commit-ed no repo: no-op silencioso.
 */
export async function deleteProductPhoto(photoUrl) {
    const marker = `/${PRODUCT_PHOTOS_BUCKET}/`;
    const idx = photoUrl.indexOf(marker);
    if (idx === -1) return; // legacy asset commit-ed no repo — nada a fazer no Storage
    const db = getDb();
    const path = photoUrl.slice(idx + marker.length);
    const { error } = await db.storage.from(PRODUCT_PHOTOS_BUCKET).remove([path]);
    if (error) throw new Error(`Storage delete failed: ${error.message}`);
}
