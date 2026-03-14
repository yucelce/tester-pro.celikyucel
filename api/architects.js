// api/architects.js
export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // BURAYA MİMARİ OFİSLERİN GOOGLE SHEET URL'SİNİ YAPIŞTIRIN
        const sheetUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vReSiTHM8ZpXOHSDsTyUf2mD2tKhTnwQbdIw3Wknz6wGH_cHega_31RkUVHfimufWUkikxbj7kEHFzb/pubhtml?gid=0&single=true"; 
        
        const response = await fetch(sheetUrl);
        if (!response.ok) throw new Error("Veri çekilemedi");

        const text = await response.text();
        const rows = text.split('\n').slice(1); 

        const architects = rows.map(row => {
            const cols = row.split('\t');
            return {
                il: cols[0]?.trim() || '',
                ilce: cols[1]?.trim() || '',
                ofisAdi: cols[2]?.trim() || '',
                telefon: cols[3]?.trim() || '',
                eposta: cols[4]?.trim() || '',
                adres: cols[5]?.trim() || '',
                website: cols[5]?.trim() || ''
            };
        }).filter(a => a.il && a.ofisAdi); 

        return res.status(200).json({ success: true, data: architects });
    } catch (error) {
        console.error("API Error:", error);
        return res.status(500).json({ success: false, error: error.message });
    }
}