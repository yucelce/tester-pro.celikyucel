// src/components/Modals/BuildingModals.tsx dosyasındaki BuildingModal componentini aşağıdaki gibi güncelleyin:

import React, { useState } from 'react';
import { BuildingStats, UnitType, Point } from '../../types';
import { CostCategory } from '../../cost_data';

import { useProjectStore } from '../../stores/projectStore';
import { NumericInput } from '../Shared/NumericInput';
import { TURKEY_HEAT_MAP, PROVINCE_EARTHQUAKE_ZONES } from '../../constants';

// ... (StructureModal bileşeni aynı kalacak) ...

// --- YENİLENEN BuildingModal (Sekmeli Yapı) ---
interface BuildingModalProps {
    onClose: () => void;
    buildingStats: BuildingStats;
    setBuildingStats: React.Dispatch<React.SetStateAction<BuildingStats>>;
    handleProvinceChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    handleDistrictChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    isFetchingHeat: boolean; // Arka planda çalışması için prop olarak kalabilir
}

export const BuildingModal: React.FC<BuildingModalProps> = ({ onClose, buildingStats, setBuildingStats, handleProvinceChange, handleDistrictChange, isFetchingHeat }) => {
    const { updateHallArea, structuralUnits } = useProjectStore();
    const [activeTab, setActiveTab] = useState<'general' | 'floors' | 'contract' | 'special' | 'villa_outdoor'>('general'); const systemEqZone = PROVINCE_EARTHQUAKE_ZONES[buildingStats.province] || 1;

    const handleBuildingTypeChange = (newType: 'apartment' | 'villa') => {
        if (newType !== buildingStats.buildingType) {
            const isConfirmed = window.confirm(
                "DİKKAT: Yapı tipini değiştirmek üzeresiniz!\n\n" +
                "Bu işlem; kat holleri, asansör, merdiven ve çatı/cephe gibi birçok otomatik metrajı ve projenizin toplam fiyatını YENİ SEÇİMİNİZE GÖRE REVİZE EDECEKTİR. Mevcut bağımsız bölüm yapılarınız da etkilenebilir.\n\n" +
                "Devam etmek istiyor musunuz?"
            );

            if (isConfirmed) {
                setBuildingStats({
                    ...buildingStats,
                    buildingType: newType,
                    normalFloorCount: newType === 'villa' ? 1 : buildingStats.normalFloorCount,
                    basementFloorCount: newType === 'villa' ? 0 : buildingStats.basementFloorCount,
                });
            }
        }
    };

    const handleFetchFromDrawing = (floorType: 'normal' | 'ground' | 'basement') => {
        const targetUnit = structuralUnits.find(u => u.floorType === floorType);

        if (!targetUnit || targetUnit.scale === 0) {
            alert("Bu kat tipine ait ölçeklendirilmiş bir statik plan bulunamadı. Lütfen önce planda çizim yapınız.");
            return;
        }

        let totalArea = 0;
        let manualArea = 0;
        let manualPerimeter = 0;
        let allPoints: Point[] = [];

        (targetUnit.slabs || []).forEach(slab => {
            if (slab.points && slab.points.length > 2) {
                totalArea += slab.area_px! / (targetUnit.scale * targetUnit.scale);
                allPoints.push(...slab.points);
            } else if (slab.manualAreaM2 > 0) {
                totalArea += slab.manualAreaM2;
                manualPerimeter += Math.sqrt(slab.manualAreaM2) * 4;
            }
        });

        (targetUnit.beams || []).forEach(beam => {
            const widthM = beam.properties.width / 100;
            const lengthM = beam.length_px / targetUnit.scale;
            totalArea += (widthM * lengthM);
            allPoints.push(beam.startPoint, beam.endPoint);
        });

        (targetUnit.columns || []).forEach(col => {
            if (col.points && col.points.length > 2) {
                totalArea += col.area_px! / (targetUnit.scale * targetUnit.scale);
                allPoints.push(...col.points);
            }
        });

        if (totalArea === 0 && manualArea === 0) {
            alert("Geçerli bir çizim (döşeme, kiriş veya kolon) bulunamadı.");
            return;
        }

        let calculatedPerimeter = 0;
        if (allPoints.length > 0) {
            const minX = Math.min(...allPoints.map(p => p.x));
            const maxX = Math.max(...allPoints.map(p => p.x));
            const minY = Math.min(...allPoints.map(p => p.y));
            const maxY = Math.max(...allPoints.map(p => p.y));

            const widthM = (maxX - minX) / targetUnit.scale;
            const heightM = (maxY - minY) / targetUnit.scale;
            calculatedPerimeter = 2 * (widthM + heightM);
        }

        const finalArea = totalArea + manualArea;
        const finalPerimeter = calculatedPerimeter + manualPerimeter;

        let updates: Partial<BuildingStats> = {};
        if (floorType === 'normal') {
            updates.normalFloorArea = parseFloat(finalArea.toFixed(2));
            updates.normalFloorPerimeter = parseFloat(finalPerimeter.toFixed(2));
            updates.isNormalPerimeterManual = true;
        } else if (floorType === 'ground') {
            updates.groundFloorArea = parseFloat(finalArea.toFixed(2));
            updates.groundFloorPerimeter = parseFloat(finalPerimeter.toFixed(2));
            updates.isGroundPerimeterManual = true;
        } else if (floorType === 'basement') {
            updates.basementFloorArea = parseFloat(finalArea.toFixed(2));
            updates.basementFloorPerimeter = parseFloat(finalPerimeter.toFixed(2));
            updates.isBasementPerimeterManual = true;
        }

        setBuildingStats(prev => ({ ...prev, ...updates }));
        alert(`Çizim verileri başarıyla çekildi.\n\nAlan (Kiriş/Kolon Dahil): ${finalArea.toFixed(2)} m²\nÇevre (Dış Limitler): ${finalPerimeter.toFixed(2)} mt.`);
    };

    const handleAreaChange = (type: 'normal' | 'ground' | 'basement', value: number) => {
        let updates: Partial<BuildingStats> = {};
        if (type === 'normal') {
            updates.normalFloorArea = value;
            if (!buildingStats.isNormalPerimeterManual) {
                updates.normalFloorPerimeter = parseFloat((Math.sqrt(value) * 4).toFixed(2));
            }
        } else if (type === 'ground') {
            updates.groundFloorArea = value;
            if (!buildingStats.isGroundPerimeterManual) {
                updates.groundFloorPerimeter = parseFloat((Math.sqrt(value) * 4).toFixed(2));
            }
        } else if (type === 'basement') {
            updates.basementFloorArea = value;
            if (!buildingStats.isBasementPerimeterManual) {
                updates.basementFloorPerimeter = parseFloat((Math.sqrt(value) * 4).toFixed(2));
            }
        }
        setBuildingStats({ ...buildingStats, ...updates });
    };

    const handlePerimeterChange = (type: 'normal' | 'ground' | 'basement', value: number) => {
        let updates: Partial<BuildingStats> = {};
        if (type === 'normal') {
            updates.normalFloorPerimeter = value;
            updates.isNormalPerimeterManual = true;
        } else if (type === 'ground') {
            updates.groundFloorPerimeter = value;
            updates.isGroundPerimeterManual = true;
        } else if (type === 'basement') {
            updates.basementFloorPerimeter = value;
            updates.isBasementPerimeterManual = true;
        }
        setBuildingStats({ ...buildingStats, ...updates });
    };

    const resetPerimeter = (type: 'normal' | 'ground' | 'basement') => {
        let updates: Partial<BuildingStats> = {};
        if (type === 'normal') {
            updates.isNormalPerimeterManual = false;
            updates.normalFloorPerimeter = parseFloat((Math.sqrt(buildingStats.normalFloorArea) * 4).toFixed(2));
        } else if (type === 'ground') {
            updates.isGroundPerimeterManual = false;
            updates.groundFloorPerimeter = parseFloat((Math.sqrt(buildingStats.groundFloorArea) * 4).toFixed(2));
        } else if (type === 'basement') {
            updates.isBasementPerimeterManual = false;
            updates.basementFloorPerimeter = parseFloat((Math.sqrt(buildingStats.basementFloorArea) * 4).toFixed(2));
        }
        setBuildingStats({ ...buildingStats, ...updates });
    };
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-2 md:p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-[95vw] md:max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="p-3 md:p-4 flex justify-between items-center bg-slate-800 shrink-0">
                    <div>
                        <h3 className="text-white font-bold text-base md:text-lg flex items-center gap-2">
                            <i className="fas fa-building text-blue-500"></i> Yapı Parametreleri
                        </h3>
                        <p className="text-[10px] text-slate-400 mt-1">Projenin temel inşaat ayarlarını buradan yönetin.</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white transition w-8 h-8 flex items-center justify-center rounded-full bg-slate-700/50 hover:bg-red-500/20 hover:text-red-400"><i className="fas fa-times text-lg"></i></button>
                </div>

                {/* Tabs Navigation */}
                <div className="flex border-b border-slate-700 bg-slate-800/80 px-2 md:px-4 overflow-x-auto shrink-0 hide-scrollbar scroll-smooth">
                    <button onClick={() => setActiveTab('general')} className={`px-4 py-3 font-bold text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${activeTab === 'general' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                        <i className="fas fa-file-alt"></i> Genel Bilgiler
                    </button>
                    <button onClick={() => setActiveTab('floors')} className={`px-4 py-3 font-bold text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${activeTab === 'floors' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                        <i className="fas fa-layer-group"></i> Kat Bilgileri
                    </button>
                    <button onClick={() => setActiveTab('contract')} className={`px-4 py-3 font-bold text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${activeTab === 'contract' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                        <i className="fas fa-file-contract"></i> Sözleşme & Mevcut Yapı
                    </button>
                    <button onClick={() => setActiveTab('special')} className={`px-4 py-3 font-bold text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${activeTab === 'special' ? 'border-blue-500 text-blue-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                        <i className="fas fa-tools"></i> Tesisat & Altyapı
                    </button>
                    {buildingStats.buildingType === 'villa' && (
                        <button onClick={() => setActiveTab('villa_outdoor')} className={`px-4 py-3 font-bold text-xs md:text-sm border-b-2 transition-colors whitespace-nowrap shrink-0 flex items-center gap-2 ${activeTab === 'villa_outdoor' ? 'border-orange-500 text-orange-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}>
                            <i className="fas fa-tree"></i> Villa Detaylar
                        </button>
                    )}
                </div>

                {/* Tab Content */}
                <div className="p-4 md:p-6 overflow-y-auto custom-scrollbar flex-1 bg-slate-900/50">

                    {/* TAB 1: GENEL BİLGİLER */}
                    {activeTab === 'general' && (
                        <div className="max-w-2xl mx-auto space-y-6 animate-fadeIn">
                            <div className="bg-slate-800/50 p-4 md:p-6 rounded-xl border border-slate-700/50 space-y-4">
                                <h4 className="font-bold text-indigo-400 border-b border-indigo-900 pb-2 text-sm md:text-base">Proje Tipi</h4>
                                <div className="flex gap-2 bg-slate-900 p-1.5 rounded-lg border border-slate-700">
                                    <button
                                        onClick={() => handleBuildingTypeChange('apartment')}
                                        className={`flex-1 py-2.5 text-sm font-bold rounded-md transition ${buildingStats.buildingType !== 'villa' ? 'bg-blue-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        <i className="fas fa-building mr-2"></i>Apartman / Çok Katlı
                                    </button>
                                    <button
                                        onClick={() => handleBuildingTypeChange('villa')}
                                        className={`flex-1 py-2.5 text-sm font-bold rounded-md transition ${buildingStats.buildingType === 'villa' ? 'bg-orange-600 text-white shadow-md' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
                                    >
                                        <i className="fas fa-home mr-2"></i>Müstakil Villa
                                    </button>
                                </div>
                            </div>
                            <div className="bg-slate-800/50 p-4 md:p-6 rounded-xl border border-slate-700/50 space-y-4">
                                <h4 className="font-bold text-indigo-400 border-b border-indigo-900 pb-2 text-sm md:text-base">Konum Bilgileri</h4>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                    <div>
                                        <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">İl</label>
                                        <select value={buildingStats.province} onChange={handleProvinceChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500 transition">
                                            {Object.keys(TURKEY_HEAT_MAP).map(prov => (
                                                <option key={prov} value={prov}>{prov}</option>
                                            ))}
                                        </select>
                                    </div>
                                    <div>
                                        <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">İlçe</label>
                                        <select value={buildingStats.district} onChange={handleDistrictChange} className="w-full bg-slate-900 border border-slate-600 rounded-lg p-2.5 text-white text-sm outline-none focus:border-blue-500 transition">
                                            {TURKEY_HEAT_MAP[buildingStats.province]?.districts ?
                                                Object.keys(TURKEY_HEAT_MAP[buildingStats.province].districts).map(dist => (
                                                    <option key={dist} value={dist}>{dist}</option>
                                                )) : <option value="Merkez">Merkez</option>
                                            }
                                        </select>
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/50 p-4 md:p-6 rounded-xl border border-slate-700/50 space-y-4">
                                <h4 className="font-bold text-indigo-400 border-b border-indigo-900 pb-2 text-sm md:text-base">Arsa ve Zemin Bilgileri</h4>

                                <div>
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">Arsa Alanı (m²)</label>
                                    <div className="relative">
                                        <NumericInput
                                            value={buildingStats.landArea}
                                            onChange={(val) => setBuildingStats({ ...buildingStats, landArea: val })}
                                            className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white font-mono text-lg focus:border-blue-500 transition outline-none"
                                        />
                                        <span className="absolute right-4 top-3.5 text-slate-500 font-bold">m²</span>
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">Zemin Sınıfı (Hafriyat İçin)</label>
                                    <select
                                        value={buildingStats.soilType || 'medium'}
                                        onChange={(e) => setBuildingStats({ ...buildingStats, soilType: e.target.value as any })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm outline-none focus:border-blue-500 transition"
                                    >
                                        <option value="soft">Yumuşak Zemin (Nebati Toprak/Kum)</option>
                                        <option value="medium">Orta Sert Zemin (Kil/Kompakt)</option>
                                        <option value="hard">Sert Kaya (Kırıcı Gerektirir)</option>
                                    </select>
                                </div>
                            </div>
                            <div>
                                <div className="flex justify-between items-end mb-1">
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold">Deprem Risk Grubu</label>
                                    {/* Kullanıcı el ile değiştirdiyse "Otomatik Yap" butonu çıkar */}
                                    {buildingStats.isEarthquakeZoneManual && (
                                        <button
                                            onClick={() => setBuildingStats({ ...buildingStats, earthquakeZone: systemEqZone, isEarthquakeZoneManual: false })}
                                            className="text-[9px] text-orange-500 hover:text-orange-400 font-bold transition flex items-center gap-1"
                                            title="İl verisine göre otomatik değere dön"
                                        >
                                            <i className="fas fa-undo"></i> Otomatiğe Dön
                                        </button>
                                    )}
                                </div>

                                <select
                                    value={buildingStats.earthquakeZone || systemEqZone}
                                    onChange={(e) => setBuildingStats({ ...buildingStats, earthquakeZone: parseInt(e.target.value), isEarthquakeZoneManual: true })}
                                    className={`w-full bg-slate-900 border rounded-lg p-3 text-white text-sm outline-none focus:border-blue-500 transition ${buildingStats.isEarthquakeZoneManual ? 'border-orange-500' : 'border-slate-600'}`}
                                >
                                    <option value={1}>1. Derece (Yüksek Risk)</option>
                                    <option value={2}>2. Derece </option>
                                    <option value={3}>3. Derece </option>
                                    <option value={4}>4. Derece ve Altı (Düşük Risk)</option>
                                </select>

                                {!buildingStats.isEarthquakeZoneManual && (
                                    <div className="text-[9px] text-blue-400 mt-1">
                                        <i className="fas fa-info-circle mr-1"></i> {buildingStats.province} iline göre sistem tarafından atandı.
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 2: KAT BİLGİLERİ */}
                    {activeTab === 'floors' && (
                        <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn">
                            {buildingStats.buildingType === 'villa' && (
                                <div className="bg-orange-900/20 border border-orange-500/40 p-3 rounded-lg flex items-start gap-3">
                                    <i className="fas fa-home text-orange-400 mt-0.5 shrink-0"></i>
                                    <div>
                                        <p className="text-orange-300 font-bold text-xs">Villa Modu Aktif</p>
                                        <p className="text-orange-200/70 text-[11px] mt-0.5">Normal kat sayısı en fazla 3 ile sınırlıdır.</p>
                                    </div>
                                </div>
                            )}
                            <div className="flex justify-between items-center bg-slate-800 p-3 rounded-lg border border-slate-700">
                                <span className="text-xs text-slate-400 flex items-center gap-2">
                                    <i className="fas fa-info-circle text-blue-400"></i>
                                    Kat holü alanları daire yoğunluğuna göre otomatik hesaplanır. Değiştirirseniz manuel moda geçer.
                                </span>
                                {(buildingStats.isNormalHallManual || buildingStats.isGroundHallManual || buildingStats.isBasementHallManual) && (
                                    <button
                                        onClick={() => {
                                            updateHallArea('normal', undefined);
                                            updateHallArea('ground', undefined);
                                            updateHallArea('basement', undefined);
                                        }}
                                        className="text-[10px] bg-yellow-600/20 hover:bg-yellow-600 text-yellow-400 hover:text-white px-3 py-1.5 rounded font-bold border border-yellow-600/50 transition"
                                    >
                                        Tümünü Otomatiğe Dön
                                    </button>
                                )}
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
                                {/* Normal Katlar */}
                                <div className="space-y-4 bg-slate-800/30 p-4 md:p-5 rounded-xl border border-slate-700/50 hover:border-blue-500/30 transition">
                                    <h4 className="font-bold text-blue-400 text-sm md:text-base flex items-center justify-between border-b border-blue-900/50 pb-2">
                                        <div className="flex items-center gap-2"><i className="fas fa-building"></i> Normal Katlar</div>
                                        <button onClick={() => handleFetchFromDrawing('normal')} className="text-[10px] bg-blue-900/50 hover:bg-blue-600 text-blue-200 px-2 py-1 rounded transition flex items-center gap-1 font-normal">
                                            <i className="fas fa-drafting-compass"></i> Çizimden Çek
                                        </button>
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                            <input
                                                type="number"
                                                min="1"
                                                max={buildingStats.buildingType === 'villa' ? 3 : undefined}
                                                value={buildingStats.normalFloorCount}
                                                onChange={(e) => {
                                                    const val = parseInt(e.target.value) || 1;
                                                    const maxVal = buildingStats.buildingType === 'villa' ? Math.min(val, 3) : val;
                                                    setBuildingStats({ ...buildingStats, normalFloorCount: maxVal });
                                                }}
                                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
                                            />
                                            {buildingStats.buildingType === 'villa' && (
                                                <p className="text-[10px] text-orange-400 mt-1">Maks. 3 kat</p>
                                            )}                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Yük. (m)</label>
                                            <input type="number" step="0.1" value={buildingStats.normalFloorHeight} onChange={(e) => setBuildingStats({ ...buildingStats, normalFloorHeight: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Kat Alanı (m²)</label>
                                            <input type="number" value={buildingStats.normalFloorArea} onChange={(e) => handleAreaChange('normal', parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Çevre (m)</label>
                                            <div className="relative">
                                                <input type="number" value={buildingStats.normalFloorPerimeter || 0} onChange={(e) => handlePerimeterChange('normal', parseFloat(e.target.value) || 0)} className={`w-full bg-slate-900 border rounded p-2 text-white text-sm font-mono pr-7 ${buildingStats.isNormalPerimeterManual ? 'border-yellow-500' : 'border-slate-600'}`} />
                                                {buildingStats.isNormalPerimeterManual && (
                                                    <button onClick={() => resetPerimeter('normal')} className="absolute right-2 top-2 text-yellow-500 hover:text-yellow-400" title="Kare kabulü ile otomatik hesapla">
                                                        <i className="fas fa-undo text-[10px]"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Hol (m²)</label>
                                            <input
                                                type="number"
                                                value={buildingStats.normalFloorHallArea || 0}
                                                onChange={(e) => updateHallArea('normal', parseFloat(e.target.value))}
                                                disabled={buildingStats.buildingType === 'villa'}
                                                title={buildingStats.buildingType === 'villa' ? 'Müstakil villalarda ortak hol alanı hesaplanmaz.' : ''}
                                                className={`w-full bg-slate-900 border rounded p-2 text-sm font-mono transition ${buildingStats.buildingType === 'villa'
                                                    ? 'border-slate-800 text-slate-600 cursor-not-allowed bg-slate-900/50'
                                                    : buildingStats.isNormalHallManual
                                                        ? 'border-yellow-500 text-white'
                                                        : 'border-slate-600 text-white'
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Zemin Kat */}
                                <div className="space-y-4 bg-slate-800/30 p-4 md:p-5 rounded-xl border border-slate-700/50 hover:border-green-500/30 transition">
                                    <h4 className="font-bold text-green-400 text-sm md:text-base flex items-center justify-between border-b border-green-900/50 pb-2">
                                        <div className="flex items-center gap-2"><i className="fas fa-store"></i> Zemin Kat</div>
                                        <button onClick={() => handleFetchFromDrawing('ground')} className="text-[10px] bg-green-900/50 hover:bg-green-600 text-green-200 px-2 py-1 rounded transition flex items-center gap-1 font-normal">
                                            <i className="fas fa-drafting-compass"></i> Çizimden Çek
                                        </button>
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                            <input type="number" value="1" disabled className="w-full bg-slate-900/50 border border-slate-800 rounded p-2 text-slate-500 cursor-not-allowed text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Yük. (m)</label>
                                            <input type="number" step="0.1" value={buildingStats.groundFloorHeight} onChange={(e) => setBuildingStats({ ...buildingStats, groundFloorHeight: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Kat Alanı (m²)</label>
                                            <input type="number" value={buildingStats.groundFloorArea} onChange={(e) => handleAreaChange('ground', parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Çevre (m)</label>
                                            <div className="relative">
                                                <input type="number" value={buildingStats.groundFloorPerimeter || 0} onChange={(e) => handlePerimeterChange('ground', parseFloat(e.target.value) || 0)} className={`w-full bg-slate-900 border rounded p-2 text-white text-sm font-mono pr-7 ${buildingStats.isGroundPerimeterManual ? 'border-yellow-500' : 'border-slate-600'}`} />
                                                {buildingStats.isGroundPerimeterManual && (
                                                    <button onClick={() => resetPerimeter('ground')} className="absolute right-2 top-2 text-yellow-500 hover:text-yellow-400" title="Kare kabulü ile otomatik hesapla">
                                                        <i className="fas fa-undo text-[10px]"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Giriş/Hol (m²)</label>
                                            <input
                                                type="number"
                                                value={buildingStats.groundFloorHallArea || 0}
                                                onChange={(e) => updateHallArea('ground', parseFloat(e.target.value))}
                                                disabled={buildingStats.buildingType === 'villa'}
                                                title={buildingStats.buildingType === 'villa' ? 'Müstakil villalarda ortak hol alanı hesaplanmaz.' : ''}
                                                className={`w-full bg-slate-900 border rounded p-2 text-sm font-mono transition ${buildingStats.buildingType === 'villa'
                                                    ? 'border-slate-800 text-slate-600 cursor-not-allowed bg-slate-900/50'
                                                    : buildingStats.isGroundHallManual
                                                        ? 'border-yellow-500 text-white'
                                                        : 'border-slate-600 text-white'
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Bodrum Katlar */}
                                <div className="space-y-4 bg-slate-800/30 p-4 md:p-5 rounded-xl border border-slate-700/50 hover:border-orange-500/30 transition">
                                    <h4 className="font-bold text-orange-400 text-sm md:text-base flex items-center justify-between border-b border-orange-900/50 pb-2">
                                        <div className="flex items-center gap-2"><i className="fas fa-level-down-alt"></i> Bodrum Katlar</div>
                                        <button onClick={() => handleFetchFromDrawing('basement')} className="text-[10px] bg-orange-900/50 hover:bg-orange-600 text-orange-200 px-2 py-1 rounded transition flex items-center gap-1 font-normal">
                                            <i className="fas fa-drafting-compass"></i> Çizimden Çek
                                        </button>
                                    </h4>
                                    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                            <input type="number" min="0" value={buildingStats.basementFloorCount} onChange={(e) => setBuildingStats({ ...buildingStats, basementFloorCount: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Yük. (m)</label>
                                            <input type="number" step="0.1" value={buildingStats.basementFloorHeight} onChange={(e) => setBuildingStats({ ...buildingStats, basementFloorHeight: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Kat Alanı (m²)</label>
                                            <input type="number" value={buildingStats.basementFloorArea} onChange={(e) => handleAreaChange('basement', parseFloat(e.target.value) || 0)} className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Çevre (m)</label>
                                            <div className="relative">
                                                <input type="number" value={buildingStats.basementFloorPerimeter || 0} onChange={(e) => handlePerimeterChange('basement', parseFloat(e.target.value) || 0)} className={`w-full bg-slate-900 border rounded p-2 text-white text-sm font-mono pr-7 ${buildingStats.isBasementPerimeterManual ? 'border-yellow-500' : 'border-slate-600'}`} />
                                                {buildingStats.isBasementPerimeterManual && (
                                                    <button onClick={() => resetPerimeter('basement')} className="absolute right-2 top-2 text-yellow-500 hover:text-yellow-400" title="Kare kabulü ile otomatik hesapla">
                                                        <i className="fas fa-undo text-[10px]"></i>
                                                    </button>
                                                )}
                                            </div>
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Hol (m²)</label>
                                            <input
                                                type="number"
                                                value={buildingStats.basementFloorHallArea || 0}
                                                onChange={(e) => updateHallArea('basement', parseFloat(e.target.value))}
                                                disabled={buildingStats.buildingType === 'villa'}
                                                title={buildingStats.buildingType === 'villa' ? 'Müstakil villalarda ortak hol alanı hesaplanmaz.' : ''}
                                                className={`w-full bg-slate-900 border rounded p-2 text-sm font-mono transition ${buildingStats.buildingType === 'villa'
                                                    ? 'border-slate-800 text-slate-600 cursor-not-allowed bg-slate-900/50'
                                                    : buildingStats.isBasementHallManual
                                                        ? 'border-yellow-500 text-white'
                                                        : 'border-slate-600 text-white'
                                                    }`}
                                            />
                                        </div>
                                    </div>
                                </div>
                                {/* Çatı Katı (Dubleks / Piyes) */}
                                <div className="space-y-4 bg-slate-800/30 p-4 md:p-5 rounded-xl border border-slate-700/50 hover:border-purple-500/30 transition">
                                    <h4 className="font-bold text-purple-400 text-sm md:text-base flex items-center justify-between border-b border-purple-900/50 pb-2">
                                        <label className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={buildingStats.hasRoofFloor || false}
                                                onChange={(e) => {
                                                    const isChecked = e.target.checked;
                                                    if (isChecked) {
                                                        // Checkbox işaretlendiğinde varsayılan değerleri Normal Kat'tan alarak doldur
                                                        const defaultArea = buildingStats.normalFloorArea || 0;
                                                        const defaultPerimeter = parseFloat((Math.sqrt(defaultArea) * 4).toFixed(2));

                                                        setBuildingStats({
                                                            ...buildingStats,
                                                            hasRoofFloor: true,
                                                            roofFloorMaxHeight: 3.0, // Varsayılan Tepe Yüksekliği
                                                            roofFloorHeight: 1.8,    // Varsayılan Ort. Yükseklik (3.0 * 0.6)
                                                            roofFloorArea: defaultArea, // Normal kat alanını referans al
                                                            roofFloorPerimeter: defaultPerimeter,
                                                            isRoofHeightManual: false,
                                                            isRoofPerimeterManual: false
                                                        });
                                                    } else {
                                                        // İşaret kaldırıldığında sadece durumu kapat
                                                        setBuildingStats({ ...buildingStats, hasRoofFloor: false });
                                                    }
                                                }}
                                                className="w-4 h-4 accent-purple-500 rounded cursor-pointer"
                                            />
                                            <i className="fas fa-home"></i> Çatı Katı (Piyes)
                                        </label>
                                    </h4>

                                    {buildingStats.hasRoofFloor && (
                                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 animate-fadeIn">
                                            {/* 1. Tepe Yükseklik */}
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-bold block mb-1">Tepe Yükseklik (m)</label>
                                                <input
                                                    type="number"
                                                    step="0.1"
                                                    value={buildingStats.roofFloorMaxHeight || ''}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setBuildingStats({
                                                            ...buildingStats,
                                                            roofFloorMaxHeight: val,
                                                            // Eğer kullanıcı ort. yüksekliğe elle müdahale etmediyse otomatik 0.60 katını yazdır
                                                            ...(!buildingStats.isRoofHeightManual ? { roofFloorHeight: parseFloat((val * 0.6).toFixed(2)) } : {})
                                                        });
                                                    }}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
                                                    placeholder="Örn: 3.0"
                                                />
                                            </div>

                                            {/* 2. Ort. Yükseklik */}
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-bold block mb-1">Ort. Yükseklik (m)</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        step="0.1"
                                                        value={buildingStats.roofFloorHeight || ''}
                                                        onChange={(e) => setBuildingStats({ ...buildingStats, roofFloorHeight: parseFloat(e.target.value) || 0, isRoofHeightManual: true })}
                                                        className={`w-full bg-slate-900 border rounded p-2 text-white text-sm pr-7 ${buildingStats.isRoofHeightManual ? 'border-yellow-500' : 'border-slate-600'}`}
                                                        placeholder="Örn: 1.8"
                                                    />
                                                    {buildingStats.isRoofHeightManual && (
                                                        <button
                                                            onClick={() => setBuildingStats({ ...buildingStats, isRoofHeightManual: false, roofFloorHeight: parseFloat(((buildingStats.roofFloorMaxHeight || 0) * 0.6).toFixed(2)) })}
                                                            className="absolute right-2 top-2 text-yellow-500 hover:text-yellow-400"
                                                            title="Tepe yüksekliğine göre otomatik hesapla"
                                                        >
                                                            <i className="fas fa-undo text-[10px]"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>

                                            {/* 3. Kat Alanı */}
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-bold block mb-1">Kat Alanı (m²)</label>
                                                <input
                                                    type="number"
                                                    value={buildingStats.roofFloorArea || ''}
                                                    onChange={(e) => {
                                                        const val = parseFloat(e.target.value) || 0;
                                                        setBuildingStats({
                                                            ...buildingStats,
                                                            roofFloorArea: val,
                                                            ...(!buildingStats.isRoofPerimeterManual ? { roofFloorPerimeter: parseFloat((Math.sqrt(val) * 4).toFixed(2)) } : {})
                                                        });
                                                    }}
                                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono"
                                                />
                                            </div>

                                            {/* 4. Çevre */}
                                            <div>
                                                <label className="text-[10px] text-slate-400 font-bold block mb-1">Çevre (m)</label>
                                                <div className="relative">
                                                    <input
                                                        type="number"
                                                        value={buildingStats.roofFloorPerimeter || 0}
                                                        onChange={(e) => setBuildingStats({ ...buildingStats, roofFloorPerimeter: parseFloat(e.target.value) || 0, isRoofPerimeterManual: true })}
                                                        className={`w-full bg-slate-900 border rounded p-2 text-white text-sm font-mono pr-7 ${buildingStats.isRoofPerimeterManual ? 'border-yellow-500' : 'border-slate-600'}`}
                                                    />
                                                    {buildingStats.isRoofPerimeterManual && (
                                                        <button
                                                            onClick={() => setBuildingStats({ ...buildingStats, isRoofPerimeterManual: false, roofFloorPerimeter: parseFloat((Math.sqrt(buildingStats.roofFloorArea || 0) * 4).toFixed(2)) })}
                                                            className="absolute right-2 top-2 text-yellow-500 hover:text-yellow-400"
                                                            title="Kare kabulü ile otomatik hesapla"
                                                        >
                                                            <i className="fas fa-undo text-[10px]"></i>
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    )}



                    {/* YENİ: TAB 3: SÖZLEŞME VE MEVCUT YAPI (Model, Kentsel Dönüşüm, Yıkım, Kira) */}
                    {activeTab === 'contract' && (
                        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">

                            {/* İnşaat Modeli */}
                            <div className="bg-slate-800/40 p-4 md:p-6 rounded-xl border border-slate-700/50">
                                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded bg-blue-500/20 text-blue-400 flex items-center justify-center"><i className="fas fa-handshake"></i></div>
                                    Proje İş Modeli
                                </h4>
                                <div>
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">İnşaat Yapım Modeli</label>
                                    <select
                                        value={buildingStats.constructionModel || 'standard'}
                                        onChange={(e) => setBuildingStats({ ...buildingStats, constructionModel: e.target.value as any })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm outline-none focus:border-blue-500 transition"
                                    >
                                        <option value="standard">Kendi Arsana Yap / Taahhüt (Standart Model)</option>
                                        <option value="kat_karsiligi">Kat Karşılığı (Müteahhitlik Modeli)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Mevcut Yapı ve Kentsel Dönüşüm (Yıkılacak Bina Kontrolü) */}
                            <div className="bg-slate-800/40 p-4 md:p-6 rounded-xl border border-slate-700/50">
                                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded bg-red-500/20 text-red-400 flex items-center justify-center"><i className="fas fa-building-circle-exclamation"></i></div>
                                    Mevcut Yapı & Kentsel Dönüşüm
                                </h4>

                                <label className={`flex items-start gap-3 p-4 rounded-lg transition-colors border cursor-pointer mb-4 ${buildingStats.hasExistingBuilding ? 'bg-orange-900/20 border-orange-600/50' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                                    <div className="relative flex items-center pt-1">
                                        <input
                                            type="checkbox"
                                            checked={buildingStats.hasExistingBuilding || false}
                                            onChange={(e) => {
                                                const checked = e.target.checked;
                                                setBuildingStats({
                                                    ...buildingStats,
                                                    hasExistingBuilding: checked,
                                                    // Eğer yıkılacak bina yok olarak işaretlenirse, kentsel dönüşüm tikini de kaldır.
                                                    isUrbanTransformation: checked ? buildingStats.isUrbanTransformation : false
                                                });
                                            }}
                                            className="w-5 h-5 accent-orange-500 rounded cursor-pointer"
                                        />
                                    </div>
                                    <div className="flex-1">
                                        <span className="text-sm font-bold text-white block mb-1">Arsada Yıkılacak Mevcut Bina Var Mı?</span>
                                        <span className="text-xs text-slate-400 block leading-relaxed">İnşaata başlamadan önce eski bir yapının yıkılması gerekiyorsa işaretleyin.</span>
                                    </div>
                                </label>

                                {/* Yıkılacak bina varsa Alanı ve Kentsel Dönüşüm seçenekleri açılır */}
                                {buildingStats.hasExistingBuilding && (
                                    <div className="space-y-4 ml-2 border-l-2 border-slate-700 pl-4 animate-fadeIn">
                                        <div>
                                            <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-2">Yıkılacak Mevcut Yapı Alanı (m²)</label>
                                            <input
                                                type="number"
                                                value={buildingStats.existingArea || ''}
                                                onChange={(e) => setBuildingStats({ ...buildingStats, existingArea: parseFloat(e.target.value) || 0 })}
                                                className="w-48 bg-slate-900 border border-slate-600 rounded p-2.5 text-white text-sm outline-none focus:border-orange-500"
                                                placeholder="Örn: 500"
                                            />
                                        </div>

                                        <label className={`flex items-start gap-3 p-4 rounded-lg transition-colors border cursor-pointer ${buildingStats.isUrbanTransformation ? 'bg-green-900/20 border-green-600/50' : 'bg-slate-900 border-slate-700 hover:border-slate-500'}`}>
                                            <div className="relative flex items-center pt-1">
                                                <input
                                                    type="checkbox"
                                                    checked={buildingStats.isUrbanTransformation || false}
                                                    onChange={(e) => setBuildingStats({ ...buildingStats, isUrbanTransformation: e.target.checked })}
                                                    className="w-5 h-5 accent-green-500 rounded cursor-pointer"
                                                />
                                            </div>
                                            <div className="flex-1">
                                                <span className="text-sm font-bold text-white block mb-1">Kentsel Dönüşüm (Riskli Yapı) Kapsamında Mı?</span>
                                                <span className="text-xs text-slate-400 block leading-relaxed">Riskli yapı raporu varsa işaretleyin. Harç muafiyetleri uygulanacak ve sadece Yıkım Teknik Sorumlusu bedeli yansıtılacaktır.</span>
                                            </div>
                                        </label>
                                    </div>
                                )}

                                {!buildingStats.isUrbanTransformation && buildingStats.constructionModel === 'kat_karsiligi' && (
                                    <div className="mt-4 bg-yellow-900/20 border border-yellow-600/30 p-3 rounded-lg flex gap-3 items-start animate-fadeIn">
                                        <i className="fas fa-info-circle text-yellow-500 mt-0.5"></i>
                                        <p className="text-xs text-yellow-200/90 leading-relaxed">
                                            <strong>Uyarı:</strong> Kentsel dönüşüm olmadığı için "Kat Karşılığı İnşaat Sözleşmesi" kaynaklı Noter (binde 11.38 Damga Vergisi vb.) ve Tapu harçları maliyete tam yansıtılacaktır.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Kira ve Tahliye Masrafları */}
                            <div className="bg-slate-800/40 p-4 md:p-6 rounded-xl border border-slate-700/50">
                                <label className="flex items-center gap-3 cursor-pointer mb-4">
                                    <input
                                        type="checkbox"
                                        checked={buildingStats.includeRentCost || false}
                                        onChange={(e) => setBuildingStats({ ...buildingStats, includeRentCost: e.target.checked })}
                                        className="w-5 h-5 accent-yellow-500 rounded cursor-pointer"
                                    />
                                    <div>
                                        <span className="text-sm font-bold text-white flex items-center gap-2">
                                            <i className="fas fa-house-user text-yellow-500"></i>
                                            Kira ve Tahliye Masraflarını Projeye Dahil Et
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-1 block">Hak sahiplerine ödenecek tahliye ve kira bedelleri.</span>
                                    </div>
                                </label>

                                {buildingStats.includeRentCost && (
                                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4 border-t border-slate-700 animate-fadeIn">
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Mevcut Daire Sayısı</label>
                                            <input type="number" value={buildingStats.existingUnitCount || ''} onChange={(e) => setBuildingStats({ ...buildingStats, existingUnitCount: parseInt(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 text-white text-sm outline-none focus:border-yellow-500" placeholder="Adet" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Aylık Kira Yardımı (TL)</label>
                                            <input type="number" value={buildingStats.monthlyRentPerUnit || ''} onChange={(e) => setBuildingStats({ ...buildingStats, monthlyRentPerUnit: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 text-white text-sm outline-none focus:border-yellow-500" placeholder="Daire başı" />
                                        </div>
                                        <div>
                                            <label className="text-[10px] text-slate-400 font-bold block mb-1">Taşınma Yardımı (TL)</label>
                                            <input type="number" value={buildingStats.evictionCostPerUnit || ''} onChange={(e) => setBuildingStats({ ...buildingStats, evictionCostPerUnit: parseFloat(e.target.value) || 0 })} className="w-full bg-slate-900 border border-slate-600 rounded p-2.5 text-white text-sm outline-none focus:border-yellow-500" placeholder="Tek seferlik" />
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}

                    {/* TAB 4: TESİSAT VE ALTYAPI (Kuyu Temel ve Isıtma) */}
                    {activeTab === 'special' && (
                        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">

                            {/* Tesisat Tercihleri */}
                            <div className="bg-slate-800/40 p-4 md:p-6 rounded-xl border border-slate-700/50">
                                <h4 className="font-bold text-white mb-4 flex items-center gap-2">
                                    <div className="w-8 h-8 rounded bg-red-500/20 text-red-400 flex items-center justify-center"><i className="fas fa-fire"></i></div>
                                    Tesisat Tercihleri
                                </h4>
                                <div>
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">Isıtma Sistemi Tercihi</label>
                                    <select
                                        value={buildingStats.heatingSystem || 'radiator'}
                                        onChange={(e) => setBuildingStats({ ...buildingStats, heatingSystem: e.target.value as any })}
                                        className="w-full bg-slate-900 border border-slate-600 rounded-lg p-3 text-white text-sm outline-none focus:border-blue-500 transition"
                                    >
                                        <option value="radiator">Panel Radyatör (Kombi + Petek)</option>
                                        <option value="underfloor">Yerden Isıtma (Kombi + Kollektör)</option>
                                        <option value="heat_pump">Isı Pompası (Hava Kaynaklı + Yerden Isıtma)</option>
                                        <option value="vrf">VRF İklimlendirme (Merkezi Sistem / Kaset Tipi)</option>
                                    </select>
                                </div>
                            </div>

                            {/* Kuyu Temel */}
                            <div className="bg-slate-800/40 p-4 md:p-6 rounded-xl border border-slate-700/50">
                                <label className="flex items-center gap-3 cursor-pointer mb-4">
                                    <input
                                        type="checkbox"
                                        checked={buildingStats.hasWellFoundation || false}
                                        onChange={(e) => setBuildingStats({ ...buildingStats, hasWellFoundation: e.target.checked })}
                                        className="w-5 h-5 accent-red-500 rounded cursor-pointer"
                                    />
                                    <div>
                                        <span className="text-sm font-bold text-white flex items-center gap-2">
                                            <i className="fas fa-layer-group text-orange-400"></i>
                                            Kuyu Temel / Derin İksa Sistemi Gerekli Mi?
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-1 block">Bitişik nizam veya derin kazılarda toprak kaymasını önlemek için uygulanır.</span>
                                    </div>
                                </label>

                                {buildingStats.hasWellFoundation && (
                                    <div className="pt-4 border-t border-slate-700 animate-fadeIn">
                                        <label className="text-[10px] text-slate-400 font-bold block mb-2">Toplam Kuyu Temel Yüzey Alanı (m²)</label>
                                        <div className="flex flex-col sm:flex-row gap-4">
                                            <input
                                                type="number"
                                                value={buildingStats.wellFoundationArea || ''}
                                                onChange={(e) => setBuildingStats({ ...buildingStats, wellFoundationArea: parseFloat(e.target.value) || 0 })}
                                                className="w-full sm:w-64 bg-slate-900 border border-slate-600 rounded p-2.5 text-white text-sm outline-none focus:border-red-500"
                                                placeholder="Örn: 250"
                                            />
                                            <div className="text-xs text-slate-400 flex-1 flex items-center bg-slate-900/50 p-2 rounded">
                                                <i className="fas fa-info-circle text-blue-400 mr-2"></i>
                                                Boş bırakılırsa (Bodrum Derinliği x Arsa Çevresinin Yarısı) olarak otomatik hesaplanır.
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>

                        </div>
                    )}

                    {activeTab === 'villa_outdoor' && buildingStats.buildingType === 'villa' && (
                        <div className="max-w-3xl mx-auto space-y-6 animate-fadeIn">
                            <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl">
                                <h4 className="font-bold text-white flex items-center gap-2 mb-2">
                                    <i className="fas fa-layer-group text-yellow-500"></i> Subasman Yüksekliği
                                </h4>
                                <p className="text-xs text-slate-400 mb-4">Bodrumsuz yapılarda evi topraktan koparmak için yapılacak çevre perdesi ve zemin dolgusu yüksekliği (Varsayılan: 50 cm).</p>

                                <div>
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">Yükseklik (cm)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={buildingStats.subasmanHeight !== undefined ? buildingStats.subasmanHeight * 100 : 50}
                                            onChange={(e) => {
                                                const valCm = parseFloat(e.target.value) || 0;
                                                setBuildingStats({ ...buildingStats, subasmanHeight: valCm / 100 });
                                            }}
                                            className="w-full sm:w-64 bg-slate-900 border border-slate-600 rounded p-3 text-white font-mono focus:border-yellow-500 transition outline-none"
                                            placeholder="Örn: 50"
                                        />
                                        <span className="absolute left-[220px] top-3.5 text-slate-500 font-bold hidden sm:block">cm</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-orange-900/20 border border-orange-500/30 p-4 rounded-xl">
                                <h4 className="font-bold text-orange-400 flex items-center gap-2 mb-2">
                                    <i className="fas fa-swimming-pool"></i> Havuz ve Su Donatıları
                                </h4>
                                <p className="text-xs text-orange-200/70 mb-4">Açık yüzme havuzu imalatı (hafriyat, yalıtım, betonarme ve mekanik tesisat sistemi) metrajını belirleyin.</p>

                                <div>
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">Havuz Yüzey Alanı (m²)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={buildingStats.poolArea || ''}
                                            onChange={(e) => setBuildingStats({ ...buildingStats, poolArea: parseFloat(e.target.value) || 0 })}
                                            className="w-full sm:w-64 bg-slate-900 border border-slate-600 rounded p-3 text-white font-mono focus:border-orange-500 transition outline-none"
                                            placeholder="Örn: 30"
                                        />
                                        <span className="absolute left-[220px] top-3.5 text-slate-500 font-bold hidden sm:block">m²</span>
                                    </div>
                                </div>
                            </div>
                            <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl">
                                <label className="flex items-center gap-3 cursor-pointer mb-4">
                                    <input
                                        type="checkbox"
                                        checked={buildingStats.hasSmartHome || false}
                                        onChange={(e) => setBuildingStats({ ...buildingStats, hasSmartHome: e.target.checked })}
                                        className="w-5 h-5 accent-blue-500 rounded cursor-pointer"
                                    />
                                    <div>
                                        <span className="text-sm font-bold text-white flex items-center gap-2">
                                            <i className="fas fa-microchip text-blue-400"></i>
                                            Akıllı Ev ve Otomasyon Sistemi
                                        </span>
                                        <span className="text-[10px] text-slate-400 mt-1 block">KNX veya muadili otomasyon altyapısı ve modül seçimleri.</span>
                                    </div>
                                </label>

                                {buildingStats.hasSmartHome && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-700 animate-fadeIn pl-2 sm:pl-8">
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white transition">
                                            <input type="checkbox" checked={buildingStats.smartHomeLighting || false} onChange={(e) => setBuildingStats({ ...buildingStats, smartHomeLighting: e.target.checked })} className="w-4 h-4 accent-blue-500" />
                                            Aydınlatma Kontrolü (Aç/Kapa & Dimmer)
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white transition">
                                            <input type="checkbox" checked={buildingStats.smartHomeHeating || false} onChange={(e) => setBuildingStats({ ...buildingStats, smartHomeHeating: e.target.checked })} className="w-4 h-4 accent-red-500" />
                                            Isıtma & İklimlendirme Kontrolü
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white transition">
                                            <input type="checkbox" checked={buildingStats.smartHomeSensors || false} onChange={(e) => setBuildingStats({ ...buildingStats, smartHomeSensors: e.target.checked })} className="w-4 h-4 accent-teal-500" />
                                            Su Basma & Gaz Sensörleri (+Kesici Valf)
                                        </label>
                                        <label className="flex items-center gap-2 cursor-pointer text-sm text-slate-300 hover:text-white transition">
                                            <input type="checkbox" checked={buildingStats.smartHomeBlinds || false} onChange={(e) => setBuildingStats({ ...buildingStats, smartHomeBlinds: e.target.checked })} className="w-4 h-4 accent-yellow-500" />
                                            Elektrikli Panjur / Perde Kontrolü
                                        </label>
                                    </div>
                                )}
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl">
                                <h4 className="font-bold text-white flex items-center gap-2 mb-2">
                                    <i className="fas fa-car-side text-blue-400"></i> Açık Otopark & Yürüyüş Yolları
                                </h4>
                                <p className="text-xs text-slate-400 mb-4">Üstü pergole ile kapalı otopark alanları ve sert zemin kaplamalarını girin.</p>

                                <div>
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">Otopark ve Zemin Alanı (m²)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={buildingStats.parkingArea || ''}
                                            onChange={(e) => setBuildingStats({ ...buildingStats, parkingArea: parseFloat(e.target.value) || 0 })}
                                            className="w-full sm:w-64 bg-slate-900 border border-slate-600 rounded p-3 text-white font-mono focus:border-blue-500 transition outline-none"
                                            placeholder="Örn: 40"
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-slate-800/40 border border-slate-700/50 p-4 rounded-xl">
                                <h4 className="font-bold text-white flex items-center gap-2 mb-2">
                                    <i className="fas fa-campground text-green-400"></i> Kış Bahçesi / Veranda
                                </h4>
                                <p className="text-xs text-slate-400 mb-4">Ahşap/çelik konstrüksiyonlu ekstra kapalı veya yarı açık yaşam alanları.</p>

                                <div>
                                    <label className="text-[10px] md:text-xs text-slate-400 font-bold block mb-1">Veranda Alanı (m²)</label>
                                    <div className="relative">
                                        <input
                                            type="number"
                                            value={buildingStats.verandaArea || ''}
                                            onChange={(e) => setBuildingStats({ ...buildingStats, verandaArea: parseFloat(e.target.value) || 0 })}
                                            className="w-full sm:w-64 bg-slate-900 border border-slate-600 rounded p-3 text-white font-mono focus:border-green-500 transition outline-none"
                                            placeholder="Örn: 25"
                                        />
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                </div>

                {/* Footer */}
                <div className="p-4 border-t border-slate-700 bg-slate-800 flex justify-end shrink-0">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-2.5 rounded-lg font-bold shadow-lg shadow-blue-500/20 transition-transform active:scale-95 text-sm md:text-base">Tamam</button>
                </div>
            </div>
        </div>
    );
};