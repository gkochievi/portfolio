/**
 * Rubrics (global default + Mtiebi Bank), score bands, sentiment and
 * transcription configs.
 */
import type { RubricDimension, ScoreBands, ScoringConfig, SentimentConfig, TranscriptionConfigRecord } from '@/types'
import { ago, type RubricRef } from './build'

export const DEFAULT_RUBRIC_DIMENSIONS: RubricDimension[] = [
  {
    key: 'politeness',
    name: 'Politeness',
    description: 'Greets, uses courteous language, stays respectful under pressure.',
    guidance: '90+: warm and courteous throughout. 60: neutral, occasional curt replies. Below 40: dismissive or rude.',
    weight: 12,
    source: 'model',
  },
  {
    key: 'correctness',
    name: 'Correctness',
    description: 'Information given to the customer is accurate and complete.',
    guidance: 'Any wrong fee, rate or deadline caps this at 50. Missing a material condition caps it at 70.',
    weight: 33,
    source: 'model',
  },
  {
    key: 'problem_solving',
    name: 'Problem solving',
    description: 'Understands the need and moves it to a resolution or a clear next step.',
    guidance: 'Resolved on the call = 90+. Clear hand-over with a deadline = 70. Left open = below 50.',
    weight: 25,
    source: 'model',
  },
  {
    key: 'time_efficiency',
    name: 'Time efficiency',
    description: 'No unnecessary holds, repetition or detours.',
    guidance: 'Penalise holds without explanation and repeated identity checks.',
    weight: 10,
    source: 'model',
  },
  {
    key: 'kb_factcheck',
    name: 'Knowledge-base accuracy',
    description: 'Measured: share of the agent’s checkable claims the knowledge base supports.',
    guidance: 'Filled from the fact-check; only the weight is editable.',
    weight: 10,
    source: 'factcheck',
  },
  {
    key: 'agent_courtesy',
    name: 'Agent courtesy (measured)',
    description: 'Measured: the agent’s politeness score from the tone analysis of the words.',
    guidance: 'Filled from the tone analysis; only the weight is editable.',
    weight: 10,
    source: 'sentiment',
  },
]

