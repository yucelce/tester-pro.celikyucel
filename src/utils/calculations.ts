import { UnitType, BuildingStats, WallMaterial, RoomType } from '../types';
import { CostCategory, CostItem } from '../cost_data';
import { calculateWasteFactor } from './geometry';

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

export const calculateUnitCost = (
    unit: UnitType,
    currentCosts: CostCategory[],
    buildingStats: BuildingStats,
    globalWallMaterial: WallMaterial = 'gazbeton',
    globalWallMode: 'auto' | 'detailed' = 'auto',
    globalConcreteMode: 'auto' | 'detailed' = 'auto',
    globalWallThickness: number = 15,
    isStructural: boolean = false // YENİ EKLENEN PARAMETRE
) => {
    const ironCoeff = getIronCoefficient(buildingStats.earthquakeZone);
    let quantities: Record<string, number> = {};
    let totalCost = 0;

    let stats: Record<string, number> = {
        total_area: 0,
        total_perimeter: 0,
        wet_area: 0,
        net_wet_area: 0,
        dry_area: 0,
        dry_perimeter: 0,
        net_wall_area: 0,
        cornice_length: 0,

        mortar_volume: 0,   // Tuğla/ m3
        adhesive_weight: 0, // Gazbeton için kg

        // --- YENİ MEKANİK HESAP STATS ---
        calc_plumbing_unit: 0,
        calc_combi_count: 0,

        // Radyatör Grubu
        calc_radiator_infrastructure: 0,
        calc_radiator_len: 0,
        calc_radiator_count: 0,

        // Yerden Isıtma Grubu
        calc_underfloor_area: 0,
        calc_underfloor_collector: 0,

        calc_unit_count: 0,
        mortar_amount: 0, // <--- BU SATIRI EKLEYİN (Yeni Harç Sayacı)

        calc_rough_plaster_area: 0, // Kara Sıva (Seramik altı + Boya altı tüm duvarlar)
        calc_paint_wall_area: 0,    // Alçı Sıva + Boya (Sadece boyalı duvarlar)
        calc_ceiling_paint_area: 0, // Tavan Boyası (Oda alanları toplamı)
        calc_plaster_area: 0,

        calc_window_area: 0,      // Toplam Pencere Alanı
        calc_sill_length: 0,      // Mermer Denizlik (Pencere genişliği)
        calc_window_perimeter: 0, // Pencere Söve (Pencere Çevresi)
        calc_balcony_railing: 0,  // Balkon Korkuluğu

        // Generic Wall Stats by Thickness (Independent of Material)
        wall_10_area: 0,
        wall_13_5_area: 0,
        wall_15_area: 0,
        wall_20_area: 0,
        wall_25_area: 0,

        // Structure Stats
        column_concrete_volume: 0,
        column_formwork_area: 0,
        beam_concrete_volume: 0,
        beam_formwork_area: 0,
        slab_concrete_volume: 0,
        slab_formwork_area: 0,

        // YENİ EKLENENLER: Kaba inşaat metrajları için genel sayaçlar
        calc_concrete_unit: 0,
        calc_iron_unit: 0,
        calc_formwork_unit: 0,

        // Complex Unit Stats
        radiator_length: 0,
        kitchen_cabinet_length: 0,

        // YENİ EKLENEN İNCE İŞLER & VİTRİFİYE SAYAÇLARI
        calc_steel_door: 0,
        calc_inner_door: 0,
        calc_kitchen_cabinet: 0,
        calc_kitchen_counter_length: 0, // <--- BU SATIRI EKLEYİN
        calc_bathroom_cabinet: 0,
        calc_kitchen_sink: 0,
        calc_toilet: 0,
        calc_shower_cabin: 0,
        calc_shower_set: 0,
        // EKLENECEK:
        calc_basin_mixer: 0,
        calc_sink_mixer: 0,

        calc_electrical_points: 0,    // Toplam Elektrik Sortisi (Priz + Aydınlatma)
        calc_weak_current_points: 0,    // Zayıf Akım (TV, Tel, Data)
        calc_switch_socket_count: 0,    // Anahtar ve Priz Montaj Adeti (İşçilik ve anahtar kasası için)
        calc_sub_panel_count: 0         // Tali Pano (Daire Sigorta Kutusu)
    };

    let defaultFloorHeight = buildingStats.normalFloorHeight;
    let defaultFloorArea = buildingStats.normalFloorArea;

    // Dynamic Height Selection based on Floor Type
    if (unit.floorType === 'ground') {
        defaultFloorHeight = buildingStats.groundFloorHeight;
        defaultFloorArea = buildingStats.groundFloorArea;
    }
    if (unit.floorType === 'basement') {
        defaultFloorHeight = buildingStats.basementFloorHeight;
        defaultFloorArea = buildingStats.basementFloorArea;
    }
    // --- YENİ EKLENEN: AĞIRLIKLI DÖŞEME KALINLIĞI HESABI ---
    let totalSlabArea = 0;
    let sumSlabVolume = 0;
    (unit.slabs || []).forEach(slab => {
        let area = slab.manualAreaM2 > 0 ? slab.manualAreaM2 : (slab.area_px && unit.scale > 0 ? slab.area_px / (unit.scale * unit.scale) : 0);
        totalSlabArea += area;
        sumSlabVolume += area * slab.properties.thickness;
    });

    const avgSlabThicknessCm = totalSlabArea > 0 ? (sumSlabVolume / totalSlabArea) : 15;
    const avgSlabThicknessM = avgSlabThicknessCm / 100; // Metre cinsinden
    // Toplam İnşaat Alanını Hesapla (Dinamik Fiyatlandırma için Gerekli)
    const projectTotalArea = (buildingStats.normalFloorCount * buildingStats.normalFloorArea) +
        buildingStats.groundFloorArea +
        (buildingStats.basementFloorCount * buildingStats.basementFloorArea);

    if (!isStructural) {
        stats.calc_unit_count = 1;
        stats.calc_steel_door = 1;
        stats.calc_sub_panel_count = 1;

        // YENİ MANTIK: Sadece Kombi seçiliyse kombi yaz, Isı Pompasıysa ısı pompası yaz
        const heatingSystem = buildingStats.heatingSystem || 'radiator';
        if (heatingSystem === 'radiator' || heatingSystem === 'underfloor') {
            stats.calc_combi_count = 1;
        } else if (heatingSystem === 'heat_pump') {
            stats.calc_heat_pump = 1;
        }


    }
    const windowDeductions: Record<string, number> = {
        '10': 0, '13_5': 0, '15': 0, '20': 0, '25': 0
    };
    const wallOpeningDeductions: Record<string, number> = {
        '10': 0, '13_5': 0, '15': 0, '20': 0, '25': 0
    };
    // 1. Rooms (Always calculated for Flooring & Base Area)
    (unit.rooms || []).forEach(room => {
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
        stats.total_area += areaM2;
        stats.total_perimeter += perimeterM;



        if (!isStructural) {
            // 2. ISITMA SİSTEMİ HESAPLARI
            const heatingSystem = buildingStats.heatingSystem || 'radiator';
            // Duvar malzemesine göre yalıtım/ısı kaybı çarpanı (Tuğla referans alınarak = 1.0)
            let materialHeatFactor = 1.0;
            if (globalWallMaterial === 'gazbeton') materialHeatFactor = 0.85;
            else if (globalWallMaterial === 'bims') materialHeatFactor = 0.92;

            // Villalarda 4 cephe, taban ve çatı maruziyeti olduğu için ısı kaybı %25 daha fazladır
            if (buildingStats.buildingType === 'villa') {
                materialHeatFactor *= 1.25;
            }

            // Çarpanı formüle dahil edin
            const heatLossFactor = (30 + (buildingStats.heatZone * 5)) * materialHeatFactor;

            // Net Isıtılan Alan (Balkon hariç, banyo dahil)
            let heatedArea = 0;
            if (room.type !== 'balcony' && room.type !== 'other' && room.type !== 'storage') {
                heatedArea = areaM2;
            }

            if (heatingSystem === 'radiator') {
                // --- YENİ HASSAS RADYATÖR MANTIĞI ---
                if (heatedArea > 0) {
                    // 1. Yükseklik ve Cam Alanı
                    const roomHeight = room.properties.ceilingHeight || (defaultFloorHeight - avgSlabThicknessM - 0.04);
                    const windowArea = room.properties.windowArea || 0;

                    // 2. Cam Çarpanı (Camın alana oranı arttıkça ısı kaybı artar)
                    const windowRatio = heatedArea > 0 ? windowArea / heatedArea : 0;
                    const windowFactor = 1 + (windowRatio * 0.5);

                    // 3. Odanın Hacmi ve Gerçek Isı Yükü
                    const volume = heatedArea * roomHeight;
                    const roomHeatLoad = volume * heatLossFactor * windowFactor;

                    // 4. Petek Metrajı (Ortalama 1455 kcal/h - 600/22 PKKP verimi)
                    const radLen = roomHeatLoad / 1455;

                    // Her iki sayaç da güncellenir (cost_data.ts'teki farklı kalemler için)
                    stats.calc_radiator_len += radLen;
                    stats.radiator_length += radLen;

                    // 5. Altyapı Metrajı (Boru) - Cam alanı büyük odalarda hat daha çok uzar
                    stats.calc_radiator_infrastructure += (heatedArea * windowFactor);

                    // 6. Petek Adedi (Montaj ve Vana Maliyeti İçin)
                    // Uzun petekler tek parça takılamaz. Her 1.6 metrede bir radyatör bölünür varsayılır.
                    // Min 1 petek, metraj 2.4 mt çıkarsa 2 adet (örn: 1.2m + 1.2m) petek ve montaj yazılır.
                    const count = Math.max(1, Math.ceil(radLen / 1.6));
                    stats.calc_radiator_count += count;
                }
                // --- YENİ HASSAS RADYATÖR MANTIĞI BİTİŞİ ---
            } else if (heatingSystem === 'underfloor' || heatingSystem === 'heat_pump') {
                if (heatedArea > 0) {
                    // 1. Odanın yüksekliğini ve pencere alanını al
                    const roomHeight = room.properties.ceilingHeight || (defaultFloorHeight - avgSlabThicknessM - 0.04);
                    const windowArea = room.properties.windowArea || 0;

                    // 2. Pencere Isı Kaybı Çarpanı (Cam Oranı)
                    // Odanın alanına göre ne kadar cam var? (Her %10'luk cam oranı ısı yükünü %5 artırır kabulü)
                    const windowRatio = heatedArea > 0 ? windowArea / heatedArea : 0;
                    const windowFactor = 1 + (windowRatio * 0.5);

                    // 3. Standart Kabul (Referans): 2.9m tavan, 2. Isı Bölgesi, %10 standart cam oranı
                    const standardHeatLoad = 2.9 * 40 * 1.05; // ~121.8 kcal/m² referans yük

                    // 4. Odanın Gerçek Isı Yükü (Hacim x Bölge Faktörü x Cam Faktörü)
                    const roomHeatLoad = roomHeight * heatLossFactor * windowFactor;

                    // 5. Yoğunluk Katsayısı: Tavan yüksekse, bölge soğuksa VEYA CAM ALANI FAZLAYSA boru sıklaşır
                    const densityFactor = roomHeatLoad / standardHeatLoad;

                    // 6. Efektif Metraj: Alan x Yoğunluk (Maliyeti artırır)
                    stats.calc_underfloor_area += (heatedArea * densityFactor);

                    // 7. Kollektör Hesabı (Ağız/Loop Sayısı)
                    // Borular sıklaştıkça metraj artar, bu da loop uzunluklarını sınırlar ve ekstra ağız gerektirir
                    const portsNeeded = Math.ceil((heatedArea * densityFactor) / 12); // Gerekli toplam loop (ağız) sayısı

                    // Her daireye en az 1 kollektör kutusu atanır.
                    // Eğer ağız sayısı 12'yi (piyasa sınırı) geçerse, 2. bir kollektör eklenir.
                    let collectorCount = 1;
                    if (portsNeeded > 12) {
                        collectorCount = Math.ceil(portsNeeded / 10); // Büyük dairelerde 10'arlı gruplara böl
                    }

                    stats.calc_underfloor_collector += collectorCount;
                }
            } else if (heatingSystem === 'vrf') {
                if (heatedArea > 0) {
                    // 1. Altyapı metrajı: Isıtılacak/Soğutulacak alan üzerinden bakır borulama hesaplanır
                    stats.calc_vrf_infrastructure += heatedArea;

                    // 2. İç Ünite (Kaset/Kanallı): Her oda için minimum 1 adet. Alan 35 m²'den büyükse 2 adet say.
                    const indoorUnits = Math.ceil(heatedArea / 35);
                    stats.calc_vrf_indoor += indoorUnits;
                }
            }
            // --- YENİ MANTIK: ODA BAZLI İNCE İŞ HESABI ---

            // 1. Tavan Yüksekliğini Belirle
            const roomHeight = room.properties.ceilingHeight || (defaultFloorHeight - avgSlabThicknessM - 0.04);

            // 2. Açıklıkları (Kapı/Pencere) Hesapla
            // Kapı varsayılan 90x210 cm = ~1.89 m2
            const doorDeduction = (room.properties.doorCount || 0) * 1.89;
            const windowDeduction = room.properties.windowArea || 0;
            const totalDeduction = doorDeduction + windowDeduction;

            // 3. Brüt Duvar Alanı (Çevre x Yükseklik)
            const grossWallArea = Math.max(0, (perimeterM * roomHeight) - totalDeduction);

            // 4. Tavan Boyası
            stats.calc_ceiling_paint_area += areaM2;

            // 5. Duvar Malzemesine Göre Dağılım (Boya vs Seramik)
            stats.calc_rough_plaster_area += grossWallArea;

            if (room.properties.wallFinish === 'boya') {
                // Duvar boyalı ise: Duvar Boyası metrajına sadece duvarı ekle
                stats.calc_paint_wall_area += grossWallArea;

                // Alçı Sıva metrajına: Duvar + Tavan alanını ekle
                stats.calc_plaster_area += (grossWallArea + areaM2);
            } else {
                // Duvar seramik ise: Duvarlara alçı yapılmaz, ama tavana alçı yapılır.
                stats.calc_plaster_area += areaM2;

                stats.wet_area += grossWallArea;
            }
            // Eğer 'seramik' ise paint_wall_area'ya eklemiyoruz, sadece kara sıvaya ekledik.

            // 6. Kartonpiyer
            if (room.properties.hasCornice) {
                stats.cornice_length += perimeterM;
            }

            // --- MEVCUT MANTIKLAR (Islak Hacim, Radyatör vb.) ---
            if (room.properties.floorType === 'seramik' || room.properties.hasWaterproofing) {
                stats.wet_area += areaM2 * roomWaste; // Fireli (Sadece Seramik Kaplama İçin)
                stats.net_wet_area = (stats.net_wet_area || 0) + areaM2; // Firesiz (Net Alan)
            }

            // Kuru hacim ve Parke hesabı (Zayiatlı)
            if (room.properties.floorType === 'parke') {
                stats.dry_area += areaM2 * roomWaste; //
                stats.dry_perimeter += perimeterM * roomWaste; //
            }

            // İç Kapılar (Oda kapı sayısı kadar artır)
            // Not: Daire girişi hariçtir, o yüzden oda kapılarını topluyoruz.
            stats.calc_inner_door += (room.properties.doorCount || 0);

            // --- MUTFAK HESABI ---
            const isKitchen = room.type === 'kitchen' || room.name.toLowerCase().includes('mutfak') || room.name.toLowerCase().includes('kitchen');
            if (isKitchen) {
                stats.calc_plumbing_unit += 0.5;
                // Dolap uzunluğu (mt) hesabı
                const cabinetLength = Math.sqrt(areaM2 / 12) * 4;

                // Dolap Yüksekliği: Tavan yüksekliğinden 10cm alt baza, 60cm tezgah arası, 20cm üst boşluk (toplam 90cm = 0.90m) düşülür
                const effectiveCabinetHeight = Math.max(0, roomHeight - 0.90);

                // M²'ye çevirme: Uzunluk * Efektif Dolap Yüksekliği
                const cabinetArea = cabinetLength * effectiveCabinetHeight;

                stats.calc_kitchen_cabinet += cabinetArea;
                stats.kitchen_cabinet_length += cabinetArea; // Değişken adı length kalsa da artık m² tutuyor
                stats.calc_kitchen_counter_length += cabinetLength;
                stats.calc_kitchen_sink += 1;
                stats.calc_sink_mixer += 1;
            }

            // --- BANYO MANTIĞI ---
            if (room.type === 'bath') {
                stats.calc_plumbing_unit += 0.5; // Sıhhi tesisat payı
                stats.calc_bathroom_cabinet += 1; // Banyo dolabı
                stats.calc_toilet += 1; // Klozet
                stats.calc_basin_mixer += 1; // Lavabo bataryası
                stats.calc_shower_cabin += 1; // Duşakabin
                stats.calc_shower_set += 1; // Duş seti
            }

            // --- WC MANTIĞI ---
            if (room.type === 'wc') {
                stats.calc_plumbing_unit += 0.25; // Sadece tuvalet ve el lavabosu için daha az tesisat yükü
                stats.calc_toilet += 1; // Klozet (veya Alaturka taşı - maliyet karşılığı klozet sayılır)
                stats.calc_basin_mixer += 1; // Lavabo bataryası
                // WC'lerde genelde duşakabin, duş seti ve büyük banyo dolabı olmaz, bu yüzden eklenmedi.
            }

            // Pencere Alanı & Denizlik

            const wArea = room.properties.windowArea || 0;
            if (wArea > 0) {
                stats.calc_window_area += wArea;

                // YENİ EKLENEN: Seçili duvar kalınlığına göre düşülecek alanı havuzda biriktir (Yapısal düşüm için)
                const wThick = room.properties.windowWallThickness || 20; // 15 yerine 20
                let tKey = "15";
                if (wThick <= 10) tKey = "10";
                else if (wThick <= 13.5) tKey = "13_5";
                else if (wThick <= 15) tKey = "15";
                else if (wThick <= 20) tKey = "20";
                else tKey = "25";

                windowDeductions[tKey] += wArea;

                // Gerçekçi dikdörtgen kabulü (Genişlik / Yükseklik = 4 / 3 veya yatay pencere)

                const windowWidth = Math.sqrt(wArea * (4 / 3));
                const windowHeight = Math.sqrt(wArea * (3 / 4));

                // Denizlik (sadece alt kenar) + 5 cm taşma/montaj payı
                stats.calc_sill_length += (windowWidth + 0.05);

                // Söve (Pencerenin 4 kenarı, dikdörtgen çevresi)
                stats.calc_window_perimeter += 2 * (windowWidth + windowHeight);
            }

            const dCount = room.properties.doorCount || 0;
            const dArea = dCount * 1.89; // Standart iç kapı alanı kabulü (0.90 x 2.10)
            if (dArea > 0) {
                const dThick = room.properties.doorWallThickness || 13.5; // 15 yerine 13.5
                let tKey = "15";
                if (dThick <= 10) tKey = "10";
                else if (dThick <= 13.5) tKey = "13_5";
                else if (dThick <= 15) tKey = "15";
                else if (dThick <= 20) tKey = "20";
                else tKey = "25";

                wallOpeningDeductions[tKey] += dArea;
            }

            // Balkon Korkuluğu
            if (room.type === 'balcony') {
                stats.calc_balcony_railing += (perimeterM / 2);
            }


        }

        // --- EKLENECEK KOD BAŞLANGICI: ELEKTRİK TESİSATI HESABI ---
        let roomStrongPoints = 0; // Kuvvetli Akım (Aydınlatma + Priz)
        let roomWeakPoints = 0;   // Zayıf Akım (TV, Data, Telefon)

        switch (room.type) {
            case 'living':
                roomStrongPoints = 6; // 1 Aydınlatma + 5 Priz
                roomWeakPoints = 3;   // TV, İnternet(Data), Telefon
                break;
            case 'bedroom':
                roomStrongPoints = 4; // 1 Aydınlatma + 3 Priz
                roomWeakPoints = 1;   // TV veya Data
                break;
            case 'kitchen':
                roomStrongPoints = 8; // Mutfak çok priz ister (Fırın, Bulaşık Mak. vb.)
                roomWeakPoints = 1;
                break;
            case 'bath':
                roomStrongPoints = 3; // 1 Aydınlatma + 1 Çamaşır Mak. + 1 Ayna Yanı Priz
                roomWeakPoints = 0;
                break;
            case 'wc':
                roomStrongPoints = 1; // Sadece 1 Aydınlatma (veya 1 ekstra ayna prizi kabulüyle 2 yapılabilir, biz 1 kabul ediyoruz)
                roomWeakPoints = 0;
                break;
            case 'hallway':
                roomStrongPoints = 2; // 1 Aydınlatma + 1 Priz (Elektrik Süpürgesi vb.)
                roomWeakPoints = 0;
                break;
            case 'dressing':
                roomStrongPoints = 3; // 1 Aydınlatma + 2 Priz (Ütü vb.)
                roomWeakPoints = 0;
                break;
            case 'balcony':
                roomStrongPoints = 2; // 1 Aydınlatma + 1 Priz
                roomWeakPoints = 0;
                break;
            case 'storage':
            case 'other':
                roomStrongPoints = 1; // Sadece Aydınlatma
                roomWeakPoints = 0;
                break;
            default:
                roomStrongPoints = 4;
                roomWeakPoints = 1;
                break;
        }

        // Hesaplanmış değerleri genel sayaçlara ekle
        stats.calc_electrical_points += roomStrongPoints;
        stats.calc_weak_current_points += roomWeakPoints;
        stats.calc_switch_socket_count += (roomStrongPoints + roomWeakPoints);
        // --- EKLENECEK KOD BİTİŞİ ---


    });

    // --- STRUCTURAL WALLS ---
    const useDetailedWalls = globalWallMode === 'detailed';
    const useDetailedConcrete = globalConcreteMode === 'detailed';

    if (useDetailedWalls) {
        // DETAILED WALLS CALCULATION
        if (unit.walls && unit.walls.length > 0) {
            unit.walls.forEach(wall => {
                let lengthM = 0;
                if (wall.manualLengthM !== undefined && wall.manualLengthM > 0) {
                    lengthM = wall.manualLengthM;
                } else if (unit.scale > 0) {
                    lengthM = wall.length_px / unit.scale;
                }

                // Determine Wall Height
                let wallHeight = 0;
                if (wall.properties.height && wall.properties.height > 0) {
                    wallHeight = wall.properties.height;
                } else {
                    wallHeight = defaultFloorHeight;
                    if (wall.properties.isUnderBeam && wall.properties.beamHeight > 0) {
                        wallHeight -= (wall.properties.beamHeight / 100);
                    } else {
                        wallHeight -= avgSlabThicknessM;
                    }
                }

                const wallArea = lengthM * wallHeight;
                const thick = wall.properties.thickness;

                // Map thickness to generic key
                let tKey = "";
                if (thick <= 10) tKey = "wall_10_area";
                else if (thick <= 13.5) tKey = "wall_13_5_area";
                else if (thick <= 15) tKey = "wall_15_area";
                else if (thick <= 20) tKey = "wall_20_area";
                else tKey = "wall_25_area";

                if (stats[tKey] !== undefined) {
                    stats[tKey] += wallArea;
                }
                const mat = globalWallMaterial;

                if (mat === 'gazbeton') {
                    // GAZBETON: Sadece Yapıştırıcı kullanır.
                    // Sarfiyat: Ortalama 3-4 kg/m² (13.5 - 15cm için)
                    // Formül: Alan * Kalınlık(cm) * 0.25 (katsayı)
                    // Örn: 100m² * 15cm * 0.25 = 375 kg
                    const adhesiveCoeff = 0.25 * thick;
                    stats.adhesive_weight += wallArea * adhesiveCoeff;
                } else {
                    // TUĞLA ve BİMS: Harç kullanır.
                    // Sarfiyat: Ortalama 0.02 - 0.03 m³/m²
                    // Formül: Alan * Kalınlık(cm) * 0.002 (katsayı)
                    // Örn: 100m² * 13.5cm * 0.002 = 2.7 m³ harç
                    const mortarCoeff = 0.002 * thick;
                    stats.mortar_volume += wallArea * mortarCoeff;
                }


            });
        }

        // Paint Area Strategy for Detailed Mode
        if (unit.rooms.length > 0) {
            let totalRoomWallArea = 0;
            unit.rooms.forEach(r => {
                const h = r.properties.ceilingHeight || (defaultFloorHeight - avgSlabThicknessM - 0.04);
                const p = r.manualPerimeterM || (unit.scale > 0 ? r.perimeter_px / unit.scale : 0);

                // --- DEĞİŞİKLİK BAŞLANGICI ---
                // Balkon Mantığı: Balkonun çevresinin tamamı duvar değildir.
                // Genelde 2 duvar dolu, 2 taraf açıktır (L tipi). 
                // Bu yüzden balkonlarda çevre uzunluğunun sadece %50'sini duvar alanı olarak alıyoruz.
                let wallFactor = 1.0;

                if (r.type === 'balcony') {
                    wallFactor = 0.5; // 4 duvar yerine 2 duvar kabulü
                }

                // Eğer oda tipi 'wet' (banyo) ise ve duvar seramikse, yine de net duvar alanı hesaplanır
                // ancak maliyet kalemlerinde "Boya" yerine "Seramik" kullanıldığı için sorun olmaz.

                totalRoomWallArea += (p * h * wallFactor);
                // --- DEĞİŞİKLİK BİTİŞİ ---
            });

            // Deduct window/door rough estimate (Kapı pencere boşlukları düşülüyor)
            stats.net_wall_area = totalRoomWallArea * 0.85;
        } else {
            // Fallback to structural walls * 2 sides
            let totalWallArea = 0;
            Object.keys(stats).forEach(k => {
                if (k.startsWith('wall_') && k.endsWith('_area')) totalWallArea += stats[k];
            });
            stats.net_wall_area = totalWallArea * 2;
        }

    } else {
        // GLOBAL AUTO WALLS

        const refArea = stats.total_area > 0 ? stats.total_area : defaultFloorArea;

        // YENİ: Kat tipine göre BuildingStats içindeki çevre uzunluğunu al
        let floorPerimeter = Math.sqrt(refArea) * 4; // Fallback
        if (unit.floorType === 'normal' && buildingStats.normalFloorPerimeter) {
            floorPerimeter = buildingStats.normalFloorPerimeter;
        } else if (unit.floorType === 'ground' && buildingStats.groundFloorPerimeter) {
            floorPerimeter = buildingStats.groundFloorPerimeter;
        } else if (unit.floorType === 'basement' && buildingStats.basementFloorPerimeter) {
            floorPerimeter = buildingStats.basementFloorPerimeter;
        }

        // Ampirik Katsayı: Konut projelerinde 1 m² kat alanına ortalama 2.2 m² duvar yüzeyi (tek yüz) düşer.
        // Kat yüksekliğine duyarlı olması için varsayılan 3 metreyi referans alarak bir çarpan ekliyoruz:
        const heightFactor = Math.max(1, (defaultFloorHeight / 3.0));
        const estimatedWallSurface = refArea * 2.2 * heightFactor;

        // Dış Duvar = Panodan gelen Kat Çevresi * Kat Yüksekliği
        const outerWallSurface = floorPerimeter * defaultFloorHeight;

        // İç Duvar = Kalan Metraj
        const innerWallSurface = Math.max(0, estimatedWallSurface - outerWallSurface);

        if (stats["wall_20_area"] !== undefined) {
            stats["wall_20_area"] += outerWallSurface;
        } else {
            stats["wall_20_area"] = outerWallSurface;
        }

        if (stats["wall_13_5_area"] !== undefined) {
            stats["wall_13_5_area"] += innerWallSurface;
        } else {
            stats["wall_13_5_area"] = innerWallSurface;
        }

        stats.net_wall_area = estimatedWallSurface * 2;

        if (globalWallMaterial === 'gazbeton') {
            // Dış duvar 20cm, iç duvar 13.5cm
            stats.adhesive_weight += (outerWallSurface * 20 * 0.25) + (innerWallSurface * 13.5 * 0.25);
        } else {
            stats.mortar_volume += (outerWallSurface * 20 * 0.002) + (innerWallSurface * 13.5 * 0.002);
        }
    }

    Object.keys(windowDeductions).forEach(thickStr => {
        const deductionArea = windowDeductions[thickStr];
        if (deductionArea > 0) {
            const tKey = `wall_${thickStr}_area`;
            const thickVal = thickStr === '13_5' ? 13.5 : parseFloat(thickStr);

            // Eksi değerlere izin veriyoruz ki statik ve mimari planlar birleşirken net metraj doğru çıksın
            if (stats[tKey] === undefined) stats[tKey] = 0;
            stats[tKey] -= deductionArea;

            // Seçili olan duvar kalınlığının çarpanına göre sarf malzemeden eksilt
            if (globalWallMaterial === 'gazbeton') {
                const adhesiveCoeff = 0.25 * thickVal;
                stats.adhesive_weight -= (deductionArea * adhesiveCoeff);
            } else {
                const mortarCoeff = 0.002 * thickVal;
                stats.mortar_volume -= (deductionArea * mortarCoeff);
            }
        }
    });

    Object.keys(wallOpeningDeductions).forEach(thickStr => {
        const deductionArea = wallOpeningDeductions[thickStr];
        if (deductionArea > 0) {
            const tKey = `wall_${thickStr}_area`;
            const thickVal = thickStr === '13_5' ? 13.5 : parseFloat(thickStr);

            if (stats[tKey] === undefined) stats[tKey] = 0;
            stats[tKey] -= deductionArea;

            if (globalWallMaterial === 'gazbeton') {
                const adhesiveCoeff = 0.25 * thickVal;
                stats.adhesive_weight -= (deductionArea * adhesiveCoeff);
            } else {
                const mortarCoeff = 0.002 * thickVal;
                stats.mortar_volume -= (deductionArea * mortarCoeff);
            }
        }
    });

    // --- STRUCTURAL CONCRETE ---
    const hasConcreteElements = (unit.columns && unit.columns.length > 0) ||
        (unit.beams && unit.beams.length > 0) ||
        (unit.slabs && unit.slabs.length > 0);


    if (useDetailedConcrete) {
        // 1. Columns
        (unit.columns || []).forEach(col => {
            let areaM2 = 0;
            let perimeterM = 0;
            if (col.manualAreaM2 !== undefined && col.manualAreaM2 > 0) {
                areaM2 = col.manualAreaM2;
                perimeterM = col.manualPerimeterM || (Math.sqrt(areaM2) * 4);
            } else if (unit.scale > 0) {
                areaM2 = col.area_px / (unit.scale * unit.scale);
                perimeterM = col.perimeter_px / unit.scale;
            }

            const height = (col.properties.height && col.properties.height > 0)
                ? col.properties.height
                : defaultFloorHeight;

            stats.column_concrete_volume += areaM2 * height;
            stats.column_formwork_area += perimeterM * height;
        });

        // 2. Beams
        // 2. Beams
        (unit.beams || []).forEach(beam => {
            let lengthM = 0;
            if (beam.manualLengthM !== undefined && beam.manualLengthM > 0) {
                lengthM = beam.manualLengthM;
            } else if (unit.scale > 0) {
                lengthM = beam.length_px / unit.scale;
            }
            const widthM = beam.properties.width / 100;
            const heightM = beam.properties.height / 100;
            const slabThickM = beam.properties.slabThickness / 100;

            // Beton hacminde değişiklik yok (Kiriş hacmi kesişim düşülmeden brüt hesaplanır veya kolonlardan düşülür)
            stats.beam_concrete_volume += widthM * heightM * lengthM;

            // Kiriş Yan Kalıp Yüksekliği (Döşeme kalınlığı düşülerek)
            const sideFormHeight = Math.max(0, heightM - slabThickM);

            // YENİ MANTIK: 
            // 1. Kirişin yan yüzeyleri (iki taraf) boydan boya kalıplanır.
            const sideFormworkArea = (2 * sideFormHeight) * lengthM;

            // 2. Kirişin taban alanı hesaplanırken kolon/perde birleşim noktaları için %15 azaltma (fire) uygulanır.
            const intersectionFactor = 0.85; // %15 düşüldü (Katsayıyı 0.90 yaparak %10 da yapabilirsiniz)
            const bottomFormworkArea = (widthM * lengthM) * intersectionFactor;

            // Toplam kalıp alanı
            stats.beam_formwork_area += (sideFormworkArea + bottomFormworkArea);
        });

        // 3. Slabs
        (unit.slabs || []).forEach(slab => {
            let area = 0;
            if (slab.manualAreaM2 > 0) {
                area = slab.manualAreaM2;
            } else if (slab.area_px && unit.scale > 0) {
                area = slab.area_px / (unit.scale * unit.scale);
            }

            const thick = slab.properties.thickness / 100;
            stats.slab_concrete_volume += area * thick;
            stats.slab_formwork_area += area; // Bottom formwork
        });

    } else {
        // GLOBAL AUTO CONCRETE
        const refArea = stats.total_area > 0 ? stats.total_area : defaultFloorArea;
        const heightRatio = defaultFloorHeight / 3.0;

        // Empirik Katsayılar (m2 inşaat alanı başına)
        const concreteEmpiricalFactor = 0.38; // 0.38 m3 beton / m2
        const totalConcrete = refArea * concreteEmpiricalFactor * heightRatio;

        stats.slab_concrete_volume = totalConcrete * 0.65;
        stats.column_concrete_volume = totalConcrete * 0.20;
        stats.beam_concrete_volume = totalConcrete * 0.15;

        const formworkEmpiricalFactor = 2.8; // 2.8 m2 kalıp / m2
        const totalForm = refArea * formworkEmpiricalFactor * heightRatio;

        stats.slab_formwork_area = totalForm * 0.5;
        stats.column_formwork_area = totalForm * 0.25;
        stats.beam_formwork_area = totalForm * 0.25;
    }

    // YENİ EKLENEN: Hesaplanan hacimleri statslara aktar ki cost_data eşleşebilsin
    stats.calc_concrete_unit = stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume;
    stats.calc_formwork_unit = stats.column_formwork_area + stats.beam_formwork_area + stats.slab_formwork_area;
    stats.calc_iron_unit = stats.calc_concrete_unit * ironCoeff; // 1 m3 betona ortalama 100kg (0.1 ton) demir
    // --- ÇİFTE HESAPLAMAYI ÖNLEME VE OTOMATİK İNCE İŞLER (FALLBACK) ---
    if (isStructural) {
        // STATİK PLAN: İnce işler hesaplamadan dışlanır
        stats.cornice_length = 0;
        stats.wet_area = 0;
        stats.dry_area = 0;
        stats.radiator_length = 0;
        stats.kitchen_cabinet_length = 0;
        stats.calc_rough_plaster_area = 0;
        stats.calc_paint_wall_area = 0;
        stats.calc_ceiling_paint_area = 0;
        stats.calc_plaster_area = 0;
    } else {
        // MİMARİ PLAN: Kaba işler (Duvar Bloğu, Beton, Kalıp vb.) hesaplamadan dışlanır
        stats.wall_10_area = Math.min(0, stats.wall_10_area || 0);
        stats.wall_13_5_area = Math.min(0, stats.wall_13_5_area || 0);
        stats.wall_15_area = Math.min(0, stats.wall_15_area || 0);
        stats.wall_20_area = Math.min(0, stats.wall_20_area || 0);
        stats.wall_25_area = Math.min(0, stats.wall_25_area || 0);
        stats.adhesive_weight = Math.min(0, stats.adhesive_weight || 0);
        stats.mortar_volume = Math.min(0, stats.mortar_volume || 0);

        stats.calc_concrete_unit = 0;
        stats.calc_formwork_unit = 0;
        stats.calc_iron_unit = 0;

        // EĞER KULLANICI ODA ÇİZMEDİYSE/EKLEMEDİYSE SIVA SIFIR KALMASIN (OTOMATİK METRAJ)
        if (stats.calc_rough_plaster_area === 0) {

            // Bunun yerine ünitenin o kattaki tahmini alanını buluyoruz:
            let fallbackArea = defaultFloorArea;
            if (!isStructural && unit.count > 0) {
                let floorCount = 1;
                if (unit.floorType === 'normal') floorCount = Math.max(1, buildingStats.normalFloorCount);
                if (unit.floorType === 'ground') floorCount = 1;
                if (unit.floorType === 'basement') floorCount = Math.max(1, buildingStats.basementFloorCount);

                // Bu daire tipinden 1 kata ortalama kaç adet düşüyor?
                const unitsPerFloor = Math.max(1, unit.count / floorCount);

                // Tahmini Daire Alanı = Kat Alanı / Katta Bulunan Daire Sayısı
                fallbackArea = defaultFloorArea / unitsPerFloor;
            }

            const fArea = stats.total_area > 0 ? stats.total_area : fallbackArea;

            // Ampirik katsayılar: 1 m² kat alanına ortalama 2.8 m² iç sıva yüzeyi, 2.5 m² boya yüzeyi düşer
            stats.calc_rough_plaster_area = fArea * 2.8;
            stats.calc_paint_wall_area = fArea * 2.5;
            stats.calc_ceiling_paint_area = fArea;
            stats.calc_plaster_area = fArea * 3.5; // Duvar + Tavan Alçısı
            stats.cornice_length = Math.sqrt(fArea) * 4 * 1.5;

            if (stats.wet_area === 0) {
                stats.wet_area = fArea * 0.15 * 1.05; // %15 banyo/mutfak varsayımı + %5 fire
                stats.net_wet_area = fArea * 0.15; // Net Alan
            }
            if (stats.dry_area === 0) {
                stats.dry_area = fArea * 0.85 * 1.05; // %85 parke/kuru alan varsayımı + %5 fire
            }
        }
    }
    // ------------------------------------------------------------------
    currentCosts.forEach(cat => {
        cat.items.forEach(item => {
            if (item.auto_source !== 'manual') {
                let qty = 0;
                // MAPPING GÜNCELLEMESİ: Yeni hesaplanan değerleri eşle
                if (item.auto_source === 'calc_window_area') qty = stats.calc_window_area;
                else if (item.auto_source === 'calc_sill_length') qty = stats.calc_sill_length;
                else if (item.auto_source === 'calc_window_perimeter') qty = stats.calc_window_perimeter;
                else if (item.auto_source === 'calc_balcony_railing') qty = stats.calc_balcony_railing;
                else if (item.auto_source === 'calc_radiator') qty = stats.radiator_length;
                else if (item.auto_source === 'calc_kitchen_cabinet') qty = stats.kitchen_cabinet_length;
                else {
                    const isConcrete = item.name === 'Betonarme Betonu (C30)';
                    const isIron = item.name === 'İnşaat Demiri';
                    const isFormwork = item.name === 'Kalıp İşçiliği & Malzeme';

                    if (isConcrete || isIron || isFormwork) {
                        if (useDetailedConcrete) {
                            const totalVol = stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume;
                            const totalForm = stats.column_formwork_area + stats.beam_formwork_area + stats.slab_formwork_area;

                            if (isConcrete) qty = totalVol;
                            else if (isFormwork) qty = totalForm;
                            else if (isIron) qty = totalVol * ironCoeff;
                        } else {
                            if (isConcrete) qty = stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume;
                            else if (isFormwork) qty = stats.column_formwork_area + stats.beam_formwork_area + stats.slab_formwork_area;
                            else if (isIron) qty = (stats.column_concrete_volume + stats.beam_concrete_volume + stats.slab_concrete_volume) * 0.100;
                        }
                    }
                    else {
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
                    item,
                    unitArea,
                    projectTotalArea,
                    buildingStats.province,
                    buildingStats.isUrbanTransformation,
                    buildingStats,
                    currentCosts,
                    globalWallMaterial
                );

                quantities[item.name] = qty;
                totalCost += qty * dynamicPrice;
            }
        });
    });

    return { quantities, totalCost, stats };
};

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

/**
 * Calculates Global Project Quantities using complex engineering formulas.
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

    // Constants & Derived
    const totalFloors = buildingStats.basementFloorCount + buildingStats.normalFloorCount + 1; // +1 Ground
    // Fiziksel İmalatlar İçin (Bodrum DAHİL Toplam Yükseklik)
    const totalBuildingHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
        buildingStats.groundFloorHeight +
        (buildingStats.basementFloorCount * buildingStats.basementFloorHeight);

    // Yönetmelik Sınırları İçin (Bodrum HARİÇ Bina Yüksekliği - 21.50m, 30.50m kontrolleri için)
    const regulationHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
        buildingStats.groundFloorHeight;

    switch (item.auto_source) {
        // --- YENİ EKLENEN CASE ---
        case 'calc_mortar_volume':
            return aggregatedUnitStats['mortar_volume'] || 0;
        case 'calc_adhesive_weight':
            return aggregatedUnitStats['adhesive_weight'] || 0;
        // ...
        // -------------------------
        // --- 1. PROJELENDİRME ---
        case 'calc_architectural':
            // Logic: >1000 m2 rule.
            if (totalConstructionArea > 1000) {
                return 1000 + (totalConstructionArea - 1000) * 0.8;
            }
            return totalConstructionArea;
        // ...

        case 'calc_satellite_system': {
            // 1. Projedeki Toplam Daire Sayısını Bul
            // 'calc_plumbing_unit' her daire için 1 değerini alır, toplamı daire sayısını verir.
            let totalApartments = aggregatedUnitStats['calc_unit_count'] || 0;

            // Eğer çizim/daire tanımlanmamışsa alan üzerinden tahmin et (100m2 = 1 daire kabulü)
            if (totalApartments === 0) {
                totalApartments = Math.ceil(totalConstructionArea / 100);
            }

            // 2. Katsayı Hesabı
            // Wix'ten gelen 'uydusistemi' fiyatı 10 dairelik paket fiyatıdır.
            const baseCapacity = 10;

            // 10 daire ve altı için: Katsayı 1 (Fiyat düşmez, sabit donanım maliyeti)
            // 10 daire üstü için: Orantılı artış (Multiswitch ve işçilik artışı)
            const factor = Math.max(1, totalApartments / baseCapacity);

            // 3. Nihai Fiyat
            // item.unit_price (Wix Fiyatı) * Katsayı
            return item.unit_price * factor;
        }

        case 'calc_inspection': {
            // 1. Daire sayısına göre Müstakil/Apartman tespiti
            let totalApartments = aggregatedUnitStats['calc_unit_count'] || 0;
            if (totalApartments === 0) {
                totalApartments = Math.ceil(totalConstructionArea / 100); // Çizim yoksa tahmini
            }
            const isDetached = totalApartments === 1; // Sadece 1 bağımsız bölüm varsa müstakildir.

            // 2. Yapı Sınıfını Belirle (Belgedeki Tabloya Göre)
            let buildingClass = "Yapı Sınıfı 3A";

            if (isDetached) {
                if (totalConstructionArea < 200) buildingClass = "Yapı Sınıfı 3B";
                else if (totalConstructionArea >= 200 && totalConstructionArea < 500) buildingClass = "Yapı Sınıfı 3C";
                else buildingClass = "Yapı Sınıfı 4B"; // 500 m2 ve üzeri
            } else {
                if (totalFloors <= 3) {
                    buildingClass = "Yapı Sınıfı 3A";
                } else if (regulationHeight < 21.50) {
                    buildingClass = "Yapı Sınıfı 3B";
                } else if (regulationHeight >= 21.50 && regulationHeight < 30.50) {
                    buildingClass = "Yapı Sınıfı 3C";
                } else if (regulationHeight >= 30.50 && regulationHeight < 51.50) {
                    buildingClass = "Yapı Sınıfı 4A";
                } else if (regulationHeight >= 51.50) {
                    buildingClass = "Yapı Sınıfı 4B";
                }
            }

            // 3. Wix'ten Gelen Güncel Birim Fiyatı Çek (Bulunamazsa varsayılanı kullanır)
            let classUnitPrice = 19800; // Fallback 3A
            if (currentCosts) {
                const resmiIdariCat = currentCosts.find(c => c.id === 'resmi_idari');
                if (resmiIdariCat) {
                    const classItem = resmiIdariCat.items.find(i => i.name === buildingClass);
                    if (classItem) classUnitPrice = classItem.unit_price;
                }
            }

            // 4. Hizmet Bedeli Oranı (İnşaat Süresine Göre)
            let serviceRate = 1.43;
            if (constructionDuration <= 12) serviceRate = 1.43;
            else if (constructionDuration <= 24) serviceRate = 1.50;
            else if (constructionDuration <= 36) serviceRate = 1.58;
            else if (constructionDuration <= 48) serviceRate = 1.65;
            else serviceRate = 1.74;

            // 5. Ana Formül: [ Alan x Birim Maliyet x (Hizmet Oranı / 100) ] x 1.20 KDV
            const totalInspectionCost = totalConstructionArea * classUnitPrice * (serviceRate / 100) * 1.20;

            return totalInspectionCost;
        }


        case 'calc_tapu_noter':
            const totalUnits = aggregatedUnitStats['calc_unit_count'] || (totalConstructionArea / 100); // Tahmini daire sayısı
            return calculateTapuNoterFees(
                totalUnits,
                buildingStats.province,
                buildingStats.constructionModel,
                buildingStats.isUrbanTransformation,
                currentCosts
            );

        case 'calc_acoustic':
            // Min price logic: Max(Area, MinCost/UnitPrice)
            // MinCost = SiteChiefSalary / 45 = 20000 / 45 = 444.44
            // UnitPrice is 3 (updated in cost_data).
            const minQty = 444.44 / (item.unit_price || 3);
            return Math.max(totalConstructionArea, minQty);


        case 'calc_gas_infrastructure': {
            const totalApartments = aggregatedUnitStats['calc_unit_count'] || 1;

            // Wix'ten gelen birim fiyatları çekme yardımcısı
            const getWixPrice = (itemName: string, fallback: number) => {
                if (!currentCosts) return fallback;
                for (const cat of currentCosts) {
                    const match = cat.items.find(i => i.name === itemName);
                    if (match) return match.unit_price;
                }
                return fallback;
            };

            // A. Birim Fiyatlar (Wix üzerinden)
            const verticalPipePrice = getWixPrice("Doğalgaz Kolon Hattı (mt) Birim", 2200);
            const connectionSetPrice = getWixPrice("Doğalgaz Daire Başı Set Birim", 3800);

            // B. Branşman Oranlaması
            // Branşman borusu (yatay), dikey kolonun ~%64'ü maliyetindedir (1400/2200 oranı korunur)
            const horizontalPipePrice = verticalPipePrice * 0.636;

            // C. Dikey Metraj (Bodrum Dahil)
            const verticalHeight =
                (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
                buildingStats.groundFloorHeight +
                (buildingStats.basementFloorCount * buildingStats.basementFloorHeight);
            const landSide = Math.sqrt(buildingStats.landArea || 0);
            const buildingSide = Math.sqrt(buildingStats.groundFloorArea || 0);
            const estimatedSetback = Math.max(3, (landSide - buildingSide) / 2); // Minimum 3m kuralı ile

            const totalVerticalMetres = verticalHeight + estimatedSetback;

            // D. Yatay Metraj (Kat Hollerine Göre)
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
        }

        case 'calc_gas_subscription': {
            // Müteahhit abonelik (daire başı bağlantı) bedelini ödemediği için,
            // formül sadece Wix'ten çekilen paket birim fiyatını döndürür.
            // Daire sayısıyla çarpım yapılmaz.
            return item.unit_price;
        }

        case 'calc_site_chief':
            // Miktar (metraj) alanında sadece proje inşaat süresi (Ay) görünecek
            return constructionDuration;

        case 'calc_breaker_machine': {
            if (buildingStats.soilType === 'hard') {
                // Hafriyat hacmini yeniden hesaplayın (veya calc_excavation'dan dönen değeri kullanın)
                // Ortalama bir ekskavatör+kırıcı saatte yaklaşık 10-15 m3 kaya kırabilir.
                // Hacim / 12 bize tahmini çalışma saatini verir.
                const excavationBaseArea = buildingStats.basementFloorCount > 0
                    ? buildingStats.basementFloorArea
                    : buildingStats.groundFloorArea;
                const depth = (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) + 1.0;

                const approxVolume = excavationBaseArea * depth;

                return Math.ceil(approxVolume / 12); // Saat döner
            }
            return 0; // Kaya değilse kırıcı kullanılmaz, maliyet 0 olur.
        }

        // --- 2. ŞANTİYE & HAFRİYAT ---
        case 'calc_fence': {
            if (buildingStats.buildingType === 'villa' && buildingStats.landArea > 0) {
                // Villalarda sınır duvarı yapılana kadar tüm arsa çevresi tel çit ile kapatılır
                return Math.sqrt(buildingStats.landArea) * 4;
            }
            // Mevcut apartman mantığı (Sadece temel etrafı)
            const side = Math.sqrt(buildingStats.groundFloorArea);
            return ((side + 8) * 2) + ((side + 6) * 2);
        }

        case 'calc_soil_investigation': {
            // currentCosts içinden ilgili fiyatları çek
            const resmiIdariCat = currentCosts?.find(c => c.id === 'resmi_idari');

            const getPrice = (name: string, fallback: number) => {
                return resmiIdariCat?.items.find(i => i.name === name)?.unit_price || fallback;
            };

            const subPrices = {
                sondaj_mt: getPrice("Zemin Sondaj Birim Fiyatı", 850),
                spt_adet: getPrice("SPT Deneyi Birim Fiyatı", 450),
                presiyometre_adet: getPrice("Presiyometre Deneyi Birim Fiyatı", 900),
                laboratuvar_paket: getPrice("Zemin Laboratuvar Paketi", 3500)
            };

            const groundArea = buildingStats.groundFloorArea || 0;
            return calculateSoilInvestigationPackage(groundArea, subPrices);
        }

        case 'calc_concrete_global': {
            let foundationArea = buildingStats.basementFloorCount > 0 ? buildingStats.basementFloorArea : buildingStats.groundFloorArea;
            let basePerim = buildingStats.basementFloorCount > 0
                ? (buildingStats.basementFloorPerimeter || Math.sqrt(foundationArea) * 4)
                : (buildingStats.groundFloorPerimeter || Math.sqrt(foundationArea) * 4);

            let raftHeight = 0.30;
            if (totalFloors >= 20) raftHeight = 2.00;
            else if (totalFloors >= 4) raftHeight = 0.40 + (totalFloors - 4) * 0.10;
            else if (totalFloors >= 3) raftHeight = 0.40;

            const ampatman = raftHeight * 1.5;
            // Prizma alan formülü adaptasyonu: A + (Çevre*A) + 4A^2
            const vTemel = (foundationArea + (ampatman * basePerim) + (4 * Math.pow(ampatman, 2))) * raftHeight;

            let vBodrumPerde = 0;
            if (buildingStats.basementFloorCount > 0) {
                const netPerimeter = basePerim + 1; // 1m kalıp payı vs
                const totalBasementHeight = buildingStats.basementFloorCount * buildingStats.basementFloorHeight;
                vBodrumPerde = netPerimeter * totalBasementHeight * 0.3; // 30cm Perde Kalınlığı
            }

            const vKatlar = aggregatedUnitStats['calc_concrete_unit'] !== undefined
                ? aggregatedUnitStats['calc_concrete_unit']
                : (totalConstructionArea * 0.26);

            const totalConcrete = vTemel + vBodrumPerde + vKatlar;
            return totalConcrete * (item.multiplier || 1);
        }

        case 'calc_pool_concrete': {
            // Sadece kullanıcı havuz alanı girdiyse m2 olarak döndür
            return buildingStats.poolArea || 0;
        }

        case 'calc_smart_home': {
            // Sadece villalarda standart olarak hesaplansın isteniyorsa:
            if (buildingStats.buildingType === 'villa') {
                // Wix'ten gelen bir baz fiyat varsa o çekilebilir (Örn: 150.000 TL baz fiyat)
                const baseSmartHomePrice = item.unit_price > 1 ? item.unit_price : 150000;

                // 150 m²'yi standart kabul edip, üzerindeki her m² için donanım/modül farkı ekleyebiliriz
                let areaMultiplier = 1.0;
                if (totalConstructionArea > 150) {
                    areaMultiplier = 1.0 + ((totalConstructionArea - 150) * 0.005); // Her m²'de binde 5 artış
                }

                return Math.round(baseSmartHomePrice * areaMultiplier);
            }
            return 0; // Villa değilse maliyet yansıtma (veya istenirse apartmanlar için de eklenebilir)
        }

        case 'calc_pool_system': {
            // Alan 0'dan büyükse 1 paket (sistem) yaz, yoksa 0 yaz
            if (buildingStats.poolArea && buildingStats.poolArea > 0) {
                return 1;
            }
            return 0;
        }

        case 'calc_villa_parking': {
            // Otopark alanı m2
            return buildingStats.parkingArea || 0;
        }

        case 'calc_villa_veranda': {
            // Veranda/Kış bahçesi alanı m2
            return buildingStats.verandaArea || 0;
        }

        case 'calc_haritaci': {
            // Wix'ten gelen 1000 m2 altı baz fiyat (Referans: 7471 TL)
            const baseP = item.unit_price || 7471;
            const landArea = buildingStats.landArea || 0;
            const unitCount = aggregatedUnitStats['calc_unit_count'] || Math.ceil(totalConstructionArea / 100);

            // --- 1. APLİKASYON BAREM KATSAYILARI ---
            let areaCoeff = 1.0; // 1.000 m2 altı
            if (landArea > 1000 && landArea <= 3000) areaCoeff = 1.4965;      // (11181 / 7471)
            else if (landArea > 3000 && landArea <= 5000) areaCoeff = 2.1322; // (15930 / 7471)
            else if (landArea > 5000 && landArea <= 10000) areaCoeff = 2.5894; // (19346 / 7471)
            else if (landArea > 10000 && landArea <= 20000) areaCoeff = 2.8143; // (21026 / 7471)
            else if (landArea > 20000) areaCoeff = 3.2251;                   // (24095 / 7471)

            const aplikasyonBedeli = baseP * areaCoeff;

            // --- 2. DİĞER KALEMLERİN BAZ FİYATA ORANI ---
            // Röperli Kroki Farkı (Maktu 3579 TL / 7471 TL ≈ 0.479)
            const roperliFarki = baseP * 0.479;

            // Plan Örneği (Maktu 540 TL / 7471 TL ≈ 0.072)
            const planOrnegiBedeli = baseP * 0.072;

            // --- TOPLAM HESAP ---
            // Yeni projede genelde hepsi (Aplikasyon + Röperli + Ünite Tespiti + Dosya) bir arada olur.
            const totalCost = aplikasyonBedeli + roperliFarki + planOrnegiBedeli;

            return totalCost;
        }

        case 'calc_villa_stairs': {
            if (buildingStats.buildingType === 'villa') {
                // Bodrumdan zemine ve zeminden normal katlara çıkan merdivenleri sayar.
                // Örn: Sadece Zemin katlı tek katlı bir villada 0 döner. Zemin + 1 Katta 1 döner.
                return buildingStats.normalFloorCount + buildingStats.basementFloorCount;
            }
            return 0;
        }

        case 'calc_facade_composite': {
            if (buildingStats.buildingType === 'villa') {
                // 1. Zemin katın dış cephe alanı (Zemin kat çevre uzunluğu * Zemin kat yüksekliği)
                const groundFloorFacadeArea = (buildingStats.groundFloorPerimeter || 0) * buildingStats.groundFloorHeight;

                // 2. Normal katların dış cephe alanı (Normal kat çevre uzunluğu * Normal kat yüksekliği * Normal kat sayısı)
                const normalFloorsFacadeArea = (buildingStats.normalFloorPerimeter || 0) * buildingStats.normalFloorHeight * buildingStats.normalFloorCount;

                // 3. Toplam brüt toprak üstü cephe alanı
                const grossFacadeArea = groundFloorFacadeArea + normalFloorsFacadeArea;

                // 4. Pencere ve kapı boşluklarını düş (Genelde %20 boşluk varsayılır)
                const netFacadeArea = grossFacadeArea * 0.80;

                // Cephenin yüzde kaçının (multiplier = 0.25) kaplanacağını hesapla
                return Math.round(netFacadeArea * (item.multiplier || 0.25));
            }
            return 0;
        }

        case 'calc_vrf_outdoor': {
            if (buildingStats.heatingSystem === 'vrf') {
                // Villalarda/Dairelerde genellikle 1 adet VRF ana dış ünite (Mini-VRF veya Maxi-VRF) kabul edilir.
                const totalUnits = aggregatedUnitStats['calc_unit_count'] || 1;
                return totalUnits;
            }
            return 0;
        }

        case 'calc_tower_crane_duration': {
            // 1. Gerekli Değişkenleri Hazırla
            const groundArea = buildingStats.groundFloorArea || 0;
            const totalFloors = buildingStats.basementFloorCount + buildingStats.normalFloorCount + 1; // +1 Zemin

            // 2. Gereklilik Kriterleri (Sizin belirttiğiniz şartlar)
            const needsCraneByArea = totalConstructionArea > 5000;
            const needsCraneByHeight = groundArea > 650 && totalFloors > 6;

            if (needsCraneByArea || needsCraneByHeight) {
                // 3. Süre Hesabı (Kule vinç genelde Kaba Yapı süresince gereklidir)
                // scheduleCalculator içindeki kaba yapı formülünü (kat başı 2.5 hafta) referans alalım
                const structureWeeks = Math.ceil(totalFloors * 2.5);
                const setupDismantleWeeks = 4; // Kurulum ve söküm için 1 ay tampon süre

                const totalWeeks = structureWeeks + setupDismantleWeeks;
                const months = Math.ceil(totalWeeks / 4.33); // Haftayı aya çevir

                return months;
            }

            // Şartlar sağlanmıyorsa süre 0 (maliyet yansımaz)
            return 0;
        }

        // src/utils/calculations.ts içindeki switch bloğuna eklenecek:

        // src/utils/calculations.ts içindeki calculateComplexGlobalQuantity fonksiyonuna ekleyin:
        case 'calc_ekb': {
            // 1. Wix'ten gelen güncel fiyatı baz al (Gelmezse 1500 TL kabul et)
            const wixPrice = item.unit_price || 1500;

            // 2. Katsayı (Scaling Factor): Formüller 1.500 TL baz alınarak yazıldığı için 
            // Wix fiyatı değiştikçe tüm baremleri aynı oranda kaydırıyoruz.
            const F = wixPrice / 1500;

            const A = totalConstructionArea;
            let totalUnits = aggregatedUnitStats['calc_unit_count'] || 0;
            if (totalUnits === 0) {
                totalUnits = Math.ceil(totalConstructionArea / 100); // Çizim yoksa tahmini
            }

            // --- A. ALAN BAZLI HESAPLAMA ---
            let costByArea = 0;
            if (A <= 600) {
                costByArea = 1500;
            } else if (A <= 1250) {
                costByArea = 1500 + (A - 600) * 1.154;
            } else if (A <= 2500) {
                costByArea = 2250 + (A - 1250) * 1.048;
            } else if (A <= 5000) {
                costByArea = 3560 + (A - 2500) * 0.826;
            } else if (A <= 10000) {
                costByArea = 7125 + (A - 7500) * 0.54;
            } else {
                // 10.000 m² ve üzeri için
                costByArea = 8475 + (A - 10000) * 0.45;
            }

            // --- B. DAİRE SAYISI BAZLI HESAPLAMA ---
            let costByUnits = 0;
            if (totalUnits <= 5) {
                costByUnits = 1500;
            } else if (totalUnits <= 10) {
                costByUnits = 1500 + (totalUnits - 5) * 150;
            } else if (totalUnits <= 20) {
                costByUnits = 2250 + (totalUnits - 10) * 131;
            } else if (totalUnits <= 40) {
                costByUnits = 3560 + (totalUnits - 20) * 102;
            } else if (totalUnits <= 60) {
                costByUnits = 5600 + (totalUnits - 40) * 75;
            } else {
                // 61-80 ve üzeri için
                costByUnits = 7100 + (totalUnits - 60) * 70;
            }

            // 3. İki hesaplamadan yüksek olanı seç ve Wix katsayısı ile çarp
            const finalEkbCost = Math.max(costByArea, costByUnits) * F;

            return Math.round(finalEkbCost);
        }



        case 'calc_utilities_subscription': {
            // A. Fiyatları currentCosts (Wix'ten gelen liste) içinden bul
            const getPrice = (name: string, fallback: number) => {
                const helper = currentCosts?.find(c => c.id === 'santiye_hafriyat')
                    ?.items.find(i => i.name === name);
                return helper?.unit_price || fallback;
            };

            const unitGuvenlikBedeli = getPrice("Elektrik Güvence Birim Bedeli", 746);
            const waterAndOtherFees = getPrice("Su Abonelik Paket Bedeli", 6500);

            // B. Elektrik Güvence Bedeli Hesabı
            // Güç Tahmini: 1000 m2 başına 12.5 kW
            const estimatedPowerKW = (totalConstructionArea / 1000) * 12.5;
            const electricityGuvence = estimatedPowerKW * unitGuvenlikBedeli;

            // C. Toplam Hesaplama ve Asgari Tutar Kontrolü
            const totalSubscription = electricityGuvence + waterAndOtherFees;

            // Belirttiğiniz "Asgari 12.000 TL" kuralı uygulanır
            return Math.round(Math.max(12000, totalSubscription));
        }

        case 'calc_land_tax': {
            // 1. Kullanıcının girdiği "Arsa Rayiç Bedeli" değerini maliyet listesinden çek
            let landValue = 0;
            const arsaCat = currentCosts?.find(c => c.id === 'arsa_finansman');
            const arsaItem = arsaCat?.items.find(i => i.name === "Arsa Rayiç Bedeli (Maliyet)");

            if (arsaItem) {
                // Kullanıcı manuel fiyat girdiyse onu kullan, yoksa birim fiyatı al
                landValue = arsaItem.manualPrice !== undefined ? arsaItem.manualPrice : arsaItem.unit_price;
            }

            // Değer girilmemişse (0 ise) vergi hesaplanmaz
            if (landValue <= 0) return 0;

            // 2. Büyükşehir kontrolü (Büyükşehirlerde Arsa Vergisi binde 6, diğerlerinde binde 3'tür)
            const bigCities = [
                'Adana', 'Ankara', 'Antalya', 'Aydın', 'Balıkesir', 'Bursa', 'Denizli', 'Diyarbakır',
                'Erzurum', 'Eskişehir', 'Gaziantep', 'Hatay', 'İstanbul', 'İzmir', 'Kahramanmaraş',
                'Kayseri', 'Kocaeli', 'Konya', 'Malatya', 'Manisa', 'Mardin', 'Mersin', 'Muğla',
                'Ordu', 'Sakarya', 'Samsun', 'Şanlıurfa', 'Tekirdağ', 'Trabzon', 'Van'
            ];

            const isBigCity = bigCities.includes(buildingStats.province);
            const annualRate = isBigCity ? 0.006 : 0.003;

            // 3. İnşaat Süresine Göre Toplam Vergi Yükü
            // Formül: Rayiç Bedel x Yıllık Oran x (İnşaat Süresi Ay / 12)
            const durationYears = constructionDuration / 12;
            const totalTax = landValue * annualRate * durationYears;

            return Math.round(totalTax);
        }

        case 'calc_fire_escape': {
            // 1. Sistemdeki güncel "İnşaat Demiri" ton fiyatını bulalım
            const ironItem = currentCosts?.find(c => c.id === 'kaba_insaat')
                ?.items.find(i => i.name === "İnşaat Demiri");
            const ironPricePerTon = ironItem?.unit_price || 30000; // Bulunamazsa 30k baz alınır

            // 21.50m altı yapılarda yangın merdiveni zorunlu olmayabilir (Yönetmelik Madde 38)
            if (regulationHeight <= 21.50) return 0;

            // 3. PARAMETRELER:
            const steelWeightPerFloor = 1.5; // Kat başına ortalama 1.5 ton çelik (Z-merdiven + sahanlık)
            const workmanshipFactor = 1.45;  // Kesim, büküm, boya ve montaj için %45 işçilik payı

            const fireDoorItem = currentCosts?.find(c => c.id === 'dis_cephe')?.items.find(i => i.name === "Yangın Kapısı (Adet)");
            const fireDoorPrice = fireDoorItem?.unit_price || 18000;

            // 4. HESAPLAMA: [(Demir Fiyatı * Ağırlık) * İşçilik] + Kapı Maliyeti
            const costPerFloor = (ironPricePerTon * steelWeightPerFloor * workmanshipFactor) + fireDoorPrice;

            // Toplam Kat Sayısı (Zemin + Normal Katlar)
            const totalFloors = buildingStats.normalFloorCount + 1;

            let totalEscapeCost = totalFloors * costPerFloor;

            // Yüksek Yapı Farkı: Bina 30.50 metreyi geçerse yönetmelik gereği genişlik 
            // ve malzeme şartları ağırlaştığı için maliyeti %25 artırıyoruz.
            if (regulationHeight > 30.50) {
                totalEscapeCost *= 1.25;
            }

            return totalEscapeCost;
        }

        case 'calc_tower_crane_setup': {
            const groundArea = buildingStats.groundFloorArea || 0;
            const totalFloors = buildingStats.basementFloorCount + buildingStats.normalFloorCount + 1;

            // Eğer vinç gerekliyse 1 paket (true), değilse 0 döner
            return needsTowerCrane(totalConstructionArea, groundArea, totalFloors) ? 1 : 0;
        }

        case 'calc_demolition_supervisor': {
            // DÜZELTME: Yıkılacak bina varsa, Kentsel Dönüşüm olsun veya olmasın 
            // Teknik Sorumlu (mühendis/mimar) atama zorunluluğu vardır.
            if (buildingStats.hasExistingBuilding) {
                let siteChiefMonthlyFee = 90000; // Fallback
                if (currentCosts) {
                    const idariCat = currentCosts.find(c => c.id === 'resmi_idari');
                    const chiefItem = idariCat?.items.find(i => i.name === 'Şantiye Şefi (Aylık)');
                    if (chiefItem) {
                        siteChiefMonthlyFee = chiefItem.unit_price;
                    }
                }
                // Şantiye şefi maaşının 5'te 1'i olarak hesaplanır
                return siteChiefMonthlyFee / 5;
            }
            return 0;
        }

        case 'calc_demolition_area': {
            // Yıkılacak bina varsa VE Kentsel Dönüşüm Kapsamında DEĞİLSE
            if (buildingStats.hasExistingBuilding && !buildingStats.isUrbanTransformation) {
                // Bina alanı girilmemişse tahmini inşaat alanının %50'si kadar bir taban oturduğunu varsayalım (Fallback)
                const existingArea = buildingStats.existingArea || (totalConstructionArea * 0.5);

                // item.unit_price API'den çekilen "yikimruhsatim2fiyatpaket" m2 bedelidir.
                // Paket fiyat (Toplam) göstermek için Alan x m2Fiyat döndürüyoruz.
                return existingArea * item.unit_price;
            }
            return 0;
        }

        case 'calc_cctv_system': {
            // Villalarda standart donanım, apartmanlarda ise site konsepti (örn: >10 daire) ise 1 paket yansıtılır.
            let totalUnits = aggregatedUnitStats['calc_unit_count'] || 0;
            if (buildingStats.buildingType === 'villa' || totalUnits > 10) {
                return 1;
            }
            return 0;
        }

        case 'calc_mobile_crane_days': {
            const groundArea = buildingStats.groundFloorArea || 0;
            const totalFloors = buildingStats.basementFloorCount + buildingStats.normalFloorCount + 1;

            // Eğer kule vinç VARSA, mobil vinç ihtiyacı (günlük bazda) 0'dır
            if (needsTowerCrane(totalConstructionArea, groundArea, totalFloors)) {
                return 0;
            }

            // Kule vinç YOKSA şantiye girdilerine göre gün hesabı:
            // Mantık: Temel için 3 gün + Her katın demir ve kalıp sevkiyatı için 1.5 gün
            const foundationDays = 3;
            const daysPerFloor = 1.5;

            const totalDays = foundationDays + (totalFloors * daysPerFloor);

            // Alan çarpanı: Her 500m2'lik kat alanı için gün sayısını %20 artır (isteğe bağlı hassasiyet)
            const areaFactor = Math.max(1, groundArea / 500);

            return Math.ceil(totalDays * areaFactor);
        }

        case 'calc_iron_global': {
            const ironCoeff = getIronCoefficient(buildingStats.earthquakeZone);

            const ironKatlar = aggregatedUnitStats['calc_iron_unit'] !== undefined
                ? aggregatedUnitStats['calc_iron_unit']
                : ((totalConstructionArea * 0.26) * ironCoeff);

            let foundationArea = buildingStats.basementFloorCount > 0 ? buildingStats.basementFloorArea : buildingStats.groundFloorArea;
            let basePerim = buildingStats.basementFloorCount > 0
                ? (buildingStats.basementFloorPerimeter || Math.sqrt(foundationArea) * 4)
                : (buildingStats.groundFloorPerimeter || Math.sqrt(foundationArea) * 4);

            let raftHeight = 0.30;
            if (totalFloors >= 20) raftHeight = 2.00;
            else if (totalFloors >= 4) raftHeight = 0.40 + (totalFloors - 4) * 0.10;
            else if (totalFloors >= 3) raftHeight = 0.40;

            const ampatman = raftHeight * 1.5;
            const vTemel = (foundationArea + (ampatman * basePerim) + (4 * Math.pow(ampatman, 2))) * raftHeight;

            let vBodrumPerde = 0;
            if (buildingStats.basementFloorCount > 0) {
                const netPerimeter = basePerim + 1;
                const totalBasementHeight = buildingStats.basementFloorCount * buildingStats.basementFloorHeight;
                vBodrumPerde = netPerimeter * totalBasementHeight * 0.3;
            }

            const ironTemelPerde = (vTemel + vBodrumPerde) * ironCoeff;
            return (ironKatlar + ironTemelPerde) * (item.multiplier || 1);
        }

        case 'calc_rainwater_system': {
            // Yönetmelik: Arsa alanı >= 2000m2 ise zorunlu
            if (buildingStats.landArea >= 2000) {
                // Çatı alanına (normalFloorArea) göre kapasite çarpanı
                const roofArea = buildingStats.normalFloorArea;
                const systemMultiplier = Math.max(1, roofArea / 500);

                // Wix'ten gelen 2000lt paket fiyatını çarpanla genişletip toplam fiyat olarak döner
                return item.unit_price * systemMultiplier;
            }
            return 0;
        }

        case 'calc_excavation': {
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

            const excavationDepth = (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) + 1.0;

            // Her kademede genişleyen prizmanın alt ve üst alanlarını çevreden faydalanarak doğru hesaplayan yardımcı formül:
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

                    // Kesik piramit formülü: (h / 3) * (A1 + A2 + √(A1 * A2))
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

            return totalExcavationVolume * item.multiplier * 1.25; // %25 kabarma payı
        }

        // --- 8. MEKANİK (Radyatör & Isıtma) ---
        case 'calc_radiator_mt': {
            // 1. DETAYLI MOD: Eğer kullanıcı odaları/birimleri girmişse, 
            // calculateUnitCost'tan gelen hazır toplamı kullan.
            if (aggregatedUnitStats && aggregatedUnitStats['radiator_length'] > 0) {
                return aggregatedUnitStats['radiator_length'] * item.multiplier;
            }

            // 2. GLOBAL/OTO MOD: Çizim yoksa bina hacmi üzerinden tahmin et.
            const zone = buildingStats.heatZone || 2;

            // Duvar malzemesini hesaba kat
            let materialHeatFactor = 1.0;
            if (globalWallMaterial === 'gazbeton') materialHeatFactor = 0.85;
            else if (globalWallMaterial === 'bims') materialHeatFactor = 0.92;

            const hLossFactor = (30 + (zone * 5)) * materialHeatFactor;

            // Zemin ve Normal katların net hacimlerini topla
            const hG = buildingStats.groundFloorHeight || buildingStats.normalFloorHeight;
            const volG = buildingStats.groundFloorArea * (hG - 0.12);
            const volN = buildingStats.normalFloorArea * (buildingStats.normalFloorHeight - 0.12) * buildingStats.normalFloorCount;

            // Isıtılan net hacim kabulü (%75)
            const totalVolNet = (volG + volN) * 0.75;

            return (totalVolNet * hLossFactor / 1455) * item.multiplier;
        }

        case 'calc_steel_door': {
            return 1
        }

        case 'calc_garden_wall': {
            const landArea = buildingStats.landArea || 0;
            if (landArea <= 0) return 0;

            // Villa ise tam müstakil kabul edilip 4 kenar çevrilir. Diğerlerinde 3 kenar ortalaması alınır.
            const multiplier = buildingStats.buildingType === 'villa' ? 4 : 3;
            const landPerimeter = Math.sqrt(landArea) * multiplier;

            return landPerimeter * (item.multiplier || 1);
        }

        case 'calc_radiator': {
            // 1. DETAYLI MOD: Eğer kullanıcı odaları/birimleri girmişse ve
            // calculateUnitCost fonksiyonu 'radiator_length' hesaplamışsa bunu kullan.
            if (aggregatedUnitStats && aggregatedUnitStats['radiator_length'] > 0) {
                return aggregatedUnitStats['radiator_length'] * item.multiplier;
            }

            const zone = buildingStats.heatZone || 2;

            // Duvar malzemesini hesaba kat
            let materialHeatFactor = 1.0;
            if (globalWallMaterial === 'gazbeton') materialHeatFactor = 0.85;
            else if (globalWallMaterial === 'bims') materialHeatFactor = 0.92;

            const hLossFactor = (30 + (zone * 5)) * materialHeatFactor;

            // Zemin ve Normal katların net hacimlerini topla
            // (Kat yüksekliğinden yaklaşık 12cm döşeme kalınlığı düşülür)
            const hG = buildingStats.groundFloorHeight || buildingStats.normalFloorHeight;
            const volG = buildingStats.groundFloorArea * (hG - 0.12);

            const volN = buildingStats.normalFloorArea * (buildingStats.normalFloorHeight - 0.12) * buildingStats.normalFloorCount;

            // Isıtılan net hacim kabulü (%75 - koridor, şaft vb. boşluklar düşülür)
            const totalVolNet = (volG + volN) * 0.75;

            // Radyatör Metraj Hesabı: (Hacim * IsıKaybı) / 1455 (Panel radyatör ısıl verim katsayısı)
            const calculatedMeters = (totalVolNet * hLossFactor) / 1455;

            // cost_data.ts içindeki çarpan ile sonucu döndür.
            // Örnek: 'Panel Radyatör' için multiplier 1'dir -> Metreyi döndürür.
            // Örnek: 'Radyatör Montajı' için multiplier 0.5'tir -> Adeti (yaklaşık) döndürür.
            return calculatedMeters * item.multiplier;
        }

        case 'calc_formwork_global': {
            const formKatlar = aggregatedUnitStats['calc_formwork_unit'] !== undefined
                ? aggregatedUnitStats['calc_formwork_unit']
                : (totalConstructionArea * 2.6);

            let foundationArea = buildingStats.basementFloorCount > 0 ? buildingStats.basementFloorArea : buildingStats.groundFloorArea;
            let basePerim = buildingStats.basementFloorCount > 0
                ? (buildingStats.basementFloorPerimeter || Math.sqrt(foundationArea) * 4)
                : (buildingStats.groundFloorPerimeter || Math.sqrt(foundationArea) * 4);

            let raftHeight = 0.30;
            if (totalFloors >= 20) raftHeight = 2.00;
            else if (totalFloors >= 4) raftHeight = 0.40 + (totalFloors - 4) * 0.10;
            else if (totalFloors >= 3) raftHeight = 0.40;

            const ampatman = raftHeight * 1.5;
            const extendedPerimeter = basePerim + (8 * ampatman); // Genişletilmiş çevre
            const formTemel = extendedPerimeter * raftHeight;

            let formBodrumPerde = 0;
            if (buildingStats.basementFloorCount > 0) {
                const netPerimeter = basePerim + 1;
                const totalBasementHeight = buildingStats.basementFloorCount * buildingStats.basementFloorHeight;
                formBodrumPerde = netPerimeter * totalBasementHeight * 2; // Çift taraflı
            }

            return (formKatlar + formTemel + formBodrumPerde) * (item.multiplier || 1);
        }

        case 'calc_roof':
            if (buildingStats.buildingType === 'villa') {
                // Villalarda zemine veya normal kata oturan en geniş alanı al ve %55 saçak/eğim payı ekle
                const nArea = buildingStats.normalFloorCount > 0 ? buildingStats.normalFloorArea : 0;
                const maxArea = Math.max(nArea, buildingStats.groundFloorArea);
                return maxArea * 1.55;
            }
            // Apartmanlarda standart normal kat iz düşümü %45 pay
            return (buildingStats.normalFloorArea) * 1.45;

        // --- 4. DUVAR & CEPHE ---
        case 'calc_wall_global':
            // Total Area * Height / 3
            return (totalConstructionArea * buildingStats.normalFloorHeight) / 3.0;

        case 'calc_facade': {
            if (buildingStats.buildingType === 'villa') {
                // Villalarda zemin kat ve normal kat cephe alanlarını ayrı toplayın
                const groundPerim = buildingStats.groundFloorPerimeter || (Math.sqrt(buildingStats.groundFloorArea) * 4);
                const groundFacade = groundPerim * buildingStats.groundFloorHeight;

                const normalPerim = buildingStats.normalFloorPerimeter || (Math.sqrt(buildingStats.normalFloorArea) * 4);
                const normalFacade = normalPerim * buildingStats.normalFloorHeight * buildingStats.normalFloorCount;

                const facadeWaste = calculateWasteFactor([], buildingStats.groundFloorArea, groundPerim);

                return (groundFacade + normalFacade) * facadeWaste;
            } else {
                // Mevcut Apartman Mantığı
                const facadeHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
                    buildingStats.groundFloorHeight;
                const perim = buildingStats.normalFloorPerimeter || (Math.sqrt(buildingStats.normalFloorArea) * 4);
                const facadeWaste = calculateWasteFactor([], buildingStats.normalFloorArea, perim);
                return perim * facadeHeight * facadeWaste;
            }
        }
        // src/utils/calculations.ts içindeki calculateComplexGlobalQuantity switch bloğuna ekleyin:

        case 'calc_hard_ground': {
            const landArea = buildingStats.landArea || 0;
            const footprintArea = buildingStats.groundFloorArea || 0; // Zemin kat alanı

            if (landArea <= 0 || footprintArea <= 0) return 0;

            // Kare form kabulü ile kenar uzunlukları hesabı
            const landSide = Math.sqrt(landArea);
            const footprintSide = Math.sqrt(footprintArea);

            // Binayı bir kenara yasladığımızda kalan mesafe (Yol uzunluğu)
            const pathLength = Math.max(0, landSide - footprintSide);

            // 2 metre genişlik kriterine göre toplam alan
            const hardGroundArea = pathLength * 2;

            return hardGroundArea * (item.multiplier || 1);
        }
        // --- 8. MEKANİK ---
        case 'calc_elevator': {
            if (buildingStats.buildingType === 'villa') {
                return 0
            }
            // 1. Kullanıcı elle asansör adeti girdiyse onu baz al
            if (item.manualQuantity !== undefined && item.manualQuantity > 0) {
                return item.manualQuantity;
            }

            // 2. Elle girilmediyse yönetmeliğe göre otomatik hesapla
            let count = 0;
            if (totalFloors > 3 || totalConstructionArea > 800) count = 1;
            if (totalFloors > 10 || totalConstructionArea > 2000) count = 2;

            return count;
        }


        case 'calc_greywater_system': {
            // Yönetmelik: Toplam inşaat alanı > 30.000m2 ise zorunlu
            if (totalConstructionArea >= 30000) {
                const scaleFactor = totalConstructionArea / 30000;
                return item.unit_price * scaleFactor;
            }
            return 0;
        }

        case 'calc_fire_system': {

            // Bina 21.5 metreyi geçerse her kata (veya 1000m2'ye bir) yangın dolabı gerekir
            if (regulationHeight > 21.50) {
                const totalFloors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;
                // Her kata en az 1 yangın dolabı + ana pompa istasyonu payı
                return item.unit_price * totalFloors;
            }
            return 0;
        }

        // --- 10. PEYZAJ ---
        case 'calc_tree_count': {
            // 1. Bina Oturum Alanı (Taban Alanı = Zemin Kat Alanı olarak kabul ediyoruz)
            const footprintArea = buildingStats.groundFloorArea || 0;

            // 2. Net Açık Alan (Arsa Alanından, binanın oturduğu alanı çıkarıyoruz)
            const openArea = Math.max(0, buildingStats.landArea - footprintArea);

            // 3. Ağaç Sayısı (Açık alan / 30, çıkan sonucu yukarı yuvarla - küsuratlar tam ağaç sayılır)
            const treeCount = Math.ceil(openArea / 30.0);

            return treeCount * (item.multiplier || 1);
        }

        case 'calc_water_tank': {
            // 1. Gerçek daire sayısını al (Tahmin yerine)
            let totalUnits = aggregatedUnitStats['calc_unit_count'] || Math.ceil(totalConstructionArea / 100);

            // 3. Yönetmelik Madde 36/1 - Temel Kapasite Hesabı
            let requiredVolume = 3; // Minimum 3 m3 (10 daireye kadar)
            if (totalUnits > 10) {
                requiredVolume += (totalUnits - 10) * 0.50; // 10 daireden sonra her daire için 0.5 m3
            }

            // 4. Yüksek Yapı Şartı (Taban kapasite ezilir)
            if (regulationHeight >= 30.50) {
                requiredVolume = Math.max(requiredVolume, 30); // Çok yüksek bina: Min 30 m3
            } else if (regulationHeight >= 21.50) {
                requiredVolume = Math.max(requiredVolume, 15); // Yüksek bina: Min 15 m3
            }

            // Fiyatlandırma: unit_price 1 m3 fiyatı olarak tanımlanmalı (cost_data.ts güncellenmeli)
            // Şimdilik eski mantık 2m3'lük paket fiyatı varsayıyorsa:
            return item.unit_price * (requiredVolume / 2);
        }

        case 'calc_hydrophore': {
            let totalUnits = aggregatedUnitStats['calc_unit_count'] || Math.ceil(totalConstructionArea / 100);
            const totalFloors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;

            // Daire sayısı arttıkça su tüketim debisi artar (Her 10 daire için maliyet çarpanı yükselir)
            const unitCapacityFactor = Math.max(1, totalUnits / 10);

            // Kat sayısı arttıkça basınç (basma yüksekliği) ihtiyacı artar
            const heightFactor = Math.max(1, totalFloors / 5);

            // Fiyat = Wix'ten Gelen Temel Paket Fiyatı * Debi Çarpanı * Basınç Çarpanı
            return item.unit_price * unitCapacityFactor * heightFactor;
        }

        // --- 6. ZEMİN ---
        case 'calc_stairs':
            if (buildingStats.buildingType === 'villa') {
                return 0
            }
            // Steps = Height / 0.17
            return totalBuildingHeight / 0.17;

        case 'calc_rent_assistance': {
            // Sadece "Kira Masraflarını Ekle" seçiliyse hesapla
            if (buildingStats.includeRentCost) {
                const unitCount = buildingStats.existingUnitCount || 0;
                const monthlyRent = buildingStats.monthlyRentPerUnit || 0;

                // Mevcut Daire Sayısı X Aylık Net Kira X Toplam İnşaat Süresi (Ay)
                return unitCount * monthlyRent * constructionDuration;
            }
            return 0;
        }

        case 'calc_eviction_cost': {
            if (buildingStats.includeRentCost) {
                const unitCount = buildingStats.existingUnitCount || 0;
                const evictionCost = buildingStats.evictionCostPerUnit || 0;

                // Mevcut Daire Sayısı X Daire Başı Taşınma Yardımı (Gidiş-Dönüş hesaplanıyorsa kullanıcı bu değere 2 taşınma parası girmelidir)
                return unitCount * evictionCost;
            }
            return 0;
        }

        case 'calc_osgb_service': {
            // OSGB aylık ödenir. Temel süre inşaat süresidir (constructionDuration).
            // Ancak proje alanı büyüdükçe C sınıfı, B sınıfı ve A sınıfı uzman/hekim saat zorunluluğu artar.
            // 2000 m2'ye kadar 1 çarpan, sonrası için orantılı artış kabul edelim.
            let sizeFactor = 1.0;
            if (totalConstructionArea > 2000) {
                sizeFactor = 1.0 + ((totalConstructionArea - 2000) / 4000); // Her 4000m2'de fiyat %100 artar
            }
            return constructionDuration * sizeFactor;
        }

        case 'calc_isg_package': {
            // Şantiyedeki uyarı levhaları, baret, yelek, emniyet kemeri, ilk yardım dolabı vb.
            // Temel bir paket fiyatı baz alınır. İnşaat alanı arttıkça çalışan sayısı artacağından paket katlanır.
            const baseWorkers = 10; // 1000m2'ye kadar 10 kişi kabulü
            const estimatedWorkers = Math.max(baseWorkers, Math.ceil(totalConstructionArea / 100));

            // Wix'teki paket fiyatı 10 kişilik bir set ise:
            return estimatedWorkers / baseWorkers;
        }

        case 'calc_safety_net': {
            if (buildingStats.normalFloorCount === 0) return 0;
            const facadeHeight = buildingStats.normalFloorCount * buildingStats.normalFloorHeight;
            const basePerim = buildingStats.normalFloorPerimeter || (Math.sqrt(buildingStats.normalFloorArea) * 4);
            const netPerimeter = basePerim + 8; // (Her kenara 2 metre çalışma payı eklendiğinden çevre +8m artar)
            return facadeHeight * netPerimeter;
        }

        case 'calc_well_foundation_excavation':
        case 'calc_well_foundation_concrete':
        case 'calc_well_foundation_iron':
        case 'calc_well_foundation_formwork': {
            if (!buildingStats.hasWellFoundation) return 0;

            let faceArea = buildingStats.wellFoundationArea || 0;
            if (faceArea <= 0) {
                const depth = buildingStats.basementFloorCount * (buildingStats.basementFloorHeight || 3);
                if (depth > 0) {
                    const baseArea = buildingStats.basementFloorArea || buildingStats.groundFloorArea || 0;
                    const basePerimeter = buildingStats.basementFloorCount > 0
                        ? (buildingStats.basementFloorPerimeter || Math.sqrt(baseArea) * 4)
                        : (buildingStats.groundFloorPerimeter || Math.sqrt(baseArea) * 4);
                    faceArea = (basePerimeter / 2) * depth;
                }
            }

            // Eğer hesaplanan bir alan yoksa 0 dön.
            if (faceArea <= 0) return 0;

            const THICKNESS = 0.80; // Kuyu temel ortalama 80 cm kalınlık kabulü

            // 2. İlgili kaleme göre metraj döndür
            if (item.auto_source === 'calc_well_foundation_concrete') {
                // Beton Hacmi (m3) = Alan x Kalınlık
                return faceArea * THICKNESS;
            }
            else if (item.auto_source === 'calc_well_foundation_iron') {
                // Demir Miktarı (ton) = Beton Hacmi x Yoğunluk (Kuyu temelde yaklaşık 120kg/m3)
                const volume = faceArea * THICKNESS;
                return volume * 0.120;
            }
            else if (item.auto_source === 'calc_well_foundation_formwork') {
                // Kalıp Alanı (m2) = Sadece iç yüzeye kalıp çakılır (Toprak yüzeye çakılmaz)
                return faceArea;
            }
            else if (item.auto_source === 'calc_well_foundation_excavation') {
                // Kazı Hacmi (m3): Kuyu temeli genellikle 1 metre - 1.20 metre genişlikte kazılır. 
                // Çalışma payı ile birlikte Alan x 1.2 metre kazı hacmi kabulü yapılır.
                return faceArea * 1.20;
            }
            return 0;
        }


        case 'calc_stairs_railing': {
            if (buildingStats.buildingType === 'villa') {
                return 0
            }
            // Railing = Steps * Hypotenuse(0.17, 0.28)
            const stepCount = totalBuildingHeight / 0.17;
            const stepHypot = Math.hypot(0.17, 0.28); // Approx 0.327m
            return stepCount * stepHypot;
        }

        // --- MERMER HARCI VE KUMU HESABI ---
        case 'calc_marble_mortar': {
            if (buildingStats.buildingType === 'villa') {
                return 0
            }
            // 1. Basamakların Alanı: (Adet x Ortalama 0.45 m2/basamak)
            const stepCount = totalBuildingHeight / 0.17;
            const stairsArea = stepCount * 0.45;

            // 2. Sahanlık ve Hol Alanı (Bir önceki adımda eklediğimiz mantık)
            const normalHall = buildingStats.normalFloorCount * Math.max(0, buildingStats.normalFloorHallArea || 0);
            const groundHall = Math.max(0, buildingStats.groundFloorHallArea || 0);
            const basementHall = buildingStats.basementFloorCount * Math.max(0, buildingStats.basementFloorHallArea || 0);
            const totalHallArea = normalHall + groundHall + basementHall;

            // 3. Toplam Alan
            const totalMarbleArea = stairsArea + totalHallArea;

            // 4. Harç Hacmi (m3): Ortalama 4 cm (0.04m) yatak harcı kalınlığı varsayımıyla
            return totalMarbleArea * 0.04;
        }


        // --- YENİ EKLENEN SAHANLIK/HOL ALANI HESABI ---
        case 'calc_hall_area': {
            if (buildingStats.buildingType === 'villa') {
                return 0; // Villada ortak alan / kat holü mermeri olmaz, zemin kaplamalarına dahildir.
            }
            const normalHall = buildingStats.normalFloorCount * Math.max(0, buildingStats.normalFloorHallArea || 0);
            const groundHall = Math.max(0, buildingStats.groundFloorHallArea || 0);
            const basementHall = buildingStats.basementFloorCount * Math.max(0, buildingStats.basementFloorHallArea || 0);

            return (normalHall + groundHall + basementHall) * (item.multiplier || 1);
        }

        case 'calc_jcb':
            const baseHours = 40; // Şantiye kurulumu ve temel hazırlığı (sabit)
            const floorHours = totalFloors * 4; // Her katın demir/kalıp sevkiyatında indirme işleri (ortalama 4 saat)
            const landscapeHours = totalConstructionArea * 0.02; // Dış saha dolgusu ve çevre düzenleme (m2 başına 0.02 saat)

            return baseHours + floorHours + landscapeHours;

        case 'calc_container_complex':
            // 0 - 2000 m2 arası: 1 Adet
            if (totalConstructionArea <= 2000) {
                return 1.0;
            }
            // 2000 - 5000 m2 arası: 2 Adet (İsteğiniz üzerine 2000 üzeri 2 adet)
            else if (totalConstructionArea <= 5000) {
                return 2.0;
            }
            // 5000 m2 üzeri: 3 Adet
            else {
                return 3.0;
            }

        case 'calc_drainage': {
            let foundationArea = buildingStats.basementFloorCount > 0
                ? buildingStats.basementFloorArea
                : buildingStats.groundFloorArea;

            let basePerim = buildingStats.basementFloorCount > 0
                ? (buildingStats.basementFloorPerimeter || Math.sqrt(foundationArea) * 4)
                : (buildingStats.groundFloorPerimeter || Math.sqrt(foundationArea) * 4);

            let raftHeight = 0.30;
            if (totalFloors >= 20) raftHeight = 2.00;
            else if (totalFloors >= 4) raftHeight = 0.40 + (totalFloors - 4) * 0.10;
            else if (totalFloors >= 3) raftHeight = 0.40;

            const ampatman = raftHeight * 1.5;
            const foundationPerimeter = basePerim + (8 * ampatman);

            return foundationPerimeter + 5;
        }

        case 'calc_duration_months':
            // Basitçe inşaat süresini döndürür (Araç, Personel, Elektrik vb. aylık giderler için)
            return constructionDuration;

        // --- İSKELE HESAPLARI (Wix'ten) ---

        case 'calc_foundation_area': {
            // Taban oturum alanını bul: Bodrum varsa bodrum alanı, yoksa zemin kat alanı
            const foundationArea = buildingStats.basementFloorCount > 0
                ? buildingStats.basementFloorArea
                : buildingStats.groundFloorArea;

            // cost_data.ts'teki multiplier: 1.1 çarpanı, 
            // ampatman ve yan yalıtım dönüşleri için %10'luk bir pay bırakır.
            // Bu yüzden buradan sadece net taban alanını döndürmek yeterlidir.
            return foundationArea;
        }

        case 'calc_scaffolding_area': {
            const facadeHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
                buildingStats.groundFloorHeight;
            const basePerim = buildingStats.groundFloorPerimeter || (Math.sqrt(buildingStats.groundFloorArea) * 4);
            const scaffoldingPerimeter = basePerim + 16; // Her köşeden dışarı 2m pay çevreye +16 yansır
            return facadeHeight * scaffoldingPerimeter;
        }

        case 'calc_scaffolding_duration':
            // Wix Formülü: insaatsure * 0.3
            // Mantık: İnşaat süresinin %30'u kadar süre iskele kalır.
            return constructionDuration * 0.3;

        default:
            return 0;
    }
};

/**
 * Toplam inşaat alanına göre yapım süresini (ay) hesaplar.
 */
export const calculateConstructionDuration = (totalArea: number): number => {
    let duration = 0;
    if (totalArea <= 1000) {
        duration = 12;
    } else if (totalArea <= 3000) {
        duration = (0.006 * totalArea) + 6;
    } else {
        duration = Math.sqrt(totalArea) / 2.28;
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
    if (item.name.startsWith("Duvar Malzemesi (") || item.name.startsWith("Duvar İşçiliği (")) {
        const match = item.name.match(/\(([\d\.]+) cm\)/);
        if (match && currentCosts && globalWallMaterial) {
            const thickness = parseFloat(match[1]);
            const wallCat = currentCosts.find(c => c.id === 'duvar_tavan');

            const matItemName = globalWallMaterial === 'gazbeton' ? "Gazbeton Blok (m3)" :
                globalWallMaterial === 'tugla' ? "Tuğla Blok (m3)" : "Bims Blok (m3)";

            const laborItemName = globalWallMaterial === 'gazbeton' ? "Gazbeton İşçiliği (m2)" :
                globalWallMaterial === 'tugla' ? "Tuğla İşçiliği (m2)" : "Bims İşçiliği (m2)";

            const matItem = wallCat?.items.find(i => i.name === matItemName);
            const laborItem = wallCat?.items.find(i => i.name === laborItemName);

            const baseMatPrice = matItem ? matItem.unit_price : 2650;
            const baseLaborPrice = laborItem ? laborItem.unit_price : 250;

            if (item.name.startsWith("Duvar Malzemesi")) {
                // Kalınlığı (cm) metreye çevirerek m3 fiyatı ile çarpıp m2 fiyatı buluyoruz.
                return Math.round(baseMatPrice * (thickness / 100));
            } else {
                // İşçilik 15cm için referans alınmıştır, kalınlık oranına göre hareketlendirilir.
                return Math.round(baseLaborPrice * (thickness / 15));
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
        if (currentCosts) {
            // Kaba inşaat kategorisinden donatı fiyatını bul
            const kabaInsaatCat = currentCosts.find(c => c.id === 'kaba_insaat');
            const ironItem = kabaInsaatCat?.items.find(i => i.name === "İnşaat Demiri");

            if (ironItem) {
                // Ton fiyatını kg fiyatına çevir (Örn: 32.000 TL / 1000 = 32 TL/kg)
                const ironKgPrice = (ironItem.manualPrice !== undefined ? ironItem.manualPrice : ironItem.unit_price) / 1000;

                // Piyasa Katsayıları:
                // Bağ teli donatının ~2.0 katıdır (İnce çekim ve ısıl işlem nedeniyle)
                // İnşaat çivisi donatının ~1.6 katıdır
                const ratio = item.name === "Bağ Teli (kg)" ? 2.0 : 1.6;

                return Math.round(ironKgPrice * ratio);
            }
        }
    }


    if (item.name === "Şantiye Elektrik Tüketimi (Aylık)") {
        const kwPrice = item.unit_price; // Wix'ten gelen 1 kW fiyatı (Örn: 2.5 TL)

        // Alan bazlı aylık tüketim tahmini (1000m2 başına 500 kW)
        const areaConsumption = (totalConstructionArea / 1000) * 500;
        const areaBasedCost = areaConsumption * kwPrice;

        // Alt limit için Personel maliyetini bul
        let personelMonthlyCost = 35000; // Varsayılan
        if (currentCosts) {
            const santiyeCat = currentCosts.find(c => c.id === 'santiye_hafriyat');
            const personelItem = santiyeCat?.items.find(i => i.name === 'Şantiye Personel Giderleri (Bekçi vb.)');
            if (personelItem) personelMonthlyCost = personelItem.unit_price;
        }

        // Formülünüz: Personel Günlük Maliyeti * 1.8
        const lowerBound = (personelMonthlyCost / 30) * 1.8;

        // İkisinden büyük olanı "Aylık Elektrik Faturası (Birim Fiyat)" olarak döndür
        return Math.max(areaBasedCost, lowerBound);
    }

    if (item.name === "Şantiye Personel Giderleri (Bekçi vb.)" || item.name === "Şantiye Araç Giderleri (Aylık)") {
        const basePrice = item.unit_price;

        // 3000 m²'nin altındaki şantiyelerde özel araç tahsisi veya 7/24 bekçi genelde olmaz.
        // Giderler diğer küçük şantiyelerle ortak bölüşülür.
        if (totalConstructionArea < 3000) {
            // Oransal düşüş uygulanır, ancak belirli bir asgari gider (min %25) korunur.
            const factor = Math.max(0.25, totalConstructionArea / 3000);
            return basePrice * factor;
        }
        return basePrice;
    }

    // --- ŞANTİYE SU GİDERİ HESABI ---
    if (item.name === "Şantiye Su Tüketimi (Aylık)") {
        const m3Price = item.unit_price; // Wix'ten gelen 1 m3 su fiyatı (Örn: 25 TL)

        // Alan bazlı aylık tüketim tahmini (1000m2 başına 50 m3)
        const areaConsumption = (totalConstructionArea / 1000) * 50;
        const areaBasedCost = areaConsumption * m3Price;

        // Alt limit için Personel maliyetini bul
        let personelMonthlyCost = 35000; // Varsayılan
        if (currentCosts) {
            const santiyeCat = currentCosts.find(c => c.id === 'santiye_hafriyat');
            const personelItem = santiyeCat?.items.find(i => i.name === 'Şantiye Personel Giderleri (Bekçi vb.)');
            if (personelItem) personelMonthlyCost = personelItem.unit_price;
        }

        // Formülünüz: Personel Günlük Maliyeti * 1
        const lowerBound = (personelMonthlyCost / 30) * 1.0;

        // İkisinden büyük olanı "Aylık Su Faturası (Birim Fiyat)" olarak döndür
        return Math.max(areaBasedCost, lowerBound);
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

    // Diğer tüm kalemler için orijinal fiyatı döndür
    return item.unit_price;
};

export const calculateTapuNoterFees = (
    unitCount: number,
    province: string,
    constructionModel: 'standard' | 'kat_karsiligi' = 'standard',
    isUrbanTransformation: boolean = false,
    currentCosts?: CostCategory[]
): number => {

    // Yardımcı Fonksiyon: cost_data.ts içinden özel tanımlı fiyatları çekmek için
    const getPrice = (name: string, fallback: number) => {
        if (!currentCosts) return fallback;
        for (const cat of currentCosts) {
            const item = cat.items.find(i => i.name === name);
            if (item) return item.unit_price;
        }
        return fallback;
    };

    // 1. BÜYÜKŞEHİR VE YÖRESEL KATSAYI (Tapu Döner Sermaye ve Arsa Rayiçleri İçin)
    const highCostCities = ['İstanbul', 'Ankara', 'İzmir', 'Antalya', 'Bursa', 'Muğla'];
    const mediumCostCities = ['Kocaeli', 'Adana', 'Mersin', 'Gaziantep', 'Konya', 'Kayseri', 'Eskişehir', 'Sakarya', 'Tekirdağ', 'Aydın'];

    let cityMultiplier = 1.0;
    if (highCostCities.includes(province)) {
        cityMultiplier = 2.5; // Yüksek değerli büyükşehirler
    } else if (mediumCostCities.includes(province)) {
        cityMultiplier = 1.5; // Orta-Yüksek değerli büyükşehirler
    }

    // 2. GÜNCEL BAZ FİYATLAR (Tahmini)
    // Kat İrtifakı kurulumu için daire başı temel Döner Sermaye bedeli (Yöresel katsayı ile çarpılır)
    const baseTapuDoner = getPrice("Tapu Döner Sermaye", 2500) * cityMultiplier;

    // Noter Standart Yazı, Suret ve Değerli Kağıt Bedeli
    const baseNoterPaperFee = getPrice("Noter Yazı Ücreti", 4500);

    // SENARYO 1: KENTSEL DÖNÜŞÜM (6306 Sayılı Kanun Kapsamında Riskli Yapı)
    if (isUrbanTransformation) {
        // MUAFİYET: Damga Vergisi, Noter Harcı, Tapu Harcı alınmaz.
        // Sadece Noter evrak/sayfa başı maktu ücretler ve Tapu'da cüzi işlem masrafları çıkar.
        const kentselDonusumMasrafi = baseNoterPaperFee + (unitCount * 800);
        return kentselDonusumMasrafi;
    }

    // SENARYO 2: KAT KARŞILIĞI İNŞAAT SÖZLEŞMESİ (Kentsel Dönüşüm YOKSA)
    if (constructionModel === 'kat_karsiligi') {
        // ÇOK YÜKSEK MALİYET: Sözleşme bedeli/Arsa rayici üzerinden Binde 11.38 Damga Vergisi + Noter Harcı.
        // Ortalama bir kabulle: Bir dairenin arsa payı değerine göre Noter masrafı (Büyükşehire göre katlanır).
        // Örn: İstanbul'da daire başı ortalama noter vergi/harç yükü 15.000 TL - 25.000 TL arası tutabilir.
        const estimatedNotaryTaxPerUnit = baseNoterPaperFee * 3 * cityMultiplier;
        const totalContractFee = baseNoterPaperFee + (unitCount * estimatedNotaryTaxPerUnit);

        // Tapuda Kat İrtifakı Kurulumu (Döner Sermaye vb.)
        const tapuTotal = unitCount * baseTapuDoner;

        return totalContractFee + tapuTotal;
    }

    // SENARYO 3: STANDART TAAHHÜT / KENDİ ARSANA YAP (Kentsel Dönüşüm YOKSA)
    // Arsa sahibi sizsiniz, devir yok. Sadece Müteahhitlik/Taahhüt ve Yapı Denetim sözleşmeleri noterde onaylanır.
    // Kat irtifakı için Tapu Döner Sermayesi ödenir.
    const baseStandardContract = getPrice("Standart Sözleşme Harcı", 8000);
    const standardContractFee = baseStandardContract * cityMultiplier;
    const tapuTotal = unitCount * baseTapuDoner;

    return standardContractFee + tapuTotal;
};