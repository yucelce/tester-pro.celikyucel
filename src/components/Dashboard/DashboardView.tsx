// src/components/Dashboard/DashboardView.tsx
import React from 'react';
import { getCategoryIcon } from '../../utils/icons';
import { useTheme } from '../../contexts/ThemeContext';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { UnitFloorType, WallMaterial } from '../../types';
import { ProjectSchedulePanel } from './ProjectSchedulePanel';
import { NumericInput } from '../Shared/NumericInput';
import { calculateRawMaterials, RawMaterial } from '../../utils/materialCalculator';
import { useMemo, useState } from 'react';
import { FinancialAnalysisPanel } from './FinancialAnalysisPanel';
import { ProcurementModal } from '../Modals/ProcurementModal';
import { TutorialOverlay } from '../Shared/TutorialOverlay';
import { exportCostsToExcel, importPricesFromExcel } from '../../utils/excelUtils';

export const DashboardView: React.FC = () => {
    const { theme, toggleTheme } = useTheme();
    const [showAreaErrorModal, setShowAreaErrorModal] = React.useState(false);
    const { startTutorial } = useUIStore();

    // --- YENİ EKLENEN: Detaylı Mod Uyarı State'i ---
    const [showDetailedModeInfo, setShowDetailedModeInfo] = useState(false);

    // --- YENİ EKLENEN: Sabit Header/Toplam Maliyet Görünürlüğü State'i ---
    const [isHeaderPinned, setIsHeaderPinned] = useState(false);

    // --- YENİ EKLENEN: Mod Geçiş ve Uyarı Kontrol Fonksiyonları ---
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

    // Store'dan gerekli verileri ve YENİ EKLENEN fonksiyonları çekiyoruz
    const {
        projectTotalCost, buildingStats, totalConstructionArea, constructionDuration, globalStructuralCost, interiorFitoutCost,
        projectCostDetails, units, structuralUnits, globalWallMode, globalConcreteMode, globalWallMaterial,
        addUnit, addStructuralUnit, deleteUnit, updateUnitCount, updateUnitName, updateUnitFloorType, toggleWallMode, toggleConcreteMode, setGlobalWallMaterial, updateCostItem,
        isDataDirty, recalculateCosts, dismissDataDirty, updateConstructionDuration, duplicateUnit, areaValidation,
        customCosts, addCustomCost, updateCustomCost, removeCustomCost, projectSchedule, isPriceFetchError,
        globalStats, costs, bulkUpdatePrices
    } = useProjectStore();

    // YENİ: Alan hatası detayını göstermek için state
    const [showAreaErrorDetail, setShowAreaErrorDetail] = React.useState(false);

    const {
        navigateToEditor, openModal, expandedCategories, toggleCategory, toggleAllCategories, accountId,
        navigateToReport
    } = useUIStore();

    // Calculate Data for Charts
    const maxCategoryCost = Math.max(...projectCostDetails.map(c => c.totalCategoryCost));
    // Tüm kalemler içinde manuel müdahale var mı kontrolü
    const hasManualOverrides = projectCostDetails.some(cat =>
        cat.items.some(item => item.manualQuantity !== undefined || item.manualPrice !== undefined)
    );

    // Flatten all items to get top materials for procurement list
    const allMaterials = projectCostDetails.flatMap(cat =>
        cat.items.filter(i => i.totalPrice > 0).map(i => ({ ...i, categoryTitle: cat.title }))
    ).sort((a, b) => b.totalPrice - a.totalPrice);

    // YENİ: Gerçek Sarf Malzeme Hesaplaması ve Maliyet Entegrasyonu
    const rawMaterials = useMemo(() => {
        const currentQuantities: Record<string, number> = {};
        projectCostDetails.forEach(cat => {
            cat.items.forEach(item => {
                currentQuantities[item.name] = item.finalQty;
            });
        });

        // Artık MOCK data yok, doğrudan projenin gerçek hesaplanmış istatistiklerini (globalStats) kullanıyoruz
        return calculateRawMaterials(globalStats || {}, currentQuantities, projectSchedule || [], costs);
    }, [projectCostDetails, projectSchedule, globalStats, costs]);

    // Toplam Sarf Malzeme Maliyeti
    const totalRawMaterialCost = rawMaterials.reduce((sum, item) => sum + item.estimatedCost, 0);

    // Seçili Malzeme Detayı Modalı İçin State
    const [selectedMaterial, setSelectedMaterial] = useState<RawMaterial | null>(null);

    // DETAYLI TEDARİK MODALI STATE VE HESAPLARI
    const [showProcurementModal, setShowProcurementModal] = useState(false);

    // BİRDEN FAZLA DEĞER DÖNECEĞİ İÇİN İSMİNİ procurementData OLARAK DEĞİŞTİRDİK
    const procurementData = useMemo(() => {
        const groups: Record<string, { date: Date, taskName: string, items: any[], totalCost: number }> = {};

        // YENİ: AYLIK DÜZENLİ GİDERLER GRUBU
        const recurringGroup = { items: [] as any[], totalCost: 0 };

        const getTaskForCategory = (catId: string, itemName: string): string => {
            const nameLower = itemName.toLowerCase();

            // DÜZELTME 2 & 4: Enerji Kimlik Belgesi (EKB), Yeşil Etiket vb. İskan ve Teslim (handover) aşamasına alınır.
            if (nameLower.includes('yeşil etiket') || nameLower.includes('asansör ruhsat') || nameLower.includes('enerji kimlik')) {
                return 'handover';
            }

            switch (catId) {
                case 'arsa_finansman': return 'official';
                case 'resmi_idari':
                    if (nameLower.includes('iskan') || nameLower.includes('i̇skan')) return 'handover';
                    return 'official';
                case 'santiye_hafriyat':
                    if (nameLower.includes('hafriyat') || nameLower.includes('iksa') || nameLower.includes('jcb')) return 'excavation';
                    // DÜZELTME 3: Dış Cephe Güvenlik Ağı Kaba Yapı (structure) ile beraber kurulur
                    if (nameLower.includes('güvenlik ağı')) return 'structure';
                    return 'site_prep';
                case 'kaba_insaat':
                    if (nameLower.includes('çatı')) return 'roof';
                    return 'structure';
                case 'duvar_tavan':
                    // DÜZELTME 1: Kartonpiyer/Stropiyer ham duvara değil, boya aşamasına/öncesine konur
                    if (nameLower.includes('kartonpiyer') || nameLower.includes('stropiyer')) return 'paint';
                    if (nameLower.includes('sıva') || nameLower.includes('alçı')) return 'plaster';
                    if (nameLower.includes('boya')) return 'paint';
                    return 'walls';
                case 'dis_cephe': return 'facade';
                case 'zemin_kaplama':
                    if (nameLower.includes('şap')) return 'screed';
                    return 'flooring';
                case 'mobilya_ahsap': return 'joinery';
                case 'vitrifiye_ankastre': return 'mep_finish';
                case 'mekanik_tesisat':
                    if (nameLower.includes('altyapı') || nameLower.includes('tesisat')) return 'mep_rough';
                    return 'mep_finish';
                case 'elektrik_tesisat':
                    if (nameLower.includes('kablo') || nameLower.includes('sorti') || nameLower.includes('altyapı') || nameLower.includes('boru')) return 'mep_rough';
                    return 'mep_finish';
                case 'peyzaj_cevre': return 'landscape';
                case 'ozel_kalemler': return 'handover';
                default: return 'structure';
            }
        };

        projectCostDetails.forEach(cat => {
            cat.items.forEach(item => {
                if (item.totalPrice > 0) {

                    // YENİ: BİRİMİ "Ay" OLANLARI AYRI GRUBA ALIYORUZ
                    if (item.unit === 'Ay') {
                        recurringGroup.items.push({
                            name: item.name,
                            unit: item.unit,
                            qty: item.finalQty,
                            totalPrice: item.totalPrice,
                            monthlyPrice: item.unit_price, // Aylık fiyat
                            inputType: item.inputType
                        });
                        recurringGroup.totalCost += item.totalPrice;
                    }
                    // STANDART İŞ ZAMANI KALEMLERİ
                    else {
                        const taskId = getTaskForCategory(cat.id, item.name);
                        const task = projectSchedule.find(t => t.id === taskId);
                        const taskName = task ? task.name : 'Diğer';
                        const date = task ? task.startDate : new Date();
                        const dateStr = date.toISOString().split('T')[0];
                        const key = `${dateStr}_${taskId}`;

                        if (!groups[key]) {
                            groups[key] = { date, taskName, items: [], totalCost: 0 };
                        }
                        groups[key].items.push({
                            name: item.name,
                            unit: item.unit,
                            qty: item.finalQty,
                            totalPrice: item.totalPrice,
                            inputType: item.inputType
                        });
                        groups[key].totalCost += item.totalPrice;
                    }
                }
            });
        });

        // Objeyi iki parça olarak dönüyoruz
        return {
            timelineGroups: Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime()),
            recurringGroup
        };
    }, [projectCostDetails, projectSchedule]);

    const LOCKED_ITEMS = [
        "Mimari Proje",
        "Statik Proje",
        "Mekanik Proje",
        "Elektrik Projesi",
        "Yapı Denetim Hizmet Bedeli",
        "Arsa Rayiç Bedeli (Maliyet)"
    ];

    return (
        <div
            className="flex h-screen flex-col bg-slate-50 dark:bg-slate-900 font-sans text-slate-800 dark:text-slate-200 overflow-y-auto transition-colors duration-300 relative"
            onScroll={(e) => setIsHeaderPinned(e.currentTarget.scrollTop > 120)}
        >
            {/* --- FLOATING TOTAL COST (Sticky / Görünümden çıkınca belirir) --- */}
            {/* DashboardView.tsx - Yüzen Maliyet Barı Değişikliği */}
            <div className={`fixed bottom-0 md:bottom-auto md:top-4 left-0 md:left-auto md:right-4 w-full md:w-auto z-[40] bg-white/95 dark:bg-slate-900/95 backdrop-blur-md md:shadow-lg border-t md:border border-slate-200 dark:border-slate-700 md:rounded-xl p-3 md:p-2 px-4 transition-all duration-300 transform md:pointer-events-none flex justify-between md:flex-col items-center md:items-end ${isHeaderPinned ? 'translate-y-0 opacity-100 scale-100' : 'translate-y-12 md:-translate-y-12 opacity-0 md:scale-95'}`}>
                <div className="text-[10px] md:text-[9px] text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Toplam Maliyet</div>
                <div className="text-xl md:text-lg font-extrabold text-green-600 dark:text-green-500 tracking-tight leading-tight">
                    {projectTotalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}
                </div>
            </div>

            {/* --- Dashboard Header --- */}
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
                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400">Yapı Maliyet ve Yönetim -Test- </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-4 w-full md:w-auto justify-between md:justify-end">

                        <button onClick={() => openModal('projectManagement')} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-4 py-2 rounded-lg font-bold text-sm transition border border-slate-200 dark:border-slate-700 flex items-center gap-2">
                            <i className="fas fa-folder-open text-blue-500"></i>
                            <span className="hidden sm:inline">Projelerim</span>
                        </button>

                        <button
                            id="tour-report-btn"
                            onClick={navigateToReport}
                            className="bg-indigo-600 hover:bg-indigo-500 text-white px-4 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 border border-indigo-700 shadow-sm"
                        >
                            <i className="fas fa-file-pdf"></i>
                            <span className="hidden sm:inline">Raporla</span>
                        </button>

                        <button
                            onClick={startTutorial}
                            className="bg-indigo-100 dark:bg-indigo-900/30 text-indigo-600 dark:text-indigo-400 hover:bg-indigo-200 dark:hover:bg-indigo-800 px-3 py-2 rounded-lg font-bold text-sm transition flex items-center gap-2 border border-indigo-200 dark:border-indigo-700/50"
                            title="Program Nasıl Kullanılır?"
                        >
                            <i className="fas fa-graduation-cap"></i>
                            <span className="hidden sm:inline">Nasıl Çalışır?</span>
                        </button>

                        <button onClick={toggleTheme} className="w-10 h-10 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-600 dark:text-yellow-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition shrink-0">
                            <i className={`fas ${theme === 'dark' ? 'fa-sun' : 'fa-moon'}`}></i>
                        </button>
                        <div id="tour-total-cost" className="text-right pl-4 md:pl-6 border-l border-slate-200 dark:border-slate-800">
                            <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400 uppercase font-bold tracking-wider">Toplam Maliyet</div>
                            <div className="text-2xl md:text-3xl font-bold text-green-600 dark:text-green-500">{projectTotalCost.toLocaleString('tr-TR', { style: 'currency', currency: 'TRY', maximumFractionDigits: 0 })}</div>
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

            {/* --- VERİ DEĞİŞİKLİĞİ UYARI BARI --- */}
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

            {/* --- Detaylı Mod Bilgilendirme Toast'u --- */}
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

                {/* 1. SECTION: YAPI GENEL BİLGİLERİ */}
                <section id="tour-building-stats" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 shadow-lg dark:shadow-xl relative overflow-hidden transition-colors duration-300">                    <div className="absolute top-0 right-0 w-24 h-24 md:w-32 md:h-32 bg-blue-50 dark:bg-blue-600/10 rounded-bl-full -mr-10 -mt-10 pointer-events-none"></div>
                    <div className="flex flex-col md:flex-row justify-between items-start mb-6 relative z-10 gap-4">
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <i className="fas fa-building text-blue-500"></i> Yapı Genel Bilgileri
                            </h2>
                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">Arsa, Konum ve Kat Bilgileri {accountId && <span className="ml-2 text-green-500 font-bold">(Pro Hesap)</span>}</p>                        </div>

                        <div className="flex gap-2 w-full md:w-auto">
                            <button onClick={() => openModal('brandSelection')} className="flex-1 md:flex-none bg-indigo-50 dark:bg-indigo-900/20 hover:bg-indigo-100 dark:hover:bg-indigo-800 text-indigo-600 dark:text-indigo-400 px-4 py-2 rounded-lg text-sm font-bold transition border border-indigo-200 dark:border-indigo-700/50 flex justify-center items-center gap-2">
                                <i className="fas fa-tags"></i><span className="hidden md:inline">Marka Seç</span>
                            </button>
                            <button onClick={() => openModal('building')} className="flex-1 md:flex-none bg-blue-50 dark:bg-blue-600/20 hover:bg-blue-100 dark:hover:bg-blue-600 text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-white px-4 py-2 rounded-lg text-sm font-bold transition border border-blue-200 dark:border-blue-600/30 flex justify-center items-center gap-2">
                                <i className="fas fa-pen"></i><span className="hidden md:inline">Düzenle</span>
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700/50">
                            <div className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold mb-1">Konum</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white truncate">
                                {buildingStats.province}, {buildingStats.district}
                            </div>
                            {buildingStats.buildingType === 'villa' && (
                                <div className="mt-2 inline-flex items-center gap-1.5 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[10px] font-bold px-2 py-1 rounded-full">
                                    <i className="fas fa-home text-[9px]"></i> VİLLA MODU
                                </div>
                            )}
                        </div>
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-0 rounded-lg border border-slate-200 dark:border-slate-700/50 flex flex-col justify-between overflow-hidden group">

                            {/* ÜST KISIM: İNŞAAT ALANI */}
                            <div className="p-4 pb-2">
                                <div className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold mb-1">Toplam İnşaat Alanı</div>
                                <div className="text-2xl font-bold text-slate-900 dark:text-white">
                                    {totalConstructionArea.toLocaleString()} m²
                                </div>
                                <div className="text-[10px] text-slate-500 mt-1">Emsal Dahil</div>
                            </div>

                            {/* ALT KISIM: YAPIM SÜRESİ (AYRI RENK VE DÜZEN) */}
                            <div className="bg-slate-100 dark:bg-slate-800/50 p-3 px-4 border-t border-slate-200 dark:border-slate-700/50 flex items-center justify-between transition-colors hover:bg-slate-200 dark:hover:bg-slate-800">
                                {/* Sol Taraf: Etiket ve İkon */}
                                <div className="flex flex-col">
                                    <span className="text-[9px] text-slate-500 uppercase font-bold tracking-wider">Yapım Süresi</span>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                        <i className={`far fa-clock text-xs ${buildingStats.isDurationManual ? 'text-orange-500' : 'text-blue-500'}`}></i>
                                        <div className="relative">
                                            <input
                                                type="number"
                                                value={constructionDuration}
                                                onChange={(e) => updateConstructionDuration(parseFloat(e.target.value))}
                                                className={`bg-transparent w-12 font-bold text-sm outline-none border-b border-transparent hover:border-slate-400 focus:border-blue-500 transition-all p-0 
                        ${buildingStats.isDurationManual ? 'text-orange-600 dark:text-orange-400' : 'text-slate-700 dark:text-slate-300'}`}
                                            />
                                            <span className="text-xs font-medium text-slate-500 ml-1">Ay</span>
                                        </div>
                                    </div>
                                </div>

                                {/* Sağ Taraf: Durum Bildirimi ve Reset Butonu */}
                                <div className="flex items-center">
                                    {buildingStats.isDurationManual ? (
                                        <button
                                            onClick={() => updateConstructionDuration(undefined)}
                                            className="w-7 h-7 flex items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400 hover:scale-110 transition shadow-sm"
                                            title="Otomatik Hesaplamaya Dön"
                                        >
                                            <i className="fas fa-magic text-xs"></i>
                                        </button>
                                    ) : (
                                        <div className="px-2 py-1 rounded bg-blue-50 dark:bg-blue-900/20 text-[10px] font-bold text-blue-600 dark:text-blue-400 border border-blue-100 dark:border-blue-900/30">
                                            OTO
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700/50">
                            <div className="text-slate-500 dark:text-slate-400 text-xs uppercase font-bold mb-1">Kat Bilgisi</div>
                            <div className="text-lg font-bold text-slate-900 dark:text-white">
                                {buildingStats.basementFloorCount} Bodrum + Zemin + {buildingStats.normalFloorCount} Normal
                            </div>
                            <div className="text-[10px] text-slate-600 dark:text-slate-500 mt-1">
                                Toplam Yükseklik: {(
                                    (buildingStats.normalFloorCount * buildingStats.normalFloorHeight) +
                                    buildingStats.groundFloorHeight +
                                    (buildingStats.basementFloorCount * buildingStats.basementFloorHeight)
                                ).toFixed(1)} m
                            </div>
                        </div>

                        {/* Maliyet Kutusu */}
                        <div className="bg-slate-50 dark:bg-slate-900/50 p-4 rounded-lg border border-slate-200 dark:border-slate-700/50 flex flex-col justify-center relative">
                            {/* Mevcut Maliyet Satırları */}
                            <div className="flex justify-between items-center border-b border-slate-200 dark:border-slate-700/50 pb-2 mb-2">
                                <span className="text-xs text-slate-500 dark:text-slate-400">Kaba Yapı</span>
                                <span className="text-sm font-bold text-yellow-600 dark:text-yellow-500">{globalStructuralCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                            </div>
                            <div className="flex justify-between items-center">
                                <span className="text-xs text-slate-500 dark:text-slate-400">İnce İşler</span>
                                <span className="text-sm font-bold text-purple-600 dark:text-purple-400">{interiorFitoutCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                            </div>

                            {/* UYARI ALANI */}
                            {areaValidation && areaValidation.hasError && (
                                <div className="mt-4 pt-3 border-t border-slate-200 dark:border-slate-700/50">
                                    <button
                                        onClick={() => setShowAreaErrorModal(true)}
                                        className="group w-full flex items-center justify-between px-3 py-2 bg-red-50 dark:bg-red-900/10 hover:bg-red-100 dark:hover:bg-red-900/20 border border-red-200 dark:border-red-900/30 rounded transition duration-200"
                                    >
                                        <div className="flex items-center gap-2">
                                            <div className="w-5 h-5 rounded-full bg-red-100 dark:bg-red-800 flex items-center justify-center shrink-0">
                                                <i className="fas fa-exclamation text-[10px] text-red-600 dark:text-red-200 animate-pulse"></i>
                                            </div>
                                            <span className="text-xs font-bold text-red-700 dark:text-red-300">
                                                Alan Tutarsızlığı
                                            </span>
                                        </div>
                                        <span className="text-[10px] font-mono text-red-600/70 dark:text-red-400/70 group-hover:text-red-600">
                                            Detay <i className="fas fa-chevron-right ml-1"></i>
                                        </span>
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </section>

                {/* 3. SECTION: YAPISAL ELEMANLAR DETAY PANELİ (Structural Floors) */}
                <section id="tour-structural" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 shadow-lg dark:shadow-xl transition-colors duration-300">                    <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div>
                        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                            <i className="fas fa-hard-hat text-orange-500"></i> Yapısal Elemanlar Detay Paneli
                        </h2>
                        <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">Kat planları bazında duvar, kolon, kiriş ve döşemelerin metraj yönetimi</p>
                    </div>

                    <div className="flex flex-col md:flex-row items-end md:items-center gap-4 w-full md:w-auto">
                        {/* DUVAR TOGGLE & MATERIAL */}
                        <div className="flex flex-col gap-1 items-start w-full md:w-auto">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Duvar Malzemesi ve Metraj</span>
                            <div className="flex items-center gap-2 bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                                <select
                                    value={globalWallMaterial}
                                    onChange={(e) => setGlobalWallMaterial(e.target.value as WallMaterial)}
                                    className="bg-transparent dark:bg-slate-900 text-xs font-bold text-slate-700 dark:text-slate-300 outline-none p-1.5 border-r border-slate-300 dark:border-slate-600 mr-1 flex-1 md:flex-none"                                    >
                                    <option value="gazbeton" className="dark:bg-slate-900">Gazbeton</option>
                                    <option value="tugla" className="dark:bg-slate-900">Tuğla</option>
                                    <option value="bims" className="dark:bg-slate-900">Bims</option>
                                </select>

                                <button onClick={() => handleWallModeClick('auto')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${globalWallMode === 'auto' ? 'bg-blue-500 text-white shadow' : 'text-slate-500'}`}>Oto</button>
                                <button onClick={() => handleWallModeClick('detailed')} className={`px-3 py-1.5 text-xs font-bold rounded transition ${globalWallMode === 'detailed' ? 'bg-blue-600 text-white shadow' : 'text-slate-500'}`}>Detaylı</button>                                </div>
                        </div>

                        {/* BETONARME TOGGLE */}
                        <div className="flex flex-col gap-1 items-start w-full md:w-auto">
                            <span className="text-[10px] text-slate-400 uppercase font-bold">Betonarme</span>
                            <div className="flex items-center bg-slate-100 dark:bg-slate-900 rounded-lg p-1 border border-slate-200 dark:border-slate-700 w-full md:w-auto">
                                <button onClick={() => handleConcreteModeClick('auto')} className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded transition ${globalConcreteMode === 'auto' ? 'bg-orange-500 text-white shadow' : 'text-slate-500'}`}>Oto</button>
                                <button onClick={() => handleConcreteModeClick('detailed')} className={`flex-1 md:flex-none px-3 py-1.5 text-xs font-bold rounded transition ${globalConcreteMode === 'detailed' ? 'bg-orange-600 text-white shadow' : 'text-slate-500'}`}>Detaylı</button>                                </div>
                        </div>

                        <button onClick={addStructuralUnit} className="bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm h-10 mt-2 md:mt-0 w-full md:w-auto justify-center"><i className="fas fa-plus"></i> Yeni Kat Planı</button>
                    </div>
                </div>

                    <div className="space-y-3">
                        {structuralUnits.length === 0 && <div className="text-slate-500 text-sm text-center py-4">Henüz bir kat planı eklenmemiş.</div>}
                        {structuralUnits.map(unit => (
                            <div key={unit.id} className="bg-slate-50 dark:bg-slate-900/40 border border-slate-200 dark:border-slate-700 rounded-lg p-4 flex flex-col justify-between gap-4 hover:bg-slate-100 dark:hover:bg-slate-900/60 transition group">
                                <div className="flex justify-between items-start">
                                    <div className="flex items-center gap-4 flex-1">
                                        <div className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 flex items-center justify-center text-slate-500 dark:text-slate-400 font-bold border border-slate-300 dark:border-slate-600 group-hover:border-orange-500 group-hover:text-orange-500 transition">{unit.name.substring(0, 2)}</div>
                                        <div className="flex-1">
                                            {/* Renamable Name Input */}
                                            <div className="flex flex-col md:flex-row items-start md:items-center gap-2 md:gap-3">
                                                <input
                                                    type="text"
                                                    value={unit.name}
                                                    onChange={(e) => updateUnitName(unit.id, e.target.value, true)}
                                                    className="w-full bg-transparent border-b border-transparent hover:border-slate-400 dark:hover:border-slate-600 focus:border-orange-500 text-slate-900 dark:text-white font-bold text-sm outline-none transition px-0 max-w-md"
                                                />
                                                {/* Structural Unit Floor Type Selector */}
                                                <select
                                                    value={unit.floorType}
                                                    onChange={(e) => updateUnitFloorType(unit.id, e.target.value as UnitFloorType, true)}
                                                    className="text-[10px] text-slate-500 dark:text-slate-400 uppercase bg-slate-200 dark:bg-slate-800 px-2 py-1 rounded outline-none border border-transparent hover:border-slate-400 dark:hover:border-slate-600 cursor-pointer"
                                                >
                                                    <option value="normal">Normal ({buildingStats.normalFloorHeight}m)</option>
                                                    <option value="ground">Zemin ({buildingStats.groundFloorHeight}m)</option>
                                                    <option value="basement">Bodrum ({buildingStats.basementFloorHeight}m)</option>
                                                </select>
                                            </div>
                                            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-2 mt-1">
                                                {unit.structuralWallSource === 'global_calculated' ?
                                                    <span className="text-blue-500 bg-blue-100 dark:bg-blue-900/30 px-1 rounded">Duvar: Oto ({globalWallMaterial})</span> :
                                                    <span className="text-blue-600 font-bold bg-blue-100 dark:bg-blue-900/30 px-1 rounded">Duvar: Detaylı ({globalWallMaterial})</span>
                                                }
                                                <span className="text-slate-300">|</span>
                                                {unit.structuralConcreteSource === 'global_calculated' ?
                                                    <span className="text-orange-500 bg-orange-100 dark:bg-orange-900/30 px-1 rounded">Beton: Oto</span> :
                                                    <span className="text-orange-600 font-bold bg-orange-100 dark:bg-orange-900/30 px-1 rounded">Beton: Detaylı</span>
                                                }
                                            </div>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 md:gap-4">
                                        {/* Count Input for Floors */}
                                        <div className="flex items-center justify-end gap-2">
                                            <input
                                                type="number"
                                                min="1"
                                                value={unit.count}
                                                onChange={(e) => updateUnitCount(unit.id, parseInt(e.target.value), true)}
                                                className="w-10 md:w-14 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-600 rounded p-1 text-center text-slate-900 dark:text-white font-bold text-sm focus:border-orange-500 outline-none"
                                            />
                                            <span className="text-xs font-normal text-slate-500">Adet</span>
                                        </div>

                                        <button onClick={() => deleteUnit(unit.id, true)} className="text-red-500 hover:text-red-400 px-2"><i className="fas fa-trash"></i></button>
                                    </div>
                                </div>

                                <div className="flex flex-col md:flex-row items-center gap-4 border-t border-slate-200 dark:border-slate-700/50 pt-3">
                                    <div className="text-xs text-slate-500 dark:text-slate-500 flex gap-3 flex-1 w-full justify-around md:justify-start">
                                        <span><i className="fas fa-th-large mr-1 text-yellow-600"></i>{unit.walls.length} Duvar</span>
                                        <span><i className="fas fa-square mr-1 text-red-600"></i>{unit.columns.length} Kolon</span>
                                        <span><i className="fas fa-grip-lines mr-1 text-blue-600"></i>{unit.beams.length} Kiriş</span>
                                        <span><i className="fas fa-layer-group mr-1 text-purple-600"></i>{unit.slabs?.length || 0} Döşeme</span>
                                    </div>

                                    <div className="flex gap-2 transition-opacity duration-300 w-full md:w-auto">
                                        <button onClick={() => navigateToEditor(unit.id, 'structural')} className="hidden md:inline-flex bg-orange-600 hover:bg-orange-500 text-white px-4 py-2 rounded-lg text-sm font-bold border border-orange-600 transition shadow-sm flex-1 md:flex-initial items-center justify-center">
                                            <i className="fas fa-drafting-compass mr-2"></i>Plan Üzerinde Çalış
                                        </button>
                                        <button onClick={() => openModal('structuralManager', unit.id)} className="bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-white px-4 py-2 rounded-lg text-sm font-bold border border-slate-300 dark:border-slate-600 transition shadow-sm flex-1 md:flex-initial flex items-center justify-center">
                                            <i className="fas fa-list-ul mr-2"></i>Manuel Liste
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* 2. SECTION: BAĞIMSIZ BÖLÜM TİPLERİ (Apartment Units) */}
                <section id="tour-units">
                    <div className="flex justify-between items-center mb-4">
                        <div>
                            <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                    <i className={`fas ${buildingStats.buildingType === 'villa' ? 'fa-home' : 'fa-layer-group'} text-purple-500`}></i>
                                    {buildingStats.buildingType === 'villa' ? 'Villa Mimari Planlar' : 'Bağımsız Bölüm Tipleri'}
                                </h2>                            </h2>
                            <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-1">Daire planları, oda metrajları ve adetleri</p>
                        </div>
                        <button onClick={addUnit} className="bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded-lg font-bold transition flex items-center gap-2 text-sm">
                            <i className="fas fa-plus"></i><span className="hidden md:inline"> Yeni Tip Ekle</span><span className="md:hidden">Ekle</span>
                        </button>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {units.length === 0 && (
                            <div className="col-span-full text-center text-slate-500 py-8 bg-white dark:bg-slate-800/30 rounded-lg border border-slate-200 dark:border-slate-700 border-dashed">
                                Henüz daire tipi eklenmemiş.
                            </div>
                        )}

                        {units.map(unit => {
                            // Her bir unit için toplam m2 alanını hesapla
                            const totalUnitArea = unit.rooms.reduce((acc, r) => {
                                const area = r.manualAreaM2 || (unit.scale > 0 ? r.area_px / (unit.scale * unit.scale) : 0);
                                return acc + area;
                            }, 0);

                            return (
                                <div key={unit.id} className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden shadow-lg hover:shadow-2xl hover:border-slate-400 dark:hover:border-slate-600 transition group relative">
                                    <div className="h-40 bg-slate-100 dark:bg-slate-900 relative flex items-center justify-center border-b border-slate-200 dark:border-slate-700">
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
                                                </select>
                                            </div>
                                            <div className="text-right">
                                                <div className="flex items-center justify-end gap-2">
                                                    <input
                                                        type="number"
                                                        min="1"
                                                        value={unit.count}
                                                        onChange={(e) => updateUnitCount(unit.id, parseInt(e.target.value), false)}
                                                        className="w-12 md:w-16 bg-slate-100 dark:bg-slate-900 border border-slate-300 dark:border-slate-600 rounded p-1 text-center text-slate-900 dark:text-white font-bold text-lg focus:border-blue-500 outline-none"
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

                {/* 4. SECTION: PROJECT COST DETAILS */}
                <section id="tour-cost-details" className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 shadow-lg dark:shadow-xl transition-colors duration-300">
                    {(() => {
                        const costCategoryIds = projectCostDetails.filter(cat => cat.id !== 'ozel_kalemler').map(c => c.id);
                        const isAllExpanded = costCategoryIds.length > 0 && costCategoryIds.every(id => expandedCategories[id]);

                        return (
                            <div className="mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                                {/* SOL TARAF: BAŞLIK VE AÇIKLAMA */}
                                <div className="flex-1">
                                    <div className="flex flex-col md:flex-row md:items-center gap-3">
                                        <h2 className="text-lg md:text-xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                            <i className="fas fa-file-invoice-dollar text-green-500"></i> Proje Maliyet Detayları
                                        </h2>
                                    </div>
                                    <p className="text-xs md:text-sm text-slate-500 dark:text-slate-400 mt-2">
                                        Tüm bağımsız bölümler ve genel yapı maliyetlerinin toplam dökümü. Metraj ve birim fiyatları buradan düzenleyebilirsiniz.
                                    </p>
                                </div>

                                {/* SAĞ TARAF: EXCEL BUTONLARI VE TÜMÜNÜ AÇ/KAPAT */}
                                <div className="flex flex-wrap items-center justify-start md:justify-end gap-2 w-full md:w-auto mt-2 md:mt-0">

                                    {/* Excel İndir Butonu */}
                                    <button
                                        onClick={() => exportCostsToExcel(projectCostDetails)}
                                        className="bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 hover:bg-green-200 dark:hover:bg-green-800 px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-2 border border-green-200 dark:border-green-800/50 shadow-sm"
                                        title="Tüm keşfi Excel'e indir"
                                    >
                                        <i className="fas fa-file-excel"></i>
                                        <span className="hidden sm:inline">Excel İndir</span>
                                        <span className="sm:hidden">İndir</span>
                                    </button>

                                    {/* Excel Yükle Butonu */}
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
                                                        e.target.value = ''; // Aynı dosyayı peş peşe seçebilmek için
                                                    });
                                                }
                                            }}
                                        />
                                    </label>

                                    {/* Dikey Ayırıcı Çizgi (Sadece masaüstünde görünür) */}
                                    <div className="hidden md:block w-px h-6 bg-slate-200 dark:bg-slate-700 mx-1"></div>

                                    {/* Tümünü Aç / Kapat Butonu (Mevcut buton) */}
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
                            .filter(cat => cat.id !== 'ozel_kalemler')
                            .map((category) => (
                                <div
                                    key={category.id}
                                    className={`bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden transition-all duration-300 ${expandedCategories[category.id] ? 'md:col-span-2 shadow-2xl ring-1 ring-slate-200 dark:ring-slate-700' : ''}`}
                                >
                                    <button onClick={() => toggleCategory(category.id)} className="w-full bg-slate-100 dark:bg-slate-700/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center hover:bg-slate-200 dark:hover:bg-slate-700 transition">
                                        <div className="flex items-center gap-3">
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
                                                        <div key={item.name} className="flex flex-col gap-2.5 p-3.5 rounded-xl border bg-white dark:bg-slate-800/80 border-slate-200 dark:border-slate-700 shadow-sm hover:shadow-md transition-shadow">
                                                            {/* Üst Kısım: İsim ve Toplam Tutar */}
                                                            <div className="flex justify-between items-start gap-3">
                                                                <span className="text-slate-800 dark:text-slate-200 text-sm font-bold leading-tight">
                                                                    {item.name}
                                                                    {isLocked && <i className="fas fa-lock text-[10px] text-slate-400 ml-1.5 align-middle" title="Metraj sistem tarafından yönetilir"></i>}
                                                                </span>
                                                                <div className="font-extrabold text-green-600 dark:text-green-400 text-sm whitespace-nowrap bg-green-50 dark:bg-green-900/20 px-2 py-0.5 rounded-md">
                                                                    {item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                                </div>
                                                            </div>

                                                            {item.inputType === 'manual_total' ? (
                                                                <div className="mt-1 flex flex-col sm:flex-row sm:items-center justify-between bg-slate-50 dark:bg-slate-900 p-2.5 rounded-lg border border-slate-200 dark:border-slate-700 gap-2">
                                                                    <div className="text-xs text-slate-500">
                                                                        <span className="font-bold text-slate-700 dark:text-slate-300">Sabit Tutar / Paket Fiyatı</span>
                                                                        <div className="text-[10px] text-slate-400">Bu kalem için miktar girilmez, doğrudan toplam tutar giriniz.</div>
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
                                                                    {/* SOL SÜTUN: METRAJ */}
                                                                    <div className="flex-1 min-w-0 flex flex-col">
                                                                        <div className={`flex items-center border rounded-lg relative overflow-hidden ${isLocked ? 'bg-slate-100 dark:bg-slate-800 border-slate-300 dark:border-slate-600' : 'bg-slate-50 dark:bg-slate-900 border-slate-300 dark:border-slate-600'}`}>
                                                                            <NumericInput
                                                                                disabled={isLocked}
                                                                                className={`w-full bg-transparent text-sm p-2 outline-none font-mono text-right pr-9 transition ${isLocked ? 'text-slate-500 cursor-not-allowed font-bold' : 'text-slate-900 dark:text-white focus:bg-white dark:focus:bg-slate-950'}`}
                                                                                value={isLocked
                                                                                    ? Number(Number(item.calculatedAutoQty).toFixed(2))
                                                                                    : (item.manualQuantity !== undefined ? Number(Number(item.manualQuantity).toFixed(2)) : Number(Number(item.calculatedAutoQty).toFixed(2)))
                                                                                }
                                                                                onChange={(val) => !isLocked && updateCostItem(category.id, item.name, 'manualQuantity', val)}
                                                                                placeholder="Miktar"
                                                                            />
                                                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-slate-500 font-bold bg-slate-50/90 dark:bg-slate-900/90 pl-1">{item.unit}</span>
                                                                        </div>

                                                                        {/* Etiketler (Flex-wrap eklendi, taşma önlendi) */}
                                                                        <div className="flex flex-wrap items-center justify-between gap-x-1 gap-y-1 mt-1.5 px-1">
                                                                            <span className="text-[9px] text-slate-500 font-bold uppercase tracking-wider">Metraj</span>
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

                                                                    {/* ÇARPI İŞARETİ (Mobilde ortalanmış) */}
                                                                    <div className="flex items-center justify-center pt-2">
                                                                        <span className="text-slate-300 dark:text-slate-600 text-sm font-bold">x</span>
                                                                    </div>

                                                                    {/* SAĞ SÜTUN: BİRİM FİYAT */}
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

                                                                        {/* Etiketler */}
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

                        {/* --- MANUEL EK İŞLER / ÖZEL İLAVELER BÖLÜMÜ --- */}
                        <div className="md:col-span-2 mt-2 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-slate-700/50 rounded-lg overflow-hidden transition-all duration-300 shadow-sm">
                            <div className="bg-slate-100 dark:bg-slate-800/50 px-4 py-3 border-b border-slate-200 dark:border-slate-700/50 flex justify-between items-center">
                                <div className="flex items-center gap-3">
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

                {/* 1.5 SECTION: COST VISUALIZATION & MATERIAL SUMMARY */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* CHART */}
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
                    <section className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-xl p-4 md:p-6 shadow-lg flex flex-col">
                        <div className="flex justify-between items-center mb-4">
                            <h2 className="text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                                <i className="fas fa-truck-loading text-emerald-500"></i> Tedarik Planlama (Sarf)
                            </h2>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] text-slate-500 bg-slate-100 dark:bg-slate-700 px-2 py-1 rounded">
                                    İşe Bağlı Termin
                                </span>
                                <span className="text-xs font-bold text-emerald-600 bg-emerald-50 dark:bg-emerald-900/20 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800">
                                    {totalRawMaterialCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </span>
                            </div>
                        </div>
                        <div className="flex justify-between items-center mb-3 border-b border-slate-200 dark:border-slate-700 pb-2">
                            <p className="text-xs text-slate-500">
                                Şantiyeye indirilmesi gereken sarf malzemeleri. Detaylı zamanlama için butona tıklayın.
                            </p>
                            <button
                                onClick={() => setShowProcurementModal(true)}
                                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-white px-3 py-1.5 rounded transition shadow-sm font-bold flex items-center gap-1 shrink-0 ml-2"
                            >
                                <i className="fas fa-search"></i> Detayları İncele
                            </button>
                        </div>

                        <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2 max-h-64">
                            {rawMaterials.length === 0 && (
                                <div className="text-center text-slate-500 text-xs py-8">İş programı ve metrajlar hesaplanıyor...</div>
                            )}
                            {rawMaterials.map((item, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedMaterial(item)}
                                    className="w-full flex justify-between items-center bg-slate-50 dark:bg-slate-900/50 p-2 rounded border border-slate-100 dark:border-slate-700/50 hover:border-emerald-400 dark:hover:border-emerald-500 hover:bg-emerald-50 dark:hover:bg-emerald-900/10 transition group text-left"
                                >
                                    <div className="flex flex-col">
                                        <span className="text-sm font-bold text-slate-800 dark:text-white group-hover:text-emerald-700 dark:group-hover:text-emerald-300 transition-colors">{item.name}</span>
                                        <span className="text-[10px] text-slate-500 dark:text-slate-400">
                                            {item.details.length} farklı iş kaleminde kullanılacak
                                        </span>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                        <div className="font-bold text-slate-900 dark:text-white text-base">
                                            {item.totalQuantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })}
                                            <span className="text-xs text-emerald-600 dark:text-emerald-400 ml-1">{item.unit}</span>
                                        </div>
                                        <div className="text-[10px] font-bold text-slate-400 group-hover:text-emerald-600 transition-colors">
                                            Tahmini: {item.estimatedCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                    </section>
                </div>

                {/* TEDARİK ZAMANLAMA MODALI */}
                {selectedMaterial && (
                    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-lg overflow-hidden flex flex-col">
                            <div className="bg-emerald-50 dark:bg-emerald-900/20 p-4 border-b border-emerald-100 dark:border-emerald-900/30 flex justify-between items-center">
                                <div className="flex items-center gap-3">
                                    <div className="bg-emerald-100 dark:bg-emerald-800 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                                        <i className="fas fa-box-open text-emerald-600 dark:text-emerald-200 text-lg"></i>
                                    </div>
                                    <div>
                                        <h3 className="font-bold text-slate-900 dark:text-white">{selectedMaterial.name}</h3>
                                        <p className="text-xs text-emerald-600 dark:text-emerald-300 font-bold">
                                            Toplam: {selectedMaterial.totalQuantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} {selectedMaterial.unit}
                                        </p>
                                    </div>
                                </div>
                                <button onClick={() => setSelectedMaterial(null)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
                                    <i className="fas fa-times text-xl"></i>
                                </button>
                            </div>

                            <div className="p-0 flex-1 overflow-y-auto max-h-[60vh] bg-slate-50 dark:bg-slate-900">
                                <div className="p-4 border-b border-slate-200 dark:border-slate-800 text-xs text-slate-500">
                                    Bu malzeme İş Zaman Programı'na göre aşağıdaki tarihlerde şantiyede hazır bulunmalıdır:
                                </div>
                                <div className="relative p-4 border-l-2 border-emerald-300 dark:border-emerald-700 ml-6 my-4 space-y-6">
                                    {selectedMaterial.details.map((detail, i) => (
                                        <div key={i} className="relative pl-6">
                                            <div className="absolute w-4 h-4 bg-emerald-500 rounded-full -left-[25px] top-1 border-4 border-white dark:border-slate-900 shadow"></div>

                                            <div className="bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg p-3 shadow-sm">
                                                <div className="flex justify-between items-start mb-2">
                                                    <h4 className="font-bold text-slate-800 dark:text-white text-sm">{detail.taskName}</h4>
                                                    <span className="bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 px-2 py-1 rounded text-[10px] font-bold">
                                                        {detail.quantity.toLocaleString('tr-TR', { maximumFractionDigits: 1 })} {selectedMaterial.unit}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-4 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-50 dark:bg-slate-900/50 p-2 rounded">
                                                    <div className="flex items-center gap-1 text-green-600 dark:text-green-400">
                                                        <i className="far fa-calendar-alt"></i>
                                                        <span>Başlangıç: {detail.startDate.toLocaleDateString('tr-TR')}</span>
                                                    </div>
                                                    <span className="text-slate-300">|</span>
                                                    <div className="flex items-center gap-1 text-red-500 dark:text-red-400">
                                                        <i className="far fa-flag"></i>
                                                        <span>Bitiş: {detail.endDate.toLocaleDateString('tr-TR')}</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                            <div className="p-4 bg-slate-100 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-right">
                                <button onClick={() => setSelectedMaterial(null)} className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition">
                                    Kapat
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </main>

            {/* ALAN HATASI DETAY MODALI */}
            {showAreaErrorModal && areaValidation && (
                <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
                    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-md overflow-hidden relative">

                        {/* Modal Header */}
                        <div className="bg-red-50 dark:bg-red-900/20 p-4 border-b border-red-100 dark:border-red-900/30 flex justify-between items-start">
                            <div className="flex items-center gap-3">
                                <div className="bg-red-100 dark:bg-red-800 w-10 h-10 rounded-full flex items-center justify-center shrink-0">
                                    <i className="fas fa-exclamation-triangle text-red-600 dark:text-red-200 text-lg"></i>
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-900 dark:text-white">Alan Tutarsızlığı Tespit Edildi</h3>
                                    <p className="text-xs text-red-600 dark:text-red-300 font-bold">
                                        Sapma Oranı: {areaValidation.ratio === 0 ? '%100.0 (Eksik Kat Planı)' : `%${Math.abs((areaValidation.ratio - 1) * 100).toFixed(1)}`}
                                    </p>
                                </div>
                            </div>
                            <button onClick={() => setShowAreaErrorModal(false)} className="text-slate-400 hover:text-slate-600 dark:hover:text-white transition">
                                <i className="fas fa-times text-xl"></i>
                            </button>
                        </div>

                        {/* Modal Body */}
                        <div className="p-6 space-y-4">
                            <p className="text-sm text-slate-600 dark:text-slate-300 leading-relaxed">
                                {areaValidation.message}
                            </p>

                            <div className="bg-slate-50 dark:bg-slate-950 rounded-lg p-4 border border-slate-200 dark:border-slate-800 grid grid-cols-2 gap-4">
                                <div>
                                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Hesaplanan Alan</span>
                                    <span className="text-lg font-mono font-bold text-blue-600 dark:text-blue-400">
                                        {areaValidation.calculatedArea.toFixed(1)} m²
                                    </span>
                                </div>
                                <div className="text-right">
                                    <span className="block text-[10px] uppercase text-slate-400 font-bold mb-1">Tanımlanan Alan</span>
                                    <span className="text-lg font-mono font-bold text-slate-700 dark:text-slate-200">
                                        {areaValidation.declaredArea} m²
                                    </span>
                                </div>
                            </div>

                            <div className="text-xs text-slate-500 dark:text-slate-400 italic bg-yellow-50 dark:bg-yellow-900/10 p-3 rounded border border-yellow-100 dark:border-yellow-900/30">
                                <i className="fas fa-lightbulb text-yellow-500 mr-2"></i>
                                <strong>Öneri:</strong> {
                                    areaValidation.ratio === 0
                                        ? '"Bağımsız Bölüm Tipleri" paneline giderek yeni bir tip ekleyin ve "Kat Bilgisi" ayarından eksik olan katı seçin.'
                                        : areaValidation.ratio > 1
                                            ? '"Yapı Genel Bilgileri"nden kat alanını büyütün veya çizimdeki oda metrajlarını küçültün.'
                                            : '"Yapı Genel Bilgileri"nden kat alanını küçültün veya eksik odaları/duvarları çizin.'
                                }
                            </div>
                        </div>

                        {/* Modal Footer */}
                        <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border-t border-slate-200 dark:border-slate-700 text-right">
                            <button
                                onClick={() => setShowAreaErrorModal(false)}
                                className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 py-2 rounded-lg font-bold text-sm hover:opacity-90 transition"
                            >
                                Anlaşıldı
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <ProcurementModal
                isOpen={showProcurementModal}
                onClose={() => setShowProcurementModal(false)}
                procurementGroups={procurementData.timelineGroups}
                recurringGroup={procurementData.recurringGroup}
            />
            <TutorialOverlay />
        </div>
    );
};