import React, { useState, useRef, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { ScheduleDependencyModal } from '../Modals/ScheduleDependencyModal';

export const ProjectSchedulePanel: React.FC = () => {
    // DOĞRUSU: Sadece useProjectStore içinden çekiyoruz. Hatalı projectStore satırı silindi.
    const {
        projectSchedule: schedule,
        buildingStats,
        scheduleOverrides,
        updateScheduleOverride,
        setProjectStartDate,
        resetSchedule
    } = useProjectStore();

    const [isExpanded, setIsExpanded] = useState(false);
    const [showDependencies, setShowDependencies] = useState(false);

    // --- MOUSE VE HOVER STATE ---
    const [hoverWeek, setHoverWeek] = useState<number | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // schedule array'i boş gelirse diye güvenlik önlemi (fallback) eklendi
    const safeSchedule = schedule || [];
    const totalWeeks = Math.max(...safeSchedule.map(s => s.endWeek), 0) + 4; // +4 buffer

    const projectEndDate = useMemo(() => {
        if (safeSchedule.length === 0) return null;
        // Schedule içindeki en büyük endDate'i bul
        return safeSchedule.reduce((max, item) => item.endDate > max ? item.endDate : max, safeSchedule[0].endDate);
    }, [safeSchedule]);

    const defaultDate = buildingStats.projectStartDate
        ? new Date(buildingStats.projectStartDate).toISOString().split('T')[0]
        : new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().split('T')[0];

    // --- AKSİYONLAR ---
    const handleDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setProjectStartDate(e.target.value);
    };

    // İleri Geri Öteleme
    const handleShift = (taskId: string, amount: number) => {
        const currentOverride = scheduleOverrides[taskId]?.manualStartDelay || 0;
        updateScheduleOverride(taskId, { manualStartDelay: currentOverride + amount });
    };

    // Süre Uzatma / Kısaltma (Resize)
    const handleDurationChange = (taskId: string, amount: number) => {
        const item = safeSchedule.find(s => s.id === taskId);
        if (!item) return;
        const currentDuration = scheduleOverrides[taskId]?.manualDuration || item.durationWeeks;
        const newDuration = Math.max(1, currentDuration + amount); // Min 1 hafta
        updateScheduleOverride(taskId, { manualDuration: newDuration });
    };

    // Mouse Hareketi ile Düşey Çizgi Hesabı
    const handleMouseMove = (e: React.MouseEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const x = e.clientX - rect.left;

        const scrollContainer = containerRef.current;
        const contentWidth = scrollContainer.scrollWidth;

        const labelWidth = window.innerWidth >= 768 ? 256 : 160;
        if (x < labelWidth) {
            setHoverWeek(null);
            return;
        }

        const timelineWidth = contentWidth - labelWidth;
        const relativeX = (x + scrollContainer.scrollLeft) - labelWidth;

        const percent = Math.max(0, Math.min(1, relativeX / timelineWidth));
        const week = percent * totalWeeks;

        setHoverWeek(week);
    };

    const handleMouseLeave = () => {
        setHoverWeek(null);
    };

    return (
        <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl shadow-lg transition-colors duration-300 overflow-hidden relative">
            <button
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full p-4 md:p-6 flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 hover:bg-slate-100 dark:hover:bg-slate-700/50 transition"
            >
                <div className="flex items-center gap-3">
                    <div className="bg-white dark:bg-slate-800 p-2 rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm">
                        <i className="fas fa-calendar-alt text-blue-600 dark:text-blue-400 text-xl"></i>
                    </div>
                    <div className="text-left">
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white">Proje İş Zaman Programı</h2>
                        <p className="text-xs text-slate-500 dark:text-slate-400">Detaylı iş akışı, kritik yol analizi ve tarihler</p>
                    </div>
                </div>
                <div className={`transform transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                    <i className="fas fa-chevron-down text-slate-400"></i>
                </div>
            </button>

            {isExpanded && (
                <div className="p-4 md:p-6 border-t border-slate-200 dark:border-slate-700 animate-fadeIn bg-white dark:bg-slate-900">
                    {buildingStats.isScheduleOutdated && (
                        <div className="mb-4 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 p-4 rounded-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm">
                            <div className="flex items-start gap-3">
                                <div className="bg-orange-100 dark:bg-orange-800/50 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                                    <i className="fas fa-exclamation-triangle text-orange-600 dark:text-orange-400 text-lg"></i>
                                </div>
                                <div>
                                    <h4 className="font-bold text-orange-800 dark:text-orange-300 text-sm">Yapı Bilgileri Değişti!</h4>
                                    <p className="text-xs text-orange-700/80 dark:text-orange-400/80 mt-1 leading-relaxed">
                                        Proje alanı veya kat sayısı değiştirildi ancak takviminizdeki <b>manuel kilitler (el ile süre değiştirmeleriniz)</b> nedeniyle inşaat süresi yeni yapı alanına göre güncellenemiyor.
                                    </p>
                                </div>
                            </div>
                            <button
                                onClick={resetSchedule}
                                className="w-full md:w-auto bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-lg text-xs font-bold transition shadow-md whitespace-nowrap flex items-center justify-center gap-2 active:scale-95"
                            >
                                <i className="fas fa-unlock-alt"></i> Kilitleri Çöz & Oto Dağıt
                            </button>
                        </div>
                    )}

                    <div className="flex flex-col md:flex-row justify-between items-center mb-6 gap-4 bg-slate-50 dark:bg-slate-800/50 p-3 md:p-4 rounded-lg border border-slate-200 dark:border-slate-700">

                        {/* Tarihler - Mobilde Yan Yana */}
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="flex flex-col gap-1 flex-1 md:flex-none">
                                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Başlangıç</label>
                                <input
                                    type="date"
                                    value={defaultDate}
                                    onChange={handleDateChange}
                                    className="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded px-2 md:px-3 py-1.5 text-sm text-slate-800 dark:text-white outline-none focus:border-blue-500"
                                />
                            </div>

                            <div className="flex flex-col gap-1 flex-1 md:flex-none">
                                <label className="text-[10px] uppercase font-bold text-slate-500 dark:text-slate-400">Tahmini Bitiş</label>
                                <div className="w-full bg-slate-200 dark:bg-slate-700 border border-slate-300 dark:border-slate-600 rounded px-2 md:px-3 py-1.5 text-sm text-slate-700 dark:text-slate-300 font-mono cursor-not-allowed text-center md:text-left truncate">
                                    {projectEndDate ? projectEndDate.toLocaleDateString('tr-TR') : '-'}
                                </div>
                            </div>
                        </div>

                        {/* Toplam Süre & Buton - Mobilde Alt Satırda */}
                        <div className="flex items-center justify-between w-full md:w-auto gap-3 border-t md:border-0 border-slate-200 dark:border-slate-700 pt-3 md:pt-0">
                            <div className="text-left md:text-right">
                                <span className="block text-[10px] md:text-xs font-bold text-slate-700 dark:text-slate-300 uppercase">Toplam Süre</span>
                                <span className="text-[10px] md:text-sm font-mono text-slate-500 leading-none">{(totalWeeks / 4.33).toFixed(1)} Ay <span className="hidden sm:inline">({totalWeeks.toFixed(1)} Hf)</span></span>                            </div>
                            <button
                                onClick={() => setShowDependencies(true)}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-3 md:px-4 py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-2 transition shadow-md flex-1 md:flex-none"
                            >
                                <i className="fas fa-project-diagram"></i>
                                Bağımlılıklar
                            </button>
                        </div>
                    </div>

                    {/* TIMELINE CONTAINER */}
                    <div className="md:hidden text-[10px] text-slate-400 mb-2 flex items-center justify-end animate-pulse pr-2">
                        <i className="fas fa-arrows-alt-h mr-1"></i> Tabloyu sağa kaydırın
                    </div>
                    <div
                        ref={containerRef}
                        onMouseMove={handleMouseMove}
                        onMouseLeave={handleMouseLeave}
                        className="relative w-full overflow-x-auto custom-scrollbar pb-2 select-none cursor-crosshair hide-scrollbar"
                    >
                        <div className="min-w-[800px] md:min-w-[1000px] w-full relative">
                            {/* DÜŞEY KILAVUZ ÇİZGİSİ */}
                            {hoverWeek !== null && (
                                <div
                                    className="absolute top-8 bottom-0 w-0.5 bg-red-500/50 z-20 pointer-events-none border-l border-dashed border-red-500"
                                    style={{ left: `calc(160px + ${(hoverWeek / totalWeeks) * 100} * ((100% - 160px) / 100))` }}
                                >
                                    <div className="absolute -top-6 -left-10 bg-red-600 text-white text-[10px] px-2 py-1 rounded shadow font-bold whitespace-nowrap">
                                        Hafta: {Math.floor(hoverWeek)}
                                    </div>
                                </div>
                            )}

                            {/* RULER (Aylar - Dinamik Atlama Mantığı) */}
                            <div className="flex border-b border-slate-200 dark:border-slate-700 mb-2 pb-2 sticky top-0 bg-white dark:bg-slate-900 z-10">
                                <div className="w-40 md:w-64 shrink-0 font-bold text-[10px] md:text-xs text-slate-400 uppercase tracking-wider pl-2 border-r border-slate-100 dark:border-slate-800">İş Kalemi & Tarih</div>
                                <div className="flex-1 flex relative h-6">
                                    {(() => {
                                        const totalMonths = Math.ceil(totalWeeks / 4.33) + 1;

                                        // Ekrana rahatça sığabilecek maksimum ay etiketi sayısı (1000px genişlikte ortalama 12-14 adet sığar)
                                        const maxVisibleLabels = 20;

                                        // Eğer toplam ay sayısı maksimumdan fazlaysa 2'şer, 3'er atla
                                        const labelStep = Math.max(1, Math.ceil(totalMonths / maxVisibleLabels));

                                        return [...Array(totalMonths)].map((_, i) => {
                                            // Sadece hesaplanan adıma (step) uyan ayları yazdır. Geri kalanı boş bırak.
                                            if (i % labelStep !== 0) return null;

                                            const rulerDate = new Date(safeSchedule[0]?.startDate || new Date());
                                            rulerDate.setMonth(rulerDate.getMonth() + i);

                                            return (
                                                <div key={i} className="absolute text-[10px] font-bold text-slate-400 border-l border-slate-200 dark:border-slate-700 pl-1 h-full flex flex-col justify-between" style={{ left: `${(i * 4.33 / totalWeeks) * 100}%` }}>
                                                    {/* bg-white ile arkadaki çizgilerin metni kesmesi engellendi */}
                                                    <span className="whitespace-nowrap bg-white dark:bg-slate-900 pr-1">
                                                        {rulerDate.toLocaleDateString('tr-TR', { month: 'short', year: '2-digit' })}
                                                    </span>
                                                </div>
                                            );
                                        });
                                    })()}
                                </div>
                            </div>

                            {/* TASKS */}
                            <div className="space-y-4 relative">
                                {safeSchedule.map((item) => {
                                    const widthPercent = (item.durationWeeks / totalWeeks) * 100;
                                    const leftPercent = (item.startWeek / totalWeeks) * 100;

                                    const isPast = hoverWeek !== null && item.endWeek < hoverWeek;
                                    const opacityClass = isPast ? 'opacity-40 grayscale blur-[0.5px]' : 'opacity-100';

                                    return (
                                        <div key={item.id} className={`flex items-center group hover:bg-slate-50 dark:hover:bg-slate-800/30 rounded py-1 transition duration-300 ${opacityClass}`}>

                                            {/* Label Column (Mobilde Daraltıldı) */}
                                            <div className="w-40 md:w-64 shrink-0 pr-2 md:pr-4 pl-2 flex flex-col justify-center border-r border-slate-100 dark:border-slate-800 mr-2 relative z-30 bg-white dark:bg-slate-900">
                                                <div className="flex items-center gap-1 md:gap-2 overflow-hidden">
                                                    {item.isCritical && <i className="fas fa-exclamation-circle text-red-500 text-[10px] shrink-0 animate-pulse"></i>}
                                                    <div className={`font-bold text-[11px] md:text-sm truncate w-full ${item.isCritical ? 'text-red-600 dark:text-red-400' : 'text-slate-700 dark:text-slate-200'}`} title={item.name}>
                                                        {item.name}
                                                    </div>
                                                </div>
                                                <div className="text-[9px] md:text-[10px] text-slate-500 flex items-center gap-1 md:gap-2 mt-0.5 truncate">
                                                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{new Date(item.startDate).toLocaleDateString('tr-TR')}</span>
                                                    <i className="fas fa-arrow-right text-[7px] md:text-[8px]"></i>
                                                    <span className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{new Date(item.endDate).toLocaleDateString('tr-TR')}</span>
                                                </div>

                                                {/* KONTROLLER (Sadece Hover'da) */}
                                                <div className="hidden md:flex justify-between mt-1 opacity-0 group-hover:opacity-100 transition-opacity absolute right-2 top-0 bottom-0 items-center bg-white/90 dark:bg-slate-900/90 backdrop-blur-sm px-1 shadow-sm border border-slate-200 dark:border-slate-700 rounded">
                                                    <div className="flex gap-0.5 mr-2">
                                                        <button onClick={() => handleShift(item.id, -1)} className="hover:bg-blue-100 text-blue-600 px-1 rounded font-bold"><i className="fas fa-chevron-left"></i></button>
                                                        <button onClick={() => handleShift(item.id, 1)} className="hover:bg-blue-100 text-blue-600 px-1 rounded font-bold"><i className="fas fa-chevron-right"></i></button>
                                                    </div>
                                                    <div className="w-px h-3 bg-slate-300"></div>
                                                    <div className="flex gap-0.5 ml-2">
                                                        <button onClick={() => handleDurationChange(item.id, -1)} className="hover:bg-orange-100 text-orange-600 px-1 rounded font-bold"><i className="fas fa-minus"></i></button>
                                                        <button onClick={() => handleDurationChange(item.id, 1)} className="hover:bg-orange-100 text-orange-600 px-1 rounded font-bold"><i className="fas fa-plus"></i></button>
                                                    </div>
                                                </div>
                                            </div>

                                            {/* Timeline Bar */}
                                            <div className="flex-1 relative h-8 rounded-full overflow-visible">
                                                {item.dependencies && item.dependencies.length > 0 && (
                                                    <div
                                                        className="absolute top-1/2 left-0 h-px bg-slate-300 dark:bg-slate-600 border-t border-dashed border-slate-400 z-0"
                                                        style={{ width: `${leftPercent}%` }}
                                                    ></div>
                                                )}

                                                <div
                                                    className={`absolute top-1 bottom-1 rounded-md shadow-md ${item.color} flex items-center justify-between px-2 transition-all duration-300 z-10 border border-white/20`}
                                                    style={{ left: `${leftPercent}%`, width: `${widthPercent}%`, minWidth: '24px' }}
                                                >
                                                    <div className="w-1 h-3 bg-white/30 rounded-full cursor-col-resize opacity-0 group-hover:opacity-100"></div>
                                                    {widthPercent > 3 && (
                                                        <span className="text-[9px] font-bold text-white drop-shadow-md truncate text-center select-none">
                                                            {item.durationWeeks} Hf
                                                        </span>
                                                    )}
                                                    <div className="w-1 h-3 bg-white/30 rounded-full cursor-col-resize opacity-0 group-hover:opacity-100"></div>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>

                    {/* FOOTER İÇERİSİ */}
                    <div className="mt-4 border-t border-slate-200 dark:border-slate-700 pt-3 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 text-[10px] text-slate-500">
                        <div className="flex items-center gap-2">
                            <i className="fas fa-mouse-pointer text-blue-500"></i>
                            <span>İmleci görev üzerine getirerek <b>Başlangıç Tarihi</b> ve <b>İş Süresi</b> değişikliği yapabilirsiniz.</span>
                        </div>
                        <div className="flex items-center gap-3 bg-slate-100 dark:bg-slate-800 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700">
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-red-600 shadow-sm border border-white/20"></span>
                                <span className="font-bold text-red-600 dark:text-red-400">Kritik</span>
                            </div>
                            <div className="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-orange-500 shadow-sm border border-white/20"></span>
                                <span className="font-medium text-orange-600 dark:text-orange-400">Riskli</span>
                            </div>
                            <div className="w-px h-3 bg-slate-300 dark:bg-slate-600"></div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full bg-indigo-500 shadow-sm border border-white/20"></span>
                                <span className="font-medium text-slate-600 dark:text-slate-400">Normal</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Dependency Modal */}
            {showDependencies && (
                <ScheduleDependencyModal
                    schedule={safeSchedule}
                    onClose={() => setShowDependencies(false)}
                />
            )}
        </section>
    );
};