export type LabParamInput = 'number' | 'text';

export interface LabParamDef {
  id: string;
  name: string;
  unit: string;
  rangeLabel: string;
  rangeLow: number | null;
  rangeHigh: number | null;
  qualitativeNormal?: string;
  input: LabParamInput;
}

export interface LabTestDef {
  key: string;
  name: string;
  aliases: string[];
  specimen: string;
  method?: string;
  parameters: LabParamDef[];
}

function p(
  id: string,
  name: string,
  unit: string,
  rangeLabel: string,
  rangeLow: number | null,
  rangeHigh: number | null,
  extra?: Partial<Pick<LabParamDef, 'qualitativeNormal' | 'input'>>,
): LabParamDef {
  return {
    id,
    name,
    unit,
    rangeLabel,
    rangeLow,
    rangeHigh,
    input: extra?.input ?? (rangeLow != null || rangeHigh != null ? 'number' : 'text'),
    qualitativeNormal: extra?.qualitativeNormal,
  };
}

const CBC: LabTestDef = {
  key: 'cbc',
  name: 'CBC',
  aliases: ['complete blood count', 'blood cbc', 'haemogram'],
  specimen: 'EDTA whole blood',
  method: 'Automated hematology analyzer',
  parameters: [
    p('hb', 'Hemoglobin', 'g/dL', '12.0 – 16.0', 12, 16),
    p('hct', 'Hematocrit', '%', '36 – 50', 36, 50),
    p('rbc', 'RBC Count', '×10⁶/µL', '4.0 – 5.5', 4.0, 5.5),
    p('wbc', 'WBC Count', '×10³/µL', '4.0 – 11.0', 4.0, 11.0),
    p('plt', 'Platelets', '×10³/µL', '150 – 450', 150, 450),
    p('mcv', 'MCV', 'fL', '80 – 100', 80, 100),
    p('mch', 'MCH', 'pg', '27 – 33', 27, 33),
    p('mchc', 'MCHC', 'g/dL', '32 – 36', 32, 36),
    p('rdw', 'RDW', '%', '11.5 – 14.5', 11.5, 14.5),
    p('neut', 'Neutrophils', '%', '40 – 70', 40, 70),
    p('lymph', 'Lymphocytes', '%', '20 – 40', 20, 40),
    p('mono', 'Monocytes', '%', '2 – 8', 2, 8),
    p('eos', 'Eosinophils', '%', '1 – 6', 1, 6),
    p('baso', 'Basophils', '%', '0 – 1', 0, 1),
  ],
};

const LIPID: LabTestDef = {
  key: 'lipid',
  name: 'Lipid Profile',
  aliases: ['lipid', 'cholesterol', 'lipids'],
  specimen: 'Serum (fasting 9–12 hours preferred)',
  method: 'Enzymatic / calculated',
  parameters: [
    p('chol', 'Total Cholesterol', 'mg/dL', '< 200', 0, 199),
    p('trig', 'Triglycerides', 'mg/dL', '< 150', 0, 149),
    p('hdl', 'HDL Cholesterol', 'mg/dL', '≥ 40', 40, 100),
    p('ldl', 'LDL Cholesterol', 'mg/dL', '< 100', 0, 99),
    p('vldl', 'VLDL Cholesterol', 'mg/dL', '5 – 40', 5, 40),
    p('ratio', 'Chol / HDL Ratio', '', '< 5.0', 0, 4.9),
  ],
};

const LFT: LabTestDef = {
  key: 'lft',
  name: 'LFTs',
  aliases: ['liver function', 'lft', 'liver function test', 'hepatic'],
  specimen: 'Serum',
  method: 'Spectrophotometry',
  parameters: [
    p('bili-t', 'Bilirubin (Total)', 'mg/dL', '0.2 – 1.2', 0.2, 1.2),
    p('bili-d', 'Bilirubin (Direct)', 'mg/dL', '0.0 – 0.3', 0, 0.3),
    p('alt', 'SGPT (ALT)', 'U/L', '7 – 56', 7, 56),
    p('ast', 'SGOT (AST)', 'U/L', '10 – 40', 10, 40),
    p('alp', 'Alkaline Phosphatase', 'U/L', '44 – 147', 44, 147),
    p('ggt', 'GGT', 'U/L', '9 – 48', 9, 48),
    p('tp', 'Total Protein', 'g/dL', '6.0 – 8.3', 6.0, 8.3),
    p('alb', 'Albumin', 'g/dL', '3.5 – 5.5', 3.5, 5.5),
    p('glob', 'Globulin', 'g/dL', '2.0 – 3.5', 2.0, 3.5),
  ],
};

const KFT: LabTestDef = {
  key: 'kft',
  name: 'KFTs',
  aliases: ['kidney function', 'rft', 'renal function', 'kft'],
  specimen: 'Serum',
  method: 'Spectrophotometry / ISE',
  parameters: [
    p('urea', 'Urea', 'mg/dL', '15 – 40', 15, 40),
    p('crea', 'Creatinine', 'mg/dL', '0.6 – 1.3', 0.6, 1.3),
    p('uric', 'Uric Acid', 'mg/dL', '3.5 – 7.2', 3.5, 7.2),
    p('na', 'Sodium (Na⁺)', 'mmol/L', '135 – 145', 135, 145),
    p('k', 'Potassium (K⁺)', 'mmol/L', '3.5 – 5.1', 3.5, 5.1),
    p('cl', 'Chloride (Cl⁻)', 'mmol/L', '98 – 107', 98, 107),
    p('bun', 'BUN', 'mg/dL', '7 – 20', 7, 20),
  ],
};

