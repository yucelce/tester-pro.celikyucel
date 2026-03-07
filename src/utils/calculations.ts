import { UnitType, BuildingStats, WallMaterial } from '../types';
import { CostCategory, CostItem } from '../cost_data';
import { calculateWasteFactor } from './geometry';
import { DEFAULT_PRICES } from '../constants';

export const getGlobalPrice = (
    currentCosts: CostCategory[] | undefined,
    itemName: string
): number => {
    // 1. Sistemde maliyetler (currentCosts) yüklüyse tüm kategorileri tara
    if (currentCosts) {
        for (const cat of currentCosts) {
            const item = cat.items.find(i => i.name === itemName);
            if (item) {
                return item.manualPrice !== undefined ? item.manualPrice : item.unit_price;
            }
        }
    }

    // 2. Eğer güncel listede bulunamazsa veya currentCosts tanımsızsa DEFAULT_PRICES'tan al
    return DEFAULT_PRICES[itemName] || 0;
};

export const calculateEstimatedRaftHeight = (totalFloors: number): number => {
    if (totalFloors >= 20) return 2.00;
    if (totalFloors >= 4) return 0.40 + (totalFloors - 4) * 0.10;
    if (totalFloors >= 3) return 0.40;
    return 0.30;
};

export const getIronCoefficient = (
    zone?: number,
    averageFloorArea: number = 200,
    isSoftStory: boolean = false
): number => {
    // 1. Temel katsayı (Deprem bölgesine göre)
    let baseCoeff = 0.125;
    switch (zone) {
        case 1: baseCoeff = 0.125; break; // ~125 kg/m³
        case 2: baseCoeff = 0.115; break; // ~115 kg/m³
        case 3: baseCoeff = 0.105; break; // ~105 kg/m³
        case 4: baseCoeff = 0.090; break; // ~90 kg/m³
        default: baseCoeff = 0.125;
    }

    // 2. Açıklık/Alan Çarpanı (Ortalama kat alanı büyüdükçe demir yoğunluğu artar)
    // Örn: 200 m²'ye kadar standart (1.0). Sonrasındaki her 100m² için %2 artış (Maksimum %15 artış).
    let spanMultiplier = 1.0;
    if (averageFloorArea > 200) {
        const extraArea = averageFloorArea - 200;
        spanMultiplier += Math.min(0.15, (extraArea / 100) * 0.02);
    }

    // 3. Yumuşak Kat (Soft Story) Çarpanı
    // Zemin kat 4.5 metreden yüksekse o katın demir yükü %20 artar
    let softStoryMultiplier = isSoftStory ? 1.20 : 1.0;

    // Nihai demir katsayısı
    return baseCoeff * spanMultiplier * softStoryMultiplier;
};

// ============================================================================
// 1. GEOMETRİ SERVİSİ (Sadece alan, çevre ve fiziksel büyüklükleri bulur)
// ============================================================================
export class GeometryAnalyzer {
    static extractRawMetrics(unit: UnitType, buildingStats: BuildingStats) {
        let defaultFloorHeight = buildingStats.normalFloorHeight;
        let defaultFloorArea = buildingStats.normalFloorArea;

        if (unit.floorType === 'ground') {
            defaultFloorHeight = buildingStats.groundFloorHeight;
            defaultFloorArea = buildingStats.groundFloorArea;
        } else if (unit.floorType === 'basement') {
            defaultFloorHeight = buildingStats.basementFloorHeight;
            defaultFloorArea = buildingStats.basementFloorArea;
        } else if (unit.floorType === 'roof') {
            defaultFloorHeight = buildingStats.roofFloorHeight || 1.8;
            defaultFloorArea = buildingStats.roofFloorArea || 0;
        }

        let totalSlabArea = 0;
        let sumSlabVolume = 0;
        (unit.slabs || []).forEach(slab => {
            let area = slab.manualAreaM2 > 0 ? slab.manualAreaM2 : (slab.area_px && unit.scale > 0 ? slab.area_px / (unit.scale * unit.scale) : 0);
            totalSlabArea += area;
            sumSlabVolume += area * slab.properties.thickness;
        });

        const avgSlabThicknessCm = totalSlabArea > 0 ? (sumSlabVolume / totalSlabArea) : 15;
        const avgSlabThicknessM = avgSlabThicknessCm / 100;

        const rooms = (unit.rooms || []).map(room => {
            let areaM2 = 0;
            let perimeterM = 0;

            if (room.manualAreaM2 !== undefined && room.manualAreaM2 > 0) {
                areaM2 = room.manualAreaM2;
                perimeterM = room.manualPerimeterM || (Math.sqrt(areaM2) * 4);
            } else if (unit.scale > 0) {
                areaM2 = room.area_px / (unit.scale * unit.scale);
                perimeterM = room.perimeter_px / unit.scale;
            }

            const roomWaste = calculateWasteFactor(room.points, room.manualAreaM2, room.manualPerimeterM);

            const roomHeight = room.properties.ceilingHeight || (defaultFloorHeight - avgSlabThicknessM);

            return { ...room, areaM2, perimeterM, roomWaste, roomHeight };
        });

        const totalArea = rooms.reduce((sum, r) => sum + r.areaM2, 0);
        const totalPerimeter = rooms.reduce((sum, r) => sum + r.perimeterM, 0);

        const projectTotalArea = (buildingStats.normalFloorCount * buildingStats.normalFloorArea) +
            buildingStats.groundFloorArea +
            (buildingStats.basementFloorCount * buildingStats.basementFloorArea) +
            (buildingStats.hasRoofFloor ? (buildingStats.roofFloorArea || 0) : 0);

        return { defaultFloorHeight, defaultFloorArea, avgSlabThicknessM, rooms, totalArea, totalPerimeter, projectTotalArea };
    }
}

// ============================================================================
// 2. METRAJ VE KEŞİF SERVİSİ (Mühendislik kurallarını ve zayiatları işletir)
// ============================================================================
export class QuantityTakeoffService {
    static calculateStats(rawMetrics: any, unit: UnitType, buildingStats: BuildingStats, settings: any) {
        let stats: Record<string, number> = {
            total_area: rawMetrics.totalArea, total_perimeter: rawMetrics.totalPerimeter,
            wet_area: 0, net_wet_area: 0, dry_area: 0, dry_perimeter: 0, net_wall_area: 0, cornice_length: 0,
            mortar_volume: 0, adhesive_weight: 0, calc_plumbing_unit: 0, calc_combi_count: 0,
            calc_radiator_infrastructure: 0, calc_radiator_len: 0, calc_radiator_count: 0,
            calc_underfloor_area: 0, calc_underfloor_collector: 0, calc_unit_count: 0,
            calc_rough_plaster_area: 0, calc_paint_wall_area: 0, calc_ceiling_paint_area: 0,
            calc_window_area: 0, calc_sill_length: 0, calc_window_perimeter: 0, calc_balcony_railing: 0,
            wall_10_area: 0, wall_13_5_area: 0, wall_15_area: 0, wall_20_area: 0, wall_25_area: 0,
            column_concrete_volume: 0, column_formwork_area: 0, beam_concrete_volume: 0, beam_formwork_area: 0,
            slab_concrete_volume: 0, slab_formwork_area: 0, calc_concrete_unit: 0, calc_iron_unit: 0, calc_formwork_unit: 0,
            radiator_length: 0, kitchen_cabinet_length: 0, calc_steel_door: 0, calc_inner_door: 0,
            calc_kitchen_cabinet: 0, calc_kitchen_counter_length: 0, calc_bathroom_cabinet: 0, calc_kitchen_sink: 0,
            calc_toilet: 0, calc_shower_cabin: 0, calc_shower_set: 0, calc_basin_mixer: 0, calc_sink_mixer: 0,
            calc_electrical_points: 0, calc_weak_current_points: 0, calc_switch_socket_count: 0, calc_sub_panel_count: 0,
            calc_heat_pump: 0, calc_vrf_infrastructure: 0, calc_vrf_indoor: 0,
            calc_suspended_ceiling_area: 0,
        };

        const windowDeductions: Record<string, number> = { '10': 0, '13_5': 0, '15': 0, '20': 0, '25': 0 };
        const wallOpeningDeductions: Record<string, number> = { '10': 0, '13_5': 0, '15': 0, '20': 0, '25': 0 };

        if (!settings.isStructural) {
            stats.calc_unit_count = 1; stats.calc_steel_door = 1; stats.calc_sub_panel_count = 1;
            const heatingSystem = buildingStats.heatingSystem || 'radiator';
            if (heatingSystem === 'radiator' || heatingSystem === 'underfloor') stats.calc_combi_count = 1;
            else if (heatingSystem === 'heat_pump') stats.calc_heat_pump = 1;
        }

        // 1. ODA DÖNGÜSÜ
        rawMetrics.rooms.forEach((room: any) => {
            if (!settings.isStructural) {
                this.applyHeating(stats, room, buildingStats, settings.globalWallMaterial);
                this.applyFinishesAndOpenings(stats, room, windowDeductions, wallOpeningDeductions, rawMetrics.defaultFloorHeight, rawMetrics.avgSlabThicknessM);
                this.applySpecificRooms(stats, room);
                this.applyElectricalPoints(stats, room);
            }
        });

        if (!settings.isStructural) {
            const totalDoorBaseboardDeduction = (stats.calc_inner_door * 1.80) + (stats.calc_steel_door * 0.90);
            stats.dry_perimeter = Math.max(0, stats.dry_perimeter - totalDoorBaseboardDeduction);
        }

        // 2. KABA YAPI (Duvar, Beton, Demir)
        this.applyStructure(stats, unit, rawMetrics, buildingStats, settings, windowDeductions, wallOpeningDeductions);

        // 3. STATİK & MİMARİ ÇAKIŞMA ÖNLEME (Fallbacks)
        this.applyFallbacks(stats, unit, rawMetrics, buildingStats, settings);

        return stats;
    }

    private static applyHeating(stats: any, room: any, buildingStats: BuildingStats, material: WallMaterial) {
        let materialHeatFactor = 1.0;
        if (material === 'gazbeton') materialHeatFactor = 0.85;
        else if (material === 'bims') materialHeatFactor = 0.92;
        if (buildingStats.buildingType === 'villa') materialHeatFactor *= 1.25;

        const heatLossFactor = (30 + (buildingStats.heatZone * 5)) * materialHeatFactor;
        const heatedArea = (room.type !== 'balcony' && room.type !== 'other' && room.type !== 'storage') ? room.areaM2 : 0;

        if (heatedArea > 0) {
            const windowRatio = (room.properties.windowArea || 0) / heatedArea;
            const windowFactor = 1 + (windowRatio * 0.5);
            const roomHeatLoad = heatedArea * room.roomHeight * heatLossFactor * windowFactor;
            const heatingSystem = buildingStats.heatingSystem || 'radiator';

            if (heatingSystem === 'radiator') {
                const radLen = roomHeatLoad / 1455;
                stats.calc_radiator_len += radLen; stats.radiator_length += radLen;
                stats.calc_radiator_infrastructure += (heatedArea * windowFactor);
                stats.calc_radiator_count += Math.max(1, Math.ceil(radLen / 1.6));
            } else if (heatingSystem === 'underfloor' || heatingSystem === 'heat_pump') {
                const standardHeatLoad = 2.9 * 40 * 1.05;
                const densityFactor = roomHeatLoad / standardHeatLoad;
                stats.calc_underfloor_area += (heatedArea * densityFactor);
                const portsNeeded = Math.ceil((heatedArea * densityFactor) / 12);
                stats.calc_underfloor_collector += portsNeeded > 12 ? Math.ceil(portsNeeded / 10) : 1;
            } else if (heatingSystem === 'vrf') {
                stats.calc_vrf_infrastructure += heatedArea;
                stats.calc_vrf_indoor += Math.ceil(heatedArea / 35);
            }
        }
    }

    private static applyFinishesAndOpenings(stats: any, room: any, wDed: any, dDed: any, dHeight: number, avgThick: number) {
        const doorDeduction = (room.properties.doorCount || 0) * 1.89;
        const windowDeduction = room.properties.windowArea || 0;
        const grossWallArea = Math.max(0, (room.perimeterM * room.roomHeight) - (doorDeduction + windowDeduction));


        // YENİ: Islak hacim tavanı kontrolü (Banyo ve WC'lerde asma tavan yapılır, alçı sıva yapılmaz)
        const isWetAreaCeiling = room.type === 'bath' || room.type === 'wc';

        if (isWetAreaCeiling) {
            stats.calc_suspended_ceiling_area = (stats.calc_suspended_ceiling_area || 0) + room.areaM2;
        } else {
            stats.calc_ceiling_paint_area += room.areaM2; // Sadece asma tavan olmayan yerlere tavan boyası
        }

        stats.calc_rough_plaster_area += grossWallArea;

        if (room.properties.wallFinish === 'boya') {
            stats.calc_paint_wall_area += grossWallArea;

        } else {
            stats.wet_area += grossWallArea; // Duvarlar seramik
            stats.net_wet_area += grossWallArea; // EKSİK OLAN SATIR: Yapıştırıcı için duvarı da dahil et

        }



        if (room.properties.hasCornice) stats.cornice_length += room.perimeterM;
        if (room.properties.floorType === 'seramik' || room.properties.hasWaterproofing) {
            stats.wet_area += room.areaM2 * room.roomWaste;
            stats.net_wet_area += room.areaM2;
        }
        if (room.properties.floorType === 'parke') {
            stats.dry_area += room.areaM2 * room.roomWaste;
            stats.dry_perimeter += room.perimeterM * room.roomWaste;
        }

        stats.calc_inner_door += (room.properties.doorCount || 0);

        // Windows Deductions
        const wArea = room.properties.windowArea || 0;
        if (wArea > 0) {
            stats.calc_window_area += wArea;
            const wThick = room.properties.windowWallThickness || 20;
            let tKey = wThick <= 10 ? '10' : wThick <= 13.5 ? '13_5' : wThick <= 15 ? '15' : wThick <= 20 ? '20' : '25';
            wDed[tKey] += wArea;

            const wWidth = Math.sqrt(wArea * (4 / 3));
            const wHeight = Math.sqrt(wArea * (3 / 4));
            stats.calc_sill_length += (wWidth + 0.05);
            stats.calc_window_perimeter += 2 * (wWidth + wHeight);
        }

        // Doors Deductions
        const dArea = (room.properties.doorCount || 0) * 1.89;
        if (dArea > 0) {
            const dThick = room.properties.doorWallThickness || 13.5;
            let tKey = dThick <= 10 ? '10' : dThick <= 13.5 ? '13_5' : dThick <= 15 ? '15' : dThick <= 20 ? '20' : '25';
            dDed[tKey] += dArea;
        }
    }

