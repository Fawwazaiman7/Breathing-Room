import {
  BINARY_LABELS,
  CATEGORY_CONTENT,
  DIMENSION_CONTENT,
  MEASURE_HINTS,
  OLBI_OPTIONS,
  WORKLOAD_LABELS,
} from '../screening/content';
import type {
  BinaryLevel,
  NasaTlxDimension,
  ScreeningCategory,
  WorkloadLevel,
} from '../screening/types';
import { useLanguage } from './language';
import type { Language } from './language';

type DimensionContent = typeof DIMENSION_CONTENT;
type CategoryContent = typeof CATEGORY_CONTENT;

/**
 * Indonesian wording of the NASA-TLX dimensions. A working translation of
 * the English wording above, written for this app; it should be checked
 * against the Indonesian NASA-TLX used in the thesis.
 */
const DIMENSION_CONTENT_ID: DimensionContent = {
  mentalDemand: {
    label: 'Beban mental',
    description:
      'Memikirkan kode, memecahkan masalah, mengingat detail, atau menyusun laporan.',
    ratingQuestion:
      'Seberapa banyak tugas akademikmu menuntut berpikir, menganalisis, dan memecahkan masalah?',
  },
  physicalDemand: {
    label: 'Kelelahan fisik',
    description:
      'Misalnya duduk lama di depan komputer, mata lelah, begadang, atau kurang istirahat.',
    ratingQuestion: 'Seberapa melelahkan secara fisik tugas akademikmu?',
  },
  temporalDemand: {
    label: 'Tekanan waktu',
    description:
      'Merasa terburu-buru karena tenggat proyek yang ketat, tugas yang menumpuk, atau jadwal sidang yang makin dekat.',
    ratingQuestion: 'Seberapa terburu-buru atau dikejar waktu yang kamu rasakan?',
  },
  performance: {
    label: 'Ketidakpuasan terhadap hasil',
    description:
      'Hasil yang belum sesuai harapan, misalnya fitur yang masih ada bug-nya atau laporan yang masih perlu revisi.',
    ratingQuestion:
      'Seberapa tidak puas kamu dengan hasil yang berhasil kamu capai?',
  },
  effort: {
    label: 'Total usaha',
    description:
      'Usaha ekstra yang dibutuhkan agar tidak tertinggal, misalnya begadang atau membaca banyak dokumentasi.',
    ratingQuestion:
      'Seberapa keras kamu harus berusaha, secara mental dan fisik, agar tidak tertinggal?',
  },
  frustration: {
    label: 'Stres dan frustrasi',
    description:
      'Merasa stres, kesal, atau putus asa, misalnya saat kode terus gagal atau revisi seakan tidak ada habisnya.',
    ratingQuestion: 'Seberapa stres, kesal, atau putus asa yang kamu rasakan?',
  },
};

/** Answer labels of the validated Indonesian OLBI. Values are unchanged. */
const OLBI_OPTIONS_ID = [
  { value: 1, label: 'Sangat tidak setuju' },
  { value: 2, label: 'Tidak setuju' },
  { value: 3, label: 'Setuju' },
  { value: 4, label: 'Sangat setuju' },
];

