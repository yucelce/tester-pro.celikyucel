import { calculateUnitCost } from './_utils/calculations';
import { COST_DATA } from './_utils/cost_data'; // <-- EKLENDİ

export default function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        // costs'u optimizedCosts olarak alıyoruz
        const { unit, costs: optimizedCosts, buildingStats, globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, isStructural } = req.body;
        
        // YENİ EKLENEN KOD: Birleştirme işlemi
        const mergedCosts = COST_DATA.map(baseCat => {
            const optCat = optimizedCosts?.find((c: any) => c.id === baseCat.id);
            return {
                ...baseCat,
                items: baseCat.items.map(baseItem => {
                    const optItem = optCat?.items?.find((i: any) => i.name === baseItem.name);
                    return {
                        ...baseItem,
                        unit_price: optItem?.unit_price ?? baseItem.unit_price,
                        manualPrice: optItem?.manualPrice,
                        manualQuantity: optItem?.manualQuantity
                    };
                })
            };
        });

        // costs yerine mergedCosts gönderiyoruz
        const result = calculateUnitCost(
            unit, mergedCosts, buildingStats, globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, isStructural
        );
        
        res.status(200).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}