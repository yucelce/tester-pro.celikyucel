// src/wix_price_mapping.ts
// Sol Taraf: cost_data.ts 'name' alanı (Birebir aynı olmalı)
// Sağ Taraf: Wix Veritabanı '_id'

export const WIX_PRICE_MAP: Record<string, string> = {
  // --- 1. PROJELENDİRME VE RESMİ GİDERLER ---
  "Mimari Proje": "mimariprojeisc",
  "Statik Proje": "statikprojeisc",
  "Mekanik Proje": "mekanikprojeisc",
  "Elektrik Projesi": "elektrikprojeisc",

  "Zemin Sondaj Birim Fiyatı": "zeminsondajmtpaket", // Wix'teki gerçek ID ile değiştirin
  "SPT Deneyi Birim Fiyatı": "sptdeneyiadetpaket",
  "Presiyometre Deneyi Birim Fiyatı": "presiyometredeneyiadetpaket",
  "Zemin Laboratuvar Paketi": 'zeminlaboratuvarpaket',

  "Haritacı Ücreti (Lihkab)": "likhap1000m2altiisc",
  "Akustik Rapor": "akustikraporisc",
  "Yapı Denetim Hizmet Bedeli": "yapidenetim",
"Ruhsat Harcı": "ruhsatm2buyuksehirpaket", 
  "İskan Harcı": "iskanm2buyuksehirpaket",
  "Şantiye Şefi (Aylık)": "santiyesefiisc",
  "Enerji Kimlik Belgesi": "enerjikimlikisc",
  "Şantiye Su ve Elektrik Abonelikleri": "santiyeabonelik",
  "Tapu Döner Sermaye": "tapudonersermayeisc",
  "Elektrik Güvence Birim Bedeli": "elektrikabonelikkwpaket", // Wix ID'niz
  "Su Abonelik Paket Bedeli": "suabonelikisc",             // Wix ID'niz

  "Noter Yazı Ücreti": "noteryaziisc",
  "Arsa Rayiç Bedeli (Maliyet)": "arsarayic",
  "Emlak Vergisi Tutarı": "emlakvergisi",
  "Yeşil Etiket (Asansör Ruhsat)": "asansoryesiletiketisc",
  "Sıva Alçısı (kg)": "alcimal",
  "Saten Alçı (kg)": "satenalcimal",
  "Astar Boya (kg)": "boyaastar",
  "İç Cephe Boyası (kg)": "boyamal",

  "Yapı Sınıfı 3A": "yapi3asinifipaket",
  "Yapı Sınıfı 3B": "yapi3bsinifipaket",
  "Yapı Sınıfı 3C": "yapi3csinifipaket",
  "Yapı Sınıfı 4A": "yapi4asinifipaket",
  "Yapı Sınıfı 4B": "yapi4bsinifipaket",
  "Standart Sözleşme Harcı": "standartsozlesmeharciisc",
  "Noter İşlem Ücreti (Daire Başı)": "noterislemdairebasi",
  "Mevcut Bina Yıkım Ruhsat Bedeli": "yikimruhsatim2fiyatpaket",

  "OSGB Hizmet Bedeli (Aylık)": "osgbhizmetaylikisc",
  "İSG Kişisel Koruyucu Donanım (Baret, Yelek vb.)": "isgmalzeme10kisimal",
  "Dış Cephe Güvenlik Ağı ve Kenar Koruma": "guvenlikagim2mal",

  // --- 2. ŞANTİYE VE HAFRİYAT ---
  "Hafriyat (Kazı ve Döküm)": "hafriyatpaket",
  "İş Makinesi (JCB/Ekskavatör)": "jcbpaket",
  "Şantiye Çiti (Çevirme)": "santiyecevrecitpaket",
  "Konteyner (Ofis/Depo)": "konteynermal",
  "Şantiye Elektrik Tüketimi (Aylık)": "elektriktuketimmal",
  "Şantiye Su Tüketimi (Aylık)": "sutuketimmal",
  "Su Drenaj Sistemi": "drenajmtpaket",
  "Kırıcı İş Makinesi Farkı (Kayalık)": "ekskavatorsaatpaket",
  "Püskürtme Beton (İksa)": "puskurtmebetonm2paket",
  "Kule Vinç Aylık Kira ve Operatör": "kulevincaylikpaket",
  "Kule Vinç Kurulum ve Söküm Bedeli": "kulevincaylikpaket",
  "Şantiye Araç Giderleri (Aylık)": "santiyearacpaket",
  "Şantiye Personel Giderleri (Bekçi vb.)": "santiyepersonelisc",
  "Mobil Vinç Hizmet Bedeli": 'mobilvincpaket',
  "Kuyu Temel Kazı İşçiliği": "kuyutemelm3kaziisc",
  "Kuyu Temel Kalıp ve Donatı İşçiliği": "kuyutemelm2iscisc",


  // --- 3. KABA YAPI ---
  "Betonarme Betonu (C30)": "betonmal",
  "İnşaat Demiri": "demirmal",
  "Kalıp İşçiliği & Malzeme": "kalipdemirbetonisc",
  "Temel Su Yalıtımı (Bohçalama)": "membranmalisc",
  "Çatı Konstrüksiyon ve Kaplama": "catipaket",

  "Balkon ve Teras Su Yalıtımı": "banyoyalitimpaket",

  "Kalıp Yağı (Litre)": "kalipyagiltmal",
  "Kereste (m3)": "kerestem3mal",

  "Yangın Kapısı (Adet)": "yanginkapisimal",


  // YENİ EKLENEN: cost_data.ts ile eşleşmeli
  "Banyo ve Islak Hacim Su Yalıtımı": "banyoyalitimpaket",
  "Sert Zemin / Yürüyüş Yolu": "kilittasmalisc",
  "Bahçe / Çevre Duvarı": "bahceduvarimtpaket",
  "Çim Ekimi ve Otomatik Sulama Sistemi":"cim_ve_sulama_sistemi_m2paket",

  "Mutfak Evyesi": "evyemal",

  // --- 4. DUVAR VE TAVAN ---
  "Gazbeton Blok (m3)": "gazbetonmalm3mal",
  "Tuğla Blok (m3)": "tuglamalm3mal", // veya maltuglamalm3mal
  "Bims Blok (m3)": "bimsmalm3mal",
  "Gazbeton İşçiliği (m2)": "gazbetonisc",
  "Tuğla İşçiliği (m2)": "tuglaisc",
  "Bims İşçiliği (m2)": "bimsisc",
  "İç Sıva (Kara Sıva)": "karasivapaket",
  "Alçı Sıva (Kaba+Saten)": "alcikabasatenpaket",
  "İç Cephe Boyası": "boyamalisc",
  "Tavan Boyası": "tavanboyamalisc",
  "Asma Tavan (Alçıpan)": "asmatavan",
  "Kartonpiyer / Stropiyer": "alcikartonpiyermalisc",
  // HARÇ VE YAPIŞTIRICI EŞLEŞTİRMELERİ
  "Duvar Örme Harcı (Kara Harç)": "harcm3paket", // 
  "Gazbeton Yapıştırıcısı": "ytongyapistiricimal", // 

  // --- 5. DIŞ CEPHE VE YALITIM ---
  // --- 5. DIŞ CEPHE VE YALITIM ---
  // Eskisi: "Mantolama (Malz.+İşçilik)": "mantolamamalisc",
  "Mantolama Malzemesi": "mantolamamal",
  "Mantolama İşçiliği": "mantolamaisc",

  // --- 6. ZEMİN VE MERDİVEN ---
  // Eskisi: "Şap Atılması (Malz.+İşçilik)": "sappaket",
 "Şap Malzemesi": "sapmalzemesi",
  "Şap İşçiliği": "sapisciligi",

  "PVC Pencere (Doğrama)": "pvcpencerepaket",
  "Mermer Denizlik": "denizlikmalisc",
  "Balkon Korkulukları (Alüminyum)": "aluminyumkorkulukpaket",
  "İskele Kirası (Aylık)": "iskelepaket", //iskele aym2 fiyatı
  "İskele Kurulum/Söküm": "iskelekursokisc",
  "Cam Balkon Sistemleri": "cambalkonm2paket",
  "Giydirme Cephe (Kompozit vb.)": "kompozitpaket",
  "Pencere Söveleri": "sovemalisc",

  // --- 6. ZEMİN VE MERDİVEN ---
  "Şap Atılması (Malz.+İşçilik)": "sappaket",
  "Laminat Parke (Anahtar Teslim)": "parkepaket",
  "Seramik Kaplama": "seramikmalisc",
  "Merdiven Mermer Kaplama": "basamakmalisc",
  "Merdiven Korkuluğu": "aluminyumkorkulukpaket",
  "Süpürgelik": "supurgelikmalisc",
  "Sahanlık ve Kat Holü Mermer": "sahanlikmalisc",
  "Mermer Harcı ve Kumu": "harcm3paket",

  "Seramik Yapıştırıcısı": "seramikyapistiricimal",
  "Seramik Derz Dolgusu": "seramikderzmal",

  "Çimento (kg)": "cimentomal",
  "Kum (m3)": "kummal",

  // --- 7. İNCE İŞLER ---
  // --- 7. İNCE İŞLER (LİSTEDEN EŞLEŞTİRİLDİ) ---
  "Çelik Kapı (Daire Giriş)": "dairekapipaket",       // Fiyat: 26.910 TL
  "İç Kapı (Panel/Lake)": "odakapisipaket",           // Fiyat: 4.920 TL
  "Mutfak Dolabı (Standart)": "mutfakdolabipaket",    // Fiyat: 6.985 TL
  "Mutfak Tezgahı (Granit/Çimstone)": "tezgahpaket",  // Fiyat: 6.990 TL
  "Banyo Dolabı & Lavabo": "banyodolabisetpaket",     // Fiyat: 6.210 TL
  "Klozet Takımı (Gömme Rezervuar)": "klozetsetipaket", // Fiyat: 6.830 TL
  "Duşakabin": "dusakabinpaket",                      // Fiyat: 10.350 TL
  "Batarya Grubu (Mutfak/Banyo)": "lavabobataryasimal", // Fiyat: 1.605 TL (En yakın eşleşme)
  "Bina Giriş Kapısı (Ana)": "binakapisimal",         // Fiyat: 60.876 TL
  "Portmanto / Vestiyer": "portmantomal",                        // Fiyat: 17.340 TL
  "Daire İç Merdiven": "dubleksmerdivenipaket",   // Fiyat: 72.460 TL
  "Davlumbaz / Aspiratör": "davlumbazmal",              // Fiyat: 4.915 TL
  // Fiyat: 3.880 TL
  "Lavabo Bataryası": "lavabobataryasimal", // Banyo/Lavabo için
  "Evye Bataryası": "evyebataryasimal",     // Mutfak için               // Fiyat: 3.625 TL
  "Duş Seti (Başlık/Hortum)": "dussetimal",           // Fiyat: 2.588 TL

  // --- 8. MEKANİK TESİSAT ---
  "Sıhhi Tesisat (Temiz+Pis Su)": "sihhitesisatisc", // cost_data'daki isim güncellendi
  "Kombi ve Baca Montajı": "kombipaket",
  "Kalorifer Altyapısı (Mobil Sistem)": "isitmatesisatim2malisc",
  "Panel Radyatör (DemirDöküm vb.)": "radyatormal",
  "Radyatör Montaj ve Vanalar": "radyatorbaglantilariadetmalisc",
  "Yağmur Suyu Hasat Sistemi (Zorunlu)": "yagmursuyuhasatsistemi2000ltpaket",

  // YENİ: Yerden Isıtma Kalemleri (Wix'te bu ID'leri açmanız gerekebilir)
  "Yerden Isıtma (Strafor+Boru+İşçilik)": "yerdenisitmam2paket",
  "Yerden Isıtma Kollektörü ve Kutusu": "yerdenisitmakollektoradetpaket",

  // İsim Düzeltmesi: (Bina) eklendi
  "Doğalgaz Proje ve Onay Bedeli": "dogalgazprojeonaybedeliisc",
  "Doğalgaz Bina Ana Altyapısı": "dogalgazaltyapipaket", // (Opsiyonel paket ID)

  "Doğalgaz Kolon Hattı (mt) Birim": "dogalgazkolonhattimtmalisc", // Wix mt fiyatı
  "Doğalgaz Daire Başı Set Birim": "dogalgazdairebasisetadetmalisc", // Wix set fiyatı

  "Asansör (Paket)": "asansor2durakpaket",
  "Yangın Tesisatı (Dolap+Hat)": "yangindolabimal",
  "Modüler Su Deposu (2m3 Paket)": "sudeposu2m3mal",
  "Hidrofor Sistemi": "hidraformal",
  "Klima Altyapısı (Bakır Borulama)": "klimamal",

  // --- 9. ELEKTRİK TESİSATI (YENİ SİSTEM) ---
  // cost_data.ts'deki yeni isimler buraya eklendi.
  // Wix tarafında bu ID'lerin karşılığı fiyat olmalı (yoksa eski 'elektriktesisatm2paket' fiyatını kullanabilir veya yeni ID açabilirsiniz).

  "Kuvvetli Akım Sorti (Priz/Aydınlatma)": "kuvvetliakimsortiadetpaket", // Yeni ID gerekli
  "Zayıf Akım Sorti (TV/Data/Tel)": "zayifliakimsortiadetpaket",       // Yeni ID gerekli
  "Anahtar/Priz Montajı ve Malzemesi": "anahtarprizadetpaket",             // Mevcut ID kullanılabilir
  "Daire Sigorta Panosu ve Şalt Malz.": "dairesigortasalterpaket",          // Mevcut ID kullanılabilir

  "Görüntülü Diafon Sistemi": "goruntuludiyafonpaket",
  "Merkezi Uydu Sistemi": "uydusistemipaket",
  "Kamera ve Güvenlik Altyapısı": "kamerasistemi8lipaket",
  "Cephe Aydınlatma (Wallwasher)": "cepheaydinlatmamtpaket",
  "Jeneratör (Ortak Alan)": "jenerator",
  "Şantiye Elektrik Panosu (Geçici)": "santiyepanosumal"
};