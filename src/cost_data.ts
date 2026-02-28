// src/cost_data.ts
export interface CostItem {
  name: string;
  unit: string;
  unit_price: number;
  auto_source: 'total_area' | 'land_area' | 'total_perimeter' | 'dry_area' | 'wet_area' | 'dry_perimeter' | 'wall_surface_area' | 'net_wall_area' | 'cornice_length' | 'manual' |
  'wall_10_area' | 'wall_13_5_area' | 'wall_15_area' | 'wall_20_area' | 'wall_25_area' |
  'calc_architectural' | 'calc_inspection' | 'calc_acoustic' | 'calc_site_chief' |
  'calc_fence' | 'calc_excavation' | 'calc_jcb' | 'calc_drainage' |
  'calc_concrete_global' | 'calc_iron_global' | 'calc_formwork_global' |
  'calc_wall_global' | 'calc_facade' | 'calc_roof' | 'calc_scaffolding_area' | 'calc_scaffolding_duration' |
  'calc_elevator' | 'calc_water_tank' | 'calc_stairs' | 'calc_stairs_railing' |
  'calc_radiator' | 'calc_kitchen_cabinet' | 'calc_radiator_mt' | "calc_radiator_qty" | 'calc_duration_months' |
  'calc_container_complex' | 'calc_rough_plaster_area' | "calc_paint_wall_area" | "calc_ceiling_paint_area" | 'calc_mortar_amount' |
  'calc_window_area' | 'calc_sill_length' | 'calc_balcony_railing' | 'calc_window_perimeter' |
  'calc_steel_door' | 'calc_inner_door' | 'calc_bathroom_cabinet' | 'calc_toilet' | 'calc_shower_cabin' |
  'calc_faucet_mixers' | 'calc_kitchen_sink' | 'calc_shower_set' | 'calc_unit_count' | 'calc_electrical_points' |
  'calc_weak_current_points' | 'calc_switch_socket_count' | 'calc_sub_panel_count' | "calc_plumbing_unit" |
  "calc_radiator_infrastructure" | "calc_radiator_count" | "calc_combi_count" | "calc_radiator_len" |
  "calc_underfloor_area" | "calc_underfloor_collector" | 'calc_soil_investigation' | "calc_tapu_noter" |
  "calc_mortar_volume" | "calc_adhesive_weight" | 'calc_satellite_system' | 'calc_tower_crane_duration' |
  'calc_mobile_crane_days' | "calc_concrete_unit" | "calc_iron_unit" | "calc_formwork_unit" | "calc_hall_area" | 'calc_marble_mortar' |
  "calc_rainwater_system" | "calc_greywater_system" | "calc_water_tank" | 'calc_tree_count' | 'calc_fire_system' |
  "calc_hydrophore" | "calc_tower_crane_setup" | "calc_fire_escape" |
  "calc_rent_assistance" | "calc_eviction_cost" | 'calc_basin_mixer' | 'calc_sink_mixer' | "calc_hard_ground" | 'calc_foundation_area' |
  "calc_isg_package" | "calc_osgb_service" | "calc_safety_net" | 'calc_hard_ground' | 'calc_foundation_area' | 'calc_well_foundation' |
  'calc_well_foundation_concrete' | 'calc_well_foundation_iron' | 'calc_well_foundation_formwork' | 'calc_well_foundation_excavation' |
  'calc_kitchen_counter_length' | "calc_haritaci" | "calc_ekb" | 'calc_utilities_subscription' | 'calc_land_tax' | 'calc_garden_wall' |
  'calc_gas_infrastructure' | "calc_gas_subscription" | "calc_demolition_supervisor" | "calc_demolition_area" |
  "calc_breaker_machine" | 'net_wet_area' | 'calc_pool_concrete' | 'calc_pool_system' | 'calc_villa_parking' |
  'calc_villa_veranda' | "calc_smart_home" | "calc_facade_composite" | 'calc_vrf_outdoor' | "calc_heat_pump" |
  "calc_vrf_indoor" | "calc_vrf_infrastructure"

  ;


  multiplier: number;
  wixId?: string;
  manualQuantity?: number;
  manualPrice?: number;
  scope?: 'global' | 'unit' | 'hidden';
  inputType?: 'quantity_x_price' | 'manual_total';
}

export interface CostCategory {
  id: string;
  title: string;
  items: CostItem[];
}