    private static applySpecificRooms(stats: any, room: any) {
        const isKitchen = room.type === 'kitchen' || room.name.toLowerCase().includes('mutfak') || room.name.toLowerCase().includes('kitchen');
        if (isKitchen) {
            stats.calc_plumbing_unit += 0.5;
            const cabinetLength = Math.sqrt(room.areaM2 / 12) * 4;
            const cabinetArea = cabinetLength * Math.max(0, room.roomHeight - 0.90);
            stats.calc_kitchen_cabinet += cabinetArea;
            stats.kitchen_cabinet_length += cabinetArea;
            stats.calc_kitchen_counter_length += cabinetLength;
            stats.calc_kitchen_sink += 1; stats.calc_sink_mixer += 1;
        }
        if (room.type === 'bath') {
            stats.calc_plumbing_unit += 0.5; stats.calc_bathroom_cabinet += 1; stats.calc_toilet += 1;
            stats.calc_basin_mixer += 1; stats.calc_shower_cabin += 1; stats.calc_shower_set += 1;
        }
        if (room.type === 'wc') {
            stats.calc_plumbing_unit += 0.25; stats.calc_toilet += 1; stats.calc_basin_mixer += 1;
        }
        if (room.type === 'balcony') {
            stats.calc_balcony_railing += (room.perimeterM / 2);
        }
    }

    private static applyElectricalPoints(stats: any, room: any) {
        let sp = 0, wp = 0;
        switch (room.type) {
            case 'living': sp = 6; wp = 3; break;
            case 'bedroom': sp = 4; wp = 1; break;
            case 'kitchen': sp = 8; wp = 1; break;
            case 'bath': sp = 3; wp = 0; break;
            case 'wc': sp = 1; wp = 0; break;
            case 'hallway': sp = 2; wp = 0; break;
            case 'dressing': sp = 3; wp = 0; break;
            case 'balcony': sp = 2; wp = 0; break;
            case 'storage': case 'other': sp = 1; wp = 0; break;
            default: sp = 4; wp = 1; break;
        }
        stats.calc_electrical_points += sp;
        stats.calc_weak_current_points += wp;
        stats.calc_switch_socket_count += (sp + wp);
    }

    private static applyStructure(stats: any, unit: UnitType, metrics: any, buildingStats: BuildingStats, settings: any, wDed: any, dDed: any) {
        const { globalWallMaterial, globalWallMode, globalConcreteMode, ironCoeff } = settings;
        const useDetailedWalls = globalWallMode === 'detailed';
        const useDetailedConcrete = globalConcreteMode === 'detailed';

        // WALLS
        if (useDetailedWalls) {
            if (unit.walls && unit.walls.length > 0) {
                unit.walls.forEach(wall => {
                    let lengthM = wall.manualLengthM !== undefined && wall.manualLengthM > 0 ? wall.manualLengthM : (unit.scale > 0 ? wall.length_px / unit.scale : 0);
                    let wallHeight = wall.properties.height && wall.properties.height > 0 ? wall.properties.height : metrics.defaultFloorHeight;
                    if (!(wall.properties.height && wall.properties.height > 0)) {
                        wallHeight -= wall.properties.isUnderBeam && wall.properties.beamHeight > 0 ? (wall.properties.beamHeight / 100) : metrics.avgSlabThicknessM;
                    }
                    const wallArea = lengthM * wallHeight;
                    const thick = wall.properties.thickness;
                    let tKey = thick <= 10 ? "wall_10_area" : thick <= 13.5 ? "wall_13_5_area" : thick <= 15 ? "wall_15_area" : thick <= 20 ? "wall_20_area" : "wall_25_area";
                    stats[tKey] += wallArea;

                    if (globalWallMaterial === 'gazbeton') stats.adhesive_weight += wallArea * (0.25 * thick);
                    else stats.mortar_volume += wallArea * (0.002 * thick);
                });
            }
            if (unit.rooms.length > 0) {
                let totalRoomWallArea = 0;
                unit.rooms.forEach(r => {
                    const h = r.properties.ceilingHeight || (metrics.defaultFloorHeight - metrics.avgSlabThicknessM); const p = r.manualPerimeterM || (unit.scale > 0 ? r.perimeter_px / unit.scale : 0);
                    totalRoomWallArea += (p * h * (r.type === 'balcony' ? 0.5 : 1.0));
                });
                stats.net_wall_area = totalRoomWallArea * 0.85;
            } else {
                let totalWallArea = 0;
                Object.keys(stats).forEach(k => { if (k.startsWith('wall_') && k.endsWith('_area')) totalWallArea += stats[k]; });
                stats.net_wall_area = totalWallArea * 2;
            }
        } else {
            const refArea = stats.total_area > 0 ? stats.total_area : metrics.defaultFloorArea;
            let floorPerimeter = Math.sqrt(refArea) * 4;
            if (unit.floorType === 'normal' && buildingStats.normalFloorPerimeter) floorPerimeter = buildingStats.normalFloorPerimeter;
            else if (unit.floorType === 'ground' && buildingStats.groundFloorPerimeter) floorPerimeter = buildingStats.groundFloorPerimeter;
            else if (unit.floorType === 'basement' && buildingStats.basementFloorPerimeter) floorPerimeter = buildingStats.basementFloorPerimeter;

            const heightFactor = Math.max(1, (metrics.defaultFloorHeight / 3.0));
            const estimatedWallSurface = refArea * 2.2 * heightFactor;
            const outerWallSurface = floorPerimeter * metrics.defaultFloorHeight;
            const innerWallSurface = Math.max(0, estimatedWallSurface - outerWallSurface);

            stats["wall_20_area"] += outerWallSurface;
            stats["wall_13_5_area"] += innerWallSurface;
            stats.net_wall_area = estimatedWallSurface * 2;

            if (globalWallMaterial === 'gazbeton') stats.adhesive_weight += (outerWallSurface * 20 * 0.25) + (innerWallSurface * 13.5 * 0.25);
            else stats.mortar_volume += (outerWallSurface * 20 * 0.002) + (innerWallSurface * 13.5 * 0.002);
        }

        // Apply Deductions to Walls
        ['wDed', 'dDed'].forEach((type, idx) => {
            const deductions = idx === 0 ? wDed : dDed;
            Object.keys(deductions).forEach(thickStr => {
                const deductionArea = deductions[thickStr];
                if (deductionArea > 0) {
                    const tKey = `wall_${thickStr}_area`;
                    const thickVal = thickStr === '13_5' ? 13.5 : parseFloat(thickStr);
                    stats[tKey] -= deductionArea;
                    if (globalWallMaterial === 'gazbeton') stats.adhesive_weight -= (deductionArea * (0.25 * thickVal));
                    else stats.mortar_volume -= (deductionArea * (0.002 * thickVal));
                }
            });
        });

        // CONCRETE & IRON
        if (useDetailedConcrete) {
            (unit.columns || []).forEach(col => {
                let areaM2 = col.manualAreaM2 !== undefined && col.manualAreaM2 > 0 ? col.manualAreaM2 : (unit.scale > 0 ? col.area_px / (unit.scale * unit.scale) : 0);
                let perimeterM = col.manualPerimeterM || (Math.sqrt(areaM2) * 4);
                const height = (col.properties.height && col.properties.height > 0) ? col.properties.height : metrics.defaultFloorHeight;
                stats.column_concrete_volume += areaM2 * height;
                stats.column_formwork_area += perimeterM * height;
            });
            (unit.beams || []).forEach(beam => {
                let lengthM = beam.manualLengthM !== undefined && beam.manualLengthM > 0 ? beam.manualLengthM : (unit.scale > 0 ? beam.length_px / unit.scale : 0);
                const widthM = beam.properties.width / 100, heightM = beam.properties.height / 100, slabThickM = beam.properties.slabThickness / 100;

                // Kirişin sadece döşeme altında kalan (sarkan) kısmının betonunu hesapla
                stats.beam_concrete_volume += widthM * Math.max(0, heightM - slabThickM) * lengthM;

                const sideFormworkArea = (2 * Math.max(0, heightM - slabThickM)) * lengthM;

                // DÜZELTME: Çift sayımı (double counting) önlemek için kiriş taban kalıbı hesaba katılmamıştır. 
                // Kiriş tabanı zaten 'slab_formwork_area' (döşeme alanı) içinde genel alanla birlikte hesaplanmaktadır.
                stats.beam_formwork_area += sideFormworkArea;
            });
            let totalSlabIronBase = 0;
            (unit.slabs || []).forEach(slab => {
                let area = slab.manualAreaM2 > 0 ? slab.manualAreaM2 : (slab.area_px && unit.scale > 0 ? slab.area_px / (unit.scale * unit.scale) : 0);
                let thicknessM = slab.properties.thickness / 100;
                let concreteVolume = area * thicknessM;
                let ironDensity = 0.085; // Plak döşeme için varsayılan donatı yoğunluğu (ton/m3)

                // Döşeme tipine göre beton hacmi ve demir yoğunluğu ayarı
                if (slab.properties.type === 'asmolen') {
                    concreteVolume = concreteVolume * 0.65; // Asmolen dolgusu nedeniyle beton hacmi azalır
                    ironDensity = 0.115; // Nervür donatıları arttığı için demir yoğunluğu yüksektir
                } else if (slab.properties.type === 'mantar') {
                    ironDensity = 0.125; // Zımbalama ve ilave eğilme donatıları yoğundur
                }

                stats.slab_concrete_volume += concreteVolume;
                stats.slab_formwork_area += area;
                totalSlabIronBase += concreteVolume * ironDensity;
            });
            const dynamicMultiplier = ironCoeff / 0.125;
            stats.calc_iron_unit = (stats.column_concrete_volume * 0.135 * dynamicMultiplier) +
                (stats.beam_concrete_volume * 0.105 * dynamicMultiplier) +
                (totalSlabIronBase * dynamicMultiplier);
        } else {
            const refArea = stats.total_area > 0 ? stats.total_area : metrics.defaultFloorArea;
            const heightRatio = metrics.defaultFloorHeight / 3.0;
            const totalConcrete = refArea * 0.38 * heightRatio;
            stats.slab_concrete_volume = totalConcrete * 0.65; stats.column_concrete_volume = totalConcrete * 0.20; stats.beam_concrete_volume = totalConcrete * 0.15;
            const totalForm = refArea * 2.8 * heightRatio;
            stats.slab_formwork_area = totalForm * 0.5; stats.column_formwork_area = totalForm * 0.25; stats.beam_formwork_area = totalForm * 0.25;
            stats.calc_iron_unit = (stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume) * ironCoeff;
        }

        stats.calc_concrete_unit = stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume;
        stats.calc_formwork_unit = stats.column_formwork_area + stats.beam_formwork_area + stats.slab_formwork_area;
    }

    private static applyFallbacks(stats: any, unit: UnitType, metrics: any, buildingStats: BuildingStats, settings: any) {
        if (settings.isStructural) {
            stats.cornice_length = 0; stats.wet_area = 0; stats.dry_area = 0; stats.radiator_length = 0; stats.kitchen_cabinet_length = 0;
            stats.calc_rough_plaster_area = 0; stats.calc_paint_wall_area = 0; stats.calc_ceiling_paint_area = 0; stats.calc_plaster_area = 0;
        } else {
            ['10', '13_5', '15', '20', '25'].forEach(t => stats[`wall_${t}_area`] = Math.min(0, stats[`wall_${t}_area`] || 0));
            stats.adhesive_weight = Math.min(0, stats.adhesive_weight || 0); stats.mortar_volume = Math.min(0, stats.mortar_volume || 0);
            stats.calc_concrete_unit = 0; stats.calc_formwork_unit = 0; stats.calc_iron_unit = 0;

            if (stats.calc_rough_plaster_area === 0) {
                let fallbackArea = metrics.defaultFloorArea;
                if (unit.count > 0) {
                    let floorCount = unit.floorType === 'normal' ? Math.max(1, buildingStats.normalFloorCount) : unit.floorType === 'basement' ? Math.max(1, buildingStats.basementFloorCount) : 1;
                    fallbackArea = metrics.defaultFloorArea / Math.max(1, unit.count / floorCount);
                }
                const fArea = stats.total_area > 0 ? stats.total_area : fallbackArea;
                stats.calc_rough_plaster_area = fArea * 2.8; stats.calc_paint_wall_area = fArea * 2.5; stats.calc_ceiling_paint_area = fArea;

                stats.cornice_length = Math.sqrt(fArea) * 4 * 1.5;
                if (stats.wet_area === 0) { stats.wet_area = fArea * 0.15 * 1.05; stats.net_wet_area = fArea * 0.15; }
                if (stats.dry_area === 0) stats.dry_area = fArea * 0.85 * 1.05;
            }
        }
    }
}

