// Dosya: src/utils/scheduleCalculator.ts

import { BuildingStats, ScheduleTaskOverride } from '../types';

export interface ScheduleItem {
    id: string;
    name: string;
    durationWeeks: number;
    startWeek: number;
    endWeek: number;
    startDate: Date;
    endDate: Date;
    dependencies: string[];
    dependencyType: 'finish_to_start' | 'start_to_start';
    lagWeeks: number;
    color: string;
    isCritical?: boolean;
    criticality?: 'critical' | 'partial' | 'normal';
    floatWeeks?: number;
}

const addWeeks = (date: Date, weeks: number) => {
    const result = new Date(date);
    result.setDate(result.getDate() + (weeks * 7));
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

    // YENİ: Ortalama kat alanını hesapla
    const averageFloorArea = totalArea / Math.max(1, totalFloors);

    // YENİ: Kat alanı çarpanı oluştur. (Örneğin standart kat alanı 200m2 kabul edilip oranlanırsa)
    // Eğer kat 200m2 ise çarpan 1 olur. 400m2 ise 2 olur.
    // Çok küçük binalarda da belirli bir sabit süre olması için min() sınırı koyulabilir.
    const areaFactor = Math.max(0.8, averageFloorArea / 200);

    const durOfficial = Math.min(24, Math.max(12, Math.ceil(12 + (totalArea / 500))));

    const durSitePrep = 2;

    // Hafriyat alanı ve derinliği (bodrum) hesaba katar
    let baseExcavation = Math.max(2, Math.ceil(2 * basementFactor * (Math.max(1, totalArea / 500))));
    let soilFactor = 1.0;
    if (buildingStats.soilType === 'hard') soilFactor = 3.0; // Kaya zemin 3 kat uzun sürer
    else if (buildingStats.soilType === 'medium') soilFactor = 1.5;

    const durExcavation = Math.ceil(baseExcavation * soilFactor);

    // Kaba yapı: Kat Sayısı * (Temel Kat Süresi) * (Alan Çarpanı)
    const durStructure = Math.ceil(totalFloors * 2.5 * areaFactor);

    const durRoof = Math.max(2, Math.ceil(3 * (averageFloorArea / 200)));
    const durWalls = Math.ceil(durStructure * 0.7);
    const durMEP_Rough = Math.ceil(totalFloors * 1 * areaFactor);
    const durFacade = Math.ceil(totalFloors * 1.5 * areaFactor);
    const durPlaster = Math.ceil(durWalls * 0.8);
    const durScreed = Math.ceil(totalFloors * 1 * areaFactor);
    const durCoatings = Math.ceil(totalFloors * 1.5 * areaFactor);
    const durPaint = Math.ceil(totalFloors * 1 * areaFactor);
    const durJoinery = Math.ceil(totalFloors * 1 * areaFactor);
    const durMEP_Finish = Math.ceil(totalFloors * 0.8 * areaFactor);
    const durLandscape = Math.ceil(3 * Math.max(1, totalArea / 1000));
    const durHandover = 2;

    // Varsayılan Görev Listesi
    let defaultTasks: Partial<ScheduleItem>[] = [
        { id: 'official', name: 'Projelendirme ve Ruhsat', durationWeeks: durOfficial, color: 'bg-slate-500', dependencies: [] },
        { id: 'site_prep', name: 'Şantiye Kurulumu', durationWeeks: durSitePrep, color: 'bg-slate-600', dependencies: ['official'], dependencyType: 'start_to_start', lagWeeks: 2 },
        { id: 'excavation', name: 'Hafriyat ve İksa', durationWeeks: durExcavation, color: 'bg-amber-700', dependencies: ['official'], dependencyType: 'finish_to_start', lagWeeks: 0 },
        { id: 'structure', name: 'Kaba Yapı (Betonarme)', durationWeeks: durStructure, color: 'bg-yellow-600', dependencies: ['excavation'], dependencyType: 'finish_to_start', lagWeeks: 0 },
        { id: 'roof', name: 'Çatı Konstrüksiyon ve Kaplama', durationWeeks: durRoof, color: 'bg-rose-700', dependencies: ['structure'], dependencyType: 'finish_to_start', lagWeeks: 0 },
        { id: 'walls', name: 'Duvar Örümü', durationWeeks: durWalls, color: 'bg-blue-600', dependencies: ['structure'], dependencyType: 'start_to_start', lagWeeks: 4 },
        { id: 'mep_rough', name: 'Mekanik & Elektrik Altyapı', durationWeeks: durMEP_Rough, color: 'bg-cyan-600', dependencies: ['walls'], dependencyType: 'start_to_start', lagWeeks: 2 },

        // DÜZELTME 1: Dış cephe ve İç Sıva/Alçı işleri Çatı kapandıktan sonra (veya çatıyla bağlantılı olarak) başlasın.
        { id: 'facade', name: 'Dış Cephe ve Pencereler', durationWeeks: durFacade, color: 'bg-indigo-500', dependencies: ['walls', 'roof'], dependencyType: 'finish_to_start', lagWeeks: 0 },
        { id: 'plaster', name: 'Sıva ve Alçı İşleri', durationWeeks: durPlaster, color: 'bg-stone-400', dependencies: ['mep_rough', 'roof'], dependencyType: 'finish_to_start', lagWeeks: 0 },

        { id: 'screed', name: 'Zemin Şapı', durationWeeks: durScreed, color: 'bg-stone-600', dependencies: ['plaster'], dependencyType: 'start_to_start', lagWeeks: 2 },
        { id: 'flooring', name: 'Seramik ve Parke', durationWeeks: durCoatings, color: 'bg-purple-600', dependencies: ['screed'], dependencyType: 'finish_to_start', lagWeeks: 2 },
        { id: 'paint', name: 'Boya İşleri', durationWeeks: durPaint, color: 'bg-pink-500', dependencies: ['plaster'], dependencyType: 'finish_to_start', lagWeeks: 3 },
        { id: 'joinery', name: 'Kapı, Mutfak ve Mobilya', durationWeeks: durJoinery, color: 'bg-amber-800', dependencies: ['flooring', 'paint'], dependencyType: 'finish_to_start', lagWeeks: 0 },
        { id: 'mep_finish', name: 'Mekanik & Elektrik Montaj', durationWeeks: durMEP_Finish, color: 'bg-teal-500', dependencies: ['paint'], dependencyType: 'finish_to_start', lagWeeks: 1 },
        { id: 'landscape', name: 'Çevre Düzenleme ve Peyzaj', durationWeeks: durLandscape, color: 'bg-lime-600', dependencies: ['facade'], dependencyType: 'finish_to_start', lagWeeks: 0 },
        { id: 'handover', name: 'Temizlik ve Teslim', durationWeeks: durHandover, color: 'bg-emerald-600', dependencies: ['joinery', 'mep_finish', 'landscape', 'roof'], dependencyType: 'finish_to_start', lagWeeks: 0 }
    ];

    const scheduleMap = new Map<string, ScheduleItem>();

    // Override'ları Uygula (Süre ve Bağımlılıklar)
    const tasks = defaultTasks.map(t => {
        const override = overrides[t.id!];
        if (override) {
            // Süre Override
            if (override.manualDuration) t.durationWeeks = override.manualDuration;

            // Bağımlılık Override (Varsa listeyi tamamen değiştirir)
            if (override.manualDependencies) {
                t.dependencies = override.manualDependencies;
                // İlişki tipi ve lag override edilirse kullan, yoksa varsayılanı koru
                if (override.manualDependencyType) t.dependencyType = override.manualDependencyType;
                if (override.manualLagWeeks !== undefined) t.lagWeeks = override.manualLagWeeks;
            }
        }
        return t;
    });

    // Hesaplama (Forward Pass)
    tasks.forEach(task => {
        let calculatedStartWeek = 0;

        if (task.dependencies && task.dependencies.length > 0) {
            const depEndWeeks: number[] = [];

            task.dependencies.forEach(depId => {
                const depTask = scheduleMap.get(depId);
                if (depTask) {
                    if (task.dependencyType === 'start_to_start') {
                        depEndWeeks.push(depTask.startWeek + (task.lagWeeks || 0));
                    } else {
                        depEndWeeks.push(depTask.endWeek + (task.lagWeeks || 0));
                    }
                }
            });

            if (depEndWeeks.length > 0) {
                calculatedStartWeek = Math.max(...depEndWeeks);
            }
        }

        if (task.id && overrides[task.id]?.manualStartDelay) {
            calculatedStartWeek += overrides[task.id].manualStartDelay!;
        }

        calculatedStartWeek = Math.max(0, calculatedStartWeek);

        const newItem: ScheduleItem = {
            id: task.id!,
            name: task.name!,
            durationWeeks: task.durationWeeks!,
            startWeek: calculatedStartWeek,
            endWeek: calculatedStartWeek + task.durationWeeks!,
            startDate: addWeeks(startDate, calculatedStartWeek),
            endDate: addWeeks(startDate, calculatedStartWeek + task.durationWeeks!,),
            dependencies: task.dependencies || [],
            dependencyType: task.dependencyType as any || 'finish_to_start',
            lagWeeks: task.lagWeeks || 0,
            color: task.color!,
            isCritical: false,
            criticality: 'normal',
            floatWeeks: 0
        };

        scheduleMap.set(newItem.id, newItem);
    });

    // Kritik Yol Analizi (Backward Pass)
    const allItems = Array.from(scheduleMap.values());
    const projectEndWeek = Math.max(...allItems.map(i => i.endWeek));
    const successorsMap = new Map<string, ScheduleItem[]>();

    allItems.forEach(item => {
        item.dependencies.forEach(depId => {
            if (!successorsMap.has(depId)) successorsMap.set(depId, []);
            successorsMap.get(depId)?.push(item);
        });
    });

    // YENİ EKLENEN: DFS tabanlı kesin Late Start / Late Finish algoritması
    const lateStartMap = new Map<string, number>();
    const lateFinishMap = new Map<string, number>();
    const visitedForBackwardPass = new Set<string>();

    const getLateDates = (taskId: string): { ls: number, lf: number } => {
        if (lateStartMap.has(taskId)) {
            return { ls: lateStartMap.get(taskId)!, lf: lateFinishMap.get(taskId)! };
        }

        const task = scheduleMap.get(taskId);
        if (!task) return { ls: projectEndWeek, lf: projectEndWeek };

        if (visitedForBackwardPass.has(taskId)) {
            // Döngüsel (Circular) bağımlılık koruması
            return { ls: projectEndWeek - task.durationWeeks, lf: projectEndWeek };
        }
        visitedForBackwardPass.add(taskId);

        const successors = successorsMap.get(taskId) || [];

        // Eğer bu göreve bağlı başka bir görev yoksa, projenin en sonuna kadar sarkabilir
        if (successors.length === 0) {
            const lf = projectEndWeek;
            const ls = lf - task.durationWeeks;
            lateStartMap.set(taskId, ls);
            lateFinishMap.set(taskId, lf);
            visitedForBackwardPass.delete(taskId);
            return { ls, lf };
        }

        let calculatedLateFinish = projectEndWeek;

        // Bağlı olduğu tüm alt görevlerin Late tarihlerini önce hesapla
        const succDates = successors.map(s => ({
            task: s,
            dates: getLateDates(s.id)
        }));

        // Finish-to-Start (Bitiş-Başlangıç) Kısıtlamaları
        const fsConstraints = succDates
            .filter(s => s.task.dependencyType === 'finish_to_start')
            .map(s => s.dates.ls - (s.task.lagWeeks || 0));

        if (fsConstraints.length > 0) {
            calculatedLateFinish = Math.min(...fsConstraints);
        }

        let calculatedLateStart = calculatedLateFinish - task.durationWeeks;

        // Start-to-Start (Başlangıç-Başlangıç) Kısıtlamaları
        const ssConstraints = succDates
            .filter(s => s.task.dependencyType === 'start_to_start')
            .map(s => s.dates.ls - (s.task.lagWeeks || 0));

        if (ssConstraints.length > 0) {
            calculatedLateStart = Math.min(calculatedLateStart, ...ssConstraints);
        }

        calculatedLateFinish = calculatedLateStart + task.durationWeeks;

        lateStartMap.set(taskId, calculatedLateStart);
        lateFinishMap.set(taskId, calculatedLateFinish);
        visitedForBackwardPass.delete(taskId);

        return { ls: calculatedLateStart, lf: calculatedLateFinish };
    };

    // Tüm görevler için Late Start / Late Finish tarihlerini hesapla
    allItems.forEach(item => getLateDates(item.id));

    // Float ve Kritik Yol ataması
    allItems.forEach(task => {
        const ls = lateStartMap.get(task.id)!;
        const float = ls - task.startWeek;
        task.floatWeeks = float;

        const forcedCriticalIds = ['official', 'excavation', 'structure', 'handover'];
        if (forcedCriticalIds.includes(task.id)) {
            task.criticality = 'critical'; task.isCritical = true; task.color = 'bg-red-600';
        } else {
            if (float <= 0.1) {
                task.criticality = 'critical'; task.isCritical = true; task.color = 'bg-red-600';
            } else if (float <= 2) {
                task.criticality = 'partial'; task.color = 'bg-orange-500';
            } else {
                task.criticality = 'normal';
            }
        }
    });

    return allItems.sort((a, b) => a.startWeek - b.startWeek);
};