import React, { useEffect, useRef, useState, useMemo } from 'react';
import { UnitType, Room, Wall, Column, Beam, Slab, Point } from '../../types';
import { isPointInPolygon, getPolygonAreaAndPerimeter, distanceToSegment, floodFillRoom } from '../../utils/geometry';

import { CostSummaryPanel } from '../Shared/CostSummaryPanel';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { WallModal, RoomModal, ColumnModal, BeamModal, SlabModal, CalibrationModal } from '../Modals/EditorModals';


import PolyBool from 'polybooljs';

const [editorQuantities, setEditorQuantities] = useState<Record<string, number>>({});
const [editorStats, setEditorStats] = useState<any>({});

useEffect(() => {
    const fetchLivePreview = async () => {
        const tempUnit = {
            id: 'temp', name: 'temp', count: 1,
            rooms: editorRooms, walls: editorWalls, columns: editorColumns, beams: editorBeams, slabs: editorSlabs,
            floorType: sourceUnit?.floorType || 'normal',
            imageData: null, scale: editorScale, lastEdited: 0,
            structuralWallSource: 'detailed_unit', structuralConcreteSource: 'detailed_unit'
        };

        const res = await fetch('/api/calculate-unit', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                unit: tempUnit,
                costs,
                buildingStats,
                globalWallMaterial,
                globalWallMode: 'detailed',
                globalConcreteMode: 'detailed',
                globalWallThickness: 15,
                isStructural: editorScope === 'structural'
            })
        });
        const data = await res.json();
        setEditorQuantities(data.quantities);
        setEditorStats(data.stats);
    };

    // Aşırı istek atmasını engellemek için küçük bir debounce eklenebilir
    const delayDebounceFn = setTimeout(() => {
        fetchLivePreview();
    }, 500);

    return () => clearTimeout(delayDebounceFn);
}, [editorRooms, editorWalls, editorColumns, editorBeams, editorSlabs, editorScale, costs, buildingStats, globalWallMaterial, editorScope]);

