// api/calculate-unit.ts
import { calculateUnitCost } from './_utils/calculations';

export default function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { unit, costs, buildingStats, globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, isStructural } = req.body;
        
        const result = calculateUnitCost(
            unit, costs, buildingStats, globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, isStructural
        );
        
        res.status(200).json(result);
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}