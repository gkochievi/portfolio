/**
 * Public voice tools: languages, voices, models, pre-generated TTS clips,
 * canned transcripts (quick transcription / voice-in / sentiment tab by file
 * hash), converter formats and past conversion batches.
 */
import type {
  CannedTranscript,
  ConversionBatch,
  ConvertFormat,
  ConvertLimits,
  ConvertRowState,
  TtsClip,
  TtsLanguage,
  TtsModel,
  Voice,
} from '@/types'
import { after, ago, buildSentiment } from './build'
import { clipMedia, previewPath } from './media'

export const ttsLanguages: TtsLanguage[] = [
  { code: 'ka', name: 'ქართული', note: 'Georgian: natural prosody, best for support scripts.', model: 'sinji-voice-v3' },
  { code: 'en', name: 'English', note: 'English with a neutral international accent.', model: 'sinji-voice-v2' },
  { code: 'ru', name: 'Русский', note: 'Russian for customers who prefer it.', model: 'sinji-voice-v2' },
]

export const ttsModels: TtsModel[] = [
  { model_id: 'sinji-voice-v3', name: 'Expressive (all languages)', supports: ['ka', 'en', 'ru'] },
  { model_id: 'sinji-voice-v2', name: 'Multilingual (English, Russian)', supports: ['en', 'ru'] },
]

const voice = (
  voice_id: string,
  name: string,
  language: Voice['language'],
  gender: Voice['gender'],
  category: Voice['category'],
  is_default = false,
): Voice => ({ voice_id, name, language, category, gender, is_default, preview_url: previewPath(voice_id) })

export const voices: Voice[] = [
  voice('vo_ka_1', 'Nana', 'ka', 'female', 'premade', true),
  voice('vo_ka_2', 'Giorgi', 'ka', 'male', 'premade'),
  voice('vo_ka_3', 'Eka', 'ka', 'female', 'designed'),
  voice('vo_en_1', 'Clara', 'en', 'female', 'premade', true),
  voice('vo_en_2', 'Daniel', 'en', 'male', 'premade'),
  voice('vo_en_3', 'Amelia', 'en', 'female', 'cloned'),
  voice('vo_ru_1', 'Alisa', 'ru', 'female', 'premade', true),
  voice('vo_ru_2', 'Dmitri', 'ru', 'male', 'premade'),
]

/* ------------------------------------------------------------- TTS clips */

type ClipSpec = Omit<TtsClip, 'audio_url' | 'duration_s' | 'created_at'> & { days: number; hours: number }

const CLIPS: ClipSpec[] = [
  {
    id: 'clip_01',
    text: 'გამარჯობა, თქვენი ბარათი წარმატებით დაიბლოკა. ახალი ბარათი მზად იქნება სამ სამუშაო დღეში.',
    language_code: 'ka',
    voice_id: 'vo_ka_1',
    model_id: 'sinji-voice-v3',
    days: 6,
    hours: 3,
  },
  {
    id: 'clip_02',
    text: 'კეთილი იყოს თქვენი მობრძანება. თქვენი ზარი ჩაიწერება ხარისხის გასაუმჯობესებლად.',
    language_code: 'ka',
    voice_id: 'vo_ka_2',
    model_id: 'sinji-voice-v3',
    days: 5,
    hours: 1,
  },
  {
    id: 'clip_03',
    text: 'თქვენი შეკვეთა მიღებულია. კურიერი 30-45 წუთში იქნება თქვენთან.',
    language_code: 'ka',
    voice_id: 'vo_ka_3',
    model_id: 'sinji-voice-v3',
    days: 3,
    hours: 6,
  },
  {
    id: 'clip_04',
    text: 'Thank you for calling. Your appointment is confirmed for Thursday at ten thirty.',
    language_code: 'en',
    voice_id: 'vo_en_1',
    model_id: 'sinji-voice-v2',
    days: 2,
    hours: 4,
  },
  {
    id: 'clip_05',
    text: 'Please hold for a moment while I check the details of your policy.',
    language_code: 'en',
    voice_id: 'vo_en_2',
    model_id: 'sinji-voice-v2',
    days: 1,
    hours: 2,
  },
  {
    id: 'clip_06',
    text: 'Здравствуйте! Ваша заявка принята, мы свяжемся с вами в течение одного рабочего дня.',
    language_code: 'ru',
    voice_id: 'vo_ru_1',
    model_id: 'sinji-voice-v2',
    days: 0,
    hours: 5,
  },
]

