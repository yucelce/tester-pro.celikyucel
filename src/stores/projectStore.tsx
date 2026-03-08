import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
    UnitType, BuildingStats, UnitFloorType, WallMaterial, SavedProject, ScheduleTaskOverride,
    ReportSettings, CustomCostItem, FinancialSettings, SalePlan
} from '../types';

import { calculateConstructionSchedule } from '../utils/scheduleCalculator'; // YENİ IMPORT
import { CostCategory, COST_DATA as INITIAL_COSTS } from '../cost_data';
import {
    calculateUnitCost,
    calculateConstructionDuration,
    calculateComplexGlobalQuantity,
    calculateDynamicUnitPrice,
    calculateStairWellArea,
    getGlobalPrice
} from '../utils/calculations';
import { ScheduleItem } from '../utils/scheduleCalculator'; // Üste ekleyin
import { WIX_PRICE_MAP } from '../wix_price_mapping';

import { useUIStore } from './uiStore';
import { TURKEY_HEAT_MAP, PROVINCE_EARTHQUAKE_ZONES } from '../constants';
// --- WALL PRICES CONSTANTS ---
// Referans Fiyat (Wix: ytongmalisc): 569.1 TL (13.5 cm duvar için)
const BASE_PRICE = 569.1;

// Kalınlık çarpanları (Referans 13.5cm)
const THICKNESS_RATIOS: Record<string, number> = {
    '10': 0.85,
    '13.5': 1.0,
    '15': 1.1,
    '20': 1.4,
    '25': 1.7
};

// Malzeme çarpanları (Gazbeton referans 1.0)
const MATERIAL_RATIOS: Record<WallMaterial, number> = {
    'gazbeton': 1.0,
    'tugla': 0.90, // Tuğla işçiliği zor olsa da malzemesi ucuzdur, toplamda %10 daha az kabul edelim
    'bims': 0.80   // Bims en ekonomik çözüm
};



// Dinamik Fiyat Tablosu Oluşturucu
// Labor (İşçilik): ytongisc (247.1 TL/m2) tüm duvar tipleri için ortalama kabul edildi.
const LABOR_COST_M2 = 269;

// Malzeme (Blok) Fiyatları (TL/m3)
const RAW_MATERIAL_PRICES_M3: Record<WallMaterial, number> = {
    'gazbeton': 3600, // gazbetonmalm3mal
    'tugla': 2800,    // tuglamalm3mal
    'bims': 3800      // bimsmalm3mal
};

// Dinamik Fiyat Tablosu Oluşturucu
const generatePrices = (material: WallMaterial) => {
    const prices: Record<string, number> = {};
    const materialPriceM3 = RAW_MATERIAL_PRICES_M3[material];

    ['10', '13.5', '15', '20', '25'].forEach(thickStr => {
        const thicknessM = parseFloat(thickStr) / 100;

        // Formül: (Malzeme m3 Fiyatı * Kalınlık m) + İşçilik m2 Fiyatı
        const materialCostM2 = materialPriceM3 * thicknessM;
        const totalCostM2 = materialCostM2 + LABOR_COST_M2;

        prices[thickStr] = Math.round(totalCostM2);
    });
    return prices;
};

const MATERIAL_PRICES: Record<WallMaterial, Record<string, number>> = {
    gazbeton: generatePrices('gazbeton'),
    tugla: generatePrices('tugla'),
    bims: generatePrices('bims'),
};


interface ProjectCostDetail {
    id: string;
    title: string;
    totalCategoryCost: number;
    items: any[];
}

interface AreaValidationResult {
    hasError: boolean;
    mode: 'auto' | 'detailed';
    calculatedArea: number;
    declaredArea: number;
    ratio: number;
    message: string;
}

interface ProjectContextType {
    units: UnitType[];
    structuralUnits: UnitType[];
    costs: CostCategory[];
    buildingStats: BuildingStats;
    projectSchedule: ScheduleItem[];

    areaValidation: AreaValidationResult | null;

    // Global Modes
    globalWallMode: 'auto' | 'detailed';
    globalConcreteMode: 'auto' | 'detailed';
    globalWallMaterial: WallMaterial;
    globalWallThickness: number;

    reportSettings: ReportSettings;
    updateReportSettings: (settings: Partial<ReportSettings>) => void;

    // Derived Data
    projectCostDetails: ProjectCostDetail[];
    projectTotalCost: number;
    globalStructuralCost: number;
    interiorFitoutCost: number;
    totalConstructionArea: number;
    constructionDuration: number;
    globalStats: Record<string, number>;

    // Dirty State & Recalculation
    isDataDirty: boolean;
    dismissDataDirty: () => void;
    recalculateCosts: (mode: 'quantities' | 'prices' | 'both') => void;

    // Actions
    addUnit: () => void;
    addStructuralUnit: () => void;
    updateUnit: (updatedUnit: UnitType) => void;
    deleteUnit: (id: string, isStructural: boolean) => void;
    updateUnitCount: (id: string, count: number, isStructural: boolean) => void;
    updateUnitName: (id: string, name: string, isStructural: boolean) => void;
    updateUnitFloorType: (id: string, floorType: UnitFloorType, isStructural: boolean) => void;
    setBuildingStats: (value: React.SetStateAction<BuildingStats>) => void;
    toggleWallMode: () => void;
    toggleConcreteMode: () => void;
    setGlobalWallMaterial: (material: WallMaterial) => void;
    setGlobalWallThickness: (thickness: number) => void;
    updateCostItem: (catId: string, itemName: string, field: 'manualQuantity' | 'manualPrice', value: number | undefined) => void;
    isFetchingHeat: boolean;

    // Persistence
    saveProject: (projectName: string) => Promise<{ success: boolean, message: string }>;
    loadProject: (project: SavedProject) => void;
    fetchProjects: () => Promise<SavedProject[]>;
    deleteProject: (projectId: string) => Promise<void>;
    updateConstructionDuration: (duration: number | undefined) => void;
    duplicateUnit: (id: string) => void;

    // Hall Update Action
    updateHallArea: (type: 'normal' | 'ground' | 'basement', value: number | undefined) => void;

    scheduleOverrides: Record<string, ScheduleTaskOverride>;
    updateScheduleOverride: (taskId: string, override: Partial<ScheduleTaskOverride>) => void;
    setProjectStartDate: (date: string) => void;

    customCosts: CustomCostItem[];
    addCustomCost: () => void;
    updateCustomCost: (id: string, field: 'name' | 'price', value: any) => void;
    removeCustomCost: (id: string) => void;

    isPriceFetchError: boolean;
    // ProjectContextType içine eklenecekler (diğer tanımların arasına):
    financialSettings: FinancialSettings;
    updateFinancialSettings: (settings: Partial<FinancialSettings>) => void;
    addSale: (sale: SalePlan) => void;
    removeSale: (id: string) => void;
    startNewProject: (type: 'apartment' | 'villa') => void;

    bulkUpdatePrices: (newPrices: { itemName: string, price: number }[]) => void;

    duplexPairs: import('../types').DuplexPair[];
    addDuplexPair: (pair: Omit<import('../types').DuplexPair, 'id'>) => void;
    updateDuplexPair: (id: string, count: number) => void;
    removeDuplexPair: (id: string) => void;
}

const ProjectContext = createContext<ProjectContextType | undefined>(undefined);