export const getFoundationMetrics = (buildingStats: BuildingStats) => {
    const area = buildingStats.basementFloorCount > 0
        ? buildingStats.basementFloorArea
        : buildingStats.groundFloorArea;

    const perimeter = buildingStats.basementFloorCount > 0
        ? (buildingStats.basementFloorPerimeter || Math.sqrt(area) * 4)
        : (buildingStats.groundFloorPerimeter || Math.sqrt(area) * 4);

    return { area, perimeter };
};

export const determineBuildingClass = (
    totalArea: number,
    totalFloors: number,
    regulationHeight: number,
    unitCount: number
): string => {
    const isDetached = unitCount === 1;

    if (isDetached) {
        if (totalArea < 200) return "Yapı Sınıfı 3B";
        if (totalArea < 500) return "Yapı Sınıfı 3C";
        return "Yapı Sınıfı 4B";
    } else {
        if (totalFloors <= 3) return "Yapı Sınıfı 3A";
        if (regulationHeight < 21.50) return "Yapı Sınıfı 3B";
        if (regulationHeight < 30.50) return "Yapı Sınıfı 3C";
        if (regulationHeight < 51.50) return "Yapı Sınıfı 4A";
        return "Yapı Sınıfı 4B";
    }
};

export const getEstimatedUnitCount = (aggregatedUnitStats: Record<string, number>, totalConstructionArea: number) => {
    const count = aggregatedUnitStats['calc_unit_count'] || 0;
    return count > 0 ? count : Math.ceil(totalConstructionArea / 100);
};

export const getHeatingMetrics = (buildingStats: BuildingStats, globalWallMaterial: string) => {
    const zone = buildingStats.heatZone || 2;
    let materialHeatFactor = 1.0;
    if (globalWallMaterial === 'gazbeton') materialHeatFactor = 0.85;
    else if (globalWallMaterial === 'bims') materialHeatFactor = 0.92;

    // EKSİK OLAN KOD BURAYA EKLENDİ
    if (buildingStats.buildingType === 'villa') {
        materialHeatFactor *= 1.25;
    }

    const hLossFactor = (30 + (zone * 5)) * materialHeatFactor;
    const hG = buildingStats.groundFloorHeight || buildingStats.normalFloorHeight;
    const volG = buildingStats.groundFloorArea * (hG - 0.12);
    const volN = buildingStats.normalFloorArea * (buildingStats.normalFloorHeight - 0.12) * buildingStats.normalFloorCount;

    const totalVolNet = (volG + volN) * 0.75;
    return { totalVolNet, hLossFactor };
};

export const getTotalHallArea = (buildingStats: BuildingStats) => {
    if (buildingStats.buildingType === 'villa') return 0;
    const normalHall = buildingStats.normalFloorCount * Math.max(0, buildingStats.normalFloorHallArea || 0);
    const groundHall = Math.max(0, buildingStats.groundFloorHallArea || 0);
    const basementHall = buildingStats.basementFloorCount * Math.max(0, buildingStats.basementFloorHallArea || 0);
    return normalHall + groundHall + basementHall;
};

// ============================================================================
// 3. FİYATLANDIRMA SERVİSİ (Sadece cost_data ile stats'ı birleştirir)
// ============================================================================
export class PricingService {
    static calculateCosts(stats: Record<string, number>, currentCosts: CostCategory[], context: any) {
        let quantities: Record<string, number> = {};
        let totalCost = 0;
        const { defaultFloorArea, projectTotalArea, buildingStats, globalWallMaterial } = context;

        currentCosts.forEach(cat => {
            cat.items.forEach(item => {
                if (item.auto_source !== 'manual') {
                    let qty = 0;
                    if (item.auto_source === 'calc_window_area') qty = stats.calc_window_area;
                    else if (item.auto_source === 'calc_sill_length') qty = stats.calc_sill_length;
                    else if (item.auto_source === 'calc_window_perimeter') qty = stats.calc_window_perimeter;
                    else if (item.auto_source === 'calc_balcony_railing') qty = stats.calc_balcony_railing;
                    else if (item.auto_source === 'calc_radiator') qty = stats.radiator_length;
                    else if (item.auto_source === 'calc_kitchen_cabinet') qty = stats.kitchen_cabinet_length;
                    else {
                        const isConcrete = item.name === 'Betonarme Betonu';
                        const isIron = item.name === 'İnşaat Demiri';
                        const isFormwork = item.name === 'Kalıp İşçiliği & Malzeme';

                        if (isConcrete || isIron || isFormwork) {
                            if (isConcrete) qty = stats.calc_concrete_unit;
                            else if (isFormwork) qty = stats.calc_formwork_unit;
                            else if (isIron) qty = stats.calc_iron_unit;
                        } else {
                            let sourceKey = item.auto_source;
                            if (sourceKey.startsWith('calc_') && stats[sourceKey] === undefined) {
                                sourceKey = sourceKey.replace('calc_', '') as any;
                            }
                            const rawVal = stats[sourceKey] || 0;
                            qty = parseFloat((rawVal * item.multiplier).toFixed(2));
                        }
                    }

                    const unitArea = stats.total_area > 0 ? stats.total_area : defaultFloorArea;
                    const dynamicPrice = calculateDynamicUnitPrice(
                        item, unitArea, projectTotalArea, buildingStats.province,
                        buildingStats.isUrbanTransformation, buildingStats, currentCosts, globalWallMaterial
                    );

                    quantities[item.name] = qty;
                    totalCost += qty * dynamicPrice;
                }
            });
        });

        return { quantities, totalCost };
    }
}

// ============================================================================
// 4. ANA ORKESTRATÖR (Sildiğiniz fonksiyonun yerine geçen yeni ve temiz hali)
// ============================================================================
export const calculateUnitCost = (
    unit: UnitType,
    currentCosts: CostCategory[],
    buildingStats: BuildingStats,
    globalWallMaterial: WallMaterial = 'gazbeton',
    globalWallMode: 'auto' | 'detailed' = 'auto',
    globalConcreteMode: 'auto' | 'detailed' = 'auto',
    globalWallThickness: number = 15,
    isStructural: boolean = false
) => {
    const isGroundFloor = unit.floorType === 'ground';
    const currentFloorArea = isGroundFloor ? buildingStats.groundFloorArea : buildingStats.normalFloorArea;
    const isSoftStory = isGroundFloor && (buildingStats.groundFloorHeight >= 4.0);
    const ironCoeff = getIronCoefficient(buildingStats.earthquakeZone, currentFloorArea, isSoftStory);

    const settings = { globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, isStructural, ironCoeff };

    // 1. Geometriyi Ayrıştır
    const rawMetrics = GeometryAnalyzer.extractRawMetrics(unit, buildingStats);

    // 2. Metrajları (Quantities) Hesapla
    const stats = QuantityTakeoffService.calculateStats(rawMetrics, unit, buildingStats, settings);

    // 3. Fiyatlandır ve Sonuçlandır
    const pricingContext = {
        defaultFloorArea: rawMetrics.defaultFloorArea, projectTotalArea: rawMetrics.projectTotalArea,
        buildingStats, globalWallMaterial, useDetailedConcrete: globalConcreteMode === 'detailed'
    };

    const { quantities, totalCost } = PricingService.calculateCosts(stats, currentCosts, pricingContext);

    return { quantities, totalCost, stats };
};
// ============================================================================
const needsTowerCrane = (totalArea: number, groundArea: number, floors: number) => {
    return totalArea > 5000 || (groundArea > 650 && floors > 6);
};

export const calculateSoilInvestigationPackage = (
    groundArea: number,
    prices: {
        sondaj_mt: number,
        spt_adet: number,
        presiyometre_adet: number,
        laboratuvar_paket: number
    }
): number => {
    // 1. Sondaj Sayısı Hesabı: <300m2 için 3 adet, her ek 300m2 için +1
    const boreholeCount = 3 + Math.floor(Math.max(0, groundArea - 300) / 300);

    // 2. Sondaj Derinliği Hesabı: Yapı genişliğinin 1.5 katı (Kare kabulü ile sqrt(Alan) * 1.5)
    // Minimum 15m, Maksimum 30m (standart yapılar için güvenli aralık)
    const estimatedWidth = Math.sqrt(groundArea);
    const calculatedDepth = Math.max(15, Math.min(30, Math.ceil(estimatedWidth * 1.5)));

    const totalMeters = boreholeCount * calculatedDepth;

    // 3. Deney Sayıları
    const sptCount = Math.floor(totalMeters / 1.5); // Her 1.5m'de bir SPT
    const pressuremeterCount = Math.floor(totalMeters / 3.0); // Her 3m'de bir Presiyometre
    const labTestPackageCount = boreholeCount; // Her kuyu için 1 ana laboratuvar paketi

    // 4. Toplam Maliyet Hesabı
    const totalCost =
        (totalMeters * prices.sondaj_mt) +
        (sptCount * prices.spt_adet) +
        (pressuremeterCount * prices.presiyometre_adet) +
        (labTestPackageCount * prices.laboratuvar_paket);

    return totalCost;
};


// ---------------------------------------------------------
// --- YENİ MİMARİ: STRATEGY PATTERN & RECORD MAP        ---
// ---------------------------------------------------------

export interface CalculationContext {
    item: CostItem;
    buildingStats: BuildingStats;
    totalConstructionArea: number;
    constructionDuration: number;
    aggregatedUnitStats: Record<string, number>;
    currentCosts?: CostCategory[];
    globalWallMaterial: WallMaterial;
    totalFloors: number;
    totalBuildingHeight: number;
    regulationHeight: number;
}

type CalculatorFn = (ctx: CalculationContext) => number;

const wellFoundationLogic: CalculatorFn = ({ buildingStats, item }) => {
    if (!buildingStats.hasWellFoundation) return 0;

    let faceArea = buildingStats.wellFoundationArea || 0;
    if (faceArea <= 0) {
        const depth = buildingStats.basementFloorCount * (buildingStats.basementFloorHeight || 3);
        if (depth > 0) {
            const { perimeter } = getFoundationMetrics(buildingStats); // YENİ HELPER KULLANILDI
            faceArea = (perimeter / 2) * depth;
        }
    }

    if (faceArea <= 0) return 0;
    const THICKNESS = 0.80;

    if (item.auto_source === 'calc_well_foundation_concrete') return faceArea * THICKNESS;
    if (item.auto_source === 'calc_well_foundation_iron') return faceArea * THICKNESS * 0.120;
    if (item.auto_source === 'calc_well_foundation_formwork') return faceArea;
    if (item.auto_source === 'calc_well_foundation_excavation') return faceArea * 1.20;

    return 0;
};

