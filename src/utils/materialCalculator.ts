import { ScheduleItem } from './scheduleCalculator';
import { CostCategory } from '../cost_data'; // EKLENDİ

export interface RawMaterialDetail {
    taskId: string;
    taskName: string;
    quantity: number;
    startDate: Date;
    endDate: Date;
}

export interface RawMaterial {
    id: string;
    name: string;
    unit: string;
    totalQuantity: number;
    unitPrice: number; // EKLENDİ
    estimatedCost: number; // EKLENDİ
    details: RawMaterialDetail[];
}

export const calculateRawMaterials = (
    stats: any,
    quantities: Record<string, number>,
    schedule: ScheduleItem[],
    costs: CostCategory[] // EKLENDİ
): RawMaterial[] => {
    const materials = new Map<string, RawMaterial>();

    // Maliyet listesinden fiyat bulma fonksiyonu
    const getPrice = (itemName: string, fallback: number) => {
        for (const cat of costs) {
            const item = cat.items.find(i => i.name === itemName);
            if (item) return item.manualPrice !== undefined ? item.manualPrice : item.unit_price;
        }
        return fallback;
    };

    // Fiyatları Çek (Sistemdeki güncel fiyatlar)
    const prices = {
        cement: getPrice("Çimento (kg)", 3),
        sand: getPrice("Kum (m3)", 500),
        iron: getPrice("İnşaat Demiri", 30600) / 1000,
        concrete: getPrice("Betonarme Betonu (C30)", 3890),
        adhesive: getPrice("Gazbeton Yapıştırıcısı", 4),
        ceramicTile: getPrice("Seramik Kaplama", 1100),
        ceramicAdhesive: getPrice("Seramik Yapıştırıcısı", 10),
        jointFiller: getPrice("Seramik Derz Dolgusu", 25),

        // --- ÖNCEDEN STATİK OLANLAR ŞİMDİ DİNAMİK ---
        civi: getPrice("İnşaat Çivisi (kg)", 45),
        kalipYagi: getPrice("Kalıp Yağı (Litre)", 60),
        kereste: getPrice("Kereste (m3)", 8500),
        bagTeli: getPrice("Bağ Teli (kg)", 55),
        sivaAlcisi: getPrice("Sıva Alçısı (kg)", 6.2),
        satenAlci: getPrice("Saten Alçı (kg)", 8.5),
        astarBoya: getPrice("Astar Boya (kg)", 45),
        icCepheBoya: getPrice("İç Cephe Boyası (kg)", 98.7)// cost_data'daki "İç Cephe Boyası" m2 fiyatıdır, kova fiyatı için ayrı gizli kalem açmalıyız.
    };

    const addMaterial = (id: string, name: string, unit: string, qty: number, taskId: string, unitPrice: number) => {
        // ... mevcut addMaterial fonksiyonu içeriği aynen kalıyor ...
        if (qty <= 0) return;
        const task = schedule.find(s => s.id === taskId);
        if (!task) return;
        if (!materials.has(id)) {
            materials.set(id, { id, name, unit, totalQuantity: 0, unitPrice: unitPrice, estimatedCost: 0, details: [] });
        }
        const mat = materials.get(id)!;
        mat.totalQuantity += qty;
        mat.estimatedCost = mat.totalQuantity * mat.unitPrice;
        const existingDetail = mat.details.find(d => d.taskId === taskId);
        if (existingDetail) {
            existingDetail.quantity += qty;
        } else {
            mat.details.push({ taskId: task.id, taskName: task.name, quantity: qty, startDate: task.startDate, endDate: task.endDate });
        }
    };

    const formworkArea = quantities["Kalıp İşçiliği & Malzeme"] || 0;
    addMaterial('civi_kalip', 'İnşaat Çivisi (5-10 cm)', 'kg', formworkArea * 0.20, 'structure', prices.civi);
    addMaterial('kalip_yagi', 'Kalıp Ayırıcı Yağ', 'Litre', formworkArea * 0.15, 'structure', prices.kalipYagi);
    addMaterial('kereste', 'Kalıplık Kereste / Plywood', 'm³', formworkArea * 0.025, 'structure', prices.kereste);

    const ironTon = quantities["İnşaat Demiri"] || 0;
    addMaterial('bag_teli', 'Demir Bağ Teli', 'kg', ironTon * 12, 'structure', prices.bagTeli);
    addMaterial('demir_8_12', 'İnce Çaplı Demir (Ø8 - Ø12)', 'Ton', ironTon * 0.30, 'structure', prices.iron * 1000);
    addMaterial('demir_14_22', 'Kalın Çaplı Demir (Ø14 - Ø22)', 'Ton', ironTon * 0.70, 'structure', prices.iron * 1000);

    const concrete = quantities["Betonarme Betonu (C30)"] || 0;
    addMaterial('hazir_beton', 'Hazır Beton (C30)', 'm³', concrete, 'structure', prices.concrete);

    const mortarVolume = stats.mortar_volume || 0;
    const adhesiveWeight = stats.adhesive_weight || 0;
    addMaterial('cimento_duvar', 'Çimento (Duvar Harcı)', 'Torba (50kg)', (mortarVolume * 250) / 50, 'walls', prices.cement * 50);
    addMaterial('kum_duvar', 'İnce Kum (Duvar Harcı)', 'm³', mortarVolume * 1.0, 'walls', prices.sand);
    addMaterial('gazbeton_tutkal', 'Gazbeton Tutkalı', 'Torba (25kg)', adhesiveWeight / 25, 'walls', prices.adhesive * 25);

    const plasterArea = stats.calc_rough_plaster_area || 0;
    addMaterial('cimento_siva', 'Çimento (Kara Sıva)', 'Torba (50kg)', (plasterArea * 7.5) / 50, 'plaster', prices.cement * 50);
    addMaterial('kum_siva', 'Sıva Kumu', 'm³', plasterArea * 0.025, 'plaster', prices.sand);

    const screedArea = stats.total_area || 0;
    addMaterial('cimento_sap', 'Çimento (Şap)', 'Torba (50kg)', (screedArea * 15) / 50, 'screed', prices.cement * 50);
    addMaterial('kum_sap', 'Şap Kumu', 'm³', screedArea * 0.05, 'screed', prices.sand);

    const paintArea = (stats.calc_paint_wall_area || 0) + (stats.calc_ceiling_paint_area || 0);

    addMaterial('siva_alcisi', 'Makine Sıva Alçısı', 'kg', paintArea * 3, 'plaster', prices.sivaAlcisi);
    addMaterial('saten_alci', 'Saten Perdah Alçısı', 'kg', paintArea * 1, 'plaster', prices.satenAlci);
    addMaterial('astar_boya', 'İç Cephe Astarı', 'kg', paintArea * 0.15, 'paint', prices.astarBoya);
    addMaterial('ic_cephe_boya', 'İç Cephe Boyası', 'kg', paintArea * 0.30, 'paint', prices.icCepheBoya);

    const wetArea = stats.wet_area || 0;
    const netWetArea = stats.net_wet_area || wetArea; // Fallback

    addMaterial('seramik_yapis', 'Seramik Yapıştırıcısı', 'Torba (25kg)', (netWetArea * 5) / 25, 'flooring', prices.ceramicAdhesive * 25);
    addMaterial('derz_dolgu', 'Derz Dolgusu', 'kg', netWetArea * 0.5, 'flooring', prices.jointFiller);
    addMaterial(
        'seramik_karo',
        'Seramik / Fayans',
        'm²',
        wetArea,                   // Miktara geometrik fire payı zaten dahil olduğu için ek 1.1 çarpanı kaldırıldı
        'flooring',
        prices.ceramicTile * 0.7   // Malzeme payı %70
    );
    return Array.from(materials.values()).sort((a, b) => b.estimatedCost - a.estimatedCost);
};