// EditorView now manages its own "editing" state locally, 
// fetches the initial unit from store, and saves back to store.
export const EditorView: React.FC = () => {
    // FIX: globalWallMode ve globalConcreteMode eklendi
    const { units, structuralUnits, updateUnit, costs, buildingStats, setBuildingStats, updateCostItem, globalWallMaterial, globalWallMode, globalConcreteMode } = useProjectStore(); const { activeUnitId, editorScope, navigateToDashboard } = useUIStore();

    // Identify the unit being edited
    const sourceUnit = useMemo(() =>
        units.find(u => u.id === activeUnitId) || structuralUnits.find(u => u.id === activeUnitId),
        [units, structuralUnits, activeUnitId]);

    // --- LOCAL EDITOR STATE (Absorbed from App.tsx) ---
    // We initialize state with the source unit data, but then manage it locally until save.
    const [editorRooms, setEditorRooms] = useState<Room[]>([]);
    const [editorWalls, setEditorWalls] = useState<Wall[]>([]);
    const [editorColumns, setEditorColumns] = useState<Column[]>([]);
    const [editorBeams, setEditorBeams] = useState<Beam[]>([]);
    const [editorSlabs, setEditorSlabs] = useState<Slab[]>([]);
    const [editorScale, setEditorScale] = useState<number>(0);
    const [editorImage, setEditorImage] = useState<HTMLImageElement | null>(null);

    // Canvas State
    const [zoom, setZoom] = useState<number>(1);
    const [panOffset, setPanOffset] = useState<{ x: number, y: number }>({ x: 0, y: 0 });
    const [mode, setMode] = useState<'view' | 'calibrate' | 'draw' | 'magic' | 'select' | 'draw_wall' | 'draw_column' | 'draw_beam' | 'draw_slab'>('view');
    const [cursorPos, setCursorPos] = useState<Point | null>(null);

    // Interaction State
    const [drawingPoints, setDrawingPoints] = useState<Point[]>([]);
    const [drawingWallStart, setDrawingWallStart] = useState<Point | null>(null);
    const [calibrationPoints, setCalibrationPoints] = useState<Point[]>([]);
    const [isPanning, setIsPanning] = useState(false);
    const [panStart, setPanStart] = useState<{ x: number, y: number }>({ x: 0, y: 0 });

    const [pendingMagicPoints, setPendingMagicPoints] = useState<Point[] | null>(null);

    // Persistent Settings (Remember last values)
    const [lastWallHeight, setLastWallHeight] = useState<number | undefined>(undefined);
    const [lastSlabThickness, setLastSlabThickness] = useState<number>(15);
    const [lastWallThickness, setLastWallThickness] = useState<number>(13.5);

    // Selection & Modals State (Local to Editor)
    const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
    const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
    const [selectedColumnId, setSelectedColumnId] = useState<string | null>(null);
    const [selectedBeamId, setSelectedBeamId] = useState<string | null>(null);
    const [selectedSlabId, setSelectedSlabId] = useState<string | null>(null);
    const [modalType, setModalType] = useState<'roomParams' | 'wallParams' | 'columnParams' | 'beamParams' | 'slabParams' | 'calibrationInput' | null>(null);
    const [tempCalibrationDist, setTempCalibrationDist] = useState<number | null>(null);

    // Refs
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // Initialize Local State from Source Unit
    useEffect(() => {
        if (sourceUnit) {
            setEditorRooms(sourceUnit.rooms);
            setEditorWalls(sourceUnit.walls);
            setEditorColumns(sourceUnit.columns);
            setEditorBeams(sourceUnit.beams);
            setEditorSlabs(sourceUnit.slabs || []);
            setEditorScale(sourceUnit.scale);

            if (sourceUnit.imageData) {
                const img = new Image();
                img.onload = () => {
                    setEditorImage(img);
                    if (canvasRef.current) {
                        canvasRef.current.width = img.width;
                        canvasRef.current.height = img.height;
                    }
                };
                img.src = sourceUnit.imageData;
            }
        }
    }, [sourceUnit]); // Re-sync if source changes (though we usually don't change source while editing)

    // Derived Calculations for Cost Panel
    const { editorQuantities, editorStats } = useMemo(() => {
        const tempUnit: UnitType = {
            id: 'temp', name: 'temp', count: 1,
            rooms: editorRooms, walls: editorWalls, columns: editorColumns, beams: editorBeams, slabs: editorSlabs,
            floorType: sourceUnit?.floorType || 'normal',
            imageData: null, scale: editorScale, lastEdited: 0,
            structuralWallSource: 'detailed_unit',
            structuralConcreteSource: 'detailed_unit'
        };
        const isStructuralMode = editorScope === 'structural';
        // FIX: 'detailed' modu zorunlu kılındı çünkü editördeyiz ve anlık çizimin sonucunu görmek istiyoruz
        const { quantities, stats } = calculateUnitCost(
            tempUnit,
            costs,
            buildingStats,
            globalWallMaterial,
            'detailed',
            'detailed',
            15, // globalWallThickness fallback
            isStructuralMode
        );
        return { editorQuantities: quantities, editorStats: stats };
    }, [editorRooms, editorWalls, editorColumns, editorBeams, editorSlabs, editorScale, costs, buildingStats, sourceUnit, globalWallMaterial, editorScope]);


    // --- ACTIONS ---

    const handleSave = () => {
        if (sourceUnit) {
            // Intelligent Auto-Switch Logic:
            // If user has drawn elements in structural mode, force the unit to 'detailed' mode.
            let newWallSource = sourceUnit.structuralWallSource;
            let newConcreteSource = sourceUnit.structuralConcreteSource;

            if (editorScope === 'structural') {
                if (editorWalls.length > 0) {
                    newWallSource = 'detailed_unit';
                }
                if (editorColumns.length > 0 || editorBeams.length > 0 || editorSlabs.length > 0) {
                    newConcreteSource = 'detailed_unit';
                }
            }

            updateUnit({
                ...sourceUnit,
                rooms: editorRooms,
                walls: editorWalls,
                columns: editorColumns,
                beams: editorBeams,
                slabs: editorSlabs,
                scale: editorScale,
                imageData: editorImage ? editorImage.src : null,
                lastEdited: Date.now(),
                structuralWallSource: newWallSource,
                structuralConcreteSource: newConcreteSource
            });
            navigateToDashboard();
        }
    };

    const handleSyncSlabsToBuilding = () => {
        if (!sourceUnit || editorScale === 0) {
            alert("Lütfen önce planı ölçeklendirin ve yapısal eleman (döşeme, kolon vb.) çizin.");
            return;
        }

        let totalArea = 0;
        let manualArea = 0;
        let manualPerimeter = 0;

        // PolyBool için ana birleştirilmiş poligon nesnesi
        // Başlangıçta boş bir bölge olarak tanımlıyoruz
        let combinedPolygon = { regions: [] as number[][][], inverted: false };

        // 1. Döşemeleri (Slabs) Birleştiriciye Ekle
        editorSlabs.forEach(slab => {
            if (slab.points && slab.points.length > 2) {
                totalArea += slab.area_px! / (editorScale * editorScale);

                // Noktaları doğrudan METRE cinsinden [x, y] dizisine çeviriyoruz
                const region = slab.points.map(p => [p.x / editorScale, p.y / editorScale]);
                const slabPoly = { regions: [region], inverted: false };

                // Mevcut birleştirilmiş poligon ile yeni döşemeyi birleştir (UNION)
                combinedPolygon = PolyBool.union(combinedPolygon, slabPoly);

            } else if (slab.manualAreaM2 > 0) {
                manualArea += slab.manualAreaM2;
                manualPerimeter += Math.sqrt(slab.manualAreaM2) * 4;
            }
        });

        // 2. Kolonları/Perdeleri (Columns) Birleştiriciye Ekle
        // Dışarı taşan çıkma kolonlar veya perdeler dış cepheyi etkiler
        editorColumns.forEach(col => {
            if (col.points && col.points.length > 2) {
                totalArea += col.area_px! / (editorScale * editorScale);

                const region = col.points.map(p => [p.x / editorScale, p.y / editorScale]);
                const colPoly = { regions: [region], inverted: false };

                combinedPolygon = PolyBool.union(combinedPolygon, colPoly);
            }
        });

        // Kirişler (Beams) için basit alan hesabı
        editorBeams.forEach(beam => {
            const widthM = beam.properties.width / 100;
            const lengthM = beam.length_px / editorScale;
            totalArea += (widthM * lengthM);
            // Not: Kirişlerin çizgi şeklinde (start/end point) olması nedeniyle poligon 
            // union'a katılması için vektörel kalınlaştırma gerekir. Genelde dış cephe 
            // sınırını döşemeler ve perdeler belirlediği için çevreyi bunlardan almak yeterlidir.
        });

        if (totalArea === 0 && manualArea === 0) {
            alert("Geçerli bir çizim alanı bulunamadı.");
            return;
        }

        // --- YENİ ÇEVRE HESAPLAMA MANTIĞI (POLYGON UNION) ---
        let calculatedPerimeter = 0;

        // Birleştirilmiş ve tüm iç kesişimleri silinmiş (Sadece Dış Sınırlar) poligonu dönüyoruz
        combinedPolygon.regions.forEach(region => {
            for (let i = 0; i < region.length; i++) {
                const p1 = region[i];
                const p2 = region[(i + 1) % region.length]; // Son noktayı ilk noktaya bağlayarak kapat

                // İki nokta arası Öklid mesafesini topla
                calculatedPerimeter += Math.hypot(p2[0] - p1[0], p2[1] - p1[1]);
            }
        });

        const finalArea = totalArea + manualArea;
        const finalPerimeter = calculatedPerimeter + manualPerimeter;

        const floorType = sourceUnit.floorType;
        let updates: Partial<any> = {};

        // Kat tipine göre BuildingStats verilerini güncelle
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

        const floorName = floorType === 'normal' ? 'Normal Kat' : floorType === 'ground' ? 'Zemin Kat' : 'Bodrum Kat';
        alert(`${floorName} Sınırları Güncellendi!\n\nToplam Alan: ${finalArea.toFixed(2)} m²\nGerçek Dış Çevre: ${finalPerimeter.toFixed(2)} mt.`);
    };

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (evt) => {
            const img = new Image();
            img.onload = () => {
                if (canvasRef.current) { canvasRef.current.width = img.width; canvasRef.current.height = img.height; }
                setEditorImage(img);
                setMode('view');
                setEditorScale(editorScale > 0 ? editorScale : 0);
                setZoom(1);
                setPanOffset({ x: 0, y: 0 });
            };
            img.src = evt.target.result as string;
        };
        reader.readAsDataURL(file);
    };

    const getCanvasCoordinates = (e: React.MouseEvent) => {
        if (!canvasRef.current) return { x: 0, y: 0 };
        const rect = canvasRef.current.getBoundingClientRect();
        // Since we are using CSS transform for zoom/pan, we need to account for it manually if we want "screen" coords
        // BUT, the canvas element itself is scaled.
        // Let's use the standard approach relative to the element size
        const scaleX = canvasRef.current.width / rect.width;
        const scaleY = canvasRef.current.height / rect.height;
        return { x: (e.clientX - rect.left) * scaleX, y: (e.clientY - rect.top) * scaleY };
    };

    // --- KEYBOARD SHORTCUTS (ESC TO VIEW MODE) ---
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                // Modu 'view' (Gezinme) yap
                setMode('view');

                // Aktif çizimleri iptal et
                setDrawingPoints([]);
                setDrawingWallStart(null);
                setCalibrationPoints([]);
                setPendingMagicPoints(null);

                // Seçimleri kaldır
                setSelectedRoomId(null);
                setSelectedWallId(null);
                setSelectedColumnId(null);
                setSelectedBeamId(null);
                setSelectedSlabId(null);

                // Varsa açık modalları kapat
                setModalType(null);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    // --- MOUSE HANDLERS (LOGIC moved from App.tsx) ---

    const handleMouseDown = (e: React.MouseEvent) => {
        // Pan Logic
        if (e.button === 1 || (mode === 'view' && e.button === 0)) {
            e.preventDefault();
            setIsPanning(true);
            setPanStart({ x: e.clientX, y: e.clientY });
            return;
        }

        const { x, y } = getCanvasCoordinates(e);

        if (mode === 'calibrate') {
            const newPoints = [...calibrationPoints, { x, y }];
            setCalibrationPoints(newPoints);
            if (newPoints.length === 2) {
                const distPx = Math.hypot(newPoints[1].x - newPoints[0].x, newPoints[1].y - newPoints[0].y);
                setTempCalibrationDist(distPx);
                setModalType('calibrationInput');
            }
        }
        else if (mode === 'draw' || mode === 'draw_column' || mode === 'draw_slab') {
            if (drawingPoints.length > 2 && Math.hypot(x - drawingPoints[0].x, y - drawingPoints[0].y) < 20) {
                if (mode === 'draw') finishPolygon();
                if (mode === 'draw_column') finishColumnPolygon();
                if (mode === 'draw_slab') finishSlabPolygon();
            } else {
                setDrawingPoints([...drawingPoints, { x, y }]);
            }
        }
        else if (mode === 'draw_wall' || mode === 'draw_beam') {
            if (!drawingWallStart) { setDrawingWallStart({ x, y }); }
            else {
                if (mode === 'draw_wall') createWall(drawingWallStart, { x, y });
                if (mode === 'draw_beam') createBeam(drawingWallStart, { x, y });
                setDrawingWallStart(null);
            }
        }
        else if (mode === 'magic') {
            if (!canvasRef.current) return;
            const ctx = canvasRef.current.getContext('2d');
            if (ctx) {
                const points = floodFillRoom(ctx, x, y, canvasRef.current.width, canvasRef.current.height);
                if (points && points.length > 2) {
                    // Odayı hemen OLUŞTURMA, önizleme için state'e kaydet
                    setPendingMagicPoints(points);
                }
                else alert("Oda algılanamadı.");
            }
        }
        else if (mode === 'select' || mode === 'view') {
            // Selection Logic
            if (editorScope === 'structural') {
                const clickedColumn = editorColumns.find(c => isPointInPolygon({ x, y }, c.points));
                if (clickedColumn) { setSelectedColumnId(clickedColumn.id); setModalType('columnParams'); return; }

                const clickedSlab = editorSlabs.find(s => s.points && isPointInPolygon({ x, y }, s.points));
                if (clickedSlab) { setSelectedSlabId(clickedSlab.id); setModalType('slabParams'); return; }

                let clickedWall = null;
                for (const w of editorWalls) if (distanceToSegment({ x, y }, w.startPoint, w.endPoint) < 5) { clickedWall = w; break; }
                if (clickedWall) { setSelectedWallId(clickedWall.id); setModalType('wallParams'); return; }

                let clickedBeam = null;
                for (const b of editorBeams) if (distanceToSegment({ x, y }, b.startPoint, b.endPoint) < 5) { clickedBeam = b; break; }
                if (clickedBeam) { setSelectedBeamId(clickedBeam.id); setModalType('beamParams'); return; }
            }
            if (editorScope === 'architectural') {
                const clickedRoom = editorRooms.find(r => r.points.length > 0 && isPointInPolygon({ x, y }, r.points));
                if (clickedRoom) { setSelectedRoomId(clickedRoom.id); setModalType('roomParams'); return; }
            }
            setSelectedRoomId(null); setSelectedWallId(null); setSelectedColumnId(null); setSelectedBeamId(null); setSelectedSlabId(null);
        }
    };

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isPanning) {
            e.preventDefault();
            const dx = e.clientX - panStart.x;
            const dy = e.clientY - panStart.y;
            setPanOffset(prev => ({ x: prev.x + dx, y: prev.y + dy }));
            setPanStart({ x: e.clientX, y: e.clientY });
        }
        setCursorPos(getCanvasCoordinates(e));
    };

    const handleMouseUp = () => setIsPanning(false);

    // --- SMOOTH ZOOM FIX ---
    const handleWheel = (e: React.WheelEvent) => {
        if (!containerRef.current) return;
        const rect = containerRef.current.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;

        // HASSASİYET AYARI (Sensitivity):
        // Buradaki 0.002 değerini değiştirerek hızı ayarlayabilirsiniz.
        const zoomSensitivity = 0.01;

        // Delta Yönünü Al (-1, 0, 1)
        const delta = -Math.sign(e.deltaY);

        if (delta === 0) return;

        // Logaritmik (Oransal) Zoom Hesabı
        const scaleFactor = Math.exp(delta * zoomSensitivity);

        // Yeni zoom değerini sınırla (0.1x - 10x arası)
        const newZoom = Math.min(Math.max(zoom * scaleFactor, 0.1), 10);

        // Mouse konumunu koruyarak zoom yapma matematiği
        const worldX = (mouseX - panOffset.x) / zoom;
        const worldY = (mouseY - panOffset.y) / zoom;
        const newPanX = mouseX - (worldX * newZoom);
        const newPanY = mouseY - (worldY * newZoom);

        setZoom(newZoom);
        setPanOffset({ x: newPanX, y: newPanY });
    };

    // --- HELPER FUNCTIONS ---
    const createRoom = (points: Point[], defaultName: string) => {
        const { area, perimeter } = getPolygonAreaAndPerimeter(points);
        const newRoom: Room = {
            id: Date.now().toString(), name: defaultName, points: points, area_px: area, perimeter_px: perimeter, type: null,
            properties: {
                ceilingHeight: undefined, // Default to Auto
                windowArea: 0, doorCount: 1, hasCornice: true, floorType: 'unknown', wallFinish: 'boya'
            }
        };
        setEditorRooms([...editorRooms, newRoom]);
        setDrawingPoints([]); setMode('select'); setSelectedRoomId(newRoom.id); setModalType('roomParams');
    };
    const finishPolygon = () => createRoom(drawingPoints, `Oda ${editorRooms.length + 1}`);
    const finishColumnPolygon = () => {
        const { area, perimeter } = getPolygonAreaAndPerimeter(drawingPoints);
        const newCol: Column = {
            id: Date.now().toString(), points: drawingPoints, area_px: area, perimeter_px: perimeter,
            properties: { type: 'kolon', height: undefined, connectingBeamHeight: 0 }
        };
        setEditorColumns([...editorColumns, newCol]); setDrawingPoints([]); setSelectedColumnId(newCol.id); setModalType('columnParams');
    };
    const finishSlabPolygon = () => {
        const { area, perimeter } = getPolygonAreaAndPerimeter(drawingPoints);
        const newSlab: Slab = {
            id: Date.now().toString(),
            points: drawingPoints,
            area_px: area,
            perimeter_px: perimeter,
            manualAreaM2: 0,
            properties: { type: 'plak', thickness: lastSlabThickness }
        };
        setEditorSlabs([...editorSlabs, newSlab]);
        setDrawingPoints([]); setSelectedSlabId(newSlab.id); setModalType('slabParams');
    };
    const createWall = (start: Point, end: Point) => {
        const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
        const newWall: Wall = {
            id: Date.now().toString(),
            startPoint: start,
            endPoint: end,
            length_px: lengthPx,
            properties: {
                material: globalWallMaterial, // USE GLOBAL MATERIAL
                thickness: lastWallThickness, // GÜNCELLENDİ: 13.5 yerine son hatırlanan kalınlık kullanılıyor
                height: lastWallHeight, // Use stored height
                isUnderBeam: false,
                beamHeight: 50
            }
        };
        setEditorWalls([...editorWalls, newWall]); setSelectedWallId(newWall.id); setModalType('wallParams');
    };
    const createBeam = (start: Point, end: Point) => {
        const lengthPx = Math.hypot(end.x - start.x, end.y - start.y);
        const newBeam: Beam = { id: Date.now().toString(), startPoint: start, endPoint: end, length_px: lengthPx, properties: { width: 25, height: 50, slabThickness: 15 } };
        setEditorBeams([...editorBeams, newBeam]); setSelectedBeamId(newBeam.id); setModalType('beamParams');
    };

    const isStructural = editorScope === 'structural';

    // Eğer Global ayar 'auto' ise, kullanıcı çizim yapsa bile hesaplamaya katılmaz. Bu durumda uyarı gösterilir.
    // Eğer Global ayar 'detailed' ise, çizimler hesaplamaya katılır, uyarı gizlenir.
    const isWallAuto = globalWallMode === 'auto';
    const isConcreteAuto = globalConcreteMode === 'auto';

    const showWarning = isStructural && (isWallAuto || isConcreteAuto);

    // --- CANVAS RENDERING ---
    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (editorImage) ctx.drawImage(editorImage, 0, 0);

        // Drawing Logic

        // 0. Slabs (Background)
        editorSlabs.forEach((slab, idx) => {
            if (!slab.points || slab.points.length < 3) return;
            ctx.beginPath(); ctx.moveTo(slab.points[0].x, slab.points[0].y);
            for (let i = 1; i < slab.points.length; i++) ctx.lineTo(slab.points[i].x, slab.points[i].y);
            ctx.closePath();
            const isActive = editorScope === 'structural';
            ctx.fillStyle = isActive ? (slab.id === selectedSlabId ? 'rgba(192, 132, 252, 0.6)' : 'rgba(192, 132, 252, 0.2)') : 'rgba(0,0,0,0)';
            ctx.fill();
            if (isActive) {
                ctx.strokeStyle = '#a855f7'; ctx.lineWidth = 1; ctx.stroke();
                const cx = slab.points.reduce((acc, p) => acc + p.x, 0) / slab.points.length;
                const cy = slab.points.reduce((acc, p) => acc + p.y, 0) / slab.points.length;
                ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.fillText(`D${idx + 1}`, cx, cy);
            }
        });

        // 1. Columns
        editorColumns.forEach((col, idx) => {
            if (col.points.length < 3) return;
            ctx.beginPath(); ctx.moveTo(col.points[0].x, col.points[0].y);
            for (let i = 1; i < col.points.length; i++) ctx.lineTo(col.points[i].x, col.points[i].y);
            ctx.closePath();
            const isActive = editorScope === 'structural';
            ctx.fillStyle = isActive ? (col.id === selectedColumnId ? '#ef4444' : '#475569') : 'rgba(71, 85, 105, 0.3)';
            ctx.fill(); ctx.strokeStyle = isActive ? '#1e293b' : 'rgba(30, 41, 59, 0.3)'; ctx.lineWidth = 1; ctx.stroke();
            if (isActive) {
                const cx = col.points.reduce((acc, p) => acc + p.x, 0) / col.points.length;
                const cy = col.points.reduce((acc, p) => acc + p.y, 0) / col.points.length;
                ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`S${idx + 1}`, cx, cy);
            }
        });
        // 2. Beams
        editorBeams.forEach((beam, idx) => {
            ctx.beginPath(); ctx.moveTo(beam.startPoint.x, beam.startPoint.y); ctx.lineTo(beam.endPoint.x, beam.endPoint.y);
            const isActive = editorScope === 'structural';
            const isSelected = beam.id === selectedBeamId;
            const visualWidth = Math.max(6, beam.properties.width / 3);
            ctx.lineWidth = visualWidth; ctx.strokeStyle = isActive ? (isSelected ? '#ef4444' : '#0ea5e9') : 'rgba(14, 165, 233, 0.3)'; ctx.lineCap = 'butt'; ctx.stroke();
            if (isActive) {
                ctx.beginPath(); ctx.moveTo(beam.startPoint.x, beam.startPoint.y); ctx.lineTo(beam.endPoint.x, beam.endPoint.y);
                ctx.lineWidth = 1; ctx.strokeStyle = '#fff'; ctx.setLineDash([4, 4]); ctx.stroke(); ctx.setLineDash([]);
                const cx = (beam.startPoint.x + beam.endPoint.x) / 2; const cy = (beam.startPoint.y + beam.endPoint.y) / 2;
                const text = `K${idx + 1}`; const width = ctx.measureText(text).width;
                ctx.fillStyle = '#0ea5e9'; ctx.fillRect(cx - width / 2 - 2, cy - 6, width + 4, 12);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, cx, cy);
            }
        });
        // 3. Rooms
        editorRooms.forEach(room => {
            if (room.points.length < 3) return;
            ctx.beginPath(); ctx.moveTo(room.points[0].x, room.points[0].y);
            for (let i = 1; i < room.points.length; i++) ctx.lineTo(room.points[i].x, room.points[i].y);
            ctx.closePath();
            const isActive = editorScope === 'architectural';
            if (room.type) {
                switch (room.type) {
                    case 'living': ctx.fillStyle = 'rgba(59, 130, 246, 0.4)'; break; // blue
                    case 'bedroom': ctx.fillStyle = 'rgba(168, 85, 247, 0.4)'; break; // purple
                    case 'kitchen': ctx.fillStyle = 'rgba(249, 115, 22, 0.4)'; break; // orange
                    case 'bath': ctx.fillStyle = 'rgba(6, 182, 212, 0.4)'; break; // cyan
                    case 'wc': ctx.fillStyle = 'rgba(20, 184, 166, 0.4)'; break; // teal
                    case 'hallway': ctx.fillStyle = 'rgba(99, 102, 241, 0.4)'; break; // indigo
                    case 'dressing': ctx.fillStyle = 'rgba(236, 72, 153, 0.4)'; break; // pink
                    case 'balcony': ctx.fillStyle = 'rgba(34, 197, 94, 0.4)'; break; // green
                    case 'storage': case 'other': ctx.fillStyle = 'rgba(100, 116, 139, 0.4)'; break; // slate
                    default: ctx.fillStyle = 'rgba(200, 200, 200, 0.1)';
                }
            } else ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
            ctx.fill();
            const isSelected = room.id === selectedRoomId;
            ctx.lineWidth = isSelected ? 4 : 2; ctx.strokeStyle = isActive ? (isSelected ? '#ef4444' : (room.type ? '#333' : '#dc2626')) : 'rgba(0,0,0,0.1)'; ctx.stroke();
            if (editorScale > 0 && room.type && isActive) {
                const cx = room.points.reduce((acc, p) => acc + p.x, 0) / room.points.length;
                const cy = room.points.reduce((acc, p) => acc + p.y, 0) / room.points.length;
                ctx.fillStyle = 'rgba(0,0,0,0.7)'; ctx.fillRect(cx - 30, cy - 12, 60, 24);
                ctx.fillStyle = '#fff'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(`${room.name}`, cx, cy);
            }
        });
        // 4. Walls
        editorWalls.forEach(wall => {
            ctx.beginPath(); ctx.moveTo(wall.startPoint.x, wall.startPoint.y); ctx.lineTo(wall.endPoint.x, wall.endPoint.y); ctx.lineCap = 'round';
            const isActive = editorScope === 'structural';
            const isSelected = wall.id === selectedWallId;
            const visualThickness = Math.max(3, (wall.properties.thickness / 5));
            ctx.lineWidth = isSelected ? visualThickness + 4 : visualThickness;
            // Determine color based on Global Material if strictly enforced, or property if visual differentiation desired. 
            // Logic: Since calc uses global, visual should arguably reflect global or indicate conflict. 
            // For now, let's color code based on the *actual calculated material* (which is global).
            const mat = globalWallMaterial;
            ctx.strokeStyle = isActive ? (isSelected ? '#ef4444' : mat === 'gazbeton' ? '#facc15' : mat === 'tugla' ? '#f97316' : mat === 'bims' ? '#a8a29e' : '#cbd5e1') : 'rgba(200,200,200,0.3)';
            ctx.stroke();
            if (isSelected && isActive) {
                ctx.fillStyle = '#ef4444'; ctx.beginPath(); ctx.arc(wall.startPoint.x, wall.startPoint.y, 4, 0, Math.PI * 2); ctx.fill();
                ctx.beginPath(); ctx.arc(wall.endPoint.x, wall.endPoint.y, 4, 0, Math.PI * 2); ctx.fill();
            }
        });

        // Active Drawing
        if ((mode === 'draw' || mode === 'draw_column' || mode === 'draw_slab') && drawingPoints.length > 0) {
            ctx.beginPath(); ctx.moveTo(drawingPoints[0].x, drawingPoints[0].y);
            for (let i = 1; i < drawingPoints.length; i++) ctx.lineTo(drawingPoints[i].x, drawingPoints[i].y);
            if (cursorPos) ctx.lineTo(cursorPos.x, cursorPos.y);
            ctx.strokeStyle = mode === 'draw_column' ? '#ef4444' : mode === 'draw_slab' ? '#a855f7' : '#2563eb';
            ctx.lineWidth = 2; ctx.setLineDash([5, 5]); ctx.stroke(); ctx.setLineDash([]);
        }
        if ((mode === 'draw_wall' || mode === 'draw_beam') && drawingWallStart && cursorPos) {
            ctx.beginPath(); ctx.moveTo(drawingWallStart.x, drawingWallStart.y); ctx.lineTo(cursorPos.x, cursorPos.y);
            ctx.strokeStyle = mode === 'draw_beam' ? '#0ea5e9' : '#eab308'; ctx.lineWidth = 4; ctx.lineCap = 'round'; ctx.stroke();
        }
        if (mode === 'calibrate') {
            calibrationPoints.forEach(p => { ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fillStyle = '#db2777'; ctx.fill(); });
            if (calibrationPoints.length > 0 && cursorPos && calibrationPoints.length < 2) {
                ctx.beginPath(); ctx.moveTo(calibrationPoints[0].x, calibrationPoints[0].y); ctx.lineTo(cursorPos.x, cursorPos.y); ctx.strokeStyle = '#db2777'; ctx.stroke();
            }
        }
        if (mode === 'magic' && pendingMagicPoints) {
            ctx.beginPath();
            ctx.moveTo(pendingMagicPoints[0].x, pendingMagicPoints[0].y);
            for (let i = 1; i < pendingMagicPoints.length; i++) {
                ctx.lineTo(pendingMagicPoints[i].x, pendingMagicPoints[i].y);
            }
            ctx.closePath();

            // Yarı şeffaf mor dolgu ve kesik çizgili kenarlık
            ctx.fillStyle = 'rgba(139, 92, 246, 0.4)';
            ctx.fill();
            ctx.strokeStyle = '#8b5cf6';
            ctx.lineWidth = 2;
            ctx.setLineDash([5, 5]);
            ctx.stroke();
            ctx.setLineDash([]);
        } else if (mode === 'magic' && cursorPos) {
            // Sadece imleç işareti (eski kod)
            ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, 10, 0, Math.PI * 2); ctx.strokeStyle = '#8b5cf6'; ctx.stroke();
        }

        if (mode === 'magic' && cursorPos) {
            ctx.beginPath(); ctx.arc(cursorPos.x, cursorPos.y, 10, 0, Math.PI * 2); ctx.strokeStyle = '#8b5cf6'; ctx.stroke();
        }
    }, [editorImage, editorRooms, editorWalls, editorColumns, editorBeams, editorSlabs, drawingPoints, drawingWallStart, calibrationPoints, pendingMagicPoints, cursorPos, mode, selectedRoomId, selectedWallId, selectedColumnId, selectedBeamId, selectedSlabId, editorScale, editorScope, globalWallMaterial]);


    return (
        <div className="flex h-screen flex-col bg-slate-50 dark:bg-slate-900 overflow-hidden font-sans text-slate-800 dark:text-slate-200 transition-colors duration-300">

            {/* Editor Header */}
            <header className="bg-white dark:bg-slate-950 border-b border-slate-200 dark:border-slate-800 p-2 shadow-md z-10 flex justify-between items-center transition-colors duration-300">
                <div className="flex items-center gap-4">
                    <button onClick={navigateToDashboard} className="bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-white px-3 py-1.5 rounded flex items-center gap-2 border border-slate-200 dark:border-slate-700 transition text-sm">
                        <i className="fas fa-arrow-left"></i> Vazgeç
                    </button>
                    <div className="h-6 w-px bg-slate-300 dark:bg-slate-800"></div>
                    <div>
                        <h2 className="font-bold text-slate-900 dark:text-white text-sm">{sourceUnit?.name} <span className="text-slate-500 font-normal">{editorScope === 'architectural' ? 'Mimari Plan' : 'Statik Plan'}</span></h2>
                    </div>
                    <div className="bg-slate-100 dark:bg-slate-800 px-3 py-1 rounded text-xs border border-slate-200 dark:border-slate-700">
                        <span className="text-slate-500 dark:text-slate-400 mr-2">Mod:</span>
                        <span className={`font-bold uppercase ${editorScope === 'architectural' ? 'text-purple-600 dark:text-purple-400' : 'text-orange-600 dark:text-orange-400'}`}>
                            {editorScope === 'architectural' ? 'Oda & Mahal' : 'Kaba Yapı'}
                        </span>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {editorScale > 0 ? (
                        <span className="text-green-600 dark:text-green-400 text-xs font-mono bg-green-50 dark:bg-slate-800 px-2 py-1 rounded border border-green-200 dark:border-green-900"><i className="fas fa-ruler mr-1"></i>1m = {editorScale.toFixed(2)}px</span>
                    ) : (
                        <span className="text-red-500 dark:text-red-400 text-xs bg-red-50 dark:bg-slate-800 px-2 py-1 rounded border border-red-200 dark:border-red-900 animate-pulse"><i className="fas fa-exclamation-circle mr-1"></i>Ölçeklenmedi</span>
                    )}
                    <button onClick={handleSave} className="bg-green-600 hover:bg-green-500 text-white px-4 py-1.5 rounded text-sm font-bold shadow-lg shadow-green-500/20">
                        Kaydet & Çık
                    </button>
                </div>
            </header>

            <div className="flex flex-1 overflow-hidden relative">

                {/* Left Toolbar */}
                <div className="w-64 bg-white dark:bg-slate-900 border-r border-slate-200 dark:border-slate-800 flex flex-col z-20 shadow-xl transition-colors duration-300">
                    <div className="p-3 border-b border-slate-200 dark:border-slate-800 grid grid-cols-4 gap-1">
                        <button onClick={() => setMode('view')} className={`p-2 rounded transition ${mode === 'view' ? 'bg-blue-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white'}`} title="Gezinme (Kaydırma)"><i className="fas fa-arrows-alt"></i></button>

                        {editorScope === 'architectural' && (
                            <>
                                <button onClick={() => { setMode('draw'); setDrawingPoints([]); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw' ? 'bg-orange-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white'}`} title="Oda Çiz"><i className="fas fa-vector-square"></i></button>
                                <button
                                    onClick={() => alert("Sihirli Değnek (Yapay Zeka Destekli Otomatik Seçim) özelliği çok yakında eklenecektir!")}
                                    disabled={!editorImage || editorScale === 0}
                                    className="p-2 rounded transition disabled:opacity-30 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-purple-100 dark:hover:bg-purple-900/30 hover:text-purple-600 dark:hover:text-purple-400"
                                    title="Sihirli Değnek (Çok Yakında)"
                                >
                                    <i className="fas fa-wand-magic-sparkles"></i>
                                </button>                    </>
                        )}

                        {editorScope === 'structural' && (
                            <>
                                <button onClick={() => { setMode('draw_wall'); setDrawingWallStart(null); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_wall' ? 'bg-yellow-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white'}`} title="Duvar Çiz"><i className="fas fa-minus"></i></button>
                                <button onClick={() => { setMode('draw_column'); setDrawingPoints([]); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_column' ? 'bg-red-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white'}`} title="Kolon/Perde"><i className="fas fa-square"></i></button>
                                <button onClick={() => { setMode('draw_beam'); setDrawingWallStart(null); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_beam' ? 'bg-blue-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white'}`} title="Kiriş"><i className="fas fa-grip-lines"></i></button>
                                <button onClick={() => { setMode('draw_slab'); setDrawingPoints([]); }} disabled={!editorImage || editorScale === 0} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'draw_slab' ? 'bg-purple-500 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white'}`} title="Döşeme Çiz"><i className="fas fa-layer-group"></i></button>

                            </>
                        )}

                        <button onClick={() => { setMode('calibrate'); setCalibrationPoints([]); }} disabled={!editorImage} className={`p-2 rounded transition disabled:opacity-30 ${mode === 'calibrate' ? 'bg-pink-600 text-white' : 'bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 hover:bg-slate-200 dark:hover:text-white'}`} title="Kalibre Et"><i className="fas fa-ruler-combined"></i></button>
                    </div>

                    {editorScope === 'structural' && (
                        <div className="p-3 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/30">
                            <button
                                onClick={handleSyncSlabsToBuilding}
                                disabled={!editorImage || editorScale === 0 || (editorSlabs.length === 0 && editorBeams.length === 0 && editorColumns.length === 0)} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white p-2.5 rounded-lg text-[11px] md:text-xs font-bold transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 shadow-sm border border-indigo-500"
                                title="Çizilen döşemelerin toplam alan ve kırıklı çevresini yapı genel hesaplamalarına aktarır (Mantolama, iskele vb. için)"
                            >
                                <i className="fas fa-compress-arrows-alt"></i> Sınırları Projeye Aktar
                            </button>
                        </div>
                    )}

                    <div className="p-4 flex flex-col gap-3 border-b border-slate-200 dark:border-slate-800">
                        <label className="w-full bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-600 dark:text-slate-300 py-2 rounded text-xs font-bold text-center cursor-pointer border border-slate-300 dark:border-slate-700 transition">
                            <i className="fas fa-file-image mr-2"></i>Plan Görseli Yükle
                            <input type="file" onChange={handleImageUpload} className="hidden" accept="image/*" />
                        </label>
                    </div>

                    <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                        {/* Simplified List View for brevity in refactor, full logic absorbed */}
                        {editorScope === 'architectural' ? (
                            <div className="space-y-1">
                                {editorRooms.map(r => (
                                    <button key={r.id} onClick={() => { setSelectedRoomId(r.id); setModalType('roomParams'); }} className={`w-full text-left p-2 rounded border text-xs ${selectedRoomId === r.id ? 'bg-blue-100 border-blue-500 text-blue-800' : 'bg-white border-slate-200 text-slate-600'}`}>
                                        {r.name}
                                    </button>
                                ))}
                            </div>
                        ) : (
                            <div className="space-y-1">
                                <div className="text-[10px] text-slate-500 font-bold mb-1">Duvarlar ({editorWalls.length})</div>
                                {editorWalls.map(w => <button key={w.id} onClick={() => { setSelectedWallId(w.id); setModalType('wallParams'); }} className="w-full text-left p-2 text-xs border mb-1">Duvar</button>)}
                                <div className="text-[10px] text-slate-500 font-bold mb-1 mt-2">Döşemeler ({editorSlabs.length})</div>
                                {editorSlabs.map(s => <button key={s.id} onClick={() => { setSelectedSlabId(s.id); setModalType('slabParams'); }} className="w-full text-left p-2 text-xs border mb-1 text-purple-500">Döşeme</button>)}
                            </div>
                        )}
                    </div>
                </div>

                {/* Center Canvas */}
                <div className="flex-1 relative bg-slate-100 dark:bg-slate-950 overflow-hidden flex flex-col transition-colors duration-300">
                    {/* Warning Banner for Structural Mode */}
                    {showWarning && (
                        <div className="absolute top-2 left-1/2 transform -translate-x-1/2 z-30 bg-yellow-600/90 text-white px-4 py-2 rounded shadow-lg backdrop-blur text-xs font-bold flex items-center gap-2 border border-yellow-400">
                            <i className="fas fa-exclamation-triangle"></i>
                            <span>
                                {isWallAuto && isConcreteAuto ? "DİKKAT: Duvar ve Beton Oto Modda. Çizimler hesaba katılmaz!" :
                                    isWallAuto ? "DİKKAT: Duvar Oto Modda. Duvar çizimleri hesaba katılmaz!" :
                                        "DİKKAT: Beton Oto Modda. Yapısal çizimler hesaba katılmaz!"}
                            </span>
                        </div>
                    )}

                    <div className="absolute top-4 right-4 z-20 flex flex-col gap-2 bg-white/90 dark:bg-slate-800/90 p-1 rounded border border-slate-200 dark:border-slate-700 shadow-xl backdrop-blur">
                        <button onClick={() => setZoom(z => Math.min(z + 0.2, 10))} className="w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"><i className="fas fa-plus"></i></button>
                        <span className="text-center text-xs text-slate-600 dark:text-slate-400 font-mono select-none">{Math.round(zoom * 100)}%</span>
                        <button onClick={() => setZoom(z => Math.max(z - 0.2, 0.2))} className="w-8 h-8 flex items-center justify-center text-slate-500 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-600 rounded"><i className="fas fa-minus"></i></button>
                    </div>

                    <div
                        ref={containerRef}
                        onWheel={handleWheel}
                        className="flex-1 relative overflow-hidden bg-slate-200 dark:bg-transparent dark:bg-[url('https://www.transparenttextures.com/patterns/dark-matter.png')] transition-colors duration-300 select-none cursor-default"
                    >
                        <canvas
                            ref={canvasRef}
                            onMouseDown={handleMouseDown}
                            onMouseMove={handleMouseMove}
                            onMouseUp={handleMouseUp}
                            onMouseLeave={handleMouseUp}
                            style={{
                                transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${zoom})`,
                                transformOrigin: '0 0',
                                transition: isPanning ? 'none' : 'transform 0.1s ease-out',
                                position: 'absolute',
                                top: 0,
                                left: 0
                            }}
                            className={`shadow-2xl border border-slate-300 dark:border-slate-700 bg-white ${isPanning ? 'cursor-grabbing' : (mode === 'calibrate' ? 'cursor-crosshair' : mode.startsWith('draw') ? 'cursor-cell' : mode === 'magic' ? 'cursor-crosshair' : mode === 'view' ? 'cursor-grab' : 'cursor-default')}`}
                        />
                    </div>
                </div>

                {/* Right Cost Panel */}
                <CostSummaryPanel
                    unit={sourceUnit}
                    costs={costs}
                    quantities={editorQuantities}
                    scope={editorScope}
                    onUpdateCostItem={updateCostItem}
                    structuralStats={editorStats}
                />
            </div>

            {/* Editor Modals */}
            {modalType === 'calibrationInput' && <CalibrationModal onSubmit={(dist) => { if (tempCalibrationDist && dist > 0) { setEditorScale(tempCalibrationDist / dist); setCalibrationPoints([]); setModalType(null); alert("Kalibre Edildi"); } }} />}
            {modalType === 'roomParams' && selectedRoomId && <RoomModal room={editorRooms.find(r => r.id === selectedRoomId)!} scale={editorScale}
                onUpdate={(props, type, name, stats) => setEditorRooms(prev => prev.map(r => r.id === selectedRoomId ? { ...r, properties: { ...r.properties, ...props }, type: type || r.type, name: name || r.name, manualAreaM2: stats?.area, manualPerimeterM: stats?.perimeter } : r))}
                onDelete={() => { setEditorRooms(prev => prev.filter(r => r.id !== selectedRoomId)); setModalType(null); }} onClose={() => setModalType(null)} onSave={() => setModalType(null)} />}

            {modalType === 'wallParams' && selectedWallId && <WallModal wall={editorWalls.find(w => w.id === selectedWallId)!} scale={editorScale}
                onUpdate={(props) => {
                    if (props.height !== undefined) setLastWallHeight(props.height); // Remember height
                    if (props.thickness !== undefined) setLastWallThickness(props.thickness); // YENİ EKLENDİ: Kalınlığı hatırla
                    setEditorWalls(prev => prev.map(w => w.id === selectedWallId ? { ...w, properties: { ...w.properties, ...props } } : w));

                }}
                onDelete={() => { setEditorWalls(prev => prev.filter(w => w.id !== selectedWallId)); setModalType(null); }} onClose={() => setModalType(null)} onSave={() => setModalType(null)} />}

            {modalType === 'columnParams' && selectedColumnId && <ColumnModal column={editorColumns.find(c => c.id === selectedColumnId)!} scale={editorScale}
                onUpdate={(props) => setEditorColumns(prev => prev.map(c => c.id === selectedColumnId ? { ...c, properties: { ...c.properties, ...props } } : c))}
                onDelete={() => { setEditorColumns(prev => prev.filter(c => c.id !== selectedColumnId)); setModalType(null); }} onClose={() => setModalType(null)} onSave={() => setModalType(null)} />}

            {modalType === 'beamParams' && selectedBeamId && <BeamModal beam={editorBeams.find(b => b.id === selectedBeamId)!} scale={editorScale}
                onUpdate={(props) => setEditorBeams(prev => prev.map(b => b.id === selectedBeamId ? { ...b, properties: { ...b.properties, ...props } } : b))}
                onDelete={() => { setEditorBeams(prev => prev.filter(b => b.id !== selectedBeamId)); setModalType(null); }} onClose={() => setModalType(null)} onSave={() => setModalType(null)} />}

            {modalType === 'slabParams' && selectedSlabId && <SlabModal slab={editorSlabs.find(s => s.id === selectedSlabId)!} scale={editorScale}
                onUpdate={(props) => {
                    if (props.thickness !== undefined) setLastSlabThickness(props.thickness); // Remember thickness
                    setEditorSlabs(prev => prev.map(s => s.id === selectedSlabId ? { ...s, properties: { ...s.properties, ...props } } : s));
                }}
                onDelete={() => { setEditorSlabs(prev => prev.filter(s => s.id !== selectedSlabId)); setModalType(null); }} onClose={() => setModalType(null)} onSave={() => setModalType(null)} />}

        </div>
    );
};