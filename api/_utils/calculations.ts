import { UnitType, BuildingStats, WallMaterial } from '../../src/types';
import { CostCategory, CostItem } from './cost_data';
import { calculateWasteFactor } from '../../src/utils/geometry';
import { DEFAULT_PRICES } from './constants';

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

export const estimatePerimeter = (area: number): number => {
    if (!area || area <= 0) return 0;
    return 10 * Math.sqrt(area / 6);
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
    floorHeight: number = 3.0,
    totalBuildingHeight: number = 9.0 // <-- ZEKİCE PARAMETREMİZ EKLENDİ
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

    // 2. Açıklık/Alan Çarpanı (Kiriş açıklıkları büyüdükçe demir artar)
    let spanMultiplier = 1.0;
    if (averageFloorArea > 200) {
        const extraArea = averageFloorArea - 200;
        spanMultiplier += Math.min(0.15, (extraArea / 100) * 0.02);
    }

    // 3. Kat Yüksekliği Çarpanı (Kat Narinliği - Individual Floor Slenderness)
    let localHeightMultiplier = 1.0;
    if (floorHeight > 3.5) {
        const extraHeight = floorHeight - 3.5;
        localHeightMultiplier += Math.min(0.05, extraHeight * 0.02);
    }

    // 4. ZEKİCE KURGU: Toplam Bina Yüksekliği Çarpanı (Devrilme Momenti ve Perde İhtiyacı)
    // TBDY 2018'e göre binalar ~21.5m'den sonra daha rijit perde sistemlerine ihtiyaç duyar.
    let globalHeightMultiplier = 1.0;
    if (totalBuildingHeight > 21.5) {
        const extraBuildingHeight = totalBuildingHeight - 21.5;

        // Her 1 metrelik ekstra yükseklik için demir yoğunluğu %1.2 artar.
        // Maksimum %60 artış ile sınırlandırıyoruz (Çok yüksek binalar zaten çelik veya kompozite döner)
        globalHeightMultiplier += Math.min(0.60, extraBuildingHeight * 0.012);
    }

    return baseCoeff * spanMultiplier * localHeightMultiplier * globalHeightMultiplier;
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
                perimeterM = room.manualPerimeterM || estimatePerimeter(areaM2);
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
            calc_rough_plaster_area: 0, calc_paint_wall_area: 0, calc_ceiling_paint_area: 0, calc_plaster_area: 0,
            calc_window_area: 0, calc_sill_length: 0, calc_window_perimeter: 0, calc_balcony_railing: 0,
            wall_10_area: 0, wall_13_5_area: 0, wall_15_area: 0, wall_20_area: 0, wall_25_area: 0,
            column_concrete_volume: 0, column_formwork_area: 0, beam_concrete_volume: 0, beam_formwork_area: 0,
            slab_concrete_volume: 0, slab_formwork_area: 0, calc_concrete_unit: 0, calc_iron_unit: 0, calc_formwork_unit: 0,
            radiator_length: 0, kitchen_cabinet_length: 0, calc_steel_door: 0, calc_inner_door: 0,
            calc_kitchen_cabinet: 0, calc_kitchen_counter_length: 0, calc_bathroom_cabinet: 0, calc_kitchen_sink: 0,
            calc_toilet: 0, calc_shower_cabin: 0, calc_shower_set: 0, calc_basin_mixer: 0, calc_sink_mixer: 0,
            calc_electrical_points: 0, calc_weak_current_points: 0, calc_switch_socket_count: 0, calc_sub_panel_count: 0,
            calc_heat_pump: 0, calc_vrf_infrastructure: 0, calc_vrf_indoor: 0,
            calc_suspended_ceiling_area: 0, waterproofing_area: 0,
            wDed_10: 0, wDed_13_5: 0, wDed_15: 0, wDed_20: 0, wDed_25: 0,
            dDed_10: 0, dDed_13_5: 0, dDed_15: 0, dDed_20: 0, dDed_25: 0,
        };

        let roomBreakdowns: Record<string, { roomName: string, qty: number }[]> = {};

        if (!settings.isStructural) {
            stats.calc_unit_count = 1; stats.calc_steel_door = 1; stats.calc_sub_panel_count = 1;
            const heatingSystem = buildingStats.heatingSystem || 'radiator';
            if (heatingSystem === 'radiator' || heatingSystem === 'underfloor') stats.calc_combi_count = 1;
            else if (heatingSystem === 'heat_pump') stats.calc_heat_pump = 1;
        }

        // 1. ODA DÖNGÜSÜ
        rawMetrics.rooms.forEach((room: any) => {
            if (!settings.isStructural) {
                const statsBefore = { ...stats };

                this.applyHeating(stats, room, buildingStats, settings.globalWallMaterial);

                // HATA VEREN KISIM BURASIYDI, ŞU AN TAM UYUMLU:
                this.applyFinishesAndOpenings(stats, room, rawMetrics.defaultFloorHeight, rawMetrics.avgSlabThicknessM);

                this.applySpecificRooms(stats, room);
                this.applyElectricalPoints(stats, room);

                Object.keys(stats).forEach(k => {
                    const diff = (stats[k] || 0) - (statsBefore[k] || 0);
                    if (Math.abs(diff) > 0.001) { // 0 olanları yoksay
                        if (!roomBreakdowns[k]) roomBreakdowns[k] = [];
                        roomBreakdowns[k].push({ roomName: room.name || 'İsimsiz Oda', qty: diff });
                    }
                });
            }
        });
        if (!settings.isStructural && stats.calc_vrf_infrastructure > 0) {
            stats.calc_vrf_indoor = Math.ceil(stats.calc_vrf_infrastructure / 35);
        }
        if (!settings.isStructural) {
            // Süpürgelik düşümü için de snapshot alalım
            const statsBefore = { ...stats };
            const totalDoorBaseboardDeduction = (stats.calc_inner_door * 1.80) + (stats.calc_steel_door * 0.90);
            stats.dry_perimeter = Math.max(0, stats.dry_perimeter - totalDoorBaseboardDeduction);

            const diff = (stats.dry_perimeter || 0) - (statsBefore.dry_perimeter || 0);
            if (Math.abs(diff) > 0.001) {
                if (!roomBreakdowns['dry_perimeter']) roomBreakdowns['dry_perimeter'] = [];
                roomBreakdowns['dry_perimeter'].push({ roomName: 'Kapı & Süpürgelik Düşümü', qty: diff });
            }
        }

        // 2. KABA YAPI (Duvar, Beton, Demir)
        // ÇAĞRIDA ARTIK wDed VE dDed GÖNDERİLMİYOR:
        this.applyStructure(stats, unit, rawMetrics, buildingStats, settings);

        // 3. STATİK & MİMARİ ÇAKIŞMA ÖNLEME (Fallbacks)
        this.applyFallbacks(stats, unit, rawMetrics, buildingStats, settings);

        return { stats, roomBreakdowns }; // <--- DÜZELTİLDİ
    }

    private static applyHeating(stats: any, room: any, buildingStats: BuildingStats, material: WallMaterial) {
        let materialHeatFactor = 1.0;
        if (material === 'gazbeton') materialHeatFactor = 0.85;
        else if (material === 'bims') materialHeatFactor = 0.92;
        if (buildingStats.buildingType === 'villa') materialHeatFactor *= 1.25;

        const heatLossFactor = (10 + (buildingStats.heatZone * 10)) * materialHeatFactor;
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
                stats.calc_underfloor_area += heatedArea;

                // 1 port ortalama 15 m² alanı ısıtır.
                const portsNeeded = Math.ceil(heatedArea / 15.0);

                // Her bağımsız bölümün kendine ait 1 kutusu ve tam sayı kolektörü olmalıdır.
                // 10 portlu bir kolektör kutusu baz alınmıştır.
                stats.calc_underfloor_collector = (stats.calc_underfloor_collector || 0) + Math.ceil(portsNeeded / 10.0);
            } else if (heatingSystem === 'vrf') {
                stats.calc_vrf_infrastructure += heatedArea;
            }
        }
    }

    private static applyFinishesAndOpenings(stats: any, room: any, dHeight: number, avgThick: number) {
        const doorDeduction = (room.properties.doorCount || 0) * 1.89;
        const windowDeduction = room.properties.windowArea || 0;
        const grossWallArea = Math.max(0, (room.perimeterM * room.roomHeight) - (doorDeduction + windowDeduction));

        const isSuspendedCeiling = room.properties.hasSuspendedCeiling ?? (room.type === 'bath' || room.type === 'wc');

        if (isSuspendedCeiling) {
            stats.calc_suspended_ceiling_area = (stats.calc_suspended_ceiling_area || 0) + room.areaM2;
        } else {
            stats.calc_ceiling_paint_area += room.areaM2;
        }

        // --- GÜNCELLENEN KISIM: SIVA MANTIĞI AYRIŞTIRILDI ---
        if (room.properties.wallFinish === 'boya') {
            stats.calc_paint_wall_area += grossWallArea;
            stats.calc_plaster_area += grossWallArea + (isSuspendedCeiling ? 0 : room.areaM2); // Sadece Alçı Sıva
        } else {
            stats.wet_area += grossWallArea;
            stats.net_wet_area += grossWallArea;
            stats.calc_rough_plaster_area += grossWallArea; // Seramik altına sadece Kara Sıva
        }
        // -----------------------------------------------------

        if (room.properties.hasCornice) stats.cornice_length += room.perimeterM;
        if (room.properties.floorType === 'seramik' || room.properties.hasWaterproofing) {
            stats.wet_area += room.areaM2 * room.roomWaste;
            stats.net_wet_area += room.areaM2;

            // Yalıtımı oda tipine göre ayır:
            const insulationArea = room.areaM2 + (room.perimeterM * 0.30); // 30cm parapet dönüş payı

            if (room.type === 'balcony') {
                stats.balcony_waterproofing_area = (stats.balcony_waterproofing_area || 0) + insulationArea;
            } else {
                stats.waterproofing_area += insulationArea; // Sadece Banyo ve WC'ler burada kalır
            }
        }
        if (room.properties.floorType === 'parke') {
            stats.dry_area += room.areaM2 * room.roomWaste;
            stats.dry_perimeter += room.perimeterM * room.roomWaste;
        }

        stats.calc_inner_door += (room.properties.doorCount || 0);

        // Windows Deductions (Doğrudan stats objesine yazılıyor)
        const wArea = room.properties.windowArea || 0;
        if (wArea > 0) {
            stats.calc_window_area += wArea;
            const wThick = room.properties.windowWallThickness || 20;
            let tKey = wThick <= 10 ? '10' : wThick <= 13.5 ? '13_5' : wThick <= 15 ? '15' : wThick <= 20 ? '20' : '25';

            stats[`wDed_${tKey}`] = (stats[`wDed_${tKey}`] || 0) + wArea;

            const wWidth = Math.sqrt(wArea * (4 / 3));
            const wHeight = Math.sqrt(wArea * (3 / 4));
            stats.calc_sill_length += (wWidth + 0.05);
            stats.calc_window_perimeter += 2 * (wWidth + wHeight);
        }

        // Doors Deductions (Doğrudan stats objesine yazılıyor)
        const dArea = (room.properties.doorCount || 0) * 1.89;
        if (dArea > 0) {
            const dThick = room.properties.doorWallThickness || 13.5;
            let tKey = dThick <= 10 ? '10' : dThick <= 13.5 ? '13_5' : dThick <= 15 ? '15' : dThick <= 20 ? '20' : '25';

            stats[`dDed_${tKey}`] = (stats[`dDed_${tKey}`] || 0) + dArea;
        }
    }

    private static applySpecificRooms(stats: any, room: any) {
        const isKitchen = room.type === 'kitchen' || room.type === 'american_kitchen' || room.name.toLowerCase().includes('mutfak') || room.name.toLowerCase().includes('kitchen');
        const isAmericanKitchen = room.type === 'american_kitchen' || room.name.toLowerCase().includes('amerikan');
        // --- SIHHİ TESİSAT HASSASİYET MATEMATİĞİ ---
        // Kullanıcının girdiği oda çevresi (yatay PPRC/PVC borulama uzunluğunu etkiler)
        const roomPerimeter = room.perimeterM || 0;

        // Kullanıcının girdiği tavan yüksekliği (dikey borulama/şaft inişlerini etkiler). 
        // 2.8m standart kabul edilmiştir. Tavan yükseldikçe maliyet artar.
        const heightFactor = Math.max(0, ((room.roomHeight || 2.8) - 2.8) * 0.05);

        if (isKitchen) {
            // Mutfak: Sabit armatürler (0.25) + Yatay Çevre Çarpanı + Dikey Yükseklik Çarpanı
            stats.calc_plumbing_unit += 0.25 + (roomPerimeter * 0.015) + heightFactor;
            // YENİ: Amerikan mutfaklarda alanın sadece %35'i mutfakmış gibi varsayılır.
            const effectiveAreaForCabinet = isAmericanKitchen ? (room.areaM2 * 0.35) : room.areaM2;
            const cabinetLength = Math.min(Math.max(2.5, 2.5 + (effectiveAreaForCabinet * 0.15)), 7.0);

            // Tezgah uzunluğu = Mutfak dolabı uzunluğu (Tül Metre)

            stats.calc_kitchen_cabinet += cabinetLength;
            stats.kitchen_cabinet_length += cabinetLength;
            stats.calc_kitchen_counter_length += cabinetLength;
            stats.calc_kitchen_sink += 1;
            stats.calc_sink_mixer += 1;
        }
        if (room.type === 'bath') {
            // Banyo: Sabit armatürler (0.30) + Yatay Çevre Çarpanı + Dikey Yükseklik Çarpanı
            stats.calc_plumbing_unit += 0.30 + (roomPerimeter * 0.020) + heightFactor;

            stats.calc_bathroom_cabinet += 1;
            stats.calc_toilet += 1;
            stats.calc_basin_mixer += 1;
            stats.calc_shower_cabin += 1;
            stats.calc_shower_set += 1;
        }
        if (room.type === 'wc') {
            // WC: Sabit armatürler (0.15) + Yatay Çevre Çarpanı + Dikey Yükseklik Çarpanı
            stats.calc_plumbing_unit += 0.15 + (roomPerimeter * 0.015) + heightFactor;

            stats.calc_toilet += 1;
            stats.calc_basin_mixer += 1;
        }
        if (room.type === 'balcony') {
            // Balkon: 5m²'den büyük balkonlara süzgeç ve yıkama musluğu tesisatı payı eklenir
            if (room.areaM2 > 5) {
                stats.calc_plumbing_unit += 0.05 + (roomPerimeter * 0.005);
            }
            stats.calc_balcony_railing += (room.perimeterM / 2);
        }
    }

    private static applyElectricalPoints(stats: any, room: any) {
        let sp = 0, wp = 0;
        switch (room.type) {
            case 'living': sp = 6; wp = 3; break;
            case 'american_kitchen': sp = 12; wp = 3; break;
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

    private static applyStructure(stats: any, unit: UnitType, metrics: any, buildingStats: BuildingStats, settings: any) {
        const { globalWallMaterial, globalWallMode, globalConcreteMode, ironCoeff } = settings;
        const useDetailedWalls = globalWallMode === 'detailed';
        const useDetailedConcrete = globalConcreteMode === 'detailed';

        // 1. SADECE STATİK PLANLAR İÇİN BRÜT DUVAR HESABI
        if (settings.isStructural) {
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
                let floorPerimeter = estimatePerimeter(refArea);
                if (unit.floorType === 'normal' && buildingStats.normalFloorPerimeter) floorPerimeter = buildingStats.normalFloorPerimeter;
                else if (unit.floorType === 'ground' && buildingStats.groundFloorPerimeter) floorPerimeter = buildingStats.groundFloorPerimeter;
                else if (unit.floorType === 'basement' && buildingStats.basementFloorPerimeter) floorPerimeter = buildingStats.basementFloorPerimeter;

                const heightFactor = Math.max(1, (metrics.defaultFloorHeight / 3.0));

                // YENİ VE DOĞRU MANTIK:
                // 1. Dış Duvar = Bina Çevresi x Yükseklik
                const outerWall2DArea = floorPerimeter * metrics.defaultFloorHeight;

                // 2. İç Duvar = Normal bir dairede m2 başına yaklaşık 1 ile 1.2 m2 arası iç duvar düşer
                const innerWall2DArea = refArea * 1.1 * heightFactor;

                // 3. Sıva Yüzeyi = (İç duvarların İKİ yüzü) + (Dış duvarın TEK iç yüzü)
                const estimatedWallSurface = (innerWall2DArea * 2) + outerWall2DArea;

                const outerThickStr = buildingStats.outerWallThickness === 13.5 ? '13_5' : String(buildingStats.outerWallThickness || 20);
                const innerThickStr = buildingStats.innerWallThickness === 13.5 ? '13_5' : String(buildingStats.innerWallThickness || 13.5);

                stats[`wall_${outerThickStr}_area`] += outerWall2DArea;
                stats[`wall_${innerThickStr}_area`] += innerWall2DArea;
                stats.net_wall_area = estimatedWallSurface;
            }
        }

        // (ÇİFT DÜŞÜM YAPAN wDed / dDed DÖNGÜSÜ BURADAN SİLİNDİ)

        // 3. SADECE STATİK PLANLAR İÇİN BETON VE DEMİR HESABI
        if (settings.isStructural) {
            if (useDetailedConcrete) {
                let totalColumnAreaOnFloor = 0;
                (unit.columns || []).forEach(col => {
                    let areaM2 = col.manualAreaM2 !== undefined && col.manualAreaM2 > 0 ? col.manualAreaM2 : (unit.scale > 0 ? col.area_px / (unit.scale * unit.scale) : 0);
                    let perimeterM = col.manualPerimeterM || estimatePerimeter(areaM2);
                    const height = (col.properties.height && col.properties.height > 0) ? col.properties.height : metrics.defaultFloorHeight;
                    stats.column_concrete_volume += areaM2 * height;
                    stats.column_formwork_area += perimeterM * height;
                    totalColumnAreaOnFloor += areaM2;
                });
                (unit.beams || []).forEach(beam => {
                    let lengthM = beam.manualLengthM !== undefined && beam.manualLengthM > 0 ? beam.manualLengthM : (unit.scale > 0 ? beam.length_px / unit.scale : 0);
                    const widthM = beam.properties.width / 100, heightM = beam.properties.height / 100, slabThickM = beam.properties.slabThickness / 100;
                    stats.beam_concrete_volume += widthM * Math.max(0, heightM - slabThickM) * lengthM;
                    const sideFormworkArea = (2 * Math.max(0, heightM - slabThickM)) * lengthM;
                    stats.beam_formwork_area += sideFormworkArea;
                });
                let totalSlabIronBase = 0;
                (unit.slabs || []).forEach(slab => {
                    let area = slab.manualAreaM2 > 0 ? slab.manualAreaM2 : (slab.area_px && unit.scale > 0 ? slab.area_px / (unit.scale * unit.scale) : 0);
                    let thicknessM = slab.properties.thickness / 100;

                    // 1. Brüt Hacmi Hesapla
                    let grossVolume = area * thicknessM;
                    let concreteVolume = grossVolume;

                    // ZEKİCE MANTIK: Demir hesabı net betondan değil, brüt hacimden yapılır.
                    // Plak döşeme için baz yoğunluk: 85 kg/m³ (Brüt hacim başına)
                    let ironDensityPerGrossVolume = 0.085;

                    if (slab.properties.type === 'asmolen') {
                        // Asmolen dolguları (köpük/tuğla) beton hacmini %35 azaltır
                        concreteVolume = grossVolume * 0.65;

                        // Ancak sık nervürler ve etriyeler toplam demiri plak döşemeye göre ~%15 artırır
                        ironDensityPerGrossVolume = 0.085 * 1.15;
                    } else if (slab.properties.type === 'mantar') {
                        // Zımbalama (punching) donatıları ve ilave pilyeler toplam demiri ~%25 artırır
                        ironDensityPerGrossVolume = 0.085 * 1.25;
                    }

                    stats.slab_concrete_volume += concreteVolume;
                    stats.slab_formwork_area += Math.max(0, area - totalColumnAreaOnFloor);

                    // 2. Demiri Doğrudan Brüt Hacim Üzerinden Çarp
                    totalSlabIronBase += grossVolume * ironDensityPerGrossVolume;
                });
                const dynamicMultiplier = ironCoeff / 0.125;
                stats.calc_iron_unit = (stats.column_concrete_volume * 0.140 * dynamicMultiplier) +
                    (stats.beam_concrete_volume * 0.130 * dynamicMultiplier) +
                    (totalSlabIronBase * dynamicMultiplier);
            } else {
                const refArea = stats.total_area > 0 ? stats.total_area : metrics.defaultFloorArea;
                const heightRatio = metrics.defaultFloorHeight / 3.0;

                let ironMult = 1.0;
                let formMult = 1.0;

                if (buildingStats.slabType === 'asmolen') {
                    ironMult = 1.10;     // Demir ~%10 artar
                    formMult = 0.90;     // Kiriş yanakları olmadığı için kalıp ~%10 azalır
                } else if (buildingStats.slabType === 'mantar') {
                    ironMult = 1.20;     // Zımbalama donatıları yüzünden demir ~%20 artar
                    formMult = 0.85;     // Dümdüz tavan olduğu için kalıp ~%15 azalır
                }

                // 1. Beton Hesabı (Kalınlık Bazlı)
                const baseConcrete = refArea * 0.35 * heightRatio;

                // Müşterinin girdiği döşeme kalınlığı üzerinden net döşeme hacmi (metre cinsinden)
                const thicknessM = (buildingStats.slabThickness || 15) / 100;
                let slabVol = refArea * thicknessM;

                // Asmolende döşeme içi boşluklu olduğundan brüt hacmin sadece %65'i betondur
                if (buildingStats.slabType === 'asmolen') {
                    slabVol *= 0.65;
                }

                stats.slab_concrete_volume = slabVol;
                stats.column_concrete_volume = baseConcrete * 0.20;

                // Mantar döşemede kiriş sarkmaları çok azdır/yoktur, oran küçültülür
                let beamVol = baseConcrete * 0.15;
                if (buildingStats.slabType === 'mantar') {
                    beamVol *= 0.2;
                }
                stats.beam_concrete_volume = beamVol;

                // 2. Kalıp Hesabı
                const baseForm = refArea * 2.8 * heightRatio;
                const totalForm = baseForm * formMult;
                stats.slab_formwork_area = totalForm * 0.5;
                stats.column_formwork_area = totalForm * 0.25;
                stats.beam_formwork_area = totalForm * 0.25;

                // 3. Demir Hesabı
                // Demir tonajı çarpanını "baz beton" üzerinden uyguluyoruz ki katlanarak şişmesin
                stats.calc_iron_unit = baseConcrete * ironCoeff * ironMult;
            }

            stats.calc_concrete_unit = stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume;
            stats.calc_formwork_unit = stats.column_formwork_area + stats.beam_formwork_area + stats.slab_formwork_area;
        }
    }

    private static applyFallbacks(stats: any, unit: UnitType, metrics: any, buildingStats: BuildingStats, settings: any) {
        // Eğer statik plan (kaba yapı) hesaplanıyorsa, ince işler sıfırlanır ve FALLBACK (Varsayılan Atama) ÇALIŞTIRILMAZ.
        if (settings.isStructural) {
            stats.cornice_length = 0; stats.wet_area = 0; stats.dry_area = 0; stats.radiator_length = 0; stats.kitchen_cabinet_length = 0;
            stats.calc_rough_plaster_area = 0; stats.calc_paint_wall_area = 0; stats.calc_ceiling_paint_area = 0; stats.calc_plaster_area = 0;

            // HATA BURADAYDI: Statik turda ince işler varsayımı yapmaması için fonksiyondan ÇIKIYORUZ.
            return;
        }

        // --- Aşağıdaki kısımlar SADECE Mimari Planlar (İnce İşler) için çalışır ---

        stats.calc_concrete_unit = 0; stats.calc_formwork_unit = 0; stats.calc_iron_unit = 0;

        // Eskiden burada Math.min vardı ve değerleri bozuyordu, Math.max olarak düzeltildi
        stats.adhesive_weight = Math.max(0, stats.adhesive_weight || 0);
        stats.mortar_volume = Math.max(0, stats.mortar_volume || 0);

        // Eğer mimari planda HİÇ ODA GİRİLMEMİŞSE (metraj sıfırsa), varsayılan daire kabulüyle metraj doldurulur.
        if (stats.calc_rough_plaster_area === 0) {
            let fallbackArea = metrics.defaultFloorArea;
            if (unit.count > 0) {
                let floorCount = unit.floorType === 'normal' ? Math.max(1, buildingStats.normalFloorCount) : unit.floorType === 'basement' ? Math.max(1, buildingStats.basementFloorCount) : 1;
                fallbackArea = metrics.defaultFloorArea / Math.max(1, unit.count / floorCount);
            }
            const fArea = stats.total_area > 0 ? stats.total_area : fallbackArea;

            stats.calc_rough_plaster_area = fArea * 2.8;
            stats.calc_paint_wall_area = fArea * 2.5;

            // YENİ MANTIK: Islak ve Kuru alan ayrımı
            const dryCeilingArea = fArea * 0.85; // %85 Kuru Hacim (Salon, Oda vb.)
            const wetCeilingArea = fArea * 0.15; // %15 Islak Hacim (Banyo, WC vb.)

            // Tavan boyası sadece kuru alanlara yapılır
            stats.calc_ceiling_paint_area = dryCeilingArea;

            // Islak hacimlere varsayılan olarak asma tavan eklenir
            stats.calc_suspended_ceiling_area = (stats.calc_suspended_ceiling_area || 0) + wetCeilingArea;

            // Alçı sıva = Duvarlar (2.5) + Sadece Asma Tavan OLMAYAN tavanlar (Kuru Alanlar)
            stats.calc_plaster_area = (fArea * 2.5) + dryCeilingArea;

            stats.cornice_length = estimatePerimeter(fArea) * 1.5;
            if (stats.wet_area === 0) { stats.wet_area = wetCeilingArea * 1.05; stats.net_wet_area = wetCeilingArea; }
            if (stats.dry_area === 0) stats.dry_area = dryCeilingArea * 1.05;
        }
    }
}


