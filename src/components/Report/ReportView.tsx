// src/components/Report/ReportView.tsx
import React, { useRef, useMemo, useState } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { BRAND_CATEGORIES } from "../../brand_data";
import { generateProcurementPlan } from '../../utils/materialCalculator'; // EKLENDİ

// --- TARİH YARDIMCI FONKSİYONLARI ---
const addMonths = (date: Date, months: number) => {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
}
const formatMonth = (date: Date) => date.toISOString().slice(0, 7);
const formatMonthDisplay = (dateStr: string) => {
    if (!dateStr) return '';
    const [year, month] = dateStr.split('-');
    const months = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"];
    return `${months[parseInt(month) - 1]} ${year}`;
}
const calculateSCurve = (x: number) => {
    if (x <= 0) return 0;
    if (x >= 1) return 1;
    return x * x * (3 - 2 * x);
}

export const ReportView: React.FC = () => {
    const {
        projectTotalCost, totalConstructionArea, constructionDuration,
        projectCostDetails, reportSettings, updateReportSettings, buildingStats,
        projectSchedule, financialSettings, units, duplexPairs, globalStats, costs
    } = useProjectStore();

    const { navigateToDashboard } = useUIStore();
    const fileInputRefLogo = useRef<HTMLInputElement>(null);
    const fileInputRefRender = useRef<HTMLInputElement>(null);
    const [showSettingsMenu, setShowSettingsMenu] = useState(false);

    const { finalTotalCost, finalCostDetails } = useMemo(() => {
        const marginMultiplier = 1 + (reportSettings.profitMargin / 100);
        const newTotal = projectTotalCost * marginMultiplier;
        const newDetails = projectCostDetails.map(cat => ({
            ...cat,
            totalCategoryCost: cat.totalCategoryCost * marginMultiplier,
            items: cat.items.map(item => ({
                ...item,
                unit_price: item.unit_price * marginMultiplier,
                manualPrice: item.manualPrice !== undefined ? item.manualPrice * marginMultiplier : undefined,
                totalPrice: item.totalPrice * marginMultiplier
            }))
        }));
        return { finalTotalCost: newTotal, finalCostDetails: newDetails };
    }, [projectTotalCost, projectCostDetails, reportSettings.profitMargin]);

    // --- YENİ TEDARİK TABLOSU HESAPLAMASI ---
    const procurementList = useMemo(() => {
        const currentQuantities: Record<string, number> = {};
        projectCostDetails.forEach(cat => {
            cat.items.forEach(item => { currentQuantities[item.name] = item.finalQty; });
        });
        return generateProcurementPlan(globalStats || {}, currentQuantities, projectSchedule || [], costs, projectCostDetails);
    }, [globalStats, projectSchedule, costs, projectCostDetails]);

    const groupedProcurement = useMemo(() => {
        const groups: Record<string, { date: Date, taskName: string, items: any[], totalCost: number }> = {};
        procurementList.forEach(item => {
            const dateStr = item.deliveryDate.toISOString().split('T')[0];
            const key = `${dateStr}_${item.taskId}`;
            if (!groups[key]) groups[key] = { date: item.deliveryDate, taskName: item.taskName, items: [], totalCost: 0 };
            groups[key].items.push(item);
            groups[key].totalCost += item.totalPrice;
        });
        return Object.values(groups).sort((a, b) => a.date.getTime() - b.date.getTime());
    }, [procurementList]);


    const cashflowTable = useMemo(() => {
        if (!projectTotalCost || projectSchedule.length === 0) return [];
        const inflationRate = (financialSettings.monthlyInflationRate || 0) / 100;
        const expensesByMonth: Record<string, number> = {};
        const projectStartMonthDate = new Date((buildingStats.projectStartDate || formatMonth(new Date())) + '-01');
        const totalCostPerTask = projectTotalCost / projectSchedule.length; 

        projectSchedule.forEach(task => {
            const startDate = new Date(task.startDate);
            const endDate = new Date(task.endDate);
            const totalDays = (endDate.getTime() - startDate.getTime()) / (1000 * 3600 * 24) || 1;
            let currentD = new Date(startDate);
            let accumulatedDays = 0;

            while (currentD <= endDate) {
                let eom = new Date(currentD.getFullYear(), currentD.getMonth() + 1, 0);
                if (eom > endDate) eom = endDate;
                let daysInThisMonth = (eom.getTime() - currentD.getTime()) / (1000 * 3600 * 24);
                if (daysInThisMonth === 0) daysInThisMonth = 1;

                const startRatio = accumulatedDays / totalDays;
                accumulatedDays += daysInThisMonth;
                const endRatio = accumulatedDays / totalDays;
                let costRatio = calculateSCurve(endRatio) - calculateSCurve(startRatio);
                let monthStr = formatMonth(currentD);

                let monthsDiff = (currentD.getFullYear() - projectStartMonthDate.getFullYear()) * 12 + (currentD.getMonth() - projectStartMonthDate.getMonth());
                monthsDiff = Math.max(0, monthsDiff);
                let inflatedCost = totalCostPerTask * Math.pow(1 + inflationRate, monthsDiff);

                expensesByMonth[monthStr] = (expensesByMonth[monthStr] || 0) + (inflatedCost * costRatio);
                currentD = new Date(currentD.getFullYear(), currentD.getMonth() + 1, 1);
            }
        });

        const salesByMonth: Record<string, number> = {};
        financialSettings.sales.forEach(sale => {
            if (sale.saleDate) salesByMonth[sale.saleDate] = (salesByMonth[sale.saleDate] || 0) + sale.amount;
        });

        const allMonthsSet = new Set([...Object.keys(expensesByMonth), ...Object.keys(salesByMonth)]);
        const sortedMonths = Array.from(allMonthsSet).sort();

        let table = [];
        let cumulativeBalance = 0;

        sortedMonths.forEach(mStr => {
            const exp = expensesByMonth[mStr] || 0;
            const sal = salesByMonth[mStr] || 0;
            cumulativeBalance += (sal - exp);
            table.push({
                month: formatMonthDisplay(mStr),
                expense: exp,
                income: sal,
                balance: cumulativeBalance
            });
        });
        return table;
    }, [projectSchedule, projectTotalCost, financialSettings, buildingStats.projectStartDate]);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>, type: 'logo' | 'render') => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            if (type === 'logo') updateReportSettings({ firmLogo: evt.target.result as string });
            else updateReportSettings({ projectRender: evt.target.result as string });
        };
        reader.readAsDataURL(file);
    };

    const CostDonutChart = () => {
        const colors = ['#1e3a8a', '#d97706', '#059669', '#7c3aed', '#db2777', '#dc2626'];
        let cumulativePercent = 0;
        const sortedCosts = [...finalCostDetails].filter(c => c.totalCategoryCost > 0).sort((a, b) => b.totalCategoryCost - a.totalCategoryCost);

        return (
            <div className="flex flex-row items-center justify-between gap-8 p-6 bg-slate-50 border border-slate-200 rounded-lg break-inside-avoid">
                <div className="relative w-48 h-48 shrink-0">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full drop-shadow-md">
                        {sortedCosts.map((cat, i) => {
                            const percent = (cat.totalCategoryCost / finalTotalCost) * 100;
                            const strokeDasharray = `${percent} ${100 - percent}`;
                            const strokeDashoffset = -cumulativePercent;
                            cumulativePercent += percent;
                            return (
                                <circle key={cat.id} cx="50" cy="50" r="40" fill="transparent" stroke={colors[i % colors.length]} strokeWidth="16" strokeDasharray={strokeDasharray} strokeDashoffset={strokeDashoffset} pathLength="100" />
                            );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">TOPLAM</span>
                        <span className="text-lg font-bold text-slate-900 font-mono">{(finalTotalCost / 1000000).toFixed(1)}M</span>
                    </div>
                </div>
                <div className="flex-1 grid grid-cols-1 gap-2">
                    {sortedCosts.map((cat, i) => (
                        <div key={cat.id} className="flex justify-between items-center text-xs border-b border-slate-200 pb-1 last:border-0">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: colors[i % colors.length] }}></span>
                                <span className="text-slate-700 font-bold uppercase tracking-tight truncate max-w-[180px]">{cat.title.replace(/^\d+\.\s*/, '')}</span>
                            </div>
                            <div className="text-right">
                                <span className="block font-bold text-slate-900">{cat.totalCategoryCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                <span className="text-[10px] text-slate-500 font-mono">%{(cat.totalCategoryCost / finalTotalCost * 100).toFixed(1)}</span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-slate-800 print:bg-white relative">
            <div className="print:hidden bg-slate-900 text-white p-4 sticky top-0 z-50 flex flex-col md:flex-row justify-between items-center shadow-lg border-b border-slate-700 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={navigateToDashboard} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition">
                        <i className="fas fa-arrow-left"></i> Geri
                    </button>
                    <div>
                        <h1 className="font-bold text-lg text-white">Rapor Merkezi</h1>
                        <p className="text-xs text-slate-400">Teklif ve Yönetim Dosyası</p>
                    </div>
                </div>

                <div className="flex items-center bg-slate-800 p-2 rounded-lg border border-slate-700">
                    <div className="flex flex-col mr-3 text-right hidden sm:flex">
                        <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Kâr & Genel Gider</span>
                        <span className="text-[9px] text-slate-400">Tüm kalemlere eklenir</span>
                    </div>
                    <div className="relative flex items-center">
                        <input type="number" min="0" value={reportSettings.profitMargin} onChange={(e) => updateReportSettings({ profitMargin: parseFloat(e.target.value) || 0 })} className="bg-slate-900 text-white text-lg font-bold w-16 p-1 text-center rounded border border-slate-600 focus:border-yellow-500 outline-none" />
                        <span className="ml-2 font-bold text-slate-400">%</span>
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto justify-end relative">
                    <button onClick={() => fileInputRefLogo.current?.click()} className="hidden sm:block bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded text-xs font-bold transition"><i className="fas fa-image mr-2"></i>Logo</button>
                    <button onClick={() => fileInputRefRender.current?.click()} className="hidden sm:block bg-slate-800 hover:bg-slate-700 border border-slate-600 px-3 py-2 rounded text-xs font-bold transition"><i className="fas fa-camera mr-2"></i>Kapak</button>

                    <button
                        onClick={() => setShowSettingsMenu(!showSettingsMenu)}
                        className={`px-4 py-2 rounded text-sm font-bold transition flex items-center gap-2 ${showSettingsMenu ? 'bg-blue-600 text-white' : 'bg-slate-800 hover:bg-slate-700 border border-slate-600'}`}
                    >
                        <i className="fas fa-cog"></i> Rapor İçeriği
                    </button>

                    <button onClick={() => window.print()} className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded text-sm font-bold shadow-lg flex items-center gap-2 transition transform">
                        <i className="fas fa-print"></i> Yazdır / PDF
                    </button>

                    {showSettingsMenu && (
                        <div className="absolute top-12 right-32 w-72 bg-white text-slate-800 rounded-xl shadow-2xl border border-slate-200 z-[100] overflow-hidden animate-fadeIn text-sm">
                            <div className="bg-slate-100 p-3 border-b border-slate-200">
                                <h4 className="font-bold text-xs uppercase text-slate-500">Rapor Sayfalarını Seçin</h4>
                            </div>
                            <div className="p-2 space-y-1 max-h-[60vh] overflow-y-auto">
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition">
                                    <input type="checkbox" checked={true} disabled className="accent-blue-600 w-4 h-4" />
                                    <span className="font-medium text-slate-500">Kapak ve Özet (Zorunlu)</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition">
                                    <input type="checkbox" checked={true} disabled className="accent-blue-600 w-4 h-4" />
                                    <span className="font-medium text-slate-500">Maliyet Detayları (Zorunlu)</span>
                                </label>
                                <hr className="my-1 border-slate-100" />
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition">
                                    <input type="checkbox" checked={reportSettings.showUnitDetails} onChange={(e) => updateReportSettings({ showUnitDetails: e.target.checked })} className="accent-blue-600 w-4 h-4" />
                                    <span className="font-bold text-slate-700">Daire (Mahal) İnce Metrajları</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition">
                                    <input type="checkbox" checked={reportSettings.includeSchedule} onChange={(e) => updateReportSettings({ includeSchedule: e.target.checked })} className="accent-blue-600 w-4 h-4" />
                                    <span className="font-bold text-slate-700">İş Zaman Programı</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition">
                                    <input type="checkbox" checked={reportSettings.includeProcurement} onChange={(e) => updateReportSettings({ includeProcurement: e.target.checked })} className="accent-blue-600 w-4 h-4" />
                                    <span className="font-bold text-slate-700">Malzeme Tedarik Planı</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition">
                                    <input type="checkbox" checked={reportSettings.includeCashflow} onChange={(e) => updateReportSettings({ includeCashflow: e.target.checked })} className="accent-blue-600 w-4 h-4" />
                                    <span className="font-bold text-slate-700">Aylık Nakit Akışı Tablosu</span>
                                </label>
                                <label className="flex items-center gap-3 p-2 hover:bg-slate-50 rounded cursor-pointer transition">
                                    <input type="checkbox" checked={reportSettings.includeRiskAnalysis} onChange={(e) => updateReportSettings({ includeRiskAnalysis: e.target.checked })} className="accent-blue-600 w-4 h-4" />
                                    <span className="font-bold text-slate-700">Risk & Enflasyon Analizi</span>
                                </label>
                            </div>
                        </div>
                    )}
                </div>

                <input type="file" ref={fileInputRefLogo} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} />
                <input type="file" ref={fileInputRefRender} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'render')} />
            </div>

            <div className="w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none print:w-full print:m-0 pb-10">

                <div className="relative w-full h-[297mm] flex flex-col overflow-hidden bg-slate-900 text-white print:break-after-page page-break">
                    <div className="absolute inset-0 z-0">
                        {reportSettings.projectRender ? (
                            <img src={reportSettings.projectRender} className="w-full h-full object-cover opacity-40" alt="Cover" />
                        ) : (
                            <div className="w-full h-full bg-gradient-to-br from-slate-900 via-[#0f172a] to-[#1e3a8a] opacity-80"></div>
                        )}
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-900/60 to-transparent"></div>
                    </div>

                    <div className="relative z-10 flex-1 flex flex-col justify-between p-16">
                        <div className="flex justify-between items-start">
                            {reportSettings.firmLogo ? (
                                <img src={reportSettings.firmLogo} className="h-20 object-contain bg-white/95 p-2 rounded shadow-lg" alt="Logo" />
                            ) : (
                                <div className="h-20 w-20 border-2 border-white/30 flex items-center justify-center rounded">
                                    <span className="text-xs text-white/50">Logo</span>
                                </div>
                            )}
                            <div className="text-right">
                                <input type="text" value={reportSettings.firmName} onChange={(e) => updateReportSettings({ firmName: e.target.value })} className="bg-transparent text-right text-xl font-bold text-white outline-none placeholder-white/30 uppercase tracking-widest" placeholder="FİRMA ADI" />
                                <div className="text-sm text-white/60 mt-1">{new Date().toLocaleDateString()}</div>
                            </div>
                        </div>

                        <div className="mb-20">
                            <div className="w-24 h-1 bg-yellow-500 mb-6"></div>
                            <h1 className="text-6xl font-extrabold leading-tight text-white mb-4 drop-shadow-2xl font-serif">
                                YAPI İNŞAAT<br />PROJE DOSYASI
                            </h1>
                            <input type="text" value={reportSettings.clientName} onChange={(e) => updateReportSettings({ clientName: e.target.value })} className="bg-transparent text-3xl font-light text-white/90 outline-none w-full placeholder-white/40" placeholder="Proje Adı Giriniz" />
                        </div>

                        <div className="grid grid-cols-3 gap-8 border-t border-white/20 pt-8">
                            <div><span className="block text-xs uppercase tracking-widest text-yellow-500 mb-1">Toplam Alan</span><span className="text-2xl font-bold font-mono">{totalConstructionArea.toLocaleString()} m²</span></div>
                            <div><span className="block text-xs uppercase tracking-widest text-yellow-500 mb-1">Toplam Bütçe</span><span className="text-2xl font-bold font-mono">{finalTotalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span></div>
                            <div><span className="block text-xs uppercase tracking-widest text-yellow-500 mb-1">Konum</span><span className="text-xl font-medium">{buildingStats.province}, {buildingStats.district}</span></div>
                        </div>
                    </div>
                </div>

                <div className="w-full min-h-[297mm] p-12 bg-white relative print:break-after-page page-break">
                    <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                        <div><h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Proje Özeti</h2><p className="text-slate-500 text-sm mt-1">Genel teknik veriler ve bütçe dağılımı</p></div>
                        <div className="text-right"><span className="text-4xl font-bold text-slate-900 font-mono tracking-tighter">01</span></div>
                    </div>
                    <div className="mb-8">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Proje Notları</label>
                        <textarea value={reportSettings.projectDescription} onChange={(e) => updateReportSettings({ projectDescription: e.target.value })} className="w-full text-base text-slate-700 bg-slate-50 p-4 rounded border-l-4 border-yellow-500 outline-none focus:bg-white transition resize-none italic" rows={3} />
                    </div>
                    <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="p-6 bg-slate-900 text-white rounded-lg shadow-lg"><div className="text-yellow-500 mb-2"><i className="fas fa-coins text-2xl"></i></div><div className="text-xs uppercase font-bold tracking-widest opacity-70">Teklif Tutarı</div><div className="text-3xl font-bold mt-1 tracking-tight">{finalTotalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div></div>
                        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm"><div className="text-blue-600 mb-2"><i className="fas fa-ruler-combined text-2xl"></i></div><div className="text-xs uppercase font-bold text-slate-400 tracking-widest">Birim Fiyat (m²)</div><div className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{(finalTotalCost / totalConstructionArea).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</div></div>
                        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm"><div className="text-green-600 mb-2"><i className="fas fa-clock text-2xl"></i></div><div className="text-xs uppercase font-bold text-slate-400 tracking-widest">Süre</div><div className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">{constructionDuration} Ay</div></div>
                    </div>
                    <div className="mb-4"><h3 className="text-sm font-bold text-slate-900 uppercase mb-4 border-b border-slate-200 pb-2">Bütçe Dağılımı</h3><CostDonutChart /></div>
                </div>

                {reportSettings.selectedBrands && Object.keys(reportSettings.selectedBrands).length > 0 && (
                    <div className="w-full min-h-[150mm] p-12 bg-slate-50 relative print:break-after-page page-break border-t border-slate-200">
                        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                            <div><h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Malzeme Markaları</h2><p className="text-slate-500 text-sm mt-1">Kullanılması taahhüt edilen/önerilen markalar</p></div>
                        </div>
                        <div className="grid grid-cols-3 gap-6 mb-8 break-inside-avoid">
                            {BRAND_CATEGORIES.flatMap(category => {
                                const selectedBrandIds = reportSettings.selectedBrands![category.categoryId];
                                if (!selectedBrandIds || selectedBrandIds.length === 0) return [];
                                return category.brands.filter(b => selectedBrandIds.includes(b.id)).map(brandInfo => (
                                    <div key={`${category.categoryId}-${brandInfo.id}`} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
                                        <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3 w-full border-b border-slate-100 pb-2">{category.title}</h4>
                                        <div className="h-16 w-full flex items-center justify-center mb-2 p-1">
                                            {brandInfo.image ? <img src={brandInfo.image} alt={brandInfo.name} className="max-w-full max-h-full object-contain mix-blend-multiply filter grayscale hover:grayscale-0" /> : <div className="text-slate-300 italic text-xs">Görsel Yok</div>}
                                        </div>
                                        <span className="font-bold text-slate-800 text-sm">{brandInfo.name}</span>
                                    </div>
                                ));
                            })}
                        </div>
                    </div>
                )}

                <div className="w-full min-h-[297mm] p-12 bg-white print:break-after-page page-break">
                    <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                        <div><h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">İmalat Detayı</h2><p className="text-slate-500 text-sm mt-1">İş kalemleri bazında genel döküm</p></div>
                    </div>
                    <table className="w-full text-sm border-collapse">
                        <thead className="bg-slate-900 text-white">
                            <tr><th className="py-2 px-3 text-left text-xs">İmalat Kalemi</th><th className="py-2 px-3 text-right text-xs">Miktar</th><th className="py-2 px-3 text-center text-xs">Birim</th><th className="py-2 px-3 text-right text-xs">Birim Fiyat</th><th className="py-2 px-3 text-right text-xs">Toplam</th></tr>
                        </thead>
                        <tbody className="text-slate-700">
                            {finalCostDetails.map(cat => (
                                <React.Fragment key={cat.id}>
                                    <tr className="bg-slate-100 border-b border-slate-200"><td colSpan={5} className="py-2 px-3 font-bold text-slate-900 text-xs uppercase">{cat.title}</td></tr>
                                    {cat.items.filter(i => i.totalPrice > 0).map((item, idx) => (
                                        <tr key={idx} className="border-b border-slate-100 break-inside-avoid">
                                            <td className="py-1.5 px-3 pl-6 text-xs">{item.name}</td>
                                            <td className="py-1.5 px-3 text-right font-mono text-xs">{item.inputType === 'manual_total' ? '-' : item.finalQty.toLocaleString('tr-TR')}</td>
                                            <td className="py-1.5 px-3 text-center font-mono text-xs">{item.unit}</td>
                                            <td className="py-1.5 px-3 text-right font-mono text-xs">{item.inputType === 'manual_total' ? '-' : `${item.unit_price.toLocaleString('tr-TR', { maximumFractionDigits: 2 })} ₺`}</td>
                                            <td className="py-1.5 px-3 text-right font-bold font-mono text-xs">{item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td>
                                        </tr>
                                    ))}
                                </React.Fragment>
                            ))}
                        </tbody>
                        <tfoot className="bg-slate-900 text-white break-inside-avoid">
                            <tr><td colSpan={4} className="py-4 px-4 text-right font-bold uppercase text-sm">Genel Toplam</td><td className="py-4 px-4 text-right font-bold text-lg text-yellow-400 font-mono">{finalTotalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td></tr>
                        </tfoot>
                    </table>
                </div>

                {reportSettings.showUnitDetails && (
                    <div className="w-full min-h-[297mm] p-12 bg-white print:break-after-page page-break">
                        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                            <div><h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Bağımsız Bölüm Metrajları</h2><p className="text-slate-500 text-sm mt-1">Daire ve yapı tiplerinin oda/mahal bazlı detayları</p></div>
                        </div>

                        {(() => {
                            const displayUnits: any[] = [];
                            const availableUnitCounts: Record<string, number> = {};
                            units.forEach(u => availableUnitCounts[u.id] = u.count);

                            duplexPairs.forEach(pair => {
                                const lowerUnit = units.find(u => u.id === pair.lowerUnitId);
                                const upperUnit = units.find(u => u.id === pair.upperUnitId);

                                if (lowerUnit && upperUnit) {
                                    const c = Math.min(pair.count, availableUnitCounts[lowerUnit.id] || 0, availableUnitCounts[upperUnit.id] || 0);
                                    if (c > 0) {
                                        availableUnitCounts[lowerUnit.id] -= c;
                                        availableUnitCounts[upperUnit.id] -= c;
                                        const combinedRooms = [
                                            ...lowerUnit.rooms.map(r => ({ ...r, name: `${r.name} (Giriş)` })),
                                            ...upperUnit.rooms.map(r => ({ ...r, name: `${r.name} (Üst Kat)` }))
                                        ];
                                        displayUnits.push({
                                            id: `duplex-${pair.id}`,
                                            name: `Dubleks (${lowerUnit.name} + ${upperUnit.name})`,
                                            count: c,
                                            scale: lowerUnit.scale,
                                            rooms: combinedRooms
                                        });
                                    }
                                }
                            });

                            units.forEach(u => {
                                if (availableUnitCounts[u.id] > 0) {
                                    displayUnits.push({ ...u, count: availableUnitCounts[u.id] });
                                }
                            });

                            if (displayUnits.length === 0) return <p className="text-slate-500 italic">Tanımlı daire tipi bulunamadı.</p>;

                            return displayUnits.map(u => (
                                <div key={u.id} className="mb-8 border border-slate-200 rounded-lg overflow-hidden break-inside-avoid">
                                    <div className="bg-slate-800 text-white p-3 flex justify-between items-center">
                                        <h3 className="font-bold">{u.name} <span className="text-xs font-normal opacity-80">({u.count} Adet)</span></h3>
                                    </div>
                                    <table className="w-full text-xs text-left">
                                        <thead className="bg-slate-100 text-slate-600 border-b border-slate-200">
                                            <tr><th className="p-2">Mahal Adı</th><th className="p-2 text-right">Alan (m²)</th><th className="p-2">Zemin</th><th className="p-2">Duvar</th><th className="p-2 text-center">Kapı/Pencere</th></tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-100">
                                            {u.rooms.map((r: any, index: number) => (
                                                <tr key={`${r.id}-${index}`}>
                                                    <td className="p-2 font-medium">{r.name}</td>
                                                    <td className="p-2 text-right font-mono">{r.manualAreaM2?.toFixed(2) || '0.00'}</td>
                                                    <td className="p-2 uppercase text-[10px]">{r.properties.floorType}</td>
                                                    <td className="p-2 uppercase text-[10px]">{r.properties.wallFinish}</td>
                                                    <td className="p-2 text-center text-[10px]">{r.properties.doorCount} Kapı / {r.properties.windowArea}m² Pen.</td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ));
                        })()}
                    </div>
                )}

                {reportSettings.includeSchedule && (
                    <div className="w-full min-h-[297mm] p-12 bg-white print:break-after-page page-break">
                        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                            <div><h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">İş Zaman Programı</h2><p className="text-slate-500 text-sm mt-1">İş kalemlerinin planlanan başlangıç ve bitiş tarihleri</p></div>
                        </div>
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-800 text-white">
                                <tr><th className="p-3">Görev Adı</th><th className="p-3 text-center">Başlangıç</th><th className="p-3 text-center">Bitiş</th><th className="p-3 text-center">Süre (Hafta)</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {projectSchedule.map(task => (
                                    <tr key={task.id} className={task.isCritical ? 'bg-red-50' : ''}>
                                        <td className="p-3 font-bold text-slate-800">{task.name} {task.isCritical && <span className="text-[9px] text-red-500 ml-1 uppercase">(Kritik Yol)</span>}</td>
                                        <td className="p-3 text-center font-mono">{task.startDate.toLocaleDateString('tr-TR')}</td>
                                        <td className="p-3 text-center font-mono">{task.endDate.toLocaleDateString('tr-TR')}</td>
                                        <td className="p-3 text-center font-bold">{task.durationWeeks}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {/* --- Rapor Görünümü Tedarik Kısmı --- */}
                {reportSettings.includeProcurement && (
                    <div className="w-full min-h-[297mm] p-12 bg-white print:break-after-page page-break">
                        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                            <div><h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Malzeme Tedarik Planı</h2><p className="text-slate-500 text-sm mt-1">İş programına göre sahaya sevk edilecek malzeme listesi</p></div>
                        </div>
                        {groupedProcurement.map((group, idx) => (
                            <div key={idx} className="mb-6 break-inside-avoid">
                                <div className="bg-slate-100 p-2 border-l-4 border-emerald-500 font-bold text-sm text-slate-800 mb-2 flex justify-between">
                                    <span>{group.date.toLocaleDateString('tr-TR')} - {group.taskName}</span>
                                    <span className="text-emerald-700">{group.totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                </div>
                                <table className="w-full text-[11px]">
                                    <tbody>
                                        {group.items.map((item, i) => (
                                            <tr key={i} className="border-b border-slate-100">
                                                <td className="p-1.5 text-slate-600">{item.name}</td>
                                                <td className="p-1.5 text-right font-mono">{item.unit === 'Paket' ? '1 Paket' : `${item.quantity.toLocaleString('tr-TR')} ${item.unit}`}</td>
                                                <td className="p-1.5 text-right font-mono font-bold text-slate-900">{item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ))}
                    </div>
                )}

                {reportSettings.includeCashflow && (
                    <div className="w-full min-h-[297mm] p-12 bg-white print:break-after-page page-break">
                        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                            <div><h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Aylık Nakit Akışı</h2><p className="text-slate-500 text-sm mt-1">Proje süresince oluşacak tahmini gelir, gider ve bakiye tablosu</p></div>
                        </div>
                        <table className="w-full text-xs text-left border-collapse">
                            <thead className="bg-slate-800 text-white">
                                <tr><th className="p-3">Dönem</th><th className="p-3 text-right">Gelir (Satış)</th><th className="p-3 text-right">Gider (İnşaat)</th><th className="p-3 text-right">Kasa (Bakiye)</th></tr>
                            </thead>
                            <tbody className="divide-y divide-slate-200">
                                {cashflowTable.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-slate-50">
                                        <td className="p-3 font-bold">{row.month}</td>
                                        <td className="p-3 text-right font-mono text-green-600">{row.income > 0 ? `+${row.income.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '-'}</td>
                                        <td className="p-3 text-right font-mono text-red-600">{row.expense > 0 ? `-${row.expense.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}` : '-'}</td>
                                        <td className={`p-3 text-right font-mono font-bold ${row.balance < 0 ? 'text-red-600' : 'text-slate-900'}`}>{row.balance.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}

                {reportSettings.includeRiskAnalysis && (
                    <div className="w-full min-h-[297mm] p-12 bg-white print:break-after-auto page-break">
                        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                            <div><h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Risk ve Yatırım Analizi</h2><p className="text-slate-500 text-sm mt-1">Enflasyon etkileri ve alternatif getiri maliyetleri</p></div>
                        </div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="bg-slate-50 border border-slate-200 p-6 rounded-xl">
                                <h4 className="text-xs uppercase font-bold text-slate-500 mb-2">Bugünkü Net Maliyet</h4>
                                <p className="text-3xl font-bold text-slate-900">{projectTotalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</p>
                                <p className="text-[10px] text-slate-400 mt-2">Bugünkü piyasa fiyatlarıyla hiç zam gelmezse ödenecek tutar.</p>
                            </div>
                            <div className="bg-orange-50 border border-orange-200 p-6 rounded-xl">
                                <h4 className="text-xs uppercase font-bold text-orange-600 mb-2">Enflasyonlu Tahmini Maliyet</h4>
                                <p className="text-3xl font-bold text-orange-700">
                                    {(projectTotalCost * Math.pow(1 + ((financialSettings.monthlyInflationRate || 0) / 100), constructionDuration / 2)).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </p>
                                <p className="text-[10px] text-orange-500 mt-2">Aylık %{financialSettings.monthlyInflationRate} enflasyon beklentisiyle hesaplanmıştır.</p>
                            </div>
                            <div className="col-span-2 bg-blue-50 border border-blue-200 p-6 rounded-xl">
                                <h4 className="text-xs uppercase font-bold text-blue-600 mb-2">Fırsat Maliyeti (Mevduat Getirisi)</h4>
                                <p className="text-2xl font-bold text-blue-800 mb-1">
                                    Tahmini Getiri: +{((projectTotalCost * Math.pow(1 + ((financialSettings.monthlyInterestRate || 0) / 100), constructionDuration)) - projectTotalCost).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </p>
                                <p className="text-[11px] text-blue-600">İnşaata yatırılacak olan "Bugünkü Maliyet" tutarı {constructionDuration} ay boyunca aylık %{financialSettings.monthlyInterestRate} mevduat faizinde kalsaydı elde edilecek risksiz kazançtır.</p>
                            </div>
                        </div>
                    </div>
                )}

            </div>

            <style>{`
                @import url('https://fonts.googleapis.com/css2?family=Inter:wght@300;400;600;800&family=Playfair+Display:wght@700&display=swap');
                .font-serif { font-family: 'Playfair Display', serif; }
                
                @media print {
                    @page { margin: 0; size: A4; }
                    body { background: white; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                    .print\\:hidden { display: none !important; }
                    .print\\:shadow-none { box-shadow: none !important; }
                    .print\\:w-full { width: 100% !important; max-width: none !important; margin: 0 !important; }
                    .print\\:m-0 { margin: 0 !important; }
                    .print\\:break-after-page { break-after: page; page-break-after: always; }
                    .print\\:break-after-auto { break-after: auto; }
                    tr { break-inside: avoid; page-break-inside: avoid; }
                    thead { display: table-header-group; }
                    tfoot { display: table-footer-group; }
                }
            `}</style>
        </div>
    );
};