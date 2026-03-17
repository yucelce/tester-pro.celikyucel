// api/suppliers.js
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // Gizli Google Sheet URL'niz (Frontend'de asla görünmez)
        const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vR7I9ioyi6FWmgpt3BimD2IDCBu0C0FzjGrC3MWMGDraun2cjS4RCC7XPtuGXnux-Rcy6UwhhSJLlVR/pub?output=tsv";
        
        const response = await fetch(sheetUrl);
        if (!response.ok) throw new Error("Veri çekilemedi");

        const text = await response.text();
        const rows = text.split('\n').slice(1); // Başlığı atla

        const suppliers = rows.map(row => {
            const cols = row.split('\t');
            return {
                il: cols[0]?.trim() || '',
                ilce: cols[1]?.trim() || '',
                firmaAdi: cols[2]?.trim() || '',
                telefon: cols[3]?.trim() || '',
                eposta: cols[4]?.trim() || '',
                adres: cols[5]?.trim() || ''
            };
        }).filter(s => s.il && s.firmaAdi); 

        // Veriyi güvenli bir şekilde JSON olarak döndür
        return res.status(200).json({ success: true, data: suppliers });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}