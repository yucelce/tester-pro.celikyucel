// api/calculate-project.ts

import {
    calculateUnitCost,
    calculateComplexGlobalQuantity,
    calculateDynamicUnitPrice,
    estimatePerimeter
} from './_utils/calculations';

import {
    CostCategory,
    CostItem
} from './_utils/cost_data';

import {
    UnitType,
    BuildingStats,
    WallMaterial,
    CustomCostItem,
    DuplexPair
} from '../src/types';

// İstek gövdesi (Payload) için Tip Tanımlaması
interface CalculatePayload {
    units: UnitType[];
    structuralUnits: UnitType[];
    buildingStats: BuildingStats;
    globalWallMaterial: WallMaterial;
    globalWallMode: 'auto' | 'detailed';
    globalConcreteMode: 'auto' | 'detailed';
    globalWallThickness: number;
    customCosts: CustomCostItem[];
    duplexPairs: DuplexPair[];
    costs: CostCategory[];
    totalConstructionArea: number;
    constructionDuration: number;
}

import { COST_DATA } from './_utils/cost_data';

export default async function handler(req: any, res: any) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method Not Allowed' });
    }

    try {
        // GÜVENLİ JSON PARSE: Vercel bazen body'i string olarak döndürdüğü için çökmesini engelliyoruz
        const payload: CalculatePayload = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;

        const {
            units = [],
            structuralUnits = [],
            buildingStats = {} as BuildingStats,
            globalWallMaterial = 'gazbeton',
            globalWallMode = 'auto',
            globalConcreteMode = 'auto',
            globalWallThickness = 15,
            customCosts = [],
            duplexPairs = [],
            costs: optimizedCosts = [], // Gelen veriyi optimizedCosts olarak adlandırdık
            totalConstructionArea = 0,
            constructionDuration = 0
        } = payload;

        const mergedCosts = COST_DATA.map(baseCat => {
            const optCat = optimizedCosts.find((c: any) => c.id === baseCat.id);
            return {
                ...baseCat,
                items: baseCat.items.map(baseItem => {
                    const optItem = optCat?.items?.find((i: any) => i.name === baseItem.name);
                    return {
                        ...baseItem,
                        // Eğer frontend'den bir fiyat gelmişse onu kullan, yoksa orijinalini tut
                        unit_price: optItem?.unit_price ?? baseItem.unit_price,
                        manualPrice: optItem?.manualPrice,
                        manualQuantity: optItem?.manualQuantity,
                        isExcluded: optItem?.isExcluded ?? baseItem.isExcluded
                    };
                })
            };
        });

        let structural = 0;
        let interior = 0;
        let total = 0;

        const aggregatedUnitStats: Record<string, number> = {};
        const quantityBreakdowns: Record<string, { source: string, qty: number }[]> = {};
        const globalCostBreakdowns: Record<string, { label: string; value: number }[]> = {};

        const addBreakdown = (key: string, source: string, qty: number) => {
            if (qty === 0 || Math.abs(qty) < 0.01) return;
            if (!quantityBreakdowns[key]) quantityBreakdowns[key] = [];

            const existing = quantityBreakdowns[key].find(b => b.source === source);
            if (existing) {
                existing.qty += qty;
            } else {
                quantityBreakdowns[key].push({ source, qty });
            }
        };

        // --- 1. MİMARİ PLANLARI HESAPLAMA ---
        units.forEach((u: UnitType) => {
            const { stats, roomBreakdowns } = calculateUnitCost(u, mergedCosts, buildingStats, globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, false);

            Object.keys(stats).forEach(k => {
                const totalVal = stats[k] * u.count;
                if (!aggregatedUnitStats[k]) aggregatedUnitStats[k] = 0;
                aggregatedUnitStats[k] += totalVal;

                if (roomBreakdowns && roomBreakdowns[k] && roomBreakdowns[k].length > 0) {
                    let rbSum = 0;
                    roomBreakdowns[k].forEach((rb: { roomName: string, qty: number }) => {
                        const rbVal = rb.qty * u.count;
                        rbSum += rbVal;
                        addBreakdown(k, `Mimari: ${u.name} - ${rb.roomName} (${u.count} Adet)`, rbVal);
                    });
                    const remainder = totalVal - rbSum;
                    if (Math.abs(remainder) > 0.01) {
                        addBreakdown(k, `Mimari: ${u.name} (Daire Başına Gelen)`, remainder);
                    }
                } else {
                    addBreakdown(k, `Mimari: ${u.name} (${u.count} Adet)`, totalVal);
                }
            });
        });

        // --- 2. STATİK (KABA YAPI) HESAPLAMA ---
        let effectiveStructuralUnits: UnitType[] = structuralUnits;
        if (structuralUnits.length === 0 && (globalWallMode === 'auto' || globalConcreteMode === 'auto')) {
            effectiveStructuralUnits = [];
            // Sanal Kat Planlarını Tam TypeScript Formatında Ekliyoruz
            const baseUnitProps = { scale: 0, rooms: [], walls: [], columns: [], beams: [], slabs: [], structuralWallSource: 'global_calculated' as const, structuralConcreteSource: 'global_calculated' as const, imageData: null, lastEdited: 0 };

            if (buildingStats.normalFloorCount > 0) effectiveStructuralUnits.push({ id: 'auto_n', name: 'Normal Kat (Sanal)', floorType: 'normal', count: buildingStats.normalFloorCount, ...baseUnitProps });
            if (buildingStats.groundFloorArea > 0) effectiveStructuralUnits.push({ id: 'auto_g', name: 'Zemin Kat (Sanal)', floorType: 'ground', count: 1, ...baseUnitProps });
            if (buildingStats.basementFloorCount > 0) effectiveStructuralUnits.push({ id: 'auto_b', name: 'Bodrum Kat (Sanal)', floorType: 'basement', count: buildingStats.basementFloorCount, ...baseUnitProps });

            // TypeScript Hatası Düzeltmesi: roofFloorArea undefined olabileceğinden (|| 0) eklendi
            if (buildingStats.hasRoofFloor && (buildingStats.roofFloorArea || 0) > 0) {
                effectiveStructuralUnits.push({ id: 'auto_r', name: 'Çatı Katı (Sanal)', floorType: 'roof', count: 1, ...baseUnitProps });
            }
        }

        effectiveStructuralUnits.forEach((u: UnitType) => {
            const { stats } = calculateUnitCost(u, mergedCosts, buildingStats, globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, true);
            Object.keys(stats).forEach(k => {
                const totalVal = stats[k] * u.count;
                if (!aggregatedUnitStats[k]) aggregatedUnitStats[k] = 0;
                aggregatedUnitStats[k] += totalVal;
                addBreakdown(k, `Statik Plan: ${u.name}`, totalVal);
            });
        });

        const outerThickStr = buildingStats.outerWallThickness === 13.5 ? '13_5' : String(buildingStats.outerWallThickness || 20);
        const innerThickStr = buildingStats.innerWallThickness === 13.5 ? '13_5' : String(buildingStats.innerWallThickness || 13.5);
        const outerKey = `wall_${outerThickStr}_area`;
        const innerKey = `wall_${innerThickStr}_area`;

        ['10', '13_5', '15', '20', '25'].forEach(tStr => {
            const wDed = aggregatedUnitStats[`wDed_${tStr}`] || 0;
            const dDed = aggregatedUnitStats[`dDed_${tStr}`] || 0;
            const currentKey = `wall_${tStr}_area`;

            if (dDed > 0) {
                aggregatedUnitStats[currentKey] = (aggregatedUnitStats[currentKey] || 0) - dDed;
                addBreakdown(currentKey, `Kapı Boşluk Minhası (${tStr} cm)`, -dDed);
                if (aggregatedUnitStats[currentKey] < 0) {
                    const remainder = Math.abs(aggregatedUnitStats[currentKey]);
                    aggregatedUnitStats[currentKey] = 0;
                    if (currentKey !== innerKey) {
                        aggregatedUnitStats[innerKey] = (aggregatedUnitStats[innerKey] || 0) - remainder;
                        addBreakdown(innerKey, `Kapı Minhası Devri (${tStr} cm)`, -remainder);
                    }
                }
            }

            if (wDed > 0) {
                aggregatedUnitStats[currentKey] = (aggregatedUnitStats[currentKey] || 0) - wDed;
                addBreakdown(currentKey, `Pencere Boşluk Minhası (${tStr} cm)`, -wDed);
                if (aggregatedUnitStats[currentKey] < 0) {
                    const remainder = Math.abs(aggregatedUnitStats[currentKey]);
                    aggregatedUnitStats[currentKey] = 0;
                    if (currentKey !== outerKey) {
                        aggregatedUnitStats[outerKey] = (aggregatedUnitStats[outerKey] || 0) - remainder;
                        addBreakdown(outerKey, `Pencere Minhası Devri (${tStr} cm)`, -remainder);
                    }
                }
            }
        });

        ['10', '13_5', '15', '20', '25'].forEach(tStr => {
            const key = `wall_${tStr}_area`;
            if ((aggregatedUnitStats[key] || 0) < 0) aggregatedUnitStats[key] = 0;
        });

        // --- 3. HARÇ, YAPIŞTIRICI & ORTAK ALANLAR ---
        aggregatedUnitStats['adhesive_weight'] = 0;
        aggregatedUnitStats['mortar_volume'] = 0;

        ['10', '13_5', '15', '20', '25'].forEach(tStr => {
            const area = aggregatedUnitStats[`wall_${tStr}_area`] || 0;
            const thick = tStr === '13_5' ? 13.5 : parseFloat(tStr);
            if (globalWallMaterial === 'gazbeton') {
                aggregatedUnitStats['adhesive_weight'] += area * (0.25 * thick);
            } else {
                aggregatedUnitStats['mortar_volume'] += area * (0.002 * thick);
            }
        });

        if (buildingStats.buildingType !== 'villa') {
            const nHallArea = Math.max(0, buildingStats.normalFloorHallArea || 0);
            const gHallArea = Math.max(0, buildingStats.groundFloorHallArea || 0);
            const bHallArea = Math.max(0, buildingStats.basementFloorHallArea || 0);

            const totalHallCeilingArea = (nHallArea * buildingStats.normalFloorCount) + gHallArea + (bHallArea * buildingStats.basementFloorCount);
            const nHallWall = buildingStats.normalFloorCount * (Math.sqrt(nHallArea) * 4 * buildingStats.normalFloorHeight);
            const gHallWall = Math.sqrt(gHallArea) * 4 * buildingStats.groundFloorHeight;
            const bHallWall = buildingStats.basementFloorCount * (Math.sqrt(bHallArea) * 4 * buildingStats.basementFloorHeight);
            const totalHallWallArea = nHallWall + gHallWall + bHallWall;

            aggregatedUnitStats['calc_ceiling_paint_area'] = (aggregatedUnitStats['calc_ceiling_paint_area'] || 0) + totalHallCeilingArea;
            addBreakdown('calc_ceiling_paint_area', 'Ortak Alan (Kat Holü) Tavanları', totalHallCeilingArea);
            aggregatedUnitStats['calc_paint_wall_area'] = (aggregatedUnitStats['calc_paint_wall_area'] || 0) + totalHallWallArea;
            addBreakdown('calc_paint_wall_area', 'Ortak Alan (Kat Holü) Boyası', totalHallWallArea);
            aggregatedUnitStats['calc_plaster_area'] = (aggregatedUnitStats['calc_plaster_area'] || 0) + totalHallWallArea;
            addBreakdown('calc_plaster_area', 'Ortak Alan (Kat Holü) Alçı Sıvası', totalHallWallArea);
        }

        // --- 4. DUBLEKS DÜŞÜMLERİ ---
        const availableUnitCounts: Record<string, number> = {};
        units.forEach((u: UnitType) => availableUnitCounts[u.id] = u.count);

        duplexPairs.forEach((pair: DuplexPair) => {
            const lowerUnit = units.find((u: UnitType) => u.id === pair.lowerUnitId);
            const upperUnit = units.find((u: UnitType) => u.id === pair.upperUnitId);

            if (lowerUnit && upperUnit) {
                const availableLower = availableUnitCounts[pair.lowerUnitId] || 0;
                const availableUpper = availableUnitCounts[pair.upperUnitId] || 0;
                const c = Math.min(pair.count, availableLower, availableUpper);

                if (c > 0) {
                    const duplexLabel = `Dubleks Düşümü (${lowerUnit.name} + ${upperUnit.name})`;
                    if (aggregatedUnitStats['calc_steel_door'] !== undefined) { aggregatedUnitStats['calc_steel_door'] = Math.max(0, aggregatedUnitStats['calc_steel_door'] - c); addBreakdown('calc_steel_door', `Çelik Kapı İptali - ${duplexLabel}`, -c); }
                    if (aggregatedUnitStats['calc_combi_count'] !== undefined) { aggregatedUnitStats['calc_combi_count'] = Math.max(0, aggregatedUnitStats['calc_combi_count'] - c); addBreakdown('calc_combi_count', `Kombi İptali - ${duplexLabel}`, -c); }
                    if (aggregatedUnitStats['calc_heat_pump'] !== undefined) { aggregatedUnitStats['calc_heat_pump'] = Math.max(0, aggregatedUnitStats['calc_heat_pump'] - c); addBreakdown('calc_heat_pump', `Isı Pompası İptali - ${duplexLabel}`, -c); }
                    if (aggregatedUnitStats['calc_sub_panel_count'] !== undefined) { aggregatedUnitStats['calc_sub_panel_count'] = Math.max(0, aggregatedUnitStats['calc_sub_panel_count'] - c); addBreakdown('calc_sub_panel_count', `Tali Pano İptali - ${duplexLabel}`, -c); }
                    if (aggregatedUnitStats['calc_unit_count'] !== undefined) { aggregatedUnitStats['calc_unit_count'] = Math.max(0, aggregatedUnitStats['calc_unit_count'] - c); addBreakdown('calc_unit_count', `Bağımsız Bölüm İptali - ${duplexLabel}`, -c); }

                    aggregatedUnitStats['total_duplex_count'] = (aggregatedUnitStats['total_duplex_count'] || 0) + c;
                    const lowerHeight = lowerUnit.floorType === 'ground' ? buildingStats.groundFloorHeight : lowerUnit.floorType === 'basement' ? buildingStats.basementFloorHeight : buildingStats.normalFloorHeight;
                    const steps = Math.round(lowerHeight / 0.175) + 3;
                    const railingMt = Math.sqrt(Math.pow(lowerHeight, 2) + Math.pow((Math.round(lowerHeight / 0.175) - 1) * 0.28, 2)) * 1.15;

                    aggregatedUnitStats['total_duplex_stair_steps'] = (aggregatedUnitStats['total_duplex_stair_steps'] || 0) + (steps * c);
                    aggregatedUnitStats['total_duplex_stair_railing'] = (aggregatedUnitStats['total_duplex_stair_railing'] || 0) + (railingMt * c);

                    addBreakdown('calc_internal_stair_steps', `İç Merdiven (${lowerUnit.name} + ${upperUnit.name})`, steps * c);
                    addBreakdown('calc_internal_stair_railing_mt', `İç Merdiven Korkuluğu (${lowerUnit.name} + ${upperUnit.name})`, railingMt * c);
                    availableUnitCounts[pair.lowerUnitId] -= c;
                    availableUnitCounts[pair.upperUnitId] -= c;
                }
            }
        });

        if (buildingStats.buildingType === 'villa') {
            aggregatedUnitStats['calc_unit_count'] = 1;
            aggregatedUnitStats['calc_steel_door'] = 1;
            if (aggregatedUnitStats['calc_heat_pump'] !== undefined) aggregatedUnitStats['calc_heat_pump'] = 1;
            if (aggregatedUnitStats['calc_combi_count'] !== undefined) aggregatedUnitStats['calc_combi_count'] = 1;
            const terraceArea = buildingStats.roofTerraceArea || 0;
            if (terraceArea > 0) {
                aggregatedUnitStats['wet_area'] = (aggregatedUnitStats['wet_area'] || 0) + terraceArea;
                aggregatedUnitStats['net_wet_area'] = (aggregatedUnitStats['net_wet_area'] || 0) + terraceArea;
                aggregatedUnitStats['total_area'] = (aggregatedUnitStats['total_area'] || 0) + terraceArea;
                aggregatedUnitStats['calc_balcony_railing'] = (aggregatedUnitStats['calc_balcony_railing'] || 0) + (Math.sqrt(terraceArea) * 3);
            }
        }

        // --- 5. OTOPARK VE SIĞINAK DÜŞÜMLERİ ---
        const parkingArea = buildingStats.indoorParkingArea || 0;
        const shelterArea = buildingStats.shelterArea || 0;
        if (parkingArea + shelterArea > 0) {
            const getFloorHeight = (floorType?: string) => floorType === 'normal' ? buildingStats.normalFloorHeight : floorType === 'ground' ? buildingStats.groundFloorHeight : (buildingStats.basementFloorHeight > 0 ? buildingStats.basementFloorHeight : 3.0);

            if (parkingArea > 0) {
                const pH = getFloorHeight(buildingStats.indoorParkingFloor);
                const pPerimeter = buildingStats.indoorParkingPerimeter || estimatePerimeter(parkingArea);
                const pWallArea = pPerimeter * pH;

                aggregatedUnitStats['calc_rough_plaster_area'] = Math.max(0, (aggregatedUnitStats['calc_rough_plaster_area'] || 0) - pWallArea);
                aggregatedUnitStats['calc_paint_wall_area'] = Math.max(0, (aggregatedUnitStats['calc_paint_wall_area'] || 0) - pWallArea);
                aggregatedUnitStats['calc_plaster_area'] = Math.max(0, (aggregatedUnitStats['calc_plaster_area'] || 0) - pWallArea);
                aggregatedUnitStats['calc_ceiling_paint_area'] = Math.max(0, (aggregatedUnitStats['calc_ceiling_paint_area'] || 0) - parkingArea);
                aggregatedUnitStats['total_area'] = Math.max(0, (aggregatedUnitStats['total_area'] || 0) - parkingArea);
                aggregatedUnitStats['dry_area'] = Math.max(0, (aggregatedUnitStats['dry_area'] || 0) - (parkingArea * 0.85));
                aggregatedUnitStats['wet_area'] = Math.max(0, (aggregatedUnitStats['wet_area'] || 0) - (parkingArea * 0.15));
                aggregatedUnitStats['net_wet_area'] = Math.max(0, (aggregatedUnitStats['net_wet_area'] || 0) - (parkingArea * 0.15));

                const generatedInnerWalls = parkingArea * 1.1 * (pH / 3.0);
                aggregatedUnitStats[`wall_${innerThickStr}_area`] = Math.max(0, (aggregatedUnitStats[`wall_${innerThickStr}_area`] || 0) - generatedInnerWalls);
            }

            if (shelterArea > 0) {
                const sH = getFloorHeight(buildingStats.shelterFloor);
                const sPerimeter = buildingStats.shelterPerimeter || estimatePerimeter(shelterArea);
                const sWallArea = sPerimeter * sH;

                aggregatedUnitStats['calc_rough_plaster_area'] = Math.max(0, (aggregatedUnitStats['calc_rough_plaster_area'] || 0) - sWallArea);
                aggregatedUnitStats['calc_paint_wall_area'] = Math.max(0, (aggregatedUnitStats['calc_paint_wall_area'] || 0) - sWallArea);
                aggregatedUnitStats['calc_plaster_area'] = Math.max(0, (aggregatedUnitStats['calc_plaster_area'] || 0) - sWallArea);
                aggregatedUnitStats['calc_ceiling_paint_area'] = Math.max(0, (aggregatedUnitStats['calc_ceiling_paint_area'] || 0) - shelterArea);
                aggregatedUnitStats['total_area'] = Math.max(0, (aggregatedUnitStats['total_area'] || 0) - shelterArea);
                aggregatedUnitStats['dry_area'] = Math.max(0, (aggregatedUnitStats['dry_area'] || 0) - (shelterArea * 0.85));
                aggregatedUnitStats['wet_area'] = Math.max(0, (aggregatedUnitStats['wet_area'] || 0) - (shelterArea * 0.15));
                aggregatedUnitStats['net_wet_area'] = Math.max(0, (aggregatedUnitStats['net_wet_area'] || 0) - (shelterArea * 0.15));

                const generatedInnerWalls = shelterArea * 1.1 * (sH / 3.0);
                aggregatedUnitStats[`wall_${innerThickStr}_area`] = Math.max(0, (aggregatedUnitStats[`wall_${innerThickStr}_area`] || 0) - generatedInnerWalls);

                const requiredWCCount = Math.ceil(shelterArea / 50);
                const shelterWCArea = requiredWCCount * 4;
                const shelterDryArea = Math.max(0, shelterArea - shelterWCArea);

                aggregatedUnitStats['calc_toilet'] = (aggregatedUnitStats['calc_toilet'] || 0) + requiredWCCount;
                aggregatedUnitStats['calc_basin_mixer'] = (aggregatedUnitStats['calc_basin_mixer'] || 0) + requiredWCCount;
                aggregatedUnitStats['calc_plumbing_unit'] = (aggregatedUnitStats['calc_plumbing_unit'] || 0) + (0.25 * requiredWCCount);
                aggregatedUnitStats['wet_area'] += shelterWCArea;
                aggregatedUnitStats['net_wet_area'] += shelterWCArea;
                aggregatedUnitStats['calc_indoor_parking_screed'] = (aggregatedUnitStats['calc_indoor_parking_screed'] || 0) + shelterDryArea;
            }
        }

        // --- 6. MALİYETLERİ HESAPLAMA (FİYATLANDIRMA) ---
        // TypeScript Düzeltmesi: 'details' bir 'any[]' olarak tanımlanarak push yaparken tip uyumsuzluğu giderildi.
        const details: any[] = mergedCosts.map((cat: CostCategory) => {
            let catTotal = 0;
            const filteredItems = cat.items.filter((item: CostItem) => {
                if (cat.id === 'mekanik_tesisat') {
                    const system = buildingStats.heatingSystem || 'radiator';
                    const radiatorItems = ["Kalorifer Altyapısı (Mobil Sistem)", "Panel Radyatör (DemirDöküm vb.)", "Radyatör Montaj ve Vanalar"];
                    const underfloorItems = ["Yerden Isıtma (Strafor+Boru+İşçilik)", "Yerden Isıtma Kollektörü ve Kutusu"];
                    const vrfItems = ["VRF Dış Ünite (Merkezi Sistem)", "VRF İç Ünite (Kaset/Duvar Tipi)", "VRF Bakır Borulama ve Altyapı"];
                    const heatPumpItems = ["Isı Pompası (Hava Kaynaklı Dış Ünite)"];

                    // Mantıksal Düzeltme: Isı Pompası veya VRF seçildiğinde de diğer sistemlerin listelenmesi engellendi.
                    if (system === 'radiator' && [...underfloorItems, ...vrfItems, ...heatPumpItems].includes(item.name)) return false;
                    if (system === 'underfloor' && [...radiatorItems, ...vrfItems, ...heatPumpItems].includes(item.name)) return false;
                    if (system === 'heat_pump' && [...radiatorItems, ...vrfItems, "Kombi ve Baca Montajı"].includes(item.name)) return false;
                    if (system === 'vrf' && [...radiatorItems, ...underfloorItems, ...heatPumpItems, "Kombi ve Baca Montajı"].includes(item.name)) return false;
                }
                if (cat.id === 'duvar_tavan') {
                    if (globalWallMaterial === 'gazbeton' && item.name === "Duvar Örme Harcı (Kara Harç)") return false;
                    if (globalWallMaterial !== 'gazbeton' && item.name === "Gazbeton Yapıştırıcısı") return false;
                }
                if (buildingStats.buildingType === 'villa' && item.name === "Bina Giriş Kapısı (Ana)") {
                    return false; // Villalarda apartman tipi bina giriş kapısını iptal et
                }
                return true;
            });

            const processedItems = filteredItems
                .filter((item: CostItem) => item.scope !== 'hidden')
                .map((item: CostItem) => {
                    let finalQty = 0;
                    let calculatedAutoQty = 0;

                    let dynamicUnitPrice = calculateDynamicUnitPrice(
                        item, 0, totalConstructionArea, buildingStats.province, buildingStats.isUrbanTransformation, buildingStats, mergedCosts, globalWallMaterial
                    );

                    if (item.inputType === 'manual_total') {
                        calculatedAutoQty = 1;
                        finalQty = 1;
                        if (item.auto_source.startsWith('calc_')) {
                            dynamicUnitPrice = calculateComplexGlobalQuantity(
                                item, buildingStats, totalConstructionArea, constructionDuration, aggregatedUnitStats, mergedCosts, globalWallMaterial, globalCostBreakdowns, units
                            );
                        }
                    } else {
                        if (item.auto_source === 'manual') {
                            calculatedAutoQty = 0;
                        } else if (item.scope === 'unit') {
                            calculatedAutoQty = (aggregatedUnitStats[item.auto_source] || 0) * item.multiplier;
                        } else {
                            if (item.auto_source === 'total_area') calculatedAutoQty = totalConstructionArea * item.multiplier;
                            else if (item.auto_source === 'land_area') calculatedAutoQty = buildingStats.landArea * item.multiplier;
                            else if (item.auto_source.startsWith('wall_')) calculatedAutoQty = Math.max(0, aggregatedUnitStats[item.auto_source] || 0) * item.multiplier;
                            else if (item.auto_source.startsWith('calc_')) {
                                calculatedAutoQty = Math.max(0, calculateComplexGlobalQuantity(item, buildingStats, totalConstructionArea, constructionDuration, aggregatedUnitStats, mergedCosts, globalWallMaterial, undefined, units));
                            }
                        }
                        finalQty = item.manualQuantity !== undefined ? item.manualQuantity : calculatedAutoQty;
                    }

                    const isExcluded = item.isExcluded === true; // <--- EKLENDİ
                    const finalPrice = item.manualPrice !== undefined ? item.manualPrice : dynamicUnitPrice;
                    const totalPrice = isExcluded ? 0 : (finalQty * finalPrice); // <--- EKLENDİ (Hariçse 0 yap )
                    catTotal += totalPrice;

                    return {
                        ...item,
                        calculatedAutoQty,
                        finalQty,
                        totalPrice,
                        unit_price: dynamicUnitPrice,
                        breakdown: quantityBreakdowns[item.auto_source] || [],
                        costBreakdown: globalCostBreakdowns[item.name] || null
                    };
                });

            if (['kaba_insaat', 'duvar_tavan'].includes(cat.id)) structural += catTotal;
            else if (!['arsa_finansman', 'resmi_idari', 'santiye_hafriyat', 'peyzaj_cevre'].includes(cat.id)) interior += catTotal;

            total += catTotal;

            return { id: cat.id, title: cat.title, totalCategoryCost: catTotal, items: processedItems };
        });

        const customCostsTotal = customCosts.reduce((sum: number, c: CustomCostItem) => sum + c.price, 0);
        if (customCosts.length > 0) {
            details.push({
                id: 'ozel_kalemler',
                title: '11. Özel İlaveler / Ek İşler',
                totalCategoryCost: customCostsTotal,
                items: customCosts.map((c: CustomCostItem) => ({
                    name: c.name || 'İsimsiz Ek Kalem',
                    unit: 'Paket',
                    unit_price: c.price,
                    auto_source: 'manual',
                    multiplier: 1,
                    calculatedAutoQty: 1,
                    finalQty: 1,
                    totalPrice: c.price,
                    manualPrice: c.price,
                    inputType: 'manual_total',
                    scope: 'global'
                }))
            });
            total += customCostsTotal;
        }

        // Sonuçları başarıyla dönüyoruz
        return res.status(200).json({
            projectCostDetails: details,
            projectTotalCost: total,
            globalStructuralCost: structural,
            interiorFitoutCost: interior,
            globalStats: aggregatedUnitStats
        });

    } catch (error: any) {
        console.error("Backend Calculation Error:", error);
        return res.status(500).json({ error: 'Hesaplama hatası', details: error.message });
    }
}