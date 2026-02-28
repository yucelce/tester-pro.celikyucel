// src/brand_data.ts

export interface BrandInfo {
  id: string;
  name: string;
  image: string;
}

export interface BrandCategory {
  categoryId: string;
  title: string;
  brands: BrandInfo[];
}

// Wix 'wix:image://v1/...' linklerini tarayıcı uyumlu hale getiren yardımcı fonksiyon
const formatWixUrl = (wixUrl: string) => {
  const match = wixUrl.match(/v1\/([^/]+)/);
  return match ? `https://static.wixstatic.com/media/${match[1]}` : '';
};

export const BRAND_CATEGORIES: BrandCategory[] = [
  {
    categoryId: 'ankastre', title: 'Ankastre & Beyaz Eşya', brands: [
      { id: 'ank_miele', name: 'Miele', image: formatWixUrl('wix:image://v1/0ded6e_ebb88731fb7347608217a3fad4f0602c~mv2.jpg/Ankastre_MIELE.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_franke', name: 'Franke', image: formatWixUrl('wix:image://v1/0ded6e_247313e306324498b6bf016e6313a471~mv2.jpg/Ankastre_franke.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_electrolux', name: 'Electrolux', image: formatWixUrl('wix:image://v1/0ded6e_22a5b60792354d56aa8c6b2cb35a9a38~mv2.jpg/Ankastre_electrolux.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_gaggenau', name: 'Gaggenau', image: formatWixUrl('wix:image://v1/0ded6e_071323532241487aa367c9ea223a1d5d~mv2.jpg/Ankastre_GAGGENAU.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_regal', name: 'Regal', image: formatWixUrl('wix:image://v1/0ded6e_5ab0008a43504953b3ef0839c1c8f624~mv2.jpg/Ankastre_REGAL.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_vestel', name: 'Vestel', image: formatWixUrl('wix:image://v1/0ded6e_731397e023ec45419c0f438cc48905fe~mv2.jpg/Ankastre_VESTEL.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_norm', name: 'Norm', image: formatWixUrl('wix:image://v1/0ded6e_09fea0cecf6148408777e4dd5ed5e681~mv2.jpg/Ankastre_NORM.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_grohe', name: 'Grohe', image: formatWixUrl('wix:image://v1/0ded6e_a225d6b71c96429f9421410f7352dcd5~mv2.jpg/Ankastre_GROHE.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_selena', name: 'Selena', image: formatWixUrl('wix:image://v1/0ded6e_9050eb7bf6b64b1d970975f2ec988427~mv2.jpg/Ankastre_SELENA.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_siamp', name: 'Siamp', image: formatWixUrl('wix:image://v1/0ded6e_6063e5f41e5d477f9da6dfc451dce084~mv2.jpg/Ankastre_SIAMP.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_egevit', name: 'Ege Vitrifiye', image: formatWixUrl('wix:image://v1/0ded6e_67a23b4d516e4f0288b78622f27507c8~mv2.jpg/Ankastre_EGE_V%C4%B0TR%C4%B0F%C4%B0YE.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_bocchi', name: 'Bocchi', image: formatWixUrl('wix:image://v1/0ded6e_e0a6e752878f4abdbdfd6b70a104406a~mv2.jpg/Ankastre_BOCCHI.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_termikel', name: 'Termikel', image: formatWixUrl('wix:image://v1/0ded6e_0f9266af782f4edb88b3a534829e93af~mv2.jpg/Ankastre_TERM%C4%B0KEL_.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_altus', name: 'Altus', image: formatWixUrl('wix:image://v1/0ded6e_d84b01535e1b46ee96f0a0b264b29a70~mv2.jpg/Ankastre_ALTUS.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_silverline', name: 'Silverline', image: formatWixUrl('wix:image://v1/0ded6e_95f086d3f19f4934b62f3c447bb540fc~mv2.jpg/Ankastre_SILVERL%C4%B0NE_.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_samsung', name: 'Samsung', image: formatWixUrl('wix:image://v1/0ded6e_45aff86eb2b14968adcd767f3c2aaab0~mv2.jpg/Ankastre_SAMSUNG.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_hotpoint', name: 'Hotpoint', image: formatWixUrl('wix:image://v1/0ded6e_02c0b7026bf74db1a1a6f921b06ee620~mv2.jpg/Ankastre_HOTPO%C4%B0NT.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_kumtel', name: 'Kumtel', image: formatWixUrl('wix:image://v1/0ded6e_412663e96da84ea69d3ab49af695ae9d~mv2.jpg/Ankastre_KUMTEL.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_profilo', name: 'Profilo', image: formatWixUrl('wix:image://v1/0ded6e_f9e3b74108104963bca19a4e17bf57c9~mv2.jpg/Ankastre_PROF%C4%B0LO_.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_ukinox', name: 'Ukinox', image: formatWixUrl('wix:image://v1/0ded6e_343e4d6009a040488d96181c9451503a~mv2.jpg/Ankastre_uk%C4%B1nox.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_serel', name: 'Serel', image: formatWixUrl('wix:image://v1/0ded6e_bcca6f378bf34eb5bd60e5111e1a7556~mv2.jpg/Ankastre_SEREL.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_hoover', name: 'Hoover', image: formatWixUrl('wix:image://v1/0ded6e_6738776e3e3c4331955a62701dfdf656~mv2.jpg/Ankastre_HOOVER.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_sanica', name: 'Sanica', image: formatWixUrl('wix:image://v1/0ded6e_2ae9dc47dc764b5988aa380eecf815e5~mv2.jpg/Is%C4%B1tma_sanica.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_siemens', name: 'Siemens', image: formatWixUrl('wix:image://v1/0ded6e_4f4a798869554f77bf0726a63435555b~mv2.jpg/Yang%C4%B1nSistemleri_SIEMENS.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_bosch', name: 'Bosch', image: formatWixUrl('wix:image://v1/0ded6e_1e610b2ca5eb488a894ec1ee2630c8ba~mv2.jpg/Yang%C4%B1nSistemleri_BOSCH.jpg#originWidth=256&originHeight=256') },
      { id: 'ank_creavit', name: 'Creavit', image: formatWixUrl('wix:image://v1/0ded6e_4a2e344a5dc847ee8064cd2f114c8612~mv2.jpg/Seramik_%C3%87ANAK%C3%87ILAR_SERAM%C4%B0K_-_CREAV%C4%B0T.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'asansor', title: 'Asansör Sistemleri', brands: [
      { id: 'asn_kone', name: 'Kone', image: formatWixUrl('wix:image://v1/0ded6e_e3c20ce2c7e3497abfecc47cb7763ddb~mv2.jpg/Asans%C3%B6r_kone.jpg#originWidth=256&originHeight=256') },
      { id: 'asn_schindler', name: 'Schindler', image: formatWixUrl('wix:image://v1/0ded6e_524868d8d26a4c26b829479d38a5ef25~mv2.jpg/Asans%C3%B6r_SCH%C4%B0NDLER_T%C3%9CRKEL%C4%B0_.jpg#originWidth=256&originHeight=256') },
      { id: 'asn_thyssen', name: 'Thyssenkrupp', image: formatWixUrl('wix:image://v1/0ded6e_68463fa69dcb42ebaf3e354cd424aa20~mv2.jpg/Asans%C3%B6r_THYSSENKRUPP.jpg#originWidth=256&originHeight=256') },
      { id: 'asn_ersan', name: 'Ersan', image: formatWixUrl('wix:image://v1/0ded6e_9f8ef126691142a898e60c6dd975d79c~mv2.jpg/Asans%C3%B6r_ERSAN.jpg#originWidth=256&originHeight=256') },
      { id: 'asn_mitsubishi', name: 'Mitsubishi', image: formatWixUrl('wix:image://v1/0ded6e_89e87971bf814dc28d691a2f5f8cd256~mv2.jpg/Asans%C3%B6r_MITSUBISHI_ELECTRIC_.jpg#originWidth=256&originHeight=256') },
      { id: 'asn_otis', name: 'Buga Otis', image: formatWixUrl('wix:image://v1/0ded6e_1da0fd1f35e2432f8fe59c7c9f7fe1c7~mv2.jpg/Asans%C3%B6r_BUGA_OT%C4%B0S_.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'duvar', title: 'Duvar Sistemleri', brands: [
      { id: 'duv_basak', name: 'Başak Kiremit', image: formatWixUrl('wix:image://v1/0ded6e_8a708dcdf5c342499ac1c80c6b510dab~mv2.jpg/Duvar_BA%C5%9EAK_K%C4%B0REM%C4%B0T_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_kral', name: 'Kral', image: formatWixUrl('wix:image://v1/0ded6e_131200e80084403681fb7155e7607aef~mv2.jpg/Duvar_KRAL_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_bloksan', name: 'Bloksan', image: formatWixUrl('wix:image://v1/0ded6e_17fd1dd2739e4f519bbf1df2b0d3088f~mv2.jpg/Duvar_BLOKSAN_K%C4%B0REM%C4%B0T_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_ytong', name: 'Ytong', image: formatWixUrl('wix:image://v1/0ded6e_f08a7f9f052e423ea296e42ee41a0245~mv2.jpg/Duvar_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_isiklar', name: 'Işıklar Yapı', image: formatWixUrl('wix:image://v1/0ded6e_f99c12bee45748b186f2c9bffe98f015~mv2.jpg/Duvar_I%C5%9EIKLAR_YAPI.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_kilsan', name: 'Kilsan', image: formatWixUrl('wix:image://v1/0ded6e_06ff43060bcd49d898e7a10b88076b3b~mv2.jpg/Duvar_K%C4%B0LSAN_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_yuksel', name: 'Yüksel', image: formatWixUrl('wix:image://v1/0ded6e_ca0bce81c7b14779815c4fa21116773f~mv2.jpg/Duvar_Y%C3%9CKSEL_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_akg', name: 'AKG Gazbeton', image: formatWixUrl('wix:image://v1/0ded6e_1a2275f8603b42b7bb39acf6acc3e6c2~mv2.jpg/Duvar_AKGGAZBETON.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_doganay', name: 'Doğanay', image: formatWixUrl('wix:image://v1/0ded6e_1f3a1b38f51249b2bb2debeb9f25df51~mv2.jpg/Duvar_DO%C4%9EANAY_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_balci', name: 'Balcı', image: formatWixUrl('wix:image://v1/0ded6e_0dd7f6c437314647a57a3d19af920e5a~mv2.jpg/Duvar_BALCI_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_nuh', name: 'Nuh Gazbeton', image: formatWixUrl('wix:image://v1/0ded6e_bdbe0c0b156d4daea6a721f2e1a4477c~mv2.jpg/Duvar_NUHGAZBETON.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_ak', name: 'AK Duvar', image: formatWixUrl('wix:image://v1/0ded6e_f24b4db98de8466a8aed9aa97338dce4~mv2.jpg/Duvar_AK_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_kudret', name: 'Kudret', image: formatWixUrl('wix:image://v1/0ded6e_942d1e8ca4a948fcbd836e4a26759063~mv2.jpg/Duvar_KUDRET_Duvar.jpg#originWidth=256&originHeight=256') },
      { id: 'duv_boran', name: 'Boran', image: formatWixUrl('wix:image://v1/0ded6e_455b0fdac78c40acbfc638f87d6ee568~mv2.jpg/Duvar_BORAN_Duvar_.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'isitma', title: 'Mekanik & Tesisat', brands: [
      { id: 'ist_beko', name: 'Beko', image: formatWixUrl('wix:image://v1/0ded6e_104aec37cf5d4e8299c9df2d6fe8d538~mv2.jpg/Is%C4%B1tma_BEKO.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_sanica', name: 'Sanica', image: formatWixUrl('wix:image://v1/0ded6e_2ae9dc47dc764b5988aa380eecf815e5~mv2.jpg/Is%C4%B1tma_sanica.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_arcelik', name: 'Arçelik', image: formatWixUrl('wix:image://v1/0ded6e_bd372fff20254291b1d040e001cf2c59~mv2.jpg/Is%C4%B1tma_AR%C3%87EL%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_teka', name: 'Teka', image: formatWixUrl('wix:image://v1/0ded6e_3235ba5a709d41bab5b32ad61773b6a8~mv2.jpg/Is%C4%B1tma_TEKA.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_egematur', name: 'Egematür', image: formatWixUrl('wix:image://v1/0ded6e_fac3b92713344abd9ba99074c39e44cb~mv2.jpg/Is%C4%B1tma_EGEMAT%C3%9CR.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_huppe', name: 'Hüppe', image: formatWixUrl('wix:image://v1/0ded6e_6f0e9698242f4954931d7a3f1b4c8e1f~mv2.jpg/Is%C4%B1tma_H%C3%9CPPE.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_daxom', name: 'Daxom', image: formatWixUrl('wix:image://v1/0ded6e_b54f2f21280f434c8f49a6e9e2f4699e~mv2.jpg/Is%C4%B1tma_DAXOM.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_plastherm', name: 'Plastherm', image: formatWixUrl('wix:image://v1/0ded6e_2039ce1ccb5f4bf88c4262c1aa7d8385~mv2.jpg/Is%C4%B1tma_PLASTHERM.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_baymak', name: 'Baymak', image: formatWixUrl('wix:image://v1/0ded6e_56c3df4620fb42b1ae05a3973861387c~mv2.jpg/Is%C4%B1tma_BAYMAK.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_hansgrohe', name: 'Hansgrohe', image: formatWixUrl('wix:image://v1/0ded6e_57fb76dd55784668a61043de3bc606cf~mv2.jpg/Is%C4%B1tma_hansgrohe.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_viessman', name: 'Viessman', image: formatWixUrl('wix:image://v1/0ded6e_84d68590bedd4162933ac646dc659974~mv2.jpg/Is%C4%B1tma_VIESSMAN.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_egeyildiz', name: 'Ege Yıldız', image: formatWixUrl('wix:image://v1/0ded6e_1e415824e2564352a9650bc8bf7a05fd~mv2.jpg/Is%C4%B1tma_EGEYILDIZ_PLAST%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_celikpan', name: 'Çelikpan', image: formatWixUrl('wix:image://v1/0ded6e_3be9e8e6254b487da2a05aec5487cf35~mv2.jpg/Is%C4%B1tma_%C3%87EL%C4%B0KPAN.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_dizayn', name: 'Dizayn Grup', image: formatWixUrl('wix:image://v1/0ded6e_16c711cb178c4471949fcc2647ee2bd7~mv2.jpg/Is%C4%B1tma_D%C4%B0ZAYNGRUP.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_firatboru', name: 'Fırat Boru', image: formatWixUrl('wix:image://v1/0ded6e_9aac8a97d7044c6bbcc16abcd3c5b81e~mv2.jpg/Is%C4%B1tma_FIRATBORU.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_mastas', name: 'Mastaş', image: formatWixUrl('wix:image://v1/0ded6e_825cf0df552c4d279edfb4e8dd70547f~mv2.jpg/Is%C4%B1tma_MASTA%C5%9E.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_duravit', name: 'Duravit', image: formatWixUrl('wix:image://v1/0ded6e_1be1af2fb4834c2c86f3c8829677308c~mv2.jpg/Is%C4%B1tma_DURAV%C4%B0T.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_eca', name: 'E.C.A', image: formatWixUrl('wix:image://v1/0ded6e_42ae4c6b9c3e456e97f8346fa6163f26~mv2.jpg/Is%C4%B1tma_E.C.A.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_buderus', name: 'Buderus', image: formatWixUrl('wix:image://v1/0ded6e_93b299820ee94dcc90e919b34e14f37c~mv2.jpg/Is%C4%B1tma_BUDERUS.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_demirdokum', name: 'Demirdöküm', image: formatWixUrl('wix:image://v1/0ded6e_45371ef7726b454d87c532b78401b13a~mv2.jpg/Is%C4%B1tma_Demird%C3%B6k%C3%BCm.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_daikin', name: 'Daikin', image: formatWixUrl('wix:image://v1/0ded6e_1c3a78fa2d5f483f8290e3a06ad276ca~mv2.jpg/Is%C4%B1tma_DAIKIN.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_artema', name: 'Artema', image: formatWixUrl('wix:image://v1/0ded6e_19aa92ed05f849be897f2db0b579202b~mv2.jpg/Is%C4%B1tma_ARTEMA.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_vaillant', name: 'Vaillant', image: formatWixUrl('wix:image://v1/0ded6e_206596105b1d4f628eebd2f7c1fede89~mv2.jpg/Is%C4%B1tma_VAILLANT.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_truva', name: 'Truva', image: formatWixUrl('wix:image://v1/0ded6e_03e76e23dd7f4a6fa4c232c92d7efe15~mv2.jpg/Is%C4%B1tma_TRUVA.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_kare', name: 'Kare', image: formatWixUrl('wix:image://v1/0ded6e_24eb3524c7a0471b886d3c16baf59e26~mv2.jpg/Is%C4%B1tma_KARE.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_pipelife', name: 'Pipelife', image: formatWixUrl('wix:image://v1/0ded6e_3702649e14e247908d32b54f1720aa5f~mv2.jpg/Is%C4%B1tma_PIPEL%C4%B0FE.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_seremi', name: 'Seremi', image: formatWixUrl('wix:image://v1/0ded6e_410b6cfeb47e4e1eb2bff700c29fe5dc~mv2.jpg/Is%C4%B1tma_SEREM%C4%B0.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_ayen', name: 'Ayen', image: formatWixUrl('wix:image://v1/0ded6e_04825c5c44114dfe89fed2a65ca639b0~mv2.jpg/Is%C4%B1tma_AYEN_.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_gms', name: 'GMS', image: formatWixUrl('wix:image://v1/0ded6e_9773253f4c6f4b918ff1be50d1717501~mv2.jpg/Is%C4%B1tma_GMS_.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_immergas', name: 'Immergas', image: formatWixUrl('wix:image://v1/0ded6e_4f0731fc301b4a308207127afe0b3253~mv2.jpg/Is%C4%B1tma_IMMERGAS.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_isinboru', name: 'Işınboru', image: formatWixUrl('wix:image://v1/0ded6e_0a7e4ba3650747ec8d9f481911afa822~mv2.jpg/Is%C4%B1tma_I%C5%9EINBORU.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_brotje', name: 'Brötje', image: formatWixUrl('wix:image://v1/0ded6e_9d13ef0ce44f4e7ea9ccac78d00d309b~mv2.jpg/Is%C4%B1tma_BR%C3%96TJE.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_adell', name: 'Adell', image: formatWixUrl('wix:image://v1/0ded6e_6bb3912cd56c4fd8a78cc7a705203f60~mv2.jpg/Is%C4%B1tma_adell.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_copa', name: 'Copa', image: formatWixUrl('wix:image://v1/0ded6e_e7c6db4577b545938116e05690f8b5a2~mv2.jpg/Is%C4%B1tma_COPA.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_wawinpilsa', name: 'Wawinpilsa', image: formatWixUrl('wix:image://v1/0ded6e_9dd1d16512684d8b896e9c69a632087b~mv2.jpg/Is%C4%B1tma_WAWINP%C4%B0LSA.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_termoakim', name: 'Termoakım', image: formatWixUrl('wix:image://v1/0ded6e_a684b752c115400aa0a5d22df258b8e7~mv2.jpg/Is%C4%B1tma_TERMOAKIM.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_termoteknik', name: 'Termoteknik', image: formatWixUrl('wix:image://v1/0ded6e_b30bb15781ac4cf79d7e6bfe132d5a16~mv2.jpg/Is%C4%B1tma_TERMOTEKN%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_pekpan', name: 'Pekpan', image: formatWixUrl('wix:image://v1/0ded6e_9f199cdb136247d4879da309637d7e6a~mv2.jpg/Is%C4%B1tma_PEKPAN.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_protherm', name: 'Protherm', image: formatWixUrl('wix:image://v1/0ded6e_4578d253882d458a9f101930cffc9b62~mv2.jpg/Is%C4%B1tma_PROTHERM.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_radyal', name: 'Radyal', image: formatWixUrl('wix:image://v1/0ded6e_3bf5af4173614679bacfb9477c5c3db9~mv2.jpg/Is%C4%B1tma_RADYAL.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_emko', name: 'Emko', image: formatWixUrl('wix:image://v1/0ded6e_1332a1296106422c9a3fca3322aaf6ff~mv2.jpg/Is%C4%B1tma_EMKO.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_egeplast', name: 'Egeplast', image: formatWixUrl('wix:image://v1/0ded6e_08dde9e3e5a44eb58671472b6870c84f~mv2.jpg/Is%C4%B1tma_EGEPLAST.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_ariston', name: 'Ariston', image: formatWixUrl('wix:image://v1/0ded6e_70ed47650ce84d4a9d8d1893b7293393~mv2.jpg/Is%C4%B1tma_AR%C4%B0STON.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_gpd', name: 'Gpd', image: formatWixUrl('wix:image://v1/0ded6e_3e54d44a64b64203a92b3563bca73073~mv2.jpg/Is%C4%B1tma_GPD.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_kas', name: 'Kas', image: formatWixUrl('wix:image://v1/0ded6e_fc20433f0e3e4bd3a508975dcb0fd266~mv2.jpg/Is%C4%B1tma_KAS.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_newarc', name: 'Newarc', image: formatWixUrl('wix:image://v1/0ded6e_c7f9765dbe6645f584efd02da6dcac0f~mv2.jpg/Is%C4%B1tma_NEWARC.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_tema', name: 'Tema', image: formatWixUrl('wix:image://v1/0ded6e_986bb754d9b7467bac77305e2e712bef~mv2.jpg/Is%C4%B1tma_TEMA.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_seval', name: 'Seval', image: formatWixUrl('wix:image://v1/0ded6e_9812a0f9e91a403696a460a08e722251~mv2.jpg/Is%C4%B1tma_SEVAL.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_pansa', name: 'Pansa', image: formatWixUrl('wix:image://v1/0ded6e_9e67a1752a074bb78b2dca2bff594ca3~mv2.jpg/Is%C4%B1tma_PANSA.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_berkeplastik', name: 'Berkeplastik', image: formatWixUrl('wix:image://v1/0ded6e_b098ba2c551c42e1acc11830a25d4df7~mv2.jpg/Is%C4%B1tma_BERKEPLAST%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_termodinamik', name: 'Termodinamik', image: formatWixUrl('wix:image://v1/0ded6e_e354d19a18e64bff951dd8154f9b87d8~mv2.jpg/Is%C4%B1tma_TERMOD%C4%B0NAM%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_lambert', name: 'Lambert', image: formatWixUrl('wix:image://v1/0ded6e_e64405a5f7734b6d91a764bd4b9b102a~mv2.jpg/Is%C4%B1tma_LAMBERT.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_klepsan', name: 'Klepsan', image: formatWixUrl('wix:image://v1/0ded6e_ea6cfa264d67466886427155732ac5e2~mv2.jpg/Is%C4%B1tma_KLEPSAN.jpg#originWidth=256&originHeight=256') },
      { id: 'ist_hakanplastik', name: 'Hakanplastik', image: formatWixUrl('wix:image://v1/0ded6e_15d476d9f7984f05b6368ca137030a1b~mv2.jpg/Is%C4%B1tma_HAKANPLAST%C4%B0K.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'kapi', title: 'Kapı Markaları', brands: [
      { id: 'kap_artella', name: 'Artella', image: formatWixUrl('wix:image://v1/0ded6e_5f80c52826a749c9a75f19078b85f6e8~mv2.jpg/Kap%C4%B1_ARTELLA.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_stildoor', name: 'Stildoor', image: formatWixUrl('wix:image://v1/0ded6e_bb76fe74698540d7bdcda92a35c7af0f~mv2.jpg/Kap%C4%B1_ST%C4%B0LDOOR.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_ertakapi', name: 'Ertakapı', image: formatWixUrl('wix:image://v1/0ded6e_26bdd50091224d4982b4effbb69441f5~mv2.jpg/Kap%C4%B1_ERTAKAPI.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_surcelikkapi', name: 'Surçelikkapı', image: formatWixUrl('wix:image://v1/0ded6e_538f6db4a1d84bf6b86cbe97cbf7ddff~mv2.jpg/Kap%C4%B1_SUR%C3%87EL%C4%B0KKAPI.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_rotadoor', name: 'Rotadoor', image: formatWixUrl('wix:image://v1/0ded6e_001e5a14486540eaa65576aaae07aebe~mv2.jpg/Kap%C4%B1_ROTADOOR.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_doorx', name: 'Doorx', image: formatWixUrl('wix:image://v1/0ded6e_0914cb4f87e84f21b0745d843a840e4b~mv2.jpg/Kap%C4%B1_DOORX.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_minadoor', name: 'Minadoor', image: formatWixUrl('wix:image://v1/0ded6e_6df70f9c81984164945776d6e8a8eb19~mv2.jpg/Kap%C4%B1_M%C4%B0NADOOR.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_decokapi', name: 'Deco Kapı', image: formatWixUrl('wix:image://v1/0ded6e_d051ad639d50437d9444e87de36d0642~mv2.jpg/Kap%C4%B1_DECO_KAPI_.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_dorstil', name: 'Dorstil', image: formatWixUrl('wix:image://v1/0ded6e_bb76fe74698540d7bdcda92a35c7af0f~mv2.jpg/Kap%C4%B1_ST%C4%B0LDOOR.jpg#originWidth=256&originHeight=256') }, // URL seems to reuse stildoor in CSV
      { id: 'kap_artpan', name: 'Artpan', image: formatWixUrl('wix:image://v1/0ded6e_3a3874689fcc42dcbe0d2fe12ee720a7~mv2.jpg/Kap%C4%B1_ARTPAN.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_kalecelik', name: 'Kale Çelik Eşya', image: formatWixUrl('wix:image://v1/0ded6e_4971b13d6f56464eb1c48f888a95e45b~mv2.jpg/Kap%C4%B1_KALE_%C3%87EL%C4%B0K_E%C5%9EYA_.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_dortek', name: 'Dortek', image: formatWixUrl('wix:image://v1/0ded6e_43e8c46b218c4c05a09a52c955868c0f~mv2.jpg/Kap%C4%B1_DORTEK.jpg#originWidth=256&originHeight=256') },
      { id: 'kap_hisarcelik', name: 'Hisar Çelik Kapı', image: formatWixUrl('wix:image://v1/0ded6e_0f0f129012874887bf2df95670f2288b~mv2.jpg/Kap%C4%B1_H%C4%B0SAR_%C3%87EL%C4%B0K_KAPI_.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'sap', title: 'Şap Markaları', brands: [
      { id: 'sap_kalekim', name: 'Kalekim', image: formatWixUrl('wix:image://v1/0ded6e_c08efd1b06b34af3a5e02cb81a58db4b~mv2.jpg/%C5%9Eap_kalekim.jpg#originWidth=256&originHeight=256') },
      { id: 'sap_adocim', name: 'Adoçim', image: formatWixUrl('wix:image://v1/0ded6e_e50e6bdf2806484ba46f7c31c9c9988e~mv2.jpg/%C5%9Eap_ado%C3%A7im.jpg#originWidth=256&originHeight=256') },
      { id: 'sap_nuh', name: 'Nuh', image: formatWixUrl('wix:image://v1/0ded6e_b4d840b5f2bd407f980192bebd85777a~mv2.jpg/%C5%9Eap_nuh.jpg#originWidth=256&originHeight=256') },
      { id: 'sap_cimsa', name: 'Çimsa', image: formatWixUrl('wix:image://v1/0ded6e_e457f705fd7449b2bd4e9c4a0e48dd0e~mv2.jpg/%C5%9Eap_%C3%A7imsa.jpg#originWidth=256&originHeight=256') },
      { id: 'sap_oyak', name: 'Oyak', image: formatWixUrl('wix:image://v1/0ded6e_eedadec6e71243ad8322711a7a72faa2~mv2.jpg/%C5%9Eap_oyak.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'parke', title: 'Parke Markaları', brands: [
      { id: 'parke_serfloor', name: 'Serfloor', image: formatWixUrl('wix:image://v1/0ded6e_b9303828cb534f0b9c1052883af0165f~mv2.jpg/Parke_SERFLOOR.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_agt', name: 'Agt', image: formatWixUrl('wix:image://v1/0ded6e_ffd07287ea624d308b3868ae322b66d4~mv2.jpg/Parke_AGT.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_vario', name: 'Vario', image: formatWixUrl('wix:image://v1/0ded6e_b7848e5466ab4fd3ad335f798103ccc4~mv2.jpg/Parke_VARIO.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_gural', name: 'Güral Parke', image: formatWixUrl('wix:image://v1/0ded6e_47869dddc1274b739633f1bac6221f70~mv2.jpg/Parke_G%C3%9CRAL_PARKE.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_moonloc', name: 'Moonloc', image: formatWixUrl('wix:image://v1/0ded6e_96772c56a2684238a08b6cf55f1f244c~mv2.jpg/Parke_MOONLOC.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_luxfloor', name: 'Luxfloor', image: formatWixUrl('wix:image://v1/0ded6e_0cba105a66e640c4ae9cfcc08a83485e~mv2.jpg/Parke_LUXFLOOR.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_floorline', name: 'Floorline', image: formatWixUrl('wix:image://v1/0ded6e_85872fa8859249a699addfcbaaca2960~mv2.jpg/Parke_FLOORLINE.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_terraclick', name: 'Terraclick', image: formatWixUrl('wix:image://v1/0ded6e_86d25f8bd426493e88f0e07b17f45fdc~mv2.jpg/Parke_TERRACLICK.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_artfloor', name: 'Artfloor', image: formatWixUrl('wix:image://v1/0ded6e_0e148526490d491db793b963c208efbc~mv2.jpg/Parke_ARTFLOOR.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_floorpan', name: 'Floorpan', image: formatWixUrl('wix:image://v1/0ded6e_7092be927a294f2a806fdaf72aae1f9e~mv2.jpg/Parke_FLOORPAN.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_camsan', name: 'Çamsan Parke', image: formatWixUrl('wix:image://v1/0ded6e_fb5d533bc4dd42edb5f18eca7d829f13~mv2.jpg/Parke_%C3%87AMSAN_PARKE.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_egger', name: 'Egger', image: formatWixUrl('wix:image://v1/0ded6e_be421ff4b3d349d3a27cda9a1bb3524a~mv2.jpg/Parke_EGGER.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_sunfloor', name: 'Sunfloor', image: formatWixUrl('wix:image://v1/0ded6e_25c64a2d3b74469680df0f6ee5fdf6ed~mv2.jpg/Parke_SUNFLOOR.jpg#originWidth=256&originHeight=256') },
      { id: 'parke_serifoglu', name: 'Şerifoğlu', image: formatWixUrl('wix:image://v1/0ded6e_b84c1e16c8434e16a6b50059fbc351f3~mv2.jpg/Parke_%C5%9EER%C4%B0FO%C4%9ELU.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'seramik', title: 'Seramik Markaları', brands: [
      { id: 'ser_kale', name: 'Kale Seramik', image: formatWixUrl('wix:image://v1/0ded6e_97ed227eed6a470c9a825680d4351736~mv2.jpg/Seramik_KALE_SERAM%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_canakkale', name: 'Çanakkale Seramik', image: formatWixUrl('wix:image://v1/0ded6e_40dc2705f508459b889b18e3f4c82dca~mv2.jpg/Seramik_%C3%87ANAKKALE_SERAM%C4%B0K_.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_ege', name: 'Ege Seramik', image: formatWixUrl('wix:image://v1/0ded6e_179d4419c4094740a6c840254c851b4f~mv2.jpg/Seramik_EGE_SERAM%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_serra', name: 'Serra Seramik', image: formatWixUrl('wix:image://v1/0ded6e_550fc9b73f0d415192b9c6a860db277f~mv2.jpg/Seramik_SERRA_SERAM%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_duratiles', name: 'Duratiles', image: formatWixUrl('wix:image://v1/0ded6e_be24d37beca84f7fa7e47254b518ecd6~mv2.jpg/Seramik_DURAT%C4%B0LES.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_hitit', name: 'Hitit Seramik', image: formatWixUrl('wix:image://v1/0ded6e_9d7d7072fa064a53a971aa15a97fde53~mv2.jpg/Seramik_H%C4%B0T%C4%B0T_SERAM%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_canakcilar_creavit', name: 'Çanakçılar - Creavit', image: formatWixUrl('wix:image://v1/0ded6e_4a2e344a5dc847ee8064cd2f114c8612~mv2.jpg/Seramik_%C3%87ANAK%C3%87ILAR_SERAM%C4%B0K_-_CREAV%C4%B0T.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_vitra', name: 'Vitra', image: formatWixUrl('wix:image://v1/0ded6e_b69a097d0087458c8edafb293ba6ab4e~mv2.jpg/Seramik_V%C4%B0TRA.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_yurtbay', name: 'Yurtbay Seramik', image: formatWixUrl('wix:image://v1/0ded6e_a1046048a49d4e76b6e1c9c444643b42~mv2.jpg/Seramik_YURTBAY_SERAM%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_graniser', name: 'Graniser', image: formatWixUrl('wix:image://v1/0ded6e_66642e9863744e9bae64271883a0b3b8~mv2.jpg/Seramik_GRAN%C4%B0SER.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_usak', name: 'Uşak Seramik', image: formatWixUrl('wix:image://v1/0ded6e_44508c12044f4051a9b03e7bfbd60cde~mv2.jpg/Seramik_U%C5%9EAK_SERAM%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_yuksel', name: 'Yüksel Seramik', image: formatWixUrl('wix:image://v1/0ded6e_427e052ca8b541f4ad6eec8d95b7ebfa~mv2.jpg/Seramik_Y%C3%9CKSEL_SERAM%C4%B0K.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_bien', name: 'Bien', image: formatWixUrl('wix:image://v1/0ded6e_74f004a98c8c4e778e63278df288a01a~mv2.jpg/Seramik_B%C4%B0EN.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_cifre', name: 'Cifre', image: formatWixUrl('wix:image://v1/0ded6e_3394ba601da04acdbf165d09900b8dc8~mv2.jpg/Seramik_CIFRE.jpg#originWidth=256&originHeight=256') },
      { id: 'ser_ng_kutahya', name: 'NG Kütahya', image: formatWixUrl('wix:image://v1/0ded6e_fc2f8e7e48ba42bdbd280c2a860783f6~mv2.jpg/Seramik_NG_K%C3%9CTAHYA.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'mermer', title: 'Mermer Markaları', brands: [
      { id: 'mer_nesa', name: 'Nesa Mermer', image: formatWixUrl('wix:image://v1/0ded6e_c77cc76e90644a108bcb9be37d802ef1~mv2.jpg/Mermer_NESA_MERMER.jpg#originWidth=256&originHeight=256') },
      { id: 'mer_afyon', name: 'Afyon Mermer', image: formatWixUrl('wix:image://v1/0ded6e_b51310e193b94b7bbb5b3de3f870d2a5~mv2.jpg/Mermer_AFYON_MERMER_.jpg#originWidth=256&originHeight=256') },
      { id: 'mer_bekamar', name: 'Bekamar', image: formatWixUrl('wix:image://v1/0ded6e_ac708ad767cd4cf7a7efcb23f1e48a27~mv2.jpg/Mermer_BEKAMAR.jpg#originWidth=256&originHeight=256') },
      { id: 'mer_plato', name: 'Plato Mermer', image: formatWixUrl('wix:image://v1/0ded6e_43d9daf9adfc488cad10f87dbcccec32~mv2.jpg/Mermer_PLATO_MERMER.jpg#originWidth=256&originHeight=256') },
      { id: 'mer_kutuk', name: 'Kütük Mermer', image: formatWixUrl('wix:image://v1/0ded6e_b565cb8e052e4534a0a4d21ed1fd8ce6~mv2.jpg/Mermer_K%C3%9CT%C3%9CK_MERMER.jpg#originWidth=256&originHeight=256') },
      { id: 'mer_anadolu', name: 'Anadolu Mermer', image: formatWixUrl('wix:image://v1/0ded6e_4f1a0968ac1e4e439db57776944cef7b~mv2.jpg/Mermer_ANADOLU_MERMER.jpg#originWidth=256&originHeight=256') },
      { id: 'mer_granitas', name: 'Granitaş', image: formatWixUrl('wix:image://v1/0ded6e_d61eaffcea124b61a2ecd0461bb1e1e3~mv2.jpg/Mermer_GRAN%C4%B0TA%C5%9E.jpg#originWidth=256&originHeight=256') },
      { id: 'mer_yildizli', name: 'Mermer Yıldızlı Granit', image: formatWixUrl('wix:image://v1/0ded6e_571a6702bde84c9b9039c6e8d2ee528e~mv2.jpg/7ed716-mermeryildizli-granit.jpg#originWidth=256&originHeight=256') }
    ]
  },
  {
    categoryId: 'pencere', title: 'Pencere Markaları', brands: [
      { id: 'pen_rehau', name: 'Rehau', image: formatWixUrl('wix:image://v1/0ded6e_0234550991724345abc7431d908fec0a~mv2.jpg/Pencere_REHAU.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_pimapen', name: 'Pimapen', image: formatWixUrl('wix:image://v1/0ded6e_be1d812783ed4600883058da5aa2439f~mv2.jpg/Pencere_P%C4%B0MAPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_pakpen', name: 'Pakpen', image: formatWixUrl('wix:image://v1/0ded6e_ea435d06fde1403ea8c05a70b136aa12~mv2.jpg/Pencere_PAKPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_plaspen', name: 'Plaspen', image: formatWixUrl('wix:image://v1/0ded6e_69cfb9b00d4f4a1dbc5abdb072809be4~mv2.jpg/Pencere_PLASPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_alfapen', name: 'Alfapen', image: formatWixUrl('wix:image://v1/0ded6e_a3ac74efbf7842d4a0a906ffaf5b8576~mv2.jpg/Pencere_ALFAPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_gedizpen', name: 'Gedizpen', image: formatWixUrl('wix:image://v1/0ded6e_d220e3ec3d194aecbca5353eedcda812~mv2.jpg/Pencere_GED%C4%B0ZPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_filpen', name: 'Filpen', image: formatWixUrl('wix:image://v1/0ded6e_15fd8b7e6758473bbae3268932adde38~mv2.jpg/Pencere_F%C4%B0LPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_asaspen', name: 'Asaşpen', image: formatWixUrl('wix:image://v1/0ded6e_03796db750984c17a73868200e639519~mv2.jpg/Pencere_ASA%C5%9EPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_interpen', name: 'Interpen', image: formatWixUrl('wix:image://v1/0ded6e_79a19f15ac254a8a9203666832c518f7~mv2.jpg/Pencere_INTERPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_winsa', name: 'Winsa', image: formatWixUrl('wix:image://v1/0ded6e_36fcde2eea1340af981bc71fd4136323~mv2.jpg/Pencere_WINSA.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_kompen', name: 'Kompen', image: formatWixUrl('wix:image://v1/0ded6e_c5e87b78c9d54ec8b7818be077cc4dd4~mv2.jpg/Pencere_kompen.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_egepen', name: 'Egepen', image: formatWixUrl('wix:image://v1/0ded6e_cf4474278f07450eb2732b0157610748~mv2.jpg/Pencere_EGEPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_karpen', name: 'Karpen', image: formatWixUrl('wix:image://v1/0ded6e_eb617509b0c04f2899a21f63e93d2c7a~mv2.jpg/Pencere_KARPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_winhouse', name: 'Winhouse', image: formatWixUrl('wix:image://v1/0ded6e_5454626a4002452c9d864a3805f128dd~mv2.jpg/Pencere_WINHOUSE.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_firatpen', name: 'Fıratpen', image: formatWixUrl('wix:image://v1/0ded6e_9dcd9f3c7043460b86397388126219d8~mv2.jpg/Pencere_FIRATPEN.jpg#originWidth=256&originHeight=256') },
      { id: 'pen_kommerling', name: 'Kömmerling', image: formatWixUrl('wix:image://v1/0ded6e_21efa242d05d4097a4476fd19b038ff7~mv2.jpg/Pencere_K%C3%96MMERLING.jpg#originWidth=256&originHeight=256') }
    ]
  }
];