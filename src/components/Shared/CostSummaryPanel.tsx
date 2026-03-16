// src/components/Shared/CostSummaryPanel.tsx
import React, { useMemo } from 'react';
import { CostCategory } from '../../../api/_utils/cost_data';
import { UnitType } from '../../types';
import { NumericInput } from './NumericInput';
import { useProjectStore } from '../../stores/projectStore';
import { exportCostsToExcel, importPricesFromExcel } from '../../utils/excelUtils';

interface CostSummaryPanelProps {
    unit: UnitType | undefined;
    costs: CostCategory[];
    quantities: Record<string, number>;
    scope: 'architectural' | 'structural';
    onUpdateCostItem: (catId: string, itemName: string, field: 'manualPrice', value: number | undefined) => void;
    structuralStats?: any;
}

export const CostSummaryPanel: React.FC<CostSummaryPanelProps> = ({
    unit,
    costs,
    quantities,
    scope,
    onUpdateCostItem,
    structuralStats
}) => {
    const isStructural = scope === 'structural';

    const { units: archUnits, projectCostDetails, bulkUpdatePrices } = useProjectStore();

    const { deductions, totalDeduction } = useMemo(() => {
        const deds: Record<string, number> = { '10': 0, '13.5': 0, '15': 0, '20': 0, '25': 0 };
        archUnits.forEach(u => {
            u.rooms.forEach(r => {
                const wArea = r.properties.windowArea || 0;
                const wThick = r.properties.windowWallThickness || 20; 
                const wKey = wThick <= 10 ? '10' : wThick <= 13.5 ? '13.5' : wThick <= 15 ? '15' : wThick <= 20 ? '20' : '25';
                deds[wKey] += (wArea * u.count);

                const dArea = (r.properties.doorCount || 0) * 1.89;
                const dThick = r.properties.doorWallThickness || 13.5; 
                const dKey = dThick <= 10 ? '10' : dThick <= 13.5 ? '13.5' : dThick <= 15 ? '15' : dThick <= 20 ? '20' : '25';
                deds[dKey] += (dArea * u.count);
            });
        });
        const total = Object.values(deds).reduce((sum, val) => sum + val, 0);
        return { deductions: deds, totalDeduction: total };
    }, [archUnits]);

    return (
        <div className="flex flex-col h-full bg-white dark:bg-slate-900 border-l border-slate-200 dark:border-slate-800 shadow-2xl z-20 w-80 min-w-[20rem] transition-colors duration-300">
            <div className="p-3 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 shadow-sm dark:shadow-lg z-10 transition-colors duration-300">
                {isStructural ? (
                    <>
                        <h2 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                            <i className="fas fa-cubes text-orange-500"></i> Kat Kaba Yapı Metrajı
                        </h2>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Bu kat planındaki yapısal elemanların (Kolon, Kiriş, Döşeme, Duvar) toplam metrajı
                        </div>
                    </>
                ) : (
                    <>
                        <h2 className="font-bold text-slate-900 dark:text-white text-xs flex items-center gap-2">
                            <i className="fas fa-calculator text-blue-500"></i> Daire Maliyet Özeti
                        </h2>
                        <div className="text-[10px] text-slate-500 dark:text-slate-400 mt-1">
                            Bu dairede yapılan değişikliklerin proje geneline etkisi
                        </div>
                    </>
                )}
            </div>


            <div className="flex-1 overflow-y-auto p-2 space-y-3 custom-scrollbar">

                {/* --- STRUCTURAL STATS BOX --- */}
                {isStructural && structuralStats && (
                    <div className="border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800/30">
                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            Hesaplanan Yapısal Metraj
                        </div>
                        <div className="p-2 space-y-2">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50 pb-1">
                                <span><i className="fas fa-cube mr-1 text-slate-400"></i>Toplam Beton (C30)</span>
                                <span className="text-slate-900 dark:text-white font-mono font-bold">
                                    {((structuralStats.column_concrete_volume + structuralStats.beam_concrete_volume + structuralStats.slab_concrete_volume) || 0).toFixed(2)} m³
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50 pb-1">
                                <span><i className="fas fa-layer-group mr-1 text-slate-400"></i>Toplam Kalıp</span>
                                <span className="text-slate-900 dark:text-white font-mono font-bold">
                                    {((structuralStats.column_formwork_area + structuralStats.beam_formwork_area + structuralStats.slab_formwork_area) || 0).toFixed(2)} m²
                                </span>
                            </div>

                            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                                <span><i className="fas fa-th-large mr-1 text-slate-400"></i>Net Duvar Alanı</span>
                                <span className="text-slate-900 dark:text-white font-mono font-bold">
                                    {(structuralStats.net_wall_area || 0).toFixed(2)} m²
                                </span>
                            </div>

                            {totalDeduction > 0 && (
                                <div className="mt-2 bg-blue-50 dark:bg-blue-900/20 p-2 rounded border border-blue-100 dark:border-blue-800/50">
                                    <div className="text-[9px] font-bold text-blue-600 dark:text-blue-400 mb-1">
                                        <i className="fas fa-info-circle mr-1"></i> Mimari Planlardan Düşülen Boşluklar
                                    </div>
                                    {Object.entries(deductions).filter(([_, val]) => val > 0).map(([thick, val]) => (
                                        <div key={thick} className="flex justify-between text-[9px] text-slate-600 dark:text-slate-400">
                                            <span>{thick} cm Duvarlardan:</span>
                                            <span className="font-mono text-red-500 font-bold">-{val.toFixed(2)} m²</span>
                                        </div>
                                    ))}
                                </div>
                            )}

                            <div className="mt-2 pt-2 border-t border-slate-200 dark:border-slate-700/50">
                                <div className="text-[9px] text-slate-400 italic text-center">
                                    Detaylar: Kolon: {structuralStats.column_concrete_volume?.toFixed(1)}m³ | Kiriş: {structuralStats.beam_concrete_volume?.toFixed(1)}m³ | Döşeme: {structuralStats.slab_concrete_volume?.toFixed(1)}m³
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- YENİ EKLENEN: ARCHITECTURAL STATS BOX --- */}
                {!isStructural && unit && (
                    <div className="border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800/30">
                        <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                            Daire Metraj Özeti
                        </div>
                        <div className="p-2 space-y-2">
                            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50 pb-1">
                                <span><i className="fas fa-vector-square mr-1 text-slate-400"></i>Net Süpürülebilir Alan</span>
                                <span className="text-slate-900 dark:text-white font-mono font-bold">
                                    {unit.rooms.reduce((acc, r) => acc + (r.manualAreaM2 || (r.area_px > 0 && unit.scale > 0 ? r.area_px/(unit.scale**2) : 0)), 0).toFixed(2)} m²
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-slate-700/50 pb-1">
                                <span><i className="fas fa-border-all mr-1 text-slate-400"></i>Toplam Pencere Alanı</span>
                                <span className="text-slate-900 dark:text-white font-mono font-bold text-blue-500">
                                    {unit.rooms.reduce((acc, r) => acc + (r.properties.windowArea || 0), 0).toFixed(2)} m²
                                </span>
                            </div>
                            <div className="flex justify-between items-center text-[10px] text-slate-500 dark:text-slate-400">
                                <span><i className="fas fa-door-open mr-1 text-slate-400"></i>Toplam Kapı Sayısı</span>
                                <span className="text-slate-900 dark:text-white font-mono font-bold text-purple-500">
                                    {unit.rooms.reduce((acc, r) => acc + (r.properties.doorCount || 0), 0)} Adet
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- COST ITEMS LIST --- */}
                {costs.map((category) => {
                    // Filter Logic based on Scope
                    if (scope === 'architectural') {
                        // DEĞİŞİKLİK BURADA: Mobilya (Kapı) ve Dış Cephe (Pencere) kalemlerinin gizlenmesi iptal edildi.
                        if (['arsa_finansman', 'resmi_idari', 'santiye_hafriyat', 'kaba_insaat', 'peyzaj_cevre'].includes(category.id)) return null; 
                        
                        const hasUnitItems = category.items.some(i => i.scope === 'unit');
                        if (!hasUnitItems) return null;
                    }

                    if (scope === 'structural' && category.id !== 'kaba_insaat' && category.id !== 'duvar_tavan') return null;

                    const visibleItems = category.items.filter(item => {
                        if (scope === 'architectural') {
                            // 1. Sadece daire/birim (unit) bazlı hesaplananları al
                            if (item.scope !== 'unit') return false;
                            
                            // 2. Sadece istenen temel kalem gruplarını göster, diğerlerini gizle
                            const allowedKeywords = [
                                "Şap Malzemesi",
                                "Şap İşçiliği", 
                                "Sıva", 
                                "Boya", 
                                "Seramik", 
                                "Derz", 
                                "Parke", 
                                "Süpürgelik", // Parke ile takım olduğu için dahil edildi
                                "Pencere", // Cam
                                "Denizlik", // Cam ile takım olduğu için dahil edildi
                                "Kapı",
                                "Pencere",
                                "Yalıtım"
                            ];
                            
                            // Öğenin adı bu kelimelerden herhangi birini içeriyorsa göster
                            return allowedKeywords.some(kw => item.name.includes(kw));
                        }
                        
                        if (scope === 'structural') {
                            const excludedItems = [
                                "İç Sıva (Kara Sıva)",
                                "Alçı Sıva (Kaba+Saten)",
                                "İç Cephe Boyası",
                                "Tavan Boyası",
                                "Kartonpiyer / Stropiyer"
                            ];
                            if (excludedItems.includes(item.name)) return false;
                            if (quantities[item.name] > 0) return true;
                            if (['Betonarme Betonu', 'İnşaat Demiri', 'Kalıp İşçiliği & Malzeme'].includes(item.name)) return true;
                            return false;
                        }
                        
                        return true;
                    });

                    if (visibleItems.length === 0) return null;

                    return (
                        <div key={category.id} className="border border-slate-200 dark:border-slate-700 rounded bg-slate-50 dark:bg-slate-800/30 transition-colors duration-300">
                            <div className="bg-slate-100 dark:bg-slate-800 px-3 py-2 text-[10px] font-bold text-slate-600 dark:text-slate-300 uppercase tracking-wider border-b border-slate-200 dark:border-slate-700">
                                {isStructural ? category.title.replace('3. ', '').replace('4. ', '') : category.title}
                            </div>
                            <div className="p-2 space-y-2">
                                {visibleItems.map((item) => {
                                    const unitQty = quantities[item.name] || 0;
                                    const unitCount = unit?.count || 1;
                                    const totalQty = unitQty * unitCount;

                                    const isManualPrice = item.manualPrice !== undefined;
                                    const finalPrice = isManualPrice ? item.manualPrice! : item.unit_price;
                                    const totalCost = totalQty * finalPrice;

                                    if (unitQty === 0 && !isStructural) return null; 

                                    return (
                                        <div key={item.name} className="flex flex-col text-[10px] border-b border-slate-200 dark:border-slate-700/50 pb-2 last:border-0 last:pb-0">
                                            <div className="flex justify-between items-center mb-1">
                                                <span className="text-slate-900 dark:text-white font-medium">{item.name}</span>
                                            </div>

                                            <div className="flex items-center justify-between text-[9px] text-slate-500 dark:text-slate-400 bg-white dark:bg-slate-900/50 p-1 rounded border border-slate-200 dark:border-slate-700/30 mb-1">
                                                <div className="flex items-center gap-1">
                                                    <span className="text-blue-500 dark:text-blue-400 font-mono">{Number(unitQty).toFixed(2)}</span>
                                                    <span>x</span>
                                                    <span className="text-slate-600 dark:text-slate-500">{unitCount} {isStructural ? 'Kat' : 'Adet'}</span>
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span>=</span>
                                                    <span className="text-yellow-600 dark:text-yellow-500 font-bold font-mono">{totalQty.toLocaleString(undefined, { maximumFractionDigits: 0 })} {item.unit}</span>
                                                </div>
                                            </div>

                                            <div className="flex justify-between items-center bg-slate-100 dark:bg-slate-900/30 p-1 rounded">
                                                <div className="flex items-center gap-1 relative group">
                                                    <span className="text-[9px] text-slate-500 whitespace-nowrap">B.Fiyat:</span>
                                                    <div className="relative flex items-center">
                                                        <NumericInput
                                                            className={`bg-transparent w-14 text-right outline-none border-b border-slate-300 dark:border-slate-700 focus:border-blue-500 text-[9px] ${isManualPrice ? 'text-yellow-600 dark:text-yellow-400 font-bold' : 'text-slate-600 dark:text-slate-300'}`}
                                                            value={Number(Number(finalPrice).toFixed(2))}
                                                            onChange={(val) => onUpdateCostItem(category.id, item.name, 'manualPrice', val)}
                                                        />
                                                        <span className="ml-0.5 text-slate-500 text-[9px]">₺</span>
                                                    </div>

                                                    {isManualPrice && (
                                                        <button
                                                            onClick={() => onUpdateCostItem(category.id, item.name, 'manualPrice', undefined)}
                                                            className="ml-1 text-[8px] text-red-500 dark:text-red-400 hover:text-red-400 bg-slate-200 dark:bg-slate-800 px-1 rounded opacity-50 group-hover:opacity-100 transition"
                                                            title="Sistem fiyatına dön"
                                                        >
                                                            <i className="fas fa-undo"></i>
                                                        </button>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-1">
                                                    <span className="font-bold text-green-600 dark:text-green-400">{totalCost.toLocaleString('tr-TR', { maximumFractionDigits: 0 })} ₺</span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};