const CATEGORY_CONTENT_ID: CategoryContent = {
  NO_BURNOUT: {
    label: 'Tidak mengalami burnout',
    tone: 'calm',
    short: 'Kondisi terlihat stabil',
    summary:
      'Jawabanmu menunjukkan bahwa saat ini kamu dapat mengelola beban akademikmu dengan baik.',
    nextStep:
      'Langkah yang disarankan bersifat mandiri: pertahankan kebiasaan istirahat, perencanaan, dan pengaturan ritme yang sudah berjalan baik, lalu cek lagi beberapa waktu ke depan di semester ini.',
  },
  LOW_RISK: {
    label: 'Risiko burnout rendah',
    tone: 'low',
    short: 'Beban kerja masih terkelola',
    summary:
      'Beban kerjamu sedang berat, tetapi jawabanmu menunjukkan bahwa kamu masih mampu menghadapinya.',
    nextStep:
      'Langkah yang disarankan bersifat mandiri: jaga waktu istirahatmu, pecah tugas besar menjadi bagian yang lebih kecil, dan atur ritme agar beban tetap terkendali.',
  },
  MODERATE_RISK: {
    label: 'Risiko burnout sedang',
    tone: 'moderate',
    short: 'Ada beberapa tanda kelelahan',
    summary:
      'Jawabanmu menunjukkan tanda-tanda kelelahan yang perlu diperhatikan.',
    nextStep:
      'Kami menyarankan kamu mengatur waktu untuk berbicara dengan Dosen Pembimbing Akademik (DPA) tentang beban kerjamu dan apa yang kamu rasakan belakangan ini.',
  },
  HIGH_RISK: {
    label: 'Risiko burnout tinggi',
    tone: 'high',
    short: 'Disarankan mendapat dukungan tambahan',
    summary:
      'Jawabanmu menunjukkan bahwa belakangan ini keadaan terasa sangat berat. Kamu tidak harus menghadapinya sendirian.',
    nextStep:
      'Kami menyarankan kamu berbicara dengan konselor di layanan konseling kampusmu. Dosen Pembimbing Akademik (DPA) dapat membantumu mengaturnya.',
  },
};

const WORKLOAD_LABELS_ID: Record<WorkloadLevel, string> = {
  VERY_LOW: 'Sangat rendah',
  LOW: 'Rendah',
  MODERATE: 'Sedang',
  HIGH: 'Tinggi',
  VERY_HIGH: 'Sangat tinggi',
};

const BINARY_LABELS_ID: Record<BinaryLevel, string> = {
  LOW: 'Rendah',
  HIGH: 'Tinggi',
};

const MEASURE_HINTS_ID: { [K in keyof typeof MEASURE_HINTS]: string } = {
  workload: 'Seberapa berat tuntutan kuliahmu terasa',
  exhaustion: 'Merasa terkuras atau lelah karena kuliah',
  disengagement: 'Merasa menjauh dari, atau jenuh dengan, kuliahmu',
};

export interface ScreeningContent {
  dimensions: Record<
    NasaTlxDimension,
    { label: string; description: string; ratingQuestion: string }
  >;
  olbiOptions: { value: number; label: string }[];
  categories: CategoryContent;
  workloadLabels: Record<WorkloadLevel, string>;
  binaryLabels: Record<BinaryLevel, string>;
  measureHints: { workload: string; exhaustion: string; disengagement: string };
  /** Which wording of the OLBI statements to show. */
  olbiWording: Language;
}

const CONTENT: Record<Language, ScreeningContent> = {
  en: {
    dimensions: DIMENSION_CONTENT,
    olbiOptions: OLBI_OPTIONS,
    categories: CATEGORY_CONTENT,
    workloadLabels: WORKLOAD_LABELS,
    binaryLabels: BINARY_LABELS,
    measureHints: MEASURE_HINTS,
    olbiWording: 'en',
  },
  id: {
    dimensions: DIMENSION_CONTENT_ID,
    olbiOptions: OLBI_OPTIONS_ID,
    categories: CATEGORY_CONTENT_ID,
    workloadLabels: WORKLOAD_LABELS_ID,
    binaryLabels: BINARY_LABELS_ID,
    measureHints: MEASURE_HINTS_ID,
    // The validated Indonesian OLBI (Pratama et al., 2025).
    olbiWording: 'id',
  },
};

export function screeningContentFor(language: Language): ScreeningContent {
  return CONTENT[language];
}

export function useScreeningContent(): ScreeningContent {
  return CONTENT[useLanguage().language];
}

export function categoryLabel(category: ScreeningCategory, language: Language) {
  return CONTENT[language].categories[category].label;
}
