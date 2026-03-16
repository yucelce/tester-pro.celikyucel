import React, { createContext, useContext, useState, useEffect, useMemo, useCallback } from 'react';
import {
    UnitType, BuildingStats, UnitFloorType, WallMaterial, SavedProject, ScheduleTaskOverride,
    ReportSettings, CustomCostItem, FinancialSettings, SalePlan, DuplexPair
} from '../types';
import { COST_DATA } from '../../api/_utils/cost_data';
import { WIX_PRICE_MAP } from '../wix_price_mapping';
import { useUIStore } from './uiStore';
import { TURKEY_HEAT_MAP, PROVINCE_EARTHQUAKE_ZONES } from '../../api/_utils/constants';

import type { CostCategory } from '../../api/_utils/cost_data';
import type { ScheduleItem } from '../../api/_utils/scheduleCalculator';

// Eksik olan import satırını buraya ekliyoruz:
import { calculateStairWellArea } from '../../api/_utils/calculations';
// --- WALL PRICES CONSTANTS ---

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
    isCalculating: boolean;
    triggerBackendCalculation: () => Promise<void>;
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

    duplexPairs: DuplexPair[];
    addDuplexPair: (pair: Omit<DuplexPair, 'id'>) => void;
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
        includeRiskAnalysis: false,
        includeQuantityBreakdown: false
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


    const [isDataDirty, setIsDataDirty] = useState(false);
    const [isCalculating, setIsCalculating] = useState(false);
    const [projectCostDetails, setProjectCostDetails] = useState<any[]>([]);
    const [projectTotalCost, setProjectTotalCost] = useState(0);
    const [globalStructuralCost, setGlobalStructuralCost] = useState(0);
    const [interiorFitoutCost, setInteriorFitoutCost] = useState(0);
    const [globalStats, setGlobalStats] = useState<Record<string, number>>({});

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

    const [costs, setCosts] = useState<CostCategory[]>([]);
    const [projectSchedule, setProjectSchedule] = useState<ScheduleItem[]>([]);

    const [buildingStats, setBuildingStatsState] = useState<BuildingStats>({
        buildingType: 'apartment',
        concreteClass: 'C30',  // <--- EKLENDİ
        slabType: 'plak',      // <--- EKLENDİ
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

    const [duplexPairs, setDuplexPairs] = useState<DuplexPair[]>([]);

    const addDuplexPair = (pair: Omit<DuplexPair, 'id'>) => {
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
                // 1. AĞ HATALARINI ÖNLEMEK İÇİN VARSAYILAN FİYATLARI DOĞRUDAN DOSYADAN ALIYORUZ
                // (API çökse veya yerel sunucu API'yi bulamasa bile sistem boş kalmaz ve liste ekrana çizilir)
                const baseCosts = COST_DATA;

                try {
                    // 2. Wix'ten güncel fiyatları çekmeyi deniyoruz
                    const WIX_API_URL = 'https://www.celikyucel.com/_functions/fiyatListesi';
                    const response = await fetch(WIX_API_URL);
                    
                    if (response.ok) {
                        const result = await response.json();
                        
                        if (result && Array.isArray(result.data)) {
                            setIsPriceFetchError(false);
                            const wixPriceLookup = new Map<string, number>();

                            result.data.forEach((item: any) => {
                                if (item._id && item.fiyat) wixPriceLookup.set(item._id, Number(item.fiyat));
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
                                    systemMonthlyInterestRate: newInterestRate,
                                    systemMonthlyInflationRate: newInflationRate
                                };
                            });

                            const aracPaketiFiyati = wixPriceLookup.get('santiyearacpaket') || 25000;

                            setBuildingStatsState(prev => ({
                                ...prev,
                                monthlyRentPerUnit: prev.monthlyRentPerUnit ? prev.monthlyRentPerUnit : (aracPaketiFiyati * 0.8),
                                evictionCostPerUnit: prev.evictionCostPerUnit ? prev.evictionCostPerUnit : aracPaketiFiyati
                            }));

                            // GÜNCEL FİYATLARI UYGULA VE HESAPLA
                            setCosts(baseCosts.map((cat: any) => {
                                const updatedCat = {
                                    ...cat,
                                    items: cat.items.map((item: any) => {
                                        const targetWixId = WIX_PRICE_MAP[item.name];
                                        if (targetWixId && wixPriceLookup.has(targetWixId)) {
                                            return { ...item, unit_price: wixPriceLookup.get(targetWixId)! };
                                        }
                                        return item;
                                    })
                                };

                                // Özel Harç Hesaplamaları (Çimento, Kum vb. bileşenlerine göre)
                                if (cat.id === 'duvar_tavan') {
                                    const cementPrice = wixPriceLookup.get(WIX_PRICE_MAP["Çimento (kg)"] || '') || 3;
                                    const sandPrice = wixPriceLookup.get(WIX_PRICE_MAP["Kum (m3)"] || '') || 500;
                                    const limePrice = wixPriceLookup.get(WIX_PRICE_MAP["Kireç (kg)"] || '') || 4;
                                    const wallMortarPriceM3 = sandPrice + (cementPrice * 200) + (limePrice * 100);
                                    
                                    updatedCat.items = updatedCat.items.map((item: any) => 
                                        item.name === "Duvar Örme Harcı (Kara Harç)" ? { ...item, unit_price: Math.round(wallMortarPriceM3) } : item
                                    );
                                }
                                if (cat.id === 'zemin_kaplama') {
                                    const cementPrice = wixPriceLookup.get(WIX_PRICE_MAP["Çimento (kg)"] || '') || 3;
                                    const sandPrice = wixPriceLookup.get(WIX_PRICE_MAP["Kum (m3)"] || '') || 500;
                                    const marbleMortarPriceM3 = sandPrice + (cementPrice * 300);

                                    updatedCat.items = updatedCat.items.map((item: any) => 
                                        item.name === "Mermer Harcı ve Kumu" ? { ...item, unit_price: Math.round(marbleMortarPriceM3) } : item
                                    );
                                }
                                
                                return updatedCat;
                            }));
                            
                            return; // Başarılıysa fonksiyondan çık
                        }
                    }
                    throw new Error("Wix API format hatası.");
                } catch (wixError) {
                    console.warn("Wix fiyatları çekilemedi, varsayılan değerler yüklenecek:", wixError);
                    setIsPriceFetchError(true);
                    setCosts(baseCosts); // KRİTİK: WIX ÇÖKERSE VEYA AĞ HATASI OLURSA DİREKT VARSAYILANLARI YÜKLE
                }

            } catch (error) {
                console.error("Kritik Hata:", error);
                setIsPriceFetchError(true);
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
            return prevCosts.map(cat => {
                if (cat.id === 'duvar_tavan') {
                    return {
                        ...cat,
                        items: cat.items.map(item => {
                            // Sadece manuel fiyatı sıfırlıyoruz. 
                            // Birim fiyatı calculations.ts dinamik olarak halledecek.
                            if (item.name.startsWith('Duvar Malzemesi (') || item.name.startsWith('Duvar İşçiliği (')) {
                                return { ...item, manualPrice: undefined };
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
        let duration = 0;

        // Villalar hızlı biter
        if (buildingStats.buildingType === 'villa') {
            if (totalConstructionArea <= 250) duration = 6;
            else if (totalConstructionArea <= 500) duration = 8;
            else duration = 10;
            return Math.max(6, duration);
        } else {
            // Apartman/Ticari mantığı
            if (totalConstructionArea <= 1000) {
                duration = 10;
            } else if (totalConstructionArea <= 3000) {
                duration = (0.005 * totalConstructionArea) + 5;
            } else {
                duration = Math.sqrt(totalConstructionArea) / 2.7386;
            }
            return Math.max(12, Math.round(duration * 100) / 100);
        }
    }, [totalConstructionArea, buildingStats.buildingType]);


    const constructionDuration = useMemo(() => {
        if (buildingStats.isDurationManual && buildingStats.constructionDuration) {
            return buildingStats.constructionDuration;
        }
        return autoDuration;
    }, [buildingStats.isDurationManual, buildingStats.constructionDuration, autoDuration]);


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

    const triggerBackendCalculation = useCallback(async () => {
    if (costs.length === 0) return; // Fiyatlar yüklenmeden boşuna istek atma
    
    setIsCalculating(true);
    try {
        // VERCEL 413 Payload Hatalarını Önlemek İçin Base64 Resimlerini Backend'e Yollamıyoruz
        const stripImage = (u: UnitType) => ({ ...u, imageData: null });
        const safeUnits = units.map(stripImage);
        const safeStructuralUnits = structuralUnits.map(stripImage);

        const payload = {
            units: safeUnits,
            structuralUnits: safeStructuralUnits,
            buildingStats,
            globalWallMaterial,
            globalWallMode,
            globalConcreteMode,
            globalWallThickness,
            customCosts,
            duplexPairs,
            costs,
            totalConstructionArea,
            constructionDuration
        };

        const resCost = await fetch('/api/calculate-project', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload)
        });
        
        if (resCost.ok) {
            const costResult = await resCost.json();
            setProjectCostDetails(costResult.projectCostDetails || []);
            setProjectTotalCost(costResult.projectTotalCost || 0);
            setGlobalStructuralCost(costResult.globalStructuralCost || 0);
            setInteriorFitoutCost(costResult.interiorFitoutCost || 0);
            setGlobalStats(costResult.globalStats || {});
        } else {
            // YENİ EKLENEN HATA YAKALAMA BLOĞU
            const errText = await resCost.text();
            console.error("Backend Maliyet Hesaplama Hatası (HTTP " + resCost.status + "):", errText);
        }

        const resSchedule = await fetch('/api/calculate-schedule', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                totalConstructionArea,
                buildingStats,
                constructionDuration,
                overrides: scheduleOverrides
            })
        });

        if (resSchedule.ok) {
            const scheduleResult = await resSchedule.json();
            setProjectSchedule(scheduleResult.schedule || []);
        } else {
            // YENİ EKLENEN HATA YAKALAMA BLOĞU
            const errText = await resSchedule.text();
            console.error("Backend Takvim Hesaplama Hatası:", errText);
        }

    } catch (error) {
        console.error("Kritik İstek/Ağ Hatası:", error);
    } finally {
        setIsCalculating(false);
    }
}, [
    units, structuralUnits, buildingStats, globalWallMaterial,
    globalWallMode, globalConcreteMode, globalWallThickness,
    customCosts, duplexPairs, costs, scheduleOverrides,
    totalConstructionArea, constructionDuration
]);

    useEffect(() => {
        if (costs.length > 0) {
            const timeoutId = setTimeout(() => {
                triggerBackendCalculation();
            }, 600); // 600ms debounce (performans için)
            return () => clearTimeout(timeoutId);
        }
    }, [triggerBackendCalculation, costs.length]);
    // --- ACTIONS ---
    const startNewProject = (type: 'apartment' | 'villa') => {
        const isVilla = type === 'villa';

        // Yapı İstatistiklerini Güncelle ve Önceki Projenin Kalıntılarını (Havuz vb.) Temizle
        setBuildingStatsState(prev => ({
            ...prev,
            buildingType: type,
            concreteClass: 'C30',  // <--- EKLENDİ
            slabType: 'plak',      // <--- EKLENDİ
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
            roofTerraceArea: 0,
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
            removeSale, startNewProject, bulkUpdatePrices, duplexPairs,
            addDuplexPair, updateDuplexPair, removeDuplexPair,
            isCalculating,
            triggerBackendCalculation,
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