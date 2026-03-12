// src/cost_data.ts
import { DEFAULT_PRICES } from './constants'; // <-- BİRİNCİ DEĞİŞİKLİK

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
  "calc_isg_package" | "calc_osgb_service" | "calc_safety_net" | 'calc_well_foundation' |
  'calc_well_foundation_concrete' | 'calc_well_foundation_iron' | 'calc_well_foundation_formwork' | 'calc_well_foundation_excavation' |
  'calc_kitchen_counter_length' | "calc_haritaci" | "calc_ekb" | 'calc_utilities_subscription' | 'calc_land_tax' | 'calc_garden_wall' |
  'calc_gas_infrastructure' | "calc_gas_subscription" | "calc_demolition_supervisor" | "calc_demolition_area" |
  "calc_breaker_machine" | 'net_wet_area' | 'calc_pool_concrete' | 'calc_pool_system' | 'calc_villa_parking' |
  'calc_villa_veranda' | "calc_smart_home" | "calc_facade_composite" | 'calc_vrf_outdoor' | "calc_heat_pump" |
  "calc_vrf_indoor" | "calc_vrf_infrastructure" | "calc_villa_stairs" | "calc_cctv_system" |
  "calc_grass_and_irrigation" | "calc_foundation_grounding" | "calc_grobeton" | "calc_foundation_xps" |
  "calc_subasman_filling" | "calc_internal_stair_steps" | 'calc_internal_stair_railing_mt' |
  'calc_suspended_ceiling_area' | 'calc_sgk_premium' | 'calc_all_risk' | "calc_plaster_area" |
  "waterproofing_area" | "calc_terrace_waterproofing" | "calc_garage_door" |
  'calc_indoor_parking_screed' | 'calc_parking_ceiling_insulation' | 'calc_shelter_package' | 'calc_parking_ventilation' | "calc_garage_drainage" |
  "calc_generator"

  ;

  multiplier: number;
  manualQuantity?: number;
  manualPrice?: number;
  scope?: 'global' | 'unit' | 'hidden';
  inputType?: 'quantity_x_price' | 'manual_total';
  vatRate?: number;
}

type RawCostItem = Omit<CostItem, 'unit_price'> & { unit_price?: number };

interface RawCostCategory {
  id: string;
  title: string;
  items: RawCostItem[];
}

export interface CostCategory {
  id: string;
  title: string;
  items: CostItem[];
}

const RAW_COST_DATA: RawCostCategory[] = [
  {
    id: "arsa_finansman",
    title: "0. Arsa ve Finansman Giderleri",
    items: [
      { name: "Hak Sahipleri Kira Yardımı (Toplam)", unit: "Toplam", auto_source: "calc_rent_assistance", multiplier: 1, scope: 'global', inputType: 'manual_total', vatRate: 0 },
      { name: "Hak Sahipleri Tahliye/Taşınma Bedeli", unit: "Toplam", auto_source: "calc_eviction_cost", multiplier: 1, scope: 'global', inputType: 'manual_total', vatRate: 0 },
      { name: "Tapu Harçları ve Noter Masrafları", unit: "Toplam", auto_source: "calc_tapu_noter", multiplier: 1, scope: 'global', inputType: 'manual_total', vatRate: 0 },
      { name: "Emlak Vergisi Tutarı", unit: "Toplam", auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total', vatRate: 0 },
      { name: "Arsa Rayiç Bedeli (Maliyet)", unit: "Toplam", auto_source: "calc_land_tax", multiplier: 1, scope: 'global', inputType: 'manual_total', vatRate: 0 },
      { name: "Tapu Döner Sermaye", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden', vatRate: 0 },
      { name: "Noter Yazı Ücreti", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden', vatRate: 0 },
      { name: "Standart Sözleşme Harcı", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden', vatRate: 0 },
    ]
  },
  {
    id: "resmi_idari",
    title: "1. Projelendirme ve Resmi Giderler",
    items: [
      { name: "Mimari Proje", unit: "m2", auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Statik Proje", unit: "m2", auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Mekanik Proje", unit: "m2", auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Elektrik Projesi", unit: "m2", auto_source: "total_area", multiplier: 1, scope: 'global' },
      { name: "Zemin Etüdü", unit: "Paket", auto_source: "calc_soil_investigation", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Zemin Sondaj Birim Fiyatı", unit: "mt", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "SPT Deneyi Birim Fiyatı", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Presiyometre Deneyi Birim Fiyatı", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Zemin Laboratuvar Paketi", unit: "Paket", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Haritacı Ücreti (Lihkab)", unit: "Paket", auto_source: "calc_haritaci", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Akustik Rapor", unit: "m2", auto_source: "calc_acoustic", multiplier: 1, scope: 'global' },
      { name: "Yapı Denetim Hizmet Bedeli", unit: "Paket", auto_source: "calc_inspection", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Yapı Sınıfı 3A", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yapı Sınıfı 3B", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yapı Sınıfı 3C", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yapı Sınıfı 4A", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yapı Sınıfı 4B", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yıkım Teknik Sorumlu Ücreti", unit: "Paket", auto_source: "calc_demolition_supervisor", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Mevcut Bina Yıkım Ruhsat Bedeli", unit: "Paket", auto_source: "calc_demolition_area", multiplier: 1, scope: 'global', inputType: 'manual_total', vatRate: 0 },
      { name: "Ruhsat Harcı", unit: "m2", auto_source: "total_area", multiplier: 1, scope: 'global', vatRate: 0 },
      { name: "İskan Harcı", unit: "m2", auto_source: "total_area", multiplier: 1, scope: 'global', vatRate: 0 },
      { name: "Enerji Kimlik Belgesi", unit: "Paket", auto_source: "calc_ekb", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Yeşil Etiket (Asansör Ruhsat)", unit: "Toplam", auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total' }
    ]
  },
  {
    id: "santiye_hafriyat",
    title: "2. Şantiye Kurulumu ve Genel Giderler",
    items: [
      { name: "Şantiye Şefi (Aylık)", unit: "Ay", auto_source: "calc_site_chief", multiplier: 1, scope: 'global' },
      { name: "SGK Asgari İşçilik Primi", unit: "Paket", auto_source: "calc_sgk_premium", multiplier: 1, scope: 'global', inputType: 'manual_total', vatRate: 0 },
      { name: "İnşaat All Risk Sigortası", unit: "Paket", auto_source: "calc_all_risk", multiplier: 1, scope: 'global', inputType: 'manual_total', vatRate: 0 },
      { name: "OSGB Hizmet Bedeli (Aylık)", unit: "Ay", auto_source: "calc_osgb_service", multiplier: 1, scope: 'global' },
      { name: "Hafriyat (Kazı ve Döküm)", unit: "m3", auto_source: "calc_excavation", multiplier: 1, scope: 'global' },
      { name: "Kuyu Temel Kazı İşçiliği", unit: "m3", auto_source: "calc_well_foundation_excavation", multiplier: 1, scope: 'global' },
      { name: "İş Makinesi (JCB/Ekskavatör)", unit: "Saat", auto_source: "calc_jcb", multiplier: 1, scope: 'global' },
      { name: "Şantiye Çiti (Çevirme)", unit: "mt", auto_source: "calc_fence", multiplier: 1, scope: 'global' },
      { name: "Konteyner (Ofis/Depo)", unit: "Adet", auto_source: "calc_container_complex", multiplier: 1, scope: 'global' },
      { name: "Şantiye Su ve Elektrik Abonelikleri", unit: "Toplam", auto_source: "calc_utilities_subscription", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Şantiye Elektrik Panosu (Geçici)", unit: "Toplam", auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Şantiye Elektrik Tüketimi (Aylık)", unit: "Ay", auto_source: "calc_duration_months", multiplier: 1, scope: 'global' },
      { name: "Şantiye Su Tüketimi (Aylık)", unit: "Ay", auto_source: "calc_duration_months", multiplier: 1, scope: 'global' },
      { name: "Su Drenaj Sistemi", unit: "mt", auto_source: "calc_drainage", multiplier: 1, scope: 'global' },
      { name: "Kırıcı İş Makinesi Farkı (Kayalık)", unit: "Saat", auto_source: "calc_breaker_machine", multiplier: 1, scope: 'global' },
      { name: "Püskürtme Beton (İksa)", unit: "m2", auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Kule Vinç Aylık Kira ve Operatör", unit: "Ay", auto_source: "calc_tower_crane_duration", multiplier: 1, scope: 'global' },
      { name: "Kule Vinç Kurulum ve Söküm Bedeli", unit: "Paket", auto_source: "calc_tower_crane_setup", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Mobil Vinç Hizmet Bedeli", unit: "Gün", auto_source: "calc_mobile_crane_days", multiplier: 1, scope: 'global' },
      { name: "Şantiye Araç Giderleri (Aylık)", unit: "Ay", auto_source: "calc_duration_months", multiplier: 1, scope: 'global' },
      { name: "Şantiye Personel Giderleri (Bekçi vb.)", unit: "Ay", auto_source: "calc_duration_months", multiplier: 1, scope: 'global' },
      { name: "İSG Kişisel Koruyucu Donanım (Baret, Yelek vb.)", unit: "Paket", auto_source: "calc_isg_package", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Dış Cephe Güvenlik Ağı ve Kenar Koruma", unit: "m2", auto_source: "calc_safety_net", multiplier: 1, scope: 'global' }
    ]
  },
  {
    id: "kaba_insaat",
    title: "3. Kaba Yapı (Betonarme ve Çatı)",
    items: [
      { name: "Kuyu Temel Betonu", unit: "m3", auto_source: "calc_well_foundation_concrete", multiplier: 1, scope: 'global' },
      { name: "Kuyu Temel Demiri", unit: "ton", auto_source: "calc_well_foundation_iron", multiplier: 1, scope: 'global' },
      { name: "Kuyu Temel Kalıp ve Donatı İşçiliği", unit: "m2", auto_source: "calc_well_foundation_formwork", multiplier: 1, scope: 'global' },
      { name: "Betonarme Betonu", unit: "m3", auto_source: "calc_concrete_global", multiplier: 1, scope: 'global' },
      { name: "Grobeton", unit: "m3", auto_source: "calc_grobeton", multiplier: 1, scope: 'global' },
      { name: "İnşaat Demiri", unit: "ton", auto_source: "calc_iron_global", multiplier: 1, scope: 'global' },
      { name: "Kalıp İşçiliği & Malzeme", unit: "m2", auto_source: "calc_formwork_global", multiplier: 1, scope: 'global' },
      { name: "Temel Su Yalıtımı (Bohçalama)", unit: "m2", auto_source: "calc_foundation_area", multiplier: 1.1, scope: 'global' },
      { name: "Temel Yalıtım Koruma (XPS)", unit: "m2", auto_source: "calc_foundation_xps", multiplier: 1.05, scope: 'global' },
      { name: "Subasman Dolgusu (Stabilize/Mıcır)", unit: "m3", auto_source: "calc_subasman_filling", multiplier: 1, scope: 'global' },
      { name: "Çatı Konstrüksiyon ve Kaplama", unit: "m2", auto_source: "calc_roof", multiplier: 1, scope: 'global' },
      { name: "Balkon ve Teras Su Yalıtımı", unit: "m2", auto_source: "calc_terrace_waterproofing", multiplier: 1, scope: 'global' }, 
      { name: "Yangın Merdiveni (Çelik)", unit: "Kat", auto_source: "calc_fire_escape", multiplier: 1, scope: 'global', inputType: 'manual_total' }
    ]
  },
  {
    id: "duvar_tavan",
    title: "4. Duvar, Tavan ve Alçı İşleri",
    items: [
      { name: "Duvar Malzemesi (10 cm)", unit: "m2", auto_source: "wall_10_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (10 cm)", unit: "m2", auto_source: "wall_10_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Malzemesi (13.5 cm)", unit: "m2", auto_source: "wall_13_5_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (13.5 cm)", unit: "m2", auto_source: "wall_13_5_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Malzemesi (15 cm)", unit: "m2", auto_source: "wall_15_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (15 cm)", unit: "m2", auto_source: "wall_15_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Malzemesi (20 cm)", unit: "m2", auto_source: "wall_20_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (20 cm)", unit: "m2", auto_source: "wall_20_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Malzemesi (25 cm)", unit: "m2", auto_source: "wall_25_area", multiplier: 1.05, scope: 'global' },
      { name: "Duvar İşçiliği (25 cm)", unit: "m2", auto_source: "wall_25_area", multiplier: 1, scope: 'global' },
      { name: "Duvar Örme Harcı (Kara Harç)", unit: "m3", auto_source: "calc_mortar_volume", multiplier: 1, scope: 'global' },
      { name: "Gazbeton Yapıştırıcısı", unit: "kg", auto_source: "calc_adhesive_weight", multiplier: 1, scope: 'global' },
      { name: "İç Sıva (Kara Sıva)", unit: "m2", auto_source: "calc_rough_plaster_area", multiplier: 1, scope: 'unit' },
      { name: "Alçı Sıva (Kaba+Saten)", unit: "m2", auto_source: "calc_plaster_area", multiplier: 1, scope: 'unit' },
      { name: "İç Cephe Boyası", unit: "m2", auto_source: "calc_paint_wall_area", multiplier: 1, scope: 'unit' },
      { name: "Tavan Boyası", unit: "m2", auto_source: "calc_ceiling_paint_area", multiplier: 1, scope: 'unit' },
      { name: "Asma Tavan (Alçıpan)", unit: "m2", auto_source: "calc_suspended_ceiling_area", multiplier: 1, scope: 'unit' },
      { name: "Kartonpiyer / Stropiyer", unit: "mt", auto_source: "cornice_length", multiplier: 1, scope: 'unit' }
    ]
  },
  {
    id: "dis_cephe",
    title: "5. Dış Cephe ve Yalıtım",
    items: [
      { name: "Mantolama Malzemesi", unit: "m2", auto_source: "calc_facade", multiplier: 1, scope: 'global' },
      { name: "Mantolama İşçiliği", unit: "m2", auto_source: "calc_facade", multiplier: 1, scope: 'global' },
      { name: "PVC Pencere (Doğrama)", unit: "m2", auto_source: "calc_window_area", multiplier: 1, scope: 'unit' },
      { name: "Mermer Denizlik", unit: "mt", auto_source: "calc_sill_length", multiplier: 1, scope: 'unit' },
      { name: "Balkon Korkulukları (Alüminyum)", unit: "mt", auto_source: "calc_balcony_railing", multiplier: 1, scope: 'unit' },
      { name: "İskele Kirası (Aylık)", unit: "Ay", auto_source: "calc_scaffolding_duration", multiplier: 1, scope: 'global' },
      { name: "İskele Kurulum/Söküm", unit: "m2", auto_source: "calc_scaffolding_area", multiplier: 1, scope: 'global' },
      { name: "Cam Balkon Sistemleri", unit: "m2", auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Giydirme Cephe (Kompozit vb.)", unit: "m2", auto_source: "calc_facade_composite", multiplier: 0.25, scope: 'global' },
      { name: "Pencere Söveleri", unit: "mt", auto_source: "calc_window_perimeter", multiplier: 1, scope: 'unit' },
{ name: "Otopark Tavanı Yangın/Isı Yalıtımı (Taşyünü)", unit: "m2", auto_source: "calc_parking_ceiling_insulation", multiplier: 1, scope: 'global' },    ]
  },
  {
    id: "zemin_kaplama",
    title: "6. Zemin Kaplamaları ve Merdiven",
    items: [
      { name: "Banyo ve Islak Hacim Su Yalıtımı", unit: "m2", auto_source: "waterproofing_area", multiplier: 1.05, scope: 'unit' },
      { name: "Şap Malzemesi", unit: "m2", auto_source: "total_area", multiplier: 1.05, scope: 'unit' },
      { name: "Şap İşçiliği", unit: "m2", auto_source: "total_area", multiplier: 1, scope: 'unit' },
      { name: "Laminat Parke (Anahtar Teslim)", unit: "m2", auto_source: "dry_area", multiplier: 1, scope: 'unit' },
      { name: "Seramik Kaplama", unit: "m2", auto_source: "wet_area", multiplier: 1, scope: 'unit' },
      { name: "Seramik Yapıştırıcısı", unit: "kg", auto_source: "net_wet_area", multiplier: 5, scope: 'unit' },
      { name: "Seramik Derz Dolgusu", unit: "kg", auto_source: "net_wet_area", multiplier: 0.5, scope: 'unit' },
      { name: "Sahanlık ve Kat Holü Mermer", unit: "m2", auto_source: "calc_hall_area", multiplier: 1, scope: 'global' },
      { name: "Merdiven Mermer Kaplama", unit: "Basamak", auto_source: "calc_stairs", multiplier: 1, scope: 'global' },
      { name: "Merdiven Korkuluğu", unit: "mt", auto_source: "calc_stairs_railing", multiplier: 1, scope: 'global' },
      { name: "Süpürgelik", unit: "mt", auto_source: "dry_perimeter", multiplier: 1, scope: 'unit' },
      { name: "Mermer Harcı ve Kumu", unit: "m3", auto_source: "calc_marble_mortar", multiplier: 1, scope: 'global' },
      { name: "Otopark Yüzey Sertleştirici (Helikopterli Beton)", unit: "m2", auto_source: "calc_indoor_parking_screed", multiplier: 1, scope: 'global' },
    ]
  },
  {
    id: "mobilya_ahsap",
    title: "7. Mobilya ve Ahşap İşleri",
    items: [
      { name: "Bina Giriş Kapısı (Ana)", unit: "Adet", auto_source: "manual", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Çelik Kapı (Daire Giriş)", unit: "Adet", auto_source: "calc_steel_door", multiplier: 1, scope: 'unit' },
      { name: "İç Kapı (Panel/Lake)", unit: "Adet", auto_source: "calc_inner_door", multiplier: 1, scope: 'unit' },
      { name: "Yangın Kapısı (Adet)", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Mutfak Dolabı (Standart)", unit: "mt", auto_source: "calc_kitchen_cabinet", multiplier: 1, scope: 'unit' }, 
      { name: "Banyo Dolabı & Lavabo", unit: "Adet", auto_source: "calc_bathroom_cabinet", multiplier: 1, scope: 'unit' },
      { name: "Portmanto / Vestiyer", unit: "Adet", auto_source: "calc_unit_count", multiplier: 1, scope: 'unit' },
      { name: "İç Merdiven Kaplama", unit: "Basamak", auto_source: "calc_internal_stair_steps", multiplier: 1, scope: 'global' },
      { name: "İç Merdiven Korkuluk", unit: "mt", auto_source: "calc_internal_stair_railing_mt", multiplier: 1, scope: 'global' },
      { name: "Otomatik Garaj Kapısı", unit: "Adet", auto_source: "calc_garage_door", multiplier: 1, scope: 'global', inputType: 'manual_total' },
    ]
  },
  {
    id: "vitrifiye_ankastre",
    title: "8. Vitrifiye, Ankastre ve Islak Hacim",
    items: [
      { name: "Mutfak Tezgahı (Granit/Çimstone)", unit: "mt", auto_source: "calc_kitchen_counter_length", multiplier: 1, scope: 'unit' },
      { name: "Mutfak Evyesi", unit: "Adet", auto_source: "calc_kitchen_sink", multiplier: 1, scope: 'unit' },
      { name: "Davlumbaz / Aspiratör", unit: "Adet", auto_source: "calc_kitchen_sink", multiplier: 1, scope: 'unit' },
      { name: "Klozet Takımı (Gömme Rezervuar)", unit: "Adet", auto_source: "calc_toilet", multiplier: 1, scope: 'unit' },
      { name: "Duşakabin", unit: "Adet", auto_source: "calc_shower_cabin", multiplier: 1, scope: 'unit' },
      { name: "Duş Seti (Başlık/Hortum)", unit: "Set", auto_source: "calc_shower_set", multiplier: 1, scope: 'unit' },
      { name: "Lavabo Bataryası", unit: "Adet", auto_source: "calc_basin_mixer", multiplier: 1, scope: 'unit' },
      { name: "Evye Bataryası", unit: "Adet", auto_source: "calc_sink_mixer", multiplier: 1, scope: 'unit' }
    ]
  },
  {
    id: "mekanik_tesisat",
    title: "9. Mekanik ve Asansör Tesisatı",
    items: [
      { name: "Sıhhi Tesisat (Temiz+Pis Su)", unit: "Daire", auto_source: "calc_plumbing_unit", multiplier: 1, scope: 'unit' },
      { name: "Kombi ve Baca Montajı", unit: "Adet", auto_source: "calc_combi_count", multiplier: 1, scope: 'unit' },
      { name: "Kalorifer Altyapısı (Mobil Sistem)", unit: "m2", auto_source: "calc_radiator_infrastructure", multiplier: 1, scope: 'unit' },
      { name: "Panel Radyatör (DemirDöküm vb.)", unit: "mt", auto_source: "calc_radiator_len", multiplier: 1, scope: 'unit' },
      { name: "Radyatör Montaj ve Vanalar", unit: "Adet", auto_source: "calc_radiator_count", multiplier: 1, scope: 'unit' },
      { name: "Yerden Isıtma (Strafor+Boru+İşçilik)", unit: "m2", auto_source: "calc_underfloor_area", multiplier: 1, scope: 'unit' },
      { name: "Yerden Isıtma Kollektörü ve Kutusu", unit: "Adet", auto_source: "calc_underfloor_collector", multiplier: 1, scope: 'unit' },
      { name: "Isı Pompası (Hava Kaynaklı Dış Ünite)", unit: "Adet", auto_source: "calc_heat_pump", multiplier: 1, scope: 'unit' },
      { name: "VRF Dış Ünite (Merkezi Sistem)", unit: "Adet", auto_source: "calc_vrf_outdoor", multiplier: 1, scope: 'global' },
      { name: "VRF İç Ünite (Kaset/Duvar Tipi)", unit: "Adet", auto_source: "calc_vrf_indoor", multiplier: 1, scope: 'unit' },
      { name: "VRF Bakır Borulama ve Altyapı", unit: "m2", auto_source: "calc_vrf_infrastructure", multiplier: 1, scope: 'unit' },
      { name: "Doğalgaz Bina Ana Altyapısı", unit: "Paket", auto_source: "calc_gas_infrastructure", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Doğalgaz Proje ve Onay Bedeli", unit: "Paket", auto_source: "calc_gas_subscription", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Yağmur Suyu Hasat Sistemi (Zorunlu)", unit: "Paket", auto_source: "calc_rainwater_system", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Modüler Su Deposu (2m3 Paket)", unit: "Paket", auto_source: "calc_water_tank", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Hidrofor Sistemi", unit: "Paket", auto_source: "calc_hydrophore", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Yangın Tesisatı (Dolap+Hat)", unit: "Adet", auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Asansör (Paket)", unit: "Adet", auto_source: "calc_elevator", multiplier: 1, scope: 'global' },
      { name: "Klima Altyapısı (Bakır Borulama)", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'unit' },
      { name: "Sığınak Kapısı ve Havalandırma Paketi", unit: "Paket", auto_source: "calc_shelter_package", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Otopark Yangın ve Jet Fan Sistemi", unit: "Paket", auto_source: "calc_parking_ventilation", multiplier: 1, scope: 'global', inputType: 'manual_total' }, 
      { name: "Otopark Drenaj ve Yağ Ayırıcı Sistem", unit: "Paket", auto_source: "calc_garage_drainage", multiplier: 1, scope: 'global', inputType: 'manual_total' },
    ]
  },
  {
    id: "elektrik_tesisat",
    title: "10. Elektrik Tesisatı",
    items: [
      { name: "Temel Topraklaması (Galvaniz Şerit)", unit: "mt", auto_source: "calc_foundation_grounding", multiplier: 1, scope: 'global' },
      { name: "Kuvvetli Akım Sorti (Priz/Aydınlatma)", unit: "Adet", auto_source: "calc_electrical_points", multiplier: 1, scope: 'unit' },
      { name: "Zayıf Akım Sorti (TV/Data/Tel)", unit: "Adet", auto_source: "calc_weak_current_points", multiplier: 1, scope: 'unit' },
      { name: "Anahtar/Priz Montajı ve Malzemesi", unit: "Adet", auto_source: "calc_switch_socket_count", multiplier: 1, scope: 'unit' },
      { name: "Daire Sigorta Panosu ve Şalt Malz.", unit: "Adet", auto_source: "calc_sub_panel_count", multiplier: 1, scope: 'unit' },
      { name: "Merkezi Uydu Sistemi", unit: "Paket", auto_source: "calc_satellite_system", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Görüntülü Diafon Sistemi", unit: "Daire", auto_source: "calc_unit_count", multiplier: 1, scope: 'unit' },
      { name: "Kamera ve Güvenlik Altyapısı", unit: "Paket", auto_source: "calc_cctv_system", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Cephe Aydınlatma (Wallwasher)", unit: "mt", auto_source: "manual", multiplier: 1, scope: 'global' },
      { name: "Jeneratör (Ortak Alan)", unit: "Paket", auto_source: "calc_generator", multiplier: 1, scope: 'global', inputType: 'manual_total' }, 
      { name: "Akıllı Ev Altyapı ve Donanım Paketi", unit: "Paket", auto_source: 'calc_smart_home', multiplier: 1, scope: 'global', inputType: 'manual_total' }
    ]
  },
  {
    id: "peyzaj_cevre",
    title: "11. Peyzaj ve Çevre Düzenleme",
    items: [
      { name: "Bahçe / Çevre Duvarı", unit: "mt", auto_source: "calc_garden_wall", multiplier: 1, scope: 'global' },
      { name: "Ağaç Dikimi", unit: "Adet", auto_source: "calc_tree_count", multiplier: 1, scope: 'global' },
      { name: "Çim Ekimi ve Otomatik Sulama Sistemi", unit: "m2", auto_source: "calc_grass_and_irrigation", multiplier: 1, scope: 'global' },
      { name: "Sert Zemin / Yürüyüş Yolu", unit: "m2", auto_source: "calc_hard_ground", multiplier: 1, scope: 'global' },
      { name: "Özel Havuz Yapımı (Hafriyat, İzolasyon, Beton ve Kaplama)", unit: "Paket", auto_source: "calc_pool_concrete", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Havuz Mekanik Tesisatı (Motor, Filtre, Aydınlatma)", unit: "Paket", auto_source: "calc_pool_system", multiplier: 1, scope: 'global', inputType: 'manual_total' },
      { name: "Veranda / Kış Bahçesi (Zemin ve Çatı Sistemi)", unit: "m2", auto_source: "calc_villa_veranda", multiplier: 1, scope: 'global' },
    ]
  },
  {
    id: "gizli_malzemeler",
    title: "12. Gizli Hammaddeler ve Teknik Kalemler",
    items: [
      { name: "Çimento (kg)", unit: "kg", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Kum (m3)", unit: "m3", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Kireç (kg)", unit: "kg", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "İnşaat Çivisi (kg)", unit: "kg", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Kalıp Yağı (Litre)", unit: "Litre", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Kereste (m3)", unit: "m3", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Bağ Teli (kg)", unit: "kg", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Gazbeton Blok (m3)", unit: "m3", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Tuğla Blok (m3)", unit: "m3", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Bims Blok (m3)", unit: "m3", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Gazbeton İşçiliği (m2)", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Tuğla İşçiliği (m2)", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Bims İşçiliği (m2)", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Sıva Alçısı (kg)", unit: "kg", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Saten Alçı (kg)", unit: "kg", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Astar Boya (kg)", unit: "kg", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "İç Cephe Boyası (kg)", unit: "kg", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Sığınak Kapısı (Adet)", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Sığınak Havalandırma Santrali (Adet)", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Otopark Sprinkler Altyapısı (m²)", unit: "m2", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Otopark Jet Fan Cihazı (Adet)", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Egzost/Taze Hava Santrali ve Otomasyon (Paket)", unit: "Paket", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Otopark Drenaj Kanalı (mt)", unit: "mt", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Yağ Ayırıcı Ünite (Adet)", unit: "Adet", auto_source: "manual", multiplier: 0, scope: 'hidden' },
      { name: "Atıksu Dalgıç Pompa Sistemi (Set)", unit: "Set", auto_source: "manual", multiplier: 0, scope: 'hidden' }
    ]
  }
];

// src/cost_data.ts dosyasının en altındaki ITEM_DESCRIPTIONS kısmını aşağıdaki ile değiştirin:

export const ITEM_DESCRIPTIONS: Record<string, string> = {
  // --- 0. Arsa ve Finansman ---
  "Hak Sahipleri Kira Yardımı (Toplam)": "Kentsel dönüşüm veya kat karşılığı projelerde mevcut hak sahiplerine evleri teslim edilene kadar (inşaat süresince) ödenen toplam kira bedelidir.",
  "Hak Sahipleri Tahliye/Taşınma Bedeli": "Hak sahiplerinin evlerini boşaltıp geçici evlerine geçmeleri için bir defaya mahsus ödenen taşınma ve lojistik desteğidir.",
  "Tapu Harçları ve Noter Masrafları": "Satış, kat irtifakı kurulumu, yönetim planı tescili ve inşaat sözleşmesi süreçlerinde devlete veya notere ödenen yasal harçların toplamıdır.",
  "Emlak Vergisi Tutarı": "İnşaat süresince arsa ve inşaat halindeki bina için bağlı bulunulan belediyeye ödenmesi gereken yıllık vergi tutarıdır.",

  // --- 1. Projelendirme ve Resmi Giderler ---
  "Mimari Proje": "Binanın dış görünüşü, kat planları, vaziyet planı ve iç mekan yerleşimlerini içeren mimari çizimlerin toplam bedelidir.",
  "Statik Proje": "Binanın taşıyıcı sistem (kolon, kiriş, temel, döşeme) hesaplamalarını, demir donatı ve beton detaylarını içeren mühendislik projesi bedelidir.",
  "Mekanik Proje": "Binanın ısıtma, soğutma, havalandırma, sıhhi tesisat (temiz/pis su) ve yangın sistemlerinin hesaplanıp projelendirilmesi bedelidir.",
  "Elektrik Projesi": "Binanın aydınlatma, priz, zayıf akım (internet/TV) ve ana/tali pano yerleşimlerini gösteren proje bedelidir.",
  "Zemin Sondaj Birim Fiyatı": "Arsanın jeolojik yapısını, yeraltı suyu seviyesini ve depremselliğini (zemin sınıfını) belirlemek için yapılan sondaj çalışmasının metre maliyetidir.",
  "Haritacı Ücreti (Lihkab)": "Arsa sınırlarının kesin olarak belirlenmesi, bina köşe noktalarının aplikasyonu ve röperli kroki işlemleri için lisanslı harita bürosuna ödenen yasal ücrettir.",
  "Yapı Denetim Hizmet Bedeli": "İnşaatın projesine ve yasal mevzuatlara uygun yapıldığını denetleyen, devlete bağlı havuz sisteminden atanan yapı denetim firmasına ödenen hizmet bedelidir.",
  "Ruhsat Harcı": "İnşaata yasal olarak başlayabilmek için mimari ve statik projelerin onaylanması sürecinde belediyeye ödenen yapı ruhsatı harcıdır.",
  "İskan Harcı": "İnşaat bittikten sonra binada resmi olarak elektrik/su aboneliği alınıp oturuma başlanabilmesi (Yapı Kullanma İzin Belgesi) için belediyeye ödenen harçtır.",
  "Enerji Kimlik Belgesi": "Binanın enerji verimlilik sınıfını (yalıtım, ısıtma soğutma performansı vb.) gösteren ve iskan alınabilmesi için zorunlu olan yasal belgedir.",
  "Şantiye Şefi (Aylık)": "İnşaat süresince yasal olarak şantiyenin sevk, idare ve iş güvenliğinden sorumlu olan mühendis veya mimarın aylık maliyetidir.",
  "OSGB Hizmet Bedeli (Aylık)": "İş Sağlığı ve Güvenliği Kanunu kapsamında şantiyede İSG uzmanı ve iş yeri hekimi bulundurma zorunluluğu için ödenen aylık tutardır.",

  // --- 2. Şantiye Kurulumu ---
  "SGK Asgari İşçilik Primi": "İnşaatın m² maliyeti üzerinden devlete ödenmesi zorunlu olan ve 'İlişiksizlik Belgesi' (iskan için şarttır) alabilmek amacıyla ödenen asgari SGK prim tutarıdır.",
  "İnşaat All Risk Sigortası": "İnşaat süresince oluşabilecek iş kazası, malzeme hırsızlığı, yangın veya doğal afet gibi risklere karşı projeyi güvence altına alan geniş kapsamlı sigortadır.",
  "Hafriyat (Kazı ve Döküm)": "Bina temelinin açılması için toprağın kazılması, kamyonlara yüklenmesi ve çıkan hafriyatın belediyenin gösterdiği yasal döküm sahalarına taşınması işlemidir.",
  "Kuyu Temel Kazı İşçiliği": "Bitişik nizam yapılarda veya derin kazılarda komşu binaların/yolların çökmesini engellemek için parça parça yapılan, yüksek insan gücü gerektiren özel destek kazısıdır.",
  "Püskürtme Beton (İksa)": "Derin kazılarda zemin kaymasını önlemek için toprak yüzeyine hasır çelik serilerek yüksek basınçla uygulanan destek betonu (shotcrete) tekniğidir.",
  "Şantiye Çiti (Çevirme)": "Şantiye alanına yetkisiz girişleri engellemek, toz çıkışını azaltmak ve çevre güvenliğini sağlamak amacıyla alanın etrafının OSB, sac veya tel örgü ile kapatılmasıdır.",
  "Konteyner (Ofis/Depo)": "Şantiye personelinin ofis, yemekhane, yatakhane veya hassas malzemeler için depo olarak kullanacağı geçici prefabrik veya konteyner yapıların maliyetidir.",
  "Kule Vinç Aylık Kira ve Operatör": "Yüksek katlı veya geniş oturumlu projelerde demir, beton, tuğla ve kalıp malzemelerini taşımak için kurulan vincin aylık kira bedeli ve operatör maaşıdır.",
  "Dış Cephe Güvenlik Ağı ve Kenar Koruma": "Yüksekte çalışırken işçilerin düşmesini ve şantiye dışına malzeme sekmelerini önlemek için kurulan, yasal zorunluluğu olan ağ ve bariyer sistemidir.",

  // --- 3. Kaba Yapı ---
  "Betonarme Betonu": "Temel, kolon, perde, kiriş ve döşemelerde kullanılan, binanın ana iskeletini (taşıyıcı sistemi) oluşturan hazır betonun (örn: C30, C35) toplam döküm maliyetidir.",
  "İnşaat Demiri": "Betonun çekme dayanımını artırmak, deprem kuvvetlerine karşı binaya esneklik ve direnç sağlamak için beton içine yerleştirilen nervürlü çelik donatının toplam maliyetidir.",
  "Kalıp İşçiliği & Malzeme": "Taze beton dökülmeden önce projedeki şeklini almasını ve kuruyana (prizini alana) kadar desteklenmesini sağlayan ahşap/plywood kalıpların kurulumu, sökümü ve iskele malzemeleridir.",
  "Grobeton": "Temel yalıtımını topraktan korumak, yeraltı suyunu kesmek ve demir döşemek için düz, temiz bir yüzey elde etmek amacıyla temel kazısının tabanına dökülen demirsiz, düşük dozlu betondur.",
  "Temel Su Yalıtımı (Bohçalama)": "Binayı yeraltı sularından, korozyondan ve toprak neminden korumak için temel tabanına ve toprak altında kalan dış perdelere uygulanan membran veya likit yalıtım işlemidir.",
  "Temel Yalıtım Koruma (XPS)": "Temel su yalıtımını (membranı) toprak dolgusu sırasında taş ve moloz zedelenmelerinden korumak ve aynı zamanda bodrum katlara ısı yalıtımı sağlamak için kullanılan sert köpük tabakadır.",
  "Subasman Dolgusu (Stabilize/Mıcır)": "Bodrumu olmayan binalarda, zemin katı toprak seviyesinden yukarıda (kuru) tutmak için temel çevre perdelerinin içinin mekanik stabilize veya mıcır ile doldurulması işlemidir.",
  "Çatı Konstrüksiyon ve Kaplama": "Çatının taşıyıcı iskeletinin (ahşap veya çelik) kurulması, ısı/su yalıtımının yapılması ve üzerine kiremit, şıngıl veya membran (sandviç panel vb.) kaplanması işlemidir.",

  // --- 4. Duvar ve Tavan ---
  "Duvar Örme Harcı (Kara Harç)": "Tuğla veya bims blokları örerken elemanları birbirine bağlamak ve boşlukları doldurmak için kullanılan çimento, kireç ve kum bazlı geleneksel inşaat harcıdır.",
  "Gazbeton Yapıştırıcısı": "Gazbeton (Ytong vb.) blokları örerken kullanılan, 2-3 mm kalınlıkta ince uygulanan ve çimento harcına göre duvarlar arasında ısı köprüsü (soğuk hava sızıntısı) oluşturmayan özel hazır yapıştırıcıdır.",
  "İç Sıva (Kara Sıva)": "Duvar örümü sonrası yüzeydeki eğrilikleri düzeltmek, tuğla aralarını doldurmak ve gömülü tesisat borularını kapatmak için yapılan kalın kum-çimento bazlı koruyucu sıvadır.",
  "Alçı Sıva (Kaba+Saten)": "Boya öncesi duvarı tamamen pürüzsüz, beyaz ve düzgün hale getirmek için kara sıva veya gazbeton üzerine makine veya elle atılan kaba alçı ve son kat ince saten alçı tabakasıdır.",
  "Asma Tavan (Alçıpan)": "Genellikle banyo, mutfak, wc gibi ıslak hacimlerde veya tesisat geçişlerini (havalandırma, elektrik tavaları) gizlemek, spot aydınlatma yerleştirmek için asıl tavanın altına kurulan alçıpan sistemidir.",

  // --- 5. Dış Cephe ---
  "Mantolama Malzemesi": "Binanın dış duvarlarından ısı kaybını önlemek (enerji tasarrufu) için kullanılan EPS, Karbonlu EPS, XPS veya Taşyünü yalıtım levhaları ile bunlara ait yapıştırıcı, sıva, donatı filesi ve dübel setidir.",
  "PVC Pencere (Doğrama)": "Binanın dışa açılan pencereleri ve balkon kapıları için kullanılan, hava/ses yalıtımlı PVC profillerden ve ısıcamdan oluşan doğrama sisteminin malzeme ve montaj maliyetidir.",
  "İskele Kirası (Aylık)": "Dış cephe sıva, boya, mantolama, söve ve pencere montaj işlemleri için binanın etrafına kurulan, güvenlikli çelik iş iskelesinin kurulum, söküm ve aylık kira bedelidir.",
  "Cam Balkon Sistemleri": "Balkonları dış etkenlerden (rüzgar, yağmur, toz) korumak ve kışın da yaşam alanına katmak için uygulanan katlanabilir temperli veya sürme cam kaplama sistemidir.",

  // --- 6. Zemin ve Merdiven ---
  "Şap Malzemesi": "Döşeme üzerindeki tesisat borularını örtmek ve zemin kaplaması (parke/seramik) döşenmeden önce teraziye (su mastarına) alınmış dümdüz bir satıh elde etmek için dökülen kum-çimento harcıdır.",
  "Seramik Kaplama": "Banyo, wc, mutfak tezgah arası, balkon, koridor gibi suya maruz kalan alanların (ıslak hacimler) zemin ve duvarlarına uygulanan fayans/granit seramik kaplama malzemesi ve yapıştırıcı/işçiliğidir.",
  "Laminat Parke (Anahtar Teslim)": "Salon, yatak odası, oturma odası gibi kuru hacimlerin zeminlerine uygulanan kilitli parke paneller, altına serilen ses yalıtım şiltesi (kapron) ve köşe süpürgelikleri dahil tam maliyettir.",

  // --- 7. İnce İşler ve Mobilya ---
  "Bina Giriş Kapısı (Ana)": "Apartman veya site bloklarının ana girişinde kullanılan, estetik, korozyona ve dış hava şartlarına dayanıklı, şifreli/kartlı veya görüntülü otomat sistemine sahip büyük bina kapısıdır.",
  "Çelik Kapı (Daire Giriş)": "Bağımsız bölümlerin (dairelerin) girişlerinde kullanılan, ahşap görünümlü giydirmeye sahip, levye/kriko zorlamalarına ve hırsızlığa karşı dayanıklı çok kilitli ağır çelik kapıların maliyetidir.",
  "İç Kapı (Panel/Lake)": "Oda, banyo ve mutfak geçişlerinde kullanılan; MDF üzeri lake boyalı, ahşap kaplamalı, melamin veya amerikan panel tipi kasa, pervaz, kanat ve kilit setinden oluşan iç mekan kapılarının maliyetidir.",
  "Mutfak Dolabı (Standart)": "Mutfak tezgah altı ve tezgah üstü dolap modüllerinin MDF gövdeleri, kapakları (Membran/Akrilik/Lake), çekmece rayları, menteşe sistemleri ve kulplarının montaj dahil maliyetidir. (Tezgah/Evye hariçtir)",
  "Mutfak Tezgahı (Granit/Çimstone)": "Mutfak alt dolaplarının üzerine yerleştirilen, su ve ısıya dayanıklı; doğal granit, mermer, kuvars (Çimstone, Belenco) veya porselen bazlı çalışma yüzeyinin kesim ve montaj maliyetidir.",
  "Banyo Dolabı & Lavabo": "Banyolarda ayna (genellikle ledli), havlu/şampuan saklamak için alt/üst dolap modülleri ve Hilton tipi bütünleşik porselen/seramik lavabo taşından oluşan takım banyo mobilyasıdır.",

  // --- 8, 9, 10. Tesisat, Elektrik ve Peyzaj ---
  "Sıhhi Tesisat (Temiz+Pis Su)": "Binanın su saatinden mutfak ve banyolardaki bataryalara kadar giden şebeke (temiz su) boruları ile banyo/wc atık sularını dikey şaftlardan rögara ulaştıran gri/sessiz PVC (pis su) boru ağının toplam maliyetidir.",
  "Kombi ve Baca Montajı": "Daire içi peteklerin (veya yerden ısıtmanın) ve muslukların sıcak suyunu sağlayan yoğuşmalı kombi cihazı, hermetik baca seti uzatması ve gaz dağıtım şirketinden alınan proje/bağlantı onayı maliyetidir.",
  "Yerden Isıtma (Strafor+Boru+İşçilik)": "Şap dökülmeden önce zemine döşenen modüler yalıtım levhası (strafor) ve üzerine sarmal şekilde serilen oksijen bariyerli Pe-Xa esnek ısıtma borularından oluşan, radyatöre kıyasla daha homojen ısınma sağlayan sistemdir.",
  "Kuvvetli Akım Sorti (Priz/Aydınlatma)": "Her bir aydınlatma armatürü, avize veya duvar prizi için; daire içi ana sigorta panosundan (şalterden) ilgili noktaya kadar sıva altından çekilen yanmaz antigron kablo, buat ve PVC boru altyapı işçiliğidir.",
  "Zayıf Akım Sorti (TV/Data/Tel)": "İnternet (Cat6), uydu/TV anteni (Koaksiyel) ve diafon gibi düşük voltajlı cihazların çalışması için, bina şaftından daire içine ve odalara kadar çekilen zayıf akım altyapı kablolamasıdır.",
  "Görüntülü Diafon Sistemi": "Daire içindeki ekrandan, bina dış kapısındaki veya şantiye girişindeki ziyaretçiyi sesli ve görüntülü olarak görmeye, iletişim kurmaya ve dış kapıyı otomatiğe basarak açmaya yarayan güvenlikli haberleşme sistemidir.",
  "Yağmur Suyu Hasat Sistemi (Zorunlu)": "Çevre ve Şehircilik Bakanlığı kararınca, belirli bir büyüklüğün (örn: 2000 m²) üzerindeki parsellerde, çatılardan gelen yağmur suyunu toplayıp filtreleyerek bahçe sulamada veya rezervuarlarda kullanmak üzere yeraltı tankında depolayan ekolojik ve zorunlu bir sistemdir.",
  "Bahçe / Çevre Duvarı": "Arsa sınırlarını netleştirmek, sokaktan izinsiz girişleri engellemek ve bahçe kotunun yol kotundan yüksek olması durumunda toprak kaymasını (istinat) durdurmak amacıyla yapılan betonarme veya yığma taş çevre duvarıdır.",
  "Ağaç Dikimi": "Belediyelerin peyzaj onayı ve iskan (yapı kullanma izni) şartları gereğince, inşaat bitiminde arsanın yeşil alan büyüklüğüne göre hesaplanan asgari sayıda yetişkin ağaç ve fidanın temin edilip dikilmesi maliyetidir.",
  "Otopark Yüzey Sertleştirici (Helikopterli Beton)": "Kapalı otopark zeminlerinde tozumayı önlemek ve dayanımı artırmak için uygulanan kuvars/korund katkılı helikopter perdahlı beton/şap yüzey işlemidir.",
  "Sığınak Kapısı ve Havalandırma Paketi": "Sığınak yönetmeliğine uygun çelik sığınak kapıları ve radyoaktif/biyolojik partikül tutucu karbon filtreli havalandırma (santral) sistemidir.",
  "Otopark Yangın ve Jet Fan Sistemi": "Kapalı otoparklarda egzoz dumanını tahliye etmek (jet fan) ve olası araç yangınlarına müdahale etmek için kurulan sulu söndürme (sprinkler) altyapısıdır.",

};

export const COST_DATA: CostCategory[] = RAW_COST_DATA.map(cat => ({
  id: cat.id,
  title: cat.title,
  items: cat.items.map(item => {

    // 1. Fiyatı constants.ts (DEFAULT_PRICES) içinden bul
    const fallbackPrice = DEFAULT_PRICES[item.name];

    // 2. Eğer varsa onu kullan, yoksa ve bu bir paket fiyatıysa 1 kullan (çökmeyi önlemek için), hiçbiri yoksa 0 kullan.
    let finalPrice = 0;
    if (fallbackPrice !== undefined) {
      finalPrice = fallbackPrice;
    } else if (item.inputType === 'manual_total') {
      finalPrice = 1;
    }

    return {
      ...item,
      unit_price: finalPrice // Fiyatı otomatik olarak enjekte ediyoruz
    } as CostItem;
  })
}));