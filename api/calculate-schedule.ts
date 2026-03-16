// api/calculate-schedule.ts
import { calculateConstructionSchedule } from './_utils/scheduleCalculator';

export default function handler(req: any, res: any) {
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method Not Allowed' });

    try {
        const { totalConstructionArea, buildingStats, constructionDuration, overrides } = req.body;
        const schedule = calculateConstructionSchedule(totalConstructionArea, buildingStats, constructionDuration, overrides || {});
        res.status(200).json({ schedule });
    } catch (error: any) {
        res.status(500).json({ error: error.message });
    }
}