// src/constants.ts

export const TURKEY_HEAT_MAP: Record<string, { zone: number, districts: Record<string, number> }> = {
    "Adana": {
        zone: 1,
        districts: { "Aladağ": 1, "Ceyhan": 1, "Çukurova": 1, "Feke": 1, "İmamoğlu": 1, "Karaisalı": 1, "Karataş": 1, "Kozan": 1, "Pozantı": 3, "Saimbeyli": 1, "Sarıçam": 1, "Seyhan": 1, "Tufanbeyli": 1, "Yumurtalık": 1, "Yüreğir": 1 }
    },
    "Adıyaman": {
        zone: 2,
        districts: { "Besni": 2, "Çelikhan": 2, "Gerger": 2, "Gölbaşı": 2, "Kahta": 2, "Merkez": 2, "Samsat": 2, "Sincik": 2, "Tut": 2 }
    },
    "Afyonkarahisar": {
        zone: 3,
        districts: { "Başmakçı": 3, "Bayat": 3, "Bolvadin": 3, "Çay": 3, "Çobanlar": 3, "Dazkırı": 3, "Dinar": 3, "Emirdağ": 3, "Evciler": 3, "Hocalar": 3, "İhsaniye": 3, "İscehisar": 3, "Kızılören": 3, "Merkez": 3, "Sandıklı": 3, "Sinanpaşa": 3, "Sultandağı": 3, "Şuhut": 3 }
    },
    "Ağrı": {
        zone: 4,
        districts: { "Diyadin": 4, "Doğubayazıt": 4, "Eleşkirt": 4, "Hamur": 4, "Merkez": 4, "Patnos": 4, "Taşlıçay": 4, "Tutak": 4 }
    },
    "Aksaray": {
        zone: 3,
        districts: { "Ağaçören": 3, "Eskil": 3, "Gülağaç": 3, "Güzelyurt": 3, "Merkez": 3, "Ortaköy": 3, "Sarıyahşi": 3, "Sultanhanı": 3 }
    },
    "Amasya": {
        zone: 2,
        districts: { "Göynücek": 2, "Gümüşhacıköy": 2, "Hamamözü": 2, "Merkez": 2, "Merzifon": 3, "Suluova": 2, "Taşova": 2 }
    },
    "Ankara": {
        zone: 3,
        districts: { "Akyurt": 3, "Altındağ": 3, "Ayaş": 3, "Bala": 3, "Beypazarı": 3, "Çamlıdere": 3, "Çankaya": 3, "Çubuk": 3, "Elmadağ": 3, "Etimesgut": 3, "Evren": 3, "Gölbaşı": 3, "Güdül": 3, "Haymana": 3, "Kahramankazan": 3, "Kalecik": 3, "Keçiören": 3, "Kızılcahamam": 3, "Mamak": 3, "Nallıhan": 3, "Polatlı": 3, "Pursaklar": 3, "Sincan": 3, "Şereflikoçhisar": 3, "Yenimahalle": 3 }
    },
    "Antalya": {
        zone: 1,
        districts: { "Akseki": 1, "Aksu": 1, "Alanya": 1, "Demre": 1, "Döşemealtı": 1, "Elmalı": 1, "Finike": 1, "Gazipaşa": 1, "Gündoğmuş": 1, "İbradı": 1, "Kaş": 1, "Kemer": 1, "Kepez": 1, "Konyaaltı": 1, "Korkuteli": 3, "Kumluca": 1, "Manavgat": 1, "Muratpaşa": 1, "Serik": 1 }
    },
    "Ardahan": {
        zone: 4,
        districts: { "Çıldır": 4, "Damal": 4, "Göle": 4, "Hanak": 4, "Merkez": 4, "Posof": 4 }
    },
    "Artvin": {
        zone: 3,
        districts: { "Ardanuç": 3, "Arhavi": 2, "Borçka": 3, "Hopa": 2, "Kemalpaşa": 3, "Merkez": 3, "Murgul": 3, "Şavşat": 3, "Yusufeli": 3 }
    },
    "Aydın": {
        zone: 1,
        districts: { "Bozdoğan": 1, "Buharkent": 1, "Çine": 1, "Didim": 1, "Efeler": 1, "Germencik": 1, "İncirliova": 1, "Karacasu": 1, "Karpuzlu": 1, "Koçarlı": 1, "Köşk": 1, "Kuşadası": 1, "Kuyucak": 1, "Nazilli": 1, "Söke": 1, "Sultanhisar": 1, "Yenipazar": 1 }
    },
    "Balıkesir": {
        zone: 2,
        districts: { "Altıeylül": 2, "Ayvalık": 1, "Balya": 2, "Bandırma": 2, "Bigadiç": 2, "Burhaniye": 2, "Dursunbey": 3, "Edremit": 2, "Erdek": 2, "Gömeç": 2, "Gönen": 2, "Havran": 2, "İvrindi": 2, "Karesi": 2, "Kepsut": 2, "Manyas": 2, "Marmara": 2, "Savaştepe": 2, "Sındırgı": 2, "Susurluk": 2 }
    },
    "Bartın": {
        zone: 2,
        districts: { "Amasra": 2, "Kurucaşile": 2, "Merkez": 2, "Ulus": 3 }
    },
    "Batman": {
        zone: 2,
        districts: { "Beşiri": 2, "Gercüş": 2, "Hasankeyf": 2, "Kozluk": 2, "Merkez": 2, "Sason": 2 }
    },
    "Bayburt": {
        zone: 4,
        districts: { "Aydıntepe": 4, "Demirözü": 4, "Merkez": 4 }
    },
    "Bilecik": {
        zone: 3,
        districts: { "Bozüyük": 3, "Gölpazarı": 3, "İnhisar": 3, "Merkez": 3, "Osmaneli": 3, "Pazaryeri": 3, "Söğüt": 3, "Yenipazar": 3 }
    },
    "Bingöl": {
        zone: 3,
        districts: { "Adaklı": 3, "Genç": 3, "Karlıova": 3, "Kiğı": 4, "Merkez": 3, "Solhan": 4, "Yedisu": 3 }
    },
    "Bitlis": {
        zone: 4,
        districts: { "Adilcevaz": 4, "Ahlat": 4, "Güroymak": 4, "Hizan": 4, "Merkez": 4, "Mutki": 4, "Tatvan": 4 }
    },
    "Bolu": {
        zone: 3,
        districts: { "Dörtdivan": 3, "Gerede": 3, "Göynük": 3, "Kıbrıscık": 3, "Mengen": 3, "Merkez": 3, "Mudurnu": 3, "Seben": 3, "Yeniçağa": 3 }
    },
    "Burdur": {
        zone: 3,
        districts: { "Ağlasun": 3, "Altınyayla": 3, "Bucak": 3, "Çavdır": 3, "Çeltikçi": 3, "Gölhisar": 3, "Karamanlı": 3, "Kemer": 3, "Merkez": 3, "Tefenni": 3, "Yeşilova": 3 }
    },
    "Bursa": {
        zone: 2,
        districts: { "Büyükorhan": 2, "Gemlik": 2, "Gürsu": 2, "Harmancık": 2, "İnegöl": 2, "İznik": 2, "Karacabey": 2, "Keles": 4, "Kestel": 2, "Mudanya": 2, "Mustafakemalpaşa": 2, "Nilüfer": 2, "Orhaneli": 2, "Orhangazi": 2, "Osmangazi": 2, "Yenişehir": 2, "Yıldırım": 2 }
    },
    "Çanakkale": {
        zone: 2,
        districts: { "Ayvacık": 2, "Bayramiç": 2, "Biga": 2, "Bozcaada": 2, "Çan": 2, "Eceabat": 2, "Ezine": 2, "Gelibolu": 2, "Gökçeada": 2, "Lapseki": 2, "Merkez": 2, "Yenice": 2 }
    },
    "Çankırı": {
        zone: 3,
        districts: { "Atkaracalar": 3, "Bayramören": 3, "Çerkeş": 3, "Eldivan": 3, "Ilgaz": 3, "Kızılırmak": 3, "Korgun": 3, "Kurşunlu": 3, "Merkez": 3, "Orta": 3, "Şabanözü": 3, "Yapraklı": 3 }
    },
    "Çorum": {
        zone: 3,
        districts: { "Alaca": 3, "Bayat": 3, "Boğazkale": 3, "Dodurga": 3, "İskilip": 3, "Kargı": 3, "Laçin": 3, "Mecitözü": 3, "Merkez": 3, "Oğuzlar": 3, "Ortaköy": 3, "Osmancık": 3, "Sungurlu": 3, "Uğurludağ": 3 }
    },
    "Denizli": {
        zone: 2,
        districts: { "Acıpayam": 2, "Babadağ": 2, "Baklan": 2, "Bekilli": 2, "Beyağaç": 2, "Bozkurt": 2, "Buldan": 2, "Çal": 2, "Çameli": 2, "Çardak": 2, "Çivril": 2, "Güney": 2, "Honaz": 2, "Kale": 2, "Merkezefendi": 2, "Pamukkale": 2, "Sarayköy": 2, "Serinhisar": 2, "Tavas": 2 }
    },
    "Diyarbakır": {
        zone: 2,
        districts: { "Bağlar": 2, "Bismil": 2, "Çermik": 2, "Çınar": 2, "Çüngüş": 2, "Dicle": 2, "Eğil": 2, "Ergani": 2, "Hani": 2, "Hazro": 2, "Kayapınar": 2, "Kocaköy": 2, "Kulp": 2, "Lice": 2, "Silvan": 2, "Sur": 2, "Yenişehir": 2 }
    },
    "Düzce": {
        zone: 2,
        districts: { "Akçakoca": 2, "Çilimli": 2, "Cumayeri": 2, "Gölyaka": 2, "Gümüşova": 2, "Kaynaşlı": 2, "Merkez": 2, "Yığılca": 2 }
    },
    "Edirne": {
        zone: 2,
        districts: { "Enez": 2, "Havsa": 2, "İpsala": 2, "Keşan": 2, "Lalapaşa": 2, "Meriç": 2, "Merkez": 2, "Süloğlu": 2, "Uzunköprü": 2 }
    },
    "Elazığ": {
        zone: 3,
        districts: { "Ağın": 3, "Alacakaya": 3, "Arıcak": 3, "Baskil": 3, "Karakoçan": 3, "Keban": 3, "Kovancılar": 3, "Maden": 3, "Merkez": 3, "Palu": 3, "Sivrice": 3 }
    },
    "Erzincan": {
        zone: 4,
        districts: { "Çayırlı": 4, "İliç": 4, "Kemah": 4, "Kemaliye": 4, "Merkez": 4, "Otlukbeli": 4, "Refahiye": 4, "Tercan": 4, "Üzümlü": 4 }
    },
    "Erzurum": {
        zone: 4,
        districts: { "Aşkale": 4, "Aziziye": 4, "Çat": 4, "Hınıs": 4, "Horasan": 4, "İspir": 4, "Karaçoban": 4, "Karayazı": 4, "Köprüköy": 4, "Narman": 4, "Oltu": 4, "Olur": 4, "Palandöken": 4, "Pasinler": 4, "Pazaryolu": 4, "Şenkaya": 4, "Tekman": 4, "Tortum": 4, "Uzundere": 4, "Yakutiye": 4 }
    },
    "Eskişehir": {
        zone: 3,
        districts: { "Alpu": 3, "Beylikova": 3, "Çifteler": 3, "Günyüzü": 3, "Han": 3, "İnönü": 3, "Mahmudiye": 3, "Mihalgazi": 3, "Mihalıççık": 3, "Odunpazarı": 3, "Sarıcakaya": 3, "Seyitgazi": 3, "Sivrihisar": 3, "Tepebaşı": 3 }
    },
    "Gaziantep": {
        zone: 2,
        districts: { "Araban": 2, "İslahiye": 2, "Karkamış": 2, "Nizip": 2, "Nurdağı": 2, "Oğuzeli": 2, "Şahinbey": 2, "Şehitkamil": 2, "Yavuzeli": 2 }
    },
    "Giresun": {
        zone: 2,
        districts: { "Alucra": 2, "Bulancak": 2, "Çamoluk": 2, "Çanakçı": 2, "Dereli": 2, "Doğankent": 2, "Espiye": 2, "Eynesil": 2, "Görele": 2, "Güce": 2, "Keşap": 2, "Merkez": 2, "Piraziz": 2, "Şebinkarahisar": 4, "Tirebolu": 2, "Yağlıdere": 2 }
    },
    "Gümüşhane": {
        zone: 4,
        districts: { "Kelkit": 4, "Köse": 4, "Kürtün": 4, "Merkez": 4, "Şiran": 4, "Torul": 4 }
    },
    "Hakkari": {
        zone: 4,
        districts: { "Çukurca": 4, "Derecik": 4, "Merkez": 4, "Şemdinli": 4, "Yüksekova": 4 }
    },
    "Hatay": {
        zone: 1,
        districts: { "Altınözü": 1, "Antakya": 1, "Arsuz": 1, "Belen": 1, "Defne": 1, "Dörtyol": 1, "Erzin": 1, "Hassa": 1, "İskenderun": 1, "Kırıkhan": 1, "Kumlu": 1, "Payas": 1, "Reyhanlı": 1, "Samandağ": 1, "Yayladağı": 1 }
    },
    "Iğdır": {
        zone: 3,
        districts: { "Aralık": 3, "Karakoyunlu": 3, "Merkez": 3, "Tuzluca": 3 }
    },
    "Isparta": {
        zone: 3,
        districts: { "Aksu": 3, "Atabey": 3, "Eğirdir": 3, "Gelendost": 3, "Gönen": 3, "Keçiborlu": 3, "Merkez": 3, "Senirkent": 3, "Sütçüler": 3, "Şarkikaraağaç": 3, "Uluborlu": 3, "Yalvaç": 3, "Yenişarbademli": 3 }
    },
    "İstanbul": {
        zone: 2,
        districts: { "Adalar": 2, "Arnavutköy": 2, "Ataşehir": 2, "Avcılar": 2, "Bağcılar": 2, "Bahçelievler": 2, "Bakırköy": 2, "Başakşehir": 2, "Bayrampaşa": 2, "Beşiktaş": 2, "Beykoz": 2, "Beylikdüzü": 2, "Beyoğlu": 2, "Büyükççekmece": 2, "Çatalca": 2, "Çekmeköy": 2, "Esenler": 2, "Esenyurt": 2, "Eyüpsultan": 2, "Fatih": 2, "Gaziosmanpaşa": 2, "Güngören": 2, "Kadıköy": 2, "Kağıthane": 2, "Kartal": 2, "Küçükçekmece": 2, "Maltepe": 2, "Pendik": 2, "Sancaktepe": 2, "Sarıyer": 2, "Şile": 2, "Silivri": 2, "Şişli": 2, "Sultanbeyli": 2, "Sultangazi": 2, "Tuzla": 2, "Ümraniye": 2, "Üsküdar": 2, "Zeytinburnu": 2 }
    },
    "İzmir": {
        zone: 1,
        districts: { "Aliağa": 1, "Balçova": 1, "Bayındır": 1, "Bayraklı": 1, "Bergama": 1, "Beydağ": 1, "Bornova": 1, "Buca": 1, "Çeşme": 1, "Çiğli": 1, "Dikili": 1, "Foça": 1, "Gaziemir": 1, "Güzelbahçe": 1, "Karabağlar": 1, "Karaburun": 1, "Karşıyaka": 1, "Kemalpaşa": 1, "Kınık": 1, "Kiraz": 1, "Konak": 1, "Menderes": 1, "Menemen": 1, "Narlıdere": 1, "Ödemiş": 1, "Seferihisar": 1, "Selçuk": 1, "Tire": 1, "Torbalı": 1, "Urla": 1 }
    },
    "Kahramanmaraş": {
        zone: 2,
        districts: { "Afşin": 4, "Andırın": 2, "Çağlayancerit": 2, "Dulkadiroğlu": 2, "Ekinözü": 2, "Elbistan": 4, "Göksun": 4, "Nurhak": 2, "Onikişubat": 2, "Pazarcık": 2, "Türkoğlu": 2 }
    },
    "Karabük": {
        zone: 3,
        districts: { "Eflani": 3, "Eskipazar": 3, "Merkez": 3, "Ovacık": 3, "Safranbolu": 3, "Yenice": 3 }
    },
    "Karaman": {
        zone: 3,
        districts: { "Ayrancı": 3, "Başyayla": 3, "Ermenek": 3, "Kazımkarabekir": 3, "Merkez": 3, "Sarıveliler": 3 }
    },
    "Kars": {
        zone: 4,
        districts: { "Akyaka": 4, "Arpaçay": 4, "Digor": 4, "Kağızman": 4, "Merkez": 4, "Sarıkamış": 4, "Selim": 4, "Susuz": 4 }
    },
    "Kastamonu": {
        zone: 4,
        districts: { "Abana": 2, "Ağlı": 4, "Araç": 4, "Azdavay": 4, "Bozkurt": 2, "Cide": 2, "Çatalzeytin": 2, "Daday": 4, "Devrekani": 4, "Doğanyurt": 2, "Hanönü": 4, "İhsangazi": 4, "İnebolu": 2, "Küre": 4, "Merkez": 4, "Pınarbaşı": 4, "Şenpazar": 4, "Seydiler": 4, "Taşköprü": 4, "Tosya": 3 }
    },
    "Kayseri": {
        zone: 4,
        districts: { "Akkışla": 4, "Bünyan": 4, "Develi": 4, "Felahiye": 4, "Hacılar": 4, "İncesu": 4, "Kocasinan": 4, "Melikgazi": 4, "Özvatan": 4, "Pınarbaşı": 4, "Sarıoğlan": 4, "Sarız": 4, "Talas": 4, "Tomarza": 4, "Yahyalı": 4, "Yeşilhisar": 4 }
    },
    "Kilis": {
        zone: 2,
        districts: { "Elbeyli": 2, "Merkez": 2, "Musabeyli": 2, "Polateli": 2 }
    },
    "Kırıkkale": {
        zone: 3,
        districts: { "Bahşılı": 3, "Balışeyh": 3, "Çelebi": 3, "Delice": 3, "Karakeçili": 3, "Keskin": 3, "Merkez": 3, "Sulakyurt": 3, "Yahşihan": 3 }
    },
    "Kırklareli": {
        zone: 3,
        districts: { "Babaeski": 3, "Demirköy": 3, "Kofçaz": 3, "Lüleburgaz": 3, "Merkez": 3, "Pehlivanköy": 3, "Pınarhisar": 3, "Vize": 3 }
    },
    "Kırşehir": {
        zone: 3,
        districts: { "Akçakent": 3, "Akpınar": 3, "Boztepe": 3, "Çiçekdağı": 3, "Kaman": 3, "Merkez": 3, "Mucur": 3 }
    },
    "Kocaeli": {
        zone: 2,
        districts: { "Başiskele": 2, "Çayırova": 2, "Darıca": 2, "Derince": 2, "Dilovası": 2, "Gebze": 2, "Gölcük": 2, "İzmit": 2, "Kandıra": 2, "Karamürsel": 2, "Kartepe": 2, "Körfez": 2 }
    },
    "Konya": {
        zone: 3,
        districts: { "Ahırlı": 3, "Akören": 3, "Akşehir": 3, "Altınekin": 3, "Beyşehir": 3, "Bozkır": 3, "Cihanbeyli": 3, "Çeltik": 3, "Çumra": 3, "Derbent": 3, "Derebucak": 3, "Doğanhisar": 3, "Emirgazi": 3, "Ereğli": 3, "Güneysınır": 3, "Hadim": 3, "Halkapınar": 3, "Hüyük": 3, "Ilgın": 3, "Kadınhanı": 3, "Karapınar": 3, "Karatay": 3, "Kulu": 3, "Meram": 3, "Sarayönü": 3, "Selçuklu": 3, "Seydişehir": 3, "Taşkent": 3, "Tuzlukçu": 3, "Yalıhüyük": 3, "Yunak": 3 }
    },
    "Kütahya": {
        zone: 3,
        districts: { "Altıntaş": 3, "Aslanapa": 3, "Çavdarhisar": 3, "Domaniç": 3, "Dumlupınar": 3, "Emet": 3, "Gediz": 3, "Hisarcık": 3, "Merkez": 3, "Pazarlar": 3, "Şaphane": 3, "Simav": 3, "Tavşanlı": 3 }
    },
    "Malatya": {
        zone: 3,
        districts: { "Akçadağ": 3, "Arapgir": 3, "Arguvan": 3, "Battalgazi": 3, "Darende": 3, "Doğanyol": 3, "Doğanşehir": 3, "Hekimhan": 3, "Kale": 3, "Kuluncak": 3, "Pütürge": 3, "Yazıhan": 3, "Yeşilyurt": 3 }
    },
    "Manisa": {
        zone: 2,
        districts: { "Ahmetli": 2, "Akhisar": 2, "Alaşehir": 2, "Demirci": 2, "Gölmarmara": 2, "Gördes": 2, "Kırkağaç": 2, "Köprübaşı": 2, "Kula": 2, "Salihli": 2, "Sarigöl": 2, "Saruhanlı": 2, "Şehzadeler": 2, "Selendi": 2, "Soma": 2, "Turgutlu": 2, "Yunusemre": 2 }
    },
    "Mardin": {
        zone: 2,
        districts: { "Artuklu": 2, "Dargeçit": 2, "Derik": 2, "Kızıltepe": 2, "Mazıdağı": 2, "Midyat": 2, "Nusaybin": 2, "Ömerli": 2, "Savur": 2, "Yeşilli": 2 }
    },
    "Mersin": {
        zone: 1,
        districts: { "Akdeniz": 1, "Anamur": 1, "Aydıncık": 1, "Bozyazı": 1, "Çamlıyayla": 1, "Erdemli": 1, "Gülnar": 1, "Mezitli": 1, "Mut": 1, "Silifke": 1, "Tarsus": 1, "Toroslar": 1, "Yenişehir": 1 }
    },
    "Muğla": {
        zone: 1,
        districts: { "Bodrum": 1, "Dalaman": 1, "Datça": 1, "Fethiye": 1, "Kavaklıdere": 2, "Köyceğiz": 1, "Marmaris": 1, "Menteşe": 2, "Milas": 1, "Ortaca": 2, "Seydikemer": 2, "Ula": 2, "Yatağan": 2 }
    },
    "Muş": {
        zone: 4,
        districts: { "Bulanık": 4, "Hasköy": 4, "Korkut": 4, "Malazgirt": 4, "Merkez": 4, "Varto": 4 }
    },
    "Nevşehir": {
        zone: 3,
        districts: { "Acıgöl": 3, "Avanos": 3, "Derinkuyu": 3, "Gülşehir": 3, "Hacıbektaş": 3, "Kozaklı": 3, "Merkez": 3, "Ürgüp": 3 }
    },
    "Niğde": {
        zone: 3,
        districts: { "Altunhisar": 3, "Bor": 3, "Çamardı": 3, "Çiftlik": 3, "Merkez": 3, "Ulukışla": 3 }
    },
    "Ordu": {
        zone: 2,
        districts: { "Akkuş": 2, "Altınordu": 2, "Aybastı": 2, "Çamaş": 2, "Çaybaşı": 2, "Çatalpınar": 2, "Fatsa": 2, "Gölköy": 2, "Gülyalı": 2, "Gürgentepe": 2, "İkizce": 2, "Kabadüz": 2, "Kabataş": 2, "Korgan": 2, "Kumru": 2, "Mesudiye": 4, "Perşembe": 2, "Ulubey": 2, "Ünye": 2 }
    },
    "Osmaniye": {
        zone: 1,
        districts: { "Bahçe": 1, "Düziçi": 1, "Hasanbeyli": 1, "Kadirli": 1, "Merkez": 1, "Sumbas": 1, "Toprakkale": 1 }
    },
    "Rize": {
        zone: 2,
        districts: { "Ardeşen": 2, "Çamlıhemşin": 2, "Çayeli": 2, "Derepazarı": 2, "Fındıklı": 2, "Güneysu": 2, "Hemşin": 2, "İkizdere": 2, "İyidere": 2, "Kalkandere": 2, "Merkez": 2, "Pazar": 2 }
    },
    "Sakarya": {
        zone: 2,
        districts: { "Adapazarı": 2, "Akyazı": 2, "Arifiye": 2, "Erenler": 2, "Ferizli": 2, "Geyve": 2, "Hendek": 2, "Karapürçek": 2, "Karasu": 2, "Kaynarca": 2, "Kocaali": 2, "Pamukova": 2, "Sapanca": 2, "Serdivan": 2, "Söğütlü": 2, "Taraklı": 2 }
    },
    "Samsun": {
        zone: 2,
        districts: { "19": 2, "Alaçam": 2, "Asarcık": 2, "Atakum": 2, "Ayvacık": 2, "Bafra": 2, "Canik": 2, "Çarşamba": 2, "Havza": 2, "İlkadım": 2, "Kavak": 2, "Ladik": 2, "Salıpazarı": 2, "Tekkeköy": 2, "Terme": 2, "Vezirköprü": 2, "Yakakent": 2 }
    },
    "Siirt": {
        zone: 2,
        districts: { "Baykan": 2, "Eruh": 2, "Kurtalan": 2, "Merkez": 2, "Pervari": 2, "Şirvan": 2, "Tillo": 2 }
    },
    "Sinop": {
        zone: 2,
        districts: { "Ayancık": 2, "Boyabat": 2, "Dikmen": 2, "Durağan": 2, "Erfelek": 2, "Gerze": 2, "Merkez": 2, "Saraydüzü": 2, "Türkeli": 2 }
    },
    "Sivas": {
        zone: 4,
        districts: { "Akıncılar": 4, "Altınyayla": 4, "Divriği": 4, "Doğanşar": 4, "Gemerek": 4, "Gölova": 4, "Hafik": 4, "İmranlı": 4, "Kangal": 4, "Koyulhisar": 4, "Merkez": 4, "Şarkışla": 4, "Suşehri": 4, "Ulaş": 4, "Yıldızeli": 4, "Zara": 4 }
    },
    "Şanlıurfa": {
        zone: 2,
        districts: { "Akçakale": 2, "Birecik": 2, "Bozova": 2, "Ceylanpınar": 2, "Eyyübiye": 2, "Halfeti": 2, "Haliliye": 2, "Harran": 2, "Hilvan": 2, "Karaköprü": 2, "Siverek": 2, "Suruç": 2, "Viranşehir": 2 }
    },
    "Şırnak": {
        zone: 2,
        districts: { "Beytüşşebap": 2, "Cizre": 2, "Güçlükonak": 2, "İdil": 2, "Merkez": 2, "Silopi": 2, "Uludere": 2 }
    },
    "Tekirdağ": {
        zone: 2,
        districts: { "Çerkezköy": 2, "Çorlu": 2, "Ergene": 2, "Hayrabolu": 2, "Kapaklı": 2, "Malkara": 2, "Marmaraereğlisi": 2, "Muratlı": 2, "Saray": 2, "Şarköy": 2, "Süleymanpaşa": 2 }
    },
    "Tokat": {
        zone: 3,
        districts: { "Almus": 3, "Artova": 3, "Başçiftlik": 3, "Erbaa": 3, "Merkez": 3, "Niksar": 3, "Pazar": 3, "Reşadiye": 3, "Sulusaray": 3, "Turhal": 3, "Yeşilyurt": 3, "Zile": 3 }
    },
    "Trabzon": {
        zone: 2,
        districts: { "Akçaabat": 2, "Araklı": 2, "Arsin": 2, "Beşikdüzü": 2, "Çarşıbaşı": 2, "Çaykara": 2, "Dernekpazarı": 2, "Düzköy": 2, "Hayrat": 2, "Köprübaşı": 2, "Maçka": 2, "Of": 2, "Ortahisar": 2, "Sürmene": 2, "Şalpazarı": 2, "Tonya": 2, "Vakfıkebir": 2, "Yomra": 2 }
    },
    "Tunceli": {
        zone: 3,
        districts: { "Çemişgezek": 3, "Hozat": 3, "Mazgirt": 3, "Merkez": 3, "Nazımiye": 3, "Ovacık": 3, "Pertek": 3, "Pülümür": 4 }
    },
    "Uşak": {
        zone: 3,
        districts: { "Banaz": 3, "Eşme": 3, "Karahallı": 3, "Merkez": 3, "Sivaslı": 3, "Ulubey": 3 }
    },
    "Van": {
        zone: 4,
        districts: { "Bahçesaray": 4, "Başkale": 4, "Çaldıran": 4, "Çatak": 4, "Edremit": 4, "Erciş": 4, "Gevaş": 4, "Gürpınar": 4, "İpekyolu": 4, "Muradiye": 4, "Özalp": 4, "Saray": 4, "Tuşba": 4 }
    },
    "Yalova": {
        zone: 2,
        districts: { "Altınova": 2, "Armutlu": 2, "Çınarcık": 2, "Çiftlikköy": 2, "Merkez": 2, "Termal": 2 }
    },
    "Yozgat": {
        zone: 4,
        districts: { "Akdağmadeni": 4, "Aydıncık": 4, "Boğazlıyan": 4, "Çandır": 4, "Çayıralan": 4, "Çekerek": 4, "Kadişehri": 4, "Merkez": 4, "Sarıkaya": 4, "Saraykent": 4, "Şefaatli": 4, "Sorgun": 4, "Yenifakılı": 4, "Yerköy": 4 }
    },
    "Zonguldak": {
        zone: 2,
        districts: { "Alaplı": 2, "Çaycuma": 2, "Devrek": 2, "Ereğli": 2, "Gökçebey": 2, "Kilimli": 2, "Kozlu": 2, "Merkez": 2 }
    }
};