export const ttsClips: TtsClip[] = CLIPS.map(({ days, hours, ...clip }) => ({
  ...clip,
  ...clipMedia(clip.id, clip.text),
  created_at: ago(days, hours),
}))

/* ---------------------------------------------------- canned transcripts */

const dialogue = (language: 'ka' | 'en' | 'ru', lines: Array<[0 | 1, string]>): string => {
  const names = {
    ka: ['ოპერატორი', 'მომხმარებელი'],
    en: ['Agent', 'Customer'],
    ru: ['Оператор', 'Клиент'],
  }[language]
  return lines.map(([who, text]) => `${names[who]}: ${text}`).join('\n')
}

export const cannedTranscripts: CannedTranscript[] = [
  {
    id: 'ct_01',
    language: 'ka',
    duration_s: 31.4,
    transcript: dialogue('ka', [
      [0, 'მთიები ბანკი, გამარჯობათ. გისმენთ.'],
      [1, 'გამარჯობა. ბარათი დამეკარგა და დაბლოკვა მინდა.'],
      [0, 'რა თქმა უნდა, ახლავე დავბლოკავ. გთხოვთ, მითხრათ პირადი ნომერი.'],
      [1, 'ცხრა, ოთხი, ერთი, სამი... გმადლობთ, ძალიან მეჩქარება.'],
      [0, 'ბარათი დაბლოკილია. ახალი ბარათი სამ სამუშაო დღეში მზად იქნება.'],
    ]),
    sentiment: buildSentiment(
      { label: 'neutral', polarity: 0.04, rationale: 'მომხმარებელი მშვიდად აღწერს პრობლემას და თავაზიანად მადლობას უხდის ოპერატორს.' },
      'calm',
    ),
  },
  {
    id: 'ct_02',
    language: 'ka',
    duration_s: 38.9,
    transcript: dialogue('ka', [
      [0, 'დარბაზი ტელეკომი, გამარჯობათ.'],
      [1, 'გამარჯობა, გთხოვთ, იქნებ გამიზიაროთ, რატომ მაქვს მესამე დღეა ინტერნეტი გათიშული?'],
      [0, 'ბოდიშს გიხდით უხერხულობისთვის. დაგიმოწმებთ მისამართს და ტექნიკოსს დაგიგეგმავთ.'],
      [1, 'დიდი მადლობა. ძალიან გთხოვთ, ამჯერად მართლა მოვიდნენ.'],
      [0, 'დარწმუნებული იყავით, ხვალ ორ საათამდე დაგირეკავთ ტექნიკოსი.'],
    ]),
    sentiment: buildSentiment(
      { label: 'positive', polarity: 0.46, rationale: 'სიტყვები თავაზიანია: მადლობა, გთხოვთ, ძალიან გთხოვთ. მოთხოვნა ზრდილობიანად არის ჩამოყალიბებული.' },
      'angry',
      0.88,
    ),
  },
  {
    id: 'ct_03',
    language: 'en',
    duration_s: 24.2,
    transcript: dialogue('en', [
      [0, 'Good morning, Iasamani Clinic, how can I help?'],
      [1, 'Hi! I would like to move my appointment with Dr Tsereteli to next week.'],
      [0, 'Of course, I can offer Tuesday at eleven or Wednesday at two.'],
      [1, 'Tuesday at eleven is perfect, thank you so much!'],
    ]),
    sentiment: buildSentiment(
      { label: 'positive', polarity: 0.62, rationale: 'The customer thanks the agent twice and accepts the first option offered.' },
      'happy',
    ),
  },
  {
    id: 'ct_04',
    language: 'ru',
    duration_s: 29.7,
    transcript: dialogue('ru', [
      [0, 'Отель «Мзетамзе», добрый день.'],
      [1, 'Здравствуйте. Хочу узнать, во сколько можно заселиться в номер.'],
      [0, 'Заселение с четырнадцати часов, выселение до двенадцати.'],
      [1, 'Понятно. А поздний выезд возможен?'],
      [0, 'Да, до шестнадцати часов, по предварительной договорённости.'],
    ]),
    sentiment: buildSentiment(
      { label: 'neutral', polarity: 0.02, rationale: 'Деловые вопросы без эмоциональной окраски; тон вежливый.' },
      'neutral',
      0.8,
    ),
  },
  {
    id: 'ct_05',
    language: 'ka',
    duration_s: 42.6,
    transcript: dialogue('ka', [
      [0, 'ნობათი, გამარჯობათ.'],
      [1, 'ეს უკვე მეორე შეკვეთაა, რომელიც ერთი საათით იგვიანებს. რა ხდება?'],
      [0, 'გასაგებია, ვამოწმებ... კურიერი გზაშია, ათ წუთში მოვა.'],
      [1, 'ბოლოჯერაც ეგ მითხარით. მომბეზრდა ასე ლოდინი.'],
      [0, 'ვიცი, რომ უსიამოვნოა. შეკვეთის ღირებულებას დაგიბრუნებთ ბალანსზე.'],
    ]),
    sentiment: buildSentiment(
      { label: 'negative', polarity: -0.52, rationale: 'მომხმარებელი უკმაყოფილებას პირდაპირ გამოხატავს: „მომბეზრდა“, „ბოლოჯერაც ეგ მითხარით“.' },
      'frustrated',
      0.86,
    ),
  },
]

