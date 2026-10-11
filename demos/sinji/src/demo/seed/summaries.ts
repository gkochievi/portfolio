/**
 * Multi-call digests (two-stage: per-call pass, then merge). Georgian with
 * English glosses. `index` and `appears_in` are 1-based positions in `calls`.
 * Per-call blurbs also carry `summary_en` / `outcome_en` glosses (not in the
 * shared type; the analysis panels read them through `callGloss`).
 */
import type { CallSummary } from '@/types'
import { ago } from './build'

type CallLine = CallSummary['calls'][number] & { summary_en?: string; outcome_en?: string }

const calls = (lines: CallLine[]): CallSummary['calls'] => lines

export const summaries: CallSummary[] = [
  {
    id: 'sum_mtb_01',
    client_id: 'tn_mtiebi',
    job_ids: ['rec_mtb_01', 'rec_mtb_04', 'rec_mtb_06'],
    language: 'ka',
    title: 'საკომისიოებისა და გადასახდელების საჩივრები',
    title_en: 'Fees and charges complaints',
    short_summary:
      'სამივე ზარი საკომისიოს შესახებ საუბარს ეხება და სამივეში მომხმარებელი უსიამოვნო სიურპრიზის წინაშე აღმოჩნდა. ორ ზარში ოპერატორმა ცოდნის ბაზის საპირისპირო ინფორმაცია გასცა: ვადამდელი დაფარვა სესხზე და ოქროს ბარათის პირველი წელი, მესამე ზარში კი სწორი ტარიფი ცივად და ემპათიის გარეშე დასახელდა. საკომისიოს პირობა სამივე შემთხვევაში საუბრის დასაწყისში უნდა დასახელებულიყო.',
    short_summary_en:
      'All three calls are about fees, and in all three the customer was surprised by a charge. In two calls the agent said something that contradicts the knowledge base (early loan repayment, the Gold card first year); in the third the tariff was quoted correctly but curtly and without empathy. In every case the fee condition should have been stated at the start of the conversation.',
    key_points: [
      'ვადამდელი დაფარვა: ოპერატორმა ორჯერ თქვა, რომ საკომისიო არ არის, ბაზაში კი პირველ 12 თვეში 1%-ია.',
      'ოქროს ბარათი: „პირველი წელი უფასოა“ მხოლოდ კლასიკურ ბარათს ეხება; დაბრუნების ვადა („სამ დღეში“) ბაზაში არ არის.',
      'SWIFT გადარიცხვა: 140 ლარიანი საკომისიო ტარიფს შეესაბამება (0.2%, მაქს. 150), მაგრამ შუამავალი ბანკის დაკავებაზე წინასწარ არავის უთქვამს.',
      'ხმის ტონი და სიტყვები ხშირად არ ემთხვევა: ზურაბი სიტყვებით თავაზიანია, ხმით კი გაბრაზებული; ეს მისი მეორე ზარია ერთსა და იმავე საკითხზე.',
    ],
    key_points_en: [
      'Early repayment: the agent said twice there is no fee; the knowledge base sets 1% in the first 12 months.',
      'Gold card: "first year free" applies to the Classic card only; the "refund within three days" promise is not in the knowledge base.',
      'SWIFT transfer: the 140 GEL fee matches the tariff (0.2%, max 150), but nobody warned about intermediary-bank deductions up front.',
      'Words and voice often disagree: Zurab is polite in words and angry in voice; it was his second call on the same issue.',
    ],
    action_items: [
      'სესხების დოკუმენტში ვადამდელი დაფარვის პუნქტი გამარტივდეს და დაემატოს მაგალითი (იხ. კურაციის რიგი).',
      'ოქროს ბარათის საფასური ხშირად დასმულ კითხვებში ცალკე კითხვად გამოვიდეს; ოპერატორებს ეცნობოთ.',
      'გოგას ეთქვას ემპათიისა და სიტყვების არჩევის შესახებ; ზარი 04 ტრენინგის მაგალითად გამოვიყენოთ.',
      'ზურაბ მაისურაძეს დაუკავშირდეს უფროსი ოპერატორი და ზუსტი თანხა დაუდასტუროს.',
    ],
    action_items_en: [
      'Simplify the early-repayment paragraph in the loans document and add a worked example (see the curation queue).',
      'Make the Gold card annual fee a separate FAQ entry and tell the agents.',
      'Coach Goga on empathy and word choice; use call 04 as a training example.',
      'A senior agent should call Zurab Maisuradze back and confirm the exact amount.',
    ],
    participants: [
      { label: 'Lasha', role: 'agent', appears_in: [1] },
      { label: 'Goga', role: 'agent', appears_in: [2] },
      { label: 'Dato', role: 'agent', appears_in: [3] },
      { label: 'Zurab Maisuradze', role: 'customer', appears_in: [1] },
    ],
    calls: calls([
      {
        index: 1,
        recording_id: 'rec_mtb_01',
        title: 'Early loan repayment',
        summary:
          'მომხმარებელს 15 000 ლარიანი სესხიდან 5 000 ლარის ვადამდე დაფარვა სურს. ოპერატორმა ორჯერ დაარწმუნა, რომ საკომისიო არ არის, თუმცა სესხი 8 თვისაა და ბაზის მიხედვით 1% (50 ლარი) ეკისრება.',
        summary_en:
          'The customer wants to repay 5,000 GEL of a 15,000 GEL loan early. The agent twice assured him there is no fee, though the loan is 8 months old and the knowledge base sets 1% (50 GEL).',
        outcome: 'საკომისიოს შესახებ მცდარი ინფორმაცია; მომხმარებელი უკმაყოფილოა.',
        outcome_en: 'Wrong fee information; customer dissatisfied.',
      },
      {
        index: 2,
        recording_id: 'rec_mtb_04',
        title: 'International transfer fee complaint',
        summary:
          'მომხმარებელი 70 000 ლარიან SWIFT გადარიცხვაზე 140 ლარიან საკომისიოს და შუამავალი ბანკების დაკავებას აპროტესტებს. ოპერატორი ტარიფს სწორად ასახელებს, მაგრამ ცივია და გადარიცხვის დროის ზღვარს (cut-off) არასწორად უთითებს.',
        summary_en:
          'The customer disputes a 140 GEL fee and intermediary-bank deductions on a 70,000 GEL SWIFT transfer. The agent quotes the tariff correctly but is curt and gives the wrong cut-off time.',
        outcome: 'საჩივარი დარეგისტრირდა; ემპათიის ქულა დაბალია.',
        outcome_en: 'Complaint registered; empathy score is low.',
      },
      {
        index: 3,
        recording_id: 'rec_mtb_06',
        title: 'Gold card annual fee dispute',
        summary:
          'ოქროს ბარათის გააქტიურებისას ჩამოიჭრა 60 ლარი. ოპერატორმა თქვა, რომ პირველი წელი ოქროს ბარათზეც უფასოა და თანხის დაბრუნება დაჰპირდა, რაც ბაზას ეწინააღმდეგება.',
        summary_en:
          'A 60 GEL fee was charged when the Gold card was activated. The agent said the first year is free on Gold too and promised a refund, which contradicts the knowledge base.',
        outcome: 'მომხმარებელი კლასიკურ ბარათზე გადავიდა; თანხა განსახილველად გადაეგზავნა.',
        outcome_en: 'Customer moved to the Classic card; the charge was escalated for review.',
      },
    ]),
    stages: [
      { name: 'per_call', ms: 1240 },
      { name: 'merge', ms: 980 },
    ],
    status: 'done',
    created_by: 'Tamar Gelashvili',
    created_at: ago(1, 4),
  },
  {
    id: 'sum_mtb_02',
    client_id: 'tn_mtiebi',
    job_ids: ['rec_mtb_02', 'rec_mtb_03'],
    language: 'ka',
    title: 'კარგი პრაქტიკა: ბარათისა და ანაბრის ზარები',
    title_en: 'Good practice: card and deposit calls',
    short_summary:
      'ორივე ზარი სამაგალითოა: ოპერატორები თავაზიანები არიან, ზუსტად ასახელებენ ტარიფებს და საუბრის ბოლოს გასაგებ შემდეგ ნაბიჯს აფიქსირებენ. ერთადერთი ხარვეზი ანაბრის ზარშია: აქციის პირობა, რომელიც ბაზაში არ არის დაფიქსირებული, და ვადიანი ანაბრის ვადის დროებითი არევა, რომელიც ოპერატორმა თვითონ გამოასწორა.',
    short_summary_en:
      'Both calls are exemplary: the agents are courteous, quote the tariffs accurately and close with a clear next step. The only gap is in the deposit call: an autumn promotion that is not in the knowledge base, and a momentary mix-up of the term-deposit period that the agent corrected herself.',
    key_points: [
      'დაკარგული ბარათი: დაბლოკვა, ტრანზაქციების შემოწმება, ახალი ბარათი 10 ლარად, უფასო მიწოდება და თაღლითობის გაფრთხილება - ყველა მტკიცება დადასტურდა.',
      'ანაბრის ზარი: შემნახველი ანაბარი 9% და ვადიანი 10.5% სწორად დასახელდა.',
      'ოპერატორმა „შემოდგომის აქცია“ ახსენა, რომელიც ცოდნის ბაზაში არ არის.',
      'ორივე მომხმარებელი მშვიდია და ხმა სიტყვებს ემთხვევა.',
    ],
    key_points_en: [
      'Lost card: block, transaction check, new card for 10 GEL, free delivery and a fraud warning - every claim was supported.',
      'Deposit call: the 9% savings and 10.5% term deposit were quoted correctly.',
      'The agent mentioned an "autumn promotion" that is not in the knowledge base.',
      'Both customers are calm and voice matches words.',
    ],
    action_items: [
      'შემოდგომის აქცია დაემატოს ანაბრების დოკუმენტს ან ოპერატორებს ეთქვათ, რომ არ დაასახელონ.',
      'ზარი 02 კარგი პრაქტიკის მაგალითად გამოვიყენოთ ახალ თანამშრომლებთან.',
    ],
    action_items_en: [
      'Add the autumn promotion to the deposits document, or tell agents not to quote it.',
      'Use call 02 as a good-practice example for new hires.',
    ],
    participants: [
      { label: 'Eka', role: 'agent', appears_in: [1] },
      { label: 'Nata', role: 'agent', appears_in: [2] },
    ],
    calls: calls([
      {
        index: 1,
        recording_id: 'rec_mtb_02',
        title: 'Lost card, block and reissue',
        summary: 'მომხმარებელმა ბარათი დაკარგა. ოპერატორმა დააწყნარა, დაბლოკა ბარათი, გამოუშვა ახალი 10 ლარად და გააფრთხილა თაღლითობის შესახებ.',
        summary_en: 'The customer lost her card. The agent reassured her, blocked it, issued a new one for 10 GEL and warned about fraud.',
        outcome: 'ბარათი დაბლოკილია; ახალი სამ სამუშაო დღეში მზად იქნება.',
        outcome_en: 'Card blocked; the new one will be ready in three business days.',
      },
      {
        index: 2,
        recording_id: 'rec_mtb_03',
        title: 'Deposit rates enquiry',
        summary: 'მომხმარებელს 10 000 ლარის განთავსება სურს. ოპერატორმა შემნახველი და ვადიანი ანაბარი ახსნა და აქციაც ახსენა, რომელიც ბაზაში არ ფიქსირდება.',
        summary_en: 'The customer wants to place 10,000 GEL. The agent explained the savings and term deposits and mentioned a promotion that is not recorded in the knowledge base.',
        outcome: 'მომხმარებელი ფილიალში მივა ანაბრის გასახსნელად.',
        outcome_en: 'The customer will visit a branch to open the deposit.',
      },
    ]),
    stages: [
      { name: 'per_call', ms: 1130 },
      { name: 'merge', ms: 870 },
    ],
    status: 'done',
    created_by: 'Nino Kurtanidze',
    created_at: ago(4, 2),
  },
  {
    id: 'sum_pari_01',
    client_id: 'tn_pari',
    job_ids: ['rec_pari_01', 'rec_pari_02'],
    language: 'ka',
    title: 'კასკოსა და სამოგზაურო პოლისის დეტალები',
    title_en: 'Kasko and travel policy details',
    short_summary:
      'ორივე ვებ-ჩატში ოპერატორი თავაზიანი და სწრაფია, მაგრამ თითო პირობა არასწორად დაასახელა: კასკოს 200-ლარიანი ფრანშიზა არ არსებობს (ვარიანტებია 0, 150, 300, 500), ხოლო სამოგზაურო პოლისი სათხილამურო სეირნობას დამატებითი პაკეტის გარეშე არ ფარავს.',
    short_summary_en:
      'In both web chats the agent is courteous and quick, but each quoted one condition wrongly: a 200 GEL Kasko deductible does not exist (options are 0, 150, 300, 500), and the travel policy does not cover skiing without the add-on package.',
    key_points: [
      'ზარალის შეტყობინების ვადა (24 საათი) და დოკუმენტები სწორად დასახელდა.',
      'კასკოს ფრანშიზა: ბაზაში 0 / 150 / 300 / 500 ლარია, სტანდარტული 300.',
      'შენგენის პოლისი: დაფარვა 30 000 ევრო, ექსტრემალური სპორტი მხოლოდ დამატებით პაკეტში.',
    ],
    key_points_en: [
      'The 24-hour claim notice and the documents were stated correctly.',
      'Kasko deductible: the knowledge base lists 0 / 150 / 300 / 500 GEL, default 300.',
      'Schengen policy: 30,000 EUR cover; extreme sports only with the add-on package.',
    ],
    action_items: [
      'ოპერატორებს შეახსენეთ ფრანშიზის ოთხივე ვარიანტი; ჩატის სკრიპტში ჩასვით ცხრილი.',
      'სამოგზაურო პოლისის კითხვა-პასუხს დაემატოს „სათხილამურო სეზონი“.',
    ],
    action_items_en: [
      'Remind the agents of all four deductible options; put the table into the chat script.',
      'Add a "ski season" entry to the travel policy FAQ.',
    ],
    participants: [
      { label: 'Ana', role: 'agent', appears_in: [1] },
      { label: 'Giorgi', role: 'agent', appears_in: [2] },
    ],
    calls: calls([
      {
        index: 1,
        recording_id: 'rec_pari_01',
        title: 'Kasko claim after a car-park collision',
        summary: 'მომხმარებელი მანქანის დაზიანებას აცხადებს. ოპერატორმა ვადა და დოკუმენტები სწორად დაასახელა, მაგრამ 200-ლარიანი ფრანშიზა თქვა, რომელიც არ არსებობს.',
        summary_en: 'The customer reports car damage. The agent gave the deadline and documents correctly but quoted a 200 GEL deductible, which does not exist.',
        outcome: 'განაცხადი დარეგისტრირდა.',
        outcome_en: 'Claim registered.',
      },
      {
        index: 2,
        recording_id: 'rec_pari_02',
        title: 'Schengen travel policy',
        summary: 'მომხმარებელს შენგენის პოლისი სჭირდება სათხილამურო მოგზაურობისთვის. ფასი და დაფარვა სწორია, მაგრამ ოპერატორმა თქვა, რომ ჩვეულებრივი პოლისი თხილამურებსაც ფარავს.',
        summary_en: 'The customer needs a Schengen policy for a ski trip. Price and cover are right, but the agent said the standard policy also covers skiing.',
        outcome: 'მომხმარებელი დამატებით პაკეტს ითხოვს.',
        outcome_en: 'The customer asks for the add-on package.',
      },
    ]),
    stages: [
      { name: 'per_call', ms: 1090 },
      { name: 'merge', ms: 830 },
    ],
    status: 'done',
    created_by: 'Mariam Abashidze',
    created_at: ago(2, 5),
  },
]
