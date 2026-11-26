import { taxonomyKeys } from './taxonomy';

export type EventKind = 'national' | 'religious' | 'international' | 'field' | 'commercial';
export type Recurrence = 'gregorian_fixed' | 'hijri_fixed' | 'annual_manual';

export interface SeedOccurrence {
  year: number;
  startDate: string; // YYYY-MM-DD
  status: 'confirmed' | 'estimated';
  sourceUrl?: string;
}

export interface SeedEvent {
  slug: string;
  kind: EventKind;
  recurrence: Recurrence;
  gMonth?: number;
  gDay?: number;
  hMonth?: number;
  hDay?: number;
  durationDays: number;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  contentIdeaAr: string;
  contentIdeaEn: string;
  icon: string;
  color: string;
  prepDays: number;
  sourceName: string | null;
  sourceUrl: string | null;
  tags: { group: 'sector' | 'field' | 'audience' | 'use'; key: string; weight: number }[];
  occurrences: SeedOccurrence[];
}

// Sector weight profiles: they make the sector choice actually change recommendations.
const SECTOR = {
  all: { government: 3, semi_government: 3, private: 3, nonprofit: 3 },
  civic: { government: 3, semi_government: 2, private: 2, nonprofit: 3 },
  social: { government: 2, semi_government: 2, private: 1, nonprofit: 3 },
  corp: { government: 2, semi_government: 3, private: 3, nonprofit: 1 },
  gov: { government: 3, semi_government: 3, private: 1, nonprofit: 2 },
  comm: { government: 1, semi_government: 2, private: 3, nonprofit: 1 },
} as const;
type Sector = keyof typeof SECTOR;

const UN = 'United Nations';
const UN_INDEX = 'https://www.un.org/en/observances/list-of-observances';
const UNESCO = 'UNESCO';
const UNESCO_INDEX = 'https://www.unesco.org/en/days';
const WHO = 'World Health Organization';
const MYGOV = 'Saudi National Platform (my.gov.sa)';
const MYGOV_URL = 'https://www.my.gov.sa';
const UQ = 'Umm al-Qura Calendar';
const UQ_URL = 'https://www.ummulqura.org.sa/';

interface Def {
  s: string; // slug
  k: EventKind;
  r: 'g' | 'h' | 'm';
  m?: number; // month (gregorian or hijri depending on r)
  d?: number;
  n?: number; // duration in days
  ar: string;
  en: string;
  da: string;
  de: string;
  ia: string; // content idea (Arabic)
  ie: string; // content idea (English)
  icon: string;
  color: string;
  src: [string, string] | null; // [name, url]
  sec: Sector;
  f: string; // fields "key:weight ..."
  a: string; // audiences
  u: string; // uses
  prep?: number;
  occ?: [string, string, 'confirmed' | 'estimated'][]; // [year, date, status]
}

const DEFS: Def[] = [
  // ───────────── National (Saudi) ─────────────
  {
    s: 'founding-day', k: 'national', r: 'g', m: 2, d: 22,
    ar: 'يوم التأسيس', en: 'Founding Day',
    da: 'ذكرى تأسيس الدولة السعودية الأولى عام 1727م على يد الإمام محمد بن سعود، وهو يوم عطلة رسمية.',
    de: 'Anniversary of the founding of the first Saudi state in 1727 by Imam Muhammad bin Saud; an official public holiday.',
    ia: 'انشروا قصة مصورة تربط تاريخ جهتكم بمسيرة التأسيس، وزيّنوا مقرّكم بالهوية البصرية للمناسبة.',
    ie: 'Publish a visual story linking your organisation’s history to the founding journey and decorate your premises with the occasion’s identity.',
    icon: '🏰', color: '#8d692e', src: [MYGOV, MYGOV_URL], sec: 'all',
    f: 'culture:3 tourism:2', a: 'general:3 families:3 employees:2', u: 'marketing:3 event:3 internal:2', prep: 21,
  },
  {
    s: 'flag-day', k: 'national', r: 'g', m: 3, d: 11,
    ar: 'يوم العلم', en: 'Flag Day',
    da: 'مناسبة وطنية سنوية يُحتفى فيها بالعلم السعودي ورمزيته وما يمثله من توحيد وعزة، بأمر من الملك سلمان بن عبدالعزيز.',
    de: 'An annual occasion, set by royal decision, honouring the Saudi flag and what it stands for.',
    ia: 'ارفعوا العلم في مقركم ونفّذوا حملة على المنصات الرقمية بوسم يجمع الموظفين والعملاء.',
    ie: 'Raise the flag at your premises and run a social campaign under a shared hashtag for staff and customers.',
    icon: '🇸🇦', color: '#2f7a4d', src: [MYGOV, MYGOV_URL], sec: 'all',
    f: 'culture:2', a: 'general:3 employees:3 youth:2', u: 'marketing:3 internal:3 event:2', prep: 14,
  },
  {
    s: 'national-day', k: 'national', r: 'g', m: 9, d: 23,
    ar: 'اليوم الوطني', en: 'Saudi National Day',
    da: 'ذكرى توحيد المملكة العربية السعودية على يد الملك عبدالعزيز عام 1932م، وهو أكبر المناسبات الوطنية احتفاءً.',
    de: 'Anniversary of the unification of the Kingdom of Saudi Arabia by King Abdulaziz in 1932; the foremost national celebration.',
    ia: 'جهّزوا حملة وطنية متكاملة تشمل تهنئة المنصات، وفعالية للموظفين، وعروضًا خاصة للعملاء.',
    ie: 'Prepare a full national campaign: social greetings, a staff event and special offers for customers.',
    icon: '🇸🇦', color: '#1f7a4a', src: [MYGOV, MYGOV_URL], sec: 'all',
    f: 'culture:3 tourism:3 retail:2 food_hospitality:2', a: 'general:3 families:3 employees:3 customers:3',
    u: 'marketing:3 event:3 internal:3 csr:2', prep: 30,
  },
  {
    s: 'vision-2030-anniversary', k: 'national', r: 'g', m: 4, d: 25,
    ar: 'ذكرى إطلاق رؤية السعودية 2030', en: 'Saudi Vision 2030 Anniversary',
    da: 'ذكرى الإعلان عن رؤية المملكة 2030 عام 2016م، وفرصة لعرض إسهام الجهة في مستهدفاتها.',
    de: 'Anniversary of the announcement of Saudi Vision 2030 in 2016; a chance to show your organisation’s contribution to its goals.',
    ia: 'اعرضوا في منشور أو تقرير موجز أبرز ما حققته جهتكم من مستهدفات الرؤية خلال العام.',
    ie: 'Share a short post or report on what your organisation achieved against Vision targets this year.',
    icon: '🎯', color: '#1f6b57', src: ['Saudi Vision 2030', 'https://www.vision2030.gov.sa'], sec: 'all',
    f: 'technology:2 finance:2 energy:2', a: 'general:2 professionals:3 employees:2', u: 'marketing:2 internal:3 awareness:2', prep: 14,
  },
  {
    s: 'saudi-green-initiative-day', k: 'national', r: 'g', m: 3, d: 27,
    ar: 'ذكرى إطلاق مبادرة السعودية الخضراء', en: 'Saudi Green Initiative Anniversary',
    da: 'ذكرى إطلاق مبادرة السعودية الخضراء عام 2021م لخفض الانبعاثات وزيادة الغطاء النباتي وحماية البيئة.',
    de: 'Anniversary of the 2021 launch of the Saudi Green Initiative to cut emissions, expand vegetation cover and protect nature.',
    ia: 'نظّموا حملة تشجير أو ترشيد للطاقة بمشاركة الموظفين، وانشروا حصيلة أثرها.',
    ie: 'Run a tree-planting or energy-saving drive with staff and publish the results.',
    icon: '🌳', color: '#3c8a4c', src: ['Saudi Green Initiative', 'https://www.saudigreeninitiative.org/'], sec: 'all',
    f: 'environment:3 energy:2', a: 'general:2 employees:2 youth:2', u: 'csr:3 awareness:3 event:2', prep: 21,
  },

  // ───────────── Religious (Hijri, Umm al-Qura, estimated until announced) ─────────────
  {
    s: 'hijri-new-year', k: 'religious', r: 'h', m: 1, d: 1,
    ar: 'رأس السنة الهجرية', en: 'Islamic New Year',
    da: 'بداية السنة الهجرية الجديدة، ذكرى هجرة النبي ﷺ من مكة المكرمة إلى المدينة المنورة.',
    de: 'The first day of the new Hijri year, commemorating the Prophet’s ﷺ migration from Makkah to Madinah.',
    ia: 'أصدروا تهنئة رسمية بالعام الهجري الجديد مع بطاقة تحمل هوية الجهة.',
    ie: 'Issue an official greeting for the new Hijri year with a branded card.',
    icon: '🌙', color: '#8d692e', src: [UQ, UQ_URL], sec: 'all',
    f: 'culture:2', a: 'general:3 employees:2 families:2', u: 'marketing:2 internal:3', prep: 7,
  },
  {
    s: 'ramadan-start', k: 'religious', r: 'h', m: 9, d: 1,
    ar: 'بداية شهر رمضان', en: 'Beginning of Ramadan',
    da: 'موسم مجتمعي مهم للحملات والفعاليات والمبادرات الداخلية. يثبت التاريخ بعد الإعلان الرسمي.',
    de: 'A major community season for campaigns, events and internal initiatives. The date is confirmed after the official announcement.',
    ia: 'خطّطوا لحملة رمضانية متكاملة: تهنئة، ومبادرات إفطار وتبرع، وجدول عمل مرن للموظفين.',
    ie: 'Plan a full Ramadan campaign: greetings, iftar and giving initiatives, and a flexible schedule for staff.',
    icon: '🌙', color: '#8d692e', src: [UQ, UQ_URL], sec: 'all',
    f: 'culture:3 food_hospitality:3 retail:3 tourism:2 hr:2', a: 'general:3 families:3 employees:3 customers:3',
    u: 'marketing:3 csr:3 event:3 internal:3', prep: 30,
  },
  {
    s: 'eid-al-fitr', k: 'religious', r: 'h', m: 10, d: 1, n: 3,
    ar: 'عيد الفطر', en: 'Eid al-Fitr',
    da: 'عيد المسلمين بعد إتمام صيام رمضان، وإجازة رسمية تمتد أيامًا.',
    de: 'The festival marking the end of Ramadan fasting, with an official multi-day holiday.',
    ia: 'جهّزوا تهنئة العيد وإعلان مواعيد الإجازة وعروض العيد قبل أسبوعين من موعده.',
    ie: 'Prepare Eid greetings, holiday-hours notices and Eid offers two weeks ahead.',
    icon: '🎉', color: '#c2893a', src: [UQ, UQ_URL], sec: 'all',
    f: 'retail:3 tourism:3 food_hospitality:3 hr:2 culture:2', a: 'general:3 families:3 children:3 employees:3 customers:3',
    u: 'marketing:3 event:3 internal:3', prep: 21,
  },
  {
    s: 'arafah-day', k: 'religious', r: 'h', m: 12, d: 9,
    ar: 'يوم عرفة', en: 'Day of Arafah',
    da: 'اليوم التاسع من ذي الحجة، وهو ركن الحج الأعظم وهو من أعظم أيام السنة.',
    de: 'The ninth of Dhul Hijjah, the pinnacle of Hajj and one of the most virtuous days of the year.',
    ia: 'انشروا رسالة تهنئة بيوم عرفة مع تنبيه بمواعيد الإجازة المرتبطة بالعيد.',
    ie: 'Post an Arafah greeting along with a notice of the Eid-related holiday schedule.',
    icon: '🕋', color: '#8d692e', src: [UQ, UQ_URL], sec: 'all',
    f: 'culture:2 tourism:2 hr:2', a: 'general:3 employees:2 families:2', u: 'awareness:3 internal:2', prep: 7,
  },
  {
    s: 'eid-al-adha', k: 'religious', r: 'h', m: 12, d: 10, n: 4,
    ar: 'عيد الأضحى', en: 'Eid al-Adha',
    da: 'عيد النحر في العاشر من ذي الحجة، وإجازة رسمية تمتد أيامًا.',
    de: 'The Feast of Sacrifice on 10 Dhul Hijjah, with an official multi-day holiday.',
    ia: 'أطلقوا تهنئة العيد ومبادرة أضاحٍ أو تبرعات خيرية بالشراكة مع جهة موثوقة.',
    ie: 'Launch Eid greetings and a sacrifice or charitable-giving initiative with a trusted partner.',
    icon: '🐑', color: '#c2893a', src: [UQ, UQ_URL], sec: 'all',
    f: 'retail:3 tourism:3 food_hospitality:3 hr:2 culture:2', a: 'general:3 families:3 children:2 employees:3 customers:3',
    u: 'marketing:3 csr:3 internal:3', prep: 21,
  },

  // ───────────── International days (the 19 occasions of the old site, re-tagged) ─────────────
  {
    s: 'education-day', k: 'international', r: 'g', m: 1, d: 24,
    ar: 'اليوم الدولي للتعليم', en: 'International Day of Education',
    da: 'مناسبة عالمية للاحتفاء بدور التعليم في بناء السلام والتنمية وصناعة الفرص.',
    de: 'A global observance celebrating education as a foundation for peace, development and opportunity.',
    ia: 'أبرزوا برنامجًا تعليميًا أو منحة تدريبية تقدمها جهتكم مع قصة نجاح لأحد المستفيدين.',
    ie: 'Highlight a training programme or scholarship your organisation offers, with a beneficiary’s success story.',
    icon: '📚', color: '#5268c5', src: [UN, 'https://www.un.org/en/observances/education-day'], sec: 'civic',
    f: 'education:3 technology:1', a: 'youth:3 professionals:2 general:1', u: 'awareness:3 event:2 csr:2',
  },
  {
    s: 'cancer-day', k: 'field', r: 'g', m: 2, d: 4,
    ar: 'اليوم العالمي للسرطان', en: 'World Cancer Day',
    da: 'فرصة للتوعية بالوقاية والكشف المبكر ودعم المصابين وأسرهم.',
    de: 'An opportunity to raise awareness of prevention, early detection and support for patients and families.',
    ia: 'نظّموا يوم فحص مبكر أو ندوة توعوية للموظفين، وانشروا رسائل عن الكشف المبكر.',
    ie: 'Host an early-screening day or awareness talk for staff and share early-detection messages.',
    icon: '🎗️', color: '#7158a8', src: [WHO, 'https://www.who.int/campaigns/world-cancer-day'], sec: 'social',
    f: 'health:3', a: 'employees:3 families:2 general:2', u: 'awareness:3 csr:3 internal:2',
  },
  {
    s: 'women-science-day', k: 'international', r: 'g', m: 2, d: 11,
    ar: 'اليوم الدولي للمرأة والفتاة في ميدان العلوم', en: 'International Day of Women and Girls in Science',
    da: 'يسلط الضوء على مشاركة النساء والفتيات في العلوم والتقنية والابتكار.',
    de: 'Highlights the participation of women and girls in science, technology and innovation.',
    ia: 'قدّموا ملفًا تعريفيًا لباحثة أو مهندسة من فريقكم وشجعوا الطالبات على المسارات العلمية.',
    ie: 'Profile a woman researcher or engineer from your team and encourage girls toward science paths.',
    icon: '🔬', color: '#336e88', src: [UN, 'https://www.un.org/en/observances/women-and-girls-in-science-day'], sec: 'corp',
    f: 'technology:3 education:3', a: 'women:3 youth:3 professionals:2', u: 'awareness:2 csr:2 marketing:2',
  },
  {
    s: 'mother-language-day', k: 'international', r: 'g', m: 2, d: 21,
    ar: 'اليوم الدولي للغة الأم', en: 'International Mother Language Day',
    da: 'مناسبة لليونسكو للاحتفاء بالتنوع اللغوي والثقافي وحماية اللغات.',
    de: 'A UNESCO observance celebrating linguistic and cultural diversity and the protection of languages.',
    ia: 'انشروا سلسلة منشورات عن جمال اللغة العربية وتعابيرها المحلية بخط عربي مميز.',
    ie: 'Publish a series on the beauty of Arabic and local expressions using distinctive Arabic calligraphy.',
    icon: '🗣️', color: '#8b684a', src: [UNESCO, 'https://www.un.org/en/observances/mother-language-day'], sec: 'civic',
    f: 'culture:3 education:2', a: 'general:2 youth:2 children:2', u: 'awareness:3 marketing:2',
  },
  {
    s: 'women-day', k: 'international', r: 'g', m: 3, d: 8,
    ar: 'اليوم العالمي للمرأة', en: 'International Women’s Day',
    da: 'مناسبة للاحتفاء بإنجازات النساء وتعزيز المشاركة والفرص المتكافئة.',
    de: 'An occasion to celebrate women’s achievements and promote participation and equal opportunity.',
    ia: 'سلّطوا الضوء على إنجازات الموظفات وبرامج التمكين في جهتكم بمحتوى مرئي وشهادات حقيقية.',
    ie: 'Spotlight your female colleagues’ achievements and empowerment programmes with visuals and real testimonials.',
    icon: '♀️', color: '#a84d7b', src: [UN, 'https://www.un.org/en/observances/womens-day'], sec: 'corp',
    f: 'hr:3 education:2 culture:2', a: 'women:3 employees:3 general:1', u: 'marketing:3 internal:3 event:2 awareness:2',
  },
  {
    s: 'mathematics-day', k: 'international', r: 'g', m: 3, d: 14,
    ar: 'اليوم الدولي للرياضيات', en: 'International Day of Mathematics',
    da: 'مناسبة لليونسكو تبرز دور الرياضيات في العلوم والتقنية وحياتنا اليومية.',
    de: 'A UNESCO observance highlighting the role of mathematics in science, technology and everyday life.',
    ia: 'أطلقوا تحديًا رياضيًا ممتعًا للطلاب أو الموظفين مع جوائز رمزية.',
    ie: 'Launch a fun maths challenge for students or staff with small prizes.',
    icon: '➗', color: '#336e88', src: [UNESCO, UNESCO_INDEX], sec: 'corp',
    f: 'education:3 technology:2', a: 'children:2 youth:3 professionals:1', u: 'event:3 awareness:2',
  },
  {
    s: 'consumer-rights-day', k: 'field', r: 'g', m: 3, d: 15,
    ar: 'اليوم العالمي لحقوق المستهلك', en: 'World Consumer Rights Day',
    da: 'يوم عالمي لتعزيز حقوق المستهلكين وحمايتهم والمطالبة بمعاملة عادلة.',
    de: 'A global day promoting consumer rights, protection and fair treatment.',
    ia: 'وضّحوا سياسات الاسترجاع والضمان لديكم في بطاقات مبسطة، وأعلنوا التزامكم بخدمة العملاء.',
    ie: 'Explain your returns and warranty policies in simple cards and restate your customer-service commitments.',
    icon: '🛒', color: '#b46c37', src: ['Consumers International', 'https://www.consumersinternational.org/'], sec: 'comm',
    f: 'retail:3 finance:2', a: 'customers:3 general:2', u: 'marketing:3 awareness:2',
  },
  {
    s: 'happiness-day', k: 'international', r: 'g', m: 3, d: 20,
    ar: 'اليوم الدولي للسعادة', en: 'International Day of Happiness',
    da: 'يؤكد أهمية السعادة والرفاه وجودة الحياة في المجتمعات وبيئات العمل.',
    de: 'Recognizes the importance of happiness, wellbeing and quality of life in communities and workplaces.',
    ia: 'نظّموا لفتة بسيطة لموظفيكم مثل وجبة جماعية أو ساعة ترفيه، وشاركوا لحظاتها.',
    ie: 'Organise a small gesture for staff, such as a shared meal or a fun hour, and share the moments.',
    icon: '☀️', color: '#d18428', src: [UN, 'https://www.un.org/en/observances/happiness-day'], sec: 'corp',
    f: 'hr:3 health:2 culture:1', a: 'employees:3 families:2 general:1', u: 'internal:3 event:2 marketing:2',
  },
  {
    s: 'water-day', k: 'international', r: 'g', m: 3, d: 22,
    ar: 'اليوم العالمي للمياه', en: 'World Water Day',
    da: 'منصة للتوعية بقيمة المياه والعمل من أجل إدارة الموارد المائية بصورة مستدامة.',
    de: 'A platform for awareness of water and action toward sustainable water-resource management.',
    ia: 'شاركوا أرقام ترشيد المياه في جهتكم وأطلقوا تحديًا لخفض الاستهلاك.',
    ie: 'Share your water-saving figures and launch a challenge to reduce consumption.',
    icon: '💧', color: '#2a7fa0', src: [UN, 'https://www.un.org/en/observances/water-day'], sec: 'gov',
    f: 'environment:3 energy:2 real_estate:2 education:1', a: 'general:2 families:2 youth:2', u: 'awareness:3 csr:2 event:1',
  },
  {
    s: 'sport-day', k: 'international', r: 'g', m: 4, d: 6,
    ar: 'اليوم الدولي للرياضة من أجل التنمية والسلام', en: 'International Day of Sport for Development and Peace',
    da: 'يبرز دور الرياضة في بناء المجتمعات والتنمية والتقارب بين الشعوب.',
    de: 'Highlights the role of sport in building communities, development and bringing peoples together.',
    ia: 'نظّموا مشيًا جماعيًا أو بطولة ودية للموظفين وشاركوا صور الفعالية.',
    ie: 'Organise a group walk or friendly tournament for staff and share photos of the event.',
    icon: '⚽', color: '#2f7a4d', src: [UN, UN_INDEX], sec: 'civic',
    f: 'sports:3 health:2', a: 'youth:3 employees:2 families:2', u: 'event:3 internal:2 csr:2',
  },
  {
    s: 'health-day', k: 'field', r: 'g', m: 4, d: 7,
    ar: 'يوم الصحة العالمي', en: 'World Health Day',
    da: 'يضع قضية صحية ذات أولوية على أجندة التوعية والفعاليات كل عام.',
    de: 'Places a priority health issue on the awareness and events agenda each year.',
    ia: 'وفّروا للموظفين فحوصات صحية سريعة وانشروا نصائح صحية موثوقة من مصدر معتمد.',
    ie: 'Offer staff quick health checks and share tips from a trusted authority.',
    icon: '🩺', color: '#3c8a74', src: [WHO, 'https://www.who.int/campaigns/world-health-day'], sec: 'civic',
    f: 'health:3 hr:2', a: 'employees:3 general:2 professionals:2', u: 'awareness:3 event:2 internal:2',
  },
  {
    s: 'heritage-day', k: 'international', r: 'g', m: 4, d: 18,
    ar: 'اليوم العالمي للتراث', en: 'International Day for Monuments and Sites',
    da: 'يوم للتعريف بأهمية المواقع الأثرية والتراثية والحفاظ عليها.',
    de: 'A day to promote awareness of heritage sites and monuments and their preservation.',
    ia: 'عرّفوا بموقع تراثي قريب من مقركم عبر صور وحقائق مختصرة، أو نظّموا زيارة للموظفين.',
    ie: 'Showcase a heritage site near your premises with photos and short facts, or arrange a staff visit.',
    icon: '🏛️', color: '#8b684a', src: [UNESCO, UNESCO_INDEX], sec: 'civic',
    f: 'culture:3 tourism:3', a: 'general:2 families:2 youth:1', u: 'awareness:3 event:2 marketing:2',
  },
  {
    s: 'earth-day', k: 'international', r: 'g', m: 4, d: 22,
    ar: 'اليوم الدولي لأمنا الأرض', en: 'International Mother Earth Day',
    da: 'فرصة لإطلاق مبادرات الاستدامة وحماية الطبيعة وإشراك المجتمع.',
    de: 'An opportunity to launch sustainability, nature-protection and community-engagement initiatives.',
    ia: 'أعلنوا التزامًا بيئيًا واضحًا مثل تقليل البلاستيك، وادعوا الموظفين لمبادرة تطوعية.',
    ie: 'Announce a clear environmental commitment such as cutting plastic, and invite staff to a volunteer drive.',
    icon: '🌎', color: '#4c8652', src: [UN, 'https://www.un.org/en/observances/earth-day'], sec: 'gov',
    f: 'environment:3 energy:2 education:1', a: 'general:2 youth:3 families:2', u: 'awareness:3 csr:3 marketing:2',
  },
  {
    s: 'book-day', k: 'international', r: 'g', m: 4, d: 23,
    ar: 'اليوم العالمي للكتاب وحقوق المؤلف', en: 'World Book and Copyright Day',
    da: 'مناسبة لليونسكو لتشجيع القراءة والنشر وحماية حقوق المؤلفين.',
    de: 'A UNESCO observance encouraging reading, publishing and the protection of authors’ rights.',
    ia: 'انشروا قائمة كتب يوصي بها فريقكم أو أطلقوا مبادرة تبادل كتب بين الموظفين.',
    ie: 'Share a reading list recommended by your team or start a book swap among staff.',
    icon: '📖', color: '#8b684a', src: [UNESCO, UNESCO_INDEX], sec: 'social',
    f: 'culture:3 education:3', a: 'youth:2 children:2 general:2', u: 'awareness:2 event:2 marketing:2',
  },
  {
    s: 'safety-work-day', k: 'field', r: 'g', m: 4, d: 28,
    ar: 'اليوم العالمي للسلامة والصحة المهنية', en: 'World Day for Safety and Health at Work',
    da: 'يوم لتعزيز ثقافة السلامة والوقاية من الحوادث والأمراض المهنية.',
    de: 'A day to promote a culture of safety and the prevention of occupational accidents and diseases.',
    ia: 'ذكّروا الموظفين بإرشادات السلامة وأجروا تمرين إخلاء أو دورة إسعافات أولية.',
    ie: 'Remind staff of safety guidelines and run an evacuation drill or first-aid session.',
    icon: '🦺', color: '#c2893a', src: ['International Labour Organization', 'https://www.ilo.org/safeday'], sec: 'corp',
    f: 'hr:3 energy:3 real_estate:3 logistics:2', a: 'employees:3 professionals:2', u: 'internal:3 awareness:3',
  },
  {
    s: 'families-day', k: 'international', r: 'g', m: 5, d: 15,
    ar: 'اليوم الدولي للأسر', en: 'International Day of Families',
    da: 'يركز على القضايا التي تمس الأسر ويتيح أفكارًا لفعاليات ومحتوى عائلي.',
    de: 'Focuses on issues affecting families and creates opportunities for family events and content.',
    ia: 'ادعوا عائلات الموظفين ليوم عائلي، أو قدّموا عرضًا موجهًا للأسر.',
    ie: 'Invite staff families to a family day or offer a family-oriented promotion.',
    icon: '🏡', color: '#b45c4e', src: [UN, 'https://www.un.org/en/observances/international-day-of-families'], sec: 'corp',
    f: 'tourism:3 food_hospitality:2 retail:2 education:1', a: 'families:3 children:3 employees:2', u: 'event:3 marketing:3 internal:2',
  },
  {
    s: 'telecom-day', k: 'field', r: 'g', m: 5, d: 17,
    ar: 'اليوم العالمي للاتصالات ومجتمع المعلومات', en: 'World Telecommunication and Information Society Day',
    da: 'يناقش أثر الاتصال والتقنية في التنمية وتقليص الفجوة الرقمية.',
    de: 'Explores the impact of connectivity and technology on development and the digital divide.',
    ia: 'شاركوا مؤشرات التحول الرقمي في جهتكم أو قدّموا ورشة عن الأمن السيبراني للموظفين.',
    ie: 'Share your digital-transformation indicators or give staff a cybersecurity workshop.',
    icon: '📡', color: '#356eab', src: ['International Telecommunication Union', 'https://www.itu.int/wtisd/'], sec: 'corp',
    f: 'technology:3 energy:1 education:1', a: 'professionals:3 employees:2 youth:2', u: 'awareness:2 event:2 internal:2',
  },
  {
    s: 'museum-day', k: 'field', r: 'g', m: 5, d: 18,
    ar: 'اليوم العالمي للمتاحف', en: 'International Museum Day',
    da: 'يوم لإبراز دور المتاحف في نشر الثقافة والتعليم والتبادل بين الشعوب.',
    de: 'A day highlighting museums’ role in culture, education and exchange between peoples.',
    ia: 'نظّموا زيارة جماعية لمتحف محلي أو شاركوا صورًا ومقتنيات تعبّر عن تاريخ جهتكم.',
    ie: 'Arrange a group visit to a local museum or share objects and photos from your organisation’s history.',
    icon: '🖼️', color: '#8b684a', src: ['International Council of Museums', 'https://icom.museum/en/'], sec: 'civic',
    f: 'culture:3 tourism:3 education:2', a: 'general:2 families:2 youth:2', u: 'event:2 awareness:2 marketing:2',
  },
  {
    s: 'cultural-diversity-day', k: 'international', r: 'g', m: 5, d: 21,
    ar: 'اليوم العالمي للتنوع الثقافي من أجل الحوار والتنمية', en: 'World Day for Cultural Diversity for Dialogue and Development',
    da: 'يوم لتعزيز التفاهم بين الثقافات وقيمة التنوع في المجتمعات.',
    de: 'A day promoting understanding between cultures and the value of diversity in societies.',
    ia: 'قدّموا ركنًا للتعريف بثقافات الزملاء من جنسيات مختلفة داخل بيئة العمل.',
    ie: 'Set up a corner introducing the cultures of colleagues from different nationalities.',
    icon: '🌍', color: '#6a57c2', src: [UN, 'https://www.un.org/en/observances/cultural-diversity-day'], sec: 'corp',
    f: 'culture:3 hr:3 tourism:1', a: 'employees:3 general:2', u: 'internal:3 event:2',
  },
  {
    s: 'biodiversity-day', k: 'international', r: 'g', m: 5, d: 22,
    ar: 'اليوم الدولي للتنوع البيولوجي', en: 'International Day for Biological Diversity',
    da: 'يوم للتوعية بأهمية التنوع الحيوي وحماية الكائنات والموائل الطبيعية.',
    de: 'A day raising awareness of biodiversity and the protection of species and natural habitats.',
    ia: 'عرّفوا بالكائنات والمحميات في بلادنا في منشورات مصورة، وادعموا مبادرة حماية محلية.',
    ie: 'Introduce local species and reserves in illustrated posts and support a local conservation initiative.',
    icon: '🦌', color: '#4c8652', src: [UN, 'https://www.un.org/en/observances/biological-diversity-day'], sec: 'gov',
    f: 'environment:3 tourism:2', a: 'general:2 children:2 youth:2', u: 'awareness:3 csr:2',
  },
  {
    s: 'environment-day', k: 'international', r: 'g', m: 6, d: 5,
    ar: 'يوم البيئة العالمي', en: 'World Environment Day',
    da: 'أكبر منصة عالمية للتوعية البيئية والعمل الجماعي من أجل الطبيعة.',
    de: 'The largest global platform for environmental awareness and collective action for nature.',
    ia: 'أطلقوا يوم عمل بيئي: تنظيف أو تشجير أو فرز نفايات، وانشروا حصيلة الأثر.',
    ie: 'Run an environmental action day: clean-up, planting or waste sorting, and publish the impact.',
    icon: '🌱', color: '#448c4c', src: ['UN Environment Programme', 'https://www.worldenvironmentday.global/'], sec: 'gov',
    f: 'environment:3 energy:2 real_estate:1', a: 'general:2 families:2 youth:2 employees:2', u: 'awareness:3 csr:3 event:2 marketing:2',
  },
  {
    s: 'food-safety-day', k: 'field', r: 'g', m: 6, d: 7,
    ar: 'اليوم العالمي لسلامة الأغذية', en: 'World Food Safety Day',
    da: 'يوم للتوعية بسلامة الغذاء وسلسلة إمداده من المزرعة إلى المائدة.',
    de: 'A day raising awareness of food safety across the supply chain, from farm to table.',
    ia: 'شاركوا معايير النظافة وسلامة الغذاء لديكم، وأطلعوا العملاء على شهاداتكم.',
    ie: 'Share your hygiene and food-safety standards and show customers your certifications.',
    icon: '🥗', color: '#3c8a74', src: [WHO, 'https://www.who.int/campaigns/world-food-safety-day'], sec: 'corp',
    f: 'food_hospitality:3 health:3 retail:2', a: 'customers:3 general:2 professionals:2', u: 'awareness:3 marketing:2',
  },
  {
    s: 'oceans-day', k: 'international', r: 'g', m: 6, d: 8,
    ar: 'اليوم العالمي للمحيطات', en: 'World Oceans Day',
    da: 'يربط حماية المحيطات بالاستدامة والسياحة والتعليم البيئي.',
    de: 'Connects ocean protection with sustainability, tourism and environmental education.',
    ia: 'نظّموا حملة تنظيف شاطئ بمشاركة الموظفين أو انشروا معلومات عن الشعاب المرجانية في البحر الأحمر.',
    ie: 'Run a beach clean-up with staff or share facts about Red Sea coral reefs.',
    icon: '🌊', color: '#237fa0', src: [UN, 'https://www.un.org/en/observances/oceans-day'], sec: 'gov',
    f: 'environment:3 tourism:3 education:1', a: 'families:2 general:2 youth:2', u: 'awareness:3 csr:3 event:2',
  },
  {
    s: 'blood-donor-day', k: 'field', r: 'g', m: 6, d: 14,
    ar: 'اليوم العالمي للتبرع بالدم', en: 'World Blood Donor Day',
    da: 'يوم لشكر المتبرعين بالدم والتوعية بأهمية التبرع المنتظم.',
    de: 'A day to thank blood donors and promote regular donation.',
    ia: 'نسّقوا حملة تبرع بالدم داخل مقركم بالتعاون مع بنك الدم وشجعوا الموظفين على المشاركة.',
    ie: 'Coordinate an on-site blood drive with a blood bank and encourage staff to take part.',
    icon: '🩸', color: '#b4413c', src: [WHO, 'https://www.who.int/campaigns/world-blood-donor-day'], sec: 'social',
    f: 'health:3 hr:2', a: 'employees:3 general:3 youth:2', u: 'csr:3 event:3 awareness:2',
  },
  {
    s: 'remittances-day', k: 'field', r: 'g', m: 6, d: 16,
    ar: 'اليوم الدولي للتحويلات الأسرية', en: 'International Day of Family Remittances',
    da: 'يوم يُبرز مساهمة العاملين المغتربين في دعم أسرهم واقتصادات بلدانهم.',
    de: 'A day recognising how migrant workers support their families and their home economies.',
    ia: 'عرّفوا عملاءكم بخدمات التحويل الآمنة والسريعة ورسومها بوضوح.',
    ie: 'Introduce customers to your fast, secure transfer services with clear fees.',
    icon: '💸', color: '#336e88', src: [UN, UN_INDEX], sec: 'comm',
    f: 'finance:3 hr:1', a: 'customers:3 employees:2', u: 'marketing:3 awareness:2',
  },
  {
    s: 'yoga-day', k: 'international', r: 'g', m: 6, d: 21,
    ar: 'اليوم الدولي لليوغا', en: 'International Day of Yoga',
    da: 'يوم للتوعية بفوائد اليوغا والنشاط البدني للصحة النفسية والجسدية.',
    de: 'A day raising awareness of the physical and mental benefits of yoga and exercise.',
    ia: 'نظّموا حصة استرخاء وتمدد قصيرة للموظفين أثناء الاستراحة.',
    ie: 'Hold a short stretching and relaxation session for staff during a break.',
    icon: '🧘', color: '#4f8d78', src: [UN, 'https://www.un.org/en/observances/yoga-day'], sec: 'corp',
    f: 'sports:3 health:2 hr:2', a: 'employees:3 general:2', u: 'internal:3 event:2',
  },
  {
    s: 'public-service-day', k: 'international', r: 'g', m: 6, d: 23,
    ar: 'اليوم العالمي للخدمة العامة', en: 'United Nations Public Service Day',
    da: 'يوم لتقدير العاملين في الخدمة العامة ودورهم في خدمة المجتمع.',
    de: 'A day honouring public servants and their contribution to serving society.',
    ia: 'كرّموا موظفي الخطوط الأمامية وأبرزوا إنجازات خدمة المستفيدين خلال العام.',
    ie: 'Recognise frontline staff and highlight service achievements for beneficiaries over the year.',
    icon: '🏢', color: '#356eab', src: [UN, UN_INDEX], sec: 'gov',
    f: 'hr:3 technology:1', a: 'employees:3 professionals:2 general:1', u: 'internal:3 awareness:2',
  },
  {
    s: 'seafarer-day', k: 'field', r: 'g', m: 6, d: 25,
    ar: 'يوم البحّار', en: 'Day of the Seafarer',
    da: 'يوم تنظمه المنظمة البحرية الدولية لتقدير العاملين في النقل البحري.',
    de: 'A day set by the International Maritime Organization to honour those working in maritime transport.',
    ia: 'قدّموا شكرًا مصورًا لأطقم الشحن والموانئ والعاملين في سلاسل الإمداد.',
    ie: 'Share a photo tribute to shipping crews, port workers and supply-chain staff.',
    icon: '⚓', color: '#237fa0', src: ['International Maritime Organization', 'https://www.imo.org'], sec: 'corp',
    f: 'logistics:3 hr:2', a: 'employees:3 professionals:3', u: 'internal:3 marketing:2',
  },
  {
    s: 'msme-day', k: 'field', r: 'g', m: 6, d: 27,
    ar: 'اليوم العالمي للمنشآت الصغيرة والمتوسطة', en: 'Micro-, Small and Medium-sized Enterprises Day',
    da: 'يوم يبرز دور المنشآت الصغيرة والمتوسطة في النمو وتوفير الوظائف.',
    de: 'A day highlighting the role of micro, small and medium enterprises in growth and job creation.',
    ia: 'أعلنوا عن برنامج دعم أو تمويل لرواد الأعمال، أو اعرضوا قصة نجاح لمنشأة ناشئة.',
    ie: 'Announce a support or financing programme for entrepreneurs, or feature a start-up success story.',
    icon: '🏪', color: '#b46c37', src: [UN, UN_INDEX], sec: 'corp',
    f: 'finance:3 retail:3 technology:1', a: 'professionals:3 customers:2 youth:2', u: 'marketing:3 event:2',
  },
  {
    s: 'youth-skills-day', k: 'international', r: 'g', m: 7, d: 15,
    ar: 'اليوم العالمي لمهارات الشباب', en: 'World Youth Skills Day',
    da: 'يوم لتأهيل الشباب بالمهارات اللازمة للعمل وريادة الأعمال.',
    de: 'A day promoting the skills young people need for work and entrepreneurship.',
    ia: 'أعلنوا عن برنامج تدريب تعاوني أو فرص تدريب صيفي للشباب.',
    ie: 'Announce a co-op training programme or summer internships for young people.',
    icon: '🛠️', color: '#6a57c2', src: [UN, UN_INDEX], sec: 'corp',
    f: 'hr:3 education:3 technology:2', a: 'youth:3 professionals:2', u: 'marketing:2 csr:3 event:2',
  },
  {
    s: 'breastfeeding-week', k: 'field', r: 'g', m: 8, d: 1, n: 7,
    ar: 'الأسبوع العالمي للرضاعة الطبيعية', en: 'World Breastfeeding Week',
    da: 'أسبوع للتوعية بفوائد الرضاعة الطبيعية ودعم الأمهات.',
    de: 'A week raising awareness of the benefits of breastfeeding and supporting mothers.',
    ia: 'عرّفوا بالمرافق الداعمة للأمهات في جهتكم، وانشروا نصائح من مختصين.',
    ie: 'Showcase your mother-friendly facilities and share tips from specialists.',
    icon: '🍼', color: '#a84d7b', src: [WHO, 'https://www.who.int/campaigns/world-breastfeeding-week'], sec: 'social',
    f: 'health:3 hr:2', a: 'women:3 families:3 employees:2', u: 'awareness:3 internal:2',
  },
  {
    s: 'youth-day', k: 'international', r: 'g', m: 8, d: 12,
    ar: 'اليوم الدولي للشباب', en: 'International Youth Day',
    da: 'مساحة لإشراك الشباب وإبراز مبادراتهم وأفكارهم وطموحاتهم.',
    de: 'A platform to engage young people and spotlight their initiatives, ideas and ambitions.',
    ia: 'أتيحوا منصتكم لشاب أو شابة يعرض مشروعه، وأعلنوا عن فرص تدريب أو توظيف.',
    ie: 'Hand your platform to a young person to present their project, and announce training or job openings.',
    icon: '🚀', color: '#6a57c2', src: [UN, 'https://www.un.org/en/observances/youth-day'], sec: 'corp',
    f: 'education:2 sports:2 technology:2 hr:2 culture:1', a: 'youth:3 professionals:1', u: 'marketing:3 event:2 csr:2',
  },
  {
    s: 'humanitarian-day', k: 'international', r: 'g', m: 8, d: 19,
    ar: 'اليوم العالمي للعمل الإنساني', en: 'World Humanitarian Day',
    da: 'يوم لتكريم العاملين في المجال الإنساني ودعم المتضررين حول العالم.',
    de: 'A day honouring humanitarian workers and supporting those affected around the world.',
    ia: 'أطلقوا حملة تبرع أو تطوع بالتعاون مع جهة إغاثية معتمدة، وسلّطوا الضوء على قصص العاملين.',
    ie: 'Launch a donation or volunteering drive with an accredited relief body and spotlight aid workers’ stories.',
    icon: '🤝', color: '#b4413c', src: [UN, 'https://www.un.org/en/observances/humanitarian-day'], sec: 'social',
    f: 'hr:1 health:1', a: 'general:3 employees:2', u: 'csr:3 awareness:2 event:1',
  },
  {
    s: 'charity-day', k: 'international', r: 'g', m: 9, d: 5,
    ar: 'اليوم الدولي للعمل الخيري', en: 'International Day of Charity',
    da: 'يوم لتشجيع العمل الخيري والتضامن المجتمعي.',
    de: 'A day encouraging charitable work and community solidarity.',
    ia: 'اعرضوا حصيلة مبادراتكم الخيرية للعام وادعوا الموظفين لمبادرة تطوع جديدة.',
    ie: 'Present this year’s charitable results and invite staff to a new volunteering initiative.',
    icon: '💝', color: '#b4413c', src: [UN, 'https://www.un.org/en/observances/charity-day'], sec: 'social',
    f: 'finance:2 hr:1', a: 'general:3 employees:2', u: 'csr:3 awareness:2',
  },
  {
    s: 'literacy-day', k: 'international', r: 'g', m: 9, d: 8,
    ar: 'اليوم الدولي لمحو الأمية', en: 'International Literacy Day',
    da: 'يدعم مبادرات القراءة والتعلم وإتاحة المعرفة لجميع فئات المجتمع.',
    de: 'Supports reading, learning and access-to-knowledge initiatives for all communities.',
    ia: 'أطلقوا مبادرة قراءة أو تبرع بالكتب للمدارس والمكتبات العامة.',
    ie: 'Start a reading drive or donate books to schools and public libraries.',
    icon: '✏️', color: '#8b684a', src: [UNESCO, 'https://www.unesco.org/en/days/literacy'], sec: 'social',
    f: 'education:3 culture:2', a: 'children:3 families:2 youth:2', u: 'csr:3 awareness:2 event:2',
  },
  {
    s: 'ozone-day', k: 'international', r: 'g', m: 9, d: 16,
    ar: 'اليوم الدولي لحفظ طبقة الأوزون', en: 'International Day for the Preservation of the Ozone Layer',
    da: 'يوم للتوعية بحماية طبقة الأوزون وأهمية التخلص من المواد المستنزفة لها.',
    de: 'A day raising awareness of protecting the ozone layer and phasing out ozone-depleting substances.',
    ia: 'اعرضوا إجراءاتكم في كفاءة التبريد وخفض الانبعاثات ضمن منشور توعوي موجز.',
    ie: 'Present your cooling-efficiency and emissions measures in a short awareness post.',
    icon: '🛡️', color: '#237fa0', src: [UN, 'https://www.un.org/en/observances/ozone-day'], sec: 'gov',
    f: 'environment:3 energy:3 real_estate:2', a: 'professionals:2 general:2', u: 'awareness:3 csr:2',
  },
  {
    s: 'tourism-day', k: 'international', r: 'g', m: 9, d: 27,
    ar: 'يوم السياحة العالمي', en: 'World Tourism Day',
    da: 'يبرز القيمة الاجتماعية والثقافية والاقتصادية للسياحة وتجارب الوجهات.',
    de: 'Highlights the social, cultural and economic value of tourism and destination experiences.',
    ia: 'روّجوا لوجهة أو تجربة سياحية محلية بصور وعروض خاصة للعائلات.',
    ie: 'Promote a local destination or experience with photos and special family offers.',
    icon: '🗺️', color: '#b46c37', src: ['UN Tourism', 'https://www.unwto.org/world-tourism-day'], sec: 'comm',
    f: 'tourism:3 food_hospitality:3 culture:2 logistics:2 environment:1', a: 'families:3 customers:3 general:2', u: 'marketing:3 event:2 awareness:2',
  },
  {
    s: 'heart-day', k: 'field', r: 'g', m: 9, d: 29,
    ar: 'اليوم العالمي للقلب', en: 'World Heart Day',
    da: 'يوم للتوعية بأمراض القلب والوقاية منها بنمط حياة صحي.',
    de: 'A day raising awareness of heart disease and its prevention through a healthy lifestyle.',
    ia: 'نظّموا قياس ضغط وسكر مجاني للموظفين، وانشروا نصائح للنشاط البدني والتغذية.',
    ie: 'Offer free blood-pressure and glucose checks for staff and share activity and nutrition tips.',
    icon: '❤️', color: '#b4413c', src: ['World Heart Federation', 'https://world-heart-federation.org/world-heart-day/'], sec: 'civic',
    f: 'health:3 sports:1', a: 'employees:3 general:2 elderly:2', u: 'awareness:3 internal:2 event:2',
  },
  {
    s: 'older-persons-day', k: 'international', r: 'g', m: 10, d: 1,
    ar: 'اليوم الدولي لكبار السن', en: 'International Day of Older Persons',
    da: 'يوم لتكريم كبار السن والتوعية بحقوقهم واحتياجاتهم.',
    de: 'A day honouring older persons and raising awareness of their rights and needs.',
    ia: 'كرّموا المتقاعدين وكبار العملاء، أو أطلقوا خدمة مخصصة لهم.',
    ie: 'Honour retirees and senior customers, or launch a service tailored to them.',
    icon: '👴', color: '#8b684a', src: [UN, 'https://www.un.org/en/observances/older-persons-day'], sec: 'social',
    f: 'health:2 hr:1', a: 'elderly:3 families:2 general:1', u: 'csr:3 awareness:2 event:1',
  },
  {
    s: 'teachers-day', k: 'international', r: 'g', m: 10, d: 5,
    ar: 'اليوم العالمي للمعلم', en: 'World Teachers’ Day',
    da: 'يوم لتقدير المعلمين ودورهم في بناء الأجيال.',
    de: 'A day recognising teachers and their role in shaping generations.',
    ia: 'وجّهوا رسالة شكر للمعلمين وقدّموا عروضًا أو خدمات خاصة بهم.',
    ie: 'Send teachers a thank-you message and offer them special services or discounts.',
    icon: '🍎', color: '#5268c5', src: [UNESCO, UNESCO_INDEX], sec: 'civic',
    f: 'education:3', a: 'professionals:3 general:2 youth:1', u: 'marketing:2 csr:2 awareness:2',
  },
  {
    s: 'mental-health-day', k: 'field', r: 'g', m: 10, d: 10,
    ar: 'اليوم العالمي للصحة النفسية', en: 'World Mental Health Day',
    da: 'يوفر مدخلًا للتوعية بالصحة النفسية والرفاه في المجتمع وبيئة العمل.',
    de: 'Creates an entry point for mental-health and wellbeing awareness in communities and workplaces.',
    ia: 'قدّموا جلسة توعية عن ضغوط العمل، وعرّفوا الموظفين بخدمات الدعم النفسي المتاحة.',
    ie: 'Hold a session on work stress and tell staff about the mental-health support available.',
    icon: '🧠', color: '#4f8d78', src: [WHO, 'https://www.who.int/campaigns/world-mental-health-day'], sec: 'civic',
    f: 'health:3 hr:3', a: 'employees:3 families:2 youth:2', u: 'awareness:3 internal:3 event:2',
  },
  {
    s: 'girl-child-day', k: 'international', r: 'g', m: 10, d: 11,
    ar: 'اليوم الدولي للفتاة', en: 'International Day of the Girl Child',
    da: 'يوم للتوعية بحقوق الفتيات وتمكينهن في التعليم والمهارات.',
    de: 'A day raising awareness of girls’ rights and their empowerment through education and skills.',
    ia: 'ادعموا مبادرة تعليمية أو تدريبية للفتيات، وشاركوا قصص نجاح ملهمة.',
    ie: 'Support an education or training initiative for girls and share inspiring success stories.',
    icon: '👧', color: '#a84d7b', src: [UN, UN_INDEX], sec: 'social',
    f: 'education:3', a: 'women:3 children:3 families:2', u: 'csr:3 awareness:2',
  },
  {
    s: 'world-food-day', k: 'field', r: 'g', m: 10, d: 16,
    ar: 'اليوم العالمي للأغذية', en: 'World Food Day',
    da: 'يوم لتعزيز الأمن الغذائي والتغذية السليمة والحد من الهدر.',
    de: 'A day promoting food security, good nutrition and reduced food waste.',
    ia: 'أطلقوا مبادرة لحفظ النعمة أو توزيع وجبات فائضة بالتعاون مع جمعية معتمدة.',
    ie: 'Start a food-saving drive or redistribute surplus meals through an accredited charity.',
    icon: '🍽️', color: '#c2893a', src: ['Food and Agriculture Organization', 'https://www.fao.org/world-food-day/'], sec: 'corp',
    f: 'food_hospitality:3 retail:2 environment:2 health:1', a: 'general:2 families:2 customers:2', u: 'csr:3 awareness:2 marketing:2',
  },
  {
    s: 'cities-day', k: 'field', r: 'g', m: 10, d: 31,
    ar: 'اليوم العالمي للمدن', en: 'World Cities Day',
    da: 'يوم لتعزيز التخطيط الحضري المستدام وجودة الحياة في المدن.',
    de: 'A day promoting sustainable urban planning and quality of life in cities.',
    ia: 'اعرضوا مشاريعكم العمرانية أو حلولكم الذكية التي تحسّن الحياة في المدينة.',
    ie: 'Showcase your development projects or smart solutions that improve city life.',
    icon: '🏙️', color: '#356eab', src: [UN, 'https://www.un.org/en/observances/cities-day'], sec: 'gov',
    f: 'real_estate:3 environment:2 technology:2 logistics:1', a: 'professionals:3 general:2', u: 'marketing:2 awareness:2 event:2',
  },
  {
    s: 'diabetes-day', k: 'field', r: 'g', m: 11, d: 14,
    ar: 'اليوم العالمي للسكري', en: 'World Diabetes Day',
    da: 'يوم للتوعية بمرض السكري والوقاية منه ودعم المصابين.',
    de: 'A day raising awareness of diabetes, its prevention and support for people living with it.',
    ia: 'قدّموا فحص سكر مجاني للموظفين وانشروا وصفات ونصائح غذائية صحية.',
    ie: 'Offer free glucose checks for staff and share healthy recipes and nutrition tips.',
    icon: '🩸', color: '#356eab', src: [UN, 'https://www.un.org/en/observances/diabetes-day'], sec: 'civic',
    f: 'health:3 food_hospitality:1', a: 'general:2 employees:3 families:2', u: 'awareness:3 internal:2 csr:2',
  },
  {
    s: 'children-day', k: 'international', r: 'g', m: 11, d: 20,
    ar: 'اليوم العالمي للطفل', en: 'World Children’s Day',
    da: 'مناسبة لإشراك الأطفال والعائلات والتوعية بحقوق الطفل ورفاهه.',
    de: 'An occasion to engage children and families and raise awareness of children’s rights and wellbeing.',
    ia: 'نظّموا فعالية للأطفال أو يومًا مفتوحًا لأبناء الموظفين، أو أطلقوا مبادرة دعم للأطفال.',
    ie: 'Hold an event for children or an open day for staff kids, or launch a children’s support initiative.',
    icon: '🧩', color: '#d17d35', src: ['UNICEF', 'https://www.unicef.org/world-childrens-day'], sec: 'social',
    f: 'education:2 health:2 culture:1 tourism:1', a: 'children:3 families:3', u: 'csr:3 event:3 awareness:2',
  },
  {
    s: 'aids-day', k: 'field', r: 'g', m: 12, d: 1,
    ar: 'اليوم العالمي للإيدز', en: 'World AIDS Day',
    da: 'يوم للتوعية بفيروس نقص المناعة البشرية ودعم المتعايشين معه ومكافحة الوصم.',
    de: 'A day raising awareness of HIV, supporting people living with it and fighting stigma.',
    ia: 'انشروا معلومات علمية موثوقة تصحح المفاهيم الخاطئة، دون محتوى تسويقي.',
    ie: 'Share reliable scientific information that corrects misconceptions, with no marketing content.',
    icon: '🎗️', color: '#b4413c', src: [WHO, 'https://www.who.int/campaigns/world-aids-day'], sec: 'social',
    f: 'health:3', a: 'general:3 youth:2 professionals:2', u: 'awareness:3',
  },
  {
    s: 'disability-day', k: 'international', r: 'g', m: 12, d: 3,
    ar: 'اليوم الدولي للأشخاص ذوي الإعاقة', en: 'International Day of Persons with Disabilities',
    da: 'يدعم الوعي بالإتاحة والدمج والمشاركة الكاملة للأشخاص ذوي الإعاقة.',
    de: 'Supports awareness of accessibility, inclusion and full participation for persons with disabilities.',
    ia: 'اعرضوا تسهيلات الإتاحة في مقركم ومنصاتكم، وأعلنوا عن فرص توظيف دامجة.',
    ie: 'Present the accessibility features of your premises and platforms and announce inclusive job openings.',
    icon: '♿', color: '#626aa1', src: [UN, 'https://www.un.org/en/observances/day-of-persons-with-disabilities'], sec: 'social',
    f: 'hr:3 health:2 education:2 technology:1', a: 'disability:3 employees:2 general:1', u: 'awareness:3 csr:3 internal:2',
  },
  {
    s: 'volunteer-day', k: 'international', r: 'g', m: 12, d: 5,
    ar: 'اليوم الدولي للتطوع', en: 'International Volunteer Day',
    da: 'يوم لتقدير المتطوعين وتشجيع العمل التطوعي.',
    de: 'A day recognising volunteers and encouraging volunteering.',
    ia: 'كرّموا المتطوعين من موظفيكم وأعلنوا عن فرص التطوع للعام القادم.',
    ie: 'Recognise staff volunteers and announce next year’s volunteering opportunities.',
    icon: '🙌', color: '#4f8d78', src: [UN, 'https://www.un.org/en/observances/volunteer-day'], sec: 'social',
    f: 'hr:2', a: 'youth:3 employees:3 general:2', u: 'csr:3 internal:3 event:2',
  },
  {
    s: 'civil-aviation-day', k: 'field', r: 'g', m: 12, d: 7,
    ar: 'اليوم العالمي للطيران المدني', en: 'International Civil Aviation Day',
    da: 'يوم لإبراز دور الطيران المدني في الربط والتنمية الاقتصادية.',
    de: 'A day highlighting civil aviation’s role in connectivity and economic development.',
    ia: 'شاركوا أرقام الرحلات والوجهات ومبادرات خدمة المسافرين، وكرّموا فرق التشغيل.',
    ie: 'Share flight and destination figures and passenger-service initiatives, and thank operations teams.',
    icon: '✈️', color: '#356eab', src: [UN, 'https://www.un.org/en/observances/civil-aviation-day'], sec: 'corp',
    f: 'logistics:3 tourism:3', a: 'customers:2 employees:2 professionals:2', u: 'marketing:2 internal:2',
  },
  {
    s: 'anti-corruption-day', k: 'international', r: 'g', m: 12, d: 9,
    ar: 'اليوم الدولي لمكافحة الفساد', en: 'International Anti-Corruption Day',
    da: 'يوم لتعزيز النزاهة والشفافية والتوعية بمخاطر الفساد.',
    de: 'A day promoting integrity, transparency and awareness of the risks of corruption.',
    ia: 'ذكّروا الموظفين بسياسة النزاهة وقنوات الإبلاغ الآمنة لديكم.',
    ie: 'Remind staff of your integrity policy and your safe reporting channels.',
    icon: '⚖️', color: '#626aa1', src: [UN, 'https://www.un.org/en/observances/anti-corruption-day'], sec: 'gov',
    f: 'finance:2 hr:2', a: 'employees:3 professionals:2', u: 'internal:3 awareness:3',
  },
  {
    s: 'arabic-language-day', k: 'international', r: 'g', m: 12, d: 18,
    ar: 'اليوم العالمي للغة العربية', en: 'World Arabic Language Day',
    da: 'يوم للاحتفاء باللغة العربية ومكانتها بين لغات العالم.',
    de: 'A day celebrating the Arabic language and its standing among the world’s languages.',
    ia: 'انشروا سلسلة عن كلمات عربية جميلة بخط مميز، أو نظّموا مسابقة لغوية للموظفين.',
    ie: 'Post a series of beautiful Arabic words in fine calligraphy, or run a language quiz for staff.',
    icon: '✒️', color: '#8b684a', src: [UNESCO, UNESCO_INDEX], sec: 'civic',
    f: 'culture:3 education:3', a: 'general:3 youth:2 children:2', u: 'marketing:3 awareness:3 event:2',
  },
  {
    s: 'clean-energy-day', k: 'field', r: 'g', m: 1, d: 26,
    ar: 'اليوم الدولي للطاقة النظيفة', en: 'International Day of Clean Energy',
    da: 'يوم للتوعية بأهمية الطاقة النظيفة والانتقال العادل نحو مصادر مستدامة.',
    de: 'A day raising awareness of clean energy and a just transition to sustainable sources.',
    ia: 'اعرضوا مبادراتكم في كفاءة الطاقة أو الطاقة المتجددة بأرقام واضحة.',
    ie: 'Present your energy-efficiency or renewable initiatives with clear figures.',
    icon: '⚡', color: '#d18428', src: [UN, UN_INDEX], sec: 'corp',
    f: 'energy:3 environment:3 technology:1', a: 'professionals:3 general:1', u: 'awareness:3 marketing:2',
  },

  // ───────────── Commercial seasons ─────────────
  {
    s: 'year-end', k: 'commercial', r: 'g', m: 12, d: 31,
    ar: 'نهاية العام وملخص الإنجازات', en: 'Year End and Annual Review',
    da: 'موسم لاستعراض إنجازات العام وشكر العملاء والشركاء والتخطيط للعام الجديد.',
    de: 'A season to review the year’s achievements, thank customers and partners and plan the new year.',
    ia: 'أصدروا ملخصًا مصورًا لإنجازات العام مع شكر للعملاء وعرض ختامي.',
    ie: 'Publish an illustrated year-in-review with thanks to customers and a closing offer.',
    icon: '🎆', color: '#6d3df5', src: null, sec: 'comm',
    f: 'finance:3 retail:3 hr:2', a: 'customers:3 employees:2 general:1', u: 'marketing:3 internal:3', prep: 30,
  },
  {
    s: 'white-friday', k: 'commercial', r: 'm', m: 11,
    ar: 'الجمعة البيضاء', en: 'White Friday',
    da: 'موسم التخفيضات الكبرى في المملكة، ويقع في آخر جمعة من نوفمبر.',
    de: 'The Kingdom’s main sales season, falling on the last Friday of November.',
    ia: 'أعلنوا عن عروضكم قبل الموعد بأسبوعين مع عدّاد تنازلي، وجهّزوا خدمة العملاء لضغط الطلبات.',
    ie: 'Announce offers two weeks ahead with a countdown and prepare customer service for the order surge.',
    icon: '🏷️', color: '#1f1f2e', src: null, sec: 'comm',
    f: 'retail:3 finance:2 logistics:2 technology:1', a: 'customers:3 general:2', u: 'marketing:3', prep: 30,
    occ: [['2026', '2026-11-27', 'confirmed'], ['2027', '2027-11-26', 'confirmed']],
  },
  {
    s: 'back-to-school', k: 'commercial', r: 'm',
    ar: 'موسم العودة للمدارس', en: 'Back to School Season',
    da: 'موسم تتحدد مواعيده سنويًا بحسب التقويم الدراسي المعتمد، ويرتبط بالقرطاسية والملابس والخدمات التعليمية.',
    de: 'A season whose dates follow the official school calendar each year, linked to stationery, clothing and education services.',
    ia: 'أطلقوا عروضًا للأسر وحزم احتياجات المدرسة، وقدّموا قائمة تحضير مفيدة لأولياء الأمور.',
    ie: 'Launch family offers and school-supply bundles and share a helpful preparation checklist for parents.',
    icon: '🎒', color: '#d17d35', src: null, sec: 'comm',
    f: 'retail:3 education:3 finance:1', a: 'families:3 children:3 customers:3', u: 'marketing:3', prep: 30,
  },
  {
    s: 'riyadh-season', k: 'commercial', r: 'm',
    ar: 'انطلاق موسم الرياض', en: 'Riyadh Season Launch',
    da: 'موسم ترفيهي وسياحي كبير تُعلن مواعيده سنويًا، ويرفع الطلب على الضيافة والفعاليات والتجزئة.',
    de: 'A major entertainment and tourism season announced each year, lifting demand for hospitality, events and retail.',
    ia: 'اربطوا عروضكم أو فعالياتكم بالموسم، وجهّزوا محتوى للزوار عن الخدمات القريبة منكم.',
    ie: 'Tie your offers or events to the season and prepare content for visitors about nearby services.',
    icon: '🎡', color: '#a84d7b', src: null, sec: 'comm',
    f: 'tourism:3 food_hospitality:3 retail:2 logistics:1', a: 'families:3 youth:3 customers:3', u: 'marketing:3 event:3', prep: 30,
  },
  {
    s: 'summer-vacation-start', k: 'commercial', r: 'm',
    ar: 'بداية الإجازة الصيفية', en: 'Summer Vacation Start',
    da: 'موسم سفر وترفيه تتحدد بدايته سنويًا بحسب التقويم الدراسي.',
    de: 'A travel and leisure season whose start follows the school calendar each year.',
    ia: 'روّجوا لباقات السفر والترفيه العائلي وفعاليات الصيف قبل بدء الإجازة.',
    ie: 'Promote travel packages, family leisure and summer activities before the holiday begins.',
    icon: '🏖️', color: '#2a7fa0', src: null, sec: 'comm',
    f: 'tourism:3 food_hospitality:2 logistics:3 retail:2', a: 'families:3 children:2 customers:3', u: 'marketing:3 event:2', prep: 30,
  },
];

// ───────────── Validation and expansion ─────────────

const DAYS_IN_MONTH = [31, 29, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]; // Feb allows 29

function fail(slug: string, msg: string): never {
  throw new Error(`Seed event "${slug}": ${msg}`);
}

function parseTags(
  slug: string,
  group: 'field' | 'audience' | 'use',
  spec: string,
): SeedEvent['tags'] {
  return spec
    .split(/\s+/)
    .filter(Boolean)
    .map((tok) => {
      const [key, w] = tok.split(':');
      return { group, key, weight: w === undefined ? 2 : Number(w) };
    });
}

/** Throws early on any inconsistent event; used by the seed and unit-tested. */
export function validateEvent(e: SeedEvent): void {
  const { slug } = e;
  const isInt = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n);
  if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) fail(slug, 'slug must be kebab-case');
  if (!isInt(e.durationDays) || e.durationDays < 1) fail(slug, 'durationDays must be >= 1');

  if (e.recurrence === 'gregorian_fixed') {
    if (!isInt(e.gMonth) || e.gMonth < 1 || e.gMonth > 12) fail(slug, 'gMonth must be 1-12');
    if (!isInt(e.gDay) || e.gDay < 1 || e.gDay > DAYS_IN_MONTH[e.gMonth - 1])
      fail(slug, `gDay out of range for month ${e.gMonth}`);
    if (e.hMonth != null || e.hDay != null) fail(slug, 'gregorian_fixed must not set hMonth/hDay');
  } else if (e.recurrence === 'hijri_fixed') {
    if (!isInt(e.hMonth) || e.hMonth < 1 || e.hMonth > 12) fail(slug, 'hMonth must be 1-12');
    if (!isInt(e.hDay) || e.hDay < 1 || e.hDay > 30) fail(slug, 'hDay must be 1-30');
    if (e.gMonth != null || e.gDay != null) fail(slug, 'hijri_fixed must not set gMonth/gDay');
  } else if (e.recurrence === 'annual_manual') {
    if (e.gMonth != null || e.gDay != null || e.hMonth != null || e.hDay != null)
      fail(slug, 'annual_manual must not set month/day fields');
  } else {
    fail(slug, `unknown recurrence ${String(e.recurrence)}`);
  }

  if (e.recurrence !== 'annual_manual' && e.occurrences.length > 0)
    fail(slug, 'only annual_manual events carry seeded occurrences');
  for (const o of e.occurrences) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(o.startDate) || Number.isNaN(Date.parse(o.startDate)))
      fail(slug, `bad occurrence date ${o.startDate}`);
    if (Number(o.startDate.slice(0, 4)) !== o.year) fail(slug, `occurrence ${o.startDate} not in year ${o.year}`);
  }

  if (e.tags.length === 0) fail(slug, 'no tags');
  const seen = new Set<string>();
  for (const t of e.tags) {
    if (!taxonomyKeys[t.group].has(t.key)) fail(slug, `unknown ${t.group} key "${t.key}"`);
    if (!isInt(t.weight) || t.weight < 1 || t.weight > 3) fail(slug, `weight of ${t.group}:${t.key} must be 1-3`);
    if (seen.has(`${t.group}:${t.key}`)) fail(slug, `duplicate tag ${t.group}:${t.key}`);
    seen.add(`${t.group}:${t.key}`);
  }
  if (!e.tags.some((t) => t.group === 'field') && e.kind !== 'national' && e.kind !== 'religious')
    fail(slug, 'needs at least one field tag unless national/religious');
  if (!e.contentIdeaAr || !e.contentIdeaEn) fail(slug, 'missing content idea');
  if (e.sourceUrl && !/^https:\/\//.test(e.sourceUrl)) fail(slug, 'sourceUrl must be https');
}

function toSeedEvent(d: Def): SeedEvent {
  const recurrence: Recurrence =
    d.r === 'g' ? 'gregorian_fixed' : d.r === 'h' ? 'hijri_fixed' : 'annual_manual';
  const sectorTags = Object.entries(SECTOR[d.sec]).map(([key, weight]) => ({
    group: 'sector' as const,
    key,
    weight,
  }));
  const ev: SeedEvent = {
    slug: d.s,
    kind: d.k,
    recurrence,
    gMonth: d.r === 'g' ? d.m : undefined,
    gDay: d.r === 'g' ? d.d : undefined,
    hMonth: d.r === 'h' ? d.m : undefined,
    hDay: d.r === 'h' ? d.d : undefined,
    durationDays: d.n ?? 1,
    titleAr: d.ar,
    titleEn: d.en,
    descriptionAr: d.da,
    descriptionEn: d.de,
    contentIdeaAr: d.ia,
    contentIdeaEn: d.ie,
    icon: d.icon,
    color: d.color,
    prepDays: d.prep ?? 14,
    sourceName: d.src ? d.src[0] : null,
    sourceUrl: d.src ? d.src[1] : null,
    tags: [
      ...sectorTags,
      ...parseTags(d.s, 'field', d.f),
      ...parseTags(d.s, 'audience', d.a),
      ...parseTags(d.s, 'use', d.u),
    ],
    occurrences: (d.occ ?? []).map(([y, startDate, status]) => ({
      year: Number(y),
      startDate,
      status,
    })),
  };
  validateEvent(ev);
  return ev;
}

export const eventsSeed: SeedEvent[] = DEFS.map(toSeedEvent);

{
  const slugs = new Set<string>();
  for (const e of eventsSeed) {
    if (slugs.has(e.slug)) throw new Error(`Seed event "${e.slug}": duplicate slug`);
    slugs.add(e.slug);
  }
}