const globalQuantityStrategies: Record<string, CalculatorFn> = {
    'calc_mortar_volume': ({ aggregatedUnitStats }) => aggregatedUnitStats['mortar_volume'] || 0,

    'calc_adhesive_weight': ({ aggregatedUnitStats }) => aggregatedUnitStats['adhesive_weight'] || 0,

    'calc_architectural': ({ totalConstructionArea }) => {
        if (totalConstructionArea > 1000) {
            return 1000 + (totalConstructionArea - 1000) * 0.8;
        }
        return totalConstructionArea;
    },

    'calc_satellite_system': ({ aggregatedUnitStats, totalConstructionArea, item }) => {
        const totalApartments = getEstimatedUnitCount(aggregatedUnitStats, totalConstructionArea);
        return item.unit_price * Math.max(1, totalApartments / 10);
    },

    'calc_inspection': ({ aggregatedUnitStats, totalConstructionArea, totalFloors, regulationHeight, currentCosts, constructionDuration }) => {
        const totalUnits = getEstimatedUnitCount(aggregatedUnitStats, totalConstructionArea);
        const buildingClass = determineBuildingClass(totalConstructionArea, totalFloors, regulationHeight, totalUnits);
        let classUnitPrice = getGlobalPrice(currentCosts, buildingClass);

        let serviceRate = 1.43;
        if (constructionDuration <= 12) serviceRate = 1.43;
        else if (constructionDuration <= 24) serviceRate = 1.50;
        else if (constructionDuration <= 36) serviceRate = 1.58;
        else if (constructionDuration <= 48) serviceRate = 1.65;
        else serviceRate = 1.74;

        return totalConstructionArea * classUnitPrice * (serviceRate / 100) * 1.20;
    },

    'calc_tapu_noter': ({ aggregatedUnitStats, totalConstructionArea, buildingStats, currentCosts }) => {
        const totalUnits = getEstimatedUnitCount(aggregatedUnitStats, totalConstructionArea);
        return calculateTapuNoterFees(totalUnits, buildingStats.province, buildingStats.constructionModel, buildingStats.isUrbanTransformation, 0, currentCosts);
    },

    'calc_acoustic': ({ totalConstructionArea, item }) => {
        const minQty = 444.44 / (item.unit_price || 3);
        return Math.max(totalConstructionArea, minQty);
    },

    'calc_gas_infrastructure': ({ aggregatedUnitStats, buildingStats, currentCosts }) => {
        const totalApartments = buildingStats.buildingType === 'villa' ? 1 : (aggregatedUnitStats['calc_unit_count'] || 1);
        const verticalPipePrice = getGlobalPrice(currentCosts, "Doğalgaz Kolon Hattı (mt) Birim");
        const connectionSetPrice = getGlobalPrice(currentCosts, "Doğalgaz Daire Başı Set Birim");
        const horizontalPipePrice = verticalPipePrice * 0.636;

        const verticalHeight =
            (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
            buildingStats.groundFloorHeight +
            (buildingStats.basementFloorCount * buildingStats.basementFloorHeight);
        const landSide = Math.sqrt(buildingStats.landArea || 0);
        const buildingSide = Math.sqrt(buildingStats.groundFloorArea || 0);
        const estimatedSetback = Math.max(3, (landSide - buildingSide) / 2);

        const totalVerticalMetres = verticalHeight + estimatedSetback;

        const normalHallLen = (buildingStats.normalFloorHallArea || 10) / 1.5;
        const groundHallLen = (buildingStats.groundFloorHallArea || 10) / 1.5;
        const basementHallLen = (buildingStats.basementFloorHallArea || 10) / 1.5;

        const totalFloors = buildingStats.normalFloorCount + 1 + buildingStats.basementFloorCount;
        const unitsPerFloor = totalApartments / totalFloors;

        const totalHorizontalMetres =
            (buildingStats.normalFloorCount * unitsPerFloor * (normalHallLen / 2)) +
            (1 * unitsPerFloor * (groundHallLen / 2)) +
            (buildingStats.basementFloorCount * unitsPerFloor * (basementHallLen / 2));

        return (totalVerticalMetres * verticalPipePrice) +
            (totalHorizontalMetres * horizontalPipePrice) +
            (totalApartments * connectionSetPrice);
    },

    'calc_gas_subscription': ({ item }) => item.unit_price,

    'calc_site_chief': ({ constructionDuration }) => constructionDuration,

    'calc_breaker_machine': ({ buildingStats }) => {
        if (buildingStats.soilType === 'hard') {
            const excavationBaseArea = buildingStats.basementFloorCount > 0
                ? buildingStats.basementFloorArea
                : buildingStats.groundFloorArea;
            const depth = (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) + 1.0;
            const approxVolume = excavationBaseArea * depth;
            return Math.ceil(approxVolume / 12);
        }
        return 0;
    },

    'calc_fence': ({ buildingStats }) => {
        if (buildingStats.buildingType === 'villa' && buildingStats.landArea > 0) {
            return Math.sqrt(buildingStats.landArea) * 4;
        }
        const side = Math.sqrt(buildingStats.groundFloorArea);
        return ((side + 8) * 2) + ((side + 6) * 2);
    },

    'calc_soil_investigation': ({ buildingStats, currentCosts }) => {

        const subPrices = {
            sondaj_mt: getGlobalPrice(currentCosts, "Zemin Sondaj Birim Fiyatı"),
            spt_adet: getGlobalPrice(currentCosts, "SPT Deneyi Birim Fiyatı"),
            presiyometre_adet: getGlobalPrice(currentCosts, "Presiyometre Deneyi Birim Fiyatı"),
            laboratuvar_paket: getGlobalPrice(currentCosts, "Zemin Laboratuvar Paketi")
        };
        const groundArea = buildingStats.groundFloorArea || 0;
        return calculateSoilInvestigationPackage(groundArea, subPrices);
    },

    'calc_concrete_global': ({ buildingStats, totalFloors, aggregatedUnitStats, totalConstructionArea, item }) => {
        const { area, perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = raftHeight * 1.5;
        const vTemel = (area + (ampatman * perimeter) + (4 * Math.pow(ampatman, 2))) * raftHeight;

        let vBodrumPerde = 0;
        if (buildingStats.basementFloorCount > 0) {
            vBodrumPerde = (perimeter + 1) * (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) * 0.3;
        } else if (buildingStats.subasmanHeight && buildingStats.subasmanHeight > 0) {
            vBodrumPerde = perimeter * buildingStats.subasmanHeight * 0.25;
        }
        const vKatlar = aggregatedUnitStats['calc_concrete_unit'] !== undefined ? aggregatedUnitStats['calc_concrete_unit'] : (totalConstructionArea * 0.26);
        return (vTemel + vBodrumPerde + vKatlar) * (item.multiplier || 1);
    },

    'calc_pool_concrete': ({ buildingStats }) => buildingStats.poolArea || 0,

    'calc_pool_system': ({ buildingStats }) => {
        if (buildingStats.poolArea && buildingStats.poolArea > 0) return 1;
        return 0;
    },

    'calc_villa_parking': ({ buildingStats }) => buildingStats.parkingArea || 0,

    'calc_villa_veranda': ({ buildingStats }) => buildingStats.verandaArea || 0,

    'calc_haritaci': ({ item, buildingStats }) => {
        const baseP = item.unit_price || 7471;
        const landArea = buildingStats.landArea || 0;

        let areaCoeff = 1.0;
        if (landArea > 1000 && landArea <= 3000) areaCoeff = 1.4965;
        else if (landArea > 3000 && landArea <= 5000) areaCoeff = 2.1322;
        else if (landArea > 5000 && landArea <= 10000) areaCoeff = 2.5894;
        else if (landArea > 10000 && landArea <= 20000) areaCoeff = 2.8143;
        else if (landArea > 20000) areaCoeff = 3.2251;

        const aplikasyonBedeli = baseP * areaCoeff;
        const roperliFarki = baseP * 0.479;
        const planOrnegiBedeli = baseP * 0.072;

        return aplikasyonBedeli + roperliFarki + planOrnegiBedeli;
    },

    'calc_grobeton': ({ buildingStats, totalFloors }) => {
        const { area, perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = raftHeight * 1.5;
        return (area + (ampatman * perimeter) + (4 * Math.pow(ampatman, 2))) * 0.10;
    },



    'calc_foundation_xps': ({ buildingStats, totalFloors }) => {
        const { perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        let xpsArea = (perimeter + (8 * (raftHeight * 1.5))) * raftHeight;
        if (buildingStats.basementFloorCount > 0) {
            xpsArea += perimeter * (buildingStats.basementFloorCount * buildingStats.basementFloorHeight);
        }
        return xpsArea;
    },



    'calc_facade_composite': ({ buildingStats, item }) => {
        if (buildingStats.buildingType === 'villa') {
            const groundFloorFacadeArea = (buildingStats.groundFloorPerimeter || 0) * buildingStats.groundFloorHeight;
            const normalFloorsFacadeArea = (buildingStats.normalFloorPerimeter || 0) * buildingStats.normalFloorHeight * buildingStats.normalFloorCount;
            const grossFacadeArea = groundFloorFacadeArea + normalFloorsFacadeArea;
            const netFacadeArea = grossFacadeArea * 0.80;
            return Math.round(netFacadeArea * (item.multiplier || 0.25));
        }
        return 0;
    },

    'calc_vrf_outdoor': ({ buildingStats, aggregatedUnitStats }) => {
        if (buildingStats.heatingSystem === 'vrf') {
            // Villa ise her halükarda 1 adet dış ünite al
            return buildingStats.buildingType === 'villa' ? 1 : (aggregatedUnitStats['calc_unit_count'] || 1);
        }
        return 0;
    },

    'calc_tower_crane_duration': ({ buildingStats, totalConstructionArea, totalFloors }) => {
        const groundArea = buildingStats.groundFloorArea || 0;
        const needsCraneByArea = totalConstructionArea > 5000;
        const needsCraneByHeight = groundArea > 650 && totalFloors > 6;

        if (needsCraneByArea || needsCraneByHeight) {
            const structureWeeks = Math.ceil(totalFloors * 2.5);
            const setupDismantleWeeks = 4;
            const totalWeeks = structureWeeks + setupDismantleWeeks;
            return totalWeeks / 4.33;
        }
        return 0;
    },

    'calc_ekb': ({ item, totalConstructionArea, aggregatedUnitStats }) => {
        const wixPrice = item.unit_price || 1500;
        const F = wixPrice / 1500;
        const A = totalConstructionArea;

        let totalUnits = aggregatedUnitStats['calc_unit_count'] || 0;
        if (totalUnits === 0) totalUnits = Math.ceil(totalConstructionArea / 100);

        let costByArea = 0;
        if (A <= 600) costByArea = 1500;
        else if (A <= 1250) costByArea = 1500 + (A - 600) * 1.154;
        else if (A <= 2500) costByArea = 2250 + (A - 1250) * 1.048;
        else if (A <= 5000) costByArea = 3560 + (A - 2500) * 0.826;
        else if (A <= 10000) costByArea = 7125 + (A - 7500) * 0.54;
        else costByArea = 8475 + (A - 10000) * 0.45;

        let costByUnits = 0;
        if (totalUnits <= 5) costByUnits = 1500;
        else if (totalUnits <= 10) costByUnits = 1500 + (totalUnits - 5) * 150;
        else if (totalUnits <= 20) costByUnits = 2250 + (totalUnits - 10) * 131;
        else if (totalUnits <= 40) costByUnits = 3560 + (totalUnits - 20) * 102;
        else if (totalUnits <= 60) costByUnits = 5600 + (totalUnits - 40) * 75;
        else costByUnits = 7100 + (totalUnits - 60) * 70;

        const finalEkbCost = Math.max(costByArea, costByUnits) * F;
        return Math.round(finalEkbCost);
    },

    'calc_utilities_subscription': ({ currentCosts, totalConstructionArea, buildingStats }) => {
        const unitGuvenlikBedeli = getGlobalPrice(currentCosts, "Elektrik Güvence Birim Bedeli");
        const waterAndOtherFees = getGlobalPrice(currentCosts, "Su Abonelik Paket Bedeli");

        let estimatedPowerKW = 0;

        if (buildingStats.buildingType === 'villa') {
            // Villalar için temel elektrik gücü asgari 15 kW kabul edilir
            estimatedPowerKW = Math.max(15, (totalConstructionArea / 100) * 8);

            // Eğer havuz varsa ekstra güç gerekir (+5 kW)
            if (buildingStats.poolArea && buildingStats.poolArea > 0) {
                estimatedPowerKW += 5;
            }
            // Eğer ısı pompası veya VRF gibi yüksek tüketimli bir ısıtma/soğutma varsa (+10 kW)
            if (buildingStats.heatingSystem === 'heat_pump' || buildingStats.heatingSystem === 'vrf') {
                estimatedPowerKW += 10;
            }
        } else {
            // Apartmanların ortak alan sayacı için eski formülü koruyabiliriz
            estimatedPowerKW = (totalConstructionArea / 1000) * 12.5;

            // Asansör ve Hidrofor gibi donanımlar olacağı için ortak alanın minimum 10 kW olması sağlıklıdır
            estimatedPowerKW = Math.max(10, estimatedPowerKW);
        }

        const electricityGuvence = estimatedPowerKW * unitGuvenlikBedeli;
        const totalSubscription = electricityGuvence + waterAndOtherFees;

        // Dinamik alt limit
        const dynamicMinLimit = waterAndOtherFees * 3;

        return Math.round(Math.max(dynamicMinLimit, totalSubscription));
    },

    'calc_land_tax': ({ currentCosts, buildingStats, constructionDuration }) => {
        const landValue = getGlobalPrice(currentCosts, "Arsa Rayiç Bedeli (Maliyet)");

        if (landValue <= 0) return 0;

        const bigCities = [
            'Adana', 'Ankara', 'Antalya', 'Aydın', 'Balıkesir', 'Bursa', 'Denizli', 'Diyarbakır',
            'Erzurum', 'Eskişehir', 'Gaziantep', 'Hatay', 'İstanbul', 'İzmir', 'Kahramanmaraş',
            'Kayseri', 'Kocaeli', 'Konya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla',
            'Ordu', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Tekirdağ', 'Trabzon', 'Van'
        ];

        const isBigCity = bigCities.includes(buildingStats.province);
        const annualRate = isBigCity ? 0.006 : 0.003;
        const durationYears = constructionDuration / 12;

        return Math.round(landValue * annualRate * durationYears);
    },

    'calc_fire_escape': ({ currentCosts, regulationHeight, buildingStats }) => {
        if (regulationHeight <= 21.50) return 0;

        const ironPricePerTon = getGlobalPrice(currentCosts, "İnşaat Demiri")
        const fireDoorPrice = getGlobalPrice(currentCosts, "Yangın Kapısı (Adet)")

        const steelWeightPerFloor = 1.5;
        const workmanshipFactor = 1.45;
        const costPerFloor = (ironPricePerTon * steelWeightPerFloor * workmanshipFactor) + fireDoorPrice;
        const totalFloorsForEscape = buildingStats.normalFloorCount + 1;

        let totalEscapeCost = totalFloorsForEscape * costPerFloor;
        if (regulationHeight > 30.50) {
            totalEscapeCost *= 1.25;
        }

        return totalEscapeCost;
    },

    'calc_foundation_grounding': ({ buildingStats }) => {
        const { area, perimeter } = getFoundationMetrics(buildingStats);
        return (perimeter + (area / 5)) * 1.15;
    },

    'calc_tower_crane_setup': ({ buildingStats, totalConstructionArea, totalFloors }) => {
        const groundArea = buildingStats.groundFloorArea || 0;
        return needsTowerCrane(totalConstructionArea, groundArea, totalFloors) ? 1 : 0;
    },

    'calc_grass_and_irrigation': ({ buildingStats }) => {
        if (buildingStats.buildingType === 'villa') {
            const footprintArea = buildingStats.groundFloorArea || 0;
            const pool = buildingStats.poolArea || 0;
            const parking = buildingStats.parkingArea || 0;
            const veranda = buildingStats.verandaArea || 0;

            // Arsadan sadece evi değil; havuz, otopark ve verandayı da düşüyoruz
            const totalHardscape = footprintArea + pool + parking + veranda;
            const openArea = Math.max(0, buildingStats.landArea - totalHardscape);

            return openArea * 0.70;
        }
        return 0;
    },

    'calc_demolition_supervisor': ({ buildingStats, currentCosts }) => {
        if (buildingStats.hasExistingBuilding) {
            let siteChiefMonthlyFee = getGlobalPrice(currentCosts, "Şantiye Şefi (Aylık)");
            return siteChiefMonthlyFee / 5;
        }
        return 0;
    },

    'calc_all_risk': ({ buildingStats, aggregatedUnitStats, totalConstructionArea, totalFloors, regulationHeight, currentCosts }) => {
        if (!buildingStats.hasAllRiskInsurance) return 0;
        const totalUnits = getEstimatedUnitCount(aggregatedUnitStats, totalConstructionArea);
        const buildingClass = determineBuildingClass(totalConstructionArea, totalFloors, regulationHeight, totalUnits);
        let classUnitPrice = getGlobalPrice(currentCosts, buildingClass) || 20000;
        return Math.round(totalConstructionArea * classUnitPrice * 0.002);
    },

    'calc_sgk_premium': ({ buildingStats, aggregatedUnitStats, totalConstructionArea, totalFloors, regulationHeight, currentCosts }) => {
        const totalUnits = buildingStats.buildingType === 'villa' ? 1 : getEstimatedUnitCount(aggregatedUnitStats, totalConstructionArea);
        const buildingClass = determineBuildingClass(totalConstructionArea, totalFloors, regulationHeight, totalUnits);
        let classUnitPrice = getGlobalPrice(currentCosts, buildingClass);
        const totalEstimatedCost = totalConstructionArea * classUnitPrice;
        const laborBase = totalEstimatedCost * 0.0675;
        return Math.round(laborBase * 0.375);
    },

    'calc_demolition_area': ({ buildingStats, totalConstructionArea, item }) => {
        if (buildingStats.hasExistingBuilding && !buildingStats.isUrbanTransformation) {
            const existingArea = buildingStats.existingArea || (totalConstructionArea * 0.5);
            return existingArea * item.unit_price;
        }
        return 0;
    },

    'calc_cctv_system': ({ aggregatedUnitStats, buildingStats }) => {
        let totalUnits = aggregatedUnitStats['calc_unit_count'] || 0;
        if (buildingStats.buildingType === 'villa' || totalUnits > 10) return 1;
        return 0;
    },

    'calc_mobile_crane_days': ({ buildingStats, totalConstructionArea, totalFloors }) => {
        const groundArea = buildingStats.groundFloorArea || 0;
        if (needsTowerCrane(totalConstructionArea, groundArea, totalFloors)) {
            return 0;
        }
        const foundationDays = 3;
        const daysPerFloor = 1.5;
        const totalDays = foundationDays + (totalFloors * daysPerFloor);
        const areaFactor = Math.max(1, groundArea / 500);

        return Math.ceil(totalDays * areaFactor);
    },

    'calc_iron_global': ({ buildingStats, aggregatedUnitStats, totalConstructionArea, totalFloors, item }) => {
        const ironCoeff = getIronCoefficient(buildingStats.earthquakeZone);
        const ironKatlar = aggregatedUnitStats['calc_iron_unit'] !== undefined ? aggregatedUnitStats['calc_iron_unit'] : ((totalConstructionArea * 0.26) * ironCoeff);

        const { area, perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = raftHeight * 1.5;
        const vTemel = (area + (ampatman * perimeter) + (4 * Math.pow(ampatman, 2))) * raftHeight;

        let vBodrumPerde = 0;
        if (buildingStats.basementFloorCount > 0) {
            vBodrumPerde = (perimeter + 1) * (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) * 0.3;
        } else if (buildingStats.subasmanHeight && buildingStats.subasmanHeight > 0) {
            vBodrumPerde = perimeter * buildingStats.subasmanHeight * 0.25;
        }
        return (ironKatlar + ((vTemel + vBodrumPerde) * ironCoeff)) * (item.multiplier || 1);
    },

    'calc_rainwater_system': ({ buildingStats, item }) => {
        if (buildingStats.landArea >= 2000) {
            const roofArea = buildingStats.normalFloorArea;
            const systemMultiplier = Math.max(1, roofArea / 500);
            return item.unit_price * systemMultiplier;
        }
        return 0;
    },

    'calc_subasman_filling': ({ buildingStats }) => {
        // Sadece bodrum olmayan yapılarda subasman dolgusu yapılır
        if (buildingStats.basementFloorCount === 0) {
            const subasmanH = buildingStats.subasmanHeight !== undefined ? buildingStats.subasmanHeight : 0.50;
            if (subasmanH > 0) {
                return (buildingStats.groundFloorArea || 0) * subasmanH;
            }
        }
        return 0;
    },


    'calc_smart_home': ({ buildingStats, totalConstructionArea, aggregatedUnitStats, item }) => {
        if (buildingStats.buildingType !== 'villa' || !buildingStats.hasSmartHome) return 0;

        // Wix'ten gelen ana taban fiyat (Girilmisse onu al, yoksa varsayılan 65000)
        let baseCost = item.unit_price > 1000 ? item.unit_price : 65000;

        let estimatedZones = Math.max(1, Math.ceil(totalConstructionArea / 25));
        if (aggregatedUnitStats && aggregatedUnitStats['calc_inner_door'] > 0) {
            estimatedZones = aggregatedUnitStats['calc_inner_door'] + 1;
        }

        // Modül Çarpanları: Sabit TL eklemek yerine, ana paket fiyatının yüzdesi olarak dinamik ekler
        if (buildingStats.smartHomeLighting) {
            baseCost += (estimatedZones * (baseCost * 0.07));
        }
        if (buildingStats.smartHomeHeating) {
            baseCost += (estimatedZones * (baseCost * 0.08));
        }
        if (buildingStats.smartHomeSensors) {
            let wetAreaZones = 2;
            if (aggregatedUnitStats && (aggregatedUnitStats['calc_toilet'] > 0 || aggregatedUnitStats['calc_kitchen_sink'] > 0)) {
                wetAreaZones = (aggregatedUnitStats['calc_toilet'] || 1) + (aggregatedUnitStats['calc_kitchen_sink'] || 1);
            }
            const floors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;

            baseCost += (wetAreaZones * (baseCost * 0.04)) + (1 * (baseCost * 0.05)) + (floors * (baseCost * 0.02)) + (baseCost * 0.12);
        }
        if (buildingStats.smartHomeBlinds) {
            let windowCount = estimatedZones;
            if (aggregatedUnitStats && aggregatedUnitStats['calc_window_area'] > 0) {
                windowCount = Math.max(estimatedZones, Math.ceil(aggregatedUnitStats['calc_window_area'] / 2.5));
            }
            baseCost += (windowCount * (baseCost * 0.05));
        }

        let areaMultiplier = 1.0;
        if (totalConstructionArea > 200) {
            areaMultiplier = 1.0 + ((totalConstructionArea - 200) * 0.003);
        }

        return Math.round(baseCost * areaMultiplier);
    },

    'calc_excavation': ({ buildingStats, item }) => {
        const excavationBaseArea = buildingStats.basementFloorCount > 0
            ? buildingStats.basementFloorArea
            : buildingStats.groundFloorArea;

        const basePerim = buildingStats.basementFloorCount > 0
            ? (buildingStats.basementFloorPerimeter || Math.sqrt(excavationBaseArea) * 4)
            : (buildingStats.groundFloorPerimeter || Math.sqrt(excavationBaseArea) * 4);

        const totalFloorsForExc = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;
        let raftHeightExc = 0.30;
        if (totalFloorsForExc >= 20) raftHeightExc = 2.00;
        else if (totalFloorsForExc >= 4) raftHeightExc = 0.40 + (totalFloorsForExc - 4) * 0.10;
        else if (totalFloorsForExc >= 3) raftHeightExc = 0.40;

        const excavationDepth = (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) + raftHeightExc + 0.40;
        const getExtendedArea = (baseArea: number, basePerimeter: number, ext: number) => {
            return baseArea + (basePerimeter * ext) + (4 * Math.pow(ext, 2));
        };

        const extensionBase = Math.max(raftHeightExc * 1.5, 1.0);
        let totalExcavationVolume = 0;

        if (excavationDepth > 6.0) {
            const stepHeight = 6.0;
            const fullSteps = Math.floor(excavationDepth / stepHeight);
            const remainingHeight = excavationDepth - (fullSteps * stepHeight);

            for (let i = 0; i < fullSteps; i++) {
                const extBottom = extensionBase + (i * 2.0);
                const extTop = extensionBase + ((i + 1) * 2.0);

                const areaBottom = getExtendedArea(excavationBaseArea, basePerim, extBottom);
                const areaTop = getExtendedArea(excavationBaseArea, basePerim, extTop);

                const stepVolume = (stepHeight / 3.0) * (areaBottom + areaTop + Math.sqrt(areaBottom * areaTop));
                totalExcavationVolume += stepVolume;
            }

            if (remainingHeight > 0) {
                const extFinal = extensionBase + (fullSteps * 2.0);
                const finalArea = getExtendedArea(excavationBaseArea, basePerim, extFinal);
                totalExcavationVolume += finalArea * remainingHeight;
            }

        } else {
            const finalArea = getExtendedArea(excavationBaseArea, basePerim, extensionBase);
            totalExcavationVolume = excavationDepth * finalArea;
        }

        return totalExcavationVolume * item.multiplier * 1.25;
    },

    'calc_radiator_mt': ({ aggregatedUnitStats, buildingStats, globalWallMaterial, item }) => {
        if (aggregatedUnitStats && aggregatedUnitStats['radiator_length'] > 0) return aggregatedUnitStats['radiator_length'] * item.multiplier;
        const { totalVolNet, hLossFactor } = getHeatingMetrics(buildingStats, globalWallMaterial);
        return (totalVolNet * hLossFactor / 1455) * item.multiplier;
    },

    'calc_steel_door': () => 1,

    'calc_garden_wall': ({ buildingStats, item }) => {
        const landArea = buildingStats.landArea || 0;
        if (landArea <= 0) return 0;
        const multiplier = buildingStats.buildingType === 'villa' ? 4 : 3;
        const landPerimeter = Math.sqrt(landArea) * multiplier;
        return landPerimeter * (item.multiplier || 1);
    },

    'calc_radiator': ({ aggregatedUnitStats, buildingStats, globalWallMaterial, item }) => {
        if (aggregatedUnitStats && aggregatedUnitStats['radiator_length'] > 0) return aggregatedUnitStats['radiator_length'] * item.multiplier;
        const { totalVolNet, hLossFactor } = getHeatingMetrics(buildingStats, globalWallMaterial);
        return ((totalVolNet * hLossFactor) / 1455) * item.multiplier;
    },

    'calc_formwork_global': ({ aggregatedUnitStats, totalConstructionArea, buildingStats, totalFloors, item }) => {
        const formKatlar = aggregatedUnitStats['calc_formwork_unit'] !== undefined ? aggregatedUnitStats['calc_formwork_unit'] : (totalConstructionArea * 2.6);

        const { perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const formTemel = (perimeter + (8 * (raftHeight * 1.5))) * raftHeight;

        let formBodrumPerde = 0;
        if (buildingStats.basementFloorCount > 0) {
            formBodrumPerde = (perimeter + 1) * (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) * 2;
        } else if (buildingStats.subasmanHeight && buildingStats.subasmanHeight > 0) {
            formBodrumPerde = perimeter * buildingStats.subasmanHeight * 2;
        }
        return (formKatlar + formTemel + formBodrumPerde) * (item.multiplier || 1);
    },

    'calc_roof': ({ buildingStats }) => {
        if (buildingStats.buildingType === 'villa') {
            const nArea = buildingStats.normalFloorCount > 0 ? buildingStats.normalFloorArea : 0;
            const gArea = buildingStats.groundFloorArea || 0;

            let maxArea = 0;
            let basePerim = 0;

            // Hangi kat daha geniş oturuyorsa onun alanını ve çevresini baz al
            if (nArea > gArea) {
                maxArea = nArea;
                basePerim = buildingStats.normalFloorPerimeter || (Math.sqrt(nArea) * 4);
            } else {
                maxArea = gArea;
                basePerim = buildingStats.groundFloorPerimeter || (Math.sqrt(gArea) * 4);
            }

            const eaveOverhang = 0.80; // 80 cm saçak payı

            // Gerçek Matematiksel Formül:
            // Saçaklı İzdüşüm Alanı = Bina Alanı + (Bina Çevresi * Saçak) + (Köşe Boşlukları: 4 * Saçak²)
            const footprintWithEaves = maxArea + (basePerim * eaveOverhang) + (4 * Math.pow(eaveOverhang, 2));

            // Çatı eğim katsayısı: 30 derece eğim için 1 / cos(30) ≈ 1.154
            // Zayiat payı: Mahya, dere, eğik kesimler için %10 (1.10)
            const pitchFactor = 1.154;
            const wasteFactor = 1.10;

            return footprintWithEaves * pitchFactor * wasteFactor;
        }
        // Apartman için mevcut mantık
        return (buildingStats.normalFloorArea) * 1.45;
    },

    'calc_wall_global': ({ buildingStats }) => {
        // 1. Normal katların duvar metrajı
        const normalWall = (buildingStats.normalFloorCount * buildingStats.normalFloorArea * buildingStats.normalFloorHeight) / 3.0;

        // 2. Zemin katın duvar metrajı
        const groundWall = (buildingStats.groundFloorArea * buildingStats.groundFloorHeight) / 3.0;

        // 3. Bodrum katların İÇ duvar metrajı
        const basementWall = (buildingStats.basementFloorCount * buildingStats.basementFloorArea * buildingStats.basementFloorHeight) / 3.0;

        // 4. Çatı katı duvar metrajı (Eğimli tavan)
        let roofWall = 0;
        if (buildingStats.hasRoofFloor && buildingStats.roofFloorArea > 0) {
            roofWall = (buildingStats.roofFloorArea * (buildingStats.roofFloorHeight || 1.8)) / 3.0;
        }

        // Hepsini topla
        return normalWall + groundWall + basementWall + roofWall;
    },

    'calc_facade': ({ buildingStats, aggregatedUnitStats }) => {
        const totalWindowArea = aggregatedUnitStats['calc_window_area'] || 0;
        const deductibleWindowArea = totalWindowArea;

        // --- ÇATI KATI (KALKAN DUVAR / PARAPET) HESABI ---
        let roofFacade = 0;
        if (buildingStats.hasRoofFloor && buildingStats.roofFloorArea > 0) {
            const roofPerim = buildingStats.roofFloorPerimeter || (Math.sqrt(buildingStats.roofFloorArea) * 4);
            // Kalkan duvar ve parapetlerin ortalama yüksekliği olarak roofFloorHeight (veya min 1.5m) alınır
            roofFacade = roofPerim * (buildingStats.roofFloorHeight || 1.8);
        }

        if (buildingStats.buildingType === 'villa') {
            const groundPerim = buildingStats.groundFloorPerimeter || (Math.sqrt(buildingStats.groundFloorArea) * 4);
            const subH = buildingStats.subasmanHeight !== undefined ? buildingStats.subasmanHeight : 0.50;
            const groundFacade = groundPerim * (buildingStats.groundFloorHeight + subH);

            let normalFacade = 0;
            if (buildingStats.normalFloorCount > 0) {
                const normalPerim = buildingStats.normalFloorPerimeter || (Math.sqrt(buildingStats.normalFloorArea) * 4);
                normalFacade = normalPerim * buildingStats.normalFloorHeight * buildingStats.normalFloorCount;
            }

            // Çatı katını toplama dahil ediyoruz
            const grossFacade = groundFacade + normalFacade + roofFacade;
            const netFacade = Math.max(0, grossFacade - deductibleWindowArea);
            return netFacade * 1.15; // %15 zayiat

        } else {
            // Apartman için
            let facadeHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) + buildingStats.groundFloorHeight;
            if (buildingStats.hasRoofFloor) {
                facadeHeight += (buildingStats.roofFloorHeight || 1.8);
            }
            const perim = buildingStats.normalFloorPerimeter || (Math.sqrt(buildingStats.normalFloorArea) * 4);

            const grossFacade = perim * facadeHeight;
            const netFacade = Math.max(0, grossFacade - deductibleWindowArea);

            const facadeWaste = calculateWasteFactor([], buildingStats.normalFloorArea, perim);
            return netFacade * facadeWaste;
        }
    },


    'calc_hard_ground': ({ buildingStats, item }) => {
        const landArea = buildingStats.landArea || 0;
        const footprintArea = buildingStats.groundFloorArea || 0;
        if (landArea <= 0 || footprintArea <= 0) return 0;
        const landSide = Math.sqrt(landArea);
        const footprintSide = Math.sqrt(footprintArea);
        const pathLength = Math.max(0, landSide - footprintSide);
        const hardGroundArea = pathLength * 2;
        return hardGroundArea * (item.multiplier || 1);
    },

    'calc_elevator': ({ buildingStats, totalFloors, item, totalConstructionArea }) => {
        if (buildingStats.buildingType === 'villa') {
            // Artık kat sayısına göre değil, kullanıcının seçimine göre ekliyoruz
            return buildingStats.hasElevator ? 1 : 0;
        }

        // Apartmanlar için mevcut mantık aynen kalabilir
        if (item.manualQuantity !== undefined && item.manualQuantity > 0) {
            return item.manualQuantity;
        }
        let count = 0;
        if (totalFloors > 3 || totalConstructionArea > 800) count = 1;
        if (totalFloors > 10 || totalConstructionArea > 2000) count = 2;
        return count;
    },

    'calc_greywater_system': ({ totalConstructionArea, item }) => {
        if (totalConstructionArea >= 30000) {
            const scaleFactor = totalConstructionArea / 30000;
            return item.unit_price * scaleFactor;
        }
        return 0;
    },

    'calc_generator': ({ buildingStats }) => {
        // 1. Sadece VİLLA senaryosunda jeneratör hesabı yapılır ve 1 adet paket eklenir
        if (buildingStats.buildingType === 'villa') {
            return 1;
        }

        // 2. Apartman ve diğer bina tiplerinde jeneratör maliyete eklenmez
        return 0;
    },

    'calc_fire_system': ({ regulationHeight, buildingStats, item }) => {
        if (regulationHeight > 21.50) {
            const totalFloors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;
            return item.unit_price * totalFloors;
        }
        return 0;
    },

    'calc_tree_count': ({ buildingStats, item }) => {
        const footprintArea = buildingStats.groundFloorArea || 0;
        const pool = buildingStats.poolArea || 0;
        const parking = buildingStats.parkingArea || 0;
        const veranda = buildingStats.verandaArea || 0;

        const totalHardscape = footprintArea + pool + parking + veranda;
        const openArea = Math.max(0, buildingStats.landArea - totalHardscape);

        // Kalan net yeşil alana göre ağaç sayısı belirlenir
        const treeCount = Math.ceil(openArea / 30.0);
        return treeCount * (item.multiplier || 1);
    },

    'calc_water_tank': ({ aggregatedUnitStats, totalConstructionArea, regulationHeight, item }) => {
        let totalUnits = aggregatedUnitStats['calc_unit_count'] || Math.ceil(totalConstructionArea / 100);
        let requiredVolume = 3;
        if (totalUnits > 10) {
            requiredVolume += (totalUnits - 10) * 0.50;
        }
        if (regulationHeight >= 30.50) {
            requiredVolume = Math.max(requiredVolume, 30);
        } else if (regulationHeight >= 21.50) {
            requiredVolume = Math.max(requiredVolume, 15);
        }
        return item.unit_price * (requiredVolume / 2);
    },

    'calc_hydrophore': ({ aggregatedUnitStats, totalConstructionArea, buildingStats, item }) => {
        let totalUnits = aggregatedUnitStats['calc_unit_count'] || Math.ceil(totalConstructionArea / 100);
        const totalFloors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;
        const unitCapacityFactor = Math.max(1, totalUnits / 10);
        const heightFactor = Math.max(1, totalFloors / 5);
        return item.unit_price * unitCapacityFactor * heightFactor;
    },

    'calc_stairs': ({ buildingStats, totalBuildingHeight }) => {
        if (buildingStats.buildingType === 'villa') return 0;
        return totalBuildingHeight / 0.17;
    },

    'calc_rent_assistance': ({ buildingStats, constructionDuration }) => {
        if (buildingStats.includeRentCost) {
            const unitCount = buildingStats.existingUnitCount || 0;
            const monthlyRent = buildingStats.monthlyRentPerUnit || 0;
            return unitCount * monthlyRent * constructionDuration;
        }
        return 0;
    },

    'calc_eviction_cost': ({ buildingStats }) => {
        if (buildingStats.includeRentCost) {
            const unitCount = buildingStats.existingUnitCount || 0;
            const evictionCost = buildingStats.evictionCostPerUnit || 0;
            return unitCount * evictionCost;
        }
        return 0;
    },

    'calc_osgb_service': ({ totalConstructionArea, constructionDuration }) => {
        let sizeFactor = 1.0;
        if (totalConstructionArea > 2000) {
            sizeFactor = 1.0 + ((totalConstructionArea - 2000) / 4000);
        }
        return constructionDuration * sizeFactor;
    },

    'calc_isg_package': ({ totalConstructionArea }) => {
        const baseWorkers = 10;
        const estimatedWorkers = Math.max(baseWorkers, Math.ceil(totalConstructionArea / 100));
        return estimatedWorkers / baseWorkers;
    },

    'calc_safety_net': ({ buildingStats }) => {
        if (buildingStats.normalFloorCount === 0) return 0;
        const facadeHeight = buildingStats.normalFloorCount * buildingStats.normalFloorHeight;
        const basePerim = buildingStats.normalFloorPerimeter || (Math.sqrt(buildingStats.normalFloorArea) * 4);
        const netPerimeter = basePerim + 8;
        return facadeHeight * netPerimeter;
    },

    'calc_well_foundation_excavation': wellFoundationLogic,
    'calc_well_foundation_concrete': wellFoundationLogic,
    'calc_well_foundation_iron': wellFoundationLogic,
    'calc_well_foundation_formwork': wellFoundationLogic,

    'calc_stairs_railing': ({ buildingStats, totalBuildingHeight }) => {
        if (buildingStats.buildingType === 'villa') return 0;
        const stepCount = totalBuildingHeight / 0.17;
        const stepHypot = Math.hypot(0.17, 0.28);
        return stepCount * stepHypot;
    },

    'calc_internal_stair_steps': ({ buildingStats, aggregatedUnitStats }) => {
        const idealRiserHeight = 0.175; // İdeal rıht yüksekliği
        const landingBonus = 3;        // Sahanlık için eklenen basamak seti (piyasa teamülü)
        let totalSteps = 0;

        if (buildingStats.buildingType === 'villa') {
            if (buildingStats.basementFloorCount > 0) {
                const basementHeight = buildingStats.basementFloorHeight || 2.80;
                const stepsPerBasement = Math.round(basementHeight / idealRiserHeight);
                totalSteps += buildingStats.basementFloorCount * (stepsPerBasement + landingBonus);
            }
            if (buildingStats.normalFloorCount > 0) {
                const groundHeight = buildingStats.groundFloorHeight || 3.20;
                const groundSteps = Math.round(groundHeight / idealRiserHeight);
                totalSteps += (groundSteps + landingBonus);
            }
            if (buildingStats.normalFloorCount > 1) {
                const normalHeight = buildingStats.normalFloorHeight || 3.00;
                const normalStepsPerFlight = Math.round(normalHeight / idealRiserHeight);
                const flights = buildingStats.normalFloorCount - 1;
                totalSteps += flights * (normalStepsPerFlight + landingBonus);
            }
        } else {
            // APARTMAN DUBLEKS MANTIĞI: Düşüm yapılan dubleks adedi kadar merdiven eklenir.
            const duplexCount = aggregatedUnitStats['total_duplex_count'] || 0;
            if (duplexCount > 0) {
                const normalHeight = buildingStats.normalFloorHeight || 3.00;
                const normalStepsPerFlight = Math.round(normalHeight / idealRiserHeight);
                totalSteps += duplexCount * (normalStepsPerFlight + landingBonus);
            }
        }
        return totalSteps;
    },

    'calc_internal_stair_railing_mt': ({ buildingStats, aggregatedUnitStats }) => {
        const idealRiserHeight = 0.175;
        const treadDepth = 0.28;
        let totalRailingMt = 0;

        const calcFlightRailing = (height: number) => {
            const riserCount = Math.round(height / idealRiserHeight);
            const horizontalLength = (riserCount - 1) * treadDepth;
            return Math.sqrt(Math.pow(height, 2) + Math.pow(horizontalLength, 2)) * 1.15;
        };

        if (buildingStats.buildingType === 'villa') {
            if (buildingStats.basementFloorCount > 0) {
                totalRailingMt += buildingStats.basementFloorCount * calcFlightRailing(buildingStats.basementFloorHeight || 2.80);
            }
            if (buildingStats.normalFloorCount > 0) {
                totalRailingMt += calcFlightRailing(buildingStats.groundFloorHeight || 3.20);
            }
            if (buildingStats.normalFloorCount > 1) {
                totalRailingMt += (buildingStats.normalFloorCount - 1) * calcFlightRailing(buildingStats.normalFloorHeight || 3.00);
            }
        } else {
            // APARTMAN DUBLEKS MANTIĞI
            const duplexCount = aggregatedUnitStats['total_duplex_count'] || 0;
            if (duplexCount > 0) {
                totalRailingMt += duplexCount * calcFlightRailing(buildingStats.normalFloorHeight || 3.00);
            }
        }
        return Math.round(totalRailingMt * 100) / 100;
    },

    'calc_marble_mortar': ({ buildingStats, totalBuildingHeight }) => {
        if (buildingStats.buildingType === 'villa') return 0;
        const stairsArea = (totalBuildingHeight / 0.17) * 0.45;
        return (stairsArea + getTotalHallArea(buildingStats)) * 0.04;
    },

    'calc_hall_area': ({ buildingStats, item }) => {
        if (buildingStats.buildingType === 'villa') return 0;
        return getTotalHallArea(buildingStats) * (item.multiplier || 1);
    },

    'calc_jcb': ({ totalFloors, totalConstructionArea }) => {
        const baseHours = 40;
        const floorHours = totalFloors * 4;
        const landscapeHours = totalConstructionArea * 0.02;
        return baseHours + floorHours + landscapeHours;
    },

    'calc_container_complex': ({ totalConstructionArea }) => {
        if (totalConstructionArea <= 2000) return 1.0;
        else if (totalConstructionArea <= 5000) return 2.0;
        else return 3.0;
    },

    'calc_drainage': ({ buildingStats, totalFloors }) => {
        const { perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        return perimeter + (8 * (raftHeight * 1.5)) + 5;
    },

    'calc_duration_months': ({ constructionDuration }) => constructionDuration,

    'calc_foundation_area': ({ buildingStats, totalFloors }) => {
        let foundationArea = buildingStats.basementFloorCount > 0
            ? buildingStats.basementFloorArea
            : buildingStats.groundFloorArea;

        let totalInsulationArea = foundationArea;

        // Radye temel kalınlığı ve ampatman (yanak) hesabı (Opsiyonel: Daha hassas metraj için)
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = raftHeight * 1.5;
        let basePerim = buildingStats.basementFloorCount > 0
            ? (buildingStats.basementFloorPerimeter || Math.sqrt(foundationArea) * 4)
            : (buildingStats.groundFloorPerimeter || Math.sqrt(foundationArea) * 4);

        const foundationPerimeter = basePerim + (8 * ampatman);

        // Radye temel yanak alanı
        totalInsulationArea += (foundationPerimeter * raftHeight);

        // Bodrum katlar varsa toprak altında kalan perde duvarların dış yüzey alanı
        if (buildingStats.basementFloorCount > 0) {
            const totalBasementHeight = buildingStats.basementFloorCount * buildingStats.basementFloorHeight;
            totalInsulationArea += (basePerim * totalBasementHeight);
        } else {
            // Bodrum yoksa subasman perdeleri toprakla temas eder
            const subasmanH = buildingStats.subasmanHeight !== undefined ? buildingStats.subasmanHeight : 0.50;
            if (subasmanH > 0) {
                totalInsulationArea += (basePerim * subasmanH);
            }
        }

        return totalInsulationArea;
    },

    'calc_scaffolding_area': ({ buildingStats }) => {
        let facadeHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
            buildingStats.groundFloorHeight;

        // Çatı katı varsa iskele yüksekliğine ekle
        if (buildingStats.hasRoofFloor) {
            facadeHeight += (buildingStats.roofFloorMaxHeight || 3.0); // İskele çatının en tepe noktasına (mahya) kadar kurulur
        }

        const basePerim = buildingStats.groundFloorPerimeter || (Math.sqrt(buildingStats.groundFloorArea) * 4);
        // İskele binadan 1'er metre açık kurulur, çevre genişler (4 kenar x 2'şer taraf = 16)
        const scaffoldingPerimeter = basePerim + 16;

        return facadeHeight * scaffoldingPerimeter;
    },

    'calc_scaffolding_duration': ({ constructionDuration }) => constructionDuration * 0.3
};

/**
 * Calculates Global Project Quantities using clean strategy map.
 */
export const calculateComplexGlobalQuantity = (
    item: CostItem,
    buildingStats: BuildingStats,
    totalConstructionArea: number,
    constructionDuration: number,
    aggregatedUnitStats: Record<string, number>,
    currentCosts?: CostCategory[],
    globalWallMaterial: WallMaterial = 'gazbeton'
): number => {
    const totalFloors = buildingStats.basementFloorCount + buildingStats.normalFloorCount + 1; // +1 Ground

    // Fiziksel İmalatlar İçin (Bodrum DAHİL Toplam Yükseklik)
    const totalBuildingHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
        buildingStats.groundFloorHeight +
        (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) +
        (buildingStats.hasRoofFloor ? (buildingStats.roofFloorMaxHeight || 0) : 0);

    // Yönetmelik Sınırları İçin (Bodrum HARİÇ Bina Yüksekliği)
    const regulationHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
        buildingStats.groundFloorHeight;

    const ctx: CalculationContext = {
        item,
        buildingStats,
        totalConstructionArea,
        constructionDuration,
        aggregatedUnitStats,
        currentCosts,
        globalWallMaterial,
        totalFloors,
        totalBuildingHeight,
        regulationHeight
    };

    const strategy = globalQuantityStrategies[item.auto_source];

    if (strategy) {
        return strategy(ctx);
    }

    return 0;
};

/**
 * Toplam inşaat alanına göre yapım süresini (ay) hesaplar.
 */
export const calculateConstructionDuration = (totalArea: number, buildingType: string = 'apartment'): number => {
    let duration = 0;

    // Villalar hızlı biter (Genellikle 6-9 ay)
    if (buildingType === 'villa') {
        if (totalArea <= 250) duration = 6;
        else if (totalArea <= 500) duration = 8;
        else duration = 10;
    } else {
        // Apartman/Ticari mantığı
        if (totalArea <= 1000) {
            duration = 10; // 12'den 10'a çekmek rekabetçi piyasa için daha gerçekçi
        } else if (totalArea <= 3000) {
            duration = (0.005 * totalArea) + 5;
        } else {
            duration = Math.sqrt(totalArea) / 2.28;
        }
    }
    const finalDuration = Math.min(duration, 36);
    return Math.round(finalDuration * 100) / 100;
};

export const calculateStairWellArea = (floorHeight: number): number => {
    if (!floorHeight || floorHeight <= 0) return 12.5;

    // Standart parametreler
    const stairWidth = 1.20; // Merdiven kol genişliği (mt)
    const landingDepth = 1.20; // Sahanlık derinliği (mt)
    const riserHeight = 0.17; // Rıht yüksekliği (mt)
    const treadWidth = 0.28; // Basamak genişliği (mt)
    const gap = 0.10; // Merdiven ortasındaki boşluk (mt)

    const totalSteps = Math.ceil(floorHeight / riserHeight);
    const stepsPerFlight = Math.ceil(totalSteps / 2);
    const flightLength = (stepsPerFlight - 1) * treadWidth; // Bir sahanlıktan diğerine yatay mesafe

    // Merdiven kovası toplam alanı = (Genişlik) * (Uzunluk)
    const totalWidth = (stairWidth * 2) + gap;
    const totalLength = flightLength + (landingDepth * 2);

    const calculatedArea = totalWidth * totalLength;

    // Sonucu makul sınırlar (10-18 m2) arasında tut
    return Math.min(Math.max(calculatedArea, 10), 18);
};

export const calculateDynamicUnitPrice = (
    item: CostItem,
    unitArea: number,
    totalConstructionArea: number,
    province?: string,
    isUrbanTransformation?: boolean,
    buildingStats?: BuildingStats,
    currentCosts?: CostCategory[],       // YENİ EKLENDİ
    globalWallMaterial?: WallMaterial    // YENİ EKLENDİ
): number => {
    // --- YENİ DUVAR DİNAMİK FİYAT HESAPLAMASI ---
    if (item.name === "Kuyu Temel Betonu") {
        return getGlobalPrice(currentCosts, "Betonarme Betonu");
    }
    if (item.name === "Kuyu Temel Demiri") {
        return getGlobalPrice(currentCosts, "İnşaat Demiri");
    }

    // 2. Duvar Dinamik Fiyat Hesaplaması kendi işine bakıyor
    if (item.name.startsWith("Duvar Malzemesi (") || item.name.startsWith("Duvar İşçiliği (")) {
        const match = item.name.match(/\(([\d\.]+) cm\)/);
        if (match && currentCosts && globalWallMaterial) {
            const thickness = parseFloat(match[1]);

            // wallCat tanımı KULLANILMADIĞI için tamamen SİLİNDİ

            const matItemName = globalWallMaterial === 'gazbeton' ? "Gazbeton Blok (m3)" :
                globalWallMaterial === 'tugla' ? "Tuğla Blok (m3)" : "Bims Blok (m3)";

            const laborItemName = globalWallMaterial === 'gazbeton' ? "Gazbeton İşçiliği (m2)" :
                globalWallMaterial === 'tugla' ? "Tuğla İşçiliği (m2)" : "Bims İşçiliği (m2)";

            const baseMatPrice = getGlobalPrice(currentCosts, matItemName);
            const baseLaborPrice = getGlobalPrice(currentCosts, laborItemName);

            if (item.name.startsWith("Duvar Malzemesi")) {
                // Kalınlığı (cm) metreye çevirerek m3 fiyatı ile çarpıp m2 fiyatı buluyoruz.
                return Math.round(baseMatPrice * (thickness / 100));
            } else {
                // İşçilik 15cm için referans alınmıştır, kalınlık oranına göre hareketlendirilir.
                return Math.round(baseLaborPrice);
            }
        }
    }


    if (item.name === "İskele Kirası (Aylık)" && buildingStats) {
        const facadeHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) + buildingStats.groundFloorHeight;
        const basePerim = buildingStats.groundFloorPerimeter || (Math.sqrt(buildingStats.groundFloorArea) * 4);
        const scaffoldingPerimeter = basePerim + 16;
        const scaffoldingArea = facadeHeight * scaffoldingPerimeter;
        return item.unit_price * scaffoldingArea; // basePrice yerine item.unit_price
    }

    if (item.name === "İnşaat Çivisi (kg)" || item.name === "Bağ Teli (kg)") {
        const ironKgPrice = getGlobalPrice(currentCosts, "İnşaat Demiri") / 1000;
        const ratio = item.name === "Bağ Teli (kg)" ? 2.0 : 1.6;
        return Math.round(ironKgPrice * ratio);
    }


    if (item.name === "Şantiye Elektrik Tüketimi (Aylık)") {
        const kwPrice = item.unit_price; // Wix'ten gelen 1 kW fiyatı

        // 1. Alan bazlı temel aylık tüketim tahmini (1000m2 başına 500 kW)
        let totalMonthlyKw = (totalConstructionArea / 1000) * 500;

        // 2. KULE VİNÇ KONTROLÜ VE EK TÜKETİM
        if (buildingStats) {
            const groundArea = buildingStats.groundFloorArea || 0;
            const totalFloors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;
            const hasTowerCrane = totalConstructionArea > 5000 || (groundArea > 650 && totalFloors > 6);

            if (hasTowerCrane) {
                totalMonthlyKw += 1000;
            }
        }

        // DÜZELTME: Personel maaşı yerine mantıklı bir "Asgari Şantiye Tüketimi" (Örn: Aylık minimum 500 kW)
        totalMonthlyKw = Math.max(totalMonthlyKw, 500);

        return totalMonthlyKw * kwPrice;
    }

    if (item.name === "Şantiye Personel Giderleri (Bekçi vb.)") {
        // Personel maaşı alan ne olursa olsun piyasa rayicidir, miktar (ay) ile çarpılır.
        return item.unit_price;
    }

    // --- ŞANTİYE ARAÇ GİDERLERİ (ALANLA DEĞİŞKEN) ---
    if (item.name === "Şantiye Araç Giderleri (Aylık)") {
        const basePrice = item.unit_price;

        // Küçük projelerde (3000 m² altı) araç gideri tam yansıtılmaz.
        // Paylaşımlı araç kullanımı veya lojistik kolaylığı varsayılır.
        if (totalConstructionArea < 3000) {
            const factor = Math.max(0.25, totalConstructionArea / 3000);
            return basePrice * factor;
        }
        return basePrice;
    }

    // --- ŞANTİYE SU GİDERİ HESABI ---
    if (item.name === "Şantiye Su Tüketimi (Aylık)") {
        const m3Price = item.unit_price; // Wix'ten gelen 1 m3 su fiyatı

        // Alan bazlı aylık tüketim tahmini (1000m2 başına 50 m3)
        let areaConsumption = (totalConstructionArea / 1000) * 50;

        // DÜZELTME: Personel maaşı yerine asgari şantiye su tüketimi (Örn: Aylık minimum 20 m3)
        areaConsumption = Math.max(areaConsumption, 20);

        return areaConsumption * m3Price;
    }

    if (item.name === "Ruhsat Harcı" || item.name === "İskan Harcı") {
        const basePrice = item.unit_price;

        // Şehir tarifesi (Kentsel dönüşüm dışı kalan yeni alanlar için)
        const highCostCities = ['İstanbul', 'Ankara', 'İzmir', 'Bursa', 'Antalya', 'Kocaeli', 'Muğla'];
        const mediumCostCities = ['Adana', 'Mersin', 'Gaziantep', 'Konya', 'Kayseri', 'Eskişehir', 'Tekirdağ', 'Sakarya', 'Denizli'];

        let standardMultiplier = 0.70;
        if (province && highCostCities.includes(province)) standardMultiplier = 1.0;
        else if (province && mediumCostCities.includes(province)) standardMultiplier = 0.80;

        // EĞER KENTSEL DÖNÜŞÜM VARSA:
        if (isUrbanTransformation && buildingStats) {
            // Mevcut alan girilmemişse, tahmini olarak (Mevcut Daire Sayısı x 100m²) kabul edelim.
            const existingArea = buildingStats.existingArea || (buildingStats.existingUnitCount ? buildingStats.existingUnitCount * 100 : 0);

            if (existingArea > 0 && totalConstructionArea > 0) {
                const exemptArea = Math.min(existingArea, totalConstructionArea);
                const additionalArea = totalConstructionArea - exemptArea;

                const totalFee = (exemptArea * basePrice * 0.15) + (additionalArea * basePrice * standardMultiplier);
                return totalFee / totalConstructionArea;
            } else {
                return basePrice * 0.15;
            }
        }
        return basePrice * standardMultiplier;
    }
    // Sadece "Mimari Proje" kalemi için bu kuralı uygula
    if (item.name === "Mimari Proje") {
        const basePrice = item.unit_price;

        if (totalConstructionArea <= 1000) {
            // 1000 m2 ve altı sabit taban fiyat
            return basePrice;
        } else if (totalConstructionArea >= 3000) {
            // 3000 m2 ve üstü %20 zamlı sabit fiyat
            return basePrice * 1.20;
        } else {
            // 1000 ile 3000 arası lineer enterpolasyon
            // Örn: 2000 m2 ise tam ortası olmalı (%10 artış)
            const range = 3000 - 1000; // 2000
            const excess = totalConstructionArea - 1000;
            const ratio = excess / range; // 0 ile 1 arasında bir oran

            const maxIncreaseFactor = 0.20; // %20 max artış
            const currentIncrease = 1 + (maxIncreaseFactor * ratio);

            return basePrice * currentIncrease;
        }
    }

    if (item.name === "Özel Havuz (Hafriyat, İzolasyon ve Beton)" && buildingStats && currentCosts) {
        const poolArea = buildingStats.poolArea || 0;

        if (poolArea > 0) {

            // Sadece fiyatlar constants dosyasından (merkezden) çekiliyor
            const p_excavation = getGlobalPrice(currentCosts, "Hafriyat (Kazı ve Döküm)");
            const p_concrete = getGlobalPrice(currentCosts, "Betonarme Betonu");
            const p_iron = getGlobalPrice(currentCosts, "İnşaat Demiri");
            const p_formwork = getGlobalPrice(currentCosts, "Kalıp İşçiliği & Malzeme");
            const p_insulation = getGlobalPrice(currentCosts, "Temel Su Yalıtımı (Bohçalama)");
            const p_ceramic = getGlobalPrice(currentCosts, "Seramik Kaplama");
            const p_ceramic_adhesive = getGlobalPrice(currentCosts, "Seramik Yapıştırıcısı");
            const p_joint_filler = getGlobalPrice(currentCosts, "Seramik Derz Dolgusu");

            // Ölçüler ve çarpanlar eskisi gibi hesaplama içinde kalıyor
            const depth = 1.5;
            const perimeter = 4 * Math.sqrt(poolArea);
            const wallArea = perimeter * depth;
            const innerSurfaceArea = poolArea + wallArea;

            // Hassas Metrajlar
            const excavationVol = (poolArea + perimeter * 0.5) * (depth + 0.3);
            const concreteVol = (poolArea * 0.20) + (wallArea * 0.20);
            const ironTon = concreteVol * 0.120;
            const formworkArea = wallArea * 2;

            // Tutar Hesaplamaları
            const costExcavation = excavationVol * p_excavation;
            const costConcrete = concreteVol * p_concrete;
            const costIron = ironTon * p_iron;
            const costFormwork = formworkArea * p_formwork;
            const costInsulation = innerSurfaceArea * p_insulation * 1.5;
            const costCeramic = innerSurfaceArea * p_ceramic;
            const costAdhesive = innerSurfaceArea * 5 * p_ceramic_adhesive;
            const costFiller = innerSurfaceArea * 0.5 * p_joint_filler;

            const totalPoolMaterialCost = costExcavation + costConcrete + costIron + costFormwork + costInsulation + costCeramic + costAdhesive + costFiller;

            const calculatedUnitPrice = totalPoolMaterialCost / poolArea;

            return Math.round(calculatedUnitPrice * 1.10);
        }
    }

    if (item.name === "Grobeton") {
        const c30Price = getGlobalPrice(currentCosts, "Betonarme Betonu") || 2500;
        return Math.round(c30Price * 0.85);
    }

    if (item.name === "Elektrik Tesisatı Malzeme" || item.name === "Elektrik Tesisatı İşçilik") {
        const basePrice = item.unit_price; // Bu fiyat 80 m2 için kabul edilir

        if (unitArea <= 50) {
            return basePrice * 1.2; // 50 m2 ve altı %20 zamlı
        }
        else if (unitArea < 80) {
            // 50 ile 80 m2 arası lineer azalış (1.2'den 1.0'a)
            const ratio = (unitArea - 50) / 30;
            return basePrice * (1.2 - (0.2 * ratio));
        }
        else if (unitArea <= 120) {
            // 80 ile 120 m2 arası lineer azalış (1.0'dan 0.8'e)
            const ratio = (unitArea - 80) / 40;
            return basePrice * (1.0 - (0.2 * ratio));
        }
        else {
            return basePrice * 0.8; // 120 m2 üzeri %20 indirimli
        }
    }

    if (item.name === "Konteyner (Ofis/Depo)") {
        const basePrice = item.unit_price; // Baz Fiyat (Örn: 65.000 TL)

        // 0 - 1000 m2: Sabit Fiyat
        if (totalConstructionArea <= 1000) {
            return basePrice;
        }
        // 1000 - 2000 m2: Fiyat 1.0 -> 1.5 katına lineer artar
        else if (totalConstructionArea <= 2000) {
            const progress = (totalConstructionArea - 1000) / 1000;
            return basePrice * (1.0 + (0.5 * progress));
        }
        // 2000 - 3000 m2: Fiyat 1.5 katı (Sabit)
        else if (totalConstructionArea <= 3000) {
            return basePrice * 1.5;
        }
        // 3000 - 5000 m2: Fiyat 1.0 -> 1.5 katına tekrar lineer artar (Resetlenerek)
        // (Burada 2 adete çıktığı için birim fiyatı tekrar ölçeklendirdik)
        else if (totalConstructionArea <= 5000) {
            const progress = (totalConstructionArea - 3000) / 2000;
            return basePrice * (1.0 + (0.5 * progress));
        }
        // 5000 m2 üzeri: Sabit Baz Fiyat (3 adet olduğu için)
        else {
            return basePrice;
        }
    }

    if (item.name === "Şantiye Şefi (Aylık)") {
        const basePrice = item.unit_price; // cost_data.ts'den gelen varsayılan maaş (Örn: 20.000 TL)
        let chiefFactor = 1.0;

        if (totalConstructionArea <= 1000) {
            // 1000 m² ve altında maaş baz fiyatın tam yarısı (%50'si) olur
            chiefFactor = 0.5;
        } else if (totalConstructionArea < 3000) {
            // 1000 m² ile 3000 m² arasında maaş 0.5'ten 1.0'a doğru lineer artar
            chiefFactor = 0.5 + ((totalConstructionArea - 1000) / 2000) * 0.5;
        } else if (totalConstructionArea <= 5000) {
            // 3000 m² ile 5000 m² arasında 1.0'dan 1.2'ye lineer artar
            chiefFactor = 1.0 + ((totalConstructionArea - 3000) / 2000) * 0.2;
        } else {
            // 5000 m² üstünde katsayı 1.2 sabit kalır
            chiefFactor = 1.2;
        }

        // Hesaplanmış dinamik aylık şef maaşını döndür
        return basePrice * chiefFactor;
    }

    // Asansör için durak sayısına göre dinamik fiyat hesaplaması
    if (item.name === "Asansör (Paket)" && buildingStats) {
        const basePrice = item.unit_price;
        const totalFloors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1; // +1 Zemin

        const stops = totalFloors;
        const extraStops = Math.max(0, stops - 2); // 2 duraktan sonrası ekstra sayılır
        const costPerExtraStop = basePrice * 0.025; // Her ilave durak için %2.5 fiyat farkı

        return basePrice + (extraStops * costPerExtraStop);
    }

    if (buildingStats?.buildingType === 'villa') {
        // İşçilik ve Kaba Montaj gerektirenler (Daha az çarpan)
        const structuralPremium = [
            "Mantolama Malzemesi", "Çatı Konstrüksiyon ve Kaplama", "PVC Pencere (Doğrama)"
        ];

        // Göz önünde olan ve lüks seçilen Mimari/Dekoratif kalemler (Yüksek çarpan)
        const decorativePremium = [
            "Bina Giriş Kapısı (Ana)", "Çelik Kapı (Daire Giriş)", "İç Kapı (Panel/Lake)",
            "Mutfak Dolabı (Standart)", "Mutfak Tezgahı (Granit/Çimstone)", "Banyo Dolabı & Lavabo",
            "Portmanto / Vestiyer", "İç Merdiven (Dubleks)", "Balkon Korkulukları (Alüminyum)",
            "Cam Balkon Sistemleri", "Laminat Parke (Anahtar Teslim)", "Seramik Kaplama"
        ];

        // Mekanik ve Vitrifiye (Çok lüks armatürler seçileceği için en yüksek çarpan)
        const mepPremium = [
            "Klozet Takımı (Gömme Rezervuar)", "Duşakabin", "Duş Seti (Başlık/Hortum)",
            "Lavabo Bataryası", "Evye Bataryası", "Davlumbaz / Aspiratör",
            "Cephe Aydınlatma (Wallwasher)"
        ];

        // --- DİNAMİK LÜKS KATSAYISI (Luxury Scale) HESABI ---
        if ((item.name === "Mantolama Malzemesi" || item.name === "Mantolama İşçiliği") && buildingStats) {
            let zoneMultiplier = 1.0;
            const heatZone = buildingStats.heatZone || 2; // Varsayılan 2. Bölge kabulü

            // İklim bölgelerine göre malzeme kalınlık ve nitelik (EPS/XPS/Taşyünü) maliyet katsayıları
            switch (heatZone) {
                case 1: zoneMultiplier = 0.85; break; // 1. Bölge (Örn: Antalya) -> İnce EPS (3-4 cm)
                case 2: zoneMultiplier = 1.00; break; // 2. Bölge (Örn: İstanbul) -> Standart Karbonlu EPS (5 cm)
                case 3: zoneMultiplier = 1.25; break; // 3. Bölge (Örn: Ankara) -> Kalın EPS veya Taşyünü (6-8 cm)
                case 4: zoneMultiplier = 1.50; break; // 4. Bölge (Örn: Erzurum) -> Çok Kalın XPS / Taşyünü (8-10 cm)
            }

            let calculatedPrice = item.unit_price;

            if (item.name === "Mantolama Malzemesi") {
                // Malzeme iklimden tam etkilenir (Kalınlık ve yoğunluk farkı)
                calculatedPrice = item.unit_price * zoneMultiplier;
            } else if (item.name === "Mantolama İşçiliği") {
                // İşçilik iklimden bağımsızdır veya sadece %5'lik bir "kalın malzeme" farkı eklenir
                calculatedPrice = item.unit_price * 1.05;
            }

            // Çakışmayı önlemek için: Eğer bina tipi villa ise, aşağıdaki "structuralPremium" katsayısını 
            // manuel olarak iklimsel fiyata da yansıtıp doğrudan döndürüyoruz.
            if (buildingStats.buildingType === 'villa') {
                let luxuryScale = 1.0;
                if (totalConstructionArea <= 150) {
                    luxuryScale = 0.60;
                } else if (totalConstructionArea >= 1000) {
                    luxuryScale = 1.80;
                } else {
                    const range = 1000 - 150;
                    const excess = totalConstructionArea - 150;
                    luxuryScale = 0.60 + (1.20 * (excess / range));
                }

                // Villalar için yapısal katsayı payı olan %20'yi (0.20) lüks çarpanıyla ekliyoruz
                calculatedPrice = calculatedPrice * (1 + (0.20 * luxuryScale));
            }

            return Math.round(calculatedPrice);
        }
        let luxuryScale = 1.0;

        if (totalConstructionArea <= 150) {
            luxuryScale = 0.60; // Tiny/Kompakt Villa: Karmaşa az, lüks oranı düşük
        } else if (totalConstructionArea >= 1000) {
            luxuryScale = 1.80; // Malikane: VRF, Akıllı Ev, Galeri Boşlukları, Özel Şaftlar
        } else {
            // 150 m² ile 1000 m² arasında lineer bir artış eğrisi kuralım
            const range = 1000 - 150;     // 850 m² metraj farkı
            const excess = totalConstructionArea - 150;
            const progress = excess / range;

            // 0.60'tan 1.80'e kadar (1.20 birimlik fark) doğrusal artış
            luxuryScale = 0.60 + (1.20 * progress);
        }

        // --- ÇARPANLARIN DİNAMİK UYGULANMASI ---
        if (structuralPremium.includes(item.name)) {
            // Temel artış %20 (0.20), luxuryScale ile çarpılarak esnetiliyor
            return Math.round(item.unit_price * (1 + (0.20 * luxuryScale)));
        } else if (decorativePremium.includes(item.name)) {
            // Temel artış %45 (0.45)
            return Math.round(item.unit_price * (1 + (0.45 * luxuryScale)));
        } else if (mepPremium.includes(item.name)) {
            // Temel artış %70 (0.70)
            return Math.round(item.unit_price * (1 + (0.70 * luxuryScale)));
        }
    }

    // Diğer tüm kalemler için orijinal fiyatı döndür
    return item.unit_price;
};
export const calculateTapuNoterFees = (
    unitCount: number,
    province: string,
    constructionModel: 'standard' | 'kat_karsiligi' = 'standard',
    isUrbanTransformation: boolean = false,
    totalConstructionCost: number = 0, // Kritik: Toplam inşaat maliyeti parametre olarak eklenmeli
    currentCosts?: CostCategory[]
): number => {
    // 1. ŞEHİR KATSAYISI (Döner sermaye vb. maktu giderler için)
    const highCostCities = ['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Bursa', 'Muğla'];
    let cityMultiplier = highCostCities.includes(province) ? 2.5 : 1.5;

    const baseTapuDoner = getGlobalPrice(currentCosts, "Tapu Döner Sermaye") * cityMultiplier;
    const baseNoterPaperFee = getGlobalPrice(currentCosts, "Noter Yazı Ücreti");

    // SENARYO 1: KENTSEL DÖNÜŞÜM (6306 Sayılı Kanun)
    if (isUrbanTransformation) {
        // Kentsel Dönüşüm maktu evrak tahmini bedelini sistemden çek, bulamazsa 950 kullan
        const kentselDonusumEvrakBedeli = getGlobalPrice(currentCosts, "Noter Yazı Ücreti") / 2;

        // MUAFİYET: Damga Vergisi, Noter Harcı ve Tapu Harcı alınmaz.
        // Sadece maktu kağıt ücreti ve cüzi işlem masrafı.
        return baseNoterPaperFee + (unitCount * kentselDonusumEvrakBedeli);
    }

    // SENARYO 2: KAT KARŞILIĞI İNŞAAT SÖZLEŞMESİ (Kentsel Dönüşüm YOKSA)
    if (constructionModel === 'kat_karsiligi') {
        /**
         * GERÇEK DÜNYA MANTIĞI:
         * Nispi Harçlar (Büyük meblağlar buradan gelir):
         * - Damga Vergisi: %0.948 (Binde 9.48)
         * - Noter Harcı: %0.113 (Binde 1.13)
         * Toplam yaklaşık: %1.06 (İnşaat Maliyeti üzerinden)
         */
        const stampDutyRate = 0.00948; // Binde 9.48
        const notaryProportionalRate = 0.00113; // Binde 1.13

        // Eğer toplam maliyet gelmemişse (fallback), metrekare bazlı kaba bir tahmin yap (Örn: 25.000 TL/m2)
        const referenceValue = totalConstructionCost > 0 ? totalConstructionCost : (unitCount * 100 * 25000);

        const nispiHarclar = referenceValue * (stampDutyRate + notaryProportionalRate);
        const maktuGiderler = baseNoterPaperFee * cityMultiplier; // Kağıt, imza, onay ücretleri

        const tapuTotal = unitCount * baseTapuDoner;

        return Math.round(nispiHarclar + maktuGiderler + tapuTotal);
    }

    // SENARYO 3: STANDART TAAHHÜT
    const baseStandardContract = getGlobalPrice(currentCosts, "Standart Sözleşme Harcı");
    const standardContractFee = baseStandardContract * cityMultiplier;
    const tapuTotal = unitCount * baseTapuDoner;

    return standardContractFee + tapuTotal;
};