export const MTIEBI_RUBRIC_DIMENSIONS: RubricDimension[] = [
  {
    key: 'greeting',
    name: 'მისალმება და იდენტიფიკაცია',
    name_en: 'Greeting and identification',
    description: 'ოპერატორი ესალმება, წარადგენს თავს და ბანკს, ამოწმებს მომხმარებლის ვინაობას.',
    description_en: 'The agent greets, introduces themself and the bank, and verifies the customer’s identity.',
    guidance: 'სრული ქულა: მისალმება + სახელი + ვინაობის დადასტურება პირადი ნომრის ბოლო ციფრებით.',
    weight: 10,
    source: 'model',
  },
  {
    key: 'empathy',
    name: 'მოსმენა და ემპათია',
    name_en: 'Listening and empathy',
    description: 'ოპერატორი ბოლომდე ისმენს, აღიარებს მომხმარებლის მდგომარეობას და არ აწყვეტინებს.',
    description_en: 'The agent listens fully, acknowledges the customer’s situation and does not interrupt.',
    guidance: 'შეწყვეტინება ან უგულებელყოფა: მაქსიმუმ 50.',
    weight: 10,
    source: 'model',
  },
  {
    key: 'clarification',
    name: 'პრობლემის დაზუსტება',
    name_en: 'Clarifying the problem',
    description: 'დამაზუსტებელი კითხვებით ადგენს რეალურ საჭიროებას.',
    description_en: 'Asks clarifying questions to establish the real need.',
    guidance: 'მინიმუმ ერთი დამაზუსტებელი კითხვა, სანამ პასუხს გასცემს.',
    weight: 10,
    source: 'model',
  },
  {
    key: 'accuracy',
    name: 'ინფორმაციის სისწორე',
    name_en: 'Accuracy of information',
    description: 'ტარიფები, განაკვეთები, ვადები და პირობები ზუსტად არის ნათქვამი.',
    description_en: 'Fees, rates, deadlines and conditions are stated correctly.',
    guidance: 'ერთი არასწორი ტარიფი ან პირობა: მაქსიმუმ 50. ორი ან მეტი: მაქსიმუმ 30.',
    weight: 15,
    source: 'model',
  },
  {
    key: 'resolution',
    name: 'საკითხის გადაწყვეტა',
    name_en: 'Resolution',
    description: 'საკითხი გადაწყდა ზარზე ან მომხმარებელმა მიიღო მკაფიო შემდეგი ნაბიჯი და ვადა.',
    description_en: 'Resolved on the call, or the customer has a clear next step and deadline.',
    guidance: 'გადაწყდა ზარზე: 90+. მკაფიო გადამისამართება ვადით: 70. ღია დარჩა: 50-ზე ნაკლები.',
    weight: 20,
    source: 'model',
  },
  {
    key: 'disclosures',
    name: 'სავალდებულო გაფრთხილებები და პროცედურა',
    name_en: 'Mandatory disclosures and procedure',
    description: 'სესხზე, ბარათზე ან გადარიცხვაზე სავალდებულო პირობები და საკომისიოები გაჟღერებულია.',
    description_en: 'Mandatory terms and fees for loans, cards or transfers are disclosed.',
    guidance: 'ვადამდელი დაფარვის საკომისიოს დამალვა: მაქსიმუმ 40.',
    weight: 10,
    source: 'model',
  },
  {
    key: 'professionalism',
    name: 'ტონი და პროფესიონალიზმი',
    name_en: 'Tone and professionalism',
    description: 'მშვიდი, თავაზიანი, საქმიანი ტონი; ჟარგონის გარეშე.',
    description_en: 'Calm, courteous, businesslike tone; no jargon.',
    guidance: 'მკვახე პასუხები ან ირონია: მაქსიმუმ 50.',
    weight: 10,
    source: 'model',
  },
  {
    key: 'closing',
    name: 'ზარის დასრულება',
    name_en: 'Closing the call',
    description: 'აჯამებს შეთანხმებულს, კითხულობს, სხვა რამით ხომ არ დაეხმაროს, და მადლობას უხდის.',
    description_en: 'Summarises what was agreed, offers further help and thanks the customer.',
    guidance: 'შეჯამების გარეშე: მაქსიმუმ 70.',
    weight: 5,
    source: 'model',
  },
  {
    key: 'kb_factcheck',
    name: 'ცოდნის ბაზასთან შესაბამისობა',
    name_en: 'Knowledge-base accuracy',
    description: 'გაზომილი: ოპერატორის შემოწმებადი მტკიცებების წილი, რომელსაც ცოდნის ბაზა ადასტურებს.',
    description_en: 'Measured: share of the agent’s checkable claims the knowledge base supports.',
    guidance: 'ივსება ფაქტების შემოწმებიდან; რედაქტირებადია მხოლოდ წონა.',
    weight: 5,
    source: 'factcheck',
  },
  {
    key: 'agent_courtesy',
    name: 'ოპერატორის თავაზიანობა (გაზომილი)',
    name_en: 'Agent courtesy (measured)',
    description: 'გაზომილი: ოპერატორის თავაზიანობის ქულა ტექსტის ტონის ანალიზიდან.',
    description_en: 'Measured: the agent’s politeness score from the tone analysis of the words.',
    guidance: 'ივსება ტონის ანალიზიდან; რედაქტირებადია მხოლოდ წონა.',
    weight: 5,
    source: 'sentiment',
  },
]

export const DEFAULT_RUBRIC: RubricRef = { version: 4, dimensions: DEFAULT_RUBRIC_DIMENSIONS }
export const MTIEBI_RUBRIC: RubricRef = { version: 3, dimensions: MTIEBI_RUBRIC_DIMENSIONS }

/** Which rubric a tenant's calls are scored against. */
export const rubricFor = (clientId: string): RubricRef => (clientId === 'tn_mtiebi' ? MTIEBI_RUBRIC : DEFAULT_RUBRIC)