export const getFoundationMetrics = (buildingStats: BuildingStats) => {
    const area = buildingStats.basementFloorCount > 0
        ? buildingStats.basementFloorArea
        : buildingStats.groundFloorArea;

    const perimeter = buildingStats.basementFloorCount > 0
        ? (buildingStats.basementFloorPerimeter || estimatePerimeter(area))
        : (buildingStats.groundFloorPerimeter || estimatePerimeter(area));

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

    if (buildingStats.buildingType === 'villa') {
        materialHeatFactor *= 1.25;
    }

    const hLossFactor = (10 + (zone * 10)) * materialHeatFactor;

    // 1. Zemin Kat Hacmi
    const hG = buildingStats.groundFloorHeight || buildingStats.normalFloorHeight;
    const volG = buildingStats.groundFloorArea * (hG - 0.12);

    // 2. Normal Kat Hacmi
    const volN = buildingStats.normalFloorArea * (buildingStats.normalFloorHeight - 0.12) * buildingStats.normalFloorCount;

    // 3. YENİ: Bodrum Kat Hacmi
    const volB = buildingStats.basementFloorCount * buildingStats.basementFloorArea * Math.max(0, buildingStats.basementFloorHeight - 0.12);
    // 4. YENİ: Çatı Katı Hacmi
    let volR = 0;
    if (buildingStats.hasRoofFloor && (buildingStats.roofFloorArea || 0) > 0) {
        // Çatı katı için ortalama yükseklik kullanılır
        volR = (buildingStats.roofFloorArea || 0) * ((buildingStats.roofFloorHeight || 1.8) - 0.12);
    }

    // TÜM HACİMLERİ TOPLA VE NET KULLANIM ALANINA (%75) ÇEVİR
    const totalVolNet = (volG + volN + volB + volR) * 0.75;

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
                    let dynamicPrice = calculateDynamicUnitPrice(
                        item, stats.total_area > 0 ? stats.total_area : defaultFloorArea, projectTotalArea,
                        buildingStats.province, buildingStats.isUrbanTransformation, buildingStats, currentCosts, globalWallMaterial
                    );

                    // --- YENİ EKLENEN GÜVENLİK KONTROLÜ ---
                    if (item.inputType === 'manual_total') {
                        // Eğer paket/TL dönen bir kalemse, miktar 1'dir.
                        qty = 1;
                        if (item.auto_source.startsWith('calc_')) {
                            // Context eksikse 0 dönmemesi için boş mock data geçiyoruz veya doğrudan fiyatı pas geçiyoruz
                            // (Store zaten global hesabı yapıyor, burası sadece UI birim paneli için)
                            qty = 0; // Global kalemlerin birim maliyet özetinde şişme yapmaması için
                        }
                    } else {
                        // Orijinal Miktar Hesaplama mantığınız...
                        if (item.auto_source === 'calc_window_area') qty = stats.calc_window_area;
                        // ... diğer if-else mantıkları ...
                        else {
                            let sourceKey = item.auto_source;
                            if (sourceKey.startsWith('calc_') && stats[sourceKey] === undefined) {
                                sourceKey = sourceKey.replace('calc_', '') as any;
                            }
                            const rawVal = stats[sourceKey] || 0;
                            qty = parseFloat((rawVal * item.multiplier).toFixed(2));
                        }
                    }

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

    // O an HANGİ KAT hesaplanıyorsa onun kendi yüksekliğini bul
    let currentFloorHeight = buildingStats.normalFloorHeight;
    if (unit.floorType === 'ground') currentFloorHeight = buildingStats.groundFloorHeight;
    else if (unit.floorType === 'basement') currentFloorHeight = buildingStats.basementFloorHeight;
    else if (unit.floorType === 'roof') currentFloorHeight = buildingStats.roofFloorHeight || 1.8;

    // YENİ: Binanın TOPLAM yüksekliğini hesaplıyoruz (Devrilme Momenti için)
    const totalBuildingHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
        buildingStats.groundFloorHeight +
        (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) +
        (buildingStats.hasRoofFloor ? (buildingStats.roofFloorMaxHeight || 0) : 0);

    // Fonksiyona o katın kendi yüksekliğini ve TOPLAM BİNA YÜKSEKLİĞİNİ gönder
    const ironCoeff = getIronCoefficient(buildingStats.earthquakeZone, currentFloorArea, currentFloorHeight, totalBuildingHeight);
    const settings = { globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, isStructural, ironCoeff };

    // 1. Geometriyi Ayrıştır
    const rawMetrics = GeometryAnalyzer.extractRawMetrics(unit, buildingStats);

    const { stats, roomBreakdowns } = QuantityTakeoffService.calculateStats(rawMetrics, unit, buildingStats, settings);

    const pricingContext = {
        defaultFloorArea: rawMetrics.defaultFloorArea, projectTotalArea: rawMetrics.projectTotalArea,
        buildingStats, globalWallMaterial, useDetailedConcrete: globalConcreteMode === 'detailed'
    };

    const { quantities, totalCost } = PricingService.calculateCosts(stats, currentCosts, pricingContext);

    // BURA DEĞİŞTİ: roomBreakdowns'ı store'un kullanabilmesi için return ediyoruz
    return { quantities, totalCost, stats, roomBreakdowns };
};
// ============================================================================
const needsTowerCrane = (totalArea: number, groundArea: number, floors: number) => {
    return totalArea > 5000 || (groundArea > 650 && floors > 6);
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
    costBreakdowns?: Record<string, { label: string; value: number }[]>;
    units?: UnitType[];
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

    'calc_indoor_parking_screed': ({ buildingStats, aggregatedUnitStats }) => {
        const parkingArea = buildingStats.indoorParkingArea || 0;
        const shelterExtraScreed = aggregatedUnitStats['calc_indoor_parking_screed'] || 0;
        return parkingArea + shelterExtraScreed;
    },

    'calc_parking_ceiling_insulation': ({ buildingStats }) => {
        // Sadece otopark alanını döndür, sığınak alanını dahil etme
        return buildingStats.indoorParkingArea || 0;
    },

    'calc_parking_ventilation': ({ buildingStats, currentCosts, item, costBreakdowns }) => {
        if (!buildingStats.indoorParkingArea || buildingStats.indoorParkingArea <= 0) return 0;

        const area = buildingStats.indoorParkingArea;

        const sprinklerPrice = getGlobalPrice(currentCosts, "Otopark Sprinkler Altyapısı (m²)");
        const jetFanPrice = getGlobalPrice(currentCosts, "Otopark Jet Fan Cihazı (Adet)");
        const centralVentPrice = getGlobalPrice(currentCosts, "Egzost/Taze Hava Santrali ve Otomasyon (Paket)");

        const sprinklerTotal = area * sprinklerPrice;
        const jetFanCount = area >= 2000 ? Math.ceil(area / 500) : 0;
        const jetFanTotal = jetFanCount * jetFanPrice;

        let ventScale = 1.0;
        if (area > 500) ventScale = 1.0 + ((area - 500) / 500) * 0.50;
        const ventTotal = centralVentPrice * ventScale;

        // ---> YENİ EKLENEN KIRILIM KISMI <---
        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `${area} m² Sulu Söndürme (Sprinkler)`, value: sprinklerTotal },
                ...(jetFanCount > 0 ? [{ label: `${jetFanCount} Adet Jet Fan Cihazı`, value: jetFanTotal }] : []),
                { label: `Egzost ve Taze Hava Santrali Otomasyonu`, value: ventTotal }
            ];
        }

        return Math.round(sprinklerTotal + jetFanTotal + ventTotal);
    },

    'calc_shelter_package': ({ buildingStats, currentCosts, item, costBreakdowns }) => {
        if (!buildingStats.shelterArea || buildingStats.shelterArea <= 0) return 0;

        const area = buildingStats.shelterArea;

        const doorPrice = getGlobalPrice(currentCosts, "Sığınak Kapısı (Adet)");
        const ventPrice = getGlobalPrice(currentCosts, "Sığınak Havalandırma Santrali (Adet)");

        const doorCount = Math.ceil(area / 100);
        const ventCount = Math.ceil(area / 50);

        const totalDoor = doorCount * doorPrice;
        const totalVent = ventCount * ventPrice;

        // ---> YENİ EKLENEN KIRILIM KISMI <---
        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `${doorCount} Adet Çelik Sığınak Kapısı`, value: totalDoor },
                { label: `${ventCount} Adet Karbon Filtreli Sığınak Santrali`, value: totalVent }
            ];
        }

        return totalDoor + totalVent;
    },

    'calc_satellite_system': ({ aggregatedUnitStats, totalConstructionArea, item }) => {
        const totalApartments = getEstimatedUnitCount(aggregatedUnitStats, totalConstructionArea);
        return item.unit_price * Math.max(1, totalApartments / 10);
    },

    'calc_inspection': ({ aggregatedUnitStats, totalConstructionArea, totalFloors, regulationHeight, currentCosts, constructionDuration, buildingStats }) => {

        // 200m2 altı müstakil (villa) yapılar Yapı Denetim'den muaftır (TUS / Fenni Mesuliyet'e tabidir)
        const isDetached = buildingStats.buildingType === 'villa';
        // BuildingStats'ta zemin kat her zaman 1 adet kabul edildiği için +1 eklenmiştir
        const activeFloors = buildingStats.normalFloorCount + 1; // Bodrum hariç kat sayısı

        if (isDetached && totalConstructionArea <= 200 && activeFloors <= 2) {
            return 0; // Fenni Mesuliyet (TUS) bedeli ayrı bir kalem olarak açılabilir.
        }

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

    'calc_tapu_noter': ({ aggregatedUnitStats, totalConstructionArea, buildingStats, currentCosts, totalFloors, regulationHeight, item, costBreakdowns }) => {
        const totalUnits = getEstimatedUnitCount(aggregatedUnitStats, totalConstructionArea);

        const buildingClass = determineBuildingClass(totalConstructionArea, totalFloors, regulationHeight, totalUnits);
        const currentM2Price = getGlobalPrice(currentCosts, buildingClass);

        const estimatedTotalCost = totalConstructionArea * currentM2Price;

        return calculateTapuNoterFees(
            totalUnits,
            buildingStats.province,
            buildingStats.constructionModel,
            buildingStats.isUrbanTransformation,
            estimatedTotalCost,
            currentCosts,
            costBreakdowns, // YENİ: Kırılım objesini pasla
            item.name       // YENİ: Kalem adını pasla
        );
    },

    'calc_acoustic': ({ totalConstructionArea, item }) => {
        const minQty = 444.44 / (item.unit_price || 3);
        return Math.max(totalConstructionArea, minQty);
    },

    'calc_gas_infrastructure': ({ aggregatedUnitStats, buildingStats, currentCosts, item, costBreakdowns, units }) => {
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

        // --- YATAY BORU HESABI (GERÇEK DAİRE YERLEŞİMİNE GÖRE) ---
        let totalHorizontalMetres = 0;

        if (buildingStats.buildingType !== 'villa') {
            const normalHallLen = (buildingStats.normalFloorHallArea || 10) / 1.5;
            const groundHallLen = (buildingStats.groundFloorHallArea || 10) / 1.5;
            const basementHallLen = (buildingStats.basementFloorHallArea || 10) / 1.5;

            // Kullanıcı birim (daire) eklemişse tam sayıları bul
            if (units && units.length > 0) {
                const unitCountsByFloor: Record<string, number> = { normal: 0, ground: 0, basement: 0, roof: 0 };
                units.forEach(u => { unitCountsByFloor[u.floorType] += u.count; });

                // Normal ve Bodrum katlar birden fazla olabileceği için kat başına düşen daireyi buluyoruz
                const unitsPerNormalFloor = buildingStats.normalFloorCount > 0 ? unitCountsByFloor.normal / buildingStats.normalFloorCount : 0;
                const unitsPerBasementFloor = buildingStats.basementFloorCount > 0 ? unitCountsByFloor.basement / buildingStats.basementFloorCount : 0;

                // Yatay boru = O kattaki daire sayısı x (Hol Uzunluğu / 2) -> Kapı önü mesafesi
                totalHorizontalMetres += buildingStats.normalFloorCount * (unitsPerNormalFloor * (normalHallLen / 2));
                totalHorizontalMetres += unitCountsByFloor.ground * (groundHallLen / 2);
                totalHorizontalMetres += buildingStats.basementFloorCount * (unitsPerBasementFloor * (basementHallLen / 2));
            } else {
                // Fallback: Daire girilmediyse sadece zemin ve normal katlara dağıt
                const totalHabitableFloors = buildingStats.normalFloorCount + 1;
                const unitsPerFloor = totalHabitableFloors > 0 ? totalApartments / totalHabitableFloors : 0;
                totalHorizontalMetres =
                    (buildingStats.normalFloorCount * unitsPerFloor * (normalHallLen / 2)) +
                    (1 * unitsPerFloor * (groundHallLen / 2));
            }
        }

        const costVertical = totalVerticalMetres * verticalPipePrice;
        const costHorizontal = totalHorizontalMetres * horizontalPipePrice;
        const costSets = totalApartments * connectionSetPrice;

        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `${totalVerticalMetres.toFixed(1)} mt Dikey Kolon Hattı`, value: costVertical },
                { label: `${totalHorizontalMetres.toFixed(1)} mt Yatay Dağıtım Hattı`, value: costHorizontal },
                { label: `${totalApartments} Daire Gaz Bağlantı Seti`, value: costSets }
            ];
        }

        return costVertical + costHorizontal + costSets;
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

    'calc_garage_door': ({ buildingStats, currentCosts, item }) => {
        if (buildingStats.indoorParkingArea && buildingStats.indoorParkingArea > 0) {
            return getGlobalPrice(currentCosts, item.name); // Manuel total olduğu için fiyat döner
        }
        return 0;
    },

    'calc_garage_drainage': ({ buildingStats, currentCosts, item, costBreakdowns }) => {
        if (!buildingStats.indoorParkingArea || buildingStats.indoorParkingArea <= 0) return 0;

        const area = buildingStats.indoorParkingArea;

        const channelPrice = getGlobalPrice(currentCosts, "Otopark Drenaj Kanalı (mt)");
        const separatorPrice = getGlobalPrice(currentCosts, "Yağ Ayırıcı Ünite (Adet)");
        const pumpPrice = getGlobalPrice(currentCosts, "Atıksu Dalgıç Pompa Sistemi (Set)");

        const perimeter = buildingStats.indoorParkingPerimeter || estimatePerimeter(area);
        const channelLength = Math.ceil(perimeter * 0.40);
        const channelTotal = channelLength * channelPrice;

        const separatorCount = Math.ceil(area / 1000);
        const separatorTotal = separatorCount * separatorPrice;
        const pumpTotal = pumpPrice; // Standart 1 Set

        // ---> YENİ EKLENEN KIRILIM KISMI <---
        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `${channelLength} mt Izgaralı Drenaj Kanalı`, value: channelTotal },
                { label: `${separatorCount} Adet Yağ Tutucu Ayırıcı Ünite`, value: separatorTotal },
                { label: `1 Set Atıksu Dalgıç Pompa Sistemi`, value: pumpTotal }
            ];
        }

        return Math.round(channelTotal + separatorTotal + pumpTotal);
    },

    'calc_shelter_plumbing': ({ buildingStats, currentCosts, item }) => {
        if (buildingStats.shelterArea && buildingStats.shelterArea > 0) {
            return getGlobalPrice(currentCosts, item.name);
        }
        return 0;
    },

    'calc_co_sensors': ({ buildingStats, currentCosts, item }) => {
        // Jet fan varsa CO sensörü de zorunludur.
        if (buildingStats.indoorParkingArea && buildingStats.indoorParkingArea > 0) {
            // Alanın büyüklüğüne göre sensör maliyetini artırabiliriz
            const multiplier = Math.max(1, Math.ceil(buildingStats.indoorParkingArea / 500));
            return getGlobalPrice(currentCosts, item.name) * multiplier;
        }
        return 0;
    },

    'calc_fence': ({ buildingStats }) => {
        // Hem Villa hem de Apartman için öncelikli olarak Arsa Alanı (landArea) baz alınır.
        // Arsayı kare kabul ederek çevresini (Karekök x 4) buluyoruz.
        if (buildingStats.landArea > 0) {
            return estimatePerimeter(buildingStats.landArea);
        }

        // Eğer kullanıcı arsa alanını 0 girmişse (yedek senaryo), 
        // bina oturum alanının etrafına biraz pay bırakarak hesapla.
        const side = Math.sqrt(buildingStats.groundFloorArea || 0);
        return ((side + 8) * 2) + ((side + 6) * 2);
    },

    'calc_terrace_waterproofing': ({ buildingStats, totalConstructionArea, aggregatedUnitStats }) => {
        let totalTerraceAndBalcony = 0;

        // 1. Dairelerden gelen gerçek balkon yalıtım metrajı (Odalar panelinden)
        if (aggregatedUnitStats && aggregatedUnitStats['balcony_waterproofing_area'] > 0) {
            totalTerraceAndBalcony += aggregatedUnitStats['balcony_waterproofing_area'];
        }

        // 2. Yapı Genel Bilgilerinden girilen Açık Teras alanı (Villa veya Apartman fark etmeksizin)
        if (buildingStats.roofTerraceArea && buildingStats.roofTerraceArea > 0) {
            const terraceArea = buildingStats.roofTerraceArea;
            // Terasın çevresini tahmini olarak buluyoruz
            const terracePerimeter = estimatePerimeter(terraceArea);

            // Teras alanı + (Çevre x 30 cm Parapet Dönüşü)
            totalTerraceAndBalcony += terraceArea + (terracePerimeter * 0.30);
        }

        // 3. FALLBACK (Yedek Güvenlik): Eğer kullanıcı hiç balkon tanımlamamışsa ve teras girmemişse,
        // projenin balkonsuz kalmaması için eski tahmini formülü (%15) kullanalım.
        if (totalTerraceAndBalcony === 0) {
            totalTerraceAndBalcony = totalConstructionArea * 0.15;
        }

        return totalTerraceAndBalcony;
    },

    'calc_soil_investigation': ({ buildingStats, currentCosts, item, costBreakdowns }) => {
        const subPrices = {
            sondaj_mt: getGlobalPrice(currentCosts, "Zemin Sondaj Birim Fiyatı"),
            spt_adet: getGlobalPrice(currentCosts, "SPT Deneyi Birim Fiyatı"),
            presiyometre_adet: getGlobalPrice(currentCosts, "Presiyometre Deneyi Birim Fiyatı"),
            laboratuvar_paket: getGlobalPrice(currentCosts, "Zemin Laboratuvar Paketi")
        };

        const groundArea = buildingStats.groundFloorArea || 0;

        // 1. TBDY 2018 Min. Kuyu Sayısı: 300m²'ye kadar 3 kuyu, sonrası her 300m²'ye +1
        const boreholeCount = 3 + Math.floor(Math.max(0, groundArea - 300) / 300);

        // 2. En Tasarruflu Sondaj Derinliği: Kuyu başı 10 metre
        const minDepthPerBorehole = 10;
        const totalMeters = boreholeCount * minDepthPerBorehole;

        // 3. Yönetmelik Alt Sınırı Deney Sayıları
        const sptCount = Math.floor(totalMeters / 3.0); // En seyrek (3 metrede 1) SPT
        const pressuremeterCount = boreholeCount; // Kuyu başı sadece 1 Presiyometre
        const labTestPackageCount = 1; // Proje geneli tek Laboratuvar Raporu

        // 4. Alt maliyetleri hesapla
        const costSondaj = totalMeters * subPrices.sondaj_mt;
        const costSpt = sptCount * subPrices.spt_adet;
        const costPresiyo = pressuremeterCount * subPrices.presiyometre_adet;
        const costLab = labTestPackageCount * subPrices.laboratuvar_paket;

        const totalCost = costSondaj + costSpt + costPresiyo + costLab;

        // 5. Kırılımları arayüzde (Tooltip/Akordiyon) göstermek için havuza kaydet
        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `${boreholeCount} Kuyu x ${minDepthPerBorehole} mt Sondaj`, value: costSondaj },
                { label: `${sptCount} Adet SPT Deneyi`, value: costSpt },
                { label: `${pressuremeterCount} Adet Presiyometre`, value: costPresiyo },
                { label: `1 Set Laboratuvar Raporu`, value: costLab }
            ];
        }

        return Math.round(totalCost);
    },

    'calc_concrete_global': ({ buildingStats, totalFloors, aggregatedUnitStats, totalConstructionArea, item }) => {
        const { area, perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = buildingStats.hasWellFoundation ? 0 : Math.min(raftHeight * 1.5, 1.00);
        const vTemel = (area + (ampatman * perimeter) + (4 * Math.pow(ampatman, 2))) * raftHeight;

        let vBodrumPerde = 0;
        if (buildingStats.basementFloorCount > 0) {
            // Sabit +1 yerine %2 köşe/bindirme payı eklendi
            vBodrumPerde = (perimeter * 1.02) * (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) * 0.3;
        } else if (buildingStats.subasmanHeight && buildingStats.subasmanHeight > 0) {
            vBodrumPerde = perimeter * buildingStats.subasmanHeight * 0.25;
        }
        const vKatlar = aggregatedUnitStats['calc_concrete_unit'] !== undefined ? aggregatedUnitStats['calc_concrete_unit'] : (totalConstructionArea * 0.35);

        let totalConcrete = vTemel + vBodrumPerde + vKatlar;

        // MÜHENDİSLİK DÜZELTMESİ: Bodrumsuz binalarda subasman üstü hasırlı zemin betonu (10 cm)
        // Grobeton'dan çıkarılıp, ait olduğu Betonarme Betonu (C30 vb.) kalemine taşındı.
        if (buildingStats.basementFloorCount === 0) {
            totalConcrete += (buildingStats.groundFloorArea || 0) * 0.10;
        }

        return totalConcrete * 1.03 * (item.multiplier || 1);
    },

    'calc_pool_concrete': ({ buildingStats, currentCosts, item, costBreakdowns }) => {
        const poolArea = buildingStats.poolArea || 0;
        if (poolArea <= 0) return 0;

        const p_excavation = getGlobalPrice(currentCosts, "Hafriyat (Kazı ve Döküm)");
        const p_concrete = getGlobalPrice(currentCosts, "Betonarme Betonu");
        const p_iron = getGlobalPrice(currentCosts, "İnşaat Demiri");
        const p_formwork = getGlobalPrice(currentCosts, "Kalıp İşçiliği & Malzeme");
        const p_insulation = getGlobalPrice(currentCosts, "Temel Su Yalıtımı (Bohçalama)");
        const p_ceramic = getGlobalPrice(currentCosts, "Seramik Kaplama");
        const p_ceramic_adhesive = getGlobalPrice(currentCosts, "Seramik Yapıştırıcısı");
        const p_joint_filler = getGlobalPrice(currentCosts, "Seramik Derz Dolgusu");

        const depth = 1.5;
        const perimeter = estimatePerimeter(poolArea);
        const wallArea = perimeter * depth;
        const innerSurfaceArea = poolArea + wallArea;

        const excavationVol = (poolArea + perimeter * 0.5) * (depth + 0.3);
        const concreteVol = (poolArea * 0.20) + (wallArea * 0.20);
        const ironTon = concreteVol * 0.120;
        const formworkArea = wallArea * 2;

        const costExcavation = excavationVol * p_excavation;
        const costConcrete = concreteVol * p_concrete;
        const costIron = ironTon * p_iron;
        const costFormwork = formworkArea * p_formwork;
        const costInsulation = innerSurfaceArea * p_insulation * 1.5;
        const costCeramic = innerSurfaceArea * p_ceramic;
        const costAdhesive = innerSurfaceArea * 5 * p_ceramic_adhesive;
        const costFiller = innerSurfaceArea * 0.5 * p_joint_filler;

        const totalPoolMaterialCost = costExcavation + costConcrete + costIron + costFormwork + costInsulation + costCeramic + costAdhesive + costFiller;

        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `${excavationVol.toFixed(1)} m³ Hafriyat`, value: Math.round(costExcavation * 1.10) },
                { label: `${concreteVol.toFixed(1)} m³ Betonarme`, value: Math.round(costConcrete * 1.10) },
                { label: `${ironTon.toFixed(2)} Ton Demir`, value: Math.round(costIron * 1.10) },
                { label: `${formworkArea.toFixed(1)} m² Kalıp`, value: Math.round(costFormwork * 1.10) },
                { label: `${innerSurfaceArea.toFixed(1)} m² Yalıtım`, value: Math.round(costInsulation * 1.10) },
                { label: `${innerSurfaceArea.toFixed(1)} m² Seramik ve Harç`, value: Math.round((costCeramic + costAdhesive + costFiller) * 1.10) }
            ];
        }

        return Math.round(totalPoolMaterialCost * 1.10);
    },
    'calc_pool_system': ({ buildingStats, item, currentCosts }) => { // currentCosts eklendi
        const poolArea = buildingStats.poolArea || 0;
        if (poolArea <= 0) return 0;

        const baseArea = 40;
        const areaFactor = Math.max(0.6, poolArea / baseArea);

        // ESKİ HALİ: return Math.round((item.unit_price || 150000) * areaFactor);
        // YENİ HALİ:
        const basePrice = getGlobalPrice(currentCosts, item.name);
        return Math.round(basePrice * areaFactor);
    },

    'calc_villa_parking': ({ buildingStats }) => buildingStats.parkingArea || 0,

    'calc_villa_veranda': ({ buildingStats }) => buildingStats.verandaArea || 0,

    'calc_haritaci': ({ item, buildingStats, currentCosts, costBreakdowns }) => {
        const baseP = getGlobalPrice(currentCosts, item.name);
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

        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `Aplikasyon Krokisi`, value: aplikasyonBedeli },
                { label: `Röperli Kroki`, value: roperliFarki },
                { label: `Plan Örneği Bedeli`, value: planOrnegiBedeli }
            ];
        }

        return aplikasyonBedeli + roperliFarki + planOrnegiBedeli;
    },

    'calc_grobeton': ({ buildingStats, totalFloors }) => {
        const { area, perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = buildingStats.hasWellFoundation ? 0 : Math.min(raftHeight * 1.5, 1.00);

        // Sadece Temel Altı Grobetonu (10 cm) hesaplanır
        let totalGrobeton = (area + (ampatman * perimeter) + (4 * Math.pow(ampatman, 2))) * 0.10;

        return totalGrobeton;
    },



    'calc_foundation_xps': ({ buildingStats, totalFloors }) => {
        const { perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = buildingStats.hasWellFoundation ? 0 : Math.min(raftHeight * 1.5, 1.00);
        let xpsArea = (perimeter + (8 * ampatman)) * raftHeight;
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
            if (buildingStats.buildingType === 'villa') {
                return 1; // Villalarda 1 adet yeterlidir.
            } else {
                // Apartman/Site: VRF gruplama mantığı. 
                // Ortalama her 4-5 dairenin (veya 8-16 iç ünitenin) kapasitesini 1 büyük dış ünite grubu karşılar.
                const totalUnits = aggregatedUnitStats['calc_unit_count'] || 1;
                return Math.max(1, Math.ceil(totalUnits / 4.0)); // Her 4 daireye 1 dış ünite grubu atar
            }
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

    'calc_ekb': ({ item, totalConstructionArea, aggregatedUnitStats, currentCosts }) => {
        const wixPrice = getGlobalPrice(currentCosts, item.name);
        const F = wixPrice / 1500; // Not: Buradaki 1500 formülün oran katsayısıdır, bu sabit kalmalıdır.
        const A = totalConstructionArea;

        let totalUnits = aggregatedUnitStats['calc_unit_count'] || 0;
        if (totalUnits === 0) totalUnits = Math.ceil(totalConstructionArea / 100);

        let costByArea = 0;
        if (A <= 600) costByArea = 1500;
        else if (A <= 1250) costByArea = 1500 + (A - 600) * 1.154;
        else if (A <= 2500) costByArea = 2250 + (A - 1250) * 1.048;
        else if (A <= 5000) costByArea = 3560 + (A - 2500) * 0.826;
        else if (A <= 10000) costByArea = 5625 + (A - 5000) * 0.57; // DÜZELTİLDİ
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

    'calc_utilities_subscription': ({ currentCosts, totalConstructionArea, buildingStats, item, costBreakdowns }) => {
        const unitGuvenlikBedeli = getGlobalPrice(currentCosts, "Elektrik Güvence Birim Bedeli");
        const waterAndOtherFees = getGlobalPrice(currentCosts, "Su Abonelik Paket Bedeli");

        let estimatedPowerKW = 0;

        if (buildingStats.buildingType === 'villa') {
            estimatedPowerKW = Math.max(15, (totalConstructionArea / 100) * 8);
            if (buildingStats.poolArea && buildingStats.poolArea > 0) estimatedPowerKW += 5;
            if (buildingStats.heatingSystem === 'heat_pump' || buildingStats.heatingSystem === 'vrf') estimatedPowerKW += 10;
        } else {
            estimatedPowerKW = Math.max(10, (totalConstructionArea / 1000) * 12.5);
        }

        const electricityGuvence = estimatedPowerKW * unitGuvenlikBedeli;
        const totalSubscription = electricityGuvence + waterAndOtherFees;
        const dynamicMinLimit = waterAndOtherFees * 3;

        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `Elektrik Güvence Bedeli (~${estimatedPowerKW.toFixed(0)} kW)`, value: electricityGuvence },
                { label: `Şantiye Su Aboneliği ve Ücretler`, value: Math.max(waterAndOtherFees, dynamicMinLimit - electricityGuvence) }
            ];
        }

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

    'calc_fire_escape': ({ currentCosts, regulationHeight, buildingStats, item, costBreakdowns }) => {
        if (regulationHeight <= 21.50) return 0;

        const ironPricePerTon = getGlobalPrice(currentCosts, "İnşaat Demiri");
        const fireDoorPrice = getGlobalPrice(currentCosts, "Yangın Kapısı (Adet)");

        const steelWeightPerFloor = 1.5;
        const workmanshipFactor = 1.45;
        const totalFloorsForEscape = buildingStats.normalFloorCount + 1;

        const totalSteelCost = (ironPricePerTon * steelWeightPerFloor * workmanshipFactor) * totalFloorsForEscape;
        const totalDoorCost = fireDoorPrice * totalFloorsForEscape;

        let totalEscapeCost = totalSteelCost + totalDoorCost;
        let heightMultiplier = 1.0;

        if (regulationHeight > 30.50) {
            heightMultiplier = 1.25;
            totalEscapeCost *= heightMultiplier;
        }

        // ---> YENİ EKLENEN KIRILIM KISMI <---
        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `${totalFloorsForEscape} Katlık Çelik Konstrüksiyon ve İşçilik`, value: Math.round(totalSteelCost * heightMultiplier) },
                { label: `${totalFloorsForEscape} Adet Yangın Kapısı`, value: Math.round(totalDoorCost * heightMultiplier) }
            ];
        }

        return Math.round(totalEscapeCost);
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
        let classUnitPrice = getGlobalPrice(currentCosts, buildingClass);
        return Math.round(totalConstructionArea * classUnitPrice * 0.002);
    },

    'calc_sgk_premium': ({ buildingStats, aggregatedUnitStats, totalConstructionArea, totalFloors, regulationHeight, currentCosts, item, costBreakdowns }) => {
        const totalUnits = buildingStats.buildingType === 'villa' ? 1 : getEstimatedUnitCount(aggregatedUnitStats, totalConstructionArea);
        const buildingClass = determineBuildingClass(totalConstructionArea, totalFloors, regulationHeight, totalUnits);
        let classUnitPrice = getGlobalPrice(currentCosts, buildingClass);
        const totalEstimatedCost = totalConstructionArea * classUnitPrice;

        const laborBase = totalEstimatedCost * 0.0675;
        const premium = Math.round(laborBase * 0.375);

        // ---> YENİ EKLENEN KIRILIM KISMI <---
        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `Bakanlık Asgari İşçilik Matrahı (%6.75)`, value: Math.round(laborBase) },
                { label: `Ödenecek Net Prim Tutarı (%37.5)`, value: premium }
            ];
        }

        return premium;
    },

    'calc_demolition_area': ({ buildingStats, totalConstructionArea, item }) => {
        if (buildingStats.hasExistingBuilding && !buildingStats.isUrbanTransformation) {
            const existingArea = buildingStats.existingArea || (totalConstructionArea * 0.5);
            return existingArea * item.unit_price;
        }
        return 0;
    },

    'calc_cctv_system': ({ aggregatedUnitStats, buildingStats, currentCosts, item }) => {
        let totalUnits = aggregatedUnitStats['calc_unit_count'] || 0;
        if (buildingStats.buildingType === 'villa' || totalUnits > 10) {
            // Eğer şartlar sağlanıyorsa, sistemdeki paket fiyatını çek ve doğrudan TL olarak döndür
            return getGlobalPrice(currentCosts, item.name);
        }
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
        const avgArea = totalConstructionArea / Math.max(1, totalFloors);

        // Binanın TOPLAM yüksekliğini hesapla
        const totalBuildingHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
            buildingStats.groundFloorHeight +
            (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) +
            (buildingStats.hasRoofFloor ? (buildingStats.roofFloorMaxHeight || 0) : 0);

        // Her kat tipi için KENDİ yüksekliğine ve TOPLAM BİNA YÜKSEKLİĞİNE göre katsayıları al
        const coeffGround = getIronCoefficient(buildingStats.earthquakeZone, avgArea, buildingStats.groundFloorHeight, totalBuildingHeight);
        const coeffNormal = getIronCoefficient(buildingStats.earthquakeZone, avgArea, buildingStats.normalFloorHeight, totalBuildingHeight);
        const coeffBasement = getIronCoefficient(buildingStats.earthquakeZone, avgArea, buildingStats.basementFloorHeight, totalBuildingHeight);
        const ironCoeff = getIronCoefficient(buildingStats.earthquakeZone, avgArea, 3.0, totalBuildingHeight); let ironKatlar = aggregatedUnitStats['calc_iron_unit'];

        // Detaylı çizim yoksa (otomatik moddaysa) katları ayrı ayrı kendi katsayılarıyla topla
        if (ironKatlar === undefined) {
            const ironGround = (buildingStats.groundFloorArea * 0.35) * coeffGround;
            const ironNormal = (buildingStats.normalFloorArea * buildingStats.normalFloorCount * 0.35) * coeffNormal;
            const ironBasement = (buildingStats.basementFloorArea * buildingStats.basementFloorCount * 0.35) * coeffBasement;

            ironKatlar = ironGround + ironNormal + ironBasement;
        }

        const { area, perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = buildingStats.hasWellFoundation ? 0 : Math.min(raftHeight * 1.5, 1.00);
        const vTemel = (area + (ampatman * perimeter) + (4 * Math.pow(ampatman, 2))) * raftHeight;

        let vBodrumPerde = 0;
        if (buildingStats.basementFloorCount > 0) {
            // Sabit +1 yerine %2 köşe/bindirme payı eklendi
            vBodrumPerde = (perimeter * 1.02) * (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) * 0.3;
        } else if (buildingStats.subasmanHeight && buildingStats.subasmanHeight > 0) {
            vBodrumPerde = perimeter * buildingStats.subasmanHeight * 0.25;
        }

        let totalIron = ironKatlar + (vTemel * (ironCoeff * 1.15)) + (vBodrumPerde * (ironCoeff * 1.10));

        // YENİ: Bodrumsuz binalarda zemin taban betonu içine Çelik Hasır ilavesi (Ort. 4 kg/m² = 0.004 ton)
        if (buildingStats.basementFloorCount === 0) {
            totalIron += (buildingStats.groundFloorArea || 0) * 0.004;
        }

        return totalIron * 1.04 * (item.multiplier || 1);
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


    'calc_smart_home': ({ buildingStats, totalConstructionArea, aggregatedUnitStats, item, currentCosts, costBreakdowns }) => {
        if (buildingStats.buildingType !== 'villa' || !buildingStats.hasSmartHome) return 0;

        const originalBaseCost = getGlobalPrice(currentCosts, item.name);
        let totalCost = originalBaseCost;

        let estimatedZones = Math.max(1, Math.ceil(totalConstructionArea / 25));
        if (aggregatedUnitStats && aggregatedUnitStats['calc_inner_door'] > 0) {
            estimatedZones = aggregatedUnitStats['calc_inner_door'] + 1;
        }

        let costLighting = 0, costHeating = 0, costSensors = 0, costBlinds = 0;

        if (buildingStats.smartHomeLighting) { costLighting = (estimatedZones * (originalBaseCost * 0.07)); totalCost += costLighting; }
        if (buildingStats.smartHomeHeating) { costHeating = (estimatedZones * (originalBaseCost * 0.08)); totalCost += costHeating; }
        if (buildingStats.smartHomeSensors) {
            let wetAreaZones = 2;
            if (aggregatedUnitStats && (aggregatedUnitStats['calc_toilet'] > 0 || aggregatedUnitStats['calc_kitchen_sink'] > 0)) {
                wetAreaZones = (aggregatedUnitStats['calc_toilet'] || 1) + (aggregatedUnitStats['calc_kitchen_sink'] || 1);
            }
            const floors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;
            costSensors = (wetAreaZones * (originalBaseCost * 0.04)) + (1 * (originalBaseCost * 0.05)) + (floors * (originalBaseCost * 0.02)) + (originalBaseCost * 0.12);
            totalCost += costSensors;
        }
        if (buildingStats.smartHomeBlinds) {
            let windowCount = estimatedZones;
            if (aggregatedUnitStats && aggregatedUnitStats['calc_window_area'] > 0) {
                windowCount = Math.max(estimatedZones, Math.ceil(aggregatedUnitStats['calc_window_area'] / 2.5));
            }
            costBlinds = (windowCount * (originalBaseCost * 0.05)); totalCost += costBlinds;
        }

        let areaMultiplier = 1.0;
        if (totalConstructionArea > 200) areaMultiplier = 1.0 + ((totalConstructionArea - 200) * 0.003);

        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `Ana Panel ve Altyapı`, value: originalBaseCost * areaMultiplier },
                ...(costLighting > 0 ? [{ label: `Aydınlatma (${estimatedZones} Zon)`, value: costLighting * areaMultiplier }] : []),
                ...(costHeating > 0 ? [{ label: `Isıtma Otomasyonu (${estimatedZones} Zon)`, value: costHeating * areaMultiplier }] : []),
                ...(costSensors > 0 ? [{ label: `Sensörler (Su, Gaz, Hareket)`, value: costSensors * areaMultiplier }] : []),
                ...(costBlinds > 0 ? [{ label: `Panjur/Perde Kontrolü`, value: costBlinds * areaMultiplier }] : [])
            ];
        }

        return Math.round(totalCost * areaMultiplier);
    },

    'calc_main_electrical_panel': ({ aggregatedUnitStats, buildingStats, currentCosts, item, costBreakdowns }) => {
        const totalUnits = buildingStats.buildingType === 'villa' ? 1 : (aggregatedUnitStats['calc_unit_count'] || 1);
        const basePrice = getGlobalPrice(currentCosts, "Ana Dağıtım ve Sayaç Panoları");
        
        // Pano maliyeti daire sayısına göre artar. Her daire için ortalama %10 pano büyümesi/şalt malzeme eklenir.
        const totalCost = basePrice + (totalUnits * (basePrice * 0.10)); 

        if (costBreakdowns) {
            costBreakdowns[item.name] = [
                { label: `Bina Ana Dağıtım Panosu (AG)`, value: basePrice },
                { label: `${totalUnits} Dairelik Sayaç Panosu ve Şalt Malzemeleri`, value: totalUnits * (basePrice * 0.10) }
            ];
        }

        return Math.round(totalCost);
    },

    'calc_main_electrical_cable_length': ({ buildingStats, aggregatedUnitStats }) => {
        const totalUnits = buildingStats.buildingType === 'villa' ? 1 : (aggregatedUnitStats['calc_unit_count'] || 1);
        let totalCableLength = 0;
        
        if (buildingStats.buildingType === 'villa') {
            const landSide = Math.sqrt(buildingStats.landArea || 0);
            // Villalarda ana panodan (örneğin bahçe duvarı sınırından) eve geliş mesafesi
            totalCableLength = Math.max(15, landSide + 5);
        } else {
             // Apartmanlarda her daire için zemin kattaki sayaç panosundan daireye kadar çekilen kablo
             const floorHeight = buildingStats.normalFloorHeight || 3.0;
             let sumVertical = 0;
             let unitsPerFloor = buildingStats.normalFloorCount > 0 ? (totalUnits / buildingStats.normalFloorCount) : totalUnits;
             
             // Kat yükseldikçe kablo uzar (1. kat için 1h, 2. kat için 2h ...)
             for(let i = 1; i <= buildingStats.normalFloorCount; i++) {
                 sumVertical += (unitsPerFloor * (i * floorHeight));
             }
             
             // Yatayda her daire için ortalama 12 metre pay (sayaçtan şafta ve şafttan daire sigorta kutusuna)
             const sumHorizontal = totalUnits * 12; 
             
             totalCableLength = sumVertical + sumHorizontal;
        }
        return totalCableLength;
    },

    'calc_excavation': ({ buildingStats, item }) => {
        const excavationBaseArea = buildingStats.basementFloorCount > 0
            ? buildingStats.basementFloorArea
            : buildingStats.groundFloorArea;

        const basePerim = buildingStats.basementFloorCount > 0
            ? (buildingStats.basementFloorPerimeter || estimatePerimeter(excavationBaseArea))
            : (buildingStats.groundFloorPerimeter || estimatePerimeter(excavationBaseArea));

        const totalFloorsForExc = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;
        const raftHeightExc = calculateEstimatedRaftHeight(totalFloorsForExc);

        // Hafriyat Derinliği = Bodrumlar + Radye Temel Kalınlığı + 40 cm Grobeton/Yalıtım ve Çalışma Payı
        const excavationDepth = (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) + raftHeightExc + 0.40;

        const getExtendedArea = (baseArea: number, basePerimeter: number, ext: number) => {
            return baseArea + (basePerimeter * ext) + (4 * Math.pow(ext, 2));
        };

        // --- YENİ MÜHENDİSLİK MANTIĞI: İKSA KONTROLÜ ---
        let extensionBase = Math.max(0.50, Math.min(raftHeightExc * 1.5, 1.00));
        let isSloped = excavationDepth > 6.0; // Normalde 6m üstü kademeli şev yapılır

        // Eğer Kuyu Temel / Derin İksa varsa şev (eğim) YAPILAMAZ. Kazı dik kesilir.
        if (buildingStats.hasWellFoundation) {
            extensionBase = 0.50; // Sadece işçilerin yalıtım yapabilmesi için dar bir çalışma payı
            isSloped = false;     // Şevli (kademeli) kazı iptal edilir
        }

        let totalExcavationVolume = 0;

        if (isSloped) {
            // Şevli/Kademeli Kazı (İksa olmayan açık araziler için)
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
            // Dik Kesim (İksalı veya 6m'den sığ kazılar)
            const finalArea = getExtendedArea(excavationBaseArea, basePerim, extensionBase);
            totalExcavationVolume = excavationDepth * finalArea;
        }

        return totalExcavationVolume * item.multiplier * 1.25; // 1.25 -> Kabarma (Döküm) Katsayısı
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
        const landPerimeter = estimatePerimeter(landArea);
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
        const ampatman = buildingStats.hasWellFoundation ? 0 : Math.min(raftHeight * 1.5, 1.00);
        const formTemel = (perimeter + (8 * ampatman)) * raftHeight;

        let formBodrumPerde = 0;
        if (buildingStats.basementFloorCount > 0) {
            // Sabit +1 yerine %2 köşe/bindirme payı eklendi
            formBodrumPerde = (perimeter * 1.02) * (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) * 1;
        } else if (buildingStats.subasmanHeight && buildingStats.subasmanHeight > 0) {
            formBodrumPerde = perimeter * buildingStats.subasmanHeight * 2;
        }
        return (formKatlar + formTemel + formBodrumPerde) * (item.multiplier || 1);
    },

    'calc_roof': ({ buildingStats }) => {
        let baseArea = 0;
        let basePerim = 0;

        // Çatının oturacağı izdüşüm tabanını (alan ve çevre) belirliyoruz.
        if (buildingStats.buildingType === 'villa') {
            const nArea = buildingStats.normalFloorCount > 0 ? buildingStats.normalFloorArea : 0;
            const gArea = buildingStats.groundFloorArea || 0;

            // Villalarda hangi kat daha geniş oturuyorsa onun alanını ve çevresini baz alıyoruz
            if (nArea > gArea) {
                baseArea = nArea;
                basePerim = buildingStats.normalFloorPerimeter || estimatePerimeter(nArea);
            } else {
                baseArea = gArea;
                basePerim = buildingStats.groundFloorPerimeter || estimatePerimeter(gArea);
            }
        } else {
            // Apartmanlarda çatı genellikle en üstteki normal katın (veya sadece zemin varsa zeminin) üzerine oturur
            baseArea = buildingStats.normalFloorCount > 0 ? buildingStats.normalFloorArea : buildingStats.groundFloorArea;
            basePerim = buildingStats.normalFloorCount > 0
                ? (buildingStats.normalFloorPerimeter || estimatePerimeter(baseArea))
                : (buildingStats.groundFloorPerimeter || estimatePerimeter(baseArea));
        }

        const eaveOverhang = 0.80; // 80 cm standart saçak payı

        // Gerçek Matematiksel Formül:
        // Saçaklı İzdüşüm Alanı = Bina Alanı + (Bina Çevresi * Saçak) + (Köşe Boşlukları: 4 * Saçak²)
        const footprintWithEaves = baseArea + (basePerim * eaveOverhang) + (4 * Math.pow(eaveOverhang, 2));

        // Çatı eğim katsayısı: 30 derece eğim için 1 / cos(30) ≈ 1.154
        // Zayiat payı: Mahya, dere, eğik kesimler için %10 (1.10)
        const pitchFactor = 1.154;
        const wasteFactor = 1.10;

        return footprintWithEaves * pitchFactor * wasteFactor;
    },

    'calc_wall_global': ({ buildingStats }) => {
        // 1. Normal katların duvar metrajı (Çevre x Yükseklik x Kat Sayısı)
        const normalPerimeter = buildingStats.normalFloorPerimeter || estimatePerimeter(buildingStats.normalFloorArea);
        const normalWall = normalPerimeter * buildingStats.normalFloorHeight * buildingStats.normalFloorCount;

        // 2. Zemin katın duvar metrajı (Çevre x Yükseklik)
        const groundPerimeter = buildingStats.groundFloorPerimeter || estimatePerimeter(buildingStats.groundFloorArea);
        const groundWall = groundPerimeter * buildingStats.groundFloorHeight;

        // 3. Bodrum katların dış/iç perde duvar metrajı
        const basementPerimeter = buildingStats.basementFloorPerimeter || estimatePerimeter(buildingStats.basementFloorArea);
        const basementWall = basementPerimeter * buildingStats.basementFloorHeight * buildingStats.basementFloorCount;

        // 4. Çatı katı duvar metrajı
        let roofWall = 0;
        if (buildingStats.hasRoofFloor && (buildingStats.roofFloorArea || 0) > 0) {
            const roofPerimeter = buildingStats.roofFloorPerimeter || estimatePerimeter(buildingStats.roofFloorArea || 0);
            roofWall = roofPerimeter * (buildingStats.roofFloorHeight || 1.8);
        }

        // Hepsini topla
        return normalWall + groundWall + basementWall + roofWall;
    },

    'calc_facade': ({ buildingStats, aggregatedUnitStats }) => {
        const totalWindowArea = aggregatedUnitStats['calc_window_area'] || 0;
        const deductibleWindowArea = totalWindowArea;

        // --- ÇATI KATI (KALKAN DUVAR / PARAPET) HESABI ---
        let roofFacade = 0;
        if (buildingStats.hasRoofFloor && (buildingStats.roofFloorArea || 0) > 0) {
            const roofPerim = buildingStats.roofFloorPerimeter || estimatePerimeter(buildingStats.roofFloorArea || 0);
            const maxHeight = buildingStats.roofFloorMaxHeight || 3.0; 
            const parapetHeight = 0.60; 

            const shortSideApprox = roofPerim / 4.5;
            const triangleHeight = Math.max(0, maxHeight - parapetHeight);
            const gableWallArea = shortSideApprox * triangleHeight;
            const parapetArea = roofPerim * parapetHeight;

            roofFacade = gableWallArea + parapetArea;
        }

        // ---> YENİ: ÇIKMA ALTI (KONSOL SOFFIT) HESABI <---
        // Normal kat alanı, zemin kat alanından büyükse, aradaki fark binanın çıkma altı alanıdır.
        // Bu yatay alan dış havayla temas ettiği için mantolama ve boya metrajına eklenmelidir.
        let overhangArea = 0;
        if (buildingStats.normalFloorCount > 0) {
            const normalArea = buildingStats.normalFloorArea || 0;
            const groundArea = buildingStats.groundFloorArea || 0;
            overhangArea = Math.max(0, normalArea - groundArea);
        }

        if (buildingStats.buildingType === 'villa') {
            const groundPerim = buildingStats.groundFloorPerimeter || estimatePerimeter(buildingStats.groundFloorArea || 0);
            const subH = buildingStats.subasmanHeight !== undefined ? buildingStats.subasmanHeight : 0.50;
            const groundFacade = groundPerim * (buildingStats.groundFloorHeight + subH);

            let normalFacade = 0;
            if (buildingStats.normalFloorCount > 0) {
                const perim = buildingStats.normalFloorPerimeter || estimatePerimeter(buildingStats.normalFloorArea);
                normalFacade = perim * buildingStats.normalFloorHeight * buildingStats.normalFloorCount;
            }

            // overhangArea (çıkma altı) toplama dahil edildi
            const grossFacade = groundFacade + normalFacade + roofFacade + overhangArea; 
            const netFacade = Math.max(0, grossFacade - deductibleWindowArea);
            return netFacade * 1.15; // %15 zayiat

        } else {
            let groundFacadeHeight = buildingStats.groundFloorHeight;

            if (buildingStats.basementFloorCount === 0) {
                const subasmanH = buildingStats.subasmanHeight !== undefined ? buildingStats.subasmanHeight : 0.50;
                groundFacadeHeight += subasmanH;
            }

            const groundPerim = buildingStats.groundFloorPerimeter || estimatePerimeter(buildingStats.groundFloorArea || 0);
            const groundFacade = groundPerim * groundFacadeHeight;

            let normalFacade = 0;
            let normalPerim = 0;
            if (buildingStats.normalFloorCount > 0) {
                normalPerim = buildingStats.normalFloorPerimeter || estimatePerimeter(buildingStats.normalFloorArea || 0);
                normalFacade = normalPerim * buildingStats.normalFloorHeight * buildingStats.normalFloorCount;
            }

            // overhangArea (çıkma altı) toplama dahil edildi
            const grossFacade = groundFacade + normalFacade + roofFacade + overhangArea;
            const netFacade = Math.max(0, grossFacade - deductibleWindowArea);

            const facadeWaste = calculateWasteFactor([], buildingStats.normalFloorArea, normalPerim);
            return netFacade * facadeWaste;
        }
    },


    'calc_hard_ground': ({ buildingStats, item }) => {
        const landArea = buildingStats.landArea || 0;
        const footprintArea = buildingStats.groundFloorArea || 0;
        if (landArea <= 0 || footprintArea <= 0) return 0;

        const pool = buildingStats.poolArea || 0;
        const parking = buildingStats.parkingArea || 0;
        const veranda = buildingStats.verandaArea || 0;

        // Bina, havuz, otopark ve veranda gibi yapısal alanları topluyoruz
        const totalHardscape = footprintArea + pool + parking + veranda;

        // Arsadan arta kalan net peyzaj (boş) alanını buluyoruz
        const openArea = Math.max(0, landArea - totalHardscape);

        // Kalan boş alanın %30'unu yürüyüş yolu / sert zemin olarak kabul ediyoruz.
        // (Not: Kalan %70'lik kısım 'calc_grass_and_irrigation' içinde çim olarak hesaplanıyor)
        const hardGroundArea = openArea * 0.30;

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

    'calc_generator': ({ buildingStats, totalFloors, totalConstructionArea, aggregatedUnitStats, currentCosts, item }) => {
        if (buildingStats.buildingType === 'villa') {
            return 0; // Villalarda genelde standart değildir, istenirse özel kalemden eklenir.
        }

        const totalUnits = aggregatedUnitStats['calc_unit_count'] || Math.ceil(totalConstructionArea / 100);

        // Jeneratör zorunluluğu kontrolü (Örn: Asansörlü binalar veya >10 daire)
        if (totalFloors > 3 || totalUnits >= 10 || totalConstructionArea >= 800) {

            // 1. Sistemden 1 adet standart jeneratör fiyatını çek
            const basePrice = getGlobalPrice(currentCosts, item.name);

            // 2. Kapasite katsayısını hesapla
            const extraUnits = Math.max(0, totalUnits - 10);
            const capacityMultiplier = 1.0 + (extraUnits / 10) * 0.5;

            // 3. Adet değil, DOĞRUDAN TOPLAM TL FİYATINI DÖNDÜR
            return Math.round(basePrice * capacityMultiplier);
        }

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
        const basePerim = buildingStats.normalFloorPerimeter || estimatePerimeter(buildingStats.normalFloorArea); const netPerimeter = basePerim + 8;
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
            // APARTMAN DUBLEKS MANTIĞI (YENİ VE KESİN HESAP)
            const duplexSteps = aggregatedUnitStats['total_duplex_stair_steps'];
            if (duplexSteps !== undefined) {
                totalSteps += duplexSteps;
            } else {
                // Eğer eski sistemden kalmış bir veri varsa (Fallback)
                const duplexCount = aggregatedUnitStats['total_duplex_count'] || 0;
                if (duplexCount > 0) {
                    const normalHeight = buildingStats.normalFloorHeight || 3.00;
                    const normalStepsPerFlight = Math.round(normalHeight / idealRiserHeight);
                    totalSteps += duplexCount * (normalStepsPerFlight + landingBonus);
                }
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
            // APARTMAN DUBLEKS MANTIĞI (YENİ VE KESİN HESAP)
            const duplexRailing = aggregatedUnitStats['total_duplex_stair_railing'];
            if (duplexRailing !== undefined) {
                totalRailingMt += duplexRailing;
            } else {
                // Eski sistemden kalmış veri (Fallback)
                const duplexCount = aggregatedUnitStats['total_duplex_count'] || 0;
                if (duplexCount > 0) {
                    totalRailingMt += duplexCount * calcFlightRailing(buildingStats.normalFloorHeight || 3.00);
                }
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

    'calc_jcb': ({ buildingStats, totalFloors, totalConstructionArea }) => {
        const baseHours = 40;
        const floorHours = totalFloors * 4;
        const landscapeHours = totalConstructionArea * 0.02;

        // --- ZEKİCE EKLENTİ: GERİ DOLGU MESAİSİ ---
        const excavationBaseArea = buildingStats.basementFloorCount > 0
            ? buildingStats.basementFloorArea
            : buildingStats.groundFloorArea;

        const basePerim = buildingStats.basementFloorCount > 0
            ? (buildingStats.basementFloorPerimeter || estimatePerimeter(excavationBaseArea))
            : (buildingStats.groundFloorPerimeter || estimatePerimeter(excavationBaseArea));

        const totalFloorsForExc = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;
        const raftHeightExc = calculateEstimatedRaftHeight(totalFloorsForExc);

        // Kazı Derinliği (Bodrum + Radye + Çalışma Payı)
        const excavationDepth = (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) + raftHeightExc + 0.40;

        // Çalışma payı genişliği
        let extensionBase = Math.max(0.50, Math.min(raftHeightExc * 1.5, 1.00));
        let isSloped = excavationDepth > 6.0 && !buildingStats.hasWellFoundation;

        // 1. Standart çalışma payı (Perde ile dik toprak arası) dolgusu: Çevre x Genişlik x Derinlik
        let backfillVolume = 0;
        // Kuyu temel varsa toprak dik kesildiği için geri dolgu sıfıra yakındır
        if (!buildingStats.hasWellFoundation) {
            backfillVolume = basePerim * extensionBase * excavationDepth;

            if (isSloped) {
                const extraWidthAtTop = Math.floor(excavationDepth / 6.0) * 2.0;
                const extraWedgeVolume = basePerim * (extraWidthAtTop / 2) * excavationDepth;
                backfillVolume += extraWedgeVolume;
            }
        }

        // 2. Eğer şevli kazı yapılmışsa (6m'den derin), devasa bir kama (üçgen) boşluk oluşur.
        // calc_excavation formülüne göre her 6 metrede 2 metre dışarı açılıyor.
        if (isSloped) {
            const extraWidthAtTop = Math.floor(excavationDepth / 6.0) * 2.0;
            // Üçgen Kama Hacmi: (Taban x Yükseklik / 2) * Çevre
            const extraWedgeVolume = basePerim * (extraWidthAtTop / 2) * excavationDepth;
            backfillVolume += extraWedgeVolume;
        }

        // Bir JCB / Ekskavatör'ün ortalama geri dolgu yapıp serme hızı ~35 m³/saattir.
        const backfillMachineHours = Math.ceil(backfillVolume / 35);

        return baseHours + floorHours + landscapeHours + backfillMachineHours;
    },

    'calc_container_complex': ({ totalConstructionArea }) => {
        if (totalConstructionArea <= 2000) return 1.0;
        else if (totalConstructionArea <= 5000) return 2.0;
        else return 3.0;
    },

    'calc_drainage': ({ buildingStats, totalFloors }) => {
        const { perimeter } = getFoundationMetrics(buildingStats);
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = buildingStats.hasWellFoundation ? 0 : Math.min(raftHeight * 1.5, 1.00);
        return perimeter + (8 * ampatman) + 5;
    },

    'calc_duration_months': ({ constructionDuration }) => constructionDuration,

    'calc_foundation_area': ({ buildingStats, totalFloors }) => {
        const footprintArea = buildingStats.basementFloorCount > 0
            ? buildingStats.basementFloorArea
            : buildingStats.groundFloorArea;

        // Radye temel kalınlığı ve ampatman (çıkma) uzunluğu hesabı
        const raftHeight = calculateEstimatedRaftHeight(totalFloors);
        const ampatman = buildingStats.hasWellFoundation ? 0 : Math.min(raftHeight * 1.5, 1.00);
        const { perimeter: basePerim } = getFoundationMetrics(buildingStats);

        // Saf Ampatman (Çıkma) Alanı: Çevre x Çıkma Payı + Köşe Dönüşleri (4 x a²)
        const ampatmanArea = (basePerim * ampatman) + (4 * Math.pow(ampatman, 2));

        // 1. TEMEL ALTI YALITIMI (Bina oturumu + Ampatman genişliği kadar)
        let totalInsulationArea = footprintArea + ampatmanArea;

        // 2. YANAK YALITIMI (Genişletilmiş dış çevre x Temel yüksekliği)
        const foundationPerimeter = basePerim + (8 * ampatman);
        totalInsulationArea += (foundationPerimeter * raftHeight);

        // 3. AMPATMAN ÜSTÜ YATAY YALITIM (Yanaktan çıkıp perde duvara yatay dönüş)
        totalInsulationArea += ampatmanArea;

        // 4. DİKEY PERDE YALITIMI (Toprak altında kalan kısımlar)
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

        // Genellikle binaya %10'luk bir bindirme ve fire payı eklenir (Opsiyonel ama gerçekçidir)
        return totalInsulationArea * 1.10;
    },

    'calc_scaffolding_area': ({ buildingStats }) => {
        let facadeHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
            buildingStats.groundFloorHeight;

        if (buildingStats.basementFloorCount === 0) {
            const subasmanH = buildingStats.subasmanHeight !== undefined ? buildingStats.subasmanHeight : 0.50;
            facadeHeight += subasmanH;
        }

        // ---> YENİ: İSKELE ÇEVRESİ DÜZELTMESİ <---
        // İskele her zaman binanın en geniş oturumuna (genelde çıkmaların olduğu normal kata) göre kurulur.
        const groundPerim = buildingStats.groundFloorPerimeter || estimatePerimeter(buildingStats.groundFloorArea || 0);
        const normalPerim = buildingStats.normalFloorCount > 0 ? (buildingStats.normalFloorPerimeter || estimatePerimeter(buildingStats.normalFloorArea || 0)) : 0;
        
        // Zemin ve normal kat çevrelerinden en büyük olanı baz alıyoruz
        const maxBuildingPerimeter = Math.max(groundPerim, normalPerim);
        
        // İskeleyi bina yüzeyinden ayırmak ve köşeleri dönmek için +8 mt eklenir
        const scaffoldingPerimeter = maxBuildingPerimeter + 8;

        let totalScaffoldingArea = facadeHeight * scaffoldingPerimeter;

        // Çatı katı (kalkan duvar) iskelesi
        if (buildingStats.hasRoofFloor) {
            const roofHeight = buildingStats.roofFloorMaxHeight || 3.0;
            totalScaffoldingArea += (scaffoldingPerimeter / 2) * roofHeight;
        }

        return totalScaffoldingArea;
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
    globalWallMaterial: WallMaterial = 'gazbeton',
    costBreakdowns?: Record<string, { label: string; value: number }[]>,
    units?: any[]
): number => {
    const totalFloors = buildingStats.basementFloorCount + buildingStats.normalFloorCount + 1; // +1 Ground

    const totalBuildingHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
        buildingStats.groundFloorHeight +
        (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) +
        (buildingStats.hasRoofFloor ? (buildingStats.roofFloorMaxHeight || 0) : 0);

    const regulationHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
        buildingStats.groundFloorHeight;

    const ctx: CalculationContext = {
        item, buildingStats, totalConstructionArea, constructionDuration,
        aggregatedUnitStats, currentCosts, globalWallMaterial, totalFloors,
        totalBuildingHeight, regulationHeight, costBreakdowns, units // <--- BURA EKLENDİ
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
            duration = 10;
        } else if (totalArea <= 3000) {
            duration = (0.005 * totalArea) + 5; // 3000'de tam 20 aya ulaşır
        } else {
            // Kırılmayı (discontinuity) önlemek için bölen 2.7386 olarak güncellendi.
            // Böylece 3001 m2 girildiğinde sonuç yine ~20 ay çıkacak ve pürüzsüz artacaktır.
            duration = Math.sqrt(totalArea) / 2.7386;
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
    if (item.name === "Betonarme Betonu" || item.name === "Kuyu Temel Betonu") {
        const basePrice = getGlobalPrice(currentCosts, "Betonarme Betonu");
        let multiplier = 1.0;

        // C30 varsayılan (1.0) kabul edilir. Diğerleri orantılanır.
        if (buildingStats?.concreteClass === 'C25') multiplier = 0.92;
        else if (buildingStats?.concreteClass === 'C35') multiplier = 1.08;
        else if (buildingStats?.concreteClass === 'C40') multiplier = 1.15;

        return Math.round(basePrice * multiplier);
    }

    if (item.name === "Kuyu Temel Demiri") {
        return getGlobalPrice(currentCosts, "İnşaat Demiri");
    }


    // 2. Duvar Dinamik Fiyat Hesaplaması kendi işine bakıyor
    // 2. Duvar Dinamik Fiyat Hesaplaması kendi işine bakıyor
    if (item.name.startsWith("Duvar Malzemesi (") || item.name.startsWith("Duvar İşçiliği (")) {
        const match = item.name.match(/\(([\d\.]+) cm\)/);
        if (match && currentCosts && globalWallMaterial) {
            const thickness = parseFloat(match[1]);

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
                // İşçilik kalınlık çarpanları buraya taşındı (Single Source of Truth)
                let ratio = 1.0;
                if (thickness <= 10) ratio = 0.90; // İnce duvar örmesi oyalayıcıdır, fiyattan çok düşülmez
                else if (thickness <= 13.5) ratio = 1.0;
                else if (thickness <= 15) ratio = 1.05;
                else if (thickness <= 20) ratio = 1.10; // Sadece %10 hamaliye/ağırlık farkı
                else if (thickness <= 25) ratio = 1.15; // Sadece %15 ağırlık farkı

                return Math.round(baseLaborPrice * ratio);
            }
        }
    }


    if (item.name === "İskele Kirası (Aylık)" && buildingStats) {
        let facadeHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) + buildingStats.groundFloorHeight;

        // EKSİK OLAN KISIMLAR EKLENDİ
        if (buildingStats.basementFloorCount === 0) {
            const subasmanH = buildingStats.subasmanHeight !== undefined ? buildingStats.subasmanHeight : 0.50;
            facadeHeight += subasmanH;
        }
        if (buildingStats.hasRoofFloor) {
            facadeHeight += (buildingStats.roofFloorMaxHeight || 3.0);
        }

        const basePerim = buildingStats.groundFloorPerimeter || estimatePerimeter(buildingStats.groundFloorArea);
        const scaffoldingPerimeter = basePerim + 8;
        const scaffoldingArea = facadeHeight * scaffoldingPerimeter;
        return item.unit_price * scaffoldingArea;
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
    if (["Mimari Proje", "Statik Proje", "Mekanik Proje", "Elektrik Projesi"].includes(item.name)) {
        const basePrice = item.unit_price;

        if (totalConstructionArea <= 1000) {
            // 1000 m² ve altı projelerde (butik/villa) standart taban fiyat
            return basePrice;
        } else if (totalConstructionArea >= 5000) {
            // 5000 m² ve üstü (site/kompleks) projelerde ölçek ekonomisi gereği 
            // birim fiyatta %40'a varan indirim (çarpan 0.60) uygulanır.
            return basePrice * 0.60;
        } else {
            // 1000 ile 5000 m² arası için lineer (doğrusal) indirim hesabı
            const range = 5000 - 1000; // 4000 m²'lik marj
            const excess = totalConstructionArea - 1000;
            const ratio = excess / range; // 0 ile 1 arasında oran

            const maxDiscount = 0.40; // Maksimum %40 indirim
            const currentDiscount = maxDiscount * ratio;

            return basePrice * (1 - currentDiscount);
        }
    }


    if (item.name === "Grobeton") {
        const c30Price = getGlobalPrice(currentCosts, "Betonarme Betonu") || 2500;
        return Math.round(c30Price * 0.85);
    }

    // --- ISI POMPASI KAPASİTE/FİYAT DÜZELTMESİ ---
    if (item.name === "Isı Pompası (Hava Kaynaklı Dış Ünite)") {
        const basePrice = item.unit_price;
        
        // calculate-project.ts'den çağrıldığında unitArea 0 gelebilir. 
        // Çökmeyi önlemek için güvenli alan (targetArea) belirliyoruz.
        let targetArea = unitArea;
        if (targetArea <= 0 && buildingStats) {
            targetArea = buildingStats.buildingType === 'villa' 
                ? totalConstructionArea 
                : (buildingStats.normalFloorArea || 100);
        }
        
        // Ortalama 100 m²'ye kadar standart fiyatı (1.0 çarpan) kabul et.
        // Alan büyüdükçe (cihaz kapasitesi arttıkça) fiyatı doğrusal olarak çarp.
        const capacityMultiplier = Math.max(1.0, targetArea / 100.0);
        return Math.round(basePrice * capacityMultiplier);
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

        // --- 1 ADET BANDI (0 - 2000 m2) ---
        if (totalConstructionArea <= 1000) {
            return basePrice; // Standart 1 Adet
        }
        else if (totalConstructionArea <= 2000) {
            // Alan 1000-2000 arası büyürken, 2.yi almak yerine 1 tane "BÜYÜK" konteyner alınır. 
            // Fiyat doğrusal olarak 1.5 katına kadar çıkar.
            const progress = (totalConstructionArea - 1000) / 1000;
            return basePrice * (1.0 + (0.5 * progress));
        }

        // --- 2 ADET BANDI (2000 - 5000 m2) ---
        else if (totalConstructionArea <= 3000) {
            // Alan 2000'i geçtiği an miktar (calc_container_complex) otomatik 2'ye çıkar.
            // Bu yüzden birim fiyatı ŞİŞİRMİYORUZ, tekrar STANDART fiyata SIFIRLIYORUZ. (2 Adet Standart)
            return basePrice;
        }
        else if (totalConstructionArea <= 5000) {
            // Alan 3000-5000 arası büyürken 2 adet "BÜYÜK" konteyner alınır. Fiyat yine 1.5 katına kadar çıkar.
            const progress = (totalConstructionArea - 3000) / 2000;
            return basePrice * (1.0 + (0.5 * progress));
        }

        // --- 3 ADET BANDI (5000 m2 Üzeri) ---
        else {
            // 5000 m2 geçilince miktar 3'e çıkar, birim fiyat yine standarda döner.
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

    if (buildingStats?.buildingType === 'villa' && buildingStats?.isLuxuryVilla !== false) {
        // İşçilik ve Kaba Montaj gerektirenler (Daha az çarpan)
        const structuralPremium = [
            "Mantolama Malzemesi", "Çatı Konstrüksiyon ve Kaplama", "PVC Pencere (Doğrama)"
        ];

        // Göz önünde olan ve lüks seçilen Mimari/Dekoratif kalemler (Yüksek çarpan)
        const decorativePremium = [
            "Bina Giriş Kapısı (Ana)", "Çelik Kapı (Daire Giriş)", "İç Kapı (Panel/Lake)",
            "Mutfak Dolabı (Standart)", "Mutfak Tezgahı (Granit/Çimstone)", "Banyo Dolabı & Lavabo",
            "Portmanto / Vestiyer", "İç Merdiven (Dubleks)", "Balkon Korkulukları (Alüminyum)",
            "Cam Balkon Sistemleri", "Laminat Parke Malzemesi", "Laminat Parke İşçiliği",
            "Seramik Malzemesi", "Seramik İşçiliği"
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
            // YENİ: Kaba ve yarı-kaba işlerde lüks çarpanı değil, "butik iş/zorluk" çarpanı geçerlidir. 
            // Maksimum %10-%15 arası bir işçilik/fire farkı yansıtmak piyasa gerçeğine uygundur.
            const butikZorlukCarpani = totalConstructionArea <= 250 ? 0.15 : 0.10;
            return Math.round(item.unit_price * (1 + butikZorlukCarpani));
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
    totalConstructionCost: number = 0,
    currentCosts?: CostCategory[],
    costBreakdowns?: Record<string, { label: string; value: number }[]>, // YENİ
    itemName?: string // YENİ
): number => {
    const highCostCities = ['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Bursa', 'Muğla'];
    let cityMultiplier = highCostCities.includes(province) ? 2.5 : 1.5;

    const baseTapuDoner = getGlobalPrice(currentCosts, "Tapu Döner Sermaye") * cityMultiplier;
    const baseNoterPaperFee = getGlobalPrice(currentCosts, "Noter Yazı Ücreti");

    if (isUrbanTransformation) {
        const kentselDonusumEvrakBedeli = getGlobalPrice(currentCosts, "Noter Yazı Ücreti") / 2;
        const totalCost = baseNoterPaperFee + (unitCount * kentselDonusumEvrakBedeli);

        if (costBreakdowns && itemName) {
            costBreakdowns[itemName] = [
                { label: `Maktu Noter Giderleri (Kentsel Dönüşüm)`, value: Math.round(totalCost) },
                { label: `Harç ve Damga Vergisi (Muafiyet)`, value: 0 }
            ];
        }
        return totalCost;
    }

    if (constructionModel === 'kat_karsiligi') {
        const stampDutyRate = 0.00948;
        const notaryProportionalRate = 0.00113;

        const referenceValue = totalConstructionCost > 0 ? totalConstructionCost : (unitCount * 100 * 25000);

        const nispiHarclar = referenceValue * (stampDutyRate + notaryProportionalRate);
        const maktuGiderler = baseNoterPaperFee * cityMultiplier;
        const tapuTotal = unitCount * baseTapuDoner;

        if (costBreakdowns && itemName) {
            costBreakdowns[itemName] = [
                { label: `Nispi Harçlar (Damga Vergisi + Noter Harcı)`, value: Math.round(nispiHarclar) },
                { label: `Maktu Noter Giderleri (Kağıt, İmza)`, value: Math.round(maktuGiderler) },
                { label: `${unitCount} Daire Tapu Döner Sermaye`, value: Math.round(tapuTotal) }
            ];
        }

        return Math.round(nispiHarclar + maktuGiderler + tapuTotal);
    }

    const baseStandardContract = getGlobalPrice(currentCosts, "Standart Sözleşme Harcı");
    const standardContractFee = baseStandardContract * cityMultiplier;
    const tapuTotal = unitCount * baseTapuDoner;

    if (costBreakdowns && itemName) {
        costBreakdowns[itemName] = [
            { label: `Standart Sözleşme ve Noter Giderleri`, value: Math.round(standardContractFee) },
            { label: `${unitCount} Daire Tapu Döner Sermaye`, value: Math.round(tapuTotal) }
        ];
    }

    return standardContractFee + tapuTotal;
};