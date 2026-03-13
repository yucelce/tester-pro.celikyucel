
export type Point = { x: number; y: number };
export type RoomType = 'living' | 'bedroom' | 'kitchen' | 'bath' | 'wc' | 'hallway' | 'dressing' | 'balcony' | 'storage' | 'other' | null;
export type WallMaterial = 'gazbeton' | 'tugla' | 'bims';
export type UnitFloorType = 'normal' | 'ground' | 'basement' | 'roof';

export interface RoomProperties {
    ceilingHeight?: number; // Optional: if undefined, use floor height
    windowArea: number;
    windowWallThickness?: number;
    doorCount: number;
    doorWallThickness?: number;
    hasCornice: boolean;
    hasWaterproofing?: boolean; // YENİ EKLENEN ÖZELLİK
   hasSuspendedCeiling?: boolean;
    floorType: 'parke' | 'seramik' | 'beton' | 'unknown';
    wallFinish: 'boya' | 'seramik' | 'unknown';
}

export interface WallProperties {
    material: WallMaterial;
    thickness: number; // cm
    height?: number; // m (Optional manual height override)
    isUnderBeam: boolean;
    beamHeight: number; // cm
}

export interface SalePlan {
    id: string;
    name: string;
    amount: number;
    month: number;
    saleDate?: string; // YENİ EKLENEN SATIR (Örn: "2025-03")
    vatRate?: number;
}

export interface ProgressPayment {
    id: string;
    taskId: string; // projectSchedule içindeki task.id ile eşleşecek
    percentage: number; // Toplam sözleşme bedelinin yüzde kaçı? (Örn: 20)
}

export interface FinancialSettings {
    monthlyInterestRate: number; // Aylık enflasyon veya faiz oranı (%)
    monthlyInflationRate?: number; // YENİ: Aylık İnşaat Maliyet Artış Endeksi (%)
    systemMonthlyInterestRate?: number; // YENİ: Sistemden gelen orijinal faiz oranı
    systemMonthlyInflationRate?: number; // YENİ: Sistemden gelen orijinal enflasyon oranı
    fixedPriceTaskIds?: string[]; // YENİ: Fiyatı baştan anlaşılan (sabitlenen) iş kalemlerinin ID'leri
    sales: SalePlan[];

    revenueModel?: 'yap_sat' | 'taahhut'; // Gelir modeli seçimi
    progressPayments?: ProgressPayment[]; // Hakediş planlaması
}

export interface CustomCostItem {
    id: string;
    name: string;
    price: number;
}

export interface ColumnProperties {
    type: 'kolon' | 'perde';
    height?: number; // m (Optional: if undefined, use floor height)
    connectingBeamHeight?: number;
}

export interface BeamProperties {
    width: number; // cm
    height: number; // cm
    slabThickness: number; // cm
}

export interface SlabProperties {
    type: 'plak' | 'asmolen' | 'mantar';
    thickness: number; // cm
}

export type Room = {
    id: string;
    name: string;
    points: Point[];
    area_px: number;
    perimeter_px: number;
    manualAreaM2?: number;
    manualPerimeterM?: number;
    type: RoomType;
    properties: RoomProperties;
};

export type Wall = {
    id: string;
    startPoint: Point;
    endPoint: Point;
    length_px: number;
    manualLengthM?: number; // New: For manual input without drawing
    properties: WallProperties;
};

export type Column = {
    id: string;
    points: Point[];
    area_px: number;
    perimeter_px: number;
    manualAreaM2?: number; // New
    manualPerimeterM?: number; // New
    properties: ColumnProperties;
};

export type Beam = {
    id: string;
    startPoint: Point;
    endPoint: Point;
    length_px: number;
    manualLengthM?: number; // New
    properties: BeamProperties;
};

export type Slab = {
    id: string;
    // Geometry for drawing
    points?: Point[];
    area_px?: number;
    perimeter_px?: number;
    // Manual override
    manualAreaM2: number;
    properties: SlabProperties;
};

export interface UnitType {
    id: string;
    name: string;
    floorType: UnitFloorType;
    count: number;
    rooms: Room[];
    walls: Wall[];
    columns: Column[];
    beams: Beam[];
    slabs: Slab[]; // New: Slabs
    imageData: string | null;
    scale: number;
    lastEdited: number;
    // Split sources
    structuralWallSource: 'global_calculated' | 'detailed_unit';
    structuralConcreteSource: 'global_calculated' | 'detailed_unit';
}
export type HeatingSystem = 'radiator' | 'underfloor' | 'heat_pump' | 'vrf';

export type ConcreteClass = 'C25' | 'C30' | 'C35' | 'C40';
export type GlobalSlabType = 'plak' | 'asmolen' | 'mantar';

export interface BuildingStats {

    buildingType?: 'apartment' | 'villa';

    visitedTabs?: string[];
    outerWallThickness?: number;
    innerWallThickness?: number;

    poolArea?: number;       // Havuz alanı (m2)
    parkingArea?: number;    // Açık otopark alanı (m2)
    verandaArea?: number;    // Veranda / Kış bahçesi alanı (m2)
    subasmanHeight?: number;
    roofTerraceArea?: number;