export const ProjectProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {

    const [reportSettings, setReportSettings] = useState<ReportSettings>({
        firmName: 'Firmanızın Adı',
        clientName: 'Sayın Müşteri',
        projectDescription: 'Bu proje modern mimari standartlarına uygun olarak tasarlanmış olup, 1. sınıf malzemelerle inşa edilecektir.',
        firmLogo: null,
        projectRender: null,
        showUnitDetails: false,
        profitMargin: 0,
        selectedBrands: {},
        includeBuildingDetails: true, // YENİ EKLENEN SATIR (Varsayılan olarak açık gelsin)
        includeCashflow: false,
        includeProcurement: false,
        includeSchedule: false,
        includeRiskAnalysis: false
    });

    const [financialSettings, setFinancialSettings] = useState<FinancialSettings>({
        monthlyInterestRate: 3.6,
        monthlyInflationRate: 0.11,
        systemMonthlyInterestRate: 3.6,
        systemMonthlyInflationRate: 0.11,
        fixedPriceTaskIds: [],
        sales: [],
        revenueModel: 'yap_sat', // YENİ
        progressPayments: []     // YENİ
    });

    const updateFinancialSettings = (settings: Partial<FinancialSettings>) => {
        setFinancialSettings(prev => ({ ...prev, ...settings }));
        setIsDataDirty(true);
    };

    const addSale = (sale: SalePlan) => {
        setFinancialSettings(prev => ({ ...prev, sales: [...prev.sales, sale] }));
        setIsDataDirty(true);
    };

    const removeSale = (id: string) => {
        setFinancialSettings(prev => ({ ...prev, sales: prev.sales.filter(s => s.id !== id) }));
        setIsDataDirty(true);
    };

    const [customCosts, setCustomCosts] = useState<CustomCostItem[]>([]);
    const addCustomCost = () => {
        setCustomCosts([...customCosts, { id: Date.now().toString(), name: '', price: 0 }]);
        setIsDataDirty(true);
    };

    const updateCustomCost = (id: string, field: 'name' | 'price', value: any) => {
        setCustomCosts(prev => prev.map(c => c.id === id ? { ...c, [field]: value } : c));
        setIsDataDirty(true);
    };



    const removeCustomCost = (id: string) => {
        setCustomCosts(prev => prev.filter(c => c.id !== id));
        setIsDataDirty(true);
    };

    // State tanımı
    const [scheduleOverrides, setScheduleOverrides] = useState<Record<string, ScheduleTaskOverride>>({});

    // Başlangıçta varsayılan tarih yoksa (null), UI tarafında "bugünden 1 ay sonra" mantığı işletilecek.

    // Actions
    const updateScheduleOverride = (taskId: string, override: Partial<ScheduleTaskOverride>) => {
        setScheduleOverrides(prev => ({
            ...prev,
            [taskId]: { ...(prev[taskId] || { taskId }), ...override }
        }));
        setIsDataDirty(true);
    };

    const setProjectStartDate = (date: string) => {
        setBuildingStatsState(prev => ({ ...prev, projectStartDate: date }));
        setIsDataDirty(true);
    };

    const updateReportSettings = (settings: Partial<ReportSettings>) => {
        setReportSettings(prev => ({ ...prev, ...settings }));
        setIsDataDirty(true);
    };
    // --- STATE ---
    const [units, setUnits] = useState<UnitType[]>([
        {
            id: 'u1', name: 'Tip A (2+1)', count: 5, rooms: [], walls: [], columns: [], beams: [], slabs: [],
            floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now(),
            structuralWallSource: 'global_calculated', structuralConcreteSource: 'global_calculated'
        }
    ]);

    const [areaValidation, setAreaValidation] = useState<AreaValidationResult | null>(null);

    const [structuralUnits, setStructuralUnits] = useState<UnitType[]>([
        {
            id: 's1', name: 'Normal Kat Planı', count: 5, rooms: [], walls: [], columns: [], beams: [], slabs: [],
            floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now(),
            structuralWallSource: 'global_calculated', structuralConcreteSource: 'global_calculated'
        }
    ]);

    const [costs, setCosts] = useState<CostCategory[]>(INITIAL_COSTS);

    const [buildingStats, setBuildingStatsState] = useState<BuildingStats>({
        buildingType: 'apartment',
        visitedTabs: ['general'],
        province: 'İstanbul', district: 'Kadıköy', landArea: 500, heatZone: 2, earthquakeZone: 1,
        normalFloorCount: 5, basementFloorCount: 1,
        normalFloorHeight: 2.9, groundFloorHeight: 3.5, basementFloorHeight: 3.0,
        normalFloorArea: 250, groundFloorArea: 250, basementFloorArea: 300,
        normalFloorHallArea: 3, groundFloorHallArea: 6, basementFloorHallArea: 3, totalArea: 1550,
        isHallManual: false,
        hasRoofFloor: false, // EKLENDİ
        roofFloorArea: 0,    // EKLENDİ
        roofFloorHeight: 1.8,// EKLENDİ

        normalFloorPerimeter: 63.25, // Math.sqrt(250) * 4
        groundFloorPerimeter: 63.25, // Math.sqrt(250) * 4
        basementFloorPerimeter: 69.28, // Math.sqrt(300) * 4
        isNormalPerimeterManual: false,
        isGroundPerimeterManual: false,
        isBasementPerimeterManual: false,
        outerWallThickness: 20,
        innerWallThickness: 13.5,


        heatingSystem: 'radiator',
        constructionModel: 'standard', // Varsayılan: Kendin Yap / Taahhüt
        contractorShare: 50,
        isUrbanTransformation: false,   // Varsayılan: Hayır
        hasAllRiskInsurance: false,
        existingUnitCount: 0,
        monthlyRentPerUnit: 0,
        evictionCostPerUnit: 0,
        includeRentCost: false
    });

    const [duplexPairs, setDuplexPairs] = useState<import('../types').DuplexPair[]>([]);

    const addDuplexPair = (pair: Omit<import('../types').DuplexPair, 'id'>) => {
        setDuplexPairs(prev => [...prev, { ...pair, id: Date.now().toString() }]);
        setIsDataDirty(true);
    };

    const updateDuplexPair = (id: string, count: number) => {
        setDuplexPairs(prev => prev.map(p => p.id === id ? { ...p, count } : p));
        setIsDataDirty(true);
    };

    const removeDuplexPair = (id: string) => {
        setDuplexPairs(prev => prev.filter(p => p.id !== id));
        setIsDataDirty(true);
    };

    const [globalWallMode, setGlobalWallMode] = useState<'auto' | 'detailed'>('auto');
    const [globalConcreteMode, setGlobalConcreteMode] = useState<'auto' | 'detailed'>('auto');
    const [globalWallMaterial, setGlobalWallMaterial] = useState<WallMaterial>('gazbeton');
    const [globalWallThickness, setGlobalWallThickness] = useState<number>(15);

    const [isFetchingHeat, setIsFetchingHeat] = useState(false);
    const [isDataDirty, setIsDataDirty] = useState(false);
    const [isPriceFetchError, setIsPriceFetchError] = useState(false);
    const { accountId } = useUIStore();

    // --- EFFECTS ---

    useEffect(() => {
        if (buildingStats.isHallManual) return;
        if (buildingStats.buildingType === 'villa') {
            if (
                buildingStats.normalFloorHallArea !== 0 ||
                buildingStats.groundFloorHallArea !== 0 ||
                buildingStats.basementFloorHallArea !== 0
            ) {
                setBuildingStatsState(prev => ({
                    ...prev,
                    normalFloorHallArea: 0,
                    groundFloorHallArea: 0,
                    basementFloorHallArea: 0
                }));
            }
            return; // Aşağıdaki hesaplamaları yapmadan çık
        }

        const totalNormalUnits = units
            .filter(u => u.floorType === 'normal')
            .reduce((acc, u) => acc + u.count, 0);

        const normalFloorCount = Math.max(1, buildingStats.normalFloorCount);
        const unitsPerNormalFloor = totalNormalUnits / normalFloorCount;

        // Normal Kat: Asgari 6 m² (Kompakt sahanlık) veya daire başı 3 m² (Hangisi büyükse)
        let newNormalHall = Math.max(6, Math.ceil(unitsPerNormalFloor * 3));

        const totalGroundUnits = units
            .filter(u => u.floorType === 'ground')
            .reduce((acc, u) => acc + u.count, 0);

        // Zemin Kat: Bina ana girişi (Lobi) asgari 10 m² veya daire başı 3 m²
        let newGroundHall = Math.max(10, Math.ceil(totalGroundUnits * 3));

        const totalBasementUnits = units
            .filter(u => u.floorType === 'basement')
            .reduce((acc, u) => acc + u.count, 0);

        const basementFloorCount = Math.max(1, buildingStats.basementFloorCount);
        const unitsPerBasementFloor = totalBasementUnits / basementFloorCount;

        // Bodrum Kat: Asgari 6 m² veya daire başı 3 m²
        let newBasementHall = Math.max(6, Math.ceil(unitsPerBasementFloor * 3));

        if (
            buildingStats.normalFloorHallArea !== newNormalHall ||
            buildingStats.groundFloorHallArea !== newGroundHall ||
            buildingStats.basementFloorHallArea !== newBasementHall
        ) {
            setBuildingStatsState(prev => ({
                ...prev,
                normalFloorHallArea: newNormalHall,
                groundFloorHallArea: newGroundHall,
                basementFloorHallArea: newBasementHall
            }));
        }

    }, [units, buildingStats.normalFloorCount, buildingStats.basementFloorCount, buildingStats.isHallManual]);


    useEffect(() => {
        const fetchPrices = async () => {
            try {
                const WIX_API_URL = 'https://celikyucel.com/_functions/fiyatListesi';
                const response = await fetch(WIX_API_URL);
                if (response.ok) {
                    const result = await response.json();
                    if (result.status === 'success' && Array.isArray(result.data)) {
                        setIsPriceFetchError(false);
                        const wixPriceLookup = new Map<string, number>();
                        result.data.forEach((item: any) => {
                            if (item._id && item.fiyat) wixPriceLookup.set(item._id, Number(item.fiyat));
                            const aylikFaiz = wixPriceLookup.get('mevduat_faiz_aylikpaket');
                            if (aylikFaiz !== undefined) {
                                setFinancialSettings(prev => ({ ...prev, monthlyInterestRate: aylikFaiz }));
                            }
                        });

                        const mevduatFaizi = wixPriceLookup.get('mevduat_faiz_aylikpaket');
                        const insaatEndeksi = wixPriceLookup.get('insaatendeksaylikson12paket');

                        setFinancialSettings(prev => {
                            const newInterestRate = mevduatFaizi !== undefined ? mevduatFaizi : prev.monthlyInterestRate;
                            const newInflationRate = insaatEndeksi !== undefined ? insaatEndeksi : (prev.monthlyInflationRate || 3.0);

                            return {
                                ...prev,
                                monthlyInterestRate: newInterestRate,
                                monthlyInflationRate: newInflationRate,
                                systemMonthlyInterestRate: newInterestRate, // Orijinal değeri sakla
                                systemMonthlyInflationRate: newInflationRate // Orijinal değeri sakla
                            };
                        });

                        // --- YENİ EKLENEN: WIX'TEN KİRA VE TAŞINMA BEDELİ ÇEKME ---
                        // 'santiyearacpaket' ID'sine sahip fiyatı al, bulamazsa varsayılan 25.000 TL kullan
                        const aracPaketiFiyati = wixPriceLookup.get('santiyearacpaket') || 25000;

                        setBuildingStatsState(prev => ({
                            ...prev,
                            // Sadece değer 0 ise Wix'ten gelenleri yaz (Kullanıcı manuel değiştirdiyse ezme)
                            monthlyRentPerUnit: prev.monthlyRentPerUnit ? prev.monthlyRentPerUnit : (aracPaketiFiyati * 0.8),
                            evictionCostPerUnit: prev.evictionCostPerUnit ? prev.evictionCostPerUnit : aracPaketiFiyati
                        }));
                        setCosts(prevCosts => {
                            // Önce Wix'ten gelen ham fiyatları atıyoruz
                            const updatedCosts = prevCosts.map(cat => ({
                                ...cat,
                                items: cat.items.map(item => {
                                    const targetWixId = WIX_PRICE_MAP[item.name];
                                    if (targetWixId && wixPriceLookup.has(targetWixId)) {
                                        return { ...item, unit_price: wixPriceLookup.get(targetWixId)! };
                                    }
                                    return item;
                                })
                            }));

                            // Şimdi Duvar kalınlıklarına göre malzemeyi ve işçiliği hesaplıyoruz
                            const wallCat = updatedCosts.find(c => c.id === 'duvar_tavan');
                            let rawMaterialPriceM3 = 2653;
                            let laborPriceM2 = 250;
                            if (wallCat) {
                                const matItemName = globalWallMaterial === 'gazbeton' ? "Gazbeton Blok (m3)" :
                                    globalWallMaterial === 'tugla' ? "Tuğla Blok (m3)" : "Bims Blok (m3)";
                                const laborItemName = globalWallMaterial === 'gazbeton' ? "Gazbeton İşçiliği (m2)" :
                                    globalWallMaterial === 'tugla' ? "Tuğla İşçiliği (m2)" : "Bims İşçiliği (m2)";

                                const matItem = wallCat.items.find(i => i.name === matItemName);
                                const laborItem = wallCat.items.find(i => i.name === laborItemName);

                                if (matItem) rawMaterialPriceM3 = matItem.unit_price;
                                if (laborItem) laborPriceM2 = laborItem.unit_price;
                            }





                            // --- YENİ EKLENEN KISIM: Çimento, Kum ve Kireç fiyatlarını bularak harç m3 fiyatlarını hesapla ---
                            const cementPrice = getGlobalPrice(updatedCosts, "Çimento (kg)") || 3;
                            const sandPrice = getGlobalPrice(updatedCosts, "Kum (m3)") || 500;
                            const limePrice = getGlobalPrice(updatedCosts, "Kireç (kg)") || 4;

                            // Duvar Örme Harcı = 1 m3 Kum + 200 kg Çimento + 100 kg Kireç
                            const wallMortarPriceM3 = sandPrice + (cementPrice * 200) + (limePrice * 100);

                            // Mermer/Şap Harcı = 1 m3 Kum + 300 kg Çimento (Kireçsiz)
                            const marbleMortarPriceM3 = sandPrice + (cementPrice * 300);

                            return updatedCosts.map(cat => {
                                if (cat.id === 'duvar_tavan') {
                                    return {
                                        ...cat,
                                        items: cat.items.map(item => {
                                            // Duvar örme harcının fiyatını dinamik olarak güncelle
                                            if (item.name === "Duvar Örme Harcı (Kara Harç)") {
                                                return { ...item, unit_price: Math.round(wallMortarPriceM3) };
                                            }

                                            if (item.name.startsWith('Duvar Malzemesi (') && item.name.includes('cm)')) {



                                                const match = item.name.match(/\(([\d\.]+) cm\)/);
                                                if (match && match[1]) {
                                                    const thicknessCm = parseFloat(match[1]);
                                                    const thicknessM = thicknessCm / 100;
                                                    const calculatedPrice = rawMaterialPriceM3 * thicknessM;
                                                    return { ...item, unit_price: Math.round(calculatedPrice) };
                                                }
                                            } else if (item.name.startsWith('Duvar İşçiliği (') && item.name.includes('cm)')) {
                                                const match = item.name.match(/\(([\d\.]+) cm\)/);
                                                if (match && match[1]) {

                                                    const calculatedPrice = laborPriceM2;
                                                    return { ...item, unit_price: Math.round(calculatedPrice) };
                                                }
                                            }
                                            return item;
                                        })
                                    };
                                }
                                // --- YENİ EKLENEN KISIM: Zemin kaplamalarındaki harç fiyatını güncelle ---
                                if (cat.id === 'zemin_kaplama') {
                                    return {
                                        ...cat,
                                        items: cat.items.map(item => {
                                            if (item.name === "Mermer Harcı ve Kumu") {
                                                return { ...item, unit_price: Math.round(marbleMortarPriceM3) }; // marbleMortarPriceM3 olarak değiştirildi
                                            }
                                            return item;
                                        })
                                    };
                                }

                                return cat;
                            });
                        });
                    } else { setIsPriceFetchError(true); }
                } else {
                    setIsPriceFetchError(true);
                }
            } catch (error) {
                console.warn("Failed to fetch prices from backend", error);
            }
        };
        fetchPrices();
    }, []);

    useEffect(() => {
        const fetchZone = async () => {
            setIsFetchingHeat(true);
            await new Promise(r => setTimeout(r, 300));

            let zone = 2;
            let eqZone = 1; // Varsayılan 1. Derece

            try {
                const provData = TURKEY_HEAT_MAP[buildingStats.province];
                if (provData) zone = provData.districts && provData.districts[buildingStats.district] ? provData.districts[buildingStats.district] : provData.zone;

                // İl verisine göre deprem bölgesini bul
                eqZone = PROVINCE_EARTHQUAKE_ZONES[buildingStats.province] || 1;
            } catch (e) { }

            setBuildingStatsState(prev => ({
                ...prev,
                heatZone: zone,
                // Eğer kullanıcı manuel olarak değiştirmediyse sistemden geleni ata
                ...(prev.isEarthquakeZoneManual ? {} : { earthquakeZone: eqZone })
            }));

            setIsFetchingHeat(false);
        };
        fetchZone();
    }, [buildingStats.province, buildingStats.district]);

    // --- ALAN DOĞRULAMA MANTIĞI ---

    useEffect(() => {
        let validationResult: AreaValidationResult | null = null;
        const floorTypes: UnitFloorType[] = ['normal', 'ground', 'basement', 'roof'];

        for (const floorType of floorTypes) {
            let declaredArea = 0;
            let floorHeight = 0;
            let floorCount = 0; // Gerçek kat sayısı
            let safeFloorCount = 1; // Bölme işleminde hatayı önlemek için
            let hallArea = 0;
            let floorLabel = "";

            if (floorType === 'normal') {
                declaredArea = buildingStats.normalFloorArea;
                floorHeight = buildingStats.normalFloorHeight;
                floorCount = buildingStats.normalFloorCount;
                safeFloorCount = Math.max(1, buildingStats.normalFloorCount);
                hallArea = buildingStats.normalFloorHallArea || 0;
                floorLabel = "Normal Kat";
            } else if (floorType === 'ground') {
                declaredArea = buildingStats.groundFloorArea;
                floorHeight = buildingStats.groundFloorHeight;
                floorCount = 1;
                safeFloorCount = 1;
                hallArea = buildingStats.groundFloorHallArea || 0;
                floorLabel = "Zemin Kat";
            } else if (floorType === 'basement') {
                declaredArea = buildingStats.basementFloorArea;
                floorHeight = buildingStats.basementFloorHeight;
                floorCount = buildingStats.basementFloorCount;
                safeFloorCount = Math.max(1, buildingStats.basementFloorCount);
                hallArea = buildingStats.basementFloorHallArea || 0;
                floorLabel = "Bodrum Kat";
            } else if (floorType === 'roof') {
                if (!buildingStats.hasRoofFloor) continue;
                declaredArea = buildingStats.roofFloorArea || 0;
                floorHeight = buildingStats.roofFloorHeight || 1.8;
                floorCount = 1;
                safeFloorCount = 1;
                hallArea = 0;
                floorLabel = "Çatı Katı";
            }

            // Kat sayısı 0 veya alan 0 ise bu kat tipini atla
            if (floorCount <= 0 || !declaredArea || declaredArea <= 0) continue;

            const floorUnits = units.filter(u => u.floorType === floorType);

            // YENİ KONTROL: EĞER KAT TANIMLI AMA İÇİNDE HİÇ BAĞIMSIZ BÖLÜM YOKSA
            if (floorUnits.length === 0) {
                validationResult = {
                    hasError: true,
                    mode: globalWallMode,
                    calculatedArea: 0,
                    declaredArea: declaredArea,
                    ratio: 0, // 0 oranı ile eksik katı ifade ediyoruz
                    message: `Yapı genel bilgilerinde ${floorLabel} tanımlanmış (${declaredArea} m²), ancak henüz bu kata ait hiçbir bağımsız bölüm (daire/plan) eklenmemiş.`
                };
                break;
            }

            const stairArea = calculateStairWellArea(floorHeight);
            const commonArea = stairArea + hallArea;

            let totalCalculatedUserArea = 0;

            floorUnits.forEach(u => {
                const unitsPerFloor = u.count / safeFloorCount;

                if (globalWallMode === 'auto') {
                    const unitNetRoomArea = u.rooms.reduce((acc, r) => {
                        const area = r.manualAreaM2 || (u.scale > 0 ? r.area_px / (u.scale ** 2) : 0);
                        return acc + area;
                    }, 0);

                    const unitGrossArea = unitNetRoomArea * 1.13;
                    totalCalculatedUserArea += (unitGrossArea * unitsPerFloor);

                } else {
                    const unitNetRoomArea = u.rooms.reduce((acc, r) => {
                        return acc + (r.manualAreaM2 || (u.scale > 0 ? r.area_px / (u.scale ** 2) : 0));
                    }, 0);

                    const unitWallArea = u.walls.reduce((acc, w) => {
                        const len = w.manualLengthM || (u.scale > 0 ? w.length_px / u.scale : 0);
                        return acc + (len * (w.properties.thickness / 100));
                    }, 0);

                    const unitColArea = u.columns.reduce((acc, c) => {
                        return acc + (c.manualAreaM2 || (u.scale > 0 ? c.area_px / (u.scale ** 2) : 0));
                    }, 0);

                    const unitPhysicalArea = unitNetRoomArea + unitWallArea + unitColArea;
                    totalCalculatedUserArea += (unitPhysicalArea * unitsPerFloor);
                }
            });

            const finalCalculatedArea = totalCalculatedUserArea + commonArea;
            const ratio = finalCalculatedArea / declaredArea;

            if (ratio > 1.15 || ratio < 0.87) {
                const isTooBig = ratio > 1.15;
                const diffPercent = Math.abs((ratio - 1) * 100).toFixed(1);

                let messageDetail = "";
                if (globalWallMode === 'auto') {
                    messageDetail = `Daire iç alanları (x1.13) + Merdiven (${stairArea.toFixed(1)}m²) + Hol (${hallArea}m²)`;
                } else {
                    messageDetail = `Çizilen elemanlar (Duvar/Kolon/Oda) + Merdiven (${stairArea.toFixed(1)}m²) + Hol (${hallArea}m²)`;
                }

                validationResult = {
                    hasError: true,
                    mode: globalWallMode,
                    calculatedArea: finalCalculatedArea,
                    declaredArea: declaredArea,
                    ratio: ratio,
                    message: isTooBig
                        ? `${floorLabel} için hesaplanan alan, tanımlı alandan %${diffPercent} BÜYÜK. (${messageDetail} toplamı aşıyor)`
                        : `${floorLabel} için hesaplanan alan, tanımlı alandan %${diffPercent} KÜÇÜK. (${messageDetail} toplamı yetersiz)`
                };
                break;
            }
        }

        setAreaValidation(validationResult);

    }, [units, buildingStats, globalWallMode]);

    const updateWallPrices = useCallback((material: WallMaterial) => {
        setCosts(prevCosts => {
            // Önce güncel ham madde fiyatlarını mevcut listeden bulalım
            let rawMaterialPriceM3 = 0;
            let laborPriceM2 = 0;

            // Duvar ve Tavan kategorisini bul
            const wallCat = prevCosts.find(c => c.id === 'duvar_tavan');
            if (wallCat) {
                // Ham madde item'larını bul
                const matItemName = material === 'gazbeton' ? "Gazbeton Blok (m3)" :
                    material === 'tugla' ? "Tuğla Blok (m3)" : "Bims Blok (m3)";

                const laborItemName = material === 'gazbeton' ? "Gazbeton İşçiliği (m2)" :
                    material === 'tugla' ? "Tuğla İşçiliği (m2)" : "Bims İşçiliği (m2)";

                rawMaterialPriceM3 = getGlobalPrice(prevCosts, matItemName) || (material === 'gazbeton' ? 2653 : material === 'tugla' ? 2085 : 2843);
                laborPriceM2 = getGlobalPrice(prevCosts, laborItemName) || 250;
            }

            return prevCosts.map(cat => {
                if (cat.id === 'duvar_tavan') {
                    return {
                        ...cat,
                        items: cat.items.map(item => {
                            if (item.name.startsWith('Duvar Malzemesi (') && item.name.includes('cm)')) {
                                const match = item.name.match(/\(([\d\.]+) cm\)/);
                                if (match && match[1]) {
                                    const thicknessCm = parseFloat(match[1]);
                                    const thicknessM = thicknessCm / 100;
                                    const calculatedPrice = rawMaterialPriceM3 * thicknessM;
                                    // DÜZELTME 1: Malzeme değiştiğinde eski manuel fiyat sıfırlanmalı!
                                    return { ...item, unit_price: Math.round(calculatedPrice), manualPrice: undefined };
                                }
                            } else if (item.name.startsWith('Duvar İşçiliği (') && item.name.includes('cm)')) {
                                const match = item.name.match(/\(([\d\.]+) cm\)/);
                                if (match && match[1]) {
                                    // DÜZELTME 2: İşçilik fiyatına kalınlık çarpanı eklendi
                                    let ratio = 1.0;
                                    const thick = parseFloat(match[1]);
                                    if (thick <= 10) ratio = 0.85;
                                    else if (thick <= 13.5) ratio = 1.0;
                                    else if (thick <= 15) ratio = 1.1;
                                    else if (thick <= 20) ratio = 1.4;
                                    else if (thick <= 25) ratio = 1.7;

                                    const calculatedPrice = laborPriceM2 * ratio;
                                    // DÜZELTME 1 (Devamı): Manuel fiyat sıfırlandı
                                    return { ...item, unit_price: Math.round(calculatedPrice), manualPrice: undefined };
                                }
                            }
                            return item;
                        })
                    };
                }
                return cat;
            });
        });
    }, []);

    // --- CALCULATIONS (Automatic) ---
    const totalConstructionArea = useMemo(() => {
        let area = (buildingStats.normalFloorCount * buildingStats.normalFloorArea) +
            buildingStats.groundFloorArea +
            (buildingStats.basementFloorCount * buildingStats.basementFloorArea);

        // Çatı katı varsa toplama dahil et
        if (buildingStats.hasRoofFloor && buildingStats.roofFloorArea) {
            area += buildingStats.roofFloorArea;
        }
        return area;
    }, [buildingStats]);
    // GÜNCELLENEN KISIM: İş Zaman Programı tabanlı süre hesabı
    const autoDuration = useMemo(() => {
        // 1. İş programını hesapla (override'lar ve bina istatistikleri dahil)
        // totalDurationMonths parametresi scheduleCalculator içinde 'auto' modda kullanılmadığı için 0 geçiyoruz.
        const schedule = calculateConstructionSchedule(
            totalConstructionArea,
            buildingStats,
            0,
            scheduleOverrides
        );

        if (!schedule || schedule.length === 0) return 12;

        // 2. En son biten işin bitiş haftasını bul
        const maxEndWeek = Math.max(...schedule.map(s => s.endWeek));

        // 3. Haftayı aya çevir (4 hafta = 1 ay kabulüyle)
        const calculatedMonths = Number((maxEndWeek / 4.33).toFixed(2));

        if (buildingStats.buildingType === 'villa') {
            // Villalar için minimum 6 ay sınırı koyabilir veya doğrudan calculatedMonths'u döndürebilirsiniz.
            return Math.max(6, calculatedMonths);
        } else {
            // Apartmanlar için 12 ay sınırını koru
            return Math.max(12, calculatedMonths);
        }
    }, [totalConstructionArea, buildingStats, scheduleOverrides]);


    const constructionDuration = useMemo(() => {
        if (buildingStats.isDurationManual && buildingStats.constructionDuration) {
            return buildingStats.constructionDuration;
        }
        return autoDuration;
    }, [buildingStats.isDurationManual, buildingStats.constructionDuration, autoDuration]);

    const projectSchedule = useMemo(() => {
        return calculateConstructionSchedule(
            totalConstructionArea,
            buildingStats,
            0,
            scheduleOverrides
        );
    }, [totalConstructionArea, buildingStats, scheduleOverrides]);

    const updateConstructionDuration = (duration: number | undefined) => {
        setBuildingStatsState(prev => ({
            ...prev,
            isDurationManual: duration !== undefined,
            constructionDuration: duration
        }));
        setIsDataDirty(true);
    };

    const updateHallArea = (type: 'normal' | 'ground' | 'basement', value: number | undefined) => {
        if (value === undefined) {
            setBuildingStatsState(prev => ({
                ...prev,
                isHallManual: false
            }));
        } else {
            setBuildingStatsState(prev => ({
                ...prev,
                isHallManual: true,
                normalFloorHallArea: type === 'normal' ? value : prev.normalFloorHallArea,
                groundFloorHallArea: type === 'ground' ? value : prev.groundFloorHallArea,
                basementFloorHallArea: type === 'basement' ? value : prev.basementFloorHallArea,
            }));
        }
        setIsDataDirty(true);
    };

    const { projectCostDetails, projectTotalCost, globalStructuralCost, interiorFitoutCost, globalStats } = useMemo(() => {
        let structural = 0;
        let interior = 0;
        let total = 0;

        const aggregatedUnitStats: Record<string, number> = {};

        const addToAggregated = (stats: Record<string, number>, count: number) => {
            Object.keys(stats).forEach(k => {
                if (!aggregatedUnitStats[k]) aggregatedUnitStats[k] = 0;
                aggregatedUnitStats[k] += (stats[k] * count);
            });
        };

        units.forEach(u => {
            const { stats } = calculateUnitCost(u, costs, buildingStats, globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, false);
            addToAggregated(stats, u.count);
        });

        let effectiveStructuralUnits = structuralUnits;

        // Kullanıcı henüz hiç statik kat planı eklememişse ve sistem "Oto" modundaysa,
        // sistemin duvar ve beton metrajlarını hesaplayabilmesi için yapı istatistiklerine (buildingStats) dayalı sanal kat planları oluşturulur.
        if (structuralUnits.length === 0 && (globalWallMode === 'auto' || globalConcreteMode === 'auto')) {
            effectiveStructuralUnits = [];

            if (buildingStats.normalFloorCount > 0) {
                effectiveStructuralUnits.push({ id: 'auto_n', floorType: 'normal', count: buildingStats.normalFloorCount, scale: 0, rooms: [], walls: [], columns: [], beams: [], slabs: [] } as unknown as UnitType);
            }
            if (buildingStats.groundFloorArea > 0) {
                effectiveStructuralUnits.push({ id: 'auto_g', floorType: 'ground', count: 1, scale: 0, rooms: [], walls: [], columns: [], beams: [], slabs: [] } as unknown as UnitType);
            }
            if (buildingStats.basementFloorCount > 0) {
                effectiveStructuralUnits.push({ id: 'auto_b', floorType: 'basement', count: buildingStats.basementFloorCount, scale: 0, rooms: [], walls: [], columns: [], beams: [], slabs: [] } as unknown as UnitType);
            }
            if (buildingStats.hasRoofFloor && buildingStats.roofFloorArea && buildingStats.roofFloorArea > 0) {
                effectiveStructuralUnits.push({ id: 'auto_r', floorType: 'roof', count: 1, scale: 0, rooms: [], walls: [], columns: [], beams: [], slabs: [] } as unknown as UnitType);
            }
        }



        effectiveStructuralUnits.forEach(u => {
            const { stats } = calculateUnitCost(u, costs, buildingStats, globalWallMaterial, globalWallMode, globalConcreteMode, globalWallThickness, true);
            addToAggregated(stats, u.count);
        });

        const outerThickStr = buildingStats.outerWallThickness === 13.5 ? '13_5' : String(buildingStats.outerWallThickness || 20);
        const innerThickStr = buildingStats.innerWallThickness === 13.5 ? '13_5' : String(buildingStats.innerWallThickness || 13.5);

        const outerKey = `wall_${outerThickStr}_area`;
        const innerKey = `wall_${innerThickStr}_area`;

        ['10', '13_5', '15', '20', '25'].forEach(tStr => {
            const wDed = aggregatedUnitStats[`wDed_${tStr}`] || 0; // Pencere düşümü
            const dDed = aggregatedUnitStats[`dDed_${tStr}`] || 0; // Kapı düşümü
            const currentKey = `wall_${tStr}_area`;

            // Kapı Düşümleri (Öncelikli olarak İç Duvara aktarılır - Rollover)
            if (dDed > 0) {
                aggregatedUnitStats[currentKey] = (aggregatedUnitStats[currentKey] || 0) - dDed;
                if (aggregatedUnitStats[currentKey] < 0) {
                    const remainder = Math.abs(aggregatedUnitStats[currentKey]);
                    aggregatedUnitStats[currentKey] = 0; // Negatifi engelle
                    if (currentKey !== innerKey) {
                        aggregatedUnitStats[innerKey] = (aggregatedUnitStats[innerKey] || 0) - remainder;
                    }
                }
            }

            // Pencere Düşümleri (Öncelikli olarak Dış Duvara aktarılır - Rollover)
            if (wDed > 0) {
                aggregatedUnitStats[currentKey] = (aggregatedUnitStats[currentKey] || 0) - wDed;
                if (aggregatedUnitStats[currentKey] < 0) {
                    const remainder = Math.abs(aggregatedUnitStats[currentKey]);
                    aggregatedUnitStats[currentKey] = 0; // Negatifi engelle
                    if (currentKey !== outerKey) {
                        aggregatedUnitStats[outerKey] = (aggregatedUnitStats[outerKey] || 0) - remainder;
                    }
                }
            }
        });

        // Negatif kalma ihtimaline karşı son bir güvenlik temizliği
        ['10', '13_5', '15', '20', '25'].forEach(tStr => {
            const key = `wall_${tStr}_area`;
            if ((aggregatedUnitStats[key] || 0) < 0) {
                aggregatedUnitStats[key] = 0;
            }
        });

        // --- HARÇ VE YAPIŞTIRICI HESABI (TÜM DÜŞÜMLER BİTTİKTEN SONRA TEMİZ METRAJ ÜZERİNDEN) ---
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

            // 1. Tavan Alanları İlavesi (Direkt m2 olarak)
            const totalHallCeilingArea = (nHallArea * buildingStats.normalFloorCount) + gHallArea + (bHallArea * buildingStats.basementFloorCount);

            // 2. Duvar Alanları İlavesi (Kare kabulü ile Çevre x Kat Yüksekliği)
            const nHallWall = buildingStats.normalFloorCount * (Math.sqrt(nHallArea) * 4 * buildingStats.normalFloorHeight);
            const gHallWall = Math.sqrt(gHallArea) * 4 * buildingStats.groundFloorHeight;
            const bHallWall = buildingStats.basementFloorCount * (Math.sqrt(bHallArea) * 4 * buildingStats.basementFloorHeight);
            const totalHallWallArea = nHallWall + gHallWall + bHallWall;

            // Hesaplanan ortak alan sıva/boya değerlerini ana metraj havuzuna (aggregatedUnitStats) ekle
            aggregatedUnitStats['calc_ceiling_paint_area'] = (aggregatedUnitStats['calc_ceiling_paint_area'] || 0) + totalHallCeilingArea;
            aggregatedUnitStats['calc_rough_plaster_area'] = (aggregatedUnitStats['calc_rough_plaster_area'] || 0) + totalHallWallArea;
            aggregatedUnitStats['calc_paint_wall_area'] = (aggregatedUnitStats['calc_paint_wall_area'] || 0) + totalHallWallArea;

            // Eğer "Alçı Sıva (Kaba+Saten)" kullanılıyorsa ona da ilave et
        }

        // Üst katlarda çelik kapı, pano, diafon vb. olmaz. Bunları toplam sayıdan düşüyoruz.
        const availableUnitCounts: Record<string, number> = {};
        units.forEach(u => availableUnitCounts[u.id] = u.count);

        duplexPairs.forEach(pair => {
            const lowerUnit = units.find(u => u.id === pair.lowerUnitId);
            const upperUnit = units.find(u => u.id === pair.upperUnitId);

            if (lowerUnit && upperUnit) {
                // Asla müsait olan (boştaki) daire sayısından fazla düşüm yapma
                const availableLower = availableUnitCounts[pair.lowerUnitId] || 0;
                const availableUpper = availableUnitCounts[pair.upperUnitId] || 0;

                const c = Math.min(pair.count, availableLower, availableUpper);

                if (c > 0) {
                    // undefined kontrolü ile güvenli düşüm
                    if (aggregatedUnitStats['calc_steel_door'] !== undefined) aggregatedUnitStats['calc_steel_door'] = Math.max(0, aggregatedUnitStats['calc_steel_door'] - c);
                    if (aggregatedUnitStats['calc_combi_count'] !== undefined) aggregatedUnitStats['calc_combi_count'] = Math.max(0, aggregatedUnitStats['calc_combi_count'] - c);
                    if (aggregatedUnitStats['calc_heat_pump'] !== undefined) aggregatedUnitStats['calc_heat_pump'] = Math.max(0, aggregatedUnitStats['calc_heat_pump'] - c);
                    if (aggregatedUnitStats['calc_sub_panel_count'] !== undefined) aggregatedUnitStats['calc_sub_panel_count'] = Math.max(0, aggregatedUnitStats['calc_sub_panel_count'] - c);
                    if (aggregatedUnitStats['calc_unit_count'] !== undefined) aggregatedUnitStats['calc_unit_count'] = Math.max(0, aggregatedUnitStats['calc_unit_count'] - c);

                    // İç merdiven hesabı için dubleks adedini global değişkene yazıyoruz.
                    aggregatedUnitStats['total_duplex_count'] = (aggregatedUnitStats['total_duplex_count'] || 0) + c;

                    // Kullanılanları müsait listeden düş
                    availableUnitCounts[pair.lowerUnitId] -= c;
                    availableUnitCounts[pair.upperUnitId] -= c;
                }
            }
        });

        if (buildingStats.buildingType === 'villa') {
            // Villa tek bir bağımsız bölümdür, kaç kat çizilirse çizilsin 1 kabul edilir.
            aggregatedUnitStats['calc_unit_count'] = 1;

            // Sadece 1 adet ana çelik kapı olmalı
            aggregatedUnitStats['calc_steel_door'] = 1;

            // Isıtma sistemleri dış/ana üniteleri villada 1 adettir
            if (aggregatedUnitStats['calc_heat_pump'] !== undefined) aggregatedUnitStats['calc_heat_pump'] = 1;
            if (aggregatedUnitStats['calc_combi_count'] !== undefined) aggregatedUnitStats['calc_combi_count'] = 1;
        }

        const details = costs.map(cat => {
            let catTotal = 0;

            // --- YENİ EKLENEN FİLTRELEME MANTIĞI ---
            const filteredItems = cat.items.filter(item => {
                // Mekanik Tesisat Filtresi (Seçilmeyen sistemi listeden çıkart)
                if (cat.id === 'mekanik_tesisat') {
                    const system = buildingStats.heatingSystem || 'radiator';

                    const radiatorItems = [
                        "Kalorifer Altyapısı (Mobil Sistem)",
                        "Panel Radyatör (DemirDöküm vb.)",
                        "Radyatör Montaj ve Vanalar"
                    ];

                    const underfloorItems = [
                        "Yerden Isıtma (Strafor+Boru+İşçilik)",
                        "Yerden Isıtma Kollektörü ve Kutusu"
                    ];

                    // Radyatör seçiliyse, Yerden ısıtmayı gizle
                    if (system === 'radiator' && underfloorItems.includes(item.name)) return false;

                    // Yerden ısıtma seçiliyse, Radyatörü gizle
                    if (system === 'underfloor' && radiatorItems.includes(item.name)) return false;
                }

                if (cat.id === 'duvar_tavan') {
                    if (globalWallMaterial === 'gazbeton') {
                        // Gazbeton seçiliyse klasik harcı gizle
                        if (item.name === "Duvar Örme Harcı (Kara Harç)") return false;
                    } else {
                        // Tuğla veya Bims seçiliyse Gazbeton yapıştırıcısını gizle
                        if (item.name === "Gazbeton Yapıştırıcısı") return false;
                    }
                }
                return true;
            });

            const processedItems = filteredItems
                .filter(item => item.scope !== 'hidden') // Gizli kalemleri filtrele
                .map(item => {

                    let finalQty = 0;
                    let calculatedAutoQty = 0;

                    // Varsayılan dinamik fiyat (Bölgeye/Şehre göre değişenler için)
                    let dynamicUnitPrice = calculateDynamicUnitPrice(
                        item,
                        0,
                        totalConstructionArea,
                        buildingStats.province,
                        buildingStats.isUrbanTransformation,
                        buildingStats, // <-- EKLENEN PARAMETRE
                        costs,         // <-- EKLENMESİ GEREKEN PARAMETRE
                        globalWallMaterial // <-- EKLENMESİ GEREKEN PARAMETRE
                    );

                    // --- DÜZELTME BAŞLANGICI: PAKET FİYAT MANTIĞI ---
                    if (item.inputType === 'manual_total') {
                        // Paket sistemlerde miktar her zaman 1'dir. Çarpma işlemi yapılmaz.
                        calculatedAutoQty = 1;
                        finalQty = 1;

                        // Eğer bu kalemin arkada çalışan bir formülü varsa (Örn: Tapu Harcı, Ruhsat vb.)
                        if (item.auto_source.startsWith('calc_')) {
                            // Formülden gelen sonucu MİKTAR değil, FİYAT olarak alıyoruz
                            // Çünkü calc_tapu_noter gibi fonksiyonlar doğrudan TL tutarı döner.
                            const calculatedValue = calculateComplexGlobalQuantity(
                                item,
                                buildingStats,
                                totalConstructionArea,
                                constructionDuration,
                                aggregatedUnitStats, costs
                            );
                            dynamicUnitPrice = calculatedValue;
                        }
                        // Eğer formül yoksa (manual ise), cost_data.ts'deki unit_price baz alınır.
                    }
                    // --- STANDART MANTIĞI (Duvar, Beton vb.) ---
                    else {
                        if (item.auto_source === 'manual') {
                            calculatedAutoQty = 0;
                        } else if (item.scope === 'unit') {
                            const statKey = item.auto_source;
                            // ... (Mevcut birim bazlı hesaplamalar aynen kalır)
                            calculatedAutoQty = (aggregatedUnitStats[statKey] || 0) * item.multiplier;
                        } else {
                            // Global alan bazlı hesaplamalar
                            if (item.auto_source === 'total_area') calculatedAutoQty = totalConstructionArea * item.multiplier;
                            else if (item.auto_source === 'land_area') calculatedAutoQty = buildingStats.landArea * item.multiplier;
                            else if (item.auto_source.startsWith('wall_')) {
                                calculatedAutoQty = Math.max(0, aggregatedUnitStats[item.auto_source] || 0) * item.multiplier;
                            }
                            else if (item.auto_source.startsWith('calc_')) {
                                calculatedAutoQty = Math.max(0, calculateComplexGlobalQuantity(item, buildingStats, totalConstructionArea, constructionDuration, aggregatedUnitStats, costs));
                            }
                        }
                        // Standart kalemlerde manuel miktar varsa o geçerlidir
                        finalQty = item.manualQuantity !== undefined ? item.manualQuantity : calculatedAutoQty;
                    }
                    // --- DÜZELTME BİTİŞİ ---

                    // Nihai Fiyat Belirleme (Kullanıcı elle fiyat girdiyse onu kullan, yoksa hesaplananı kullan)
                    const finalPrice = item.manualPrice !== undefined ? item.manualPrice : dynamicUnitPrice;

                    // Toplam Tutar Hesabı
                    const totalPrice = finalQty * finalPrice;

                    catTotal += totalPrice;

                    return {
                        ...item,
                        calculatedAutoQty,
                        finalQty,
                        totalPrice,
                        unit_price: dynamicUnitPrice // Arayüzde görünmesi için güncel fiyat
                    };
                });

            // Kaba Yapı İçin Dahil Edilenler
            if (['kaba_insaat', 'duvar_tavan'].includes(cat.id)) {
                structural += catTotal;
            }
            // İnce İşlere dahil OLMAMASI gerekenleri (Arsa/Şantiye vb) çıkarıyoruz
            else if (!['arsa_finansman', 'resmi_idari', 'santiye_hafriyat', 'peyzaj_cevre'].includes(cat.id)) {
                interior += catTotal;
            }

            total += catTotal;

            return {
                id: cat.id,
                title: cat.title,
                totalCategoryCost: catTotal,
                items: processedItems
            };


        });

        // --- ÖZEL KALEMLERİ LİSTEYE EKLEME ---
        const customCostsTotal = customCosts.reduce((sum, c) => sum + c.price, 0);
        if (customCosts.length > 0) {
            details.push({
                id: 'ozel_kalemler',
                title: '11. Özel İlaveler / Ek İşler',
                totalCategoryCost: customCostsTotal,
                items: customCosts.map(c => ({
                    name: c.name || 'İsimsiz Ek Kalem',
                    unit: 'Paket',
                    unit_price: c.price,
                    auto_source: 'manual', // Typescript hatası alırsanız burayı 'manual' olarak bırakın, CostItem tipinde 'manual' string olarak tanımlı olmalı
                    multiplier: 1,
                    calculatedAutoQty: 1,
                    finalQty: 1,
                    totalPrice: c.price,
                    manualPrice: c.price, // Fiyatın görünmesi için
                    inputType: 'manual_total',
                    scope: 'global',
                    id: c.id // Benzersiz ID
                } as any)) // as any: Hızlı geçiş için, CostItem tipini tam karşılamasa bile çalışır
            });
            total += customCostsTotal;
        }
        // -------------------------------------

        return {
            projectCostDetails: details,
            projectTotalCost: total,
            globalStructuralCost: structural,
            interiorFitoutCost: interior,
            globalStats: aggregatedUnitStats
        };
    }, [units, structuralUnits, costs, buildingStats, totalConstructionArea, constructionDuration, globalWallMode, globalConcreteMode, globalWallMaterial, globalWallThickness]);


    // --- ACTIONS ---
    const startNewProject = (type: 'apartment' | 'villa') => {
        const isVilla = type === 'villa';

        // Yapı İstatistiklerini Güncelle ve Önceki Projenin Kalıntılarını (Havuz vb.) Temizle
        setBuildingStatsState(prev => ({
            ...prev,
            buildingType: type,
            normalFloorCount: isVilla ? 1 : 5,
            basementFloorCount: isVilla ? 0 : 1,
            groundFloorHeight: isVilla ? 3.2 : 3.0,
            normalFloorHeight: isVilla ? 3.0 : 2.8,
            normalFloorArea: isVilla ? 150 : 250,
            groundFloorArea: isVilla ? 150 : 250,
            basementFloorArea: isVilla ? 0 : 300,
            poolArea: 0,
            parkingArea: 0,
            verandaArea: 0,
            hasSmartHome: false,
            smartHomeLighting: false,
            smartHomeHeating: false,
            smartHomeSensors: false,
            smartHomeBlinds: false,
            hasRoofFloor: false,
            roofFloorArea: 0,
            hasWellFoundation: false,
            wellFoundationArea: 0,
            hasExistingBuilding: false,
            isUrbanTransformation: false,
            outerWallThickness: 20,
            innerWallThickness: 13.5,

            existingUnitCount: 0,
            monthlyRentPerUnit: 0,
            evictionCostPerUnit: 0,
            includeRentCost: false,
            constructionModel: 'standard',
            contractorShare: 50,
            isDurationManual: false,
            constructionDuration: undefined
        }));

        // Daire/Villa Tiplerini Sıfırla
        setUnits([
            {
                id: Date.now().toString(),
                name: isVilla ? 'Villa Planı' : 'Tip A (2+1)',
                count: 1,
                rooms: [], walls: [], columns: [], beams: [], slabs: [],
                floorType: isVilla ? 'normal' : 'normal',
                imageData: null, scale: 0, lastEdited: Date.now(),
                structuralWallSource: 'global_calculated', structuralConcreteSource: 'global_calculated'
            }
        ]);

        // Finansal Geçmişi ve Zaman Çizelgesi Ayarlarını Tamamen Sıfırla
        setFinancialSettings(prev => ({
            ...prev,
            sales: [],
            progressPayments: [],
            fixedPriceTaskIds: [],
            revenueModel: 'yap_sat'
        }));
        setScheduleOverrides({});
        setAreaValidation(null);

        // Diğer listeleri sıfırla
        setStructuralUnits([]);
        setCustomCosts([]);
        setDuplexPairs([]);
        setIsDataDirty(true);
        recalculateCosts('both');
    };

    const setBuildingStats = (value: React.SetStateAction<BuildingStats>) => {
        setBuildingStatsState(value);
        setIsDataDirty(true);
    };

    const addUnit = () => {
        const newUnit: UnitType = {
            id: Date.now().toString(),
            name: `Yeni Tip ${units.length + 1}`,
            count: 1,
            rooms: [], walls: [], columns: [], beams: [], slabs: [],
            floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now(),
            structuralWallSource: 'global_calculated', structuralConcreteSource: 'global_calculated'
        };
        setUnits([...units, newUnit]);
        setIsDataDirty(true);
    };

    const addStructuralUnit = () => {
        const newUnit: UnitType = {
            id: Date.now().toString(),
            name: `Kat Planı ${structuralUnits.length + 1}`,
            count: 1,
            rooms: [], walls: [], columns: [], beams: [], slabs: [],
            floorType: 'normal', imageData: null, scale: 0, lastEdited: Date.now(),
            structuralWallSource: 'global_calculated', structuralConcreteSource: 'global_calculated'
        };
        setStructuralUnits([...structuralUnits, newUnit]);
        setIsDataDirty(true);
    };

    const deleteUnit = (id: string, isStructural: boolean) => {
        if (isStructural) {
            setStructuralUnits(structuralUnits.filter(u => u.id !== id));
        } else {
            setUnits(units.filter(u => u.id !== id));
            // YENİ: Silinen dairenin dahil olduğu dubleks eşleşmelerini de temizle
            setDuplexPairs(prev => prev.filter(p => p.lowerUnitId !== id && p.upperUnitId !== id));
        }
        setIsDataDirty(true);
    };

    const updateUnit = (updatedUnit: UnitType) => {
        const isStructural = structuralUnits.some(u => u.id === updatedUnit.id);
        if (isStructural) {
            setStructuralUnits(structuralUnits.map(u => u.id === updatedUnit.id ? updatedUnit : u));
        } else {
            setUnits(units.map(u => u.id === updatedUnit.id ? updatedUnit : u));
        }
        setIsDataDirty(true);
    };

    const updateUnitCount = (id: string, count: number, isStructural: boolean) => {
        if (count < 1) return;
        if (isStructural) {
            setStructuralUnits(prev => prev.map(u => u.id === id ? { ...u, count } : u));
        } else {
            setUnits(prev => prev.map(u => u.id === id ? { ...u, count } : u));
            // YENİ: Dubleks eşleşmelerinin sayısı, güncellenen daire sayısını aşıyorsa aşağı çek
            setDuplexPairs(prev => prev.map(p => {
                if (p.lowerUnitId === id || p.upperUnitId === id) {
                    if (p.count > count) return { ...p, count };
                }
                return p;
            }));
        }
        setIsDataDirty(true);
    };

    const updateUnitName = (id: string, name: string, isStructural: boolean) => {
        if (isStructural) setStructuralUnits(prev => prev.map(u => u.id === id ? { ...u, name } : u));
        else setUnits(prev => prev.map(u => u.id === id ? { ...u, name } : u));
        setIsDataDirty(true); // BU SATIRI EKLEYİN
    };

    const updateUnitFloorType = (id: string, floorType: UnitFloorType, isStructural: boolean) => {
        if (isStructural) setStructuralUnits(prev => prev.map(u => u.id === id ? { ...u, floorType } : u));
        else setUnits(prev => prev.map(u => u.id === id ? { ...u, floorType } : u));
        setIsDataDirty(true);
    };

    const toggleWallMode = () => {
        setGlobalWallMode(prev => prev === 'auto' ? 'detailed' : 'auto');
        setIsDataDirty(true);
    };
    const toggleConcreteMode = () => {
        setGlobalConcreteMode(prev => prev === 'auto' ? 'detailed' : 'auto');
        setIsDataDirty(true);
    };

    const setGlobalWallMaterialAction = (material: WallMaterial) => {
        setGlobalWallMaterial(material);
        updateWallPrices(material);
        setIsDataDirty(true);
    };

    const setGlobalWallThicknessAction = (thickness: number) => {
        setGlobalWallThickness(thickness);
        setIsDataDirty(true);
    };

    const updateCostItemAction = (catId: string, itemName: string, field: 'manualQuantity' | 'manualPrice', value: number | undefined) => {
        setCosts(prevCosts => prevCosts.map(cat => {
            if (cat.id !== catId) return cat;
            return {
                ...cat,
                items: cat.items.map(item => {
                    if (item.name !== itemName) return item;
                    return { ...item, [field]: value };
                })
            };
        }));
        setIsDataDirty(false);
    };

    const bulkUpdatePrices = (newPrices: { itemName: string, price: number }[]) => {
        // 1. Standart maliyet kalemlerini (cost_data.ts'den gelen) güncelle
        setCosts(prevCosts => prevCosts.map(cat => ({
            ...cat,
            items: cat.items.map(item => {
                const importedItem = newPrices.find(p => p.itemName === item.name);
                if (importedItem) {
                    return { ...item, manualPrice: importedItem.price };
                }
                return item;
            })
        })));

        // 2. Kullanıcının sonradan girdiği "Özel Kalemleri" de kontrol et ve güncelle
        setCustomCosts(prev => prev.map(c => {
            const importedItem = newPrices.find(p => p.itemName === c.name);
            if (importedItem) {
                return { ...c, price: importedItem.price };
            }
            return c;
        }));

        setIsDataDirty(true); // Sistemi kaydedilebilir hale getir ve maliyetleri yeniden hesaplat
    };

    const dismissDataDirty = () => setIsDataDirty(false);

    const recalculateCosts = (mode: 'quantities' | 'prices' | 'both') => {
        setCosts(prevCosts => prevCosts.map(cat => ({
            ...cat,
            items: cat.items.map(item => {
                let newQty = item.manualQuantity;
                let newPrice = item.manualPrice;

                if (mode === 'quantities' || mode === 'both') {
                    newQty = undefined;
                }
                if (mode === 'prices' || mode === 'both') {
                    newPrice = undefined;
                }

                return {
                    ...item,
                    manualQuantity: newQty,
                    manualPrice: newPrice
                };
            })
        })));
        setIsDataDirty(false);
    };

    const fetchProjects = async (): Promise<SavedProject[]> => {
        if (accountId) {
            try {
                const res = await fetch(`/api/projects?accountId=${accountId}`);
                if (!res.ok) throw new Error('Failed to fetch');
                const data = await res.json();
                return data.projects || [];
            } catch (e) {
                console.error("API Error fetching projects:", e);
                return [];
            }
        } else {
            try {
                const stored = localStorage.getItem('saved_projects_guest');
                return stored ? JSON.parse(stored) : [];
            } catch (e) {
                console.error("LocalStorage Error:", e);
                return [];
            }
        }
    };

    const saveProject = async (projectName: string): Promise<{ success: boolean, message: string }> => {

        // --- 1. BASE64 RESİMLERİ WIX'E YÜKLEYİP URL'E ÇEVİREN YARDIMCI FONKSİYON ---
        const uploadBase64ToWix = async (base64String: string, accId: string | null): Promise<string> => {
            // Zaten bir URL ise veya boşsa direkt geri dön (Gereksiz API çağrısını önler)
            if (!base64String || !base64String.startsWith('data:image')) return base64String;

            try {
                const response = await fetch('https://www.celikyucel.com/_functions/uploadPlanImage', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ base64: base64String, accountId: accId })
                });

                const data = await response.json();
                if (data.success) {
                    return data.url; // Wix'ten dönen https://static.wixstatic.com/... linki
                }
                return base64String; // Hata olursa orijinalini koru ki çizim kaybolmasın
            } catch (error) {
                console.error("Görsel yüklenirken hata:", error);
                return base64String;
            }
        };

        // --- 2. MEVCUT LİSTELERİ DÖNÜP GÖRSELLERİ WIX'E AKTARMA ---
        const processUnits = async (unitsList: UnitType[]) => {
            const updatedList = [...unitsList];
            for (let i = 0; i < updatedList.length; i++) {
                if (updatedList[i].imageData && updatedList[i].imageData!.startsWith('data:image')) {
                    // Base64'ü Wix'e yolla, dönen temiz linki kaydet
                    updatedList[i].imageData = await uploadBase64ToWix(updatedList[i].imageData!, accountId);
                }
            }
            return updatedList;
        };

        // Beklerken arayüzünüzdeki "Kaydediliyor" spinner'ı dönecektir
        const cleanUnits = await processUnits(units);
        const cleanStructuralUnits = await processUnits(structuralUnits);

        // State'i URL'lerle güncelleyelim (Tarayıcı RAM kullanımı da rahatlar)
        setUnits(cleanUnits);
        setStructuralUnits(cleanStructuralUnits);

        // --- 3. TEMİZLENMİŞ VE KÜÇÜLMÜŞ JSON İLE PROJEYİ OLUŞTURMA ---
        const newProject: SavedProject = {
            id: Date.now().toString(),
            name: projectName,
            lastModified: Date.now(),
            data: {
                units: cleanUnits,
                structuralUnits: cleanStructuralUnits,
                buildingStats,
                customCosts,
                financialSettings,
                duplexPairs,
                costs: costs.map(c => ({
                    id: c.id,
                    items: c.items.filter(i => i.manualPrice !== undefined || i.manualQuantity !== undefined).map(i => ({
                        name: i.name,
                        manualPrice: i.manualPrice,
                        manualQuantity: i.manualQuantity
                    }))
                })),
                globalSettings: {
                    wallMode: globalWallMode,
                    concreteMode: globalConcreteMode,
                    wallMaterial: globalWallMaterial,
                    wallThickness: globalWallThickness
                }
            }
        };

        // --- 4. MEVCUT POSTGRES'E (VEYA LOCALSTORAGE) KAYDETME İŞLEMİ ---
        if (accountId) {
            try {
                const res = await fetch('/api/projects', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ accountId, project: newProject })
                });
                const result = await res.json();
                return { success: res.ok, message: result.message || (res.ok ? 'Kaydedildi' : 'Hata') };
            } catch (e) {
                console.error("API Save Error:", e);
                return { success: false, message: "Sunucu hatası oluştu." };
            }
        } else {
            try {
                const currentProjects = await fetchProjects();
                if (currentProjects.length >= 5) {
                    return { success: false, message: "Misafir modunda maksimum 5 proje kaydedebilirsiniz." };
                }
                const existingIndex = currentProjects.findIndex(p => p.name.toLowerCase() === projectName.toLowerCase());
                let updatedProjects = [...currentProjects];
                if (existingIndex >= 0) updatedProjects[existingIndex] = newProject;
                else updatedProjects.push(newProject);

                localStorage.setItem('saved_projects_guest', JSON.stringify(updatedProjects));
                return { success: true, message: "Proje tarayıcıya kaydedildi." };
            } catch (e) {
                return { success: false, message: "Yerel kayıt hatası." };
            }
        }
    };

    const loadProject = (project: SavedProject) => {
        try {
            setUnits(project.data.units);
            setStructuralUnits(project.data.structuralUnits || []);
            setBuildingStats(project.data.buildingStats);
            setGlobalWallMode(project.data.globalSettings.wallMode);
            setGlobalConcreteMode(project.data.globalSettings.concreteMode || 'auto');
            setGlobalWallMaterial(project.data.globalSettings.wallMaterial);
            setGlobalWallThickness(project.data.globalSettings.wallThickness);
            setCustomCosts(project.data.customCosts || []);
            setDuplexPairs(project.data.duplexPairs || []);

            if (project.data.financialSettings) {
                const migratedSales = project.data.financialSettings.sales.map((s: any) => ({
                    id: s.id,
                    name: s.name,
                    amount: s.amount,
                    month: s.month !== undefined ? s.month : Math.floor((s.week || 0) / 4.33)
                }));
                setFinancialSettings({
                    ...project.data.financialSettings,
                    sales: migratedSales,
                    monthlyInflationRate: project.data.financialSettings.monthlyInflationRate || 3.0,
                    // EKSİK OLAN 2 ALAN BURAYA DA EKLENMELİ
                    systemMonthlyInterestRate: project.data.financialSettings.systemMonthlyInterestRate || 3.6,
                    systemMonthlyInflationRate: project.data.financialSettings.systemMonthlyInflationRate || 0.11,
                    fixedPriceTaskIds: project.data.financialSettings.fixedPriceTaskIds || [],
                    revenueModel: project.data.financialSettings.revenueModel || 'yap_sat',
                    progressPayments: project.data.financialSettings.progressPayments || []
                });
            } else {
                // UYARIDA BELİRTİLEN ELSE BLOĞU
                setFinancialSettings({
                    monthlyInterestRate: 3.5,
                    monthlyInflationRate: 3.0,
                    systemMonthlyInterestRate: 3.6,    // EKLENDİ
                    systemMonthlyInflationRate: 0.11,  // EKLENDİ
                    fixedPriceTaskIds: [],
                    sales: []
                });
            }

            setCosts(prevCosts => prevCosts.map(cat => {
                const savedCat = project.data.costs.find(sc => sc.id === cat.id);
                if (!savedCat) return cat;
                return {
                    ...cat,
                    items: cat.items.map(item => {
                        const savedItem = savedCat.items.find((si: any) => si.name === item.name);
                        if (savedItem) {
                            return { ...item, manualPrice: savedItem.manualPrice, manualQuantity: savedItem.manualQuantity };
                        }
                        return item;
                    })
                };
            }));

            setIsDataDirty(false);
        } catch (e) {
            console.error("Load failed", e);
            alert("Proje yüklenirken hata oluştu.");
        }
    };

    const deleteProject = async (projectId: string) => {
        if (accountId) {
            try {
                await fetch(`/api/projects?accountId=${accountId}&projectId=${projectId}`, { method: 'DELETE' });
            } catch (e) { console.error(e); }
        } else {
            const currentProjects = await fetchProjects();
            const updated = currentProjects.filter(p => p.id !== projectId);
            localStorage.setItem('saved_projects_guest', JSON.stringify(updated));
        }
    };

    const duplicateUnit = (id: string) => {
        const sourceUnit = units.find(u => u.id === id);
        if (sourceUnit) {
            const clonedUnit: UnitType = JSON.parse(JSON.stringify(sourceUnit));
            const newUnit: UnitType = {
                ...clonedUnit,
                id: Date.now().toString(),
                name: `${sourceUnit.name} (Kopya)`,
                lastEdited: Date.now()
            };

            setUnits([...units, newUnit]);
            setIsDataDirty(true);
        }
    };

    return (
        <ProjectContext.Provider value={{
            units, structuralUnits, costs, buildingStats,
            areaValidation,
            globalWallMode, globalConcreteMode, globalWallMaterial, globalWallThickness,
            projectCostDetails, projectTotalCost, globalStructuralCost, interiorFitoutCost,
            totalConstructionArea, constructionDuration, isFetchingHeat,
            isDataDirty, dismissDataDirty, recalculateCosts,
            addUnit, addStructuralUnit, updateUnit, deleteUnit, updateUnitCount, updateUnitName, updateUnitFloorType,
            setBuildingStats, toggleWallMode, toggleConcreteMode, setGlobalWallMaterial: setGlobalWallMaterialAction,
            setGlobalWallThickness: setGlobalWallThicknessAction,
            updateCostItem: updateCostItemAction,
            saveProject, loadProject, fetchProjects, deleteProject,
            updateConstructionDuration, duplicateUnit,
            updateHallArea, reportSettings,
            updateReportSettings, globalStats,
            scheduleOverrides,
            updateScheduleOverride,
            setProjectStartDate, customCosts, addCustomCost, updateCustomCost, removeCustomCost,
            projectSchedule,
            financialSettings,
            updateFinancialSettings,
            addSale, isPriceFetchError,
            removeSale, startNewProject, bulkUpdatePrices, duplexPairs, addDuplexPair, updateDuplexPair, removeDuplexPair,
        }}>
            {children}
        </ProjectContext.Provider>
    );
};

export const useProjectStore = () => {
    const context = useContext(ProjectContext);
    if (context === undefined) {
        throw new Error('useProjectStore must be used within a ProjectProvider');
    }
    return context;
};