export const DEFAULT_PRICES: Record<string, number> = {
    // 04.03.2026 Güncellendi
    // --- TEMEL KABA VE İNCE İNŞAAT ---
    "Hafriyat (Kazı ve Döküm)": 765,           // hafriyatpaket
    "Betonarme Betonu": 3840,                // betonmal
    "İnşaat Demiri": 30700,                  // demirmal
    "Kalıp İşçiliği & Malzeme": 1417.5,      // kalipdemirbetonisc
    "Temel Su Yalıtımı (Bohçalama)": 338.6,  // membranmalisc
    "Seramik Kaplama": 1373.8,               // seramikmalisc
    "Seramik Yapıştırıcısı": 8.7,            // seramikyapistiricimal
    "Seramik Derz Dolgusu": 35.8,            // seramikderzmal
    "Gazbeton Blok (m3)": 3580,              // gazbetonmalm3mal
    "Tuğla Blok (m3)": 2813,                 // tuglamalm3mal
    "Bims Blok (m3)": 3836,                  // bimsmalm3mal
    "Gazbeton İşçiliği (m2)": 283.5,         // gazbetonisc
    "Tuğla İşçiliği (m2)": 337.5,            // tuglaisc
    "Bims İşçiliği (m2)": 272.6,             // bimsisc

    // --- ZEMİN ETÜDÜ & HARİTA ---
    "Zemin Sondaj Birim Fiyatı": 2970,       // zeminsondajmtpaket
    "SPT Deneyi Birim Fiyatı": 2180,         // sptdeneyiadetpaket
    "Presiyometre Deneyi Birim Fiyatı": 3010,// presiyometredeneyiadetpaket
    "Zemin Laboratuvar Paketi": 17718.76,    // zeminlaboratuvarpaket

    // --- RESMİ İŞLEMLER, HARÇLAR & ABONELİKLER ---
    "Yapı Sınıfı 3A": 19800,                 // yapi3asinifipaket
    "Enerji Kimlik Belgesi": 2025,     // enerjikimlikisc
    "Elektrik Güvence Birim Bedeli": 737,    // elektrikabonelikkwpaket
    "Su Abonelik Paket Bedeli": 1575,        // suabonelikisc
    "Tapu Döner Sermaye": 2577.3,            // tapudonersermayeisc
    "Noter Yazı Ücreti": 4725,               // noteryaziisc
    "Standart Sözleşme Harcı": 7087.5,       // standartsozlesmeharciisc

    // --- TESİSAT, DOĞALGAZ & YANGIN ---
    "Doğalgaz Kolon Hattı (mt) Birim": 1984.2,     // dogalgazkolonhattimtmalisc
    "Doğalgaz Daire Başı Set Birim": 3664.4,       // dogalgazdairebasisetadetmalisc
    "Yangın Kapısı (Adet)": 18000,           // Wix listesinde bulunamadı, mevcut değer korundu

    // --- ŞANTİYE GENEL GİDERLERİ ---
    "Şantiye Personel Giderleri (Bekçi vb.)": 70875, // santiyepersonelisc
    "Şantiye Şefi (Aylık)": 147656.3,         // santiyesefiisc

    "Çimento (kg)": 4.6,                     // cimentomal
    "Kum (m3)": 1023,                        // kummal
    "Gazbeton Yapıştırıcısı": 5,             // ytongyapistiricimal
    "İnşaat Çivisi (kg)": 45,                // Mevcut değer korundu
    "Kalıp Yağı (Litre)": 51.1,               // kalipyagiltmal
    "Kereste (m3)": 9205,                    // kerestem3mal
    "Bağ Teli (kg)": 55,                     // Mevcut değer korundu
    "Sıva Alçısı (Torba)": 140,              // Mevcut değer korundu
    "Saten Alçı (Torba)": 160,               // Mevcut değer korundu
    "Astar Boya (Kova)": 950,                // Mevcut değer korundu
    "İç Cephe Boyası (Kova)": 2100,          // Mevcut değer korundu
};

