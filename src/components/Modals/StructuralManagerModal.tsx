import React, { useState, useMemo } from 'react'; // useMemo eklendi
import { UnitType, Wall, Column, Beam, Slab } from '../../types';
import { useProjectStore } from '../../stores/projectStore';
import { NumericInput } from '../Shared/NumericInput';

interface StructuralManagerModalProps {
    unit: UnitType;
    onClose: () => void;
    onUpdateUnit: (updatedUnit: UnitType) => void;
}

export const StructuralManagerModal: React.FC<StructuralManagerModalProps> = ({ unit, onClose, onUpdateUnit }) => {
   const { globalWallMaterial, units: archUnits } = useProjectStore(); 
    const [activeTab, setActiveTab] = useState<'wall' | 'column' | 'beam' | 'slab'>('wall');
    
    const { deductions, totalDeduction } = useMemo(() => {
        const deds: Record<string, number> = { '10': 0, '13.5': 0, '15': 0, '20': 0, '25': 0 };
        archUnits.forEach(u => {
            u.rooms.forEach(r => {
                const wArea = r.properties.windowArea || 0;
                const wThick = r.properties.windowWallThickness || 15;
                const wKey = wThick <= 10 ? '10' : wThick <= 13.5 ? '13.5' : wThick <= 15 ? '15' : wThick <= 20 ? '20' : '25';
                deds[wKey] += (wArea * u.count);

                const dArea = (r.properties.doorCount || 0) * 1.89;
                const dThick = r.properties.doorWallThickness || 15;
                const dKey = dThick <= 10 ? '10' : dThick <= 13.5 ? '13.5' : dThick <= 15 ? '15' : dThick <= 20 ? '20' : '25';
                deds[dKey] += (dArea * u.count);
            });
        });
        const total = Object.values(deds).reduce((sum, val) => sum + val, 0);
        return { deductions: deds, totalDeduction: total };
    }, [archUnits]);

    // --- FORM STATES ---
    const [wallForm, setWallForm] = useState<{ len: number, thick: number, height: number }>({ len: 5, thick: 15, height: 0 });
    const [colForm, setColForm] = useState<{ w: number, d: number, h: number, count: number }>({ w: 30, d: 60, h: 0, count: 1 });
    const [beamForm, setBeamForm] = useState<{ w: number, h: number, len: number, count: number, slabThick: number }>({ w: 25, h: 50, len: 4, count: 1, slabThick: 15 });
    const [slabForm, setSlabForm] = useState<{ area: number, thick: number, type: 'plak' | 'asmolen' | 'mantar', count: number }>({ area: 20, thick: 15, type: 'plak', count: 1 });

    const isWallAuto = unit.structuralWallSource === 'global_calculated';
    const isConcreteAuto = unit.structuralConcreteSource === 'global_calculated';

    const handleAddWall = () => {
        const newWall: Wall = {
            id: Date.now().toString(),
            startPoint: { x: 0, y: 0 }, endPoint: { x: 0, y: 0 }, // Dummy points
            length_px: 0,
            manualLengthM: wallForm.len,
            properties: {
                material: 'gazbeton',
                thickness: wallForm.thick,
                height: wallForm.height > 0 ? wallForm.height : undefined,
                isUnderBeam: false,
                beamHeight: 0
            }
        };
        // Auto-switch to detailed mode for walls when adding a wall
        onUpdateUnit({
            ...unit,
            walls: [...unit.walls, newWall],
            structuralWallSource: 'detailed_unit'
        });
    };

    const handleAddColumn = () => {
        const newCols: Column[] = [];
        for (let i = 0; i < colForm.count; i++) {
            const areaM2 = (colForm.w / 100) * (colForm.d / 100);
            const perimM = 2 * ((colForm.w / 100) + (colForm.d / 100));
            newCols.push({
                id: Date.now().toString() + i,
                points: [],
                area_px: 0, perimeter_px: 0,
                manualAreaM2: areaM2,
                manualPerimeterM: perimM,
                properties: {
                    type: 'kolon',
                    height: colForm.h > 0 ? colForm.h : undefined, // Auto if 0
                    connectingBeamHeight: 0
                }
            });
        }
        // Auto-switch to detailed mode for concrete when adding a column
        onUpdateUnit({
            ...unit,
            columns: [...unit.columns, ...newCols],
            structuralConcreteSource: 'detailed_unit'
        });
    };

    const handleAddBeam = () => {
        const newBeams: Beam[] = [];
        for (let i = 0; i < beamForm.count; i++) {
            newBeams.push({
                id: Date.now().toString() + i,
                startPoint: { x: 0, y: 0 }, endPoint: { x: 0, y: 0 },
                length_px: 0,
                manualLengthM: beamForm.len,
                properties: { width: beamForm.w, height: beamForm.h, slabThickness: beamForm.slabThick } // YENİ
            });
        }
        onUpdateUnit({
            ...unit,
            beams: [...unit.beams, ...newBeams],
            structuralConcreteSource: 'detailed_unit'
        });
    };

    const handleAddSlab = () => {
        const newSlabs: Slab[] = [];
        for (let i = 0; i < slabForm.count; i++) {
            newSlabs.push({
                id: Date.now().toString() + i,
                manualAreaM2: slabForm.area,
                properties: { type: slabForm.type, thickness: slabForm.thick }
            });
        }
        onUpdateUnit({
            ...unit,
            slabs: [...(unit.slabs || []), ...newSlabs],
            structuralConcreteSource: 'detailed_unit'
        });
    };

    const handleDelete = (type: 'wall' | 'column' | 'beam' | 'slab', id: string) => {
        // TypeScript hatasını önlemek için else-if yapısı kullanıldı
        if (type === 'wall') {
            onUpdateUnit({ ...unit, walls: unit.walls.filter(w => w.id !== id) });
        } else if (type === 'column') {
            onUpdateUnit({ ...unit, columns: unit.columns.filter(c => c.id !== id) });
        } else if (type === 'beam') {
            onUpdateUnit({ ...unit, beams: unit.beams.filter(b => b.id !== id) });
        } else if (type === 'slab') {
            onUpdateUnit({ ...unit, slabs: (unit.slabs || []).filter(s => s.id !== id) });
        }
    };

return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-2 md:p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-[95vw] md:max-w-4xl flex flex-col h-[90vh]">
                <div className="p-3 md:p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50">
                    <div>
                        <h3 className="text-white font-bold text-base md:text-lg">{unit.name} - Yapısal Detaylar</h3>
                        <p className="text-[10px] md:text-xs text-slate-400">Çizimden bağımsız manuel eleman ekleme ve düzenleme paneli</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><i className="fas fa-times text-lg md:text-xl"></i></button>
                </div>

                {/* WARNING BANNER FOR AUTO MODE */}
                {(isWallAuto || isConcreteAuto) && (
                    <div className="bg-yellow-900/40 border-b border-yellow-600/30 p-2 md:p-3 px-3 md:px-6 flex items-start gap-3 animate-fadeIn">
                        <i className="fas fa-exclamation-triangle text-yellow-500 mt-0.5 text-base md:text-lg"></i>
                        <div className="text-[10px] md:text-xs text-yellow-200/90">
                            <strong className="block text-yellow-100 mb-1">DİKKAT: Otomatik Hesaplama Modu Aktif</strong>
                            <ul className="list-disc pl-4 space-y-0.5">
                                {isWallAuto && <li>Duvar metrajı şu an <b>Otomatik (m² bazlı)</b> hesaplanıyor. Eklediğinizde "Detaylı" moda geçilecektir.</li>}
                                {isConcreteAuto && <li>Betonarme metrajı şu an <b>Otomatik (m² bazlı)</b> hesaplanıyor. Eklediğinizde "Detaylı" moda geçilecektir.</li>}
                            </ul>
                        </div>
                    </div>
                )}

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    {/* Sidebar Tabs */}
                    <div className="w-full md:w-48 bg-slate-900 border-b md:border-b-0 md:border-r border-slate-800 flex flex-row md:flex-col overflow-x-auto shrink-0">
                        <button onClick={() => setActiveTab('wall')} className={`flex-1 md:flex-none p-3 md:p-4 text-center md:text-left font-bold text-xs md:text-sm border-b-2 md:border-b-0 md:border-l-4 transition whitespace-nowrap ${activeTab === 'wall' ? 'bg-slate-800 border-yellow-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            <i className="fas fa-th-large md:w-6 mr-1 md:mr-0"></i> Duvarlar
                            <span className="ml-2 bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">{unit.walls.length}</span>
                        </button>
                        <button onClick={() => setActiveTab('column')} className={`flex-1 md:flex-none p-3 md:p-4 text-center md:text-left font-bold text-xs md:text-sm border-b-2 md:border-b-0 md:border-l-4 transition whitespace-nowrap ${activeTab === 'column' ? 'bg-slate-800 border-red-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            <i className="fas fa-square md:w-6 mr-1 md:mr-0"></i> Kolonlar
                            <span className="ml-2 bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">{unit.columns.length}</span>
                        </button>
                        <button onClick={() => setActiveTab('beam')} className={`flex-1 md:flex-none p-3 md:p-4 text-center md:text-left font-bold text-xs md:text-sm border-b-2 md:border-b-0 md:border-l-4 transition whitespace-nowrap ${activeTab === 'beam' ? 'bg-slate-800 border-blue-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            <i className="fas fa-grip-lines md:w-6 mr-1 md:mr-0"></i> Kirişler
                            <span className="ml-2 bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">{unit.beams.length}</span>
                        </button>
                        <button onClick={() => setActiveTab('slab')} className={`flex-1 md:flex-none p-3 md:p-4 text-center md:text-left font-bold text-xs md:text-sm border-b-2 md:border-b-0 md:border-l-4 transition whitespace-nowrap ${activeTab === 'slab' ? 'bg-slate-800 border-purple-500 text-white' : 'border-transparent text-slate-500 hover:text-slate-300'}`}>
                            <i className="fas fa-layer-group md:w-6 mr-1 md:mr-0"></i> Döşemeler
                            <span className="ml-2 bg-slate-700 px-1.5 py-0.5 rounded text-[10px] text-white">{(unit.slabs || []).length}</span>
                        </button>
                    </div>

                    {/* Content Area */}
                    <div className="flex-1 flex flex-col bg-slate-800/20 overflow-hidden">
                        {/* Input Area */}
                       
                           <div className="p-3 md:p-4 bg-slate-800 border-b border-slate-700 shrink-0">
                                
                                {activeTab === 'wall' && (
                                    /* BÜTÜN DUVAR SEKMESİNİ KAPSAYAN YENİ DİKEY (FLEX-COL) KUTU */
                                    <div className="flex flex-col gap-4">
                                        
                                        {/* 1. YENİ EKLENEN KISIM: Kapı/Pencere Düşüm Bilgi Kutusu */}
                                        {totalDeduction > 0 && (
                                            <div className="bg-blue-900/20 border border-blue-800/50 rounded-lg p-3">
                                                <h4 className="text-[11px] font-bold text-blue-400 mb-2 uppercase flex items-center">
                                                    <i className="fas fa-info-circle mr-2"></i> Mimari Planlardan (Oda/Mahal) Gelen Boşluk Düşümleri
                                                </h4>
                                                <p className="text-[10px] text-slate-400 mb-2 leading-relaxed">
                                                    Bağımsız bölüm tiplerinde tanımladığınız kapı ve pencereler, toplam maliyet hesaplanırken duvar metrajlarından kalınlıklarına göre <strong>otomatik olarak eksiltilmektedir.</strong>
                                                </p>
                                                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                                                    {Object.entries(deductions).filter(([_, val]) => val > 0).map(([thick, val]) => (
                                                        <div key={thick} className="bg-slate-900/50 p-2 rounded border border-slate-700 text-center shadow-sm">
                                                            <div className="text-[9px] text-slate-500 font-bold mb-0.5">{thick} cm Duvar</div>
                                                            <div className="text-xs font-bold text-red-400 font-mono">-{val.toFixed(2)} m²</div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {/* 2. SİZİN MEVCUT KODUNUZ: Duvar Ekleme Inputları (Burası hiç değişmedi, sadece içeri taşındı) */}
                                        <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
                                            <div className="w-full md:w-auto">
                                                <label className="text-[10px] text-slate-400 font-bold block mb-1">Seçili Malzeme</label>
                                                <div className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-yellow-500 font-bold w-full md:w-32 capitalize">
                                                    {globalWallMaterial}
                                                </div>
                                            </div>
                                            <div className="w-full md:w-auto">
                                                <label className="text-[10px] text-slate-400 font-bold block mb-1">Kalınlık (cm)</label>
                                                <select value={wallForm.thick} onChange={e => setWallForm({ ...wallForm, thick: parseFloat(e.target.value) })} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-24 outline-none focus:border-yellow-500">
                                                    <option value={10}>10</option>
                                                    <option value={13.5}>13.5</option>
                                                    <option value={15}>15</option>
                                                    <option value={20}>20</option>
                                                    <option value={25}>25</option>
                                                </select>
                                            </div>

                                            <div className="w-full md:w-auto">
                                                <label className="text-[10px] text-slate-400 font-bold block mb-1">Yükseklik (m)</label>
                                                <NumericInput
                                                    value={wallForm.height}
                                                    onChange={(val) => setWallForm({ ...wallForm, height: val })}
                                                    className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-20 outline-none focus:border-yellow-500"
                                                    placeholder="Oto"
                                                />
                                            </div>

                                            <div className="w-full md:flex-1">
                                                <label className="text-[10px] text-slate-400 font-bold block mb-1">Uzunluk (m)</label>
                                                <NumericInput
                                                    value={wallForm.len}
                                                    onChange={(val) => setWallForm({ ...wallForm, len: val })}
                                                    className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full outline-none focus:border-yellow-500"
                                                />
                                            </div>
                                            <button onClick={handleAddWall} className="w-full md:w-auto bg-yellow-600 hover:bg-yellow-500 text-white px-4 py-2 rounded font-bold text-sm transition">
                                                Ekle
                                            </button>
                                        </div>

                                    </div>
                                )}
                            {activeTab === 'column' && (
                                <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">En (cm)</label>
                                        <NumericInput
                                            value={colForm.w}
                                            onChange={(val) => setColForm({ ...colForm, w: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-20"
                                        />
                                    </div>
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Boy (cm)</label>
                                        <NumericInput
                                            value={colForm.d}
                                            onChange={(val) => setColForm({ ...colForm, d: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-20"
                                        />
                                    </div>

                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Yükseklik (m)</label>
                                        <NumericInput
                                            value={colForm.h}
                                            onChange={(val) => setColForm({ ...colForm, h: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-20"
                                            placeholder="Oto"
                                        />
                                    </div>

                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                        <NumericInput
                                            value={colForm.count}
                                            onChange={(val) => setColForm({ ...colForm, count: Math.max(1, val) })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-16"
                                        />
                                    </div>
                                    <button onClick={handleAddColumn} className="w-full md:w-auto bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded font-bold text-sm">Ekle</button>
                                </div>
                            )}
                            {activeTab === 'beam' && (
                                <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">En (cm)</label>
                                        <NumericInput
                                            value={beamForm.w}
                                            onChange={(val) => setBeamForm({ ...beamForm, w: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-20"
                                        />
                                    </div>
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Yükseklik (cm)</label>
                                        <NumericInput
                                            value={beamForm.h}
                                            onChange={(val) => setBeamForm({ ...beamForm, h: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-20"
                                        />
                                    </div>

                                    {/* ---> YENİ EKLENEN KISIM BURASI <--- */}
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Döşeme Kl. (cm)</label>
                                        <NumericInput
                                            value={beamForm.slabThick}
                                            onChange={(val) => setBeamForm({ ...beamForm, slabThick: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-20"
                                        />
                                    </div>
                                    {/* ---------------------------------- */}

                                    <div className="w-full md:flex-1"><label className="text-[10px] text-slate-400 font-bold block mb-1">Uzunluk (m)</label>
                                        <NumericInput
                                            value={beamForm.len}
                                            onChange={(val) => setBeamForm({ ...beamForm, len: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full"
                                        />
                                    </div>
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                        <NumericInput
                                            value={beamForm.count}
                                            onChange={(val) => setBeamForm({ ...beamForm, count: Math.max(1, val) })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-16"
                                        />
                                    </div>
                                    <button onClick={handleAddBeam} className="w-full md:w-auto bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-bold text-sm">Ekle</button>
                                </div>
                            )}
                            {activeTab === 'slab' && (
                                <div className="flex flex-col md:flex-row gap-3 md:gap-4 items-end">
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Tip</label>
                                        <select value={slabForm.type} onChange={e => setSlabForm({ ...slabForm, type: e.target.value as any })} className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-28"><option value="plak">Plak</option><option value="asmolen">Asmolen</option><option value="mantar">Mantar</option></select></div>
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Kalınlık (cm)</label>
                                        <NumericInput
                                            value={slabForm.thick}
                                            onChange={(val) => setSlabForm({ ...slabForm, thick: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-20"
                                        />
                                    </div>
                                    <div className="w-full md:flex-1"><label className="text-[10px] text-slate-400 font-bold block mb-1">Alan (m²)</label>
                                        <NumericInput
                                            value={slabForm.area}
                                            onChange={(val) => setSlabForm({ ...slabForm, area: val })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full"
                                        />
                                    </div>
                                    <div className="w-full md:w-auto"><label className="text-[10px] text-slate-400 font-bold block mb-1">Adet</label>
                                        <NumericInput
                                            value={slabForm.count}
                                            onChange={(val) => setSlabForm({ ...slabForm, count: Math.max(1, val) })}
                                            className="bg-slate-900 border border-slate-600 rounded p-2 text-sm text-white w-full md:w-16"
                                        />
                                    </div>
                                    <button onClick={handleAddSlab} className="w-full md:w-auto bg-purple-600 hover:bg-purple-500 text-white px-4 py-2 rounded font-bold text-sm">Ekle</button>
                                </div>
                            )}
                        </div>

                        {/* List Area */}
                        <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar">
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm text-slate-300 min-w-[300px]">
                                    <thead className="bg-slate-900/50 text-xs uppercase text-slate-500 font-bold">
                                        <tr>
                                            <th className="p-2 rounded-l">Tip / Özellik</th>
                                            <th className="p-2">Boyutlar</th>
                                            <th className="p-2">Metraj</th>
                                            <th className="p-2">Kaynak</th>
                                            <th className="p-2 rounded-r text-right">İşlem</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700/50">
                                        {activeTab === 'wall' && unit.walls.map((w, i) => (
                                            <tr key={w.id} className="hover:bg-slate-700/30 transition">
                                                <td className="p-2 font-medium text-white capitalize">{globalWallMaterial} ({w.properties.thickness}cm)</td>
                                                <td className="p-2">
                                                    H: {w.properties.height ? `${w.properties.height}m` : 'Oto'}
                                                </td>
                                                <td className="p-2 font-mono text-yellow-400">
                                                    {w.manualLengthM ? w.manualLengthM.toFixed(2) : (unit.scale > 0 ? (w.length_px / unit.scale).toFixed(2) : 0)} m
                                                </td>
                                                <td className="p-2 text-xs">{w.manualLengthM ? <span className="text-green-500">Manuel</span> : <span className="text-blue-500">Çizim</span>}</td>
                                                <td className="p-2 text-right"><button onClick={() => handleDelete('wall', w.id)} className="text-red-500 hover:text-white"><i className="fas fa-trash"></i></button></td>
                                            </tr>
                                        ))}
                                        {activeTab === 'column' && unit.columns.map((c, i) => (
                                            <tr key={c.id} className="hover:bg-slate-700/30 transition">
                                                <td className="p-2 font-medium text-white">{c.properties.type}</td>
                                                <td className="p-2">H: {c.properties.height || 'Oto'}m</td>
                                                <td className="p-2 font-mono text-red-400">
                                                    {c.manualAreaM2 ? c.manualAreaM2.toFixed(2) : (unit.scale > 0 ? (c.area_px / (unit.scale ** 2)).toFixed(2) : 0)} m²
                                                </td>
                                                <td className="p-2 text-xs">{c.manualAreaM2 ? <span className="text-green-500">Manuel</span> : <span className="text-blue-500">Çizim</span>}</td>
                                                <td className="p-2 text-right"><button onClick={() => handleDelete('column', c.id)} className="text-red-500 hover:text-white"><i className="fas fa-trash"></i></button></td>
                                            </tr>
                                        ))}
                                        {activeTab === 'beam' && unit.beams.map((b, i) => (
                                            <tr key={b.id} className="hover:bg-slate-700/30 transition">
                                                <td className="p-2 font-medium text-white">Kiriş</td>
                                                <td className="p-2">{b.properties.width}x{b.properties.height} cm</td>
                                                <td className="p-2 font-mono text-blue-400">
                                                    {b.manualLengthM ? b.manualLengthM.toFixed(2) : (unit.scale > 0 ? (b.length_px / unit.scale).toFixed(2) : 0)} m
                                                </td>
                                                <td className="p-2 text-xs">{b.manualLengthM ? <span className="text-green-500">Manuel</span> : <span className="text-blue-500">Çizim</span>}</td>
                                                <td className="p-2 text-right"><button onClick={() => handleDelete('beam', b.id)} className="text-red-500 hover:text-white"><i className="fas fa-trash"></i></button></td>
                                            </tr>
                                        ))}
                                        {activeTab === 'slab' && (unit.slabs || []).map((s, i) => (
                                            <tr key={s.id} className="hover:bg-slate-700/30 transition">
                                                <td className="p-2 font-medium text-white capitalize">{s.properties.type} Döşeme</td>
                                                <td className="p-2">d: {s.properties.thickness} cm</td>
                                                <td className="p-2 font-mono text-purple-400">
                                                    {s.manualAreaM2.toFixed(2)} m²
                                                </td>
                                                <td className="p-2 text-xs"><span className="text-green-500">Manuel</span></td>
                                                <td className="p-2 text-right"><button onClick={() => handleDelete('slab', s.id)} className="text-red-500 hover:text-white"><i className="fas fa-trash"></i></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            {(activeTab === 'wall' && unit.walls.length === 0) && <div className="p-4 text-center text-slate-500 text-sm">Kayıtlı duvar yok.</div>}
                            {(activeTab === 'column' && unit.columns.length === 0) && <div className="p-4 text-center text-slate-500 text-sm">Kayıtlı kolon yok.</div>}
                            {(activeTab === 'beam' && unit.beams.length === 0) && <div className="p-4 text-center text-slate-500 text-sm">Kayıtlı kiriş yok.</div>}
                            {(activeTab === 'slab' && (unit.slabs || []).length === 0) && <div className="p-4 text-center text-slate-500 text-sm">Kayıtlı döşeme yok.</div>}
                        </div>
                    </div>
                </div>
                <div className="p-3 md:p-4 border-t border-slate-700 bg-slate-800/50 flex justify-end">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg text-sm md:text-base">Kapat</button>
                </div>
            </div>
        </div>
    );
};