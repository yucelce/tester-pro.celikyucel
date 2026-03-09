import { sql } from '@vercel/postgres';

export default async function handler(req, res) {
    try {
        // Şu anki tarihten (NOW()) daha eski 'expires_at' değerine sahip kayıtları sil
        await sql`DELETE FROM procurement_links WHERE expires_at < NOW();`;
        res.status(200).json({ success: true, message: "Eski teklif dosyaları temizlendi." });
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
}