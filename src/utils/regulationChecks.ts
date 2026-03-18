// src/utils/regulationChecks.ts

import { SystemWarning, BuildingStats, UnitType } from '../types';

interface WarningParams {
    areaValidation: any;
    buildingStats: BuildingStats;
    totalConstructionArea: number;
    projectCostDetails: any[];
    units: UnitType[];
}

export const generateSystemWarnings = ({
    areaValidation,
    buildingStats,
    totalConstructionArea,
    projectCostDetails,
    units
}: WarningParams): SystemWarning[] => {
    const warnings: SystemWarning[] = [];

    // 1. MEVCUT ALAN TUTARSIZLIĞI
    if (areaValidation && areaValidation.hasError) {
        warnings.push({
            id: 'area_error',
            type: 'critical',
            category: 'area',
            title: 'Alan Tutarsızlığı Tespit Edildi',
            message: areaValidation.message,
            suggestion: areaValidation.ratio === 0
                ? '"Bağımsız Bölüm Tipleri" paneline giderek yeni bir tip ekleyin ve "Kat Bilgisi" ayarından eksik olan katı seçin.'
                : areaValidation.ratio > 1
                    ? '"Yapı Genel Bilgileri"nden kat alanını büyütün veya çizimdeki oda metrajlarını küçültün.'
                    : '"Yapı Genel Bilgileri"nden kat alanını küçültün veya eksik odaları/duvarları çizin.'
        });
    }

    const totalFloors = buildingStats.normalFloorCount + buildingStats.basementFloorCount + 1;

    // 2. ASANSÖR ZORUNLULUĞU KONTROLÜ
    if (buildingStats.buildingType !== 'villa' && (totalFloors > 3 || totalConstructionArea > 800)) {
        const isElevatorZero = projectCostDetails.some(cat =>
            cat.items.some((i: any) => i.name === "Asansör (Paket)" && i.finalQty === 0)
        );

        if (isElevatorZero) {
            warnings.push({
                id: 'elevator_rule',
                type: 'warning',
                category: 'regulation',
                title: 'Asansör Zorunluluğu İhlali',
                message: 'Kat sayısı 3\'ten veya toplam alan 800 m²\'den büyük binalarda asansör yasal zorunluluktur.' +
                    (buildingStats.isUrbanTransformation ? ' Ancak Kentsel Dönüşüm projelerinde idare müsamaha gösterebilir.' : ''),
                suggestion: 'Maliyet detaylarından Asansör miktarını düzeltin.',
                autoFix: {
                    type: 'UPDATE_QUANTITY',
                    payload: { catId: 'mekanik_tesisat', itemName: 'Asansör (Paket)', value: undefined },
                    buttonText: 'Asansörü Oto Hesapla'
                }
            });
        }
    }

    // 3. SIĞINAK ZORUNLULUĞU KONTROLÜ
    if (totalConstructionArea > 1500 && (!buildingStats.shelterArea || buildingStats.shelterArea === 0)) {
        warnings.push({
            id: 'shelter_rule',
            type: 'warning',
            category: 'regulation',
            title: 'Sığınak Zorunluluğu',
            message: 'Toplam inşaat alanı 1500 m²\'yi geçen binalarda sığınak ayrılması zorunludur.' +
                (buildingStats.isUrbanTransformation ? ' Kentsel Dönüşüm projelerinde otopark vb. alanlar sığınak sayılabilir.' : ''),
            suggestion: 'Yapı Genel Bilgileri > Statik panelinden sığınak alanı tanımlayın.',
            autoFix: {
                type: 'UPDATE_BUILDING_STATS',
                payload: { shelterArea: parseFloat((totalConstructionArea * 0.05).toFixed(2)), shelterFloor: 'basement' },
                buttonText: 'Tahmini Sığınak Ekle (%5)'
            }
        });
    }

    // 4. ŞANTİYE ŞEFİ ZORUNLULUĞU KONTROLÜ
    const siteChiefItem = projectCostDetails.some(cat => cat.items.some((i: any) => i.name === "Şantiye Şefi (Aylık)" && i.finalQty === 0));
    if (siteChiefItem) {
        warnings.push({
            id: 'site_chief_rule',
            type: 'critical',
            category: 'regulation',
            title: 'Şantiye Şefi Atanmamış',
            message: 'İnşaat süresince yasal olarak bir şantiye şefi atanması (istihdamı) zorunludur.',
            suggestion: 'Maliyet detaylarından Şantiye Şefi miktarını (ay) düzeltin.',
            autoFix: {
                type: 'UPDATE_QUANTITY',
                payload: { catId: 'santiye_hafriyat', itemName: 'Şantiye Şefi (Aylık)', value: undefined },
                buttonText: 'Şefi Tekrar Ekle'
            }
        });
    }

    // 5. OTOPARK YÖNETMELİĞİ
    const totalUnits = units.reduce((acc, u) => acc + u.count, 0);
    const totalParking = (buildingStats.parkingArea || 0) + (buildingStats.indoorParkingArea || 0);
    if (buildingStats.buildingType !== 'villa' && totalUnits > 3 && totalParking === 0) {
        warnings.push({
            id: 'parking_rule',
            type: 'warning',
            category: 'regulation',
            title: 'Otopark Alanı Ayrılmamış',
            message: 'Otopark Yönetmeliği gereği projenizdeki bağımsız bölüm sayısına oranla açık veya kapalı otopark alanı ayrılması zorunludur.',
            suggestion: 'Yapı Genel Bilgileri panelinden Açık veya Kapalı Otopark alanı tanımlayın.',
            autoFix: {
                type: 'UPDATE_BUILDING_STATS',
                payload: { parkingArea: totalUnits * 15 }, // Her daireye tahmini 15m2 açık otopark
                buttonText: 'Açık Otopark Ekle'
            }
        });
    }

    // 6. YANGIN MERDİVENİ ZORUNLULUĞU
    const buildingHeight = (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) + buildingStats.groundFloorHeight;
    if (buildingHeight > 21.5) {
        const fireEscapeItem = projectCostDetails.some(cat => cat.items.some((i: any) => i.name === "Yangın Merdiveni (Çelik)" && i.finalQty === 0));
        if (fireEscapeItem) {
            warnings.push({
                id: 'fire_escape_rule',
                type: 'critical',
                category: 'regulation',
                title: 'Yangın Merdiveni İhlali',
                message: 'Bina yüksekliği 21.50 metreyi aşan yapılarda Binaların Yangından Korunması Hakkında Yönetmelik gereği yangın merdiveni zorunludur.',
                suggestion: 'Maliyet detaylarından Yangın Merdiveni miktarını düzeltin.',
                autoFix: {
                    type: 'UPDATE_QUANTITY',
                    payload: { catId: 'kaba_insaat', itemName: 'Yangın Merdiveni (Çelik)', value: undefined },
                    buttonText: 'Merdiveni Geri Getir'
                }
            });
        }
    }

    // 7. YAPI DENETİM ZORUNLULUĞU
    const inspectionItem = projectCostDetails.some(cat => cat.items.some((i: any) => i.name === "Yapı Denetim Hizmet Bedeli" && i.finalQty === 0));
    if (inspectionItem) {
        warnings.push({
            id: 'inspection_rule',
            type: 'critical',
            category: 'regulation',
            title: 'Yapı Denetim Atanmamış',
            message: 'Ruhsatlı tüm inşaatlarda (kırsal alan istisnaları hariç) Yapı Denetim firması ile çalışılması yasal zorunluluktur.',
            suggestion: 'Maliyet detaylarından Yapı Denetim kalemini tekrar aktif edin.',
            autoFix: {
                type: 'UPDATE_QUANTITY',
                payload: { catId: 'resmi_idari', itemName: 'Yapı Denetim Hizmet Bedeli', value: undefined },
                buttonText: 'Denetimi Tekrar Ekle'
            }
        });
    }

    return warnings;
};