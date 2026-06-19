// src/components/Dashboard/DashboardView.tsx
import React from 'react';
import { getCategoryIcon } from '../../utils/icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { UnitFloorType, WallMaterial } from '../../types';
import { ProjectSchedulePanel } from './ProjectSchedulePanel';
import { NumericInput } from '../Shared/NumericInput';
import { generateProcurementPlan } from '../../utils/materialCalculator';
import { useMemo, useState } from 'react';
import { FinancialAnalysisPanel } from './FinancialAnalysisPanel';
import { ProcurementModal } from '../Modals/ProcurementModal';
import { TutorialOverlay } from '../Shared/TutorialOverlay';
import { exportCostsToExcel, importPricesFromExcel } from '../../utils/excelUtils';
import { DuplexManagerModal } from '../Modals/DuplexManagerModal';
import { ITEM_DESCRIPTIONS } from '../../../api/_utils/cost_data';
import { SupplierModal } from '../Modals/SupplierModal';
import { ArchitectModal } from '../Modals/ArchitectModal';


export const DashboardView: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const [showWarningsModal, setShowWarningsModal] = React.useState(false);
    const { startTutorial } = useUIStore();
    const [showDetailedModeInfo, setShowDetailedModeInfo] = useState(false);
    const [isHeaderPinned, setIsHeaderPinned] = useState(false);
    const [isStructuralPanelExpanded, setIsStructuralPanelExpanded] = useState(false);

    const [showArchitectModal, setShowArchitectModal] = useState(false);

    const handleWallModeClick = (targetMode: 'auto' | 'detailed') => {
        if (globalWallMode !== targetMode) {
            if (targetMode === 'detailed' && !sessionStorage.getItem('detailedModeWarningShown')) {
                setShowDetailedModeInfo(true);
                sessionStorage.setItem('detailedModeWarningShown', 'true');
                setTimeout(() => setShowDetailedModeInfo(false), 7000);
            }
            toggleWallMode();
        }
    };

    const handleConcreteModeClick = (targetMode: 'auto' | 'detailed') => {
        if (globalConcreteMode !== targetMode) {
            if (targetMode === 'detailed' && !sessionStorage.getItem('detailedModeWarningShown')) {
                setShowDetailedModeInfo(true);
                sessionStorage.setItem('detailedModeWarningShown', 'true');
                setTimeout(() => setShowDetailedModeInfo(false), 7000);
            }
            toggleConcreteMode();
        }
    };

    const handleLogout = () => {
        if (window.confirm("Sistemden çıkış yapmak istediğinize emin misiniz? (Kaydedilmeyen verileriniz kaybolabilir)")) {
            // LocalStorage'daki anahtarı sil
            localStorage.removeItem('cypro_api_key');
            // Kullanıcıyı Wix sitenizin ana sayfasına veya giriş sayfasına yönlendir
            window.location.href = "https://www.celikyucel.com";
        }
    };

    const {
        isCalculating,
        projectTotalCost, buildingStats, totalConstructionArea, constructionDuration,
        globalStructuralCost, interiorFitoutCost,
        projectCostDetails, units, structuralUnits, globalWallMode, globalConcreteMode, globalWallMaterial,
        addUnit, addStructuralUnit, deleteUnit, updateUnitCount, updateUnitName, updateUnitFloorType, toggleWallMode, toggleConcreteMode, setGlobalWallMaterial, updateCostItem,
        isDataDirty, recalculateCosts, dismissDataDirty, updateConstructionDuration, duplicateUnit, areaValidation,
        systemWarnings, applyAutoFix,
        customCosts, addCustomCost, updateCustomCost, removeCustomCost, projectSchedule, isPriceFetchError,
        globalStats, costs, bulkUpdatePrices, duplexPairs, toggleCostItemExclusion
    } = useProjectStore();

    const [showDuplexModal, setShowDuplexModal] = useState(false);

    const {
        navigateToEditor, openModal, expandedCategories, toggleCategory, toggleAllCategories, accountId,
        navigateToReport
    } = useUIStore();

    const hasManualOverrides = projectCostDetails.some(cat =>
        cat.items.some(item => item.manualQuantity !== undefined || item.manualPrice !== undefined)
    );

    // --- YENİ TEDARİK HESAPLAMASI VE GRUPLAMA ---
    const procurementList = useMemo(() => {
        const currentQuantities: Record<string, number> = {};
        projectCostDetails.forEach(cat => {
            cat.items.forEach(item => {
                currentQuantities[item.name] = item.finalQty;
            });
        });
        return generateProcurementPlan(globalStats || {}, currentQuantities, projectSchedule || [], costs, projectCostDetails);
    }, [globalStats, projectSchedule, costs, projectCostDetails]);

    const groupedProcurement = useMemo(() => {
        const groups: Record<string, { date: Date, taskName: string, items: any[], totalCost: number }> = {};
        procurementList.forEach(item => {
            const dateStr = item.deliveryDate.toISOString().split('T')[0];
            const key = `${dateStr}_${item.taskId}`;

            if (!groups[key]) {
                groups[key] = { date: item.deliveryDate, taskName: item.taskName, items: [], totalCost: 0 };
            }
            groups[key].items.push(item);
            groups[key].totalCost += item.totalPrice;
        });
        return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [procurementList]);

    const totalProcurementCost = procurementList.reduce((sum, item) => sum + item.totalPrice, 0);
    const topProcurementItems = [...procurementList].sort((a, b) => b.totalPrice - a.totalPrice).slice(0, 5);

    const [showProcurementModal, setShowProcurementModal] = useState(false);
    const [showSupplierModal, setShowSupplierModal] = useState(false);

    const LOCKED_ITEMS = [
        "Mimari Proje", "Statik Proje", "Mekanik Proje", "Elektrik Projesi",
        "Yapı Denetim Hizmet Bedeli", "Arsa Rayiç Bedeli (Maliyet)"
    ];

    return (
        <div
            className="flex h-screen flex-col bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-y-auto transition-colors duration-300 relative"
            onScroll={(e) => setIsHeaderPinned(e.currentTarget.scrollTop > 120)}
        >
            <div className={`fixed bottom-0 md:bottom-auto md:top-4 left-0 md:left-auto md:right-4 w-full md:w-auto z-[40] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md md:shadow-lg border-t md:border border-slate-200 dark:border-slate-700 md:rounded-xl py-1.5 px-3 md:p-2 transition-all duration-300 transform md:pointer-events-none flex justify-between md:flex-col items-center md:items-end ${isHeaderPinned ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 md:-translate-y-12 opacity-0 md:scale-95'}`}>
                <div className="text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Toplam Maliyet</div>
                <div className="text-base md:text-lg font-extrabold text-green-600 dark:text-green-500 tracking-tight leading-tight">
                    {isCalculating ? (
                        <span className="flex items-center gap-2 animate-pulse text-blue-500">
                            <i className="fas fa-circle-notch fa-spin"></i> İşleniyor...
                        </span>
                    ) : (
                        projectTotalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
                    )}
                </div>
            </div>

            <header id="dashboard-header" className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-4 md:p-6 shadow-sm dark:shadow-md z-30 transition-colors duration-300">
                <div className="flex flex-col md:flex-row justify-between items-center gap-4 md:gap-0 max-w-6xl mx-auto">
                    <div className="flex items-center gap-4 w-full md:w-auto">
                        <div className="w-12 h-14 md:w-14 md:h-16 flex items-center justify-center shrink-0">
                            <img
                                src="https://static.wixstatic.com/media/0ded6e_72f80a47c7854648ad37f65c0c5c9288~mv2.png/v1/crop/x_87,y_63,w_270,h_309/fill/w_84,h_98,al_c,q_85,usm_0.66_1.00_0.01,enc_avif,quality_auto/site%20logo%20yal%C4%B1n_edited_png%20Kopyas%C4%B1.png"
                                alt="CY Pro Logo"
                                className="w-full h-full object-contain"
                            />
                        </div>
                        <div>
                            <h1 className="text-xl md:text-2xl font-bold text-slate-900 dark:text-white leading-tight">CY Pro İnşaat <span className="text-blue-500 dark:text-blue-400">Manager</span></h1>
                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Yapı Maliyet ve Yönetim </p>
                        </div>
                    </div>

                    {/* YENİDEN DÜZENLENEN SAĞ TARAF (BUTONLAR VE MALİYET) */}
                    <div className="flex items-center gap-2 md:gap-4 w-full md:w-auto justify-between md:justify-end">
                        <div className="flex items-center gap-1.5 sm:gap-2 md:gap-4">
                            <button onClick={() => openModal('projectManagement')} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition border border-slate-200 dark:border-slate-700 flex items-center gap-2 shrink-0">
                                <i className="fas fa-folder-open text-blue-500 text-sm sm:text-base"></i>
                                <span className="hidden sm:inline">Projelerim</span>
                            </button>

                            <button
                                id="tour-report-btn"
                                onClick={navigateToReport}
                                className="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1.5 sm:px-4 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition flex items-center gap-2 border border-indigo-700 shadow-sm shrink-0"
                            >
                                <i className="fas fa-file-pdf text-sm sm:text-base"></i>
                                <span className="hidden sm:inline">Raporla</span>
                            </button>

                            <button
                                onClick={startTutorial}
                                className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition flex items-center gap-2 border border-indigo-200 dark:border-indigo-700/50 shrink-0"
                                title="Program Nasıl Kullanılır?"
                            >
                                <i className="fas fa-graduation-cap text-sm sm:text-base"></i>
                                <span className="hidden sm:inline">Nasıl Çalışır?</span>
                            </button>

                            <button onClick={toggleTheme} className="w-8 h-8 sm:w-10 sm:h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-yellow-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0">
                                <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'} text-xs sm:text-base`}></i>
                            </button>

                            <button
                                onClick={handleLogout}
                                className="bg-red-50 dark:bg-red-900/20 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-800 px-2 sm:px-3 py-1.5 sm:py-2 rounded-lg font-bold text-xs sm:text-sm transition flex items-center gap-2 border border-red-200 dark:border-red-800/50 shrink-0 ml-1"
                                title="Güvenli Çıkış Yap"
                            >
                                <i className="fas fa-sign-out-alt text-sm sm:text-base"></i>
                                <span className="hidden sm:inline">Çıkış</span>
                            </button>
                        </div>

                        {/* FİYAT KISMI */}
                        <div id="tour-total-cost" className="text-base sm:text-xl md:text-3xl font-bold text-green-600 dark:text-green-500 tracking-tight leading-none">
                            {isCalculating ? (
                                <span className="flex items-center gap-2 text-blue-500 text-lg md:text-2xl animate-pulse">
                                    <i className="fas fa-circle-notch fa-spin"></i> Hesaplanıyor...
                                </span>
                            ) : (
                                projectTotalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })
                            )}
                        </div>
                    </div>
                </div>
            </header>

            {isPriceFetchError && (
                <div className="bg-red-100 dark:bg-red-900/40 border-b border-red-200 dark:border-red-800 p-3 z-20 backdrop-blur-sm shadow-md flex items-center justify-center gap-2">
                    <i className="fas fa-wifi text-red-600 dark:text-red-400 animate-pulse"></i>
                    <span className="text-sm font-bold text-red-800 dark:text-red-200">
                        ⚠️ Güncel fiyatlar sunucudan yüklenemedi. Gösterilen fiyatlar sistemdeki son varsayılan değerlerdir.
                    </span>
                </div>
            )}

            {isDataDirty && hasManualOverrides && (
                <div id="dashboard-warnings" className="bg-amber-100 dark:bg-amber-900/40 border-b border-amber-200 dark:border-amber-800 p-3 md:p-4 z-20 animate-fadeIn backdrop-blur-sm shadow-md">
                    <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3">
                        <div className="flex items-center gap-3 w-full md:w-auto">
                            <div className="bg-amber-500 text-white w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm">
                                <i className="fas fa-sync-alt animate-spin-slow"></i>
                            </div>
                            <div>
                                <h3 className="font-bold text-amber-900 dark:text-amber-100 text-sm">Veriler Değişti</h3>
                                <p className="text-xs text-amber-700 dark:text-amber-300">Yapı bilgilerinde değişiklik yaptınız. Kendi Kirdiğiniz değerleri güncellemek ister misiniz?</p>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-end gap-2 w-full md:w-auto">
                            <button
                                onClick={() => recalculateCosts('quantities')}
                                className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-2 shadow-sm"
                                title="Elle girilen metrajları siler, projeden yeniden hesaplar. Manuel fiyatlar korunur."
                            >
                                <i className="fas fa-ruler-combined text-blue-500"></i>
                                Metrajları Hesapla
                            </button>

                            <button
                                onClick={() => recalculateCosts('prices')}
                                className="bg-white dark:bg-slate-800 text-slate-700 dark:text-slate-200 border border-slate-300 dark:border-slate-600 hover:bg-slate-50 dark:hover:bg-slate-700 px-3 py-1.5 rounded text-xs font-bold transition flex items-center gap-2 shadow-sm"
                                title="Elle girilen fiyatları siler, sistem fiyatlarını geri getirir. Manuel metrajlar korunur."
                            >
                                <i className="fas fa-tag text-green-500"></i>
                                Fiyatları Hesapla
                            </button>

                            <button
                                onClick={() => recalculateCosts('both')}
                                className="bg-amber-600 hover:bg-amber-500 text-white px-4 py-1.5 rounded text-xs font-bold transition shadow-md flex items-center gap-2"
                                title="Her şeyi sıfırlar ve otomatige çeker."
                            >
                                <i className="fas fa-check-double"></i>
                                Tümünü Güncelle
                            </button>

                            <button
                                onClick={dismissDataDirty}
                                className="ml-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-200 dark:hover:bg-slate-700"
                                title="Değişiklik yapma, manuel verilerimi koru."
                            >
                                <i className="fas fa-times text-lg"></i>
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {showDetailedModeInfo && (
                <div className="fixed top-24 right-4 md:right-8 z-[100] bg-slate-800 text-white p-4 rounded-xl shadow-2xl border-l-4 border-blue-500 animate-fadeIn max-w-sm">
                    <div className="flex justify-between items-start gap-3">
                        <div className="bg-blue-500/20 text-blue-400 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                            <i className="fas fa-info"></i>
                        </div>
                        <div>
                            <h4 className="font-bold text-sm">Detaylı Mod Aktif</h4>
                            <p className="text-xs text-slate-300 mt-1 leading-relaxed">
                                Artık genel m² tabanlı otomatik hesaplamalar devre dışıdır. Sadece <b>manuel eklediğiniz veya çizdiğiniz</b> elemanlar maliyete yansıtılacaktır.
                            </p>
                        </div>
                        <button onClick={() => setShowDetailedModeInfo(false)} className="text-slate-400 hover:text-white shrink-0 ml-2">
                            <i className="fas fa-times"></i>
                        </button>
                    </div>
                </div>
            )}

            <main id="dashboard-main" className="flex-1 max-w-6xl mx-auto w-full p-4 md:p-6 space-y-6 md:space-y-8 pb-20">

                <section id="tour-building-stats" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 shadow-lg dark:shadow-xl relative overflow-hidden transition-colors duration-300">                    <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-blue-50 dark:bg-blue-600/10 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start mb-6 relative z-10 gap-4">
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <i className="fas fa-building text-blue-500"></i> Yapı Genel Bilgileri
                            </h2>
                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">Arsa, Konum ve Kat Bilgileri {accountId && <span className="ml-2 text-green-500 font-bold">(Pro Hesap)</span>}</p>                        </div>

                        <div className="flex gap-2 w-full md:w-auto flex-wrap md:flex-nowrap">
                            <button
                                onClick={() => setShowArchitectModal(true)}
                                className="flex-1 md:flex-none bg-purple-50 dark:bg-purple-900/20 hover:bg-purple-100 dark:hover:bg-purple-800 text-purple-600 dark:text-purple-400 px-4 py-2 rounded-lg text-sm font-bold transition border border-purple-200 dark:border-purple-700/50 flex justify-center items-center gap-2"
                                title="Bölgenizdeki mimari ofislerden proje ve ruhsat teklifi alın"
                            >
                                <i className="fas fa-drafting-compass"></i><span className="hidden md:inline">Mimari Ofis Bul</span>
                            </button>

                            <button onClick={() => openModal('brandSelection')} className="flex-1 md:flex-none bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-800 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg text-sm font-bold transition border border-indigo-200 dark:border-indigo-700/50 flex justify-center items-center gap-2">
                                <i className="fas fa-tags"></i><span className="hidden md:inline">Marka Seç</span>
                            </button>
                            <button onClick={() => openModal('building')} className="flex-1 md:flex-none bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition border border-blue-200 dark:border-blue-600/30 flex justify-center items-center gap-2">
                                <i className="fas fa-pen"></i><span className="hidden md:inline">Düzenle</span>
                            </button>
                        </div>
                    </div>



                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-5">
                        {/* KART 1: Konum ve Tip */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between group hover:border-blue-300 dark:hover:border-blue-700 transition-colors">
                            <div>
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                                    <i className="fas fa-map-marker-alt text-blue-500/70"></i>
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Konum</span>
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                    {buildingStats.province}, {buildingStats.district}
                                </div>
                            </div>
                            {buildingStats.buildingType === 'villa' ? (
                                <div className="mt-4 w-max inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-600 dark:text-orange-400 text-[10px] font-bold px-2.5 py-1 rounded-md">
                                    <i className="fas fa-home"></i> VİLLA MODU
                                </div>
                            ) : (
                                <div className="mt-4 w-max inline-flex items-center gap-1.5 bg-blue-500/10 border border-blue-500/30 text-blue-600 dark:text-blue-400 text-[10px] font-bold px-2.5 py-1 rounded-md">
                                    <i className="fas fa-building"></i> APARTMAN MODU
                                </div>
                            )}
                        </div>

                        {/* KART 2: Alan ve Süre */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between group hover:border-indigo-300 dark:hover:border-indigo-700 transition-colors">
                            <div className="border-b border-slate-200 dark:border-slate-700/50 pb-3 mb-3">
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-1">
                                    <i className="fas fa-ruler-combined text-indigo-500/70"></i>
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Top. İnşaat Alanı</span>
                                </div>
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold text-slate-900 dark:text-white leading-none tracking-tight">
                                        {totalConstructionArea.toLocaleString()}
                                    </span>
                                    <span className="text-[10px] text-slate-500 font-medium">m² (Emsal Dahil)</span>
                                </div>
                            </div>
                            <div className="flex items-start justify-between mt-3">
                                <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400 mt-1">
                                    <i className="far fa-clock text-indigo-500/70"></i>
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Süre:</span>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                    <div className="flex items-center gap-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-md px-2 py-0.5 shadow-sm">
                                        <div className="relative flex items-center">
                                            <input
                                                type="number"
                                                value={constructionDuration || ''}
                                                onChange={(e) => updateConstructionDuration(parseFloat(e.target.value))}
                                                className={`w-10 bg-transparent font-bold text-sm text-right outline-none transition-all p-0 ${buildingStats.durationSource === 'manual' ? 'text-orange-600 dark:text-orange-400' : 'text-slate-900 dark:text-white'}`}
                                            />
                                            <span className="text-[10px] text-slate-500 ml-1">Ay</span>
                                        </div>
                                        {buildingStats.durationSource === 'manual' && (
                                            <button onClick={() => updateConstructionDuration(undefined)} className="ml-1 text-orange-500 hover:text-orange-600 bg-orange-50 dark:bg-orange-900/30 w-5 h-5 rounded flex items-center justify-center" title="Otomatiğe Dön"><i className="fas fa-undo text-[10px]"></i></button>
                                        )}
                                    </div>

                                    {/* KAYNAK BELİRTECİ (YENİ EKLENDİ) */}
                                    <div className="text-[9px] font-bold mt-0.5">
                                        {buildingStats.durationSource === 'manual' && <span className="text-orange-500 flex items-center gap-1"><i className="fas fa-pen"></i> El ile Girildi</span>}
                                        {buildingStats.durationSource === 'schedule' && <span className="text-purple-500 flex items-center gap-1"><i className="fas fa-calendar-check"></i> İş Programından</span>}
                                        {(!buildingStats.durationSource || buildingStats.durationSource === 'auto') && <span className="text-slate-400 flex items-center gap-1"><i className="fas fa-calculator"></i> Yapı Bilgilerinden (Oto)</span>}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* KART 3: Kat Bilgisi */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between group hover:border-emerald-300 dark:hover:border-emerald-700 transition-colors">
                            <div>
                                <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400 mb-2">
                                    <i className="fas fa-layer-group text-emerald-500/70"></i>
                                    <span className="text-[10px] uppercase font-bold tracking-wider">Kat Bilgisi</span>
                                </div>
                                <div className="text-lg font-bold text-slate-900 dark:text-white leading-snug">
                                    {buildingStats.basementFloorCount} Bodrum + Zemin + {buildingStats.normalFloorCount} Normal{buildingStats.hasRoofFloor ? ' + Çatı' : ''}
                                </div>
                            </div>
                            <div className="mt-4 flex items-center justify-between text-xs text-slate-600 dark:text-slate-400 bg-white dark:bg-slate-800 px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 shadow-sm">
                                <span>Top. Yükseklik:</span>
                                <span className="font-mono font-bold text-slate-900 dark:text-white">
                                    {((buildingStats.normalFloorCount * buildingStats.normalFloorHeight) + buildingStats.groundFloorHeight + (buildingStats.basementFloorCount * buildingStats.basementFloorHeight) + (buildingStats.hasRoofFloor ? (buildingStats.roofFloorMaxHeight || 0) : 0)).toFixed(1)} m
                                </span>
                            </div>
                        </div>

                        {/* KART 4: Maliyet Özeti & Uyarılar */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-5 rounded-xl border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between group hover:border-red-300 dark:hover:border-red-700 transition-colors">
                            <div className="space-y-2.5 mb-3">
                                <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700/50 pb-2">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><i className="fas fa-cubes w-3 text-yellow-500"></i> Kaba Yapı</span>
                                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{globalStructuralCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                </div>
                                <div className="flex justify-between items-center">
                                    <span className="text-xs text-slate-500 dark:text-slate-400 flex items-center gap-1.5"><i className="fas fa-paint-roller w-3 text-purple-500"></i> İnce İşler</span>
                                    <span className="text-sm font-bold font-mono text-slate-900 dark:text-white">{interiorFitoutCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                </div>
                            </div>

                            {systemWarnings && systemWarnings.length > 0 ? (
                                <button
                                    onClick={() => setShowWarningsModal(true)}
                                    className={`mt-2 w-full flex items-center justify-between px-3 py-2 rounded-lg border shadow-sm transition-all ${systemWarnings.some(w => w.type === 'critical') ? 'bg-red-50 dark:bg-red-900/20 hover:bg-red-100 border-red-200 dark:border-red-800' : 'bg-orange-50 dark:bg-orange-900/20 hover:bg-orange-100 border-orange-200 dark:border-orange-800'}`}
                                >
                                    <div className="flex items-center gap-2">
                                        <i className={`fas fa-exclamation-triangle animate-pulse ${systemWarnings.some(w => w.type === 'critical') ? 'text-red-500' : 'text-orange-500'}`}></i>
                                        <span className={`text-[10px] font-bold ${systemWarnings.some(w => w.type === 'critical') ? 'text-red-700 dark:text-red-400' : 'text-orange-700 dark:text-orange-400'}`}>
                                            {systemWarnings.length} Sistem Uyarısı
                                        </span>
                                    </div>
                                    <span className={`text-[9px] underline ${systemWarnings.some(w => w.type === 'critical') ? 'text-red-400' : 'text-orange-400'}`}>İncele</span>
                                </button>
                            ) : (
                                <div className="mt-2 w-full flex items-center justify-center px-3 py-2 rounded-lg border border-emerald-200 dark:border-emerald-800/50 bg-emerald-50 dark:bg-emerald-900/20">
                                    <div className="flex items-center gap-1.5">
                                        <i className="fas fa-check-circle text-emerald-500"></i>
                                        <span className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">Tüm Kontroller Başarılı</span>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </section>



                {/* 2. SECTION: BAĞIMSIZ BÖLÜM TİPLERİ */}

                <section id="tour-units">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-4 gap-3">
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <i className={`fas ${buildingStats.buildingType === 'villa' ? 'fa-home' : 'fa-layer-group'} text-purple-500`}></i>
                                {buildingStats.buildingType === 'villa' ? 'Villa Kat Planları' : 'Bağımsız Bölüm Tipleri'}
                            </h2>
                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                {buildingStats.buildingType === 'villa' ? 'Villaya ait kat planları ve oda metrajları' : 'Daire planları, oda metrajları ve adetleri'}
                            </p>

                            {/* YENİ EKLENEN KÜÇÜK VE ZARİF NOT */}
                            <div className="mt-2 inline-flex items-start gap-1.5 text-[11px] text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/10 px-2 py-1 rounded border border-amber-100 dark:border-amber-800/30">
                                <i className="fas fa-info-circle mt-0.5 opacity-80"></i>
                                <span><strong>Önemli:</strong> Otopark, sığınak veya kat holü gibi ortak alanları bu tiplere <strong>eklemeyiniz.</strong> Onlar "Yapı Genel Bilgileri"nden yönetilir.</span>
                            </div>

                        </div>
                        <div className="flex gap-2 w-full md:w-auto">


                            {buildingStats.buildingType === 'apartment' && units.length > 1 && (
                                <button onClick={() => setShowDuplexModal(true)} className="flex-1 md:flex-none bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center justify-center gap-2 text-sm shadow-sm border border-indigo-700">
                                    <i className="fas fa-link"></i><span className="hidden md:inline"> Dubleks Eşle</span>
                                </button>
                            )}

                            <button onClick={addUnit} className="flex-1 md:flex-none bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center justify-center gap-2 text-sm shadow-sm border border-purple-700">
                                <i className="fas fa-plus"></i>
                                <span className="hidden md:inline">
                                    {buildingStats.buildingType === 'villa' ? ' Yeni Kat Ekle' : ' Yeni Tip Ekle'}
                                </span>
                                <span className="md:hidden">
                                    {buildingStats.buildingType === 'villa' ? 'Kat Ekle' : 'Tip Ekle'}
                                </span>
                            </button>
                        </div>
                    </div>

                    {units.every(u => u.rooms.length === 0) && units.length > 0 && (
                        <div className="mb-5 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800/40 rounded-xl p-3 md:p-4 flex items-start gap-3 shadow-sm animate-fadeIn">
                            <div className="bg-blue-100 dark:bg-blue-800/50 w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                                <i className="fas fa-magic text-blue-600 dark:text-blue-400"></i>
                            </div>
                            <div className="flex-1">
                                <h4 className="text-xs md:text-sm font-bold text-blue-800 dark:text-blue-300 mb-1">
                                    Tahmini Metraj Hesaplaması Devrede
                                </h4>
                                <p className="text-[11px] md:text-xs text-blue-700/80 dark:text-blue-200/70 leading-relaxed">
                                    İçine hiç oda (mahal) eklenmemiş tipleriniz bulunuyor. Bu durumda sistem; daire içi sıva, boya, zemin, kapı ve pencere gibi ince imalatları <b>Yapı Genel Bilgileri'ndeki m² üzerinden tahmini olarak</b> hesaplar. Daha hassas ve nokta atışı bir sonuç için kartların üzerindeki <b>"Manuel Liste"</b> veya <b>"Planı Düzenle"</b> butonlarını kullanarak odalarınızı tanımlayabilirsiniz.
                                </p>
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {units.length === 0 && (
                            <div className="col-span-full text-center text-slate-500 py-8 bg-white dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700 border-dashed">
                                Henüz daire tipi eklenmemiş.
                            </div>
                        )}

                        {units.map(unit => {
                            const totalUnitArea = unit.rooms.reduce((acc, r) => {
                                const area = r.manualAreaM2 || (unit.scale > 0 ? r.area_px / (unit.scale * unit.scale) : 0);
                                return acc + area;
                            }, 0);

                            const isDuplexPart = duplexPairs.some(p => p.lowerUnitId === unit.id || p.upperUnitId === unit.id);

                            return (
                                <div key={unit.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-400 dark:hover:border-slate-600 transition group relative">
                                    <div className="h-40 bg-slate-100 dark:bg-slate-900 relative flex items-center justify-center border-b border-slate-200 dark:border-slate-700">
                                        {isDuplexPart && (
                                            <span className="absolute top-2 left-2 bg-indigo-600/90 backdrop-blur text-white text-[10px] px-2 py-1 rounded-full font-bold shadow-md flex items-center gap-1 z-10">
                                                <i className="fas fa-link"></i> Dubleks Parçası
                                            </span>
                                        )}
                                        {unit.imageData ? (
                                            <img src={unit.imageData} className="w-full h-full object-cover opacity-80 dark:opacity-60" alt={unit.name} />
                                        ) : (
                                            <i className="fas fa-drafting-compass text-4xl text-slate-300 dark:text-slate-600"></i>
                                        )}
                                        <div className="absolute inset-0 bg-white/60 dark:bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-3 backdrop-blur-sm">
                                            <button onClick={() => navigateToEditor(unit.id, 'architectural')} className="hidden md:inline-flex bg-blue-600 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg hover:bg-blue-500">Planı Düzenle</button>
                                            <button onClick={() => openModal('roomManager', unit.id)} className="bg-purple-600 text-white px-4 py-2 rounded-full font-bold text-sm shadow-lg hover:bg-purple-500">Manuel Liste</button>
                                            <button
                                                onClick={() => duplicateUnit(unit.id)}
                                                className="bg-teal-500 hover:bg-teal-400 text-white w-10 h-10 rounded-full shadow-lg flex items-center justify-center transition transform hover:scale-110"
                                                title="Tipi Çoğalt"
                                            >
                                                <i className="fas fa-copy"></i>
                                            </button>
                                            <button onClick={() => deleteUnit(unit.id, false)} className="bg-red-600 hover:bg-red-500 text-white w-10 h-10 rounded-full shadow-lg"><i className="fas fa-trash"></i></button>
                                        </div>
                                        <div className="md:hidden absolute top-2 right-2 flex gap-2">
                                            <button
                                                onClick={() => duplicateUnit(unit.id)}
                                                className="bg-teal-500 text-white w-8 h-8 rounded-full shadow-lg flex items-center justify-center text-xs"
                                            >
                                                <i className="fas fa-copy"></i>
                                            </button>
                                            <button onClick={() => openModal('roomManager', unit.id)} className="bg-purple-600 text-white w-8 h-8 rounded-full shadow-lg flex items-center justify-center text-xs"><i className="fas fa-list"></i></button>
                                            <button onClick={() => deleteUnit(unit.id, false)} className="bg-red-600 text-white w-8 h-8 rounded-full shadow-lg flex items-center justify-center text-xs"><i className="fas fa-trash"></i></button>
                                        </div>
                                    </div>
                                    <div className="p-4">
                                        <div className="flex justify-between items-start">
                                            <div className="flex-1 mr-4">
                                                <input
                                                    type="text"
                                                    value={unit.name}
                                                    onChange={(e) => updateUnitName(unit.id, e.target.value, false)}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-400 dark:hover:border-slate-600 focus:border-blue-500 text-slate-900 dark:text-white font-bold mb-1 outline-none transition px-0 text-sm md:text-base"
                                                />
                                                <select
                                                    value={unit.floorType}
                                                    onChange={(e) => updateUnitFloorType(unit.id, e.target.value as any, false)}
                                                    className="text-xs text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-900 px-2 py-1 rounded outline-none border border-transparent hover:border-slate-300 dark:hover:border-slate-700 cursor-pointer w-full md:w-auto"
                                                >
                                                    <option value="normal">Normal Kat ({buildingStats.normalFloorHeight}m)</option>
                                                    <option value="ground">Zemin Kat ({buildingStats.groundFloorHeight}m)</option>
                                                    <option value="basement">Bodrum Kat ({buildingStats.basementFloorHeight}m)</option>
                                                    {buildingStats.hasRoofFloor && (
                                                        <option value="roof">Çatı Katı ({buildingStats.roofFloorHeight || 1.8}m)</option>
                                                    )}
                                                </select>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={unit.count}
                                                        onChange={(e) => updateUnitCount(unit.id, parseInt(e.target.value), false)}
                                                        className="w-12 md:w-16 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center font-bold text-lg focus:border-blue-500 outline-none text-slate-900 dark:text-white"
                                                    />
                                                    <span className="text-xs md:text-sm font-normal text-slate-500">Adet</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700 flex justify-between text-xs text-slate-500 dark:text-slate-400">
                                            <div className="flex items-center gap-2">
                                                <span><i className="fas fa-vector-square mr-1"></i>{unit.rooms.length} Oda</span>
                                                {totalUnitArea > 0 && (
                                                    <>
                                                        <span className="text-slate-300 dark:text-slate-600">|</span>
                                                        <span className="font-bold text-slate-700 dark:text-slate-300">
                                                            {totalUnitArea.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} m²
                                                        </span>
                                                    </>
                                                )}
                                            </div>
                                            <span><i className="fas fa-expand mr-1"></i>{unit.scale > 0 ? "Ölçekli" : "Ölçeksiz"}</span>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                {/* 3. SECTION: YAPISAL ELEMANLAR DETAY PANELİ (GİZLENEBİLİR AKORDİYON) */}
                <section id="tour-structural" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-2xl shadow-lg dark:shadow-xl transition-colors duration-300 overflow-hidden">
                    {/* Akordiyon Başlığı */}
                    <button
                        onClick={() => setIsStructuralPanelExpanded(!isStructuralPanelExpanded)}
                        className={`w-full p-5 md:p-6 flex justify-between items-center transition group ${isStructuralPanelExpanded ? 'bg-slate-50/50 dark:bg-slate-900/20' : 'hover:bg-slate-50 dark:hover:bg-slate-700/50'}`}
                    >
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-100 dark:bg-orange-950 p-2.5 rounded-xl border border-orange-200 dark:border-orange-800/50 shadow-inner text-orange-600 dark:text-orange-400 group-hover:scale-110 transition-transform">
                                <i className="fas fa-th text-2xl"></i>
                            </div>
                            <div className="text-left">
                                <h2 className="text-lg md:text-xl font-bold text-slate-950 dark:text-white flex items-center gap-2">
                                    Detaylı Kaba Yapı & Statik Metrajı <span className="text-[10px] bg-slate-200 dark:bg-slate-700 text-slate-600 dark:text-slate-300 px-2.5 py-1 rounded-full font-bold uppercase tracking-wider hidden md:inline-block">İleri Düzey (Opsiyonel)</span>
                                </h2>
                                <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">
                                    {isStructuralPanelExpanded
                                        ? "Kat planları bazında duvar, kolon, kiriş ve döşemelerin metraj yönetimi."
                                        : "Manuel veya çizimle kolon, kiriş, döşeme metrajı girmek için tıklayın."}
                                </p>
                            </div>
                        </div>
                        <div className={`flex items-center justify-center w-10 h-10 rounded-full border ${isStructuralPanelExpanded ? 'border-orange-300 dark:border-orange-700 bg-orange-50 dark:bg-orange-950' : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800'}`}>
                            <i className={`fas fa-chevron-down text-slate-400 text-lg transform transition-transform duration-300 ${isStructuralPanelExpanded ? 'rotate-180 text-orange-500' : ''}`}></i>
                        </div>
                    </button>

                    {/* Akordiyon İçeriği */}
                    {isStructuralPanelExpanded && (
                        <div className="p-5 md:p-6 border-t border-slate-200 dark:border-slate-700 animate-fadeIn bg-white dark:bg-slate-800">

                            {/* Global Kontroller Barı */}
                            {/* Global Kontroller Barı */}
                            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-slate-800 p-4 rounded-xl shadow-inner">
                                <div className="flex flex-col md:flex-row items-start md:items-center gap-4 w-full flex-1">

                                    {/* Hesaplama Modları (Oto/Detaylı) */}
                                    <div className="flex items-center gap-3 pt-4 md:pt-0 shrink-0">
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold px-1">Duvar</span>
                                            <div className="flex items-center gap-1 bg-white dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm h-10">
                                                <button onClick={() => handleWallModeClick('auto')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${globalWallMode === 'auto' ? 'bg-blue-500 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Oto</button>
                                                <button onClick={() => handleWallModeClick('detailed')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${globalWallMode === 'detailed' ? 'bg-blue-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Detaylı</button>
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-1 items-start">
                                            <span className="text-[10px] text-slate-400 uppercase font-bold px-1">Betonarme</span>
                                            <div className="flex items-center gap-1 bg-white dark:bg-slate-950 rounded-lg p-1 border border-slate-200 dark:border-slate-700 shadow-sm h-10">
                                                <button onClick={() => handleConcreteModeClick('auto')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${globalConcreteMode === 'auto' ? 'bg-orange-500 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Oto</button>
                                                <button onClick={() => handleConcreteModeClick('detailed')} className={`px-4 py-1.5 text-xs font-bold rounded-md transition ${globalConcreteMode === 'detailed' ? 'bg-orange-600 text-white shadow' : 'text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800'}`}>Detaylı</button>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Açıklama Metni (Orta Boşluk) */}
                                    <div className="hidden md:flex items-center px-2">
                                        <div className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug border-l-2 border-slate-300 dark:border-slate-600 pl-3">
                                            <span className="block"><strong className="text-slate-700 dark:text-slate-300">Oto:</strong> M² üzerinden standart oranlarla hesaplar.</span>
                                            <span className="block"><strong className="text-slate-700 dark:text-slate-300">Detaylı:</strong> Sadece çizdiğiniz veya manuel girdiğiniz veriyi baz alır.</span>
                                        </div>
                                    </div>

                                </div>

                                {/* Yeni Kat Planı Ekle Butonu */}
                                <button onClick={addStructuralUnit} className="h-11 bg-orange-600 hover:bg-orange-500 text-white px-5 py-2.5 rounded-xl font-bold transition flex items-center gap-2 text-sm w-full md:w-auto justify-center shadow-md active:scale-95 shrink-0">
                                    <i className="fas fa-plus"></i> Yeni Kat Planı Ekle
                                </button>
                            </div>

                            {/* Kat Planları Listesi */}
                            <div className="space-y-4">
                                {structuralUnits.length === 0 && (
                                    <div className="text-slate-500 dark:text-slate-400 text-sm text-center py-10 bg-slate-50/50 dark:bg-slate-900/30 rounded-xl border border-dashed border-slate-200 dark:border-slate-700 px-4">
                                        <i className="fas fa-drafting-compass text-3xl mb-3 text-slate-300 dark:text-slate-600"></i>
                                        <p>Henüz bir statik kat planı eklenmemiş.</p>
                                        {(globalWallMode === 'auto' && globalConcreteMode === 'auto') ? (
                                            <p className="text-xs text-green-600 dark:text-green-400 mt-3 font-bold bg-green-50 dark:bg-green-900/20 inline-block px-4 py-2 rounded-lg border border-green-200 dark:border-green-800">
                                                <i className="fas fa-check-circle mr-1"></i>
                                                Oto mod aktif olduğu için plan eklemenize gerek yoktur. Sistem metrajları Yapı Genel Bilgileri'nden otomatik hesaplar.
                                            </p>
                                        ) : (
                                            <p className="text-xs text-slate-400 mt-1">Gelişmiş kaba yapı metrajı (Manuel çizim) için "Yeni Kat Planı Ekle" butonunu kullanın.</p>
                                        )}
                                    </div>
                                )}
                                {structuralUnits.map(unit => (
                                    <div key={unit.id} className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-5 flex flex-col gap-4 hover:border-orange-300 dark:hover:border-orange-800 transition shadow-sm group">

                                        {/* Üst Satır: İsim, Tip, Adet, Sil */}
                                        <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-1">
                                            <div className="flex items-center gap-3 flex-1 min-w-0">
                                                {/* İkon */}
                                                <div className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-950 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold border border-slate-200 dark:border-slate-700 group-hover:border-orange-400 dark:group-hover:border-orange-700 group-hover:text-orange-500 transition flex-shrink-0">
                                                    {unit.name.substring(0, 2).toUpperCase()}
                                                </div>
                                                {/* İsim ve Tip */}
                                                <div className="flex-1 min-w-0">
                                                    <input
                                                        type="text"
                                                        value={unit.name}
                                                        onChange={(e) => updateUnitName(unit.id, e.target.value, true)}
                                                        className="w-full bg-transparent border-b border-transparent hover:border-slate-300 dark:hover:border-slate-600 focus:border-orange-500 dark:focus:border-orange-500 text-slate-950 dark:text-white font-semibold text-sm outline-none transition px-0"
                                                        placeholder="Kat Planı Adı (Örn: Bodrum Kat)"
                                                    />
                                                    <select
                                                        value={unit.floorType}
                                                        onChange={(e) => updateUnitFloorType(unit.id, e.target.value as UnitFloorType, true)}
                                                        className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-100 dark:bg-slate-800 px-2 py-0.5 rounded outline-none border border-slate-200 dark:border-slate-700 hover:border-slate-300 dark:hover:border-slate-600 cursor-pointer mt-1"
                                                    >
                                                        <option value="normal">Normal Kat ({buildingStats.normalFloorHeight}m)</option>
                                                        <option value="ground">Zemin Kat ({buildingStats.groundFloorHeight}m)</option>
                                                        <option value="basement">Bodrum Kat ({buildingStats.basementFloorHeight}m)</option>
                                                        {buildingStats.hasRoofFloor && (
                                                            <option value="roof">Çatı Katı ({buildingStats.roofFloorHeight || 1.8}m)</option>
                                                        )}
                                                    </select>
                                                </div>
                                            </div>

                                            {/* Sağ Taraf: Adet ve Sil */}
                                            <div className="flex items-center justify-between sm:justify-end gap-3 pl-1 sm:pl-0 pt-2 sm:pt-0">
                                                <div className="flex items-center gap-1.5 bg-slate-50 dark:bg-slate-950 px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 shadow-inner">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={unit.count}
                                                        onChange={(e) => updateUnitCount(unit.id, parseInt(e.target.value), true)}
                                                        className="w-10 bg-transparent text-center text-slate-950 dark:text-white font-bold text-sm focus:text-orange-600 dark:focus:text-orange-400 outline-none"
                                                    />
                                                    <span className="text-[11px] font-normal text-slate-400">adet</span>
                                                </div>
                                                <button onClick={() => deleteUnit(unit.id, true)} className="text-slate-400 hover:text-red-500 transition p-1.5 rounded-full hover:bg-red-50 dark:hover:bg-red-950/50">
                                                    <i className="fas fa-trash-alt text-sm"></i>
                                                </button>
                                            </div>
                                        </div>

                                        {/* Alt Satır: Metraj Detayları ve Butonlar */}
                                        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                                            {/* Eleman Sayıları */}
                                            <div className="flex items-center gap-4 flex-wrap text-[11px] text-slate-600 dark:text-slate-400 px-1">
                                                <div className="flex items-center gap-1.5"><i className="fas fa-th-large text-yellow-600"></i> {unit.walls.length} Duvar</div>
                                                <div className="flex items-center gap-1.5"><i className="fas fa-square text-red-600"></i> {unit.columns.length} Kolon</div>
                                                <div className="flex items-center gap-1.5"><i className="fas fa-grip-lines text-blue-600"></i> {unit.beams.length} Kiriş</div>
                                                <div className="flex items-center gap-1.5"><i className="fas fa-layer-group text-purple-600"></i> {unit.slabs?.length || 0} Döşeme</div>
                                            </div>

                                            {/* İşlem Butonları */}
                                            <div className="flex gap-2 w-full lg:w-auto">
                                                <button onClick={() => navigateToEditor(unit.id, 'structural')} className="flex-1 lg:flex-initial hidden sm:inline-flex bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold shadow-sm items-center justify-center gap-2 transition active:scale-95">
                                                    <i className="fas fa-drafting-compass"></i>Plan Üzerinde Çiz
                                                </button>
                                                <button onClick={() => openModal('structuralManager', unit.id)} className="flex-1 lg:flex-initial bg-slate-100 dark:bg-slate-700 hover:bg-slate-200 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg text-sm font-bold border border-slate-200 dark:border-slate-600 shadow-sm items-center justify-center gap-2 transition active:scale-95">
                                                    <i className="fas fa-list-ul"></i>Manuel Liste Ekle
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* 4. SECTION: PROJECT COST DETAILS */}
                <section id="tour-cost-details" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 shadow-lg dark:shadow-xl transition-colors duration-300 relative">
                    {(() => {
                        const costCategoryIds = projectCostDetails.filter(cat => cat.id !== 'ozel_kalemler' && cat.items.length > 0).map(c => c.id);
                        const isAllExpanded = costCategoryIds.length > 0 && costCategoryIds.every(id => expandedCategories[id]);

                        return (
                            <div className="md:sticky md:top-0 z-20 -mx-4 -mt-4 p-4 md:-mx-6 md:-mt-6 md:p-6 mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white/95 dark:bg-slate-800/95 backdrop-blur-md border-b border-slate-200 dark:border-slate-700 shadow-sm rounded-t-xl transition-all">                                {/* YAPISKAN PANEL BAŞLIĞI */}
                                <div className="flex-1">
                                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                                        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <i className="fas fa-file-invoice-dollar text-green-500"></i> Proje Maliyet Detayları
                                        </h2>
                                    </div>
                                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
                                        Tüm bağımsız bölümler ve genel yapı maliyetlerinin toplam dökümü. Metraj ve birim fiyatları buradan düzenleyebilirsiniz.
                                        <span className="inline-block mt-1 sm:mt-0 sm:ml-2 text-orange-600 dark:text-orange-400 font-bold bg-orange-50 dark:bg-orange-900/20 px-2 py-0.5 rounded border border-orange-200 dark:border-orange-800/30 text-[10px] md:text-xs whitespace-nowrap">
                                            <i className="fas fa-info-circle mr-1"></i>
                                            Tüm birim fiyatlar KDV DAHİL olarak listelenmektedir.
                                        </span>
                                    </p>
                                </div>

                                <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 w-full md:w-auto mt-2 md:mt-0">
                                    <button
                                        onClick={() => exportCostsToExcel(projectCostDetails)}
                                        className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-green-200 dark:border-green-800/50 shadow-sm"
                                        title="Tüm keşfi Excel'e indir"
                                    >
                                        <i className="fas fa-file-excel"></i>
                                        <span className="hidden sm:inline">Excel İndir</span>
                                        <span className="sm:hidden">İndir</span>
                                    </button>

                                    <label
                                        className="bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-400 hover:bg-blue-200 dark:hover:bg-blue-800 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-blue-200 dark:border-blue-800/50 shadow-sm cursor-pointer mb-0"
                                        title="Excel'de düzenlediğin fiyatları geri yükle"
                                    >
                                        <i className="fas fa-upload"></i>
                                        <span className="hidden sm:inline">Fiyat Yükle</span>
                                        <span className="sm:hidden">Yükle</span>
                                        <input
                                            type="file"
                                            accept=".xlsx, .xls"
                                            className="hidden"
                                            onChange={(e) => {
                                                if (e.target.files && e.target.files[0]) {
                                                    importPricesFromExcel(e.target.files[0], (newPrices) => {
                                                        if (newPrices.length > 0) {
                                                            bulkUpdatePrices(newPrices);
                                                            alert(`${newPrices.length} adet kalemin birim fiyatı Excel'den başarıyla güncellendi!`);
                                                        } else {
                                                            alert('Excel dosyasında geçerli fiyat verisi bulunamadı. Lütfen dosya formatını değiştirmeyin.');
                                                        }
                                                        e.target.value = '';
                                                    });
                                                }
                                            }}
                                        />
                                    </label>

                                    <div className="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                                    <button
                                        onClick={() => toggleAllCategories(!isAllExpanded, costCategoryIds)}
                                        className="bg-white dark:bg-slate-900 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-slate-200 dark:border-slate-700 shadow-sm shrink-0"
                                    >
                                        <i className={`fas ${isAllExpanded ? 'fa-compress-arrows-alt' : 'fa-expand-arrows-alt'}`}></i>
                                        {isAllExpanded ? 'Tümünü Kapat' : 'Tümünü Aç'}
                                    </button>
                                </div>
                            </div>
                        );
                    })()}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6">
                        {projectCostDetails
                            .filter(cat => cat.id !== 'ozel_kalemler' && cat.items.length > 0)
                            .map((category) => (
                                <div
                                    key={category.id}
                                    className={`bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg transition-all duration-300 ${expandedCategories[category.id] ? 'md:col-span-2 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700' : ''} relative`}
                                >
                                    <button onClick={() => toggleCategory(category.id)} className="sticky top-0 md:top-[110px] z-10 w-full bg-slate-100/95 dark:bg-slate-700/95 backdrop-blur-sm px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center hover:bg-slate-200 dark:hover:bg-slate-600 transition shadow-sm">                                        <div className="flex items-center gap-3">
                                        <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm">{getCategoryIcon(category.id)}</div>
                                        <div className="text-left"><h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase">{category.title}</h3></div>
                                    </div>
                                        <span className="text-green-600 dark:text-green-400 font-bold text-sm">{category.totalCategoryCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}</span>
                                    </button>

                                    {expandedCategories[category.id] && (
                                        <div className="p-4 bg-white dark:bg-slate-900/30 animate-fadeIn">
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                {category.items.filter(item => {
    const isWall = item.name.includes('Duvar');
    if (isWall) {
        return (item.finalQty || 0) > 0;
    }
    return true;
}).map((item) => {
    const isLocked = LOCKED_ITEMS.includes(item.name);
    
    return (
        <div 
            key={item.name} 
            className={`group flex flex-col gap-2.5 p-3.5 rounded-xl border transition-all duration-300 shadow-sm hover:shadow-md ${item.isExcluded ? 'bg-slate-50 dark:bg-slate-900/50 border-slate-200 dark:border-slate-700 opacity-60' : 'bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700'}`}
        >
            <div className="flex justify-between items-start gap-3">
                <div className="flex items-center gap-2">
                    {/* GÖZ İKONU BUTONU: Mobilde yarı saydam, masaüstünde hover ile belirir */}
                    {!isLocked && (
                        <button
                            onClick={() => toggleCostItemExclusion(category.id, item.name, !item.isExcluded)}
                            className="opacity-40 md:opacity-0 md:group-hover:opacity-100 transition-opacity text-slate-400 hover:text-blue-500 mt-0.5"
                            title={item.isExcluded ? "Maliyete Dahil Et" : "Maliyetten Çıkar (Hariç Tut)"}
                        >
                            <i className={`fas ${item.isExcluded ? 'fa-eye-slash text-red-400' : 'fa-eye'}`}></i>
                        </button>
                    )}

                    <span className={`text-sm font-bold leading-tight flex items-center flex-wrap gap-1.5 transition-all ${item.isExcluded ? 'text-slate-400 line-through decoration-red-400/50' : 'text-slate-800 dark:text-slate-200'}`}>
                        {item.name}
                        {isLocked && <i className="fas fa-lock text-[10px] text-slate-400 align-middle" title="Metraj sistem tarafından yönetilir"></i>}

                        {/* BİLGİ İKONU VE TOOLTIP BAŞLANGICI */}
                        {ITEM_DESCRIPTIONS[item.name] && (
                            <div className="relative group inline-flex items-center justify-center">
                                <i className="fas fa-info-circle text-[11px] text-blue-400 hover:text-blue-600 cursor-help transition-colors"></i>
                                <div className="absolute bottom-full -left-2 sm:left-1/2 sm:-translate-x-1/2 pb-2 w-[260px] max-w-[85vw] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[9999]">
                                    <div className="relative p-3 bg-slate-800 dark:bg-slate-700 text-white text-[10px] font-medium leading-relaxed rounded-lg shadow-2xl">
                                        {ITEM_DESCRIPTIONS[item.name]}
                                        <div className="absolute top-full left-3 sm:left-1/2 sm:-translate-x-1/2 border-[6px] border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                                    </div>
                                </div>
                            </div>
                        )}
                        {/* BİLGİ İKONU VE TOOLTIP BİTİŞİ */}
                    </span>
                </div>
                
                <div className="font-extrabold text-green-600 dark:text-green-400 text-sm whitespace-nowrap bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-md">
                    {item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                </div>
            </div>

                                                                {item.inputType === 'manual_total' ? (
                                                                    <div className="mt-1 flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 gap-2">
                                                                        <div className="text-xs text-slate-500">
                                                                            <div className="flex items-center gap-2">
                                                                                <span className="font-bold text-slate-700 dark:text-slate-300">Sabit Tutar / Paket Fiyatı</span>

                                                                                {/* YENİ EKLENEN: Paket fiyatı olan kalemler (Zemin Etüdü vb.) için kırılım butonu */}
                                                                                {item.costBreakdown && item.costBreakdown.length > 0 && (
                                                                                    <div className="relative flex items-center cursor-help group/breakdown">
                                                                                        <i className="fas fa-box-open text-emerald-500 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30 p-1 rounded transition shadow-sm"></i>

                                                                                        <div className="absolute bottom-full left-0 mb-2 w-72 sm:w-80 bg-slate-800 dark:bg-slate-700 text-white text-[10px] p-3 rounded-lg shadow-2xl opacity-0 invisible group-hover/breakdown:opacity-100 group-hover/breakdown:visible transition-all duration-200 z-[100] border border-slate-600 pointer-events-none group-hover/breakdown:pointer-events-auto">                                                                                        <div className="font-bold border-b border-slate-600 pb-1 mb-2 text-emerald-400 flex items-center gap-2">
                                                                                            <i className="fas fa-box-open"></i> Paket Maliyet İçeriği
                                                                                        </div>
                                                                                            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1 overscroll-contain">
                                                                                                {item.costBreakdown.map((cb: any, idx: number) => (
                                                                                                    <div key={idx} className="flex justify-between items-start gap-3 border-b border-slate-600/30 pb-1 last:border-0 last:pb-0">
                                                                                                        <span className="opacity-90 leading-tight">{cb.label}</span>
                                                                                                        <span className="font-mono font-bold shrink-0 mt-0.5 text-emerald-300">
                                                                                                            {cb.value.toLocaleString('tr-TR')} ₺
                                                                                                        </span>
                                                                                                    </div>
                                                                                                ))}
                                                                                            </div>
                                                                                            <div className="absolute top-full left-3 border-[6px] border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                                                                                        </div>
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                            <div className="text-[10px] text-slate-400 mt-0.5">Bu kalem için miktar girilmez, doğrudan toplam tutar giriniz.</div>
                                                                        </div>

                                                                        <div className="flex items-center gap-2 self-end sm:self-auto">
                                                                            <div className="flex items-center border rounded-md relative bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600 focus-within:border-blue-500 w-32">
                                                                                <NumericInput
                                                                                    className="w-full bg-transparent text-slate-900 dark:text-white text-sm p-1.5 outline-none font-bold text-right pr-6"
                                                                                    value={item.manualPrice !== undefined ? Number(Number(item.manualPrice).toFixed(2)) : Number(Number(item.unit_price).toFixed(2))}
                                                                                    onChange={(val) => updateCostItem(category.id, item.name, 'manualPrice', val)}
                                                                                    placeholder="Tutar"
                                                                                />
                                                                                <span className="absolute right-2 text-xs text-slate-500 bg-white/80 dark:bg-slate-950/80 pl-1">₺</span>
                                                                            </div>

                                                                            {item.manualPrice !== undefined && item.manualPrice !== item.unit_price && (
                                                                                <button
                                                                                    onClick={() => updateCostItem(category.id, item.name, 'manualPrice', undefined)}
                                                                                    className="text-red-500 hover:text-red-700 bg-red-50 dark:bg-red-900/20 w-8 h-8 rounded-md flex items-center justify-center transition-colors"
                                                                                    title="Varsayılan fiyata dön"
                                                                                >
                                                                                    <i className="fas fa-undo text-xs"></i>
                                                                                </button>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                ) : (
                                                                    <div className="flex items-start gap-2 sm:gap-4 mt-1">
                                                                        <div className="flex-1 min-w-0 flex flex-col">
                                                                            <div className={`flex items-center border rounded-lg relative overflow-hidden ${isLocked ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                                                                                <NumericInput
                                                                                    disabled={isLocked}
                                                                                    className={`w-full bg-transparent text-sm p-2 outline-none font-mono text-right transition ${item.unit.length > 7 ? 'pr-20' : item.unit.length > 3 ? 'pr-16' : 'pr-9'} ${isLocked ? 'text-slate-500 cursor-not-allowed font-bold' : 'text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950'}`}
                                                                                    value={isLocked
                                                                                        ? Number(Number(item.calculatedAutoQty).toFixed(2))
                                                                                        : (item.manualQuantity !== undefined ? Number(Number(item.manualQuantity).toFixed(2)) : Number(Number(item.calculatedAutoQty).toFixed(2)))
                                                                                    }
                                                                                    onChange={(val) => !isLocked && updateCostItem(category.id, item.name, 'manualQuantity', val)}
                                                                                    placeholder="Miktar"
                                                                                />
                                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold bg-slate-50/90 dark:bg-slate-900/90 pl-1">{item.unit}</span>
                                                                            </div>

                                                                            <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-1 mt-1.5 px-1 relative group/breakdown">

                                                                                <div className="flex items-center gap-1">
                                                                                    <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Metraj</span>

                                                                                    {/* BİRLEŞTİRİLMİŞ İCMAL VE MALİYET BALONU */}
                                                                                    {(
                                                                                        (item.breakdown && item.breakdown.length > 0 && !['total_area', 'land_area', 'calc_duration_months', 'manual'].includes(item.auto_source)) ||
                                                                                        (item.costBreakdown && item.costBreakdown.length > 0)
                                                                                    ) && (
                                                                                            <div className="relative flex items-center cursor-help group/breakdown">
                                                                                                {/* İkon: Eğer maliyet paketi ise yeşil kutu, metraj ise mavi liste ikonu gösterir */}
                                                                                                <i className={`fas ${item.costBreakdown ? 'fa-box-open text-emerald-500 hover:text-emerald-700 bg-emerald-50 dark:bg-emerald-900/30' : 'fa-list-ul text-blue-500 hover:text-blue-700 bg-blue-50 dark:bg-blue-900/30'} p-1 rounded transition`}></i>

                                                                                                {/* ANA TOOLTIP BALONU */}
                                                                                                <div className="absolute bottom-full -left-6 sm:left-1/2 sm:-translate-x-1/2 mb-2 w-[280px] max-w-[90vw] sm:w-96 bg-slate-800 dark:bg-slate-700 text-white text-[10px] p-3 rounded-lg shadow-2xl opacity-0 invisible group-hover/breakdown:opacity-100 group-hover/breakdown:visible transition-all duration-200 z-[100] border border-slate-600 pointer-events-none group-hover/breakdown:pointer-events-auto">                                                                                                {/* 1. KISIM: PAKET MALİYET İÇERİĞİ (VİRMAN) */}
                                                                                                    {item.costBreakdown && item.costBreakdown.length > 0 && (
                                                                                                        <div className={`${item.breakdown && item.breakdown.length > 0 && !['total_area', 'land_area', 'calc_duration_months', 'manual'].includes(item.auto_source) ? 'mb-3 pb-3 border-b border-slate-600 border-dashed' : ''}`}>
                                                                                                            <div className="font-bold border-b border-slate-600 pb-1 mb-2 text-emerald-400 flex items-center gap-2">
                                                                                                                <i className="fas fa-box-open"></i> Paket Maliyet İçeriği
                                                                                                            </div>
                                                                                                            <div className="space-y-1.5 max-h-40 overflow-y-auto custom-scrollbar pr-1 overscroll-contain">
                                                                                                                {item.costBreakdown.map((cb: any, idx: number) => (
                                                                                                                    <div key={idx} className="flex justify-between items-start gap-3 border-b border-slate-600/30 pb-1 last:border-0 last:pb-0">
                                                                                                                        <span className="opacity-90 leading-tight">{cb.label}</span>
                                                                                                                        <span className="font-mono font-bold shrink-0 mt-0.5 text-emerald-300">
                                                                                                                            {cb.value.toLocaleString('tr-TR')} ₺
                                                                                                                        </span>
                                                                                                                    </div>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    )}

                                                                                                    {/* 2. KISIM: METRAJ İCMAL DÖKÜMÜ */}
                                                                                                    {item.breakdown && item.breakdown.length > 0 && !['total_area', 'land_area', 'calc_duration_months', 'manual'].includes(item.auto_source) && (
                                                                                                        <div>
                                                                                                            <div className="font-bold border-b border-slate-600 pb-1 mb-2 text-blue-300 flex items-center gap-2">
                                                                                                                <i className="fas fa-calculator"></i> Metraj İcmal Dökümü
                                                                                                            </div>
                                                                                                            <div className="space-y-1.5 max-h-60 overflow-y-auto custom-scrollbar pr-1 overscroll-contain">
                                                                                                                {item.breakdown.map((b: any, idx: number) => (
                                                                                                                    <div key={idx} className="flex justify-between items-start gap-3 border-b border-slate-600/30 pb-1 last:border-0 last:pb-0">
                                                                                                                        <span className="opacity-90 leading-tight" title={b.source}>{b.source}</span>
                                                                                                                        <span className={`font-mono font-bold shrink-0 mt-0.5 ${b.qty > 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                                                                                                            {b.qty > 0 ? '+' : ''}{b.qty.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                                                                                                                        </span>
                                                                                                                    </div>
                                                                                                                ))}
                                                                                                            </div>

                                                                                                            <div className="border-t border-slate-600 mt-2 pt-2 flex justify-between items-center text-yellow-400 font-bold">
                                                                                                                <span>Sistem Toplamı:</span>
                                                                                                                <span>{item.calculatedAutoQty.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} {item.unit}</span>
                                                                                                            </div>
                                                                                                        </div>
                                                                                                    )}

                                                                                                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-[6px] border-transparent border-t-slate-800 dark:border-t-slate-700"></div>
                                                                                                </div>
                                                                                            </div>
                                                                                        )}
                                                                                </div>

                                                                                {!isLocked && item.manualQuantity !== undefined ? (
                                                                                    <button
                                                                                        onClick={() => updateCostItem(category.id, item.name, 'manualQuantity', undefined)}
                                                                                        className="text-[9px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded uppercase font-bold"
                                                                                    >
                                                                                        Sıfırla
                                                                                    </button>
                                                                                ) : (
                                                                                    <div className="flex items-center gap-1">
                                                                                        <span className={`text-[9px] px-1.5 py-0.5 rounded uppercase font-bold ${isLocked ? 'bg-slate-200 dark:bg-slate-700 text-slate-500' : 'bg-blue-100 dark:bg-blue-900/40 text-blue-600 dark:text-blue-400'}`}>
                                                                                            {isLocked ? 'Sistem' : 'Oto'}
                                                                                        </span>
                                                                                        {!isLocked && (['wet_area', 'dry_area', 'dry_perimeter', 'calc_facade', 'calc_excavation'].includes(item.auto_source) || item.name.includes("Duvar Malzemesi")) && (
                                                                                            <span
                                                                                                className="text-[8px] bg-indigo-100 dark:bg-indigo-900/40 text-indigo-600 dark:text-indigo-400 px-1.5 py-0.5 rounded cursor-help font-bold"
                                                                                                title="Plan geometrisine/zorluğuna göre hesaplanan fire veya kabarma payı dahildir."
                                                                                            >
                                                                                                +Fire
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                )}
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex items-center justify-center pt-2">
                                                                            <span className="text-slate-300 dark:text-slate-600 text-sm font-bold">x</span>
                                                                        </div>

                                                                        <div className="flex-1 min-w-0 flex flex-col">
                                                                            <div className="flex items-center border rounded-lg relative overflow-hidden bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600 focus-within:border-blue-500">
                                                                                <NumericInput
                                                                                    disabled={false}
                                                                                    className="w-full bg-transparent text-slate-900 dark:text-white text-sm p-2 outline-none focus:bg-white dark:focus:bg-slate-950 transition font-mono text-right pr-7"
                                                                                    value={item.manualPrice !== undefined ? Number(Number(item.manualPrice).toFixed(2)) : Number(Number(item.unit_price).toFixed(2))}
                                                                                    onChange={(val) => updateCostItem(category.id, item.name, 'manualPrice', val)}
                                                                                    placeholder="Fiyat"
                                                                                />
                                                                                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold bg-slate-50/90 dark:bg-slate-900/90 pl-1">₺</span>
                                                                            </div>

                                                                            <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-1 mt-1.5 px-1">
                                                                                <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">B.Fiyat</span>
                                                                                {item.manualPrice !== undefined && (
                                                                                    <button
                                                                                        onClick={() => updateCostItem(category.id, item.name, 'manualPrice', undefined)}
                                                                                        className="text-[9px] bg-yellow-100 dark:bg-yellow-900/40 text-yellow-700 dark:text-yellow-400 px-1.5 py-0.5 rounded uppercase font-bold"
                                                                                    >
                                                                                        Sıfırla
                                                                                    </button>
                                                                                )}
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            );
                                                })}
                                                        </div>
                                        </div>
                                    )}
                                        </div>
                                    ))}

                                    <div className="md:col-span-2 mt-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg transition-all duration-300 shadow-sm relative">
                                        <div className="sticky top-0 md:top-[110px] z-10 bg-slate-100/95 dark:bg-slate-800/95 backdrop-blur-sm px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center shadow-sm">                                <div className="flex items-center gap-3">
                                            <div className="bg-white dark:bg-slate-800 p-1.5 rounded-lg border border-slate-300 dark:border-slate-600 shadow-sm">
                                                <i className="fas fa-plus-circle text-teal-500"></i>
                                            </div>
                                            <div>
                                                <h3 className="font-bold text-slate-800 dark:text-white text-sm uppercase">Özel İlaveler / Ek İşler</h3>
                                                <p className="text-[10px] text-slate-500 dark:text-slate-400">Listede yer almayan özel maliyet ve kalemleri buraya ekleyebilirsiniz.</p>
                                            </div>
                                        </div>
                                            <button onClick={addCustomCost} className="bg-teal-600 hover:bg-teal-500 text-white px-3 py-1.5 rounded font-bold text-xs transition shadow-sm flex items-center gap-1">
                                                <i className="fas fa-plus"></i> <span className="hidden sm:inline">Kalem Ekle</span>
                                            </button>
                                        </div>

                                        <div className="p-4 space-y-3 bg-white dark:bg-slate-900/30">
                                            {customCosts.length === 0 && (
                                                <div className="text-center text-slate-500 text-xs py-6 italic border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-lg">
                                                    Şu an eklenmiş özel bir kalem bulunmuyor. Ekstra işler için sağ üstten kalem ekleyebilirsiniz.
                                                </div>
                                            )}

                                            {customCosts.map((cc) => (
                                                <div key={cc.id} className="flex flex-col md:flex-row gap-3 items-center bg-slate-50 dark:bg-slate-800/50 p-3 rounded-lg border border-slate-200 dark:border-slate-700 hover:border-teal-300 transition">
                                                    <div className="flex-1 w-full">
                                                        <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1">Açıklama / İşin Adı</label>
                                                        <input
                                                            type="text"
                                                            value={cc.name}
                                                            onChange={(e) => updateCustomCost(cc.id, 'name', e.target.value)}
                                                            placeholder="Örn: Özel bahçe peyzaj düzenlemesi..."
                                                            className="bg-transparent border-b border-slate-300 dark:border-slate-600 focus:border-teal-500 outline-none px-2 py-1 text-sm font-medium text-slate-900 dark:text-white w-full transition-colors"
                                                        />
                                                    </div>
                                                    <div className="flex items-center gap-2 w-full md:w-auto justify-end">
                                                        <div className="w-32">
                                                            <label className="text-[9px] uppercase font-bold text-slate-400 block mb-1 text-right">Tutar</label>
                                                            <div className="flex items-center border rounded relative bg-white dark:bg-slate-950 border-slate-300 dark:border-slate-600 focus-within:border-teal-500">
                                                                <NumericInput
                                                                    value={cc.price}
                                                                    onChange={(val) => updateCustomCost(cc.id, 'price', val)}
                                                                    className="w-full bg-transparent text-slate-900 dark:text-white text-sm p-1.5 outline-none font-bold text-right pr-6"
                                                                    placeholder="0"
                                                                />
                                                                <span className="absolute right-2 text-xs text-slate-500 font-bold">₺</span>
                                                            </div>
                                                        </div>
                                                        <div className="pt-4">
                                                            <button
                                                                onClick={() => removeCustomCost(cc.id)}
                                                                className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded transition"
                                                                title="Sil"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}

                                            {customCosts.length > 0 && (
                                                <div className="flex justify-end pt-3 border-t border-slate-200 dark:border-slate-700 mt-2">
                                                    <div className="bg-teal-50 dark:bg-teal-900/20 px-4 py-2 rounded text-right border border-teal-100 dark:border-teal-800">
                                                        <span className="text-xs text-teal-600 dark:text-teal-400 uppercase font-bold mr-2">Özel İlaveler Toplamı:</span>
                                                        <span className="text-lg font-bold text-teal-700 dark:text-teal-300 font-mono">
                                                            {customCosts.reduce((s, c) => s + c.price, 0).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                        </span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </div>
                </section>

                <div id="tour-financial" className="flex flex-col gap-6 md:gap-8 w-full">
                    <ProjectSchedulePanel />
                    <FinancialAnalysisPanel />
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 shadow-lg">
                        <h2 className="text-lg font-bold text-slate-900 dark:text-white mb-4 flex items-center gap-2">
                            <i className="fas fa-chart-pie text-pink-500"></i> Proje Maliyet Dağılımı
                        </h2>
                        <div className="space-y-3">
                            {projectCostDetails.map(cat => {
                                const percent = (cat.totalCategoryCost / (projectTotalCost || 1)) * 100;
                                return (
                                    <div key={cat.id}>
                                        <div className="flex justify-between text-xs mb-1">
                                            <span className="text-slate-700 dark:text-slate-300 font-medium truncate w-1/2">{cat.title}</span>
                                            <span className="text-slate-500 dark:text-slate-400">{percent.toFixed(1)}% ({cat.totalCategoryCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}₺)</span>
                                        </div>
                                        <div className="w-full bg-slate-100 dark:bg-slate-700 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-2 rounded-full transition-all duration-500"
                                                style={{
                                                    width: `${percent}%`, backgroundColor:
                                                        cat.id === 'kaba_insaat' ? '#eab308' :
                                                            cat.id === 'mobilya_ahsap' ? '#f59e0b' :
                                                                cat.id === 'vitrifiye_ankastre' ? '#06b6d4' :
                                                                    cat.id === 'santiye_hafriyat' ? '#f97316' :
                                                                        cat.id === 'arsa_finansman' ? '#10b981' : '#3b82f6'
                                                }}
                                            ></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </section>

                    {/* PROCUREMENT SUMMARY - GERÇEK SARF MALZEMELER */}
                    {/* PROCUREMENT SUMMARY - GERÇEK SARF MALZEMELER */}
                    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 shadow-lg flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <i className="fas fa-truck-loading text-emerald-500"></i> Malzeme & Tedarik Planı
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-3 py-1.5 rounded border border-emerald-200 dark:border-emerald-800">
                                    {totalProcurementCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                            <p className="text-xs text-slate-500">
                                Şantiyeye sevk edilecek malzeme listesi.
                            </p>
                            <button
                                onClick={() => setShowProcurementModal(true)}
                                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded transition shadow-sm font-bold flex items-center gap-1 shrink-0 ml-2"
                            >
                                <i className="fas fa-search"></i> Tüm Listeyi İncele
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 max-h-64">
                            {topProcurementItems.length === 0 && (
                                <div className="text-center text-slate-500 text-xs py-8">İş programı ve metrajlar hesaplanıyor...</div>
                            )}
                            {topProcurementItems.map((item, idx) => (
                                <div
                                    key={idx}
                                    className="w-full flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700/50 transition group text-left"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors truncate max-w-[200px] sm:max-w-[250px]">{item.name}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {item.taskName}
                                        </span>
                                    </div>
                                    <div className="text-right flex flex-col items-end shrink-0">
                                        <div className="font-bold text-slate-900 dark:text-white text-base">
                                            {item.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                                            <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">{item.unit}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400">
                                            {item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>

                        {/* YENİ EKLENEN KISIM: KARTIN ALTINDAKİ BUTON */}
                        <div className="pt-4 mt-2 border-t border-slate-200 dark:border-slate-700">
                            <button
                                onClick={() => setShowSupplierModal(true)}
                                className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 py-2.5 rounded-lg font-bold text-sm shadow-md flex items-center justify-center gap-2 transition active:scale-95"
                            >
                                <i className="fas fa-shopping-cart"></i> Bölgedeki Toptancılardan Fiyat Al
                            </button>
                        </div>
                    </section>
                </div>

            </main>

            {/* YENİ SİSTEM VE YÖNETMELİK UYARILARI MODALI */}
            {showWarningsModal && systemWarnings.length > 0 && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl overflow-hidden relative flex flex-col max-h-[90vh]">

                        {/* Modal Header */}
                        <div className="bg-slate-50 dark:bg-slate-800/50 p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-start shrink-0">
                            <div className="flex items-center gap-3">
                                <div className="bg-orange-100 dark:bg-orange-900/30 w-10 h-10 rounded-full flex items-center justify-center shrink-0 border border-orange-200 dark:border-orange-800/50">
                                    <i className="fas fa-balance-scale text-orange-600 dark:text-orange-400 text-lg"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">Proje ve Yönetmelik Uyarıları</h3>
                                    <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
                                        Projenizdeki eksiklikleri ve yasal uyumsuzlukları inceleyin.
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowWarningsModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar space-y-4 flex-1">
                            {systemWarnings.map(warning => (
                                <div key={warning.id} className={`p-4 rounded-xl border flex flex-col md:flex-row gap-4 justify-between items-start transition-all ${warning.type === 'critical'
                                    ? 'bg-red-50 dark:bg-red-900/10 border-red-200 dark:border-red-900/30'
                                    : 'bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/50'
                                    }`}>
                                    <div className="flex items-start gap-3">
                                        <div className={`p-2 rounded-full mt-1 shrink-0 ${warning.type === 'critical' ? 'bg-red-100 dark:bg-red-800/50 text-red-600 dark:text-red-400' : 'bg-orange-100 dark:bg-orange-800/50 text-orange-600 dark:text-orange-400'
                                            }`}>
                                            <i className={`fas ${warning.category === 'area' ? 'fa-ruler-combined' : 'fa-balance-scale'}`}></i>
                                        </div>
                                        <div>
                                            <h4 className={`font-bold text-sm ${warning.type === 'critical' ? 'text-red-800 dark:text-red-300' : 'text-slate-800 dark:text-white'
                                                }`}>
                                                {warning.title}
                                            </h4>
                                            <p className="text-xs text-slate-600 dark:text-slate-300 mt-1.5 leading-relaxed">
                                                <span dangerouslySetInnerHTML={{ __html: warning.message.replace('Kentsel Dönüşüm', '<strong>Kentsel Dönüşüm</strong>') }}></span>
                                            </p>
                                            <div className="text-xs text-slate-500 dark:text-slate-400 italic mt-2 bg-white/50 dark:bg-slate-900/30 p-2 rounded border border-slate-200/50 dark:border-slate-700/50">
                                                <i className="fas fa-lightbulb text-yellow-500 mr-1"></i> {warning.suggestion}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Oto-Düzelt Butonu */}
                                    {warning.autoFix && (
                                        <button
                                            onClick={() => applyAutoFix(warning.autoFix!)}
                                            className="shrink-0 w-full md:w-auto bg-white dark:bg-slate-800 border border-slate-300 dark:border-slate-600 hover:border-blue-500 hover:text-blue-600 text-slate-700 dark:text-slate-300 px-4 py-2 rounded-lg text-xs font-bold transition shadow-sm flex items-center justify-center gap-2 active:scale-95"
                                        >
                                            <i className="fas fa-magic text-blue-500"></i>
                                            {warning.autoFix.buttonText}
                                        </button>
                                    )}
                                </div>
                            ))}
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-right shrink-0">
                            <button
                                onClick={() => setShowWarningsModal(false)}
                                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2.5 rounded-lg font-bold text-sm hover:opacity-90 transition active:scale-95"
                            >
                                Tamam
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ProcurementModal
                isOpen={showProcurementModal}
                onClose={() => setShowProcurementModal(false)}
                procurementGroups={groupedProcurement}
            />

            <SupplierModal
                isOpen={showSupplierModal}
                onClose={() => setShowSupplierModal(false)}
                procurementGroups={groupedProcurement}
            />

            <ArchitectModal
                isOpen={showArchitectModal}
                onClose={() => setShowArchitectModal(false)}
            />
            <TutorialOverlay />
            {showDuplexModal && <DuplexManagerModal onClose={() => setShowDuplexModal(false)} />}
        </div>
    );
};