// src/utils/excelUtils.ts
import * as XLSX from 'xlsx';

// DIŞA AKTARIM (EXPORT)
export const exportCostsToExcel = (projectCostDetails: any[]) => {
    const rows: any[] = [];
    
    // Sistemdeki hesaplanmış tüm kalemleri Excel satırlarına çeviriyoruz
    projectCostDetails.forEach(cat => {
        cat.items.forEach((item: any) => {
            // Sadece ekranda aktif olarak hesaplanan ve metrajı olan/görünen kalemleri alalım
            rows.push({
                "Kategori": cat.title,
                "İş Kalemi": item.name,
                "Miktar": item.finalQty > 0 ? Number(item.finalQty.toFixed(2)) : 0,
                "Birim": item.unit,
                "Birim Fiyat (TL)": Number(item.unit_price.toFixed(2)),
                "Toplam Tutar (TL)": Number((item.totalPrice || 0).toFixed(2))
            });
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    
    // Excel sütun genişliklerini ayarlayalım (Görsel olarak düzgün durması için)
    worksheet['!cols'] = [
        { wch: 25 }, // Kategori
        { wch: 45 }, // İş Kalemi
        { wch: 12 }, // Miktar
        { wch: 10 }, // Birim
        { wch: 15 }, // Birim Fiyat
        { wch: 18 }  // Toplam Tutar
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Kesif_Ozeti");
    
    // Dosyayı indir
    XLSX.writeFile(workbook, "Proje_Kesif_Fiyat_Listesi.xlsx");
};

// İÇE AKTARIM (IMPORT)
export const importPricesFromExcel = (file: File, callback: (prices: { itemName: string, price: number }[]) => void) => {
    const reader = new FileReader();
    
    // readAsArrayBuffer için onload işlemi
    reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Excel'den dönen veride sadece "İş Kalemi" ve "Birim Fiyat (TL)" sütunlarını eşleştiriyoruz
        const newPrices = json.map(row => {
            let priceRaw = row["Birim Fiyat (TL)"];
            let parsedPrice = 0;

            // Eğer sayı string olarak gelmişse (örn: 1.500,25) JavaScript float formatına çevirelim
            if (typeof priceRaw === 'string') {
                // 1. Binlik ayırıcıları (noktaları) temizle, virgülü noktaya (ondalık ayırıcıya) çevir
                const formattedPriceStr = priceRaw.replace(/\./g, '').replace(',', '.');
                parsedPrice = parseFloat(formattedPriceStr);
            } else if (typeof priceRaw === 'number') {
                parsedPrice = priceRaw;
            }

            return {
                itemName: row["İş Kalemi"],
                price: parsedPrice
            };
        }).filter(item => !isNaN(item.price) && item.itemName);

        callback(newPrices);
    };
    
    // Daha güvenilir okuma için BinaryString yerine ArrayBuffer kullanıyoruz
    reader.readAsArrayBuffer(file);
};

// src/utils/excelUtils.ts dosyasının en altına eklenecek

export const exportProcurementToExcel = (projectName: string, procurementGroups: any[]) => {
    const rows: any[] = [];
    
    procurementGroups.forEach(group => {
        group.items.forEach((item: any) => {
            rows.push({
                "Aşama": group.taskName,
                "Malzeme Adı": item.name,
                "Miktar": item.unit === 'Paket' ? 1 : Number(item.quantity.toFixed(2)),
                "Birim": item.unit,
                "Birim Fiyat (TL)": "", // Tedarikçi burayı dolduracak
                "Toplam Tutar (TL)": "" // Tedarikçi burayı dolduracak
            });
        });
    });

    const worksheet = XLSX.utils.json_to_sheet(rows);
    
    // Sütun genişlikleri (Tedarikçi rahat yazsın diye geniş tutuldu)
    worksheet['!cols'] = [
        { wch: 20 }, // Aşama
        { wch: 45 }, // Malzeme Adı
        { wch: 12 }, // Miktar
        { wch: 10 }, // Birim
        { wch: 20 }, // Birim Fiyat
        { wch: 20 }  // Toplam Tutar
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Teklif_Formu");
    
    // Dosya adını projenin adıyla indir
    XLSX.writeFile(workbook, `Teklif_Formu_${projectName.replace(/\s+/g, '_')}.xlsx`);
};