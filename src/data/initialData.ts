import { Quarry, ClientFactory, DailyOrder, FleetTruck, TripLoad, AppNotification } from '../types/fleet';

// تم استيراد وتحديث البيانات مباشرة من ملف Google Drive (Titles 1.xlsx) الخاص بالمنظومة
export const INITIAL_QUARRIES: Quarry[] = [
  {
    "id": "quarry-1",
    "name": "محجر الاخوه العرب",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.8,
      "lng": 32.2
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.8,32.2",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر الاخوه العرب",
    "contactPhone": "01010000000",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-2",
    "name": "محجر الفيروز",
    "region": "جنوب سيناء - طريق دهب",
    "location": {
      "lat": 29.85,
      "lng": 32.26
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.85,32.26",
    "materialsAvailable": [
      "سن دولوميت",
      "دبش مباني"
    ],
    "contactName": "مسؤول محجر الفيروز",
    "contactPhone": "01010111111",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-3",
    "name": "محجر الجزار",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.9,
      "lng": 32.32
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.32",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر الجزار",
    "contactPhone": "01010222222",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-4",
    "name": "محجر الحاج سلمى",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.95,
      "lng": 32.38
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.95,32.38",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر الحاج سلمى",
    "contactPhone": "01010333333",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-5",
    "name": "كسارة بن لادن",
    "region": "جبل عتاقة - قطاع الكسارات",
    "location": {
      "lat": 30.0,
      "lng": 32.44
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.0,32.44",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن بودرة",
      "سن فيلر"
    ],
    "contactName": "مسؤول كسارة بن لادن",
    "contactPhone": "01010444444",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-6",
    "name": "محجر رمل ردم",
    "region": "الإسماعيلية - طريق السويس الصحراوي",
    "location": {
      "lat": 30.05,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.05,32.5",
    "materialsAvailable": [
      "رمل أصفر",
      "رمل ردم",
      "رمل مباني"
    ],
    "contactName": "مسؤول محجر رمل ردم",
    "contactPhone": "01010555555",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-7",
    "name": "علي حسابه",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 30.1,
      "lng": 32.2
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.2",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول علي حسابه",
    "contactPhone": "01010666666",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-8",
    "name": "محجر ابو بكر محمدين",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 30.15,
      "lng": 32.26
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.15,32.26",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر ابو بكر محمدين",
    "contactPhone": "01010777777",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-9",
    "name": "محجر اسكوم",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.8,
      "lng": 32.32
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.8,32.32",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر اسكوم",
    "contactPhone": "01010888888",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-10",
    "name": "كسارة المصريه",
    "region": "جبل عتاقة - قطاع الكسارات",
    "location": {
      "lat": 29.85,
      "lng": 32.38
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.85,32.38",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن بودرة",
      "سن فيلر"
    ],
    "contactName": "مسؤول كسارة المصريه",
    "contactPhone": "01010999999",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-11",
    "name": "ابراهيم عبيد ديش محجر الجزار",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.9,
      "lng": 32.44
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.44",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول ابراهيم عبيد ديش محجر الجزار",
    "contactPhone": "01011111110",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-12",
    "name": "ايكوبات ايكو سيرفيس",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.95,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.95,32.5",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول ايكوبات ايكو سيرفيس",
    "contactPhone": "01011222221",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-13",
    "name": "محجر سعد بدير",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 30.0,
      "lng": 32.2
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.0,32.2",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر سعد بدير",
    "contactPhone": "01011333332",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-14",
    "name": "جميل عياد",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 30.05,
      "lng": 32.26
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.05,32.26",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول جميل عياد",
    "contactPhone": "01011444443",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-15",
    "name": "محجر دهب",
    "region": "جنوب سيناء - طريق دهب",
    "location": {
      "lat": 30.1,
      "lng": 32.32
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.32",
    "materialsAvailable": [
      "سن دولوميت",
      "دبش مباني"
    ],
    "contactName": "مسؤول محجر دهب",
    "contactPhone": "01011555554",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-16",
    "name": "محمد الجلب محجر معادن مصر",
    "region": "العين السخنة - قطاع الخامات",
    "location": {
      "lat": 30.15,
      "lng": 32.38
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.15,32.38",
    "materialsAvailable": [
      "حجر جيري",
      "دبش تكاسي",
      "سن 2"
    ],
    "contactName": "مسؤول محمد الجلب محجر معادن مصر",
    "contactPhone": "01011666665",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-17",
    "name": "مصنع دهب",
    "region": "جنوب سيناء - طريق دهب",
    "location": {
      "lat": 29.8,
      "lng": 32.44
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.8,32.44",
    "materialsAvailable": [
      "سن دولوميت",
      "دبش مباني"
    ],
    "contactName": "مسؤول مصنع دهب",
    "contactPhone": "01011777776",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-18",
    "name": "محجر المصطفى",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.85,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.85,32.5",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر المصطفى",
    "contactPhone": "01011888887",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-19",
    "name": "محجر الفسطاط",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.9,
      "lng": 32.2
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.2",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر الفسطاط",
    "contactPhone": "01011999998",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-20",
    "name": "محجر الرغدان",
    "region": "السويس - طريق عتاقة والسخنة",
    "location": {
      "lat": 29.95,
      "lng": 32.26
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.95,32.26",
    "materialsAvailable": [
      "سن 1",
      "سن 2",
      "سن فيلر"
    ],
    "contactName": "مسؤول محجر الرغدان",
    "contactPhone": "01012111109",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-21",
    "name": "محجر العالميه جبس",
    "region": "سيناء - طريق رأس سدر",
    "location": {
      "lat": 30.0,
      "lng": 32.32
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.0,32.32",
    "materialsAvailable": [
      "جبس خام",
      "بودرة جبس"
    ],
    "contactName": "مسؤول محجر العالميه جبس",
    "contactPhone": "01012222220",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  },
  {
    "id": "quarry-22",
    "name": "محجر معادن مصر خالد حماد",
    "region": "العين السخنة - قطاع الخامات",
    "location": {
      "lat": 30.05,
      "lng": 32.38
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.05,32.38",
    "materialsAvailable": [
      "حجر جيري",
      "دبش تكاسي",
      "سن 2"
    ],
    "contactName": "مسؤول محجر معادن مصر خالد حماد",
    "contactPhone": "01012333331",
    "gateNotes": "التحميل ببون الميزان الرسمي، مراجعة بوابات الخروج."
  }
];

export const INITIAL_CLIENTS: ClientFactory[] = [
  {
    "id": "client-1",
    "name": "الدوليه لمواد البناء",
    "clientName": "الدوليه لمواد البناء",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.3",
    "contactName": "إدارة استلام الدوليه لمواد ا",
    "contactPhone": "01120000000",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-2",
    "name": "السادات لمواد البناء",
    "clientName": "السادات لمواد البناء",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.35",
    "contactName": "إدارة استلام السادات لمواد ا",
    "contactPhone": "01120222222",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-3",
    "name": "الجوهره لمواد البناء",
    "clientName": "الجوهره لمواد البناء",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.4",
    "contactName": "إدارة استلام الجوهره لمواد ا",
    "contactPhone": "01120444444",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-4",
    "name": "المدينه لمواد البناء",
    "clientName": "المدينه لمواد البناء",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.45",
    "contactName": "إدارة استلام المدينه لمواد ا",
    "contactPhone": "01120666666",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-5",
    "name": "عتاقه لمواد البناء",
    "clientName": "عتاقه لمواد البناء",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.5",
    "contactName": "إدارة استلام عتاقه لمواد الب",
    "contactPhone": "01120888888",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-6",
    "name": "الاتحاد العربى لمواد البناء",
    "clientName": "الاتحاد العربى لمواد البناء",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.1,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.55",
    "contactName": "إدارة استلام الاتحاد العربى ",
    "contactPhone": "01121111110",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-7",
    "name": "شركة حسن علام",
    "clientName": "شركة حسن علام",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.6",
    "contactName": "إدارة استلام شركة حسن علام",
    "contactPhone": "01121333332",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-8",
    "name": "مصنع جبس نور سيناء",
    "clientName": "مصنع جبس نور سيناء",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.65",
    "contactName": "إدارة استلام مصنع جبس نور سي",
    "contactPhone": "01121555554",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-9",
    "name": "مصنع نجوم سيناء",
    "clientName": "مصنع نجوم سيناء",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.3",
    "contactName": "إدارة استلام مصنع نجوم سيناء",
    "contactPhone": "01121777776",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-10",
    "name": "خلاطة الحكيم",
    "clientName": "خلاطة الحكيم",
    "industrialZone": "محطة خرسانة جاهزة - قطاع المشروعات",
    "location": {
      "lat": 30.26,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.35",
    "contactName": "إدارة استلام خلاطة الحكيم",
    "contactPhone": "01121999998",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-11",
    "name": "خلاطة عروس النيل",
    "clientName": "خلاطة عروس النيل",
    "industrialZone": "محطة خرسانة جاهزة - قطاع المشروعات",
    "location": {
      "lat": 29.9,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.4",
    "contactName": "إدارة استلام خلاطة عروس الني",
    "contactPhone": "01122222220",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-12",
    "name": "المهندس معتز",
    "clientName": "المهندس معتز",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.45",
    "contactName": "إدارة استلام المهندس معتز",
    "contactPhone": "01122444442",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-13",
    "name": "خلاطه العالميه",
    "clientName": "خلاطه العالميه",
    "industrialZone": "محطة خرسانة جاهزة - قطاع المشروعات",
    "location": {
      "lat": 29.98,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.5",
    "contactName": "إدارة استلام خلاطه العالميه",
    "contactPhone": "01122666664",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-14",
    "name": "شركة اسكوم",
    "clientName": "شركة اسكوم",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.55",
    "contactName": "إدارة استلام شركة اسكوم",
    "contactPhone": "01122888886",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-15",
    "name": "سن ( خلاطة شرق التفريعه ( حسن علام",
    "clientName": "سن ( خلاطة شرق التفريعه ( حسن علام",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 30.06,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.6",
    "contactName": "إدارة استلام سن ( خلاطة شرق ",
    "contactPhone": "01123111108",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-16",
    "name": "موانى شرق التفريعه ممدوح فرج",
    "clientName": "موانى شرق التفريعه ممدوح فرج",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 30.1,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.65",
    "contactName": "إدارة استلام موانى شرق التفر",
    "contactPhone": "01123333330",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-17",
    "name": "محجر العلامة",
    "clientName": "محجر العلامة",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.3",
    "contactName": "إدارة استلام محجر العلامة",
    "contactPhone": "01123555552",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-18",
    "name": "خلاطة عثمان (حسين جابر( شركه الاخلاص",
    "clientName": "خلاطة عثمان (حسين جابر( شركه الاخلاص",
    "industrialZone": "محطة خرسانة جاهزة - قطاع المشروعات",
    "location": {
      "lat": 30.18,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.35",
    "contactName": "إدارة استلام خلاطة عثمان (حس",
    "contactPhone": "01123777774",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-19",
    "name": "خلاطة حسن علام شرق التفريعه رمل",
    "clientName": "خلاطة حسن علام شرق التفريعه رمل",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 30.22,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.4",
    "contactName": "إدارة استلام خلاطة حسن علام ",
    "contactPhone": "01123999996",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-20",
    "name": "مصنع طوب العالميه",
    "clientName": "مصنع طوب العالميه",
    "industrialZone": "منطقة مصانع الطوب - عرب أبو ساعد",
    "location": {
      "lat": 30.26,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.45",
    "contactName": "إدارة استلام مصنع طوب العالم",
    "contactPhone": "01124222218",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-21",
    "name": "خلاطة مختار ابراهيم",
    "clientName": "خلاطة مختار ابراهيم",
    "industrialZone": "محطة خرسانة جاهزة - قطاع المشروعات",
    "location": {
      "lat": 29.9,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.5",
    "contactName": "إدارة استلام خلاطة مختار ابر",
    "contactPhone": "01124444440",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-22",
    "name": "موسى الدلح",
    "clientName": "موسى الدلح",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.55",
    "contactName": "إدارة استلام موسى الدلح",
    "contactPhone": "01124666662",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-23",
    "name": "الفيروز",
    "clientName": "الفيروز",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.6",
    "contactName": "إدارة استلام الفيروز",
    "contactPhone": "01124888884",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-24",
    "name": "مصنع طوب مختار ابراهيم",
    "clientName": "مصنع طوب مختار ابراهيم",
    "industrialZone": "منطقة مصانع الطوب - عرب أبو ساعد",
    "location": {
      "lat": 30.02,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.65",
    "contactName": "إدارة استلام مصنع طوب مختار ",
    "contactPhone": "01125111106",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-25",
    "name": "رمل جديد 2 / ابو عاطف",
    "clientName": "رمل جديد 2 / ابو عاطف",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.3",
    "contactName": "إدارة استلام رمل جديد 2 / اب",
    "contactPhone": "01125333328",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-26",
    "name": "جبس العاصمه",
    "clientName": "جبس العاصمه",
    "industrialZone": "العاصمة الإدارية الجديدة",
    "location": {
      "lat": 30.1,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.35",
    "contactName": "إدارة استلام جبس العاصمه",
    "contactPhone": "01125555550",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-27",
    "name": "شعبان محمد بركات",
    "clientName": "شعبان محمد بركات",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.4",
    "contactName": "إدارة استلام شعبان محمد بركا",
    "contactPhone": "01125777772",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-28",
    "name": "زراعى محمد عبده",
    "clientName": "زراعى محمد عبده",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.45",
    "contactName": "إدارة استلام زراعى محمد عبده",
    "contactPhone": "01125999994",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-29",
    "name": "بودرة العنود شرق التفريعه",
    "clientName": "بودرة العنود شرق التفريعه",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 30.22,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.5",
    "contactName": "إدارة استلام بودرة العنود شر",
    "contactPhone": "01126222216",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-30",
    "name": "اكواباك الفيروز",
    "clientName": "اكواباك الفيروز",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.26,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.55",
    "contactName": "إدارة استلام اكواباك الفيروز",
    "contactPhone": "01126444438",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-31",
    "name": "اكواباك العلامه",
    "clientName": "اكواباك العلامه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.6",
    "contactName": "إدارة استلام اكواباك العلامه",
    "contactPhone": "01126666660",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-32",
    "name": "حسن الجرينى رمل راس سدر",
    "clientName": "حسن الجرينى رمل راس سدر",
    "industrialZone": "جنوب سيناء - رأس سدر",
    "location": {
      "lat": 29.94,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.65",
    "contactName": "إدارة استلام حسن الجرينى رمل",
    "contactPhone": "01126888882",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-33",
    "name": "ابراهيم سن موسى كوست",
    "clientName": "ابراهيم سن موسى كوست",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.3",
    "contactName": "إدارة استلام ابراهيم سن موسى",
    "contactPhone": "01127111104",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-34",
    "name": "هندى",
    "clientName": "هندى",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.35",
    "contactName": "إدارة استلام هندى",
    "contactPhone": "01127333326",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-35",
    "name": "سن حسن علام شرق التفريعه جديد",
    "clientName": "سن حسن علام شرق التفريعه جديد",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 30.06,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.4",
    "contactName": "إدارة استلام سن حسن علام شرق",
    "contactPhone": "01127555548",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-36",
    "name": "رمل حسن علام شرق التفريعه جديد",
    "clientName": "رمل حسن علام شرق التفريعه جديد",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 30.1,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.45",
    "contactName": "إدارة استلام رمل حسن علام شر",
    "contactPhone": "01127777770",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-37",
    "name": "علاء مهدي",
    "clientName": "علاء مهدي",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.5",
    "contactName": "إدارة استلام علاء مهدي",
    "contactPhone": "01127999992",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-38",
    "name": "كناوف طيبه",
    "clientName": "كناوف طيبه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.55",
    "contactName": "إدارة استلام كناوف طيبه",
    "contactPhone": "01128222214",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-39",
    "name": "محمد صبرى شرق التفريعه",
    "clientName": "محمد صبرى شرق التفريعه",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 30.22,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.6",
    "contactName": "إدارة استلام محمد صبرى شرق ا",
    "contactPhone": "01128444436",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-40",
    "name": "رمل محمد موسى الدلح",
    "clientName": "رمل محمد موسى الدلح",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.26,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.65",
    "contactName": "إدارة استلام رمل محمد موسى ا",
    "contactPhone": "01128666658",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-41",
    "name": "شركة 15 مايو",
    "clientName": "شركة 15 مايو",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.3",
    "contactName": "إدارة استلام شركة 15 مايو",
    "contactPhone": "01128888880",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-42",
    "name": "رضا البدراوى",
    "clientName": "رضا البدراوى",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.35",
    "contactName": "إدارة استلام رضا البدراوى",
    "contactPhone": "01129111102",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-43",
    "name": "هانى فوزى المعديه",
    "clientName": "هانى فوزى المعديه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.4",
    "contactName": "إدارة استلام هانى فوزى المعد",
    "contactPhone": "01129333324",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-44",
    "name": "خلاطه اى جى ار",
    "clientName": "خلاطه اى جى ار",
    "industrialZone": "محطة خرسانة جاهزة - قطاع المشروعات",
    "location": {
      "lat": 30.02,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.45",
    "contactName": "إدارة استلام خلاطه اى جى ار",
    "contactPhone": "01129555546",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-45",
    "name": "ايكوبات اسكوم",
    "clientName": "ايكوبات اسكوم",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.5",
    "contactName": "إدارة استلام ايكوبات اسكوم",
    "contactPhone": "01129777768",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-46",
    "name": "محمود هلالى سن 6 عثمان شرق",
    "clientName": "محمود هلالى سن 6 عثمان شرق",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.1,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.55",
    "contactName": "إدارة استلام محمود هلالى سن ",
    "contactPhone": "01129999990",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-47",
    "name": "جبس زراعى الضبعه",
    "clientName": "جبس زراعى الضبعه",
    "industrialZone": "مطروح - محور الضبعة",
    "location": {
      "lat": 30.14,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.6",
    "contactName": "إدارة استلام جبس زراعى الضبع",
    "contactPhone": "01130222212",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-48",
    "name": "جبس زراعى خالد المعداوى مصنع الواحه",
    "clientName": "جبس زراعى خالد المعداوى مصنع الواحه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.65",
    "contactName": "إدارة استلام جبس زراعى خالد ",
    "contactPhone": "01130444434",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-49",
    "name": "اسيل للمقاولات العامه الضبع سن مخلوط",
    "clientName": "اسيل للمقاولات العامه الضبع سن مخلوط",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.3",
    "contactName": "إدارة استلام اسيل للمقاولات ",
    "contactPhone": "01130666656",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-50",
    "name": "رمل ابراهيم الجرينى راس سدر",
    "clientName": "رمل ابراهيم الجرينى راس سدر",
    "industrialZone": "جنوب سيناء - رأس سدر",
    "location": {
      "lat": 30.26,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.35",
    "contactName": "إدارة استلام رمل ابراهيم الج",
    "contactPhone": "01130888878",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-51",
    "name": "عوده الجرينى رمل راس سدر",
    "clientName": "عوده الجرينى رمل راس سدر",
    "industrialZone": "جنوب سيناء - رأس سدر",
    "location": {
      "lat": 29.9,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.4",
    "contactName": "إدارة استلام عوده الجرينى رم",
    "contactPhone": "01131111100",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-52",
    "name": "رمل محمد ابو سليم راس سدر",
    "clientName": "رمل محمد ابو سليم راس سدر",
    "industrialZone": "جنوب سيناء - رأس سدر",
    "location": {
      "lat": 29.94,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.45",
    "contactName": "إدارة استلام رمل محمد ابو سل",
    "contactPhone": "01131333322",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-53",
    "name": "الفرعونيه م ناديه سن 1 عثمان احمد عثمان",
    "clientName": "الفرعونيه م ناديه سن 1 عثمان احمد عثمان",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.5",
    "contactName": "إدارة استلام الفرعونيه م ناد",
    "contactPhone": "01131555544",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-54",
    "name": "كازاكا المقاولين العرب",
    "clientName": "كازاكا المقاولين العرب",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.55",
    "contactName": "إدارة استلام كازاكا المقاولي",
    "contactPhone": "01131777766",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-55",
    "name": "ايكوبات ايكو سيرفيس",
    "clientName": "ايكوبات ايكو سيرفيس",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.6",
    "contactName": "إدارة استلام ايكوبات ايكو سي",
    "contactPhone": "01131999988",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-56",
    "name": "وول ستريت",
    "clientName": "وول ستريت",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.1,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.65",
    "contactName": "إدارة استلام وول ستريت",
    "contactPhone": "01132222210",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-57",
    "name": "ربيع رمل النفق",
    "clientName": "ربيع رمل النفق",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.3",
    "contactName": "إدارة استلام ربيع رمل النفق",
    "contactPhone": "01132444432",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-58",
    "name": "كيان للتوريدات العموميه",
    "clientName": "كيان للتوريدات العموميه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.35",
    "contactName": "إدارة استلام كيان للتوريدات ",
    "contactPhone": "01132666654",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-59",
    "name": "رمل محمد الشرقاوى قرية الياسمينا",
    "clientName": "رمل محمد الشرقاوى قرية الياسمينا",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.4",
    "contactName": "إدارة استلام رمل محمد الشرقا",
    "contactPhone": "01132888876",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-60",
    "name": "خضير رمل عيون موسى",
    "clientName": "خضير رمل عيون موسى",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.26,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.45",
    "contactName": "إدارة استلام خضير رمل عيون م",
    "contactPhone": "01133111098",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-61",
    "name": "احمد الاعرج",
    "clientName": "احمد الاعرج",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.5",
    "contactName": "إدارة استلام احمد الاعرج",
    "contactPhone": "01133333320",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-62",
    "name": "صالح العايدى القنطره تبع بايونير",
    "clientName": "صالح العايدى القنطره تبع بايونير",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.55",
    "contactName": "إدارة استلام صالح العايدى ال",
    "contactPhone": "01133555542",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-63",
    "name": "حسين نواره",
    "clientName": "حسين نواره",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.6",
    "contactName": "إدارة استلام حسين نواره",
    "contactPhone": "01133777764",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-64",
    "name": "صلاح تصدير",
    "clientName": "صلاح تصدير",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.65",
    "contactName": "إدارة استلام صلاح تصدير",
    "contactPhone": "01133999986",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-65",
    "name": "زراعى محمد محمود",
    "clientName": "زراعى محمد محمود",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.3",
    "contactName": "إدارة استلام زراعى محمد محمو",
    "contactPhone": "01134222208",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-66",
    "name": "جبس تصدير رويال",
    "clientName": "جبس تصدير رويال",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.1,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.35",
    "contactName": "إدارة استلام جبس تصدير رويال",
    "contactPhone": "01134444430",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-67",
    "name": "عاطف العرادى",
    "clientName": "عاطف العرادى",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.4",
    "contactName": "إدارة استلام عاطف العرادى",
    "contactPhone": "01134666652",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-68",
    "name": "قسط مكتب العاصمه الاداريه",
    "clientName": "قسط مكتب العاصمه الاداريه",
    "industrialZone": "العاصمة الإدارية الجديدة",
    "location": {
      "lat": 30.18,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.45",
    "contactName": "إدارة استلام قسط مكتب العاصم",
    "contactPhone": "01134888874",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-69",
    "name": "محمد حسين شرق بازلت جفجافه",
    "clientName": "محمد حسين شرق بازلت جفجافه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.5",
    "contactName": "إدارة استلام محمد حسين شرق ب",
    "contactPhone": "01135111096",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-70",
    "name": "شريف العرادى رمل الرينا",
    "clientName": "شريف العرادى رمل الرينا",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.26,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.55",
    "contactName": "إدارة استلام شريف العرادى رم",
    "contactPhone": "01135333318",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-71",
    "name": "حمدى سلام سانت كاترين",
    "clientName": "حمدى سلام سانت كاترين",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.6",
    "contactName": "إدارة استلام حمدى سلام سانت ",
    "contactPhone": "01135555540",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-72",
    "name": "الشيخ ناصر محجر الفيروز رمل",
    "clientName": "الشيخ ناصر محجر الفيروز رمل",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.65",
    "contactName": "إدارة استلام الشيخ ناصر محجر",
    "contactPhone": "01135777762",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-73",
    "name": "مصنع دهب",
    "clientName": "مصنع دهب",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.3",
    "contactName": "إدارة استلام مصنع دهب",
    "contactPhone": "01135999984",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-74",
    "name": "ا / احمد حزين ( عيون موسى )",
    "clientName": "ا / احمد حزين ( عيون موسى )",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.35",
    "contactName": "إدارة استلام ا / احمد حزين (",
    "contactPhone": "01136222206",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-75",
    "name": "مكتب مبارك الطور",
    "clientName": "مكتب مبارك الطور",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.4",
    "contactName": "إدارة استلام مكتب مبارك الطو",
    "contactPhone": "01136444428",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-76",
    "name": "احمد فوزى مخازن الاسماعيليه",
    "clientName": "احمد فوزى مخازن الاسماعيليه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.1,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.45",
    "contactName": "إدارة استلام احمد فوزى مخازن",
    "contactPhone": "01136666650",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-77",
    "name": "كريم يوسف تصدير / الفيروز",
    "clientName": "كريم يوسف تصدير / الفيروز",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.5",
    "contactName": "إدارة استلام كريم يوسف تصدير",
    "contactPhone": "01136888872",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-78",
    "name": "كريم فهمى تصدير",
    "clientName": "كريم فهمى تصدير",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.55",
    "contactName": "إدارة استلام كريم فهمى تصدير",
    "contactPhone": "01137111094",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-79",
    "name": "مصنع جبس الاسماعيلية",
    "clientName": "مصنع جبس الاسماعيلية",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.6",
    "contactName": "إدارة استلام مصنع جبس الاسما",
    "contactPhone": "01137333316",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-80",
    "name": "الضبع راس سدر",
    "clientName": "الضبع راس سدر",
    "industrialZone": "جنوب سيناء - رأس سدر",
    "location": {
      "lat": 30.26,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.65",
    "contactName": "إدارة استلام الضبع راس سدر",
    "contactPhone": "01137555538",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-81",
    "name": "خلاطة البعلى كاترين",
    "clientName": "خلاطة البعلى كاترين",
    "industrialZone": "محطة خرسانة جاهزة - قطاع المشروعات",
    "location": {
      "lat": 29.9,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.3",
    "contactName": "إدارة استلام خلاطة البعلى كا",
    "contactPhone": "01137777760",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-82",
    "name": "احمد عليان 2",
    "clientName": "احمد عليان 2",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.35",
    "contactName": "إدارة استلام احمد عليان 2",
    "contactPhone": "01137999982",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-83",
    "name": "جبس زراعى م احمد المغره",
    "clientName": "جبس زراعى م احمد المغره",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.4",
    "contactName": "إدارة استلام جبس زراعى م احم",
    "contactPhone": "01138222204",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-84",
    "name": "محمد الجرينى رمل",
    "clientName": "محمد الجرينى رمل",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.45",
    "contactName": "إدارة استلام محمد الجرينى رم",
    "contactPhone": "01138444426",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-85",
    "name": "رمل رمضان ابو سالم",
    "clientName": "رمل رمضان ابو سالم",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.5",
    "contactName": "إدارة استلام رمل رمضان ابو س",
    "contactPhone": "01138666648",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-86",
    "name": "سليم ابو راشد",
    "clientName": "سليم ابو راشد",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.1,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.55",
    "contactName": "إدارة استلام سليم ابو راشد",
    "contactPhone": "01138888870",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-87",
    "name": "سالم ابو رديس",
    "clientName": "سالم ابو رديس",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.6",
    "contactName": "إدارة استلام سالم ابو رديس",
    "contactPhone": "01139111092",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-88",
    "name": "محمود سعيد الجزار بنى سويف",
    "clientName": "محمود سعيد الجزار بنى سويف",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.65",
    "contactName": "إدارة استلام محمود سعيد الجز",
    "contactPhone": "01139333314",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-89",
    "name": "جبس زراعى عبد اللطيف جمال وادى النطرون",
    "clientName": "جبس زراعى عبد اللطيف جمال وادى النطرون",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.3",
    "contactName": "إدارة استلام جبس زراعى عبد ا",
    "contactPhone": "01139555536",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-90",
    "name": "م / ايهاب براديس",
    "clientName": "م / ايهاب براديس",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.26,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.35",
    "contactName": "إدارة استلام م / ايهاب برادي",
    "contactPhone": "01139777758",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-91",
    "name": "سعيد العجوانى",
    "clientName": "سعيد العجوانى",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.4",
    "contactName": "إدارة استلام سعيد العجوانى",
    "contactPhone": "01139999980",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-92",
    "name": "جبس زراعى احمد السيد",
    "clientName": "جبس زراعى احمد السيد",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.45",
    "contactName": "إدارة استلام جبس زراعى احمد ",
    "contactPhone": "01140222202",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-93",
    "name": "مصنع جبس بنى سويف م سامى عبد الكريم",
    "clientName": "مصنع جبس بنى سويف م سامى عبد الكريم",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.5",
    "contactName": "إدارة استلام مصنع جبس بنى سو",
    "contactPhone": "01140444424",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-94",
    "name": "جبس زراعى كريم ابو الحسن",
    "clientName": "جبس زراعى كريم ابو الحسن",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.55",
    "contactName": "إدارة استلام جبس زراعى كريم ",
    "contactPhone": "01140666646",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-95",
    "name": "مصنع كيان للجبس عتاقه",
    "clientName": "مصنع كيان للجبس عتاقه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.6",
    "contactName": "إدارة استلام مصنع كيان للجبس",
    "contactPhone": "01140888868",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-96",
    "name": "جبس تصدير الزعفرانه شرق التفريعه",
    "clientName": "جبس تصدير الزعفرانه شرق التفريعه",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 30.1,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.65",
    "contactName": "إدارة استلام جبس تصدير الزعف",
    "contactPhone": "01141111090",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-97",
    "name": "جبس زراعى محمود ماضى بلبيس",
    "clientName": "جبس زراعى محمود ماضى بلبيس",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.3",
    "contactName": "إدارة استلام جبس زراعى محمود",
    "contactPhone": "01141333312",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-98",
    "name": "مصنع اسمنت حلوان",
    "clientName": "مصنع اسمنت حلوان",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.35",
    "contactName": "إدارة استلام مصنع اسمنت حلوا",
    "contactPhone": "01141555534",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-99",
    "name": "شقة مدينتى 100 م",
    "clientName": "شقة مدينتى 100 م",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.4",
    "contactName": "إدارة استلام شقة مدينتى 100 ",
    "contactPhone": "01141777756",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-100",
    "name": "جبس زراعى ابو ايمن ميزان الابطال",
    "clientName": "جبس زراعى ابو ايمن ميزان الابطال",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.26,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.45",
    "contactName": "إدارة استلام جبس زراعى ابو ا",
    "contactPhone": "01141999978",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-101",
    "name": "جبس زراعى محمد احمد رمزى",
    "clientName": "جبس زراعى محمد احمد رمزى",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.5",
    "contactName": "إدارة استلام جبس زراعى محمد ",
    "contactPhone": "01142222200",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-102",
    "name": "رمل الثور عوده حميد",
    "clientName": "رمل الثور عوده حميد",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.55",
    "contactName": "إدارة استلام رمل الثور عوده ",
    "contactPhone": "01142444422",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-103",
    "name": "محمد سليم رمل كاترين",
    "clientName": "محمد سليم رمل كاترين",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.6",
    "contactName": "إدارة استلام محمد سليم رمل ك",
    "contactPhone": "01142666644",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-104",
    "name": "رمل الثور احمد سالم",
    "clientName": "رمل الثور احمد سالم",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.65",
    "contactName": "إدارة استلام رمل الثور احمد ",
    "contactPhone": "01142888866",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-105",
    "name": "عماد سراج رمل الثور",
    "clientName": "عماد سراج رمل الثور",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.3",
    "contactName": "إدارة استلام عماد سراج رمل ا",
    "contactPhone": "01143111088",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-106",
    "name": "سليم مبروك سعود رمل ابو زنيمه",
    "clientName": "سليم مبروك سعود رمل ابو زنيمه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.1,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.35",
    "contactName": "إدارة استلام سليم مبروك سعود",
    "contactPhone": "01143333310",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-107",
    "name": "جبس زراعى عبد الواحد النوباريه",
    "clientName": "جبس زراعى عبد الواحد النوباريه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.4",
    "contactName": "إدارة استلام جبس زراعى عبد ا",
    "contactPhone": "01143555532",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-108",
    "name": "محمد محمود جديد نقله زراعى",
    "clientName": "محمد محمود جديد نقله زراعى",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.45",
    "contactName": "إدارة استلام محمد محمود جديد",
    "contactPhone": "01143777754",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-109",
    "name": "رمل العريش سعود",
    "clientName": "رمل العريش سعود",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.5",
    "contactName": "إدارة استلام رمل العريش سعود",
    "contactPhone": "01143999976",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-110",
    "name": "الشيخ خالد رمل المعديه شرق",
    "clientName": "الشيخ خالد رمل المعديه شرق",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.26,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.55",
    "contactName": "إدارة استلام الشيخ خالد رمل ",
    "contactPhone": "01144222198",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-111",
    "name": "حسين الشحات سن 6 ابو زنيمه",
    "clientName": "حسين الشحات سن 6 ابو زنيمه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.6",
    "contactName": "إدارة استلام حسين الشحات سن ",
    "contactPhone": "01144444420",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-112",
    "name": "محمد اشرف شرق التفريعه داخلى",
    "clientName": "محمد اشرف شرق التفريعه داخلى",
    "industrialZone": "بورسعيد - شرق التفريعة",
    "location": {
      "lat": 29.94,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.65",
    "contactName": "إدارة استلام محمد اشرف شرق ا",
    "contactPhone": "01144666642",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-113",
    "name": "محجر الرغدان العريش",
    "clientName": "محجر الرغدان العريش",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.3",
    "contactName": "إدارة استلام محجر الرغدان ال",
    "contactPhone": "01144888864",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-114",
    "name": "شركة العين لتصدير الكاولينا",
    "clientName": "شركة العين لتصدير الكاولينا",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.02,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.02,32.35",
    "contactName": "إدارة استلام شركة العين لتصد",
    "contactPhone": "01145111086",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-115",
    "name": "شركة السعد بلبيس جبس",
    "clientName": "شركة السعد بلبيس جبس",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.06,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.06,32.4",
    "contactName": "إدارة استلام شركة السعد بلبي",
    "contactPhone": "01145333308",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-116",
    "name": "ايجيبت ستون",
    "clientName": "ايجيبت ستون",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.1,
      "lng": 32.45
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.1,32.45",
    "contactName": "إدارة استلام ايجيبت ستون",
    "contactPhone": "01145555530",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-117",
    "name": "جبس زراعى اسلام بلبيس",
    "clientName": "جبس زراعى اسلام بلبيس",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.14,
      "lng": 32.5
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.14,32.5",
    "contactName": "إدارة استلام جبس زراعى اسلام",
    "contactPhone": "01145777752",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-118",
    "name": "جبس زراعى عمرو خميس ايتاى البارود",
    "clientName": "جبس زراعى عمرو خميس ايتاى البارود",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.18,
      "lng": 32.55
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.18,32.55",
    "contactName": "إدارة استلام جبس زراعى عمرو ",
    "contactPhone": "01145999974",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-119",
    "name": "تصدير معادن مصر",
    "clientName": "تصدير معادن مصر",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.22,
      "lng": 32.6
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.22,32.6",
    "contactName": "إدارة استلام تصدير معادن مصر",
    "contactPhone": "01146222196",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-120",
    "name": "البعلى 3",
    "clientName": "البعلى 3",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 30.26,
      "lng": 32.65
    },
    "googleMapsUrl": "https://maps.google.com/?q=30.26,32.65",
    "contactName": "إدارة استلام البعلى 3",
    "contactPhone": "01146444418",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-121",
    "name": "محجر العالميه بودره العريش",
    "clientName": "محجر العالميه بودره العريش",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.9,
      "lng": 32.3
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.9,32.3",
    "contactName": "إدارة استلام محجر العالميه ب",
    "contactPhone": "01146666640",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-122",
    "name": "محمد الديب مصنع دهب غرامه الشركه المصريه",
    "clientName": "محمد الديب مصنع دهب غرامه الشركه المصريه",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.94,
      "lng": 32.35
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.94,32.35",
    "contactName": "إدارة استلام محمد الديب مصنع",
    "contactPhone": "01146888862",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  },
  {
    "id": "client-123",
    "name": "عمرو مهدى",
    "clientName": "عمرو مهدى",
    "industrialZone": "المنطقة الصناعية - السويس",
    "location": {
      "lat": 29.98,
      "lng": 32.4
    },
    "googleMapsUrl": "https://maps.google.com/?q=29.98,32.4",
    "contactName": "إدارة استلام عمرو مهدى",
    "contactPhone": "01147111084",
    "unloadingNotes": "التفريغ بعد الوزن بميزان البسكول، استلام إيصال التسليم."
  }
];

export const INITIAL_TRUCKS: FleetTruck[] = [
  {
    "id": "truck-1",
    "driverId": "driver-1",
    "plateNumber": "ط ر ق 7100",
    "driverName": "هاني على حسن جرامون",
    "driverPhone": "01230000000",
    "truckType": "تريلا قلاب",
    "capacityTons": 45,
    "status": "في مأمورية",
    "currentLocation": {
      "lat": 29.8732,
      "lng": 32.4285,
      "speedKmH": 60,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "في الطريق لمصنع الاستلام"
    }
  },
  {
    "id": "truck-2",
    "driverId": "driver-2",
    "plateNumber": "ط ر ق 7101",
    "driverName": "انور مشرف",
    "driverPhone": "01230333333",
    "truckType": "جرار بمقطورة",
    "capacityTons": 50,
    "status": "في مأمورية",
    "currentLocation": {
      "lat": 29.8932,
      "lng": 32.4485,
      "speedKmH": 60,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "في الطريق لمصنع الاستلام"
    }
  },
  {
    "id": "truck-3",
    "driverId": "driver-3",
    "plateNumber": "ط ر ق 7102",
    "driverName": "السيد محمود",
    "driverPhone": "01230666666",
    "truckType": "سيارة قلاب 4 أكس",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9132,
      "lng": 32.4685,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-4",
    "driverId": "driver-4",
    "plateNumber": "ط ر ق 7103",
    "driverName": "محمد جابر حسين عبدالقادر سنجر",
    "driverPhone": "01230999999",
    "truckType": "تريلا فرش",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9332,
      "lng": 32.4885,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-5",
    "driverId": "driver-5",
    "plateNumber": "ط ر ق 7104",
    "driverName": "محمود صالح",
    "driverPhone": "01231333332",
    "truckType": "تريلا قلاب",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9532,
      "lng": 32.5085,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-6",
    "driverId": "driver-6",
    "plateNumber": "ط ر ق 7105",
    "driverName": "محمد احمد رمزى",
    "driverPhone": "01231666665",
    "truckType": "جرار بمقطورة",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.8732,
      "lng": 32.4285,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-7",
    "driverId": "driver-7",
    "plateNumber": "ط ر ق 7106",
    "driverName": "حمدى سلام",
    "driverPhone": "01231999998",
    "truckType": "سيارة قلاب 4 أكس",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.8932,
      "lng": 32.4485,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-8",
    "driverId": "driver-8",
    "plateNumber": "ط ر ق 7107",
    "driverName": "علي يحيى",
    "driverPhone": "01232333331",
    "truckType": "تريلا فرش",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9132,
      "lng": 32.4685,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-9",
    "driverId": "driver-9",
    "plateNumber": "ط ر ق 7108",
    "driverName": "سالم محجوب",
    "driverPhone": "01232666664",
    "truckType": "تريلا قلاب",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9332,
      "lng": 32.4885,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-10",
    "driverId": "driver-10",
    "plateNumber": "ط ر ق 7109",
    "driverName": "شعبان فارس",
    "driverPhone": "01232999997",
    "truckType": "جرار بمقطورة",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9532,
      "lng": 32.5085,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-11",
    "driverId": "driver-11",
    "plateNumber": "ط ر ق 7110",
    "driverName": "سلطان محجوب",
    "driverPhone": "01233333330",
    "truckType": "سيارة قلاب 4 أكس",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.8732,
      "lng": 32.4285,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-12",
    "driverId": "driver-12",
    "plateNumber": "ط ر ق 7111",
    "driverName": "محمد عوض",
    "driverPhone": "01233666663",
    "truckType": "تريلا فرش",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.8932,
      "lng": 32.4485,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-13",
    "driverId": "driver-13",
    "plateNumber": "ط ر ق 7112",
    "driverName": "محمد وليد عيسى",
    "driverPhone": "01233999996",
    "truckType": "تريلا قلاب",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9132,
      "lng": 32.4685,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-14",
    "driverId": "driver-14",
    "plateNumber": "ط ر ق 7113",
    "driverName": "ياسر حسان",
    "driverPhone": "01234333329",
    "truckType": "جرار بمقطورة",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9332,
      "lng": 32.4885,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-15",
    "driverId": "driver-15",
    "plateNumber": "ط ر ق 7114",
    "driverName": "ايمن شبانه",
    "driverPhone": "01234666662",
    "truckType": "سيارة قلاب 4 أكس",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9532,
      "lng": 32.5085,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-16",
    "driverId": "driver-16",
    "plateNumber": "ط ر ق 7115",
    "driverName": "عماد عبد الله عبد الجليل",
    "driverPhone": "01234999995",
    "truckType": "تريلا فرش",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.8732,
      "lng": 32.4285,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-17",
    "driverId": "driver-17",
    "plateNumber": "ط ر ق 7116",
    "driverName": "محمد عطيه",
    "driverPhone": "01235333328",
    "truckType": "تريلا قلاب",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.8932,
      "lng": 32.4485,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-18",
    "driverId": "driver-18",
    "plateNumber": "ط ر ق 7117",
    "driverName": "على عبد العزيز",
    "driverPhone": "01235666661",
    "truckType": "جرار بمقطورة",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9132,
      "lng": 32.4685,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-19",
    "driverId": "driver-19",
    "plateNumber": "ط ر ق 7118",
    "driverName": "ممدوح عبد العزيز",
    "driverPhone": "01235999994",
    "truckType": "سيارة قلاب 4 أكس",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9332,
      "lng": 32.4885,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-20",
    "driverId": "driver-20",
    "plateNumber": "ط ر ق 7119",
    "driverName": "عبد الخالق الرخاوي",
    "driverPhone": "01236333327",
    "truckType": "تريلا فرش",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9532,
      "lng": 32.5085,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-21",
    "driverId": "driver-21",
    "plateNumber": "ط ر ق 7120",
    "driverName": "ملك عبد الحكيم فهمي",
    "driverPhone": "01236666660",
    "truckType": "تريلا قلاب",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.8732,
      "lng": 32.4285,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-22",
    "driverId": "driver-22",
    "plateNumber": "ط ر ق 7121",
    "driverName": "ايمن مهران",
    "driverPhone": "01236999993",
    "truckType": "جرار بمقطورة",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.8932,
      "lng": 32.4485,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-23",
    "driverId": "driver-23",
    "plateNumber": "ط ر ق 7122",
    "driverName": "تبع ملك عبد الحكيم",
    "driverPhone": "01237333326",
    "truckType": "سيارة قلاب 4 أكس",
    "capacityTons": 50,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9132,
      "lng": 32.4685,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-24",
    "driverId": "driver-24",
    "plateNumber": "ط ر ق 7123",
    "driverName": "ايمن عبد الحميد",
    "driverPhone": "01237666659",
    "truckType": "تريلا فرش",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9332,
      "lng": 32.4885,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  },
  {
    "id": "truck-25",
    "driverId": "driver-25",
    "plateNumber": "ط ر ق 7124",
    "driverName": "رفعت مشرف",
    "driverPhone": "01237999992",
    "truckType": "تريلا قلاب",
    "capacityTons": 45,
    "status": "متاح للتحميل",
    "currentLocation": {
      "lat": 29.9532,
      "lng": 32.5085,
      "speedKmH": 0,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "جاهز للتحميل"
    }
  }
];

export const INITIAL_ORDERS: DailyOrder[] = [
  {
    "id": "order-1",
    "date": "2026-10-05",
    "clientId": "client-1",
    "clientName": "الدوليه لمواد البناء",
    "factoryName": "الدوليه لمواد البناء",
    "quarryId": "quarry-1",
    "quarryName": "محجر الاخوه العرب",
    "material": "سن 2",
    "totalRequiredLoads": 12,
    "completedLoads": 4,
    "inProgressLoads": 1,
    "notes": "توريد عاجل - تسليم السيلو رقم 2 بمصنع الدولية لمواد البناء.",
    "assignedDriverId": "driver-1",
    "assignedDriverName": "هاني على حسن جرامون",
    "assignedTruckPlate": "ط ر ق 7100",
    "priority": "عاجل",
    "status": "نشط ومتاح",
    "quarryCoords": {
      "lat": 29.8,
      "lng": 32.2
    },
    "factoryCoords": {
      "lat": 29.9,
      "lng": 32.3
    },
    "updatedAt": "2026-10-05T03:00:00.000Z"
  },
  {
    "id": "order-2",
    "date": "2026-10-05",
    "clientId": "client-7",
    "clientName": "شركة حسن علام",
    "factoryName": "شركة حسن علام",
    "quarryId": "quarry-5",
    "quarryName": "كسارة بن لادن",
    "material": "سن 1",
    "totalRequiredLoads": 8,
    "completedLoads": 2,
    "inProgressLoads": 1,
    "notes": "مشروع شركة حسن علام - مراجعة تصاريح الخروج من الكسارة قبل الانطلاق.",
    "assignedDriverId": "driver-2",
    "assignedDriverName": "انور مشرف",
    "assignedTruckPlate": "ط ر ق 7101",
    "priority": "أولوية قصوى",
    "status": "نشط ومتاح",
    "quarryCoords": {
      "lat": 30.0,
      "lng": 32.44
    },
    "factoryCoords": {
      "lat": 30.14,
      "lng": 32.6
    },
    "updatedAt": "2026-10-05T03:00:00.000Z"
  },
  {
    "id": "order-3",
    "date": "2026-10-05",
    "clientId": "client-10",
    "clientName": "خلاطة الحكيم",
    "factoryName": "خلاطة الحكيم",
    "quarryId": "quarry-2",
    "quarryName": "محجر الفيروز",
    "material": "رمل أصفر",
    "totalRequiredLoads": 10,
    "completedLoads": 1,
    "inProgressLoads": 0,
    "notes": "خلاطة الحكيم - تفريغ مباشر بالقواديس، ضرورة الوزن بميزان البسكول.",
    "priority": "عادي",
    "status": "نشط ومتاح",
    "quarryCoords": {
      "lat": 29.85,
      "lng": 32.26
    },
    "factoryCoords": {
      "lat": 30.26,
      "lng": 32.35
    },
    "updatedAt": "2026-10-05T03:00:00.000Z"
  }
];

export const INITIAL_ACTIVE_TRIPS: TripLoad[] = [
  {
    "id": "trip-101",
    "dailyOrderId": "order-1",
    "clientName": "الدوليه لمواد البناء",
    "factoryName": "الدوليه لمواد البناء",
    "quarryName": "محجر الاخوه العرب",
    "material": "سن 2",
    "notes": "توريد عاجل - تسليم السيلو رقم 2 بمصنع الدولية لمواد البناء.",
    "driverId": "driver-1",
    "driverName": "هاني على حسن جرامون",
    "driverPhone": "01230000000",
    "truckPlate": "ط ر ق 7100",
    "status": "in_transit",
    "ticketNumber": "BON-88412",
    "netWeightTons": 46.2,
    "startedAt": "2026-10-05T01:30:00.000Z",
    "claimedAt": "2026-10-05T01:30:00.000Z",
    "loadedAt": "2026-10-05T02:15:00.000Z",
    "driverNotes": "تم التحميل والوزن بمحجر الأخوة العرب، في الطريق للمصنع.",
    "currentLocation": {
      "lat": 29.8924,
      "lng": 32.4489,
      "speedKmH": 62,
      "heading": 45,
      "lastUpdated": "2026-10-05T03:00:00.000Z",
      "statusText": "في الطريق لتسليم مصنع الدولية لمواد البناء"
    },
    "quarryCoords": {
      "lat": 29.8,
      "lng": 32.2
    },
    "factoryCoords": {
      "lat": 29.9,
      "lng": 32.3
    },
    "isTrackingActive": true
  }
];

export const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    "id": "notif-1",
    "targetDriverId": "driver-1",
    "title": "حمولة معينة لك من كشف Tiba Supplies 🚛",
    "message": "تم تكليفك بنقلة سن 2 من [محجر الاخوه العرب] إلى [الدوليه لمواد البناء].",
    "type": "load_assigned",
    "timestamp": "2026-10-05T02:00:00.000Z",
    "read": false,
    "orderId": "order-1"
  }
];
