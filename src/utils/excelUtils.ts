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
    reader.onload = (e) => {
        const data = e.target?.result;
        const workbook = XLSX.read(data, { type: 'binary' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const json: any[] = XLSX.utils.sheet_to_json(worksheet);

        // Excel'den dönen veride sadece "İş Kalemi" ve "Birim Fiyat (TL)" sütunlarını eşleştiriyoruz
        const newPrices = json.map(row => ({
            itemName: row["İş Kalemi"],
            price: parseFloat(row["Birim Fiyat (TL)"])
        })).filter(item => !isNaN(item.price) && item.itemName);

        callback(newPrices);
    };
    reader.readAsBinaryString(file);
};