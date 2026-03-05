import React, { useRef, useMemo } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { BRAND_CATEGORIES } from "../../brand_data";

export const ReportView: React.FC = () => {
    const {
        projectTotalCost, totalConstructionArea, constructionDuration,
        projectCostDetails, reportSettings, updateReportSettings, buildingStats
    } = useProjectStore();

    const { navigateToDashboard } = useUIStore();
    const fileInputRefLogo = useRef<HTMLInputElement>(null);
    const fileInputRefRender = useRef<HTMLInputElement>(null);

    // --- KAR MARJI HESAPLAMA MANTIĞI ---
    const { finalTotalCost, finalCostDetails } = useMemo(() => {
        // Kar marjı çarpanı (Örn: %20 için 1.20)
        const marginMultiplier = 1 + (reportSettings.profitMargin / 100);

        // Genel toplamı güncelle
        const newTotal = projectTotalCost * marginMultiplier;

        // Detayları güncelle
        const newDetails = projectCostDetails.map(cat => ({
            ...cat,
            totalCategoryCost: cat.totalCategoryCost * marginMultiplier,
            items: cat.items.map(item => ({
                ...item,
                // Birim fiyatı artır (Görüntüleme için)
                unit_price: item.unit_price * marginMultiplier,
                // Manuel fiyat varsa onu da artır
                manualPrice: item.manualPrice !== undefined ? item.manualPrice * marginMultiplier : undefined,
                // Toplam tutarı artır (Paket fiyatlar burada devreye girer)
                totalPrice: item.totalPrice * marginMultiplier
            }))
        }));

        return { finalTotalCost: newTotal, finalCostDetails: newDetails };
    }, [projectTotalCost, projectCostDetails, reportSettings.profitMargin]);

    // --- Görsel Yükleme ---
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

    const handlePrint = () => {
        window.print();
    };

    // --- Modern Donut Chart ---
    const CostDonutChart = () => {
        const colors = ['#1e3a8a', '#d97706', '#059669', '#7c3aed', '#db2777', '#dc2626'];
        let cumulativePercent = 0;

        const sortedCosts = [...finalCostDetails]
            .filter(c => c.totalCategoryCost > 0)
            .sort((a, b) => b.totalCategoryCost - a.totalCategoryCost);

        return (
            <div className="flex flex-row items-center justify-between gap-8 p-6 bg-slate-50 border border-slate-200 rounded-lg break-inside-avoid">
                {/* Grafik */}
                <div className="relative w-48 h-48 shrink-0">
                    <svg viewBox="0 0 100 100" className="transform -rotate-90 w-full h-full drop-shadow-md">
                        {sortedCosts.map((cat, i) => {
                            const percent = (cat.totalCategoryCost / finalTotalCost) * 100;
                            const strokeDasharray = `${percent} ${100 - percent}`;
                            const strokeDashoffset = -cumulativePercent;
                            cumulativePercent += percent;

                            return (
                                <circle
                                    key={cat.id}
                                    cx="50" cy="50" r="40"
                                    fill="transparent"
                                    stroke={colors[i % colors.length]}
                                    strokeWidth="16"
                                    strokeDasharray={strokeDasharray}
                                    strokeDashoffset={strokeDashoffset}
                                    pathLength="100"  
                                    className="hover:opacity-90 transition-opacity"
                                />
                            );
                        })}
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center flex-col text-slate-800">
                        <span className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">TOPLAM</span>
                        <span className="text-lg font-bold text-slate-900 font-mono">
                            {(finalTotalCost / 1000000).toFixed(1)}M
                        </span>
                    </div>
                </div>

                {/* Lejant */}
                <div className="flex-1 grid grid-cols-1 gap-2">
                    {sortedCosts.map((cat, i) => (
                        <div key={cat.id} className="flex justify-between items-center text-xs border-b border-slate-200 pb-1 last:border-0">
                            <div className="flex items-center gap-2">
                                <span className="w-3 h-3 rounded-sm shadow-sm" style={{ backgroundColor: colors[i % colors.length] }}></span>
                                <span className="text-slate-700 font-bold uppercase tracking-tight truncate max-w-[180px]">
                                    {cat.title.replace(/^\d+\.\s*/, '')}
                                </span>
                            </div>
                            <div className="text-right">
                                <span className="block font-bold text-slate-900">
                                    {cat.totalCategoryCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                </span>
                                <span className="text-[10px] text-slate-500 font-mono">
                                    %{((cat.totalCategoryCost / finalTotalCost) * 100).toFixed(1)}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-gray-100 font-sans text-slate-800 print:bg-white">

            {/* --- EDİTÖR TEPESİ (Yazdırırken Gizlenir) --- */}
            <div className="print:hidden bg-slate-900 text-white p-4 sticky top-0 z-50 flex flex-col md:flex-row justify-between items-center shadow-lg border-b border-slate-700 gap-4">
                <div className="flex items-center gap-4 w-full md:w-auto">
                    <button onClick={navigateToDashboard} className="bg-slate-800 hover:bg-slate-700 px-4 py-2 rounded text-sm font-bold flex items-center gap-2 transition">
                        <i className="fas fa-arrow-left"></i> Geri
                    </button>
                    <div>
                        <h1 className="font-bold text-lg text-white">Rapor Önizleme</h1>
                        <p className="text-xs text-slate-400">Teklif hazırlama modu</p>
                    </div>
                </div>

                {/* --- KAR MARJI GİRİŞİ --- */}
                <div className="flex items-center bg-slate-800 p-2 rounded-lg border border-slate-700">
                    <div className="flex flex-col mr-3 text-right">
                        <span className="text-[10px] text-yellow-500 font-bold uppercase tracking-wider">Kar & Genel Gider</span>
                        <span className="text-xs text-slate-400">Tüm kalemlere eklenir</span>
                    </div>
                    <div className="relative flex items-center">
                        <input
                            type="number"
                            min="0"
                            value={reportSettings.profitMargin}
                            onChange={(e) => updateReportSettings({ profitMargin: parseFloat(e.target.value) || 0 })}
                            className="bg-slate-900 text-white text-lg font-bold w-16 p-1 text-center rounded border border-slate-600 focus:border-yellow-500 outline-none"
                        />
                        <span className="ml-2 font-bold text-slate-400">%</span>
                    </div>
                </div>

                <div className="flex gap-3 w-full md:w-auto justify-end">
                    <button onClick={() => fileInputRefLogo.current?.click()} className="bg-blue-600 hover:bg-blue-500 px-3 py-2 rounded text-sm font-bold transition shadow-sm"><i className="fas fa-image mr-2"></i>Logo</button>
                    <button onClick={() => fileInputRefRender.current?.click()} className="bg-purple-600 hover:bg-purple-500 px-3 py-2 rounded text-sm font-bold transition shadow-sm"><i className="fas fa-camera mr-2"></i>Kapak</button>
                    <button onClick={handlePrint} className="bg-green-600 hover:bg-green-500 px-6 py-2 rounded text-sm font-bold shadow-lg flex items-center gap-2 hover:scale-105 transition transform">
                        <i className="fas fa-print"></i> Yazdır / PDF
                    </button>
                </div>
                <input type="file" ref={fileInputRefLogo} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'logo')} />
                <input type="file" ref={fileInputRefRender} className="hidden" accept="image/*" onChange={(e) => handleImageUpload(e, 'render')} />
            </div>

            {/* --- RAPOR ALANI (A4) --- */}
            <div className="w-[210mm] mx-auto bg-white shadow-2xl print:shadow-none print:w-full print:m-0">

                {/* --- SAYFA 1: KAPAK (COVER PAGE) --- */}
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
                                <input
                                    type="text"
                                    value={reportSettings.firmName}
                                    onChange={(e) => updateReportSettings({ firmName: e.target.value })}
                                    className="bg-transparent text-right text-xl font-bold text-white border-b border-transparent hover:border-white/50 focus:border-white outline-none placeholder-white/30 uppercase tracking-widest"
                                    placeholder="FİRMA ADI"
                                />
                                <div className="text-sm text-white/60 mt-1">{new Date().toLocaleDateString()}</div>
                            </div>
                        </div>

                        <div className="mb-20">
                            <div className="w-24 h-1 bg-yellow-500 mb-6"></div>
                            <h1 className="text-6xl font-extrabold leading-tight text-white mb-4 drop-shadow-2xl font-serif">
                                YAPI İNŞAAT<br />TEKLİF DOSYASI
                            </h1>
                            <input
                                type="text"
                                value={reportSettings.clientName}
                                onChange={(e) => updateReportSettings({ clientName: e.target.value })}
                                className="bg-transparent text-3xl font-light text-white/90 border-b border-transparent hover:border-white/50 focus:border-white outline-none w-full placeholder-white/40"
                                placeholder="Proje / Müşteri Adı Giriniz"
                            />
                        </div>

                        <div className="grid grid-cols-3 gap-8 border-t border-white/20 pt-8">
                            <div>
                                <span className="block text-xs uppercase tracking-widest text-yellow-500 mb-1">Toplam Alan</span>
                                <span className="text-2xl font-bold font-mono">{totalConstructionArea.toLocaleString()} m²</span>
                            </div>
                            <div>
                                <span className="block text-xs uppercase tracking-widest text-yellow-500 mb-1">Toplam Teklif</span>
                                <span className="text-2xl font-bold font-mono">{finalTotalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                            </div>
                            <div>
                                <span className="block text-xs uppercase tracking-widest text-yellow-500 mb-1">Konum</span>
                                <span className="text-xl font-medium">{buildingStats.province}, {buildingStats.district}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* --- SAYFA 2: YÖNETİCİ ÖZETİ --- */}
                <div className="w-full min-h-[297mm] p-12 bg-white relative print:break-after-page page-break">
                    <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Teklif Özeti</h2>
                            <p className="text-slate-500 text-sm mt-1">Genel teknik veriler ve bütçe dağılımı</p>
                        </div>
                        <div className="text-right">
                            <span className="text-4xl font-bold text-slate-900 font-mono tracking-tighter">01</span>
                        </div>
                    </div>

                    <div className="mb-8">
                        <label className="block text-xs font-bold text-slate-400 uppercase mb-2">Proje Notları</label>
                        <textarea
                            value={reportSettings.projectDescription}
                            onChange={(e) => updateReportSettings({ projectDescription: e.target.value })}
                            className="w-full text-base text-slate-700 bg-slate-50 p-4 rounded border-l-4 border-yellow-500 outline-none focus:bg-white transition resize-none italic"
                            rows={3}
                        />
                    </div>

                    <div className="grid grid-cols-3 gap-6 mb-8">
                        <div className="p-6 bg-slate-900 text-white rounded-lg shadow-lg">
                            <div className="text-yellow-500 mb-2"><i className="fas fa-coins text-2xl"></i></div>
                            <div className="text-xs uppercase font-bold tracking-widest opacity-70">Teklif Tutarı</div>
                            <div className="text-3xl font-bold mt-1 tracking-tight">
                                {finalTotalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                            </div>
                        </div>
                        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="text-blue-600 mb-2"><i className="fas fa-ruler-combined text-2xl"></i></div>
                            <div className="text-xs uppercase font-bold text-slate-400 tracking-widest">Birim Fiyat (m²)</div>
                            <div className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">
                                {(finalTotalCost / totalConstructionArea).toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                            </div>
                        </div>
                        <div className="p-6 bg-white border border-slate-200 rounded-lg shadow-sm">
                            <div className="text-green-600 mb-2"><i className="fas fa-clock text-2xl"></i></div>
                            <div className="text-xs uppercase font-bold text-slate-400 tracking-widest">Süre</div>
                            <div className="text-3xl font-bold text-slate-800 mt-1 tracking-tight">
                                {constructionDuration} Ay
                            </div>
                        </div>
                    </div>

                    <div className="mb-4">
                        <h3 className="text-sm font-bold text-slate-900 uppercase mb-4 border-b border-slate-200 pb-2">Bütçe Dağılımı</h3>
                        <CostDonutChart />
                    </div>

                    <div className="absolute bottom-12 left-12 right-12 border-t border-slate-200 pt-4 flex justify-between text-[10px] text-slate-400 uppercase tracking-widest">
                        <span>{reportSettings.firmName}</span>
                        <span>CY Pro Teklif Sistemi</span>
                    </div>
                </div>

                {reportSettings.selectedBrands && Object.keys(reportSettings.selectedBrands).length > 0 && (
                    <div className="w-full min-h-[150mm] p-12 bg-slate-50 relative print:break-after-page page-break border-t border-slate-200">
                        <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                            <div>
                                <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">Kullanılacak Malzeme Markaları</h2>
                                <p className="text-slate-500 text-sm mt-1">Projede kullanılması taahhüt edilen/önerilen 1. Sınıf markalar</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-6 mb-8 break-inside-avoid">
                            {/* flatMap kullanarak seçilen tüm markaları yan yana dizebiliriz */}
                            {BRAND_CATEGORIES.flatMap(category => {
                                const selectedBrandIds = reportSettings.selectedBrands![category.categoryId];
                                if (!selectedBrandIds || selectedBrandIds.length === 0) return []; // Seçili marka yoksa atla

                                const selectedBrands = category.brands.filter(b => selectedBrandIds.includes(b.id));

                                return selectedBrands.map(brandInfo => (
                                    <div key={`${category.categoryId}-${brandInfo.id}`} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex flex-col items-center justify-center text-center">
                                        <h4 className="text-[10px] uppercase font-bold text-slate-400 tracking-wider mb-3 w-full border-b border-slate-100 pb-2">
                                            {category.title}
                                        </h4>
                                        <div className="h-16 w-full flex items-center justify-center mb-2 p-1">
                                            {brandInfo.image ? (
                                                <img src={brandInfo.image} alt={brandInfo.name} className="max-w-full max-h-full object-contain mix-blend-multiply filter grayscale hover:grayscale-0 transition duration-300" />
                                            ) : (
                                                <div className="text-slate-300 italic text-xs">Görsel Yok</div>
                                            )}
                                        </div>
                                        <span className="font-bold text-slate-800 text-sm">{brandInfo.name}</span>
                                    </div>
                                ));
                            })}
                        </div>
                    </div>
                )}

                {/* --- SAYFA 3: DETAYLI DÖKÜM --- */}
                <div className="w-full min-h-[297mm] p-12 bg-white print:break-after-auto">
                    <div className="flex justify-between items-end border-b-2 border-slate-900 pb-4 mb-8">
                        <div>
                            <h2 className="text-3xl font-bold text-slate-900 uppercase tracking-tight">İmalat Detayı</h2>
                            <p className="text-slate-500 text-sm mt-1">İmalat kalemleri bazında detaylı döküm</p>
                        </div>
                        <div className="text-right">
                            <span className="text-4xl font-bold text-slate-900 font-mono tracking-tighter">02</span>
                        </div>
                    </div>

                    <div className="w-full">
                        <table className="w-full text-sm border-collapse">
                            <thead className="bg-slate-900 text-white">
                                <tr>
                                    <th className="py-3 px-4 text-left font-bold uppercase text-xs tracking-wider rounded-tl-lg">İmalat Kalemi</th>
                                    <th className="py-3 px-4 text-right font-bold uppercase text-xs tracking-wider">Miktar</th>
                                    <th className="py-3 px-4 text-center font-bold uppercase text-xs tracking-wider">Birim</th> {/* Yeni Sütun */}
                                    <th className="py-3 px-4 text-right font-bold uppercase text-xs tracking-wider">Birim Fiyat</th>
                                    <th className="py-3 px-4 text-right font-bold uppercase text-xs tracking-wider rounded-tr-lg">Toplam</th>
                                </tr>
                            </thead>
                            <tbody className="text-slate-700">
                                {finalCostDetails.map(cat => (
                                    <React.Fragment key={cat.id}>
                                        <tr className="bg-slate-100 border-b border-slate-200 break-after-avoid">
                                            <td colSpan={5} className="py-2 px-4 font-bold text-slate-900 text-xs uppercase tracking-wide">
                                                <div className="flex justify-between items-center">
                                                    <span>{cat.title}</span>
                                                    <span className="bg-slate-200 px-2 py-0.5 rounded text-[10px]">
                                                        {cat.totalCategoryCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                    </span>
                                                </div>
                                            </td>
                                        </tr>
                                        {cat.items.filter(i => i.totalPrice > 0).map((item, idx) => (
                                            <tr key={idx} className="border-b border-slate-100 hover:bg-slate-50 break-inside-avoid">
                                                <td className="py-2 px-4 pl-8 text-xs font-medium border-r border-slate-100">{item.name}</td>

                                                {/* Miktar: Paket ise boş, değilse sayı */}
                                                <td className="py-2 px-4 text-right font-mono text-xs text-slate-500 border-r border-slate-100">
                                                    {item.inputType === 'manual_total'
                                                        ? '' // Paket kalemlerde miktar boş
                                                        : item.finalQty.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                                                </td>

                                                {/* Birim: Her durumda görünür */}
                                                <td className="py-2 px-4 text-center font-mono text-xs text-slate-500 border-r border-slate-100">
                                                    {item.unit}
                                                </td>

                                                {/* Birim Fiyat: Paket ise tire, değilse fiyat (karlı) */}
                                                <td className="py-2 px-4 text-right font-mono text-xs text-slate-500 border-r border-slate-100">
                                                    {item.inputType === 'manual_total'
                                                        ? '-'
                                                        : `${item.unit_price.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ₺`}
                                                </td>

                                                {/* Toplam: Her durumda karlı toplam */}
                                                <td className="py-2 px-4 text-right font-bold font-mono text-xs text-slate-900">
                                                    {item.totalPrice.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                                </td>
                                            </tr>
                                        ))}
                                    </React.Fragment>
                                ))}
                            </tbody>
                            <tfoot className="bg-slate-900 text-white break-inside-avoid">
                                <tr>
                                    <td colSpan={4} className="py-4 px-6 text-right font-bold uppercase tracking-widest text-sm">Genel Toplam</td>
                                    <td className="py-4 px-4 text-right font-bold text-xl text-yellow-400 font-mono rounded-br-lg">
                                        {finalTotalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺
                                    </td>
                                </tr>
                            </tfoot>
                        </table>
                    </div>

                    <div className="mt-8 p-4 bg-slate-50 border border-slate-200 text-[10px] text-slate-500 rounded break-inside-avoid">
                        <strong>NOT:</strong> Bu teklif dosyası CY Pro İnşaat Manager (www.celikyucel.com) kullanılarak oluşturulmuştur. Hesaplanan değerler piyasa ortalamalarına ve girilen parametrelere dayalı tahmini verilerdir.
                    </div>
                </div>

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