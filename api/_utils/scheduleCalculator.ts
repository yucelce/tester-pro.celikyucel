
import { BuildingStats, ScheduleTaskOverride } from '../../src/types';

export interface ScheduleItem {
    id: string;
    name: string;
    durationWeeks: number;
    durationDays: number;
    startWeek: number;
    endWeek: number;
    startDate: Date;
    startDay: number;
    endDate: Date;
    endDay: number;
    dependencies: string[];
    dependencyType: 'finish_to_start' | 'start_to_start';
    lagWeeks: number;
    lagDays: number;
    color: string;
    isCritical?: boolean;
    criticality?: 'critical' | 'partial' | 'normal';
    floatWeeks?: number;
    floatDays?: number;
}

const addDays = (date: Date, days: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + days);
    return result;
};

export const calculateConstructionSchedule = (
    totalArea: number,
    buildingStats: BuildingStats,
    totalDurationMonths: number,
    overrides: Record<string, ScheduleTaskOverride> = {}
): ScheduleItem[] => {

    let startDate = new Date();
    if (buildingStats.projectStartDate) {
        startDate = new Date(buildingStats.projectStartDate);
    } else {
        startDate.setMonth(startDate.getMonth() + 1);
    }

    const totalFloors = buildingStats.basementFloorCount + buildingStats.normalFloorCount + 1;
    const basementFactor = Math.max(1, buildingStats.basementFloorCount * 1.5);
    const averageFloorArea = totalArea / Math.max(1, totalFloors);
    const areaFactor = Math.max(0.8, Math.sqrt(averageFloorArea / 200));

    // BÜTÜN SÜRELER DAHA GERÇEKÇİ PİYASA HIZLARINA (FAST-TRACK) GÖRE OPTİMİZE EDİLDİ
    // Ruhsat eskiden 84-168 gündü. Şimdi 45-90 gün arası.
    const durOfficialDays = Math.min(90, Math.max(45, Math.ceil(45 + (totalArea / 1000) * 7)));
    const durSitePrepDays = 14;

    // Hafriyat eskiden çok uzundu (14 katsayısı 7'ye düşürüldü)
    let baseExcavationDays = Math.max(7, Math.ceil(7 * basementFactor * (Math.max(1, totalArea / 1000))));
    let soilFactor = 1.0;
    if (buildingStats.soilType === 'hard') soilFactor = 2.0;
    else if (buildingStats.soilType === 'medium') soilFactor = 1.2;

    const durExcavationDays = Math.ceil(baseExcavationDays * soilFactor);

    // Kaba yapı: Kat başına ortalama 10-12 gün
    const durStructureDays = Math.ceil(totalFloors * 12 * areaFactor);
    const durRoofDays = Math.max(14, Math.ceil(14 * (averageFloorArea / 200)));

    // İnce işler kat sayılarına oranlandı
    const durWallsDays = Math.ceil(durStructureDays * 0.6);
    const durMEP_RoughDays = Math.ceil(totalFloors * 5 * areaFactor);
    const durFacadeDays = Math.ceil(totalFloors * 8 * areaFactor);
    const durPlasterDays = Math.ceil(durWallsDays * 0.8);
    const durScreedDays = Math.ceil(totalFloors * 5 * areaFactor);
    const durCoatingsDays = Math.ceil(totalFloors * 8 * areaFactor);
    const durPaintDays = Math.ceil(totalFloors * 6 * areaFactor);
    const durJoineryDays = Math.ceil(totalFloors * 5 * areaFactor);
    const durMEP_FinishDays = Math.ceil(totalFloors * 4 * areaFactor);

    const isVilla = buildingStats.buildingType === 'villa';
    const durLandscapeDays = Math.ceil(14 * Math.max(1, totalArea / 1000));
    const durHandoverDays = 14;

    // Villa'ya özel süre katsayıları
    const durStructureVillaDays = Math.ceil(totalFloors * 14.0 * areaFactor);
    const durRoofVillaDays = Math.max(14, Math.ceil(21 * (averageFloorArea / 200)));
    const durFacadeVillaDays = Math.ceil(totalFloors * 10 * areaFactor);
    const durLandscapeVillaDays = Math.ceil(14 * Math.max(1, (buildingStats.landArea || 500) / 400));

    const durPoolVillaDays = (buildingStats.poolArea && buildingStats.poolArea > 0)
        ? Math.max(14, Math.ceil((buildingStats.poolArea / 15) * 5)) : 0;
    const durSmartHomeVillaDays = 14;

    let defaultTasks: Partial<ScheduleItem>[] = isVilla ? [
        // ===== VİLLA PROGRAMI =====
        { id: 'official', name: 'Projelendirme ve Ruhsat', durationDays: durOfficialDays, color: 'bg-slate-500', dependencies: [] },
        { id: 'site_prep', name: 'Şantiye Kurulumu', durationDays: durSitePrepDays, color: 'bg-slate-600', dependencies: ['official'], dependencyType: 'start_to_start', lagDays: Math.max(0, durOfficialDays - 14) },
        { id: 'excavation', name: 'Hafriyat ve Temel Kazısı', durationDays: durExcavationDays, color: 'bg-amber-700', dependencies: ['official'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'structure', name: 'Kaba Yapı (Betonarme)', durationDays: durStructureVillaDays, color: 'bg-yellow-600', dependencies: ['excavation'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'roof', name: 'Çatı Konstrüksiyonu', durationDays: durRoofVillaDays, color: 'bg-rose-700', dependencies: ['structure'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'walls', name: 'Duvar Örümü ve Bölmeler', durationDays: durWallsDays, color: 'bg-blue-600', dependencies: ['structure'], dependencyType: 'start_to_start', lagDays: 14 },
        { id: 'mep_rough', name: 'Mekanik & Elektrik Altyapı', durationDays: durMEP_RoughDays, color: 'bg-cyan-600', dependencies: ['walls'], dependencyType: 'start_to_start', lagDays: 7 },
        { id: 'facade', name: 'Dış Cephe (Doğal Taş / Sıva)', durationDays: durFacadeVillaDays, color: 'bg-indigo-500', dependencies: ['walls', 'roof'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'plaster', name: 'Sıva ve Alçı İşleri', durationDays: durPlasterDays, color: 'bg-stone-400', dependencies: ['mep_rough', 'roof'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'screed', name: 'Zemin Şapı ve Isıtma', durationDays: durScreedDays, color: 'bg-stone-600', dependencies: ['plaster'], dependencyType: 'start_to_start', lagDays: 7 },
        { id: 'flooring', name: 'Zemin Kaplamaları', durationDays: durCoatingsDays, color: 'bg-purple-600', dependencies: ['screed'], dependencyType: 'finish_to_start', lagDays: 7 },
        { id: 'paint', name: 'Boya ve Dekorasyon İşleri', durationDays: durPaintDays, color: 'bg-pink-500', dependencies: ['plaster'], dependencyType: 'finish_to_start', lagDays: 14 },
        { id: 'joinery', name: 'Kapı, Mutfak ve Özel Doğrama', durationDays: durJoineryDays, color: 'bg-amber-800', dependencies: ['flooring', 'paint'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'mep_finish', name: 'Mekanik & Elektrik Montaj', durationDays: durMEP_FinishDays, color: 'bg-teal-500', dependencies: ['paint'], dependencyType: 'finish_to_start', lagDays: 0 },
        ...(durPoolVillaDays > 0 ? [
            { id: 'pool', name: 'Havuz İnşaatı ve Mekanik', durationDays: durPoolVillaDays, color: 'bg-sky-500', dependencies: ['structure'], dependencyType: 'finish_to_start' as const, lagDays: 7 }
        ] : []),
        // Akıllı ev seçilmişse listeye ekle
        ...(buildingStats.hasSmartHome ? [
            { id: 'smart_home', name: 'Akıllı Ev Sistemi', durationDays: durSmartHomeVillaDays, color: 'bg-violet-500', dependencies: ['mep_rough'], dependencyType: 'finish_to_start' as const, lagDays: 7 }
        ] : []),
        { id: 'landscape', name: 'Peyzaj ve Çevre Düzenleme', durationDays: durLandscapeVillaDays, color: 'bg-lime-600', dependencies: ['facade'], dependencyType: 'finish_to_start', lagDays: 0 },
        // Handover (Teslim) görevinin dependencies (öncül görevler) dizisinde de smart_home'u koşullu yapıyoruz
        { id: 'handover', name: 'Temizlik ve Teslim', durationDays: durHandoverDays, color: 'bg-emerald-600', dependencies: ['joinery', 'mep_finish', 'landscape', ...(buildingStats.hasSmartHome ? ['smart_home'] : []), ...(durPoolVillaDays > 0 ? ['pool'] : [])], dependencyType: 'finish_to_start', lagDays: 0 }] : [
        // ===== APARTMAN PROGRAMI =====
        { id: 'official', name: 'Projelendirme ve Ruhsat', durationDays: durOfficialDays, color: 'bg-slate-500', dependencies: [] },
        { id: 'site_prep', name: 'Şantiye Kurulumu', durationDays: durSitePrepDays, color: 'bg-slate-600', dependencies: ['official'], dependencyType: 'start_to_start', lagDays: Math.max(0, durOfficialDays - 14) },
        { id: 'excavation', name: 'Hafriyat ve İksa', durationDays: durExcavationDays, color: 'bg-amber-700', dependencies: ['official'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'structure', name: 'Kaba Yapı (Betonarme)', durationDays: durStructureDays, color: 'bg-yellow-600', dependencies: ['excavation'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'roof', name: 'Çatı Konstrüksiyon ve Kaplama', durationDays: durRoofDays, color: 'bg-rose-700', dependencies: ['structure'], dependencyType: 'finish_to_start', lagDays: 0 },
        // Kaba yapıda ilk 2 kat bittiğinde duvar örümü hemen peşine takılır (28 günden 14 güne düşürüldü)
        { id: 'walls', name: 'Duvar Örümü', durationDays: durWallsDays, color: 'bg-blue-600', dependencies: ['structure'], dependencyType: 'start_to_start', lagDays: 14 },
        { id: 'mep_rough', name: 'Mekanik & Elektrik Altyapı', durationDays: durMEP_RoughDays, color: 'bg-cyan-600', dependencies: ['walls'], dependencyType: 'start_to_start', lagDays: 14 },
        { id: 'facade', name: 'Dış Cephe ve Pencereler', durationDays: durFacadeDays, color: 'bg-indigo-500', dependencies: ['walls', 'roof'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'plaster', name: 'Sıva ve Alçı İşleri', durationDays: durPlasterDays, color: 'bg-stone-400', dependencies: ['mep_rough', 'roof'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'screed', name: 'Zemin Şapı', durationDays: durScreedDays, color: 'bg-stone-600', dependencies: ['plaster'], dependencyType: 'start_to_start', lagDays: 14 },
        { id: 'flooring', name: 'Seramik ve Parke', durationDays: durCoatingsDays, color: 'bg-purple-600', dependencies: ['screed'], dependencyType: 'finish_to_start', lagDays: 7 }, // Eskiden 14'tü
        { id: 'paint', name: 'Boya İşleri', durationDays: durPaintDays, color: 'bg-pink-500', dependencies: ['plaster'], dependencyType: 'finish_to_start', lagDays: 14 }, // Eskiden 21'di
        { id: 'joinery', name: 'Kapı, Mutfak ve Mobilya', durationDays: durJoineryDays, color: 'bg-amber-800', dependencies: ['flooring', 'paint'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'mep_finish', name: 'Mekanik & Elektrik Montaj', durationDays: durMEP_FinishDays, color: 'bg-teal-500', dependencies: ['paint'], dependencyType: 'finish_to_start', lagDays: 0 }, // Eskiden 7'ydi
        { id: 'landscape', name: 'Çevre Düzenleme ve Peyzaj', durationDays: durLandscapeDays, color: 'bg-lime-600', dependencies: ['facade'], dependencyType: 'finish_to_start', lagDays: 0 },
        { id: 'handover', name: 'Temizlik ve Teslim', durationDays: durHandoverDays, color: 'bg-emerald-600', dependencies: ['joinery', 'mep_finish', 'landscape', 'roof'], dependencyType: 'finish_to_start', lagDays: 0 }
    ];

    const scheduleMap = new Map<string, ScheduleItem>();

    // Override'ları Uygula (Süre ve Bağımlılıklar)
    const tasks = defaultTasks.map(t => {
        const override = overrides[t.id!];
        if (override) {
            if (override.manualDuration) t.durationDays = override.manualDuration * 7;
            if (override.manualDependencies) {
                t.dependencies = override.manualDependencies;
                if (override.manualDependencyType) t.dependencyType = override.manualDependencyType;
                if (override.manualLagWeeks !== undefined) t.lagDays = override.manualLagWeeks * 7;
            }
        }
        return t;
    });

    // Hesaplama (Forward Pass)
    tasks.forEach(task => {
        let calculatedStartDay = 0;

        if (task.dependencies && task.dependencies.length > 0) {
            const depEndDays: number[] = [];

            task.dependencies.forEach(depId => {
                const depTask = scheduleMap.get(depId);
                if (depTask) {
                    if (task.dependencyType === 'start_to_start') {
                        depEndDays.push(depTask.startDay + (task.lagDays || 0));
                    } else {
                        depEndDays.push(depTask.endDay + (task.lagDays || 0));
                    }
                }
            });

            if (depEndDays.length > 0) {
                calculatedStartDay = Math.max(...depEndDays);
            }
        }

        if (task.id && overrides[task.id]?.manualStartDelay) {
            calculatedStartDay += overrides[task.id].manualStartDelay! * 7;
        }

        calculatedStartDay = Math.max(0, calculatedStartDay);

        const newItem: ScheduleItem = {
            id: task.id!,
            name: task.name!,
            durationDays: task.durationDays!,
            startDay: calculatedStartDay,
            endDay: calculatedStartDay + task.durationDays!,
            startDate: addDays(startDate, calculatedStartDay),
            endDate: addDays(startDate, calculatedStartDay + task.durationDays!),

            durationWeeks: Number((task.durationDays! / 7).toFixed(2)),
            startWeek: Number((calculatedStartDay / 7).toFixed(2)),
            endWeek: Number(((calculatedStartDay + task.durationDays!) / 7).toFixed(2)),

            dependencies: task.dependencies || [],
            dependencyType: task.dependencyType as any || 'finish_to_start',
            lagDays: task.lagDays || 0,
            lagWeeks: Number(((task.lagDays || 0) / 7).toFixed(2)),
            color: task.color!,
            isCritical: false,
            criticality: 'normal',
            floatDays: 0,
            floatWeeks: 0
        };

        scheduleMap.set(newItem.id, newItem);
    });

    // Kritik Yol Analizi (Backward Pass)
    const allItems = Array.from(scheduleMap.values());
    const projectEndDay = Math.max(...allItems.map(i => i.endDay));
    const successorsMap = new Map<string, ScheduleItem[]>();

    allItems.forEach(item => {
        item.dependencies.forEach(depId => {
            if (!successorsMap.has(depId)) successorsMap.set(depId, []);
            successorsMap.get(depId)?.push(item);
        });
    });

    const lateStartMap = new Map<string, number>();
    const lateFinishMap = new Map<string, number>();
    const visitedForBackwardPass = new Set<string>();

    const getLateDates = (taskId: string): { ls: number, lf: number } => {
        if (lateStartMap.has(taskId)) {
            return { ls: lateStartMap.get(taskId)!, lf: lateFinishMap.get(taskId)! };
        }

        const task = scheduleMap.get(taskId);
        if (!task) return { ls: projectEndDay, lf: projectEndDay };

        if (visitedForBackwardPass.has(taskId)) {
            // DÖNGÜ TESPİTİ: Projenin sonuna itmek yerine kendi erken başlama/bitiş tarihlerini veriyoruz.
            // Böylece kritik yol analizi (float = 0) bozulmamış oluyor.
            return { ls: task.startDay, lf: task.endDay };
        }
        visitedForBackwardPass.add(taskId);

        const successors = successorsMap.get(taskId) || [];

        if (successors.length === 0) {
            const lf = projectEndDay;
            const ls = lf - task.durationDays;
            lateStartMap.set(taskId, ls);
            lateFinishMap.set(taskId, lf);
            visitedForBackwardPass.delete(taskId);
            return { ls, lf };
        }

        let calculatedLateFinish = projectEndDay;

        const succDates = successors.map(s => ({
            task: s,
            dates: getLateDates(s.id)
        }));

        const fsConstraints = succDates
            .filter(s => s.task.dependencyType === 'finish_to_start')
            .map(s => s.dates.ls - (s.task.lagDays || 0));

        if (fsConstraints.length > 0) {
            calculatedLateFinish = Math.min(...fsConstraints);
        }

        let calculatedLateStart = calculatedLateFinish - task.durationDays;

        const ssConstraints = succDates
            .filter(s => s.task.dependencyType === 'start_to_start')
            .map(s => s.dates.ls - (s.task.lagDays || 0));

        if (ssConstraints.length > 0) {
            calculatedLateStart = Math.min(calculatedLateStart, ...ssConstraints);
        }

        lateStartMap.set(taskId, calculatedLateStart);
        lateFinishMap.set(taskId, calculatedLateFinish);
        visitedForBackwardPass.delete(taskId);

        return { ls: calculatedLateStart, lf: calculatedLateFinish };
    };

    allItems.forEach(item => getLateDates(item.id));

    allItems.forEach(task => {
        const ls = lateStartMap.get(task.id)!;
        const floatDays = ls - task.startDay;
        task.floatDays = floatDays;
        task.floatWeeks = Number((floatDays / 7).toFixed(2));

        const forcedCriticalIds = ['official', 'excavation', 'structure', 'handover'];
        if (forcedCriticalIds.includes(task.id)) {
            task.criticality = 'critical'; task.isCritical = true; task.color = 'bg-red-600';
        } else {
            if (floatDays <= 1) {
                task.criticality = 'critical'; task.isCritical = true; task.color = 'bg-red-600';
            } else if (floatDays <= 14) {
                task.criticality = 'partial'; task.color = 'bg-orange-500';
            } else {
                task.criticality = 'normal';
            }
        }
    });

    return allItems.sort((a, b) => a.startDay - b.startDay);
};