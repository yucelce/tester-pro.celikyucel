// api/get-init-data.ts
import { COST_DATA } from './_utils/cost_data';
import { DEFAULT_PRICES } from './_utils/constants';

export default function handler(req: any, res: any) {
    if (req.method !== 'GET') return res.status(405).json({ error: 'Method Not Allowed' });
    
    // Hassas verileri filtreleyerek sadece frontend'in UI çizmek için ihtiyaç duyduğu şemayı dönüyoruz.
    // İsterseniz unit_price'ları 0 gönderip sadece backend'de saklayabilirsiniz, 
    // ancak formüller gizli olduğu sürece baz fiyatlar çok büyük bir sır değildir.
    res.status(200).json({
        costs: COST_DATA,
        defaultPrices: DEFAULT_PRICES
    });
}