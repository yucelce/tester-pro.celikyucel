import React, { useState, useMemo } from 'react';
import { UnitType, Room, RoomType, RoomProperties, BuildingStats } from '../../types';
import { CostCategory } from '../../../api/_utils/cost_data';
import { CostSummaryPanel } from '../Shared/CostSummaryPanel';

interface RoomManagerModalProps {
    unit: UnitType;
    onClose: () => void;
    onUpdateUnit: (updatedUnit: UnitType) => void;
    costs: CostCategory[];
    buildingStats: BuildingStats;
    onUpdateCostItem: (catId: string, itemName: string, field: 'manualPrice', value: number | undefined) => void;
}

export const RoomManagerModal: React.FC<RoomManagerModalProps> = ({
    unit,
    onClose,
    onUpdateUnit,
    costs,
    buildingStats,
    onUpdateCostItem
}) => {
    // Düzenleme modu için state
    const [editingRoomId, setEditingRoomId] = useState<string | null>(null);

    const [form, setForm] = useState<{
        name: string;
        type: RoomType;
        area: number;
        perimeter: number;
        height: number | undefined;
        windowArea: number;
        windowWallThickness: number;
        doorCount: number;
        doorWallThickness: number;
        floor: 'parke' | 'seramik' | 'beton';
        wall: 'boya' | 'seramik';
        cornice: boolean;
        waterproofing: boolean;
        suspendedCeiling: boolean;
    }>({
        name: 'Salon',
        type: 'living',
        area: 0,
        perimeter: 0,
        height: undefined,
        windowArea: 2, // Varsayılan pencere alanı
        windowWallThickness: 20,
        doorCount: 1,
        doorWallThickness: 13.5,
        floor: 'parke',
        wall: 'boya',
        cornice: true,
        waterproofing: false,
        suspendedCeiling: false
    });

    const [quantities, setQuantities] = useState<Record<string, number>>({});

// API Üzerinden Asenkron Metraj Çekme
React.useEffect(() => {
    const fetchQuantities = async () => {
        try {
            // YENİ: Vercel Limitini aşmamak için resmi temizliyoruz
            const safeUnit = { ...unit, imageData: null };
            
            const res = await fetch('/api/calculate-unit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    unit: safeUnit, // GÜNCELLENDİ
                    costs,
                    buildingStats,
                    globalWallMaterial: 'gazbeton',
                    globalWallMode: 'auto',
                    globalConcreteMode: 'auto',
                    globalWallThickness: 15,
                    isStructural: false
                })
            });
            const data = await res.json();
            setQuantities(data.quantities || {});
        } catch (error) {
            console.error("Daire metrajı çekilirken hata:", error);
        }
    };
    fetchQuantities();
}, [unit, costs, buildingStats]);

    // ODA TİPİ SEÇİM MANTIĞI
    const handleTypeChange = (type: RoomType) => {
        let defaultName = '';
        let defaultFloor: any = 'parke';
        let defaultWall: any = 'boya';
        let defaultCornice = true;
        let defaultWaterproofing = false;
        let defaultSuspendedCeiling = false;
        let defaultWindowArea = 2;

        switch (type) {
            case 'living':
                defaultName = 'Salon';
                defaultFloor = 'parke'; defaultWall = 'boya'; defaultCornice = true; defaultWindowArea = 2.5;
                break;
            case 'bedroom':
                defaultName = 'Yatak Odası';
                defaultFloor = 'parke'; defaultWall = 'boya'; defaultCornice = true; defaultWindowArea = 2;
                break;
            case 'kitchen':
                defaultName = 'Mutfak';
                defaultFloor = 'seramik'; defaultWall = 'boya'; defaultCornice = true; defaultWindowArea = 2;
                break;
            case 'bath':
                defaultName = 'Banyo';
                defaultFloor = 'seramik'; defaultWall = 'seramik'; defaultCornice = false; defaultWaterproofing = true; defaultWindowArea = 0.5;
                defaultSuspendedCeiling = true;
                break;

            case 'wc':
                defaultName = 'WC';
                defaultFloor = 'seramik'; defaultWall = 'seramik'; defaultCornice = false; defaultWaterproofing = true; defaultWindowArea = 0.25;
                defaultSuspendedCeiling = true;
                break;
            case 'hallway':
                defaultName = 'Antre / Koridor';
                defaultFloor = 'parke'; defaultWall = 'boya'; defaultCornice = true; defaultWindowArea = 0;
                break;
            case 'dressing':
                defaultName = 'Giyinme Odası';
                defaultFloor = 'parke'; defaultWall = 'boya'; defaultCornice = false; defaultWindowArea = 0;
                break;
            case 'balcony':
                defaultName = 'Balkon';
                defaultFloor = 'seramik'; defaultWall = 'boya'; defaultCornice = false; defaultWaterproofing = true; defaultWindowArea = 0;
                break;
            case 'storage':
                defaultName = 'Depo / Kiler';
                defaultFloor = 'beton'; defaultWall = 'boya'; defaultCornice = false; defaultWindowArea = 0;
                break;
        }

        setForm(prev => ({
            ...prev,
            type,
            name: defaultName,
            floor: defaultFloor,
            wall: defaultWall,
            cornice: defaultCornice,
            waterproofing: defaultWaterproofing,
            suspendedCeiling: defaultSuspendedCeiling,
            windowArea: defaultWindowArea,
            windowWallThickness: 20,
            doorWallThickness: 13.5
        }));
    };

    const handleAreaChange = (val: string) => {
        const newArea = parseFloat(val);
        let newPerimeter = form.perimeter;
        if (!isNaN(newArea) && newArea > 0) {
            newPerimeter = parseFloat((14 * Math.sqrt(newArea / 12)).toFixed(2));
        }
        setForm(prev => ({ ...prev, area: newArea, perimeter: newPerimeter }));
    };

    // KAYDET VEYA GÜNCELLE
    const handleSaveRoom = () => {
        if (form.area <= 0) { alert("Lütfen geçerli bir alan giriniz."); return; }

        if (editingRoomId) {
            // GÜNCELLEME İŞLEMİ
            const updatedRooms = unit.rooms.map(r => {
                if (r.id === editingRoomId) {
                    return {
                        ...r,
                        name: form.name,
                        manualAreaM2: form.area,
                        manualPerimeterM: form.perimeter,
                        type: form.type,
                        properties: {
                            ...r.properties,
                            ceilingHeight: form.height,
                            windowArea: form.windowArea,
                            windowWallThickness: form.windowWallThickness,
                            doorCount: form.doorCount,
                            doorWallThickness: form.doorWallThickness,
                            hasCornice: form.cornice,
                            hasWaterproofing: form.waterproofing,
                            floorType: form.floor,
                            wallFinish: form.wall
                        }
                    };
                }
                return r;
            });

            onUpdateUnit({ ...unit, rooms: updatedRooms });
            setEditingRoomId(null); // Moddan çık
        } else {
            // YENİ EKLEME İŞLEMİ
            const newRoom: Room = {
                id: Date.now().toString(),
                name: form.name || 'Yeni Oda',
                points: [],
                area_px: 0,
                perimeter_px: 0,
                manualAreaM2: form.area,
                manualPerimeterM: form.perimeter,
                type: form.type,
                properties: {
                    ceilingHeight: form.height,
                    windowArea: form.windowArea,
                    windowWallThickness: form.windowWallThickness,
                    doorCount: form.doorCount,
                    doorWallThickness: form.doorWallThickness,
                    hasCornice: form.cornice,
                    hasWaterproofing: form.waterproofing,
                    hasSuspendedCeiling: form.suspendedCeiling,
                    floorType: form.floor,
                    wallFinish: form.wall
                }
            };
            onUpdateUnit({ ...unit, rooms: [...unit.rooms, newRoom] });
        }

        // Formu sıfırla (Tip aynı kalsın, değerler sıfırlansın)
        setForm(prev => ({ ...prev, name: '', area: 0, perimeter: 0 }));
    };

    // DÜZENLEME MODUNU BAŞLAT
    const handleEditRoom = (room: Room) => {
        const area = room.manualAreaM2 || (unit.scale > 0 ? room.area_px / (unit.scale ** 2) : 0);
        const perimeter = room.manualPerimeterM || (unit.scale > 0 ? room.perimeter_px / unit.scale : 0);

        setForm({
            name: room.name,
            type: room.type,
            area: parseFloat(area.toFixed(2)),
            perimeter: parseFloat(perimeter.toFixed(2)),
            height: room.properties.ceilingHeight,
            windowArea: room.properties.windowArea,
            windowWallThickness: room.properties.windowWallThickness || 20,
            doorWallThickness: room.properties.doorWallThickness || 13.5,
            doorCount: room.properties.doorCount,
            floor: room.properties.floorType === 'unknown' ? 'parke' : room.properties.floorType,
            wall: room.properties.wallFinish === 'unknown' ? 'boya' : room.properties.wallFinish,
            cornice: room.properties.hasCornice,
            waterproofing: room.properties.hasWaterproofing || false,
            suspendedCeiling: room.properties.hasSuspendedCeiling ?? (room.type === 'bath' || room.type === 'wc')
        });
        setEditingRoomId(room.id);
    };

    const handleCancelEdit = () => {
        setEditingRoomId(null);
        setForm(prev => ({ ...prev, name: '', area: 0, perimeter: 0 }));
    };

    const handleDeleteRoom = (id: string) => {
        if (editingRoomId === id) handleCancelEdit();
        onUpdateUnit({ ...unit, rooms: unit.rooms.filter(r => r.id !== id) });
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-2 md:p-4">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl shadow-2xl w-full max-w-[95vw] flex flex-col h-[90vh] transition-colors duration-300">

                {/* Header */}
                <div className="p-3 md:p-4 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 shrink-0">
                    <div>
                        <h3 className="text-slate-900 dark:text-white font-bold text-base md:text-lg">{unit.name} - Oda & Mahal Listesi</h3>
                        <p className="text-[10px] md:text-xs text-slate-500 dark:text-slate-400">Çizim yapmadan manuel oda tanımlama paneli</p>
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600 dark:hover:text-white"><i className="fas fa-times text-lg md:text-xl"></i></button>
                </div>

                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    <div className="w-full md:w-[400px] bg-white dark:bg-slate-900 border-b md:border-b-0 md:border-r border-slate-200 dark:border-slate-800 flex flex-col shrink-0 max-h-[40vh] md:max-h-full">
                        <div className="flex-1 overflow-y-auto custom-scrollbar p-3 md:p-4 space-y-3 md:space-y-4">
                            <h4 className="font-bold text-blue-500 dark:text-blue-400 text-xs md:text-sm uppercase mb-1 md:mb-2">
                                {editingRoomId ? 'Odayı Düzenle' : 'Yeni Oda Ekle'}
                            </h4>

                            {/* ODA TİPİ BUTONLARI */}
                            <div className="grid grid-cols-3 sm:grid-cols-3 md:grid-cols-4 gap-2">
                                {[
                                    { id: 'living', label: 'Salon', icon: 'fa-couch', activeColor: 'bg-blue-600 border-blue-500' },
                                    { id: 'bedroom', label: 'Yatak Od.', icon: 'fa-bed', activeColor: 'bg-purple-600 border-purple-500' },
                                    { id: 'kitchen', label: 'Mutfak', icon: 'fa-utensils', activeColor: 'bg-orange-600 border-orange-500' },
                                    { id: 'bath', label: 'Banyo', icon: 'fa-bath', activeColor: 'bg-cyan-600 border-cyan-500' },
                                    { id: 'wc', label: 'WC', icon: 'fa-restroom', activeColor: 'bg-teal-600 border-teal-500' },
                                    { id: 'hallway', label: 'Antre', icon: 'fa-route', activeColor: 'bg-indigo-600 border-indigo-500' },
                                    { id: 'dressing', label: 'Giyinme', icon: 'fa-tshirt', activeColor: 'bg-pink-600 border-pink-500' },
                                    { id: 'balcony', label: 'Balkon', icon: 'fa-sun', activeColor: 'bg-green-600 border-green-500' },
                                    { id: 'storage', label: 'Depo', icon: 'fa-warehouse', activeColor: 'bg-slate-600 border-slate-500' },
                                ].map(t => (
                                    <button
                                        key={t.id}
                                        onClick={() => handleTypeChange(t.id as RoomType)}
                                        className={`p-2 rounded border text-[10px] md:text-xs flex flex-col items-center justify-center gap-1 min-w-0 transition ${form.type === t.id ? `${t.activeColor} text-white` : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700'}`}
                                    >
                                        <i className={`fas ${t.icon}`}></i>
                                        <span className="hidden sm:block w-full truncate text-center leading-tight">{t.label}</span>
                                    </button>
                                ))}
                            </div>

                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Oda İsmi</label>
                                <input type="text" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-xs md:text-sm" placeholder="Örn: Çocuk Odası" />
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Alan (m²)</label>
                                    <input type="number" value={form.area || ''} onChange={e => handleAreaChange(e.target.value)} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-xs md:text-sm focus:border-blue-500 outline-none transition" />
                                </div>
                                <div>
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Çevre (m)</label>
                                    <div className="relative">
                                        <input type="number" value={form.perimeter || ''} onChange={e => setForm({ ...form, perimeter: parseFloat(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-xs md:text-sm focus:border-green-500 outline-none transition" placeholder="Oto" />
                                        <span className="absolute right-2 top-2 text-[9px] text-green-500 font-bold opacity-60">4:3</span>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                                <div>
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Tavan Yük. (m)</label>
                                    <input type="number" step="0.1" value={form.height || ''} onChange={e => { const val = parseFloat(e.target.value); setForm({ ...form, height: isNaN(val) ? undefined : val }); }} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-blue-500" placeholder="Oto" />
                                </div>
                                {/* KAPILAR İÇİN GÜNCELLENEN INPUT */}
                                <div>
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Kapı Adeti & Duvarı</label>
                                    <div className="flex gap-2">
                                        <input type="number" value={form.doorCount} onChange={e => setForm({ ...form, doorCount: parseInt(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-blue-500" />
                                        <select
                                            value={form.doorWallThickness}
                                            onChange={e => setForm({ ...form, doorWallThickness: parseFloat(e.target.value) })}
                                            className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-blue-500"
                                        >
                                            <option value={10}>10 cm</option>
                                            <option value={13.5}>13.5 cm</option>
                                            <option value={15}>15 cm</option>
                                            <option value={20}>20 cm</option>
                                            <option value={25}>25 cm</option>
                                        </select>
                                    </div>
                                </div>
                            </div>

                            {/* YENİ EKLENEN: PENCERE ALANI INPUTU */}
                            <div>
                                <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Pencere Alanı & Duvarı</label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <input type="number" step="0.1" value={form.windowArea} onChange={e => setForm({ ...form, windowArea: parseFloat(e.target.value) })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-blue-500" />
                                        <span className="absolute right-2 top-2 text-[9px] text-slate-400">m²</span>
                                    </div>
                                    <select
                                        value={form.windowWallThickness}
                                        onChange={e => setForm({ ...form, windowWallThickness: parseFloat(e.target.value) })}
                                        className="w-24 bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-2 text-slate-900 dark:text-white text-xs md:text-sm outline-none focus:border-blue-500"
                                    >
                                        <option value={10}>10 cm</option>
                                        <option value={13.5}>13.5 cm</option>
                                        <option value={15}>15 cm</option>
                                        <option value={20}>20 cm</option>
                                        <option value={25}>25 cm</option>
                                    </select>
                                </div>
                            </div>

                            {/* MALZEME VE ÖZELLİKLER BÖLÜMÜ */}
                            <div className="border-t border-slate-200 dark:border-slate-700 pt-3">
                                <div className="mb-2">
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Zemin</label>
                                    <select value={form.floor} onChange={e => setForm({ ...form, floor: e.target.value as any })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs text-slate-900 dark:text-white">
                                        <option value="parke">Laminat Parke</option>
                                        <option value="seramik">Seramik</option>
                                        <option value="beton">Brüt Beton</option>
                                    </select>
                                </div>
                                <div className="mb-2">
                                    <label className="text-[10px] text-slate-500 dark:text-slate-400 font-bold block mb-1">Duvar</label>
                                    <select value={form.wall} onChange={e => setForm({ ...form, wall: e.target.value as any })} className="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-600 rounded p-1.5 text-xs text-slate-900 dark:text-white">
                                        <option value="boya">Boya</option>
                                        <option value="seramik">Seramik</option>
                                    </select>
                                </div>

                                <div className="flex gap-4 mt-3">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={form.cornice} onChange={e => setForm({ ...form, cornice: e.target.checked })} className="accent-blue-500 w-4 h-4" />
                                        <span className="text-xs text-slate-600 dark:text-slate-300">Kartonpiyer</span>
                                    </label>

                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={form.waterproofing} onChange={e => setForm({ ...form, waterproofing: e.target.checked })} className="accent-blue-500 w-4 h-4" />
                                        <span className="text-xs text-slate-600 dark:text-slate-300">Su Yalıtımı</span>
                                    </label>

                                    {/* YENİ EKLENEN KISIM */}
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input type="checkbox" checked={form.suspendedCeiling} onChange={e => setForm({ ...form, suspendedCeiling: e.target.checked })} className="accent-blue-500 w-4 h-4" />
                                        <span className="text-xs text-slate-600 dark:text-slate-300">Asma Tavan</span>
                                    </label>
                                </div>
                            </div>
                        </div>

                        {/* AKSİYON BUTONLARI */}
                        <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/30 shrink-0 z-10 flex gap-2">
                            {editingRoomId && (
                                <button
                                    onClick={handleCancelEdit}
                                    className="flex-1 bg-slate-200 hover:bg-slate-300 dark:bg-slate-700 dark:hover:bg-slate-600 text-slate-700 dark:text-white font-bold py-3 rounded text-sm transition"
                                >
                                    Vazgeç
                                </button>
                            )}
                            <button
                                onClick={handleSaveRoom}
                                className={`flex-1 ${editingRoomId ? 'bg-orange-600 hover:bg-orange-500' : 'bg-green-600 hover:bg-green-500'} text-white font-bold py-3 rounded shadow-lg text-sm flex items-center justify-center gap-2 transition-transform active:scale-95`}
                            >
                                <i className={`fas ${editingRoomId ? 'fa-save' : 'fa-plus'}`}></i>
                                {editingRoomId ? 'Güncelle' : 'Ekle'}
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 bg-slate-100 dark:bg-slate-800/20 flex flex-col min-h-[30vh]">
                        <div className="p-3 md:p-4 bg-slate-50 dark:bg-slate-800/50 border-b border-slate-200 dark:border-slate-700 flex justify-between items-center shrink-0">
                            <span className="text-xs md:text-sm font-bold text-slate-700 dark:text-slate-300">Ekli Odalar ({unit.rooms.length})</span>
                            <div className="text-xs md:text-sm text-slate-500 dark:text-slate-400">
                                Toplam: <span className="text-slate-900 dark:text-white font-bold ml-1">
                                    {unit.rooms.reduce((acc, r) => acc + (r.manualAreaM2 || (r.area_px > 0 && unit.scale > 0 ? r.area_px / (unit.scale ** 2) : 0)), 0).toFixed(2)} m²
                                </span>
                            </div>
                        </div>

                        <div className="flex-1 overflow-y-auto p-3 md:p-4 custom-scrollbar">
                            {unit.rooms.length === 0 ? (
                                <div className="h-full flex flex-col items-center justify-center text-slate-400 dark:text-slate-500 opacity-60">
                                    <i className="fas fa-vector-square text-4xl md:text-6xl mb-4"></i>
                                    <p className="text-sm">Henüz oda eklenmemiş.</p>
                                </div>
                            ) : (
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm text-slate-700 dark:text-slate-300 min-w-[300px]">
                                        <thead className="bg-slate-200 dark:bg-slate-900/50 text-xs uppercase text-slate-500 dark:text-slate-500 font-bold">
                                            <tr>
                                                <th className="p-2 md:p-3 rounded-l">Oda Adı</th>
                                                <th className="p-2 md:p-3">Alan (m²)</th>
                                                <th className="p-2 md:p-3 hidden sm:table-cell">Zemin/Duvar</th>
                                                <th className="p-2 md:p-3 rounded-r text-right">İşlem</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-slate-200 dark:divide-slate-700/50">
                                            {unit.rooms.map((room) => (
                                                <tr key={room.id} className={`hover:bg-slate-100 dark:hover:bg-slate-700/30 transition ${editingRoomId === room.id ? 'bg-blue-50 dark:bg-blue-900/20' : ''}`}>
                                                    <td className="p-2 md:p-3 font-medium text-slate-900 dark:text-white">
                                                        <div className="flex flex-col">
                                                            <span>{room.name}</span>
                                                            <span className="text-[10px] text-slate-500 sm:hidden">{room.properties.floorType}</span>
                                                        </div>
                                                    </td>
                                                    <td className="p-2 md:p-3 font-mono text-yellow-600 dark:text-yellow-400">
                                                        {room.manualAreaM2
                                                            ? room.manualAreaM2.toFixed(2)
                                                            : (unit.scale > 0 ? (room.area_px / (unit.scale ** 2)).toFixed(2) : '0.00')
                                                        }
                                                    </td>
                                                    <td className="p-2 md:p-3 text-xs text-slate-500 dark:text-slate-400 hidden sm:table-cell">
                                                        {room.properties.floorType} / {room.properties.wallFinish}
                                                    </td>
                                                    <td className="p-2 md:p-3 text-right">
                                                        <div className="flex justify-end gap-2">
                                                            {/* DÜZENLEME BUTONU */}
                                                            <button
                                                                onClick={() => handleEditRoom(room)}
                                                                className="text-blue-500 hover:text-white p-2 rounded hover:bg-blue-600 transition"
                                                                title="Düzenle"
                                                            >
                                                                <i className="fas fa-pen"></i>
                                                            </button>
                                                            {/* SİLME BUTONU */}
                                                            <button
                                                                onClick={() => handleDeleteRoom(room.id)}
                                                                className="text-red-500 hover:text-white p-2 rounded hover:bg-red-600 transition"
                                                                title="Sil"
                                                            >
                                                                <i className="fas fa-trash"></i>
                                                            </button>
                                                        </div>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>
                    </div>

                    <div className="w-full md:w-80 h-48 md:h-auto border-t md:border-t-0 md:border-l border-slate-200 dark:border-slate-800 shrink-0">
                        <CostSummaryPanel
                            unit={unit}
                            costs={costs}
                            quantities={quantities}
                            scope="architectural"
                            onUpdateCostItem={onUpdateCostItem}
                        />
                    </div>
                </div>
                <div className="p-3 md:p-4 border-t border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800/50 flex justify-end shrink-0">
                    <button onClick={onClose} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg font-bold shadow-lg text-sm md:text-base">Tamam</button>
                </div>
            </div>
        </div>
    );
};