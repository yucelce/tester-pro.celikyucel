
import React from 'react';
import { Room, Wall, Column, Beam, Slab, RoomType, RoomProperties, WallProperties, ColumnProperties, BeamProperties, SlabProperties } from '../../types';

// --- WALL MODAL ---
interface WallModalProps {
    wall: Wall;
    scale: number;
    onUpdate: (props: Partial<WallProperties>) => void;
    onDelete: () => void;
    onClose: () => void;
    onSave: () => void;
}

export const WallModal: React.FC<WallModalProps> = ({ wall, scale, onUpdate, onDelete, onClose, onSave }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-2xl flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg">Duvar Özellikleri</h3>
                    <button onClick={onDelete} className="text-red-500 text-xs"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>
                <div className="p-6 space-y-4">
                    {/* Removed Material Selector to use Global Setting */}
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Duvar Kalınlığı (cm)</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-blue-500"
                            value={wall.properties.thickness}
                            onChange={(e) => onUpdate({ thickness: parseFloat(e.target.value) })}
                        >
                            <option value={10}>10 cm</option>
                            <option value={13.5}>13.5 cm</option>
                            <option value={15}>15 cm</option>
                            <option value={20}>20 cm</option>
                            <option value={25}>25 cm</option>
                        </select>
                    </div>

                    {/* Manuel Height */}
                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Duvar Yüksekliği (m)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={wall.properties.height || ''}
                            onChange={(e) => onUpdate({ height: parseFloat(e.target.value) })}
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm font-mono focus:border-blue-500 outline-none"
                            placeholder="Otomatik (Kat Yüksekliği)"
                        />
                        <p className="text-[9px] text-slate-500 mt-1">Boş bırakılırsa kat yüksekliğinden ağırlıklı döşeme kalınlığı düşülür.</p>                </div>

                    <div className="bg-slate-800 p-3 rounded border border-slate-700">
                        <label className="flex items-center gap-3 cursor-pointer mb-3">
                            <input
                                type="checkbox"
                                checked={wall.properties.isUnderBeam}
                                onChange={(e) => onUpdate({ isUnderBeam: e.target.checked })}
                                className="w-5 h-5 accent-yellow-500"
                            />
                            <span className="text-sm font-medium text-white">Kiriş Altı Duvar</span>
                        </label>
                        {wall.properties.isUnderBeam && (
                            <div className="animate-fadeIn">
                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Kiriş Sarkması (cm)</label>
                                <input
                                    type="number"
                                    value={wall.properties.beamHeight}
                                    onChange={(e) => onUpdate({ beamHeight: parseFloat(e.target.value) || 0 })}
                                    className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm"
                                    placeholder="50"
                                />
                                <p className="text-[9px] text-slate-500 mt-1">*Bu değer kat yüksekliğinden düşülür.</p>
                            </div>
                        )}
                    </div>
                    <div className="pt-2 text-center text-xs text-slate-400 font-mono">
                        Uzunluk: {scale > 0 ? (wall.length_px / scale).toFixed(2) : '?'} m
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-lg font-bold transition border border-slate-700 text-sm">İptal</button>
                    <button onClick={onSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold transition shadow-lg text-sm">Kaydet</button>
                </div>
            </div>
        </div>
    );
};

// --- SLAB MODAL ---
interface SlabModalProps {
    slab: Slab;
    scale: number;
    onUpdate: (props: Partial<SlabProperties>) => void;
    onDelete: () => void;
    onClose: () => void;
    onSave: () => void;
}

