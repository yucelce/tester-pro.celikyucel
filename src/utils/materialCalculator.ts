// src/utils/materialCalculator.ts
import { ScheduleItem } from '../../api/scheduleCalculator';
import { CostCategory } from '../../api/cost_data';
import { getGlobalPrice } from '../../api/calculations';

export interface ProcurementItem {
    id: string;
    name: string;
    unit: string;
    quantity: number;
    unitPrice: number;
    totalPrice: number;
    taskId: string;
    taskName: string;
    deliveryDate: Date;
}

export const generateProcurementPlan = (
    stats: any,
    quantities: Record<string, number>,
    schedule: ScheduleItem[],
    costs: CostCategory[],
    projectCostDetails: any[]
): ProcurementItem[] => {
    const procurementList: ProcurementItem[] = [];

    // Hangi kategorinin hangi iş programı kalemine (task) denk geldiği
    const getTaskForCategory = (catId: string, itemName: string): string => {
        // TÜRKÇE KARAKTER DÜZELTMESİ (İ -> i dönüşümü için)
        const nameLower = itemName.toLocaleLowerCase('tr-TR');

        if (nameLower.includes('yeşil etiket') || nameLower.includes('asansör ruhsat') || nameLower.includes('enerji kimlik')) return 'handover';
        switch (catId) {
            case 'kaba_insaat': return nameLower.includes('çatı') ? 'roof' : 'structure';
            case 'duvar_tavan': return (nameLower.includes('boya') || nameLower.includes('kartonpiyer')) ? 'paint' : (nameLower.includes('sıva') || nameLower.includes('alçı') ? 'plaster' : 'walls');
            case 'dis_cephe': return 'facade';
            case 'zemin_kaplama': return nameLower.includes('şap') ? 'screed' : 'flooring';
            case 'mobilya_ahsap': return 'joinery';
            case 'vitrifiye_ankastre': return 'mep_finish';
            case 'mekanik_tesisat': return (nameLower.includes('altyapı') || nameLower.includes('tesisat') || nameLower.includes('boru')) ? 'mep_rough' : 'mep_finish';
            case 'elektrik_tesisat': return (nameLower.includes('kablo') || nameLower.includes('sorti') || nameLower.includes('altyapı')) ? 'mep_rough' : 'mep_finish';
            case 'peyzaj_cevre': return 'landscape';
            default: return 'structure';
        }
    };

    // Güncel fiyatları sistemden çek
    const prices = {
        cement: getGlobalPrice(costs, "Çimento (kg)"),
        sand: getGlobalPrice(costs, "Kum (m3)"),
        lime: getGlobalPrice(costs, "Kireç (kg)"),
        iron: getGlobalPrice(costs, "İnşaat Demiri") / 1000,
        concrete: getGlobalPrice(costs, "Betonarme Betonu"),
        adhesive: getGlobalPrice(costs, "Gazbeton Yapıştırıcısı"),
        ceramicTile: getGlobalPrice(costs, "Seramik Malzemesi"),
        ceramicAdhesive: getGlobalPrice(costs, "Seramik Yapıştırıcısı"),
        jointFiller: getGlobalPrice(costs, "Seramik Derz Dolgusu"),
        civi: getGlobalPrice(costs, "İnşaat Çivisi (kg)"),
        kalipYagi: getGlobalPrice(costs, "Kalıp Yağı (Litre)"),
        kereste: getGlobalPrice(costs, "Kereste (m3)"),
        bagTeli: getGlobalPrice(costs, "Bağ Teli (kg)"),
        sivaAlcisi: (getGlobalPrice(costs, "Sıva Alçısı (kg)")) * 35,
        satenAlci: (getGlobalPrice(costs, "Saten Alçı (kg)")) * 25,
        astarBoya: (getGlobalPrice(costs, "Astar Boya (kg)")) * 20,
        icCepheBoya: (getGlobalPrice(costs, "İç Cephe Boyası (kg)")) * 20
    };

    // Listeye Ekleme Fonksiyonu
    const addCalculatedMaterial = (id: string, name: string, unit: string, qty: number, taskId: string, unitPrice: number) => {
        if (qty <= 0) return;
        const task = schedule.find(s => s.id === taskId);

        const existing = procurementList.find(p => p.id === id && p.taskId === taskId);
        if (existing) {
            existing.quantity += qty;
            existing.totalPrice = existing.quantity * existing.unitPrice;
        } else {
            procurementList.push({
                id,
                name,
                unit,
                quantity: qty,
                unitPrice: unitPrice,
                totalPrice: qty * unitPrice,
                taskId: task ? task.id : 'other',
                taskName: task ? task.name : 'Genel',
                deliveryDate: task ? new Date(task.startDate.getTime() - 3 * 24 * 60 * 60 * 1000) : new Date()
            });
        }
    };

    // --- 1. AŞAMA: KABA YAPI VE İNCE İŞLER SARFİYATLARI ---
    const formworkArea = quantities["Kalıp İşçiliği & Malzeme"] || 0;
    addCalculatedMaterial('civi_kalip', 'İnşaat Çivisi (5-10 cm)', 'kg', formworkArea * 0.20, 'structure', prices.civi);
    addCalculatedMaterial('kalip_yagi', 'Kalıp Ayırıcı Yağ', 'Litre', formworkArea * 0.15, 'structure', prices.kalipYagi);
    addCalculatedMaterial('kereste', 'Kalıplık Kereste / Plywood', 'm³', formworkArea * 0.025, 'structure', prices.kereste);

    const ironTon = quantities["İnşaat Demiri"] || 0;
    addCalculatedMaterial('bag_teli', 'Demir Bağ Teli', 'kg', ironTon * 12, 'structure', prices.bagTeli);
    addCalculatedMaterial('demir_8_12', 'İnce Çaplı Demir (Ø8 - Ø12)', 'Ton', ironTon * 0.30, 'structure', prices.iron * 1000);
    addCalculatedMaterial('demir_14_22', 'Kalın Çaplı Demir (Ø14 - Ø22)', 'Ton', ironTon * 0.70, 'structure', prices.iron * 1000);

    const concrete = quantities["Betonarme Betonu"] || 0;
    addCalculatedMaterial('hazir_beton', 'Hazır Beton (C30)', 'm³', concrete, 'structure', prices.concrete);

    const mortarVolume = stats.mortar_volume || 0;
    const adhesiveWeight = stats.adhesive_weight || 0;
    addCalculatedMaterial('cimento_duvar', 'Çimento (Duvar Harcı)', 'Torba (50kg)', (mortarVolume * 200) / 50, 'walls', prices.cement * 50);
    addCalculatedMaterial('kirec_duvar', 'Kireç (Duvar Harcı)', 'Torba (25kg)', (mortarVolume * 100) / 25, 'walls', prices.lime * 25);
    addCalculatedMaterial('kum_duvar', 'İnce Kum (Duvar Harcı)', 'm³', mortarVolume * 1.0, 'walls', prices.sand);
    addCalculatedMaterial('gazbeton_tutkal', 'Gazbeton Tutkalı', 'Torba (25kg)', adhesiveWeight / 25, 'walls', prices.adhesive * 25);

    const plasterArea = stats.calc_rough_plaster_area || 0;
    addCalculatedMaterial('cimento_siva', 'Çimento (Kara Sıva)', 'Torba (50kg)', (plasterArea * 7.5) / 50, 'plaster', prices.cement * 50);
    addCalculatedMaterial('kum_siva', 'Sıva Kumu', 'm³', plasterArea * 0.025, 'plaster', prices.sand);

    const screedArea = stats.total_area || 0;
    addCalculatedMaterial('cimento_sap', 'Çimento (Şap)', 'Torba (50kg)', (screedArea * 15) / 50, 'screed', prices.cement * 50);
    addCalculatedMaterial('kum_sap', 'Şap Kumu', 'm³', screedArea * 0.05, 'screed', prices.sand);

    const paintArea = (stats.calc_paint_wall_area || 0) + (stats.calc_ceiling_paint_area || 0);
    addCalculatedMaterial('siva_alcisi', 'Makine Sıva Alçısı', 'Torba (35kg)', (paintArea * 9.5) / 35, 'plaster', prices.sivaAlcisi);
    addCalculatedMaterial('saten_alci', 'Saten Perdah Alçısı', 'Torba (25kg)', (paintArea * 1) / 25, 'plaster', prices.satenAlci);
    addCalculatedMaterial('ic_cephe_boya', 'İç Cephe Boyası (2 Kat)', 'Kova (20kg)', (paintArea * 0.45) / 20, 'paint', prices.icCepheBoya);

    const wetArea = stats.wet_area || 0;
    const netWetArea = stats.net_wet_area || wetArea;
    addCalculatedMaterial('seramik_karo', 'Seramik / Fayans', 'm²', wetArea, 'flooring', prices.ceramicTile);
    addCalculatedMaterial('seramik_yapis', 'Seramik Yapıştırıcısı', 'Torba (25kg)', (netWetArea * 5) / 25, 'flooring', prices.ceramicAdhesive * 25);
    addCalculatedMaterial('derz_dolgu', 'Derz Dolgusu', 'kg', netWetArea * 0.5, 'flooring', prices.jointFiller);

    // --- 2. AŞAMA: PROJEDEKİ DİĞER "FİZİKSEL" MALZEMELERİN EKLENMESİ ---

    // Zaten alt kalemlerine böldüğümüz ana kalemler
    const brokenDownItems = [
        "betonarme betonu", "inşaat demiri", "kalıp işçiliği", "duvar örme harcı", "gazbeton yapıştırıcısı",
        "iç sıva", "alçı sıva", "iç cephe boyası", "tavan boyası", "şap malzemesi", "şap işçiliği",
        "seramik yapıştırıcısı", "seramik derz dolgusu", "seramik malzemesi", "seramik işçiliği" // İsimler güncellendi
    ];

    // Şantiyeye gelmeyen soyut hizmet, harç, işçilik ve operasyonel gider filtreleri (Genişletildi)
    const nonPhysicalKeywords = [
        "işçiliği", "işçilik", "harcı", "harçları", "proje", "etüdü", "rapor", "hizmet", "bedeli",
        "abonelik", "tüketimi", "personel", "şefi", "kira", "kirası", "kurulum", "söküm", "sgk", "sigorta",
        "noter", "tapu", "vergi", "makinesi", "vinç", "hafriyat", "yıkım", "osgb", "yardımı", "giderleri",
        "ücreti", "belgesi", "ruhsat", "etiket", "sondaj", "deneyi", "laboratuvar", "fiyatı", "primi", "kırıcı"
    ];

    projectCostDetails.forEach(cat => {
        // Sadece Arsa/Finansman ve Resmi işlemleri atlıyoruz. 
        // Şantiye kurulumu içindeki fiziksel malzemeler (Konteyner, Çit vb.) artık listeye dahil edilecek.
        if (['arsa_finansman', 'resmi_idari'].includes(cat.id)) return;

        cat.items.forEach((item: any) => {
            if (item.totalPrice <= 0) return;

            // TÜRKÇE KARAKTER DÜZELTMESİ ("İ" harfinin doğru filtrelenmesi için)
            const nameLower = item.name.toLocaleLowerCase('tr-TR');

            const isBrokenDown = brokenDownItems.some(kw => nameLower.includes(kw));

            // "Yerden Isıtma (Strafor+Boru+İşçilik)" içinde "işçilik" geçse de, fiziksel malzeme olduğu için koruyoruz.
            const isNonPhysical = nonPhysicalKeywords.some(kw => nameLower.includes(kw)) && !nameLower.includes("yerden ısıtma");

            // Eğer parça fiziksel bir ürüneyse (Örn: Kapı, Pencere, Konteyner, Radyatör)
            if (!isBrokenDown && !isNonPhysical && item.unit !== 'Ay') {
                const taskId = getTaskForCategory(cat.id, item.name);
                const task = schedule.find(t => t.id === taskId);

                // --- YENİ EKLENEN: SIHHİ TESİSAT TEDARİK KIRILIMI ---
                if (item.name === "Sıhhi Tesisat (Temiz+Pis Su)") {
                    const delivery = task ? new Date(task.startDate.getTime() - 7 * 24 * 60 * 60 * 1000) : new Date();

                    // TOPLAM FİYATIN %65'İ MALZEME, %35'İ İŞÇİLİKTİR.
                    // Tedarik listesine sadece malzeme bedeli olan %65'i kendi içinde kırarak yansıtıyoruz.
                    const materialRatio = 0.65;

                    procurementList.push({
                        id: 'pprc_boru', name: 'PPRC Temiz Su Boru ve Ek Parçaları', unit: 'Paket',
                        quantity: item.finalQty,
                        unitPrice: item.unit_price * materialRatio * 0.50, // Malzemenin %50'si PPRC
                        totalPrice: item.totalPrice * materialRatio * 0.50,
                        taskId: task ? task.id : 'other', taskName: task ? task.name : 'Genel', deliveryDate: delivery
                    });
                    procurementList.push({
                        id: 'pvc_boru', name: 'PVC Atık Su Boru ve Ek Parçaları', unit: 'Paket',
                        quantity: item.finalQty,
                        unitPrice: item.unit_price * materialRatio * 0.35, // Malzemenin %35'i PVC
                        totalPrice: item.totalPrice * materialRatio * 0.35,
                        taskId: task ? task.id : 'other', taskName: task ? task.name : 'Genel', deliveryDate: delivery
                    });
                    procurementList.push({
                        id: 'tesisat_sarf', name: 'Vana, Sifon ve Tesisat Sarf Malzemeleri', unit: 'Paket',
                        quantity: item.finalQty,
                        unitPrice: item.unit_price * materialRatio * 0.15, // Malzemenin %15'i Sarf/Vana
                        totalPrice: item.totalPrice * materialRatio * 0.15,
                        taskId: task ? task.id : 'other', taskName: task ? task.name : 'Genel', deliveryDate: delivery
                    });

                    // Kalan %35'lik "İşçilik" bedeli fiziksel bir ürün olmadığı için "Tedarik Listesi"ne basılmaz.
                    return;
                }
                // ---------------------------------------------------

                procurementList.push({
                    id: item.name,
                    name: item.name,
                    unit: item.inputType === 'manual_total' ? 'Adet/Paket' : item.unit,
                    quantity: item.inputType === 'manual_total' ? 1 : item.finalQty,
                    unitPrice: item.unit_price,
                    totalPrice: item.totalPrice,
                    taskId: task ? task.id : 'other',
                    taskName: task ? task.name : 'Genel',
                    deliveryDate: task ? new Date(task.startDate.getTime() - 7 * 24 * 60 * 60 * 1000) : new Date()
                });
            }
        });
    });

    return procurementList.sort((a, b) => a.deliveryDate.getTime() - b.deliveryDate.getTime());
};