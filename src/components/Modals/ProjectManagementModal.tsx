
import React, { useState, useEffect } from 'react';
import { useProjectStore } from '../../stores/projectStore';
import { useUIStore } from '../../stores/uiStore';
import { SavedProject } from '../../types';

interface ProjectManagementModalProps {
    onClose: () => void;
}

export const ProjectManagementModal: React.FC<ProjectManagementModalProps> = ({ onClose }) => {
    const { fetchProjects, saveProject, loadProject, deleteProject, startNewProject } = useProjectStore();
    const { accountId } = useUIStore();
    const [projects, setProjects] = useState<SavedProject[]>([]);
    const [newProjectName, setNewProjectName] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    const [showNewProjectPanel, setShowNewProjectPanel] = useState(false);
    const [newProjectType, setNewProjectType] = useState<'apartment' | 'villa'>('apartment');

    const handleStartNew = () => {
        if (window.confirm(`Yeni bir ${newProjectType === 'villa' ? 'Villa' : 'Apartman'} projesi başlatılacak. Devam edilsin mi?`)) {
            startNewProject(newProjectType);
            setShowNewProjectPanel(false);
            onClose();
        }
    };

    useEffect(() => {
        loadList();
    }, []);

    const loadList = async () => {
        setIsLoading(true);
        const list = await fetchProjects();
        setProjects(list);
        setIsLoading(false);
    };

    const handleSave = async () => {
        if (!newProjectName.trim()) return;
        setIsLoading(true);
        const result = await saveProject(newProjectName);
        if (result.success) {
            await loadList();
            setNewProjectName('');
            setMessage({ type: 'success', text: result.message });
            setTimeout(() => setMessage(null), 3000);
        } else {
            setMessage({ type: 'error', text: result.message });
            setIsLoading(false);
        }
    };

    const handleLoad = (project: SavedProject) => {
        if (window.confirm(`"${project.name}" projesi yüklenecek. Kaydedilmemiş değişiklikler kaybolabilir. Devam edilsin mi?`)) {
            loadProject(project);
            onClose();
        }
    };

    const handleDelete = async (id: string) => {
        if (window.confirm("Bu projeyi silmek istediğinize emin misiniz?")) {
            setIsLoading(true);
            await deleteProject(id);
            await loadList();
        }
    };

    return (
        <div className="fixed inset-0 bg-black/80 z-50 flex justify-center items-center backdrop-blur-sm p-4">
            <div className="bg-slate-900 border border-slate-700 rounded-xl shadow-2xl w-full max-w-lg flex flex-col max-h-[90vh]">
                <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/50 rounded-t-xl">
                    <div>
                        <h3 className="text-white font-bold text-lg"><i className="fas fa-folder-open mr-2 text-blue-500"></i>Proje Yönetimi</h3>
                        {accountId ?
                            <p className="text-xs text-green-400">Pro Üye Modu (Bulut Kayıt Aktif)</p> :
                            <p className="text-xs text-yellow-500">Misafir Modu (Veriler tarayıcıda saklanır)</p>
                        }
                    </div>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><i className="fas fa-times text-lg"></i></button>
                </div>
                <div className="p-4 border-b border-slate-700 bg-slate-800/20">
                    <button
                        onClick={() => setShowNewProjectPanel(v => !v)}
                        className="w-full flex items-center justify-between text-sm font-bold text-green-400 hover:text-green-300 transition"
                    >
                        <span><i className="fas fa-plus-circle mr-2"></i>Yeni Proje Başlat</span>
                        <i className={`fas fa-chevron-${showNewProjectPanel ? 'up' : 'down'} text-xs`}></i>
                    </button>

                    {showNewProjectPanel && (
                        <div className="mt-3 space-y-3 animate-fadeIn">
                            <p className="text-xs text-slate-400">Proje tipini seçin.</p>
                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setNewProjectType('apartment')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition
                        ${newProjectType === 'apartment' ? 'border-blue-500 bg-blue-900/20' : 'border-slate-700'}`}
                                >
                                    <i className="fas fa-building text-2xl text-blue-400"></i>
                                    <span className="text-xs font-bold text-white">Apartman</span>
                                </button>
                                <button
                                    onClick={() => setNewProjectType('villa')}
                                    className={`flex flex-col items-center gap-2 p-3 rounded-lg border-2 transition
                        ${newProjectType === 'villa' ? 'border-orange-500 bg-orange-900/20' : 'border-slate-700'}`}
                                >
                                    <i className="fas fa-home text-2xl text-orange-400"></i>
                                    <span className="text-xs font-bold text-white">Villa / Müstakil</span>
                                </button>
                            </div>
                            <button
                                onClick={handleStartNew}
                                className="w-full bg-green-700 hover:bg-green-600 text-white py-2 rounded-lg font-bold text-sm transition"
                            >
                                {newProjectType === 'villa' ? 'Villa Projesi' : 'Apartman Projesi'} Oluştur
                            </button>
                        </div>
                    )}
                </div>
                <div className="p-4 border-b border-slate-700 bg-slate-800/30">
                    <label className="text-xs text-slate-400 font-bold block mb-1">Mevcut Projeyi Kaydet</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={newProjectName}
                            onChange={(e) => setNewProjectName(e.target.value)}
                            placeholder="Proje Adı Giriniz..."
                            className="flex-1 bg-slate-950 border border-slate-700 rounded p-2 text-white text-sm focus:border-blue-500 outline-none"
                        />
                        <button
                            onClick={handleSave}
                            disabled={!newProjectName.trim() || isLoading}
                            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white px-4 py-2 rounded font-bold text-sm transition flex items-center gap-2"
                        >
                            {isLoading ? <i className="fas fa-spinner fa-spin"></i> : null}
                            Kaydet
                        </button>
                    </div>
                    {message && (
                        <div className={`mt-2 text-xs p-2 rounded ${message.type === 'success' ? 'bg-green-900/30 text-green-400' : 'bg-red-900/30 text-red-400'}`}>
                            {message.text}
                        </div>
                    )}
                </div>

                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-bold text-white">Kayıtlı Projeler</span>
                        <span className="text-xs text-slate-500">{projects.length} / {accountId ? '10' : '5'}</span>
                    </div>

                    {isLoading && projects.length === 0 ? (
                        <div className="text-center py-8 text-blue-400 text-sm">
                            <i className="fas fa-spinner fa-spin mr-2"></i> Yükleniyor...
                        </div>
                    ) : projects.length === 0 ? (
                        <div className="text-center py-8 text-slate-500 text-sm border-2 border-dashed border-slate-700 rounded">
                            Henüz kaydedilmiş proje yok.
                        </div>
                    ) : (
                        <div className="space-y-2">
                            {projects.map(p => (
                                <div key={p.id} className="bg-slate-800 border border-slate-700 rounded p-3 flex justify-between items-center hover:bg-slate-700/50 transition">
                                    <div>
                                        <div className="text-white font-bold text-sm">{p.name}</div>
                                        <div className="text-[10px] text-slate-500">
                                            {new Date(p.lastModified).toLocaleDateString()} {new Date(p.lastModified).toLocaleTimeString()}
                                        </div>
                                        {p.data?.buildingStats?.buildingType === 'villa' && (
                                            <span className="inline-flex items-center gap-1 mt-1 bg-orange-500/10 border border-orange-500/30 text-orange-400 text-[9px] font-bold px-1.5 py-0.5 rounded-full">
                                                <i className="fas fa-home text-[8px]"></i> VİLLA
                                            </span>
                                        )}
                                    </div>
                                    <div className="flex gap-2">
                                        <button onClick={() => handleLoad(p)} disabled={isLoading} className="bg-green-600 hover:bg-green-500 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs font-bold">Yükle</button>
                                        <button onClick={() => handleDelete(p.id)} disabled={isLoading} className="bg-red-600 hover:bg-red-500 disabled:opacity-50 text-white px-3 py-1.5 rounded text-xs font-bold"><i className="fas fa-trash"></i></button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