export const scoringConfigs: ScoringConfig[] = [
  {
    id: 'rub_default',
    client_id: null,
    version: DEFAULT_RUBRIC.version,
    dimensions: DEFAULT_RUBRIC_DIMENSIONS,
    rubric:
      'Score the agent, not the customer. Judge what was said against the workspace knowledge base. ' +
      'Quote the line that justifies every score. When a dimension does not apply to this call, leave it unscored rather than guessing.',
    is_default: true,
    updated_at: ago(64),
    updated_by: 'Levan Kipiani',
  },
  {
    id: 'rub_mtiebi',
    client_id: 'tn_mtiebi',
    version: MTIEBI_RUBRIC.version,
    dimensions: MTIEBI_RUBRIC_DIMENSIONS,
    rubric:
      'შეაფასე ოპერატორი და არა მომხმარებელი. ყოველი ქულა დაასაბუთე ციტატით ზარიდან. ' +
      'ტარიფები, განაკვეთები და ვადები შეამოწმე მთიები ბანკის ცოდნის ბაზით. სესხის შესახებ საუბარში ვადამდელი დაფარვის ' +
      'პირობის გაჟღერება სავალდებულოა. თუ კრიტერიუმი ამ ზარს არ ეხება, დატოვე შეუფასებელი.',
    is_default: false,
    updated_at: ago(12, 5),
    updated_by: 'Tamar Gelashvili',
  },
]

export const scoreBands: Record<string, ScoreBands> = {
  tn_mtiebi: { amber_from: 50, green_from: 80 },
  tn_pari: { amber_from: 60, green_from: 85 },
  tn_iasamani: { amber_from: 50, green_from: 80 },
  tn_darbazi: { amber_from: 50, green_from: 80 },
  tn_nobati: { amber_from: 50, green_from: 80 },
  tn_mzetamze: { amber_from: 50, green_from: 80 },
}

export const sentimentConfigs: SentimentConfig[] = [
  {
    client_id: 'tn_mtiebi',
    enabled: true,
    guidance:
      'ბანკის მომხმარებლები ხშირად თავაზიანად საუბრობენ მაშინაც, როცა გაბრაზებულები არიან. ხმის ტონი ცალკე შეაფასე და არ გააერთიანო სიტყვების ტონთან.',
    voice_tone: 'ok',
    updated_at: ago(20, 2),
    updated_by: 'Tamar Gelashvili',
  },
  {
    client_id: 'tn_pari',
    enabled: true,
    guidance: 'ზარალის შესახებ ზარებში მომხმარებლის შფოთვა ნორმალურია; ოპერატორის სიმშვიდე განსაკუთრებით მნიშვნელოვანია.',
    voice_tone: 'ok',
    updated_at: ago(33),
    updated_by: 'Mariam Abashidze',
  },
  { client_id: 'tn_iasamani', enabled: true, guidance: '', voice_tone: 'ok', updated_at: ago(41), updated_by: null },
  {
    client_id: 'tn_darbazi',
    enabled: true,
    guidance: 'ტექნიკური პრობლემის ზარებში მომხმარებლის იმედგაცრუება მოსალოდნელია.',
    voice_tone: 'warming',
    updated_at: ago(2, 4),
    updated_by: 'Irakli Tsiklauri',
  },
  { client_id: 'tn_nobati', enabled: false, guidance: '', voice_tone: 'disabled', updated_at: ago(50), updated_by: null },
  { client_id: 'tn_mzetamze', enabled: true, guidance: '', voice_tone: 'ok', updated_at: ago(70), updated_by: null },
]

export const transcriptionConfigs: TranscriptionConfigRecord[] = [
  {
    client_id: null,
    override: { language_code: null, diarize: true, keyterms: [], audio_format: 'flac_16k' },
    updated_at: ago(58),
    updated_by: 'Levan Kipiani',
  },
  {
    client_id: 'tn_mtiebi',
    override: {
      language_code: 'ka',
      diarize: true,
      keyterms: ['მთიები', 'ვადამდელი დაფარვა', 'ოქროს ბარათი', 'SWIFT', 'ანაბარი', 'იპოთეკა'],
    },
    updated_at: ago(15, 6),
    updated_by: 'Tamar Gelashvili',
  },
  {
    client_id: 'tn_pari',
    override: { language_code: 'ka', keyterms: ['კასკო', 'ფრანშიზა', 'ზარალი'] },
    updated_at: ago(30),
    updated_by: 'Mariam Abashidze',
  },
]