/* ---------------------------------------------------------------- convert */

export const convertFormats: ConvertFormat[] = [
  { id: 'ulaw_8k', label: 'μ-law 8 kHz WAV', description: 'G.711 μ-law, mono, 8 kHz. Most PBXs and softphones.', ext: 'wav' },
  { id: 'alaw_8k', label: 'A-law 8 kHz WAV', description: 'G.711 A-law, mono, 8 kHz. European and Georgian telephony.', ext: 'wav' },
  { id: 'gsm', label: 'GSM 06.10', description: 'Compact 13 kbit/s voice codec for legacy call-recording boxes.', ext: 'gsm' },
  { id: 'g722', label: 'G.722 wideband', description: 'Wideband voice at 16 kHz, 64 kbit/s.', ext: 'g722' },
  { id: 'mp3_16k', label: 'MP3 16 kHz mono', description: 'Small files that every player opens; good for archives.', ext: 'mp3' },
  { id: 'opus', label: 'Opus 24 kbit/s', description: 'Modern low-bitrate voice codec in an Ogg container.', ext: 'opus' },
]

export const convertLimits: ConvertLimits = {
  max_files: 20,
  max_file_bytes: 50_000_000,
  max_batch_bytes: 200_000_000,
  download_ttl_seconds: 172_800,
}

type Row = ConversionBatch['rows'][number]

const rows = (names: Array<[string, number, ConvertRowState?, string?]>): Row[] =>
  names.map(([name, bytes, state = 'done', error], index) => ({ index, name, bytes, state, error: error ?? null }))

function batch(
  id: string,
  token: string,
  format: string,
  list: Row[],
  createdDays: number,
  createdHours: number,
): ConversionBatch {
  const created_at = ago(createdDays, createdHours)
  return {
    id,
    token,
    format,
    rows: list,
    file_count: list.length,
    ok: list.filter((r) => r.state === 'done').length,
    failed: list.filter((r) => r.state === 'failed').length,
    total_bytes: list.reduce((sum, r) => sum + r.bytes, 0),
    state: 'done',
    created_at,
    expires_at: after(created_at, 172_800_000),
  }
}

export const conversionBatches: ConversionBatch[] = [
  batch(
    'cvb_01',
    'cvt_4f9a1c27b0d3',
    'ulaw_8k',
    rows([
      ['call_2026-09-20_0912.mp3', 1_842_300],
      ['call_2026-09-20_0958.mp3', 2_311_040],
      ['call_2026-09-20_1034.mp3', 960_500],
      ['call_2026-09-20_1107.mp3', 3_204_880, 'failed', 'The file ends before the audio header is complete.'],
    ]),
    5,
    4,
  ),
  batch(
    'cvb_02',
    'cvt_a82e605d91cb',
    'mp3_16k',
    rows([
      ['support_line_a.wav', 12_480_000],
      ['support_line_b.wav', 9_760_200],
      ['support_line_c.wav', 11_034_880],
    ]),
    1,
    6,
  ),
  batch(
    'cvb_03',
    'cvt_71c0d3e8f452',
    'opus',
    rows([
      ['briefing_ka.m4a', 4_120_330],
      ['briefing_en.m4a', 3_870_914],
    ]),
    0,
    2,
  ),
]