export const SlabModal: React.FC<SlabModalProps> = ({ slab, scale, onUpdate, onDelete, onClose, onSave }) => {
    const area = slab.area_px && scale > 0 ? slab.area_px / (scale * scale) : slab.manualAreaM2;

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col animate-fadeIn">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-layer-group mr-2 text-purple-500"></i>Döşeme Detay</h3>
                    <button onClick={onDelete} className="text-red-500 hover:text-red-400 text-xs uppercase font-bold tracking-wide"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-purple-900/10 p-3 rounded border border-purple-900/30 text-[10px] text-purple-200 text-center">
                        <span className="block text-xl font-bold">{area.toFixed(2)} m²</span>
                        <span>Hesaplanan Alan</span>
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Döşeme Tipi</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-purple-500"
                            value={slab.properties.type}
                            onChange={(e) => onUpdate({ type: e.target.value as any })}
                        >
                            <option value="plak">Plak Döşeme</option>
                            <option value="asmolen">Asmolen</option>
                            <option value="mantar">Mantar</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Döşeme Kalınlığı (cm)</label>
                        <input
                            type="number"
                            value={slab.properties.thickness}
                            onChange={(e) => onUpdate({ thickness: parseFloat(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono text-center"
                        />
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-lg font-bold transition border border-slate-700 text-sm">İptal</button>
                    <button onClick={onSave} className="flex-1 bg-purple-600 hover:bg-purple-500 text-white py-2 rounded-lg font-bold transition shadow-lg text-sm">Kaydet</button>
                </div>
            </div>
        </div>
    );
};

// --- COLUMN MODAL ---
interface ColumnModalProps {
    column: Column;
    scale: number;
    onUpdate: (props: Partial<ColumnProperties>) => void;
    onDelete: () => void;
    onClose: () => void;
    onSave: () => void;
}

export const ColumnModal: React.FC<ColumnModalProps> = ({ column, scale, onUpdate, onDelete, onClose, onSave }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col animate-fadeIn">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-square mr-2 text-red-500"></i>Kolon/Perde Detay</h3>
                    <button onClick={onDelete} className="text-red-500 hover:text-red-400 text-xs uppercase font-bold tracking-wide"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-red-900/10 p-3 rounded border border-red-900/30 text-[10px] text-red-200">
                        <i className="fas fa-info-circle mr-1"></i>
                        Çevre: {(scale > 0 ? (column.perimeter_px / scale).toFixed(2) : 0)}m |
                        Alan: {(scale > 0 ? (column.area_px / (scale ** 2)).toFixed(2) : 0)}m2
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Eleman Tipi</label>
                        <select
                            className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white text-sm outline-none focus:border-red-500"
                            value={column.properties.type}
                            onChange={(e) => onUpdate({ type: e.target.value as any })}
                        >
                            <option value="kolon">Kolon</option>
                            <option value="perde">Perde Duvar</option>
                        </select>
                    </div>

                    <div>
                        <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Eleman Yüksekliği (m)</label>
                        <input
                            type="number"
                            step="0.01"
                            value={column.properties.height || ''}
                            onChange={(e) => onUpdate({ height: parseFloat(e.target.value) })}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono focus:border-red-500 outline-none"
                            placeholder="Otomatik (Kat Yüksekliği)"
                        />
                        <p className="text-[9px] text-slate-500 mt-1">Boş bırakılırsa kat yüksekliği kullanılır.</p>
                    </div>

                    {/* Kiriş Yüksekliği (Düşümü) alanı buradan kaldırıldı. */}

                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-lg font-bold transition border border-slate-700 text-sm">İptal</button>
                    <button onClick={onSave} className="flex-1 bg-red-600 hover:bg-red-500 text-white py-2 rounded-lg font-bold transition shadow-lg text-sm">Kaydet</button>
                </div>
            </div>
        </div>
    );
};

// --- BEAM MODAL ---
interface BeamModalProps {
    beam: Beam;
    scale: number;
    onUpdate: (props: Partial<BeamProperties>) => void;
    onDelete: () => void;
    onClose: () => void;
    onSave: () => void;
}

export const BeamModal: React.FC<BeamModalProps> = ({ beam, scale, onUpdate, onDelete, onClose, onSave }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-sm flex flex-col animate-fadeIn">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-grip-lines mr-2 text-blue-500"></i>Kiriş Detay</h3>
                    <button onClick={onDelete} className="text-red-500 hover:text-red-400 text-xs uppercase font-bold tracking-wide"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>
                <div className="p-6 space-y-4">
                    <div className="bg-blue-900/10 p-3 rounded border border-blue-900/30 text-[10px] text-blue-200 text-center">
                        Uzunluk: {(scale > 0 ? (beam.length_px / scale).toFixed(2) : 0)} m
                    </div>

                    {/* grid-cols-2 yerine grid-cols-3 yaptık */}
                    <div className="grid grid-cols-3 gap-4">
                        <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Genişlik (cm)</label>
                            <input
                                type="number"
                                value={beam.properties.width}
                                onChange={(e) => onUpdate({ width: parseFloat(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono text-center outline-none focus:border-blue-500"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Yükseklik (cm)</label>
                            <input
                                type="number"
                                value={beam.properties.height}
                                onChange={(e) => onUpdate({ height: parseFloat(e.target.value) })}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono text-center outline-none focus:border-blue-500"
                            />
                        </div>
                        {/* YENİ EKLENEN: DÖŞEME KALINLIĞI */}
                        <div>
                            <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Döşeme (cm)</label>
                            <input
                                type="number"
                                value={beam.properties.slabThickness}
                                onChange={(e) => onUpdate({ slabThickness: parseFloat(e.target.value) || 0 })}
                                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white text-sm font-mono text-center outline-none focus:border-blue-500"
                            />
                        </div>
                    </div>
                </div>
                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-2 rounded-lg font-bold transition border border-slate-700 text-sm">İptal</button>
                    <button onClick={onSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg font-bold transition shadow-lg text-sm">Kaydet</button>
                </div>
            </div>
        </div>
    );
};

// --- ROOM MODAL ---
interface RoomModalProps {
    room: Room;
    scale: number;
    onUpdate: (props: Partial<RoomProperties>, type?: RoomType, name?: string, manualStats?: { area: number, perimeter: number }) => void;
    onDelete: () => void;
    onClose: () => void;
    onSave: () => void;
}

export const RoomModal: React.FC<RoomModalProps> = ({ room, scale, onUpdate, onDelete, onClose, onSave }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <h3 className="text-white font-bold text-lg"><i className="fas fa-edit mr-2 text-blue-500"></i>Oda Özellikleri</h3>
                    <button onClick={onDelete} className="text-red-500 hover:text-red-400 text-xs uppercase font-bold tracking-wide"><i className="fas fa-trash mr-1"></i>Sil</button>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">

                    {/* Section 1: Identity & Geometry */}
                    <div className="space-y-4">
                        <div>
                            <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Oda İsmi</label>
                            <input
                                type="text"
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-blue-500 outline-none transition"
                                value={room.name}
                                onChange={(e) => onUpdate({}, undefined, e.target.value)}
                            />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                            <div className="bg-slate-800 p-3 rounded border border-slate-700 relative">
                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Alan (m²)</label>
                                {room.points.length > 0 ? (
                                    <span className="text-xl font-mono font-bold text-blue-400">
                                        {(scale > 0 ? (room.area_px / (scale * scale)) : 0).toFixed(2)}
                                    </span>
                                ) : (
                                    <input
                                        type="number"
                                        className="w-full bg-transparent text-xl font-mono font-bold text-blue-400 outline-none border-b border-blue-900 focus:border-blue-500"
                                        value={room.manualAreaM2}
                                        onChange={(e) => {
                                            const newArea = parseFloat(e.target.value) || 0;
                                            const calculatedPerimeter = newArea > 0 ? parseFloat((14 * Math.sqrt(newArea / 12)).toFixed(2)) : 0;
                                            onUpdate({}, undefined, undefined, {
                                                area: newArea,
                                                perimeter: calculatedPerimeter
                                            });
                                        }}
                                    />
                                )}
                                {room.points.length === 0 && <span className="absolute top-2 right-2 text-[10px] text-green-500">MANUEL</span>}
                            </div>
                            <div className="bg-slate-800 p-3 rounded border border-slate-700 relative">
                                <label className="text-[10px] text-slate-400 uppercase font-bold block mb-1">Çevre (mt)</label>
                                {room.points.length > 0 ? (
                                    <span className="text-xl font-mono font-bold text-purple-400">
                                        {(scale > 0 ? (room.perimeter_px / scale) : 0).toFixed(2)}
                                    </span>
                                ) : (
                                    <input
                                        type="number"
                                        className="w-full bg-transparent text-xl font-mono font-bold text-purple-400 outline-none border-b border-purple-900 focus:border-purple-500"
                                        value={room.manualPerimeterM}
                                        onChange={(e) => {
                                            const newPerimeter = parseFloat(e.target.value) || 0;
                                            onUpdate({}, undefined, undefined, {
                                                area: room.manualAreaM2!,
                                                perimeter: newPerimeter
                                            });
                                        }}
                                    />
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="h-px bg-slate-700"></div>

                    {/* Section 2: Type Selection (Auto-fill) */}
                    <div>
                        <label className="block text-slate-400 text-xs font-bold uppercase mb-2">Oda Tipi (Otomatik Malzeme Seçimi)</label>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { id: 'living', label: 'Salon', icon: 'fa-couch', activeClass: 'bg-blue-900/40 border-blue-500 text-white' },
                                { id: 'bedroom', label: 'Yatak Odası', icon: 'fa-bed', activeClass: 'bg-purple-900/40 border-purple-500 text-white' },
                                { id: 'kitchen', label: 'Mutfak', icon: 'fa-utensils', activeClass: 'bg-orange-900/40 border-orange-500 text-white' },
                                { id: 'bath', label: 'Banyo', icon: 'fa-bath', activeClass: 'bg-cyan-900/40 border-cyan-500 text-white' },
                                { id: 'wc', label: 'WC', icon: 'fa-restroom', activeClass: 'bg-teal-900/40 border-teal-500 text-white' }, // YENİ EKLENDİ
                                { id: 'hallway', label: 'Antre / Koridor', icon: 'fa-route', activeClass: 'bg-indigo-900/40 border-indigo-500 text-white' },
                                { id: 'dressing', label: 'Giyinme Odası', icon: 'fa-tshirt', activeClass: 'bg-pink-900/40 border-pink-500 text-white' },
                                { id: 'balcony', label: 'Balkon', icon: 'fa-sun', activeClass: 'bg-green-900/40 border-green-500 text-white' },
                                { id: 'storage', label: 'Depo / Otopark', icon: 'fa-warehouse', activeClass: 'bg-slate-900/40 border-slate-500 text-white' },
                            ].map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => onUpdate({}, t.id as RoomType)}
                                    className={`p-2 rounded border text-left flex items-center gap-2 transition ${room.type === t.id ? t.activeClass : 'bg-slate-800 border-slate-700 text-slate-400 hover:bg-slate-700'}`}
                                >
                                    <i className={`fas ${t.icon} w-5 text-center`}></i>
                                    <span className="text-[10px] sm:text-xs font-bold leading-tight">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="h-px bg-slate-700"></div>

                    {/* Section 3: Structural & Openings */}
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Tavan Yüksekliği (m)</label>
                            <input
                                type="number"
                                step="0.1"
                                value={room.properties.ceilingHeight || ''}
                                onChange={(e) => onUpdate({ ceilingHeight: parseFloat(e.target.value) })}
                                className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white focus:border-blue-500 outline-none"
                                placeholder="Otomatik"
                            />
                            <p className="text-[9px] text-slate-500 mt-1">Boş bırakılırsa kat yüksekliği kullanılır.</p>
                        </div>
                        <div>
                            <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Pencere Alanı & Duvarı</label>
                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <input type="number" step="0.1" value={room.properties.windowArea} onChange={(e) => onUpdate({ windowArea: parseFloat(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white outline-none focus:border-blue-500" />
                                    <span className="absolute right-2 top-2 text-[9px] text-slate-400">m²</span>
                                </div>
                                <select
                                    className="w-24 bg-slate-800 border border-slate-600 rounded p-2 text-white text-xs outline-none focus:border-blue-500"
                                    value={room.properties.windowWallThickness || 20}
                                    onChange={(e) => onUpdate({ windowWallThickness: parseFloat(e.target.value) })}
                                >
                                    <option value={10}>10 cm</option>
                                    <option value={13.5}>13.5 cm</option>
                                    <option value={15}>15 cm</option>
                                    <option value={20}>20 cm</option>
                                    <option value={25}>25 cm</option>
                                </select>
                            </div>
                        </div>
                        <div>
                            <label className="block text-slate-400 text-xs font-bold uppercase mb-1">Kapı Sayısı (Adet)</label>
                            <input type="number" value={room.properties.doorCount} onChange={(e) => onUpdate({ doorCount: parseInt(e.target.value) })} className="w-full bg-slate-800 border border-slate-600 rounded p-2 text-white" />
                        </div>
                        <div className="flex items-center">
                            <label className="flex items-center gap-3 cursor-pointer p-2 bg-slate-800 border border-slate-600 rounded w-full hover:bg-slate-700 transition">
                                <input type="checkbox" checked={room.properties.hasCornice} onChange={(e) => onUpdate({ hasCornice: e.target.checked })} className="w-5 h-5 accent-blue-500" />
                                <span className="text-sm font-medium text-white">Kartonpiyer Ekle</span>
                            </label>
                        </div>
                    </div>

                    {/* Section 4: Materials Selection */}
                    <div className="bg-slate-800 p-4 rounded border border-slate-700">
                        <h4 className="text-xs font-bold text-slate-400 uppercase mb-3">Malzeme Seçimi</h4>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Zemin Kaplaması</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                                    value={room.properties.floorType}
                                    onChange={(e) => onUpdate({ floorType: e.target.value as any })}
                                >
                                    <option value="parke">Laminat Parke</option>
                                    <option value="seramik">Seramik / Fayans</option>
                                    <option value="beton">Brüt Beton / Şap</option>
                                </select>
                            </div>
                            <div>
                                <label className="text-[10px] text-slate-500 font-bold uppercase block mb-1">Duvar Kaplaması (Boya/Seramik)</label>
                                <select
                                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-sm text-white focus:border-blue-500 outline-none"
                                    value={room.properties.wallFinish}
                                    onChange={(e) => onUpdate({ wallFinish: e.target.value as any })}
                                >
                                    <option value="boya">Saten Boya</option>
                                    <option value="seramik">Duvar Seramiği</option>
                                </select>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="p-4 border-t border-slate-700 bg-slate-800/50 rounded-b-xl flex gap-3">
                    <button onClick={onClose} className="flex-1 bg-transparent hover:bg-slate-800 text-slate-400 hover:text-white py-3 rounded-lg font-bold transition border border-slate-700">
                        <i className="fas fa-times mr-2"></i>Değiştirmeden Çık
                    </button>
                    <button onClick={onSave} className="flex-1 bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-bold transition shadow-lg">
                        <i className="fas fa-check mr-2"></i>Değişiklikleri Kaydet
                    </button>
                </div>
            </div>
        </div>
    );
};

// --- CALIBRATION MODAL ---
interface CalibrationModalProps {
    onSubmit: (dist: number) => void;
}

export const CalibrationModal: React.FC<CalibrationModalProps> = ({ onSubmit }) => {
    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm">
            <div className="bg-slate-900 border border-slate-700 p-6 rounded-lg shadow-2xl w-80 text-center">
                <h3 className="text-white font-bold text-lg mb-2">Ölçü Giriniz</h3>
                <form onSubmit={(e) => { e.preventDefault(); onSubmit(parseFloat((e.target as any).dist.value)); }}>
                    <input name="dist" type="number" step="0.01" autoFocus placeholder="metre" className="w-full bg-slate-800 border border-slate-600 text-white rounded p-2 mb-4 text-center text-lg focus:border-pink-500 outline-none" />
                    <button type="submit" className="w-full bg-pink-600 text-white py-2 rounded hover:bg-pink-500">Tamamla</button>
                </form>
            </div>
        </div>
    );
};