const URINE_RE: LabTestDef = {
  key: 'urine-re',
  name: 'Urine R/E',
  aliases: ['urine routine', 'urine re', 'urine analysis'],
  specimen: 'Midstream urine',
  method: 'Dipstick + microscopy',
  parameters: [
    p('color', 'Color', '', 'Pale yellow', null, null, { qualitativeNormal: 'Pale yellow' }),
    p('app', 'Appearance', '', 'Clear', null, null, { qualitativeNormal: 'Clear' }),
    p('sg', 'Specific Gravity', '', '1.005 – 1.030', 1.005, 1.03),
    p('ph', 'pH', '', '5.0 – 7.5', 5, 7.5),
    p('prot', 'Protein', '', 'Negative / Trace', null, null, { qualitativeNormal: 'Negative' }),
    p('glu', 'Glucose', '', 'Negative', null, null, { qualitativeNormal: 'Negative' }),
    p('ket', 'Ketones', '', 'Negative', null, null, { qualitativeNormal: 'Negative' }),
    p('bili', 'Bilirubin', '', 'Negative', null, null, { qualitativeNormal: 'Negative' }),
    p('blood', 'Blood', '', 'Negative', null, null, { qualitativeNormal: 'Negative' }),
    p('leu', 'Leukocytes', '', 'Negative', null, null, { qualitativeNormal: 'Negative' }),
    p('nit', 'Nitrite', '', 'Negative', null, null, { qualitativeNormal: 'Negative' }),
    p('rbc-m', 'RBC (microscopy)', '/HPF', '0 – 2', 0, 2),
    p('wbc-m', 'WBC (microscopy)', '/HPF', '0 – 5', 0, 5),
    p('epi', 'Epithelial cells', '/HPF', '0 – 5', 0, 5),
  ],
};

export const LAB_TEST_CATALOG: LabTestDef[] = [
  CBC,
  {
    key: 'fbs',
    name: 'Blood Sugar (FBS)',
    aliases: ['fbs', 'fasting blood sugar', 'fasting glucose', 'blood sugar'],
    specimen: 'Plasma / serum (fasting 8–10 hours)',
    method: 'Hexokinase / GOD-POD',
    parameters: [
      p('fbs', 'Fasting Blood Glucose', 'mg/dL', '70 – 100', 70, 100),
    ],
  },
  {
    key: 'rbs',
    name: 'Blood Sugar (RBS)',
    aliases: ['rbs', 'random blood sugar', 'random glucose'],
    specimen: 'Plasma / serum',
    method: 'Hexokinase / GOD-POD',
    parameters: [
      p('rbs', 'Random Blood Glucose', 'mg/dL', '70 – 140', 70, 140),
    ],
  },
  {
    key: 'hba1c',
    name: 'HbA1c',
    aliases: ['hba1c', 'glycated hemoglobin', 'a1c'],
    specimen: 'EDTA whole blood',
    method: 'HPLC / immunoassay',
    parameters: [
      p('hba1c', 'HbA1c', '%', '4.0 – 5.6', 4.0, 5.6),
      p('eag', 'Estimated Avg Glucose', 'mg/dL', '70 – 114', 70, 114),
    ],
  },
  LIPID,
  LFT,
  KFT,
  URINE_RE,
  {
    key: 'urine-cs',
    name: 'Urine C/S',
    aliases: ['urine culture', 'urine cs'],
    specimen: 'Midstream urine (sterile)',
    method: 'Culture & sensitivity',
    parameters: [
      p('growth', 'Culture growth', '', 'No growth', null, null, { qualitativeNormal: 'No growth' }),
      p('org', 'Organism', '', '—', null, null),
      p('count', 'Colony count', 'CFU/mL', '< 10⁵', null, null),
      p('sens', 'Sensitivity', '', '—', null, null),
    ],
  },
  {
    key: 'tsh',
    name: 'Thyroid Profile (TSH)',
    aliases: ['tsh', 'thyroid stimulating hormone'],
    specimen: 'Serum',
    method: 'CLIA / ELISA',
    parameters: [
      p('tsh', 'TSH', 'µIU/mL', '0.4 – 4.0', 0.4, 4.0),
    ],
  },
  {
    key: 't3t4',
    name: 'Thyroid Profile (T3/T4)',
    aliases: ['t3', 't4', 'thyroid profile', 'tft'],
    specimen: 'Serum',
    method: 'CLIA / ELISA',
    parameters: [
      p('t3', 'Total T3', 'ng/dL', '80 – 200', 80, 200),
      p('t4', 'Total T4', 'µg/dL', '4.5 – 12.0', 4.5, 12.0),
      p('ft3', 'Free T3', 'pg/mL', '2.3 – 4.2', 2.3, 4.2),
      p('ft4', 'Free T4', 'ng/dL', '0.8 – 1.8', 0.8, 1.8),
      p('tsh2', 'TSH', 'µIU/mL', '0.4 – 4.0', 0.4, 4.0),
    ],
  },
  {
    key: 'ecg',
    name: 'ECG',
    aliases: ['ekg', 'electrocardiogram'],
    specimen: '—',
    method: '12-lead ECG',
    parameters: [
      p('rate', 'Heart rate', 'bpm', '60 – 100', 60, 100),
      p('rhythm', 'Rhythm', '', 'Sinus', null, null, { qualitativeNormal: 'Sinus' }),
      p('pr', 'PR interval', 'ms', '120 – 200', 120, 200),
      p('qrs', 'QRS duration', 'ms', '80 – 120', 80, 120),
      p('qtc', 'QTc', 'ms', '350 – 450', 350, 450),
      p('findings', 'Findings', '', 'Normal ECG', null, null, { qualitativeNormal: 'Normal ECG' }),
    ],
  },
  {
    key: 'xray',
    name: 'X-Ray',
    aliases: ['radiograph', 'x ray'],
    specimen: '—',
    method: 'Radiography',
    parameters: [
      p('region', 'Region / view', '', '—', null, null),
      p('findings', 'Findings', '', 'No acute abnormality', null, null, {
        qualitativeNormal: 'No acute abnormality',
      }),
      p('imp', 'Impression', '', '—', null, null),
    ],
  },
  {
    key: 'usg',
    name: 'Ultrasound',
    aliases: ['usg', 'sonography', 'ultrasound scan'],
    specimen: '—',
    method: 'Ultrasonography',
    parameters: [
      p('study', 'Study', '', '—', null, null),
      p('findings', 'Findings', '', 'Normal study', null, null, { qualitativeNormal: 'Normal study' }),
      p('imp', 'Impression', '', '—', null, null),
    ],
  },
  {
    key: 'covid',
    name: 'COVID-19 PCR',
    aliases: ['covid', 'sars-cov-2', 'covid pcr'],
    specimen: 'Nasopharyngeal swab',
    method: 'RT-PCR',
    parameters: [
      p('result', 'SARS-CoV-2 RNA', '', 'Not detected', null, null, { qualitativeNormal: 'Not detected' }),
      p('ct', 'Ct value', '', '—', null, null),
    ],
  },
  {
    key: 'hbsag',
    name: 'Hepatitis B',
    aliases: ['hbsag', 'hbv', 'hep b'],
    specimen: 'Serum',
    method: 'CLIA / rapid immunoassay',
    parameters: [
      p('hbsag', 'HBsAg', '', 'Non-reactive', null, null, { qualitativeNormal: 'Non-reactive' }),
    ],
  },
  {
    key: 'hcv',
    name: 'Hepatitis C',
    aliases: ['anti-hcv', 'hcv', 'hep c'],
    specimen: 'Serum',
    method: 'CLIA / rapid immunoassay',
    parameters: [
      p('hcv', 'Anti-HCV', '', 'Non-reactive', null, null, { qualitativeNormal: 'Non-reactive' }),
    ],
  },
  {
    key: 'blood-group',
    name: 'Blood Group',
    aliases: ['abo', 'rh', 'blood grouping'],
    specimen: 'EDTA whole blood',
    method: 'Tube / gel card',
    parameters: [
      p('abo', 'ABO group', '', '—', null, null),
      p('rh', 'Rh (D)', '', '—', null, null),
    ],
  },
  {
    key: 'esr',
    name: 'ESR',
    aliases: ['sed rate', 'erythrocyte sedimentation'],
    specimen: 'Citrated / EDTA blood',
    method: 'Westergren',
    parameters: [
      p('esr', 'ESR (1 hour)', 'mm/hr', '0 – 20', 0, 20),
    ],
  },
  {
    key: 'crp',
    name: 'CRP',
    aliases: ['c-reactive protein', 'crp quantitative'],
    specimen: 'Serum',
    method: 'Immunoturbidimetry',
    parameters: [
      p('crp', 'C-Reactive Protein', 'mg/L', '< 5.0', 0, 4.9),
    ],
  },
];

export const LAB_TEST_OPTIONS = LAB_TEST_CATALOG.map((t) => t.name);

function genericTest(name: string): LabTestDef {
  return {
    key: 'custom',
    name,
    aliases: [],
    specimen: 'As per request',
    parameters: [p('result', name, '', '—', null, null)],
  };
}

export function resolveLabTest(testName: string): LabTestDef {
  const raw = testName.trim();
  if (!raw) return genericTest('Laboratory Test');
  const lower = raw.toLowerCase();
  const exact = LAB_TEST_CATALOG.find((t) => t.name.toLowerCase() === lower);
  if (exact) return exact;
  const alias = LAB_TEST_CATALOG.find(
    (t) =>
      t.aliases.some((a) => a === lower || lower.includes(a) || a.includes(lower)) ||
      lower.includes(t.name.toLowerCase()),
  );
  return alias ?? genericTest(raw);
}