    indoorParkingArea?: number; 
    indoorParkingFloor?: 'basement' | 'ground' | 'normal';
    indoorParkingPerimeter?: number;
    isIndoorParkingPerimeterManual?: boolean;

    shelterArea?: number;       
    shelterFloor?: 'basement' | 'ground' | 'normal';
    shelterPerimeter?: number;
    isShelterPerimeterManual?: boolean;

    hasRoofFloor?: boolean;
    roofFloorArea?: number;
    roofFloorHeight?: number; // Eğimden dolayı ortalama yükseklik
    roofFloorMaxHeight?: number;
    roofFloorPerimeter?: number;
    isRoofPerimeterManual?: boolean;
    isRoofHeightManual?: boolean;

    hasSmartHome?: boolean;
    smartHomeLighting?: boolean;
    smartHomeHeating?: boolean;
    smartHomeSensors?: boolean;
    smartHomeBlinds?: boolean;

    hasElevator?: boolean;

    province: string;
    district: string;
    landArea: number;
    heatZone: number;
    earthquakeZone?: number;
    isEarthquakeZoneManual?: boolean;
    normalFloorCount: number;
    basementFloorCount: number;
    normalFloorHeight: number;
    groundFloorHeight: number;
    basementFloorHeight: number;
    normalFloorArea: number;
    groundFloorArea: number;
    basementFloorArea: number;

    hasWellFoundation?: boolean; // Kuyu temel yapılacak mı?
    wellFoundationArea?: number; // Manuel girilecek kuyu temel cephe alanı (m2)

    hasExistingBuilding?: boolean;

    soilType?: 'soft' | 'medium' | 'hard';

    totalArea: number; // Metrekare üzerinden hesaplama yapmak için
    heatingSystem: HeatingSystem;

    normalFloorPerimeter?: number;
    groundFloorPerimeter?: number;
    basementFloorPerimeter?: number;
    isNormalPerimeterManual?: boolean;
    isGroundPerimeterManual?: boolean;
    isBasementPerimeterManual?: boolean;

    normalFloorHallArea: number;
    groundFloorHallArea: number;
    basementFloorHallArea: number;
    isNormalHallManual?: boolean;
    isGroundHallManual?: boolean;
    isBasementHallManual?: boolean;
    isHallManual?: boolean;

    constructionDuration?: number; // Manuel girilen süre
    isDurationManual?: boolean;    // Manuel mod aktif mi?

    projectStartDate?: string;

    constructionModel?: 'standard' | 'kat_karsiligi'; // İnşaat Modeli
    contractorShare?: number;
    isUrbanTransformation?: boolean; // Kentsel Dönüşüm (Riskli Yapı) var mı?
    hasAllRiskInsurance?: boolean;
    existingUnitCount?: number;     // Yıkılacak mevcut bağımsız bölüm (daire/dükkan) sayısı
    existingArea?: number;
    monthlyRentPerUnit?: number;    // Daire başı aylık NET ödenecek kira yardımı (TL)
    evictionCostPerUnit?: number;   // Daire başı tek seferlik taşınma/tahliye yardımı (TL)
    includeRentCost?: boolean;      // Bu masraflar genel maliyete dahil edilsin mi?
}

// Persistence Interface
export interface SavedProject {
    id: string;
    name: string;
    lastModified: number;
    data: {
        units: UnitType[];
        structuralUnits: UnitType[];
        buildingStats: BuildingStats;
        customCosts?: CustomCostItem[];
        costs: any[]; // Stores custom prices
        duplexPairs?: DuplexPair[];
        globalSettings: {
            wallMode: 'auto' | 'detailed';
            concreteMode: 'auto' | 'detailed';
            wallMaterial: WallMaterial;
            wallThickness: number;
        }
        financialSettings?: FinancialSettings;
    }
}

export interface DuplexPair {
    id: string;
    lowerUnitId: string;
    upperUnitId: string;
    count: number;
}

export interface ScheduleTaskOverride {
    taskId: string;
    manualStartDelay?: number; // Otomatik tarihten kaç hafta sonra/önce (offset)
    manualDuration?: number;   // Manuel süre

    manualDependencies?: string[]; // Manuel olarak atanan öncül görev ID'leri
    manualDependencyType?: 'finish_to_start' | 'start_to_start'; // İlişki tipi
    manualLagWeeks?: number; // Bekleme süresi
}

// Mevcut BuildingStats interface'inin altına ekleyin veya ayrı bir interface yapın
export interface ReportSettings {
    firmName: string;
    clientName: string;
    projectDescription: string;
    firmLogo: string | null; // Base64 data URL
    projectRender: string | null; // Base64 data URL
    showUnitDetails: boolean; // Daire detaylarını raporda gösterelim mi?
    profitMargin: number;
    selectedBrands: Record<string, string[]>;

    includeBuildingDetails: boolean;
    includeCashflow: boolean;
    includeProcurement: boolean;
    includeSchedule: boolean;
    includeRiskAnalysis: boolean;
    includeQuantityBreakdown: boolean;
}