export const COST_DATA: CostCategory[] = [
  // 0. YENİ KATEGORİ: ARSA VE FİNANSMAN GİDERLERİ
  {
    id: "arsa_finansman",
    title: "0. Arsa ve Finansman Giderleri",
    items: [
      { name: "Hak Sahipleri Kira Yardımı (Toplam)", unit: "Toplam", unit_price: 1, auto_source: "calc_rent_assistance", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Hak Sahipleri Tahliye/Taşınma Bedeli", unit: "Toplam", unit_price: 1, auto_source: "calc_eviction_cost", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Tapu Harçları ve Noter Masrafları", unit: "Toplam", unit_price: 35000, auto_source: "calc_tapu_noter", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Emlak Vergisi Tutarı", unit: "Toplam", unit_price: 5000, auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Arsa Rayiç Bedeli (Maliyet)", unit: "Toplam", unit_price: 0, auto_source: "calc_land_tax", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Tapu Döner Sermaye", unit: "Adet", unit_price: 2500, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Noter Yazı Ücreti", unit: "Adet", unit_price: 4500, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Standart Sözleşme Harcı", unit: "Adet", unit_price: 8000, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Noter İşlem Ücreti (Daire Başı)", unit: "Adet", unit_price: 800, auto_source: "manual", multiplier: 0, scope: 'hidden' },
    ]
  },

  // 1. RESMİ & İDARİ GİDERLER (Finansmandan arındırıldı)
  {
    id: "resmi_idari",
    title: "1. Projelendirme ve Resmi Giderler",
    items: [
      { name: "Mimari Proje", unit: "m2", unit_price: 270, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Statik Proje", unit: "m2", unit_price: 67, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Mekanik Proje", unit: "m2", unit_price: 61, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Elektrik Projesi", unit: "m2", unit_price: 56, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Zemin Etüdü", unit: "Paket", unit_price: 1, auto_source: "calc_soil_investigation", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Zemin Sondaj Birim Fiyatı", unit: "mt", unit_price: 850, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "SPT Deneyi Birim Fiyatı", unit: "Adet", unit_price: 450, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Presiyometre Deneyi Birim Fiyatı", unit: "Adet", unit_price: 900, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Zemin Laboratuvar Paketi", unit: "Paket", unit_price: 3500, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Haritacı Ücreti (Lihkab)", unit: "Paket", unit_price: 8000, auto_source: "calc_haritaci", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Akustik Rapor", unit: "m2", unit_price: 3, auto_source: "calc_acoustic", multiplier: 1, scope: 'global' },
      { name: "Yapı Denetim Hizmet Bedeli", unit: "Paket", unit_price: 1, auto_source: "calc_inspection", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Yapı Sınıfı 3A", unit: "m2", unit_price: 19800, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yapı Sınıfı 3B", unit: "m2", unit_price: 21050, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yapı Sınıfı 3C", unit: "m2", unit_price: 23400, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yapı Sınıfı 4A", unit: "m2", unit_price: 26450, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yapı Sınıfı 4B", unit: "m2", unit_price: 33900, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yıkım Teknik Sorumlu Ücreti", unit: "Paket", unit_price: 15000, auto_source: "calc_demolition_supervisor", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Mevcut Bina Yıkım Ruhsat Bedeli", unit: "Paket", unit_price: 350, auto_source: "calc_demolition_area", multiplier: 1, scope: 'global', inputType: 'manual_total' }, // <--- BU SATIR GÜNCELLENDİ      { name: "Ruhsat Harcı", unit: "m2", unit_price: 840, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "İskan Harcı", unit: "m2", unit_price: 360, auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Şantiye Şefi (Aylık)", unit: "Ay", unit_price: 90000, auto_source: "calc_site_chief", multiplier: 1, scope: 'global' },
      { name: "Enerji Kimlik Belgesi", unit: "Paket", unit_price: 3000, auto_source: "calc_ekb", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Yeşil Etiket (Asansör Ruhsat)", unit: "Toplam", unit_price: 5000, auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      // id: "resmi_idari" içerisindeki items dizisine ekleyin:
      { name: "OSGB Hizmet Bedeli (Aylık)", unit: "Ay", unit_price: 12000, auto_source: "calc_osgb_service", multiplier: 1, scope: 'global' },
    ]
  },

  // 2. ŞANTİYE & HAFRİYAT (Pano eklendi)
  {
    id: "santiye_hafriyat",
    title: "2. Şantiye Kurulumu ve Hafriyat",
    items: [
      { name: "Hafriyat (Kazı ve Döküm)", unit: "m3", unit_price: 450, auto_source: "calc_excavation", multiplier: 1, scope: 'global' },
      { name: "Kuyu Temel Kazı İşçiliği", unit: "m3", unit_price: 1200, auto_source: "calc_well_foundation_excavation", multiplier: 1, scope: 'global' },
      { name: "Kuyu Temel Betonu (C30)", unit: "m3", unit_price: 3890, auto_source: "calc_well_foundation_concrete", multiplier: 1, wixId: "betonmal", scope: 'global' },
      { name: "Kuyu Temel Demiri", unit: "ton", unit_price: 30600, auto_source: "calc_well_foundation_iron", multiplier: 1, wixId: "demirmal", scope: 'global' },
      { name: "Kuyu Temel Kalıp ve Donatı İşçiliği", unit: "m2", unit_price: 1800, auto_source: "calc_well_foundation_formwork", multiplier: 1, wixId: "kuyutemelm3kaziisc", scope: 'global' },
      { name: "İş Makinesi (JCB/Ekskavatör)", unit: "Saat", unit_price: 2500, auto_source: "calc_jcb", multiplier: 1, scope: 'global' },
      { name: "Şantiye Çiti (Çevirme)", unit: "mt", unit_price: 350, auto_source: "calc_fence", multiplier: 1, scope: 'global' },
      { name: "Konteyner (Ofis/Depo)", unit: "Adet", unit_price: 65000, auto_source: "calc_container_complex", multiplier: 1, scope: 'global' },
      { name: "Şantiye Su ve Elektrik Abonelikleri", unit: "Toplam", unit_price: 15000, auto_source: "calc_utilities_subscription", multiplier: 1, scope: 'global', inputType: 'manual_total' },

      { name: "Şantiye Elektrik Panosu (Geçici)", unit: "Toplam", unit_price: 12000, auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total' }, // <- Elektrikten taşındı


      // YENİ HALİ (EKLENECEK):
      { name: "Şantiye Elektrik Tüketimi (Aylık)", unit: "Ay", unit_price: 2.5, auto_source: "calc_duration_months", multiplier: 1, scope: 'global', wixId: "elektriktuketimmal" },
      { name: "Şantiye Su Tüketimi (Aylık)", unit: "Ay", unit_price: 25, auto_source: "calc_duration_months", multiplier: 1, scope: 'global', wixId: "sutuketimmal" },

      { name: "Su Drenaj Sistemi", unit: "mt", unit_price: 450, auto_source: "calc_drainage", multiplier: 1, scope: 'global' },
      { name: "Kırıcı İş Makinesi Farkı (Kayalık)", unit: "Saat", unit_price: 3500, auto_source: "calc_breaker_machine", multiplier: 1, scope: 'global' }, { name: "Püskürtme Beton (İksa)", unit: "m2", unit_price: 650, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Kule Vinç Aylık Kira ve Operatör", unit: "Ay", unit_price: 85000, auto_source: "calc_tower_crane_duration", multiplier: 1, scope: 'global' },
      { name: "Kule Vinç Kurulum ve Söküm Bedeli", unit: "Paket", unit_price: 180000, auto_source: "calc_tower_crane_setup", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Mobil Vinç Hizmet Bedeli", unit: "Gün", unit_price: 18000, auto_source: "calc_mobile_crane_days", multiplier: 1, scope: 'global' },
      { name: "Şantiye Araç Giderleri (Aylık)", unit: "Ay", unit_price: 25000, auto_source: "calc_duration_months", multiplier: 1, scope: 'global' },
      { name: "Şantiye Personel Giderleri (Bekçi vb.)", unit: "Ay", unit_price: 35000, auto_source: "calc_duration_months", multiplier: 1, scope: 'global' },
      // id: "santiye_hafriyat" içerisindeki items dizisine ekleyin:
      { name: "İSG Kişisel Koruyucu Donanım (Baret, Yelek vb.)", unit: "Paket", unit_price: 25000, auto_source: "calc_isg_package", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Dış Cephe Güvenlik Ağı ve Kenar Koruma", unit: "m2", unit_price: 180, auto_source: "calc_safety_net", multiplier: 1, scope: 'global' },
    ]
  },

  // 3. KABA İNŞAAT (Banyo Su Yalıtımı Çıkarıldı)
  {
    id: "kaba_insaat",
    title: "3. Kaba Yapı (Betonarme ve Çatı)",
    items: [
      { name: "Betonarme Betonu (C30)", unit: "m3", unit_price: 3890, auto_source: "calc_concrete_global", multiplier: 1, wixId: "betonmal", scope: 'global' },
      { name: "İnşaat Demiri", unit: "ton", unit_price: 30600, auto_source: "calc_iron_global", multiplier: 1, wixId: "demirmal", scope: 'global' },
      { name: "Kalıp İşçiliği & Malzeme", unit: "m2", unit_price: 1347, auto_source: "calc_formwork_global", multiplier: 1, wixId: "kalipdemirbetonisc", scope: 'global' },
      { name: "Temel Su Yalıtımı (Bohçalama)", unit: "m2", unit_price: 450, auto_source: "calc_foundation_area", multiplier: 1.1, scope: 'global' },
      { name: "Çatı Konstrüksiyon ve Kaplama", unit: "m2", unit_price: 2200, auto_source: "calc_roof", multiplier: 1, scope: 'global' },
      { name: "Balkon ve Teras Su Yalıtımı", unit: "m2", unit_price: 350, auto_source: "total_area", multiplier: 0.15, scope: 'global' },
      { name: "İnşaat Çivisi (kg)", unit: "kg", unit_price: 45, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Kalıp Yağı (Litre)", unit: "Litre", unit_price: 60, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Kereste (m3)", unit: "m3", unit_price: 8500, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Bağ Teli (kg)", unit: "kg", unit_price: 55, auto_source: "manual", multiplier: 0, scope: 'hidden' },
    ]
  },

  // 4. DUVAR VE TAVAN İŞLERİ (Değişiklik Yok)
  {
    id: "duvar_tavan",
    title: "4. Duvar, Tavan ve Alçı İşleri",
    items: [
      { name: "Gazbeton Blok (m3)", unit: "m3", unit_price: 2650, auto_source: "manual", multiplier: 0, wixId: "gazbetonmalm3", scope: 'hidden' },
      { name: "Tuğla Blok (m3)", unit: "m3", unit_price: 2100, auto_source: "manual", multiplier: 0, wixId: "tuglamalm3mal", scope: 'hidden' },
      { name: "Bims Blok (m3)", unit: "m3", unit_price: 2800, auto_source: "manual", multiplier: 0, wixId: "bimsmalm3mal", scope: 'hidden' },
      { name: "Gazbeton İşçiliği (m2)", unit: "m2", unit_price: 250, auto_source: "manual", multiplier: 0, wixId: "gazbetonisc", scope: 'hidden' },
      { name: "Tuğla İşçiliği (m2)", unit: "m2", unit_price: 280, auto_source: "manual", multiplier: 0, wixId: "tuglaisc", scope: 'hidden' },
      { name: "Bims İşçiliği (m2)", unit: "m2", unit_price: 240, auto_source: "manual", multiplier: 0, wixId: "bimsisc", scope: 'hidden' },
      { name: "Duvar Malzemesi (10 cm)", unit: "m2", unit_price: 0, auto_source: "wall_10_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (10 cm)", unit: "m2", unit_price: 0, auto_source: "wall_10_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Malzemesi (13.5 cm)", unit: "m2", unit_price: 0, auto_source: "wall_13_5_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (13.5 cm)", unit: "m2", unit_price: 0, auto_source: "wall_13_5_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Malzemesi (15 cm)", unit: "m2", unit_price: 0, auto_source: "wall_15_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (15 cm)", unit: "m2", unit_price: 0, auto_source: "wall_15_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Malzemesi (20 cm)", unit: "m2", unit_price: 0, auto_source: "wall_20_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (20 cm)", unit: "m2", unit_price: 0, auto_source: "wall_20_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Malzemesi (25 cm)", unit: "m2", unit_price: 0, auto_source: "wall_25_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (25 cm)", unit: "m2", unit_price: 0, auto_source: "wall_25_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Örme Harcı (Kara Harç)", unit: "m3", unit_price: 2195, auto_source: "calc_mortar_volume", multiplier: 1, wixId: "harcm3paket", scope: 'global' },
      { name: "Gazbeton Yapıştırıcısı", unit: "kg", unit_price: 4, auto_source: "calc_adhesive_weight", multiplier: 1, wixId: "ytongyapistiricimal", scope: 'global' },
      { name: "İç Sıva (Kara Sıva)", unit: "m2", unit_price: 237.6, auto_source: "calc_rough_plaster_area", multiplier: 1, wixId: "karasivaisc", scope: 'unit' },
      { name: "Alçı Sıva (Kaba+Saten)", unit: "m2", unit_price: 206, auto_source: "calc_paint_wall_area", multiplier: 1, wixId: "alciisc", scope: 'unit' },
      { name: "İç Cephe Boyası", unit: "m2", unit_price: 195.6, auto_source: "calc_paint_wall_area", multiplier: 1, wixId: "boyamalisc", scope: 'unit' },
      { name: "Tavan Boyası", unit: "m2", unit_price: 38, auto_source: "calc_ceiling_paint_area", multiplier: 1, wixId: "tavanboyamal", scope: 'unit' },
      { name: "Asma Tavan (Alçıpan)", unit: "m2", unit_price: 390, auto_source: "manual", multiplier: 1, wixId: "asmatavanm2malisc", scope: 'unit' },
      { name: "Kartonpiyer / Stropiyer", unit: "mt", unit_price: 126, auto_source: "cornice_length", multiplier: 1, wixId: "alcikartonpiyermalisc", scope: 'unit' },

      { name: "Sıva Alçısı (Torba)", unit: "Adet", unit_price: 140, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Saten Alçı (Torba)", unit: "Adet", unit_price: 160, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Astar Boya (Kova)", unit: "Adet", unit_price: 950, auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "İç Cephe Boyası (Kova)", unit: "Adet", unit_price: 2100, auto_source: "manual", multiplier: 0, scope: 'hidden' },


    ]
  },

  // 5. DIŞ CEPHE VE YALITIM (Yangın Merdiveni Eklendi)
  {
    id: "dis_cephe",
    title: "5. Dış Cephe ve Yalıtım",
    items: [
      { name: "Mantolama (Malz.+İşçilik)", unit: "m2", unit_price: 1200, auto_source: "calc_facade", multiplier: 1, scope: 'global' },
      { name: "PVC Pencere (Doğrama)", unit: "m2", unit_price: 4500, auto_source: "calc_window_area", multiplier: 1, scope: 'unit' },
      { name: "Mermer Denizlik", unit: "mt", unit_price: 750, auto_source: "calc_sill_length", multiplier: 1, scope: 'unit' },
      { name: "Balkon Korkulukları (Alüminyum)", unit: "mt", unit_price: 1800, auto_source: "calc_balcony_railing", multiplier: 1, scope: 'unit' },
      { name: "İskele Kirası (Aylık)", unit: "Ay", unit_price: 35, auto_source: "calc_scaffolding_duration", multiplier: 1, scope: 'global' },
      { name: "İskele Kurulum/Söküm", unit: "m2", unit_price: 150, auto_source: "calc_scaffolding_area", multiplier: 1, scope: 'global' },
      { name: "Cam Balkon Sistemleri", unit: "m2", unit_price: 3500, auto_source: "manual", multiplier: 1, scope: 'global' },
{ name: "Giydirme Cephe (Kompozit vb.)", unit: "m2", unit_price: 2800, auto_source: "calc_facade_composite", multiplier: 0.25, scope: 'global' },     
 { name: "Pencere Söveleri", unit: "mt", unit_price: 120, auto_source: "calc_window_perimeter", multiplier: 1, scope: 'unit' },
      { name: "Yangın Merdiveni (Çelik)", unit: "Kat", unit_price: 1, auto_source: "calc_fire_escape", multiplier: 1, scope: 'global', inputType: 'manual_total' }, // <- Zeminden taşındı
      { name: "Yangın Kapısı (Adet)", unit: "Adet", unit_price: 18000, auto_source: "manual", multiplier: 0, scope: 'hidden' },
    ]
  },

  // 6. ZEMİN VE MERDİVEN (Banyo Yalıtım Eklendi, Yangın Merdiveni Gitti)
  {
    id: "zemin_kaplama",
    title: "6. Zemin Kaplamaları ve Merdiven",
    items: [
      { name: "Banyo ve Islak Hacim Su Yalıtımı", unit: "m2", unit_price: 400, auto_source: "wet_area", multiplier: 1.1, scope: 'unit' }, // <- Kabadan taşındı
      { name: "Şap Atılması (Malz.+İşçilik)", unit: "m2", unit_price: 180, auto_source: "total_area", multiplier: 1, wixId: "sappaket", scope: 'unit' },
      { name: "Laminat Parke (Anahtar Teslim)", unit: "m2", unit_price: 750, auto_source: "dry_area", multiplier: 1, wixId: "parkepaket", scope: 'unit' },
      { name: "Seramik Kaplama", unit: "m2", unit_price: 1100, auto_source: "wet_area", multiplier: 1, wixId: "seramikmal", scope: 'unit' }, // Sadece Kaplama Fireli Kalıyor
      { name: "Seramik Yapıştırıcısı", unit: "kg", unit_price: 10, auto_source: "net_wet_area", multiplier: 5, wixId: "seramikyapistirici", scope: 'unit' },
      { name: "Seramik Derz Dolgusu", unit: "kg", unit_price: 25, auto_source: "net_wet_area", multiplier: 0.5, wixId: "seramikderz", scope: 'unit' }, 
      { name: "Sahanlık ve Kat Holü Mermer", unit: "m2", unit_price: 1500, auto_source: "calc_hall_area", multiplier: 1, wixId: "sahanlikmalisc", scope: 'global' },
      { name: "Merdiven Mermer Kaplama", unit: "Basamak", unit_price: 1500, auto_source: "calc_stairs", multiplier: 1, wixId: "merdivenmermer", scope: 'global' },
      { name: "Merdiven Korkuluğu", unit: "mt", unit_price: 1800, auto_source: "calc_stairs_railing", multiplier: 1, wixId: "merdivenkorkuluk", scope: 'global' },
      { name: "Süpürgelik", unit: "mt", unit_price: 150, auto_source: "dry_perimeter", multiplier: 1, wixId: "supurgelik", scope: 'unit' },
      { name: "Mermer Harcı ve Kumu", unit: "m3", unit_price: 1200, auto_source: "calc_marble_mortar", multiplier: 1, scope: 'global' },
      { name: "Çimento (kg)", unit: "kg", unit_price: 3, auto_source: "manual", multiplier: 0, wixId: "cimentomal", scope: 'hidden' },
      { name: "Kum (m3)", unit: "m3", unit_price: 500, auto_source: "manual", multiplier: 0, wixId: "kummal", scope: 'hidden' }
    ]
  },

  // 7. YENİ BÖLÜNMÜŞ KATEGORİ: MOBİLYA VE AHŞAP
  {
    id: "mobilya_ahsap",
    title: "7. Mobilya ve Ahşap İşleri",
    items: [
      { name: "Bina Giriş Kapısı (Ana)", unit: "Adet", unit_price: 60876, auto_source: "manual", multiplier: 1, wixId: "binakapisimal", scope: 'global', inputType: 'manual_total' },
      { name: "Çelik Kapı (Daire Giriş)", unit: "Adet", unit_price: 26910, auto_source: "calc_steel_door", multiplier: 1, wixId: "dairekapipaket", scope: 'unit' },
      { name: "İç Kapı (Panel/Lake)", unit: "Adet", unit_price: 4920, auto_source: "calc_inner_door", multiplier: 1, wixId: "odakapisipaket", scope: 'unit' },
      { name: "Mutfak Dolabı (Standart)", unit: "m2", unit_price: 6985, auto_source: "calc_kitchen_cabinet", multiplier: 1, wixId: "mutfakdolabipaket", scope: 'unit' },
      { name: "Banyo Dolabı & Lavabo", unit: "Adet", unit_price: 6210, auto_source: "calc_bathroom_cabinet", multiplier: 1, wixId: "banyodolabisetpaket", scope: 'unit' },
      { name: "Portmanto / Vestiyer", unit: "Adet", unit_price: 17340, auto_source: "calc_unit_count", multiplier: 1, wixId: "portmantomal", scope: 'unit' },
      { name: "İç Merdiven (Dubleks)", unit: "Adet", unit_price: 72460, auto_source: "manual", multiplier: 0, wixId: "dubleksmerdivenipaket", scope: 'unit' }
    ]
  },

  // 8. YENİ BÖLÜNMÜŞ KATEGORİ: VİTRİFİYE VE ANKASTRE
  {
    id: "vitrifiye_ankastre",
    title: "8. Vitrifiye, Ankastre ve Islak Hacim",
    items: [
      { name: "Mutfak Tezgahı (Granit/Çimstone)", unit: "mt", unit_price: 6990, auto_source: "calc_kitchen_counter_length", multiplier: 1, wixId: "tezgahpaket", scope: 'unit' }, { name: "Mutfak Evyesi", unit: "Adet", unit_price: 3880, auto_source: "calc_kitchen_sink", multiplier: 1, wixId: "evyemal", scope: 'unit' },
      { name: "Davlumbaz / Aspiratör", unit: "Adet", unit_price: 4915, auto_source: "calc_kitchen_sink", multiplier: 1, wixId: "davlumbazmal", scope: 'unit' },
      { name: "Klozet Takımı (Gömme Rezervuar)", unit: "Adet", unit_price: 6830, auto_source: "calc_toilet", multiplier: 1, wixId: "klozetsetipaket", scope: 'unit' },
      { name: "Duşakabin", unit: "Adet", unit_price: 10350, auto_source: "calc_shower_cabin", multiplier: 1, wixId: "dusakabinpaket", scope: 'unit' },
      { name: "Duş Seti (Başlık/Hortum)", unit: "Set", unit_price: 2588, auto_source: "calc_shower_set", multiplier: 1, wixId: "dussetimal", scope: 'unit' },
      { name: "Lavabo Bataryası", unit: "Adet", unit_price: 1605, auto_source: "calc_basin_mixer", multiplier: 1, wixId: "lavabobataryasimal", scope: 'unit' },
      { name: "Evye Bataryası", unit: "Adet", unit_price: 3625, auto_source: "calc_sink_mixer", multiplier: 1, wixId: "evyebataryasimal", scope: 'unit' }
    ]
  },

  // 9. MEKANİK TESİSAT (Asansör Manuel Adet Kontrolü de Burada)
  {
    id: "mekanik_tesisat",
    title: "9. Mekanik Tesisat",
    items: [
      { name: "Sıhhi Tesisat (Temiz+Pis Su)", unit: "Daire", unit_price: 35000, auto_source: "calc_plumbing_unit", multiplier: 1, scope: 'unit', wixId: "sihhitesisatisc" },
      { name: "Kombi ve Baca Montajı", unit: "Adet", unit_price: 32000, auto_source: "calc_combi_count", multiplier: 1, scope: 'unit', wixId: "kombi" },
      { name: "Kalorifer Altyapısı (Mobil Sistem)", unit: "m2", unit_price: 450, auto_source: "calc_radiator_infrastructure", multiplier: 1, scope: 'unit', wixId: "isitmatesisati" },
      { name: "Panel Radyatör (DemirDöküm vb.)", unit: "mt", unit_price: 3800, auto_source: "calc_radiator_len", multiplier: 1, scope: 'unit', wixId: "panelradyator" },
      { name: "Radyatör Montaj ve Vanalar", unit: "Adet", unit_price: 650, auto_source: "calc_radiator_count", multiplier: 1, scope: 'unit', wixId: "radyatormontaj" },
      { name: "Yerden Isıtma (Strafor+Boru+İşçilik)", unit: "m2", unit_price: 850, auto_source: "calc_underfloor_area", multiplier: 1, scope: 'unit' },
      { name: "Yerden Isıtma Kollektörü ve Kutusu", unit: "Adet", unit_price: 4500, auto_source: "calc_underfloor_collector", multiplier: 1, scope: 'unit' },
      { name: "Isı Pompası (Hava Kaynaklı Dış Ünite)", unit: "Adet", unit_price: 150000, auto_source: "calc_heat_pump", multiplier: 1, scope: 'unit' },
      { name: "VRF Dış Ünite (Merkezi Sistem)", unit: "Adet", unit_price: 250000, auto_source: "calc_vrf_outdoor", multiplier: 1, scope: 'global' },
      { name: "VRF İç Ünite (Kaset/Duvar Tipi)", unit: "Adet", unit_price: 22000, auto_source: "calc_vrf_indoor", multiplier: 1, scope: 'unit' },
      { name: "VRF Bakır Borulama ve Altyapı", unit: "m2", unit_price: 850, auto_source: "calc_vrf_infrastructure", multiplier: 1, scope: 'unit' },
      {
        name: "Doğalgaz Bina Ana Altyapısı",
        unit: "Paket",
        unit_price: 1,
        auto_source: "calc_gas_infrastructure", // Fiziksel imalat
        multiplier: 1,
        scope: 'global',
        inputType: 'manual_total'
      },
      {
        name: "Doğalgaz Proje ve Onay Bedeli", // İsim güncellendi
        unit: "Paket",
        unit_price: 1,
        auto_source: "calc_gas_subscription",
        multiplier: 1,
        scope: 'global',
        inputType: 'manual_total'
      },
      { name: "Yağmur Suyu Hasat Sistemi (Zorunlu)", unit: "Paket", unit_price: 65000, auto_source: "calc_rainwater_system", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Modüler Su Deposu (2m3 Paket)", unit: "Paket", unit_price: 15000, auto_source: "calc_water_tank", multiplier: 1, wixId: "sudeposu2m3mal", scope: 'global', inputType: 'manual_total' },
      { name: "Hidrofor Sistemi", unit: "Paket", unit_price: 12000, auto_source: "calc_hydrophore", multiplier: 1, wixId: "hidraformal", scope: 'global', inputType: 'manual_total' },
      { name: "Yangın Tesisatı (Dolap+Hat)", unit: "Adet", unit_price: 18000, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Asansör (Paket)", unit: "Adet", unit_price: 650000, auto_source: "calc_elevator", multiplier: 1, scope: 'global' },
      { name: "Klima Altyapısı (Bakır Borulama)", unit: "Adet", unit_price: 8500, auto_source: "manual", multiplier: 0, scope: 'unit' }
    ]
  },

  // 10. ELEKTRİK TESİSATI (Şantiye Panosu Çıkarıldı)
  {
    id: "elektrik_tesisat",
    title: "10. Elektrik Tesisatı",
    items: [
      { name: "Kuvvetli Akım Sorti (Priz/Aydınlatma)", unit: "Adet", unit_price: 850, auto_source: "calc_electrical_points", multiplier: 1, scope: 'unit' },
      { name: "Zayıf Akım Sorti (TV/Data/Tel)", unit: "Adet", unit_price: 950, auto_source: "calc_weak_current_points", multiplier: 1, scope: 'unit' },
      { name: "Anahtar/Priz Montajı ve Malzemesi", unit: "Adet", unit_price: 150, auto_source: "calc_switch_socket_count", multiplier: 1, scope: 'unit' },
      { name: "Daire Sigorta Panosu ve Şalt Malz.", unit: "Adet", unit_price: 6500, auto_source: "calc_sub_panel_count", multiplier: 1, wixId: "dairesigortasalterpaket", scope: 'unit' },
      { name: "Merkezi Uydu Sistemi", unit: "Paket", unit_price: 12000, auto_source: "calc_satellite_system", multiplier: 1, scope: 'global', inputType: 'manual_total', wixId: "uydusistemi" },
      { name: "Görüntülü Diafon Sistemi", unit: "Daire", unit_price: 4500, auto_source: "calc_unit_count", multiplier: 1, scope: 'unit' },
      { name: "Kamera ve Güvenlik Altyapısı", unit: "Paket", unit_price: 25000, auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Cephe Aydınlatma (Wallwasher)", unit: "mt", unit_price: 1200, auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Jeneratör (Ortak Alan)", unit: "Toplam", unit_price: 150000, auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total' },
    {
        name: "Akıllı Ev Altyapı ve Donanım Paketi",
        unit: "Paket",
        unit_price: 1, // Fiyatı calculations'tan dinamik döneceğiz
        auto_source: "calc_smart_home",
        multiplier: 1,
        scope: 'global',
        inputType: 'manual_total'
      }
    ]
  },

  // 11. PEYZAJ VE ÇEVRE DÜZENLEME
  {
    id: "peyzaj_cevre",
    title: "11. Peyzaj ve Çevre Düzenleme",
    items: [
      { name: "Bahçe / Çevre Duvarı", unit: "mt", unit_price: 3500, auto_source: "calc_garden_wall", multiplier: 1, scope: 'global' },
      { name: "Ağaç Dikimi (Yönetmelik)", unit: "Adet", unit_price: 1500, auto_source: "calc_tree_count", multiplier: 1, wixId: "agacmal", scope: 'global' },
      { name: "Sert Zemin / Yürüyüş Yolu", unit: "m2", unit_price: 600, auto_source: "calc_hard_ground", multiplier: 1, scope: 'global' },

      { name: "Özel Havuz (Hafriyat, İzolasyon ve Beton)", unit: "m2", unit_price: 18500, auto_source: "calc_pool_concrete", multiplier: 1, scope: 'global' },
      { name: "Havuz Mekanik Tesisatı (Motor, Filtre, Aydınlatma)", unit: "Paket", unit_price: 150000, auto_source: "calc_pool_system", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Açık Otopark (Pergole ve Zemin Kaplama)", unit: "m2", unit_price: 7500, auto_source: "calc_villa_parking", multiplier: 1, scope: 'global' },
      { name: "Veranda / Kış Bahçesi (Zemin ve Çatı Sistemi)", unit: "m2", unit_price: 11000, auto_source: "calc_villa_veranda", multiplier: 1, scope: 'global' }
    ]
  }
];