// src/constants.ts dosyasının en altına ekleyin:
export const PROVINCE_EARTHQUAKE_ZONES: Record<string, number> = {
    "Adana": 2, "Adıyaman": 1, "Afyonkarahisar": 1, "Ağrı": 2, "Aksaray": 4, "Amasya": 1,
    "Ankara": 4, "Antalya": 2, "Ardahan": 2, "Artvin": 3, "Aydın": 1, "Balıkesir": 1,
    "Bilecik": 2, "Bingöl": 1, "Bitlis": 2, "Bolu": 1, "Burdur": 1, "Bursa": 1, "Çanakkale": 1,
    "Çankırı": 1, "Çorum": 2, "Denizli": 1, "Diyarbakır": 2, "Edirne": 4, "Elazığ": 2,
    "Erzincan": 1, "Erzurum": 2, "Eskişehir": 2, "Gaziantep": 3, "Giresun": 3, "Gümüşhane": 3,
    "Hakkari": 1, "Hatay": 1, "Isparta": 1, "Mersin": 3, "İstanbul": 1, "İzmir": 1,
    "Kars": 2, "Kastamonu": 1, "Kayseri": 3, "Kırklareli": 4, "Kırşehir": 1, "Kocaeli": 1,
    "Konya": 4, "Kütahya": 2, "Malatya": 2, "Manisa": 1, "Kahramanmaraş": 1, "Mardin": 3,
    "Muğla": 1, "Muş": 1, "Nevşehir": 4, "Niğde": 4, "Ordu": 3, "Rize": 4, "Sakarya": 1,
    "Samsun": 2, "Siirt": 1, "Sinop": 4, "Sivas": 3, "Tekirdağ": 2, "Tokat": 1, "Trabzon": 4,
    "Tunceli": 1, "Şanlıurfa": 3, "Uşak": 1, "Van": 1, "Yozgat": 3, "Zonguldak": 2,
    "Bayburt": 3, "Karaman": 4, "Kırıkkale": 1, "Batman": 2, "Şırnak": 1, "Bartın": 1,
    "Iğdır": 2, "Yalova": 1, "Karabük": 1, "Kilis": 3, "Osmaniye": 1, "Düzce": 1
};