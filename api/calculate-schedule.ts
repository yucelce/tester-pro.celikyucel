// api/calculate-schedule.ts
import { calculateConstructionSchedule } from './_utils/scheduleCalculator';

export default function handler(req: any, res: any) {
    // CORS Preflight isteklerini güvenle yanıtla
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }
    
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Gelen veriyi her koşulda güvenli şekilde parse et (String ise Obje yap)
        const payload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        // Payload veya buildingStats yoksa fonksiyonu çökertmek yerine güvenli hata fırlat
        if (!payload || !payload.buildingStats) {
            throw new Error("Geçersiz veya eksik veri gönderildi. buildingStats bulunamadı.");
        }

        const { totalConstructionArea, buildingStats, constructionDuration, overrides } = payload;
        
        const schedule = calculateConstructionSchedule(
            totalConstructionArea || 0, 
            buildingStats, 
            constructionDuration || 0, 
            overrides || {}
        );
        
        return res.status(200).json({ schedule });
    } catch (error: any) {
        console.error("Backend Schedule API Error:", error);
        // Vercel'i çökertmek yerine HTTP 500 JSON formatında hata dönüyoruz
        return res.status(500).json({ error: 'Takvim hesaplama hatası', details: error.message });
    }
}