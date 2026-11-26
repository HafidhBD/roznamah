// Taxonomy terms (spec §6.1). Keys are stable; labels can be edited from the admin panel.
export type TaxonomyGroup = 'sector' | 'field' | 'audience' | 'use';

export interface TaxonomySeed {
  group: TaxonomyGroup;
  key: string;
  labelAr: string;
  labelEn: string;
}

type Row = [key: string, labelAr: string, labelEn: string];

const rows: Record<TaxonomyGroup, Row[]> = {
  sector: [
    ['government', 'حكومي', 'Government'],
    ['private', 'خاص', 'Private'],
    ['nonprofit', 'غير ربحي', 'Non-profit'],
    ['semi_government', 'شبه حكومي / شركات مملوكة للدولة', 'Semi-government / state-owned'],
  ],
  field: [
    ['health', 'الصحة', 'Health'],
    ['education', 'التعليم', 'Education'],
    ['environment', 'البيئة والاستدامة', 'Environment & sustainability'],
    ['culture', 'الثقافة والتراث', 'Culture & heritage'],
    ['tourism', 'السياحة والترفيه', 'Tourism & entertainment'],
    ['sports', 'الرياضة', 'Sports'],
    ['technology', 'التقنية والاتصالات', 'Technology & telecom'],
    ['finance', 'المالية والبنوك', 'Finance & banking'],
    ['retail', 'التجزئة والتجارة', 'Retail & trade'],
    ['energy', 'الطاقة والصناعة', 'Energy & industry'],
    ['real_estate', 'العقار والإنشاءات', 'Real estate & construction'],
    ['logistics', 'النقل والخدمات اللوجستية', 'Transport & logistics'],
    ['food_hospitality', 'الأغذية والضيافة', 'Food & hospitality'],
    ['hr', 'الموارد البشرية والعمل', 'HR & labour'],
  ],
  audience: [
    ['general', 'الجمهور العام', 'General public'],
    ['families', 'العائلات', 'Families'],
    ['children', 'الأطفال', 'Children'],
    ['youth', 'الشباب', 'Youth'],
    ['women', 'النساء', 'Women'],
    ['elderly', 'كبار السن', 'Older persons'],
    ['disability', 'ذوو الإعاقة', 'Persons with disabilities'],
    ['employees', 'الموظفون', 'Employees'],
    ['professionals', 'المختصون', 'Professionals'],
    ['customers', 'العملاء/المستهلكون', 'Customers / consumers'],
  ],
  use: [
    ['awareness', 'حملة توعوية', 'Awareness campaign'],
    ['marketing', 'محتوى تسويقي', 'Marketing content'],
    ['event', 'فعالية', 'Event'],
    ['internal', 'تواصل داخلي', 'Internal communication'],
    ['csr', 'مسؤولية اجتماعية', 'Social responsibility'],
  ],
};

export const taxonomySeed: (TaxonomySeed & { sort: number })[] = (
  Object.keys(rows) as TaxonomyGroup[]
).flatMap((group) =>
  rows[group].map(([key, labelAr, labelEn], i) => ({ group, key, labelAr, labelEn, sort: i })),
);

export const taxonomyKeys: Record<TaxonomyGroup, Set<string>> = {
  sector: new Set(rows.sector.map((r) => r[0])),
  field: new Set(rows.field.map((r) => r[0])),
  audience: new Set(rows.audience.map((r) => r[0])),
  use: new Set(rows.use.map((r) => r[0])),
};
