/**
 * Pre-written Copilot content (owner: operator-tools). By SessionTopic: knowledge
 * cards, 2-3 suggestions, each with a base text in ka / en / ru and pre-written
 * tone variants (shorter / warmer / formal) in ka and en. Language transforms pick
 * the same suggestion in the other language. [n] markers cite knowledge cards.
 */
import type { CopilotSuggestion, CopilotTransform, ContentLang, SessionTopic } from '@/types'

export type Tone = 'base' | 'shorter' | 'warmer' | 'formal'

interface Duo {
  ka: string
  en: string
}

interface Trio extends Duo {
  ru: string
}

export interface SuggestionSpec {
  kind: CopilotSuggestion['kind']
  citations: number[]
  base: Trio
  shorter: Duo
  warmer: Duo
  formal: Duo
}

export interface KnowledgeSpec {
  title: Duo
  snippet: Duo
  documentId: string
}

export interface TopicContent {
  knowledge: KnowledgeSpec[]
  suggestions: SuggestionSpec[]
  /** The base draft promises something (a date, a voucher, a refund). */
  commitment: boolean
}

export const TOPIC_CONTENT: Record<SessionTopic, TopicContent> = {
  delivery: {
    commitment: true,
    knowledge: [
      {
        documentId: 'kb_delivery',
        title: { en: 'Delivery times & zones', ka: 'მიწოდების დრო და ზონები' },
        snippet: {
          en: 'Tbilisi orders placed before 16:00 are delivered the same day; later orders the next morning. Couriers call 15 minutes before arriving.',
          ka: 'თბილისში 16:00-მდე გაფორმებული შეკვეთა იმავე დღეს მიგვაქვს, გვიანდელი მეორე დილით. კურიერი მისვლამდე 15 წუთით ადრე დაგირეკავთ.',
        },
      },
      {
        documentId: 'kb_late',
        title: { en: 'Late or missed deliveries', ka: 'დაგვიანებული ან გამოტოვებული მიწოდება' },
        snippet: {
          en: 'If a courier misses the slot, offer a priority delivery the same day or the next morning, and a 10% voucher on the next order.',
          ka: 'თუ კურიერმა დროის ინტერვალი გამოტოვა, შესთავაზეთ პრიორიტეტული მიწოდება იმავე დღეს ან მომდევნო დილით და 10%-იანი ვაუჩერი შემდეგ შეკვეთაზე.',
        },
      },
      {
        documentId: 'kb_regions',
        title: { en: 'Regional shipping', ka: 'რეგიონებში გაგზავნა' },
        snippet: {
          en: 'Batumi, Kutaisi and Telavi take 1–2 working days by courier (8 ₾). Other towns take 2–3 days.',
          ka: 'ბათუმში, ქუთაისსა და თელავში მიწოდებას 1–2 სამუშაო დღე სჭირდება (8 ₾), სხვა ქალაქებში 2–3 დღე.',
        },
      },
    ],
    suggestions: [
      {
        kind: 'answer',
        citations: [2],
        base: {
          en: 'I’m sorry about the delay. We can bring your order today between 13:00 and 15:00 [2], and I’ll add a 10% voucher for your next order.',
          ka: 'ბოდიშს გიხდით დაგვიანებისთვის. შეკვეთას დღესვე, 13:00–15:00 საათებში მოგიტანთ [2], შემდეგ შეკვეთაზე კი 10%-იან ვაუჩერს დაგიმატებთ.',
          ru: 'Приносим извинения за задержку. Привезём заказ сегодня с 13:00 до 15:00 [2], а на следующий заказ добавим ваучер на 10%.',
        },
        shorter: {
          en: 'Sorry for the delay! We’ll deliver today, 13:00–15:00 [2], plus a 10% voucher.',
          ka: 'ბოდიში დაგვიანებისთვის! დღეს, 13:00–15:00-ზე მოგიტანთ [2] და 10%-იან ვაუჩერსაც დაგიმატებთ.',
        },
        warmer: {
          en: 'I’m so sorry for the wait, I know how frustrating it is. Let me make it right: your order will arrive today between 13:00 and 15:00 [2], and a 10% voucher is on us for next time.',
          ka: 'ძალიან ვწუხვარ ლოდინის გამო, მესმის, რამდენად უსიამოვნოა. გამოვასწორებ: შეკვეთას დღესვე, 13:00–15:00 საათებში მოგიტანთ [2], შემდეგი შეკვეთისთვის კი 10%-იან ვაუჩერს საჩუქრად გიგზავნით.',
        },
        formal: {
          en: 'We apologise for the delay in delivering your order. Delivery has been rescheduled for today between 13:00 and 15:00 [2]. As compensation, a 10% voucher will be added to your account for your next order.',
          ka: 'ბოდიშს გიხდით შეკვეთის დაგვიანებისთვის. მიწოდება გადავიდა დღევანდელ დღეზე, 13:00–15:00 საათებზე [2]. კომპენსაციის სახით შემდეგ შეკვეთაზე 10%-იანი ვაუჩერი დაგერიცხებათ.',
        },
      },
      {
        kind: 'clarify',
        citations: [1],
        base: {
          en: 'What time will you be home today? I’ll ask the courier to fit your window [1].',
          ka: 'დღეს რომელ საათამდე იქნებით სახლში? კურიერს თქვენს დროს მოვარგებ [1].',
          ru: 'Во сколько вы сегодня будете дома? Попрошу курьера подстроиться под вас [1].',
        },
        shorter: {
          en: 'When are you home today? I’ll match the courier to it [1].',
          ka: 'დღეს როდის იქნებით სახლში? კურიერს მოვარგებ [1].',
        },
        warmer: {
          en: 'No problem at all, let’s find a time that works for you. When will you be home today? I’ll ask the courier to match it [1].',
          ka: 'არაუშავს, ერთად ვიპოვოთ თქვენთვის მოსახერხებელი დრო. დღეს როდის იქნებით სახლში? კურიერს მოვარგებ [1].',
        },
        formal: {
          en: 'Could you please let us know until what time you will be available at the delivery address today? We will coordinate the courier accordingly [1].',
          ka: 'გთხოვთ, მიუთითოთ, დღეს რომელ საათამდე იქნებით მისამართზე. კურიერს შესაბამისად შევუთანხმებთ [1].',
        },
      },
      {
        kind: 'answer',
        citations: [1],
        base: {
          en: 'If today doesn’t suit you, we can deliver tomorrow morning, 10:00–12:00, free of charge, and the courier will call 15 minutes ahead [1].',
          ka: 'თუ დღეს არ გაწყობთ, ხვალ დილით, 10:00–12:00-ზე უფასოდ მოგიტანთ და კურიერი 15 წუთით ადრე დაგირეკავთ [1].',
          ru: 'Если сегодня не подходит, привезём завтра утром, с 10:00 до 12:00, бесплатно. Курьер позвонит за 15 минут [1].',
        },
        shorter: {
          en: 'Or tomorrow, 10:00–12:00, free of charge. The courier calls 15 min ahead [1].',
          ka: 'ან ხვალ, 10:00–12:00-ზე, უფასოდ. კურიერი 15 წუთით ადრე დაგირეკავთ [1].',
        },
        warmer: {
          en: 'No worries if today is tricky. Tomorrow morning, 10:00–12:00, works too, delivery is free, and the courier will give you a call 15 minutes before [1].',
          ka: 'თუ დღეს გიჭირთ, არაუშავს. ხვალ დილით, 10:00–12:00-ზეც მოვასწრებთ, მიწოდება უფასოა და კურიერი 15 წუთით ადრე დაგირეკავთ [1].',
        },
        formal: {
          en: 'Alternatively, delivery can be arranged for tomorrow between 10:00 and 12:00 at no charge. The courier will phone you 15 minutes before arrival [1].',
          ka: 'სურვილის შემთხვევაში მიწოდება შესაძლებელია ხვალ, 10:00–12:00 საათებზე, უფასოდ. კურიერი ჩამოსვლამდე 15 წუთით ადრე დაგიკავშირდებათ [1].',
        },
      },
    ],
  },

  order_status: {
    commitment: true,
    knowledge: [
      {
        documentId: 'kb_order_status',
        title: { en: 'Order statuses', ka: 'შეკვეთის სტატუსები' },
        snippet: {
          en: 'Received, packed, with the courier, delivered. The tracking link arrives by SMS once the courier takes the parcel.',
          ka: 'მიღებულია, შეფუთულია, კურიერთანაა, ჩაბარებულია. თვალყურის მიდევნების ბმული SMS-ით მოდის, როგორც კი კურიერი ამანათს აიღებს.',
        },
      },
      {
        documentId: 'kb_late',
        title: { en: 'Late or missed deliveries', ka: 'დაგვიანებული ან გამოტოვებული მიწოდება' },
        snippet: {
          en: 'If a courier misses the slot, offer a priority delivery the same day or the next morning, and a 10% voucher on the next order.',
          ka: 'თუ კურიერმა დროის ინტერვალი გამოტოვა, შესთავაზეთ პრიორიტეტული მიწოდება იმავე დღეს ან მომდევნო დილით და 10%-იანი ვაუჩერი შემდეგ შეკვეთაზე.',
        },
      },
    ],
    suggestions: [
      {
        kind: 'answer',
        citations: [1, 2],
        base: {
          en: 'I checked your order: it is with the courier and can reach you today between 13:00 and 15:00 [1]. I’m sorry for the delay, a 10% voucher will follow [2].',
          ka: 'შეკვეთა გადავამოწმე: კურიერთანაა და დღესვე, 13:00–15:00 საათებში მოგიტანთ [1]. ბოდიშს გიხდით დაგვიანებისთვის, 10%-იან ვაუჩერსაც გამოგიგზავნით [2].',
          ru: 'Я проверил(а) заказ: он у курьера и будет у вас сегодня с 13:00 до 15:00 [1]. Извините за задержку, пришлём ваучер на 10% [2].',
        },
        shorter: {
          en: 'Your order is with the courier: today, 13:00–15:00 [1]. Sorry for the delay, a 10% voucher is coming [2].',
          ka: 'შეკვეთა კურიერთანაა: დღეს, 13:00–15:00-ზე [1]. ბოდიში დაგვიანებისთვის, 10%-იან ვაუჩერს გამოგიგზავნით [2].',
        },
        warmer: {
          en: 'Thanks for your patience! I checked and your order is with the courier now, arriving today between 13:00 and 15:00 [1]. I’m really sorry about the wait, so a 10% voucher is on its way to you [2].',
          ka: 'მადლობა მოთმინებისთვის! გადავამოწმე: შეკვეთა ახლა კურიერთანაა და დღესვე, 13:00–15:00 საათებში მოგიტანთ [1]. ძალიან ვწუხვარ ლოდინის გამო, ამიტომ 10%-იან ვაუჩერს გიგზავნით [2].',
        },
        formal: {
          en: 'Your order has been handed to the courier and is scheduled for delivery today between 13:00 and 15:00 [1]. We apologise for the delay; a 10% voucher will be issued for your next order [2].',
          ka: 'თქვენი შეკვეთა კურიერს გადაეცა და მიწოდება დაგეგმილია დღეს, 13:00–15:00 საათებში [1]. ბოდიშს გიხდით დაგვიანებისთვის; შემდეგ შეკვეთაზე 10%-იანი ვაუჩერი დაგერიცხებათ [2].',
        },
      },
      {
        kind: 'clarify',
        citations: [1],
        base: {
          en: 'Could you send me your order number? It starts with VZ-, and I’ll check its exact status [1].',
          ka: 'შეკვეთის ნომერს გამომიგზავნით? იწყება VZ-ით და ზუსტ სტატუსს გადავამოწმებ [1].',
          ru: 'Пришлёте номер заказа? Он начинается с VZ-, я проверю точный статус [1].',
        },
        shorter: {
          en: 'What is your order number (VZ-…)? [1]',
          ka: 'რა არის შეკვეთის ნომერი (VZ-…)? [1]',
        },
        warmer: {
          en: 'Happy to look into it! Could you send me your order number? It starts with VZ-, then I’ll check exactly where it is [1].',
          ka: 'სიამოვნებით გადავამოწმებ! შეკვეთის ნომერს გამომიგზავნით? იწყება VZ-ით და მაშინვე ვნახავ, ზუსტად სად არის [1].',
        },
        formal: {
          en: 'Please provide your order number, which begins with VZ-, so that we can verify its current status [1].',
          ka: 'გთხოვთ, მიუთითოთ შეკვეთის ნომერი, რომელიც იწყება VZ-ით, რათა მისი მიმდინარე სტატუსი გადავამოწმოთ [1].',
        },
      },
      {
        kind: 'answer',
        citations: [1],
        base: {
          en: 'You will receive a tracking link by SMS as soon as the courier takes the parcel. If it hasn’t arrived by 18:00, write to us here and I’ll check [1].',
          ka: 'თვალყურის მიდევნების ბმულს SMS-ით მიიღებთ, როგორც კი კურიერი ამანათს აიღებს. თუ 18:00-მდე არ მოვიდა, აქვე მოგვწერეთ და გადავამოწმებ [1].',
          ru: 'Ссылку для отслеживания вы получите по SMS, как только курьер заберёт посылку. Если к 18:00 её нет, напишите сюда, и я проверю [1].',
        },
        shorter: {
          en: 'A tracking link comes by SMS once the courier has the parcel. Nothing by 18:00? Write here [1].',
          ka: 'ბმული SMS-ით მოვა, როგორც კი კურიერი ამანათს აიღებს. 18:00-მდე თუ არა, აქვე მოგვწერეთ [1].',
        },
        warmer: {
          en: 'Good news: you’ll get a tracking link by SMS as soon as the courier picks up your parcel. If it’s not there by 18:00, just write here and I’ll personally check [1].',
          ka: 'კარგი ამბავია: თვალყურის მიდევნების ბმულს SMS-ით მიიღებთ, როგორც კი კურიერი ამანათს აიღებს. თუ 18:00-მდე არ მოვიდა, უბრალოდ აქვე მოგვწერეთ და თავად გადავამოწმებ [1].',
        },
        formal: {
          en: 'A tracking link will be sent to you by SMS once the courier has collected the parcel. Should it not arrive by 18:00, please contact us in this chat and we will investigate [1].',
          ka: 'თვალყურის მიდევნების ბმული გამოგეგზავნებათ SMS-ით, როდესაც კურიერი ამანათს აიღებს. თუ 18:00-მდე არ მიიღებთ, გთხოვთ, ამ ჩატში დაგვიკავშირდეთ და საკითხს გავარკვევთ [1].',
        },
      },
    ],
  },

  returns: {
    commitment: true,
    knowledge: [
      {
        documentId: 'kb_returns',
        title: { en: 'Returns policy', ka: 'დაბრუნების წესები' },
        snippet: {
          en: 'Unopened bottles can be returned within 14 days with the receipt. Opened wine cannot be returned.',
          ka: 'გაუხსნელი ბოთლის დაბრუნება შესაძლებელია 14 დღის განმავლობაში ჩეკით. გახსნილი ღვინის დაბრუნება არ შეიძლება.',
        },
      },
      {
        documentId: 'kb_damaged',
        title: { en: 'Damaged in transit', ka: 'ტრანსპორტირებისას დაზიანება' },
        snippet: {
          en: 'Ask for a photo of the box and the bottle within 48 hours. Send a free replacement or refund within 3 working days.',
          ka: 'მოითხოვეთ ყუთისა და ბოთლის ფოტო 48 საათის განმავლობაში. უფასო ჩანაცვლება ან თანხის დაბრუნება 3 სამუშაო დღეში.',
        },
      },
    ],
    suggestions: [
      {
        kind: 'answer',
        citations: [2],
        base: {
          en: 'I’m sorry the bottle arrived damaged. Please send a photo of the box and the bottle, and we’ll send a free replacement or refund you within 3 working days [2].',
          ka: 'ბოდიშს გიხდით, რომ ბოთლი დაზიანებული მოგივიდათ. გამომიგზავნეთ ყუთისა და ბოთლის ფოტო და 3 სამუშაო დღეში უფასოდ ჩავანაცვლებთ ან თანხას დაგიბრუნებთ [2].',
          ru: 'Сожалеем, что бутылка пришла повреждённой. Пришлите фото коробки и бутылки, и мы бесплатно заменим её или вернём деньги в течение 3 рабочих дней [2].',
        },
        shorter: {
          en: 'Sorry about the damaged bottle! Send a photo of the box and bottle: free replacement or refund within 3 working days [2].',
          ka: 'ბოდიში დაზიანებული ბოთლის გამო! გამომიგზავნეთ ყუთისა და ბოთლის ფოტო: უფასო ჩანაცვლება ან თანხის დაბრუნება 3 სამუშაო დღეში [2].',
        },
        warmer: {
          en: 'Oh no, I’m so sorry your bottle arrived damaged! If you can send me a photo of the box and the bottle, I’ll make sure you get a free replacement or a refund within 3 working days [2].',
          ka: 'ვაი, ძალიან ვწუხვარ, რომ ბოთლი დაზიანებული მოგივიდათ! თუ ყუთისა და ბოთლის ფოტოს გამომიგზავნით, უფასო ჩანაცვლებას ან თანხის დაბრუნებას 3 სამუშაო დღეში უზრუნველვყოფ [2].',
        },
        formal: {
          en: 'We regret that the bottle was damaged in transit. Kindly send a photograph of the packaging and the bottle; a free replacement or a refund will be processed within 3 working days [2].',
          ka: 'ვწუხვართ, რომ ბოთლი ტრანსპორტირებისას დაზიანდა. გთხოვთ, გამოგვიგზავნოთ შეფუთვისა და ბოთლის ფოტო; უფასო ჩანაცვლება ან თანხის დაბრუნება განხორციელდება 3 სამუშაო დღეში [2].',
        },
      },
      {
        kind: 'clarify',
        citations: [1],
        base: {
          en: 'Is the bottle still unopened? Unopened bottles can be returned within 14 days with the receipt [1].',
          ka: 'ბოთლი ჯერ გაუხსნელია? გაუხსნელი ბოთლის დაბრუნება შესაძლებელია 14 დღის განმავლობაში ჩეკით [1].',
          ru: 'Бутылка ещё не открыта? Нераспечатанные бутылки можно вернуть в течение 14 дней по чеку [1].',
        },
        shorter: {
          en: 'Is the bottle unopened? Returns are possible within 14 days with the receipt [1].',
          ka: 'ბოთლი გაუხსნელია? დაბრუნება შესაძლებელია 14 დღეში, ჩეკით [1].',
        },
        warmer: {
          en: 'Let’s sort this out together. Is the bottle still unopened? If so, you can return it within 14 days, just keep the receipt handy [1].',
          ka: 'ერთად მოვაგვაროთ. ბოთლი ჯერ გაუხსნელია? თუ ასეა, 14 დღის განმავლობაში შეგიძლიათ დააბრუნოთ, მხოლოდ ჩეკი შეინახეთ [1].',
        },
        formal: {
          en: 'Could you confirm whether the bottle is unopened? Unopened bottles may be returned within 14 days of purchase upon presentation of the receipt [1].',
          ka: 'გთხოვთ, დაადასტუროთ, გაუხსნელია თუ არა ბოთლი. გაუხსნელი ბოთლის დაბრუნება შესაძლებელია შეძენიდან 14 დღის განმავლობაში, ჩეკის წარდგენით [1].',
        },
      },
      {
        kind: 'answer',
        citations: [1],
        base: {
          en: 'To start a return, bring the bottle to our shop on Erekle II Street 14 or book a courier pickup. The refund goes back to your card within 3 working days [1].',
          ka: 'დასაბრუნებლად ბოთლი მოიტანეთ ჩვენს მაღაზიაში, ერეკლე II-ის ქუჩა 14, ან დაჯავშნეთ კურიერი. თანხა ბარათზე 3 სამუშაო დღეში დაგიბრუნდებათ [1].',
          ru: 'Чтобы оформить возврат, принесите бутылку в наш магазин на улице Ираклия II, 14, или закажите забор курьером. Деньги вернутся на карту в течение 3 рабочих дней [1].',
        },
        shorter: {
          en: 'Bring the bottle to Erekle II Street 14 or book a courier pickup. Refund to your card within 3 working days [1].',
          ka: 'მოიტანეთ ბოთლი ერეკლე II-ის ქუჩა 14-ში ან დაჯავშნეთ კურიერი. თანხა ბარათზე 3 სამუშაო დღეში დაგიბრუნდება [1].',
        },
        warmer: {
          en: 'Easy! You can drop the bottle off at our shop on Erekle II Street 14, or I can book a courier to collect it. Your money returns to your card within 3 working days [1].',
          ka: 'მარტივია! ბოთლი შეგიძლიათ მოიტანოთ ჩვენს მაღაზიაში, ერეკლე II-ის ქუჩა 14, ან კურიერს დაგიჯავშნით. თანხა ბარათზე 3 სამუშაო დღეში დაგიბრუნდებათ [1].',
        },
        formal: {
          en: 'To initiate a return, please bring the bottle to our shop at Erekle II Street 14 or arrange a courier collection. The refund will be credited to your card within 3 working days [1].',
          ka: 'დაბრუნების დასაწყებად გთხოვთ, ბოთლი მოიტანოთ ჩვენს მაღაზიაში (ერეკლე II-ის ქუჩა 14) ან დაჯავშნოთ კურიერის მომსახურება. თანხა თქვენს ბარათზე ჩაირიცხება 3 სამუშაო დღეში [1].',
        },
      },
    ],
  },

  payment: {
    commitment: false,
    knowledge: [
      {
        documentId: 'kb_payment',
        title: { en: 'Payment methods', ka: 'გადახდის მეთოდები' },
        snippet: {
          en: 'We accept cards, Apple Pay and cash on delivery in Tbilisi.',
          ka: 'ვიღებთ ბარათებს, Apple Pay-სა და ნაღდ ანგარიშსწორებას თბილისში მიწოდებისას.',
        },
      },
      {
        documentId: 'kb_pending',
        title: { en: 'Pending charges', ka: 'დაბლოკილი თანხა' },
        snippet: {
          en: 'A failed payment can show as pending. It is not captured, and the bank releases it within 3 working days.',
          ka: 'წარუმატებელი გადახდა შეიძლება „მოლოდინში“ გამოჩნდეს. თანხა არ ჩამოიჭრება და ბანკი 3 სამუშაო დღეში გაათავისუფლებს.',
        },
      },
    ],
    suggestions: [
      {
        kind: 'answer',
        citations: [2],
        base: {
          en: 'A pending amount after a failed payment is not charged. Your bank releases it within 3 working days [2].',
          ka: 'წარუმატებელი გადახდის შემდეგ დაბლოკილი თანხა არ ჩამოიჭრება. ბანკი მას 3 სამუშაო დღეში გაათავისუფლებს [2].',
          ru: 'Сумма в статусе ожидания после неудачной оплаты не списывается. Банк освободит её в течение 3 рабочих дней [2].',
        },
        shorter: {
          en: 'The pending amount isn’t charged; your bank releases it in 3 working days [2].',
          ka: 'დაბლოკილი თანხა არ ჩამოიჭრება; ბანკი 3 სამუშაო დღეში გაათავისუფლებს [2].',
        },
        warmer: {
          en: 'Please don’t worry, that amount has not been taken from you. It only looks pending, and your bank will release it within 3 working days [2].',
          ka: 'არ ინერვიულოთ, ეს თანხა არ ჩამოგჭრიათ. ის მხოლოდ დაბლოკილად ჩანს და ბანკი 3 სამუშაო დღეში გაათავისუფლებს [2].',
        },
        formal: {
          en: 'The pending amount resulting from the unsuccessful payment has not been captured and will be released by your bank within 3 working days [2].',
          ka: 'წარუმატებელი გადახდის შედეგად დაბლოკილი თანხა არ ჩამოჭრილა და თქვენი ბანკის მიერ გათავისუფლდება 3 სამუშაო დღეში [2].',
        },
      },
      {
        kind: 'clarify',
        citations: [1],
        base: {
          en: 'Which payment method did you use: card, Apple Pay or cash on delivery? [1]',
          ka: 'რომელი გადახდის მეთოდი გამოიყენეთ: ბარათი, Apple Pay თუ ნაღდი ანგარიშსწორება? [1]',
          ru: 'Каким способом вы платили: картой, Apple Pay или наличными при доставке? [1]',
        },
        shorter: {
          en: 'Card, Apple Pay or cash on delivery? [1]',
          ka: 'ბარათი, Apple Pay თუ ნაღდი ანგარიშსწორება? [1]',
        },
        warmer: {
          en: 'Let me help you with that! Which payment method did you use: card, Apple Pay or cash on delivery? [1]',
          ka: 'სიამოვნებით დაგეხმარებით! რომელი გადახდის მეთოდი გამოიყენეთ: ბარათი, Apple Pay თუ ნაღდი ანგარიშსწორება? [1]',
        },
        formal: {
          en: 'Please let us know which payment method was used: card, Apple Pay or cash on delivery [1].',
          ka: 'გთხოვთ, მიუთითოთ გამოყენებული გადახდის მეთოდი: ბარათი, Apple Pay ან ნაღდი ანგარიშსწორება [1].',
        },
      },
      {
        kind: 'escalate',
        citations: [2],
        base: {
          en: 'If the amount is still held after 3 working days, I’ll pass it to our accountant to check the transaction with the bank [2].',
          ka: 'თუ 3 სამუშაო დღის შემდეგაც თანხა დაბლოკილია, საკითხს ბუღალტერს გადავცემ, რომ ბანკთან ტრანზაქცია გადაამოწმოს [2].',
          ru: 'Если через 3 рабочих дня сумма всё ещё заблокирована, передам вопрос бухгалтеру, чтобы он проверил транзакцию в банке [2].',
        },
        shorter: {
          en: 'Still held after 3 working days? My accountant will check it with the bank [2].',
          ka: '3 სამუშაო დღის შემდეგაც დაბლოკილია? ბუღალტერი ბანკთან გადაამოწმებს [2].',
        },
        warmer: {
          en: 'And if it’s still held after 3 working days, just tell me. I’ll hand it to our accountant, who will sort it out with the bank for you [2].',
          ka: 'თუ 3 სამუშაო დღის შემდეგაც დაბლოკილი დარჩა, მითხარით. ბუღალტერს გადავცემ და ბანკთან თავად მოგიგვარებთ [2].',
        },
        formal: {
          en: 'Should the amount remain held after 3 working days, the matter will be escalated to our accounting department for verification with the bank [2].',
          ka: 'თუ თანხა 3 სამუშაო დღის შემდეგაც დაბლოკილი დარჩება, საკითხი გადაეცემა ბუღალტერიას ბანკთან გადასამოწმებლად [2].',
        },
      },
    ],
  },

  pairing: {
    commitment: false,
    knowledge: [
      {
        documentId: 'kb_pairing',
        title: { en: 'Wine pairing guide', ka: 'ღვინისა და კერძის შეხამება' },
        snippet: {
          en: 'Saperavi and Mukuzani suit grilled meat and mtsvadi. Amber Rkatsiteli from qvevri goes with cheese, khachapuri and walnut dishes.',
          ka: 'საფერავი და მუკუზანი მიესადაგება შემწვარ ხორცს და მწვადს. ქვევრის ქარვისფერი რქაწითელი ერგება ყველს, ხაჭაპურსა და ნიგვზიან კერძებს.',
        },
      },
      {
        documentId: 'kb_qvevri',
        title: { en: 'Qvevri wines', ka: 'ქვევრის ღვინოები' },
        snippet: {
          en: 'Qvevri wines are fermented on the skins; they are tannic and best served slightly cool, 14–16 °C.',
          ka: 'ქვევრის ღვინო ჭაჭაზე დუღდება; ტანინიანია და საუკეთესოა ოდნავ გრილი, 14–16 °C ტემპერატურაზე.',
        },
      },
    ],
    suggestions: [
      {
        kind: 'answer',
        citations: [1],
        base: {
          en: 'For grilled meat I’d suggest a Saperavi (Mukuzani is a lovely step up); for cheese and khachapuri, an amber Rkatsiteli from qvevri [1].',
          ka: 'შემწვარ ხორცთან გირჩევთ საფერავს (მუკუზანი კიდევ უფრო მაგარი არჩევანია), ყველთან და ხაჭაპურთან კი ქვევრის ქარვისფერ რქაწითელს [1].',
          ru: 'К мясу на гриле советую Саперави (Мукузани — ещё лучше), а к сыру и хачапури — янтарный Ркацители из квеври [1].',
        },
        shorter: {
          en: 'Grilled meat: Saperavi or Mukuzani. Cheese and khachapuri: amber Rkatsiteli [1].',
          ka: 'შემწვარ ხორცთან: საფერავი ან მუკუზანი. ყველთან და ხაჭაპურთან: ქარვისფერი რქაწითელი [1].',
        },
        warmer: {
          en: 'What a lovely menu! With grilled meat a Saperavi is a joy (Mukuzani is even better), and with cheese and khachapuri I’d reach for an amber Rkatsiteli from qvevri [1].',
          ka: 'რა მშვენიერი მენიუა! შემწვარ ხორცთან საფერავი სიამოვნებაა (მუკუზანი კიდევ უკეთესი), ყველთან და ხაჭაპურთან კი ქვევრის ქარვისფერ რქაწითელს ავირჩევდი [1].',
        },
        formal: {
          en: 'We recommend Saperavi or Mukuzani to accompany grilled meat, and an amber Rkatsiteli fermented in qvevri to accompany cheese and khachapuri [1].',
          ka: 'შემწვარი ხორცის გვერდით გირჩევთ საფერავს ან მუკუზანს, ყველისა და ხაჭაპურის გვერდით კი ქვევრში დაყენებულ ქარვისფერ რქაწითელს [1].',
        },
      },
      {
        kind: 'clarify',
        citations: [2],
        base: {
          en: 'What will you be serving, and roughly what budget per bottle? Then I can pick two or three for you [2].',
          ka: 'რას მიირთმევთ და დაახლოებით რა ბიუჯეტი გაქვთ ერთ ბოთლზე? მაშინ ორ-სამს შეგირჩევთ [2].',
          ru: 'Что будете подавать и какой примерный бюджет на бутылку? Тогда подберу две-три [2].',
        },
        shorter: {
          en: 'What are you serving, and what’s the budget per bottle? [2]',
          ka: 'რას მიირთმევთ და რა ბიუჯეტია ბოთლზე? [2]',
        },
        warmer: {
          en: 'I’d love to help you choose! What will you be serving, and roughly what budget per bottle do you have in mind? [2]',
          ka: 'სიამოვნებით დაგეხმარებით არჩევაში! რას მიირთმევთ და დაახლოებით რა ბიუჯეტს გულისხმობთ ერთ ბოთლზე? [2]',
        },
        formal: {
          en: 'To make a suitable recommendation, please tell us what you plan to serve and your approximate budget per bottle [2].',
          ka: 'შესაფერისი რეკომენდაციისთვის გთხოვთ, მიუთითოთ, რის მირთმევას გეგმავთ და ერთ ბოთლზე დაახლოებით რა ბიუჯეტი გაქვთ [2].',
        },
      },
    ],
  },

  gift: {
    commitment: false,
    knowledge: [
      {
        documentId: 'kb_gift_boxes',
        title: { en: 'Gift boxes', ka: 'სასაჩუქრე ყუთები' },
        snippet: {
          en: 'A two-bottle gift box comes with a handwritten card. Wrapping is free for orders above 80 ₾.',
          ka: 'ორბოთლიან სასაჩუქრე ყუთს ხელნაწერი ბარათი ახლავს. შეფუთვა უფასოა 80 ₾-ზე მეტი ღირებულების შეკვეთაზე.',
        },
      },
      {
        documentId: 'kb_gift_delivery',
        title: { en: 'Delivering a gift', ka: 'საჩუქრის მიწოდება' },
        snippet: {
          en: 'We can deliver to the recipient directly; the courier needs the address and a phone number. The price is not shown on the parcel.',
          ka: 'საჩუქარი შეგვიძლია პირდაპირ ადრესატს მივუტანოთ; კურიერს მისამართი და ტელეფონი სჭირდება. ფასი ამანათზე არ იწერება.',
        },
      },
    ],
    suggestions: [
      {
        kind: 'answer',
        citations: [1],
        base: {
          en: 'Our gift box holds two bottles with a handwritten card, and wrapping is free above 80 ₾ [1]. What message should we put on the card?',
          ka: 'ჩვენს სასაჩუქრე ყუთში ორი ბოთლი ეტევა ხელნაწერ ბარათთან ერთად, შეფუთვა კი 80 ₾-ზე მეტზე უფასოა [1]. რა ტექსტი დავწეროთ ბარათზე?',
          ru: 'В нашу подарочную коробку помещаются две бутылки с открыткой от руки, упаковка бесплатна при заказе от 80 ₾ [1]. Какой текст написать на открытке?',
        },
        shorter: {
          en: 'Gift box: two bottles, handwritten card, free wrapping above 80 ₾ [1]. What should the card say?',
          ka: 'სასაჩუქრე ყუთი: ორი ბოთლი, ხელნაწერი ბარათი, უფასო შეფუთვა 80 ₾-ზე მეტზე [1]. რა დავწეროთ ბარათზე?',
        },
        warmer: {
          en: 'What a thoughtful gift! Our box holds two bottles and comes with a handwritten card, and the wrapping is free above 80 ₾ [1]. What would you like the card to say?',
          ka: 'რა მომხიბვლელი საჩუქარია! ყუთში ორი ბოთლი ეტევა, ხელნაწერი ბარათიც ახლავს და 80 ₾-ზე მეტზე შეფუთვა უფასოა [1]. რა დავწეროთ ბარათზე?',
        },
        formal: {
          en: 'The gift box accommodates two bottles and includes a handwritten card; wrapping is complimentary for orders above 80 ₾ [1]. Please let us know the message for the card.',
          ka: 'სასაჩუქრე ყუთში ორი ბოთლი თავსდება და მას ხელნაწერი ბარათი ერთვის; შეფუთვა უფასოა 80 ₾-ზე მეტი ღირებულების შეკვეთისთვის [1]. გთხოვთ, მიუთითოთ ბარათის ტექსტი.',
        },
      },
      {
        kind: 'clarify',
        citations: [2],
        base: {
          en: 'Should we deliver it straight to the recipient? I’d need their address and a phone number for the courier [2].',
          ka: 'პირდაპირ ადრესატს მივუტანოთ? კურიერისთვის მისამართი და ტელეფონის ნომერი დამჭირდება [2].',
          ru: 'Доставить сразу получателю? Мне понадобятся его адрес и номер телефона для курьера [2].',
        },
        shorter: {
          en: 'Deliver straight to the recipient? I need the address and phone [2].',
          ka: 'პირდაპირ ადრესატს მივუტანოთ? მისამართი და ტელეფონი მჭირდება [2].',
        },
        warmer: {
          en: 'We can surprise them! Shall we deliver straight to the recipient? Just send me their address and phone number for the courier, and the price stays off the parcel [2].',
          ka: 'სიურპრიზს მოვუწყობთ! პირდაპირ ადრესატს მივუტანოთ? გამომიგზავნეთ მისამართი და ტელეფონი კურიერისთვის, ფასი კი ამანათზე არ ეწერება [2].',
        },
        formal: {
          en: 'Would you like the gift to be delivered directly to the recipient? If so, please provide their address and a contact phone number for the courier [2].',
          ka: 'გსურთ, საჩუქარი პირდაპირ ადრესატს მიეწოდოს? თუ ასეა, გთხოვთ, მიუთითოთ მისი მისამართი და საკონტაქტო ტელეფონი კურიერისთვის [2].',
        },
      },
    ],
  },

  corporate: {
    commitment: false,
    knowledge: [
      {
        documentId: 'kb_corporate',
        title: { en: 'Corporate orders', ka: 'კორპორატიული შეკვეთები' },
        snippet: {
          en: 'Companies get an invoice and a volume discount from 12 bottles. Office delivery and team tastings can be arranged.',
          ka: 'კომპანიებს ეძლევათ ინვოისი და მოცულობითი ფასდაკლება 12 ბოთლიდან. შესაძლებელია ოფისში მიწოდება და გუნდური დეგუსტაცია.',
        },
      },
      {
        documentId: 'kb_invoice',
        title: { en: 'Invoices for companies', ka: 'ინვოისი კომპანიებისთვის' },
        snippet: {
          en: 'We need the company name and ID code. The invoice is emailed within one working day.',
          ka: 'გვჭირდება კომპანიის სახელი და საიდენტიფიკაციო კოდი. ინვოისი ელფოსტით იგზავნება ერთ სამუშაო დღეში.',
        },
      },
    ],
    suggestions: [
      {
        kind: 'answer',
        citations: [1],
        base: {
          en: 'For companies we offer invoicing and a volume discount from 12 bottles [1]. How many bottles do you have in mind?',
          ka: 'კომპანიებისთვის გვაქვს ინვოისით გადახდა და მოცულობითი ფასდაკლება 12 ბოთლიდან [1]. რამდენი ბოთლი გაინტერესებთ?',
          ru: 'Для компаний у нас есть оплата по счёту и скидка за объём от 12 бутылок [1]. Сколько бутылок вас интересует?',
        },
        shorter: {
          en: 'Companies get an invoice and a volume discount from 12 bottles [1]. How many bottles?',
          ka: 'კომპანიებს ინვოისი და მოცულობითი ფასდაკლება აქვთ 12 ბოთლიდან [1]. რამდენი ბოთლი გჭირდებათ?',
        },
        warmer: {
          en: 'We’d be delighted to supply your team! Companies get invoicing and a volume discount from 12 bottles [1]. How many bottles are you thinking of?',
          ka: 'სიამოვნებით მოვემსახურებით თქვენს გუნდს! კომპანიებისთვის გვაქვს ინვოისით გადახდა და მოცულობითი ფასდაკლება 12 ბოთლიდან [1]. რამდენ ბოთლზე ფიქრობთ?',
        },
        formal: {
          en: 'We offer corporate clients invoice payment and a volume discount on orders from 12 bottles [1]. Could you indicate the approximate quantity required?',
          ka: 'კორპორატიულ კლიენტებს გთავაზობთ ინვოისით გადახდას და მოცულობით ფასდაკლებას 12 ბოთლიდან [1]. გთხოვთ, მიუთითოთ საჭირო რაოდენობა დაახლოებით.',
        },
      },
      {
        kind: 'clarify',
        citations: [2],
        base: {
          en: 'Please send the company name and ID code, and I’ll email the invoice to your accountant [2].',
          ka: 'გამომიგზავნეთ კომპანიის სახელი და საიდენტიფიკაციო კოდი და ინვოისს თქვენს ბუღალტერს ელფოსტით გავუგზავნი [2].',
          ru: 'Пришлите название компании и идентификационный код, и я отправлю счёт вашему бухгалтеру по почте [2].',
        },
        shorter: {
          en: 'Company name and ID code, please, and the invoice goes to your accountant [2].',
          ka: 'კომპანიის სახელი და საიდენტიფიკაციო კოდი, გთხოვთ, ინვოისი ბუღალტერს გაეგზავნება [2].',
        },
        warmer: {
          en: 'Happy to arrange that! If you send me the company name and ID code, I’ll email the invoice straight to your accountant [2].',
          ka: 'სიამოვნებით მოვაგვარებ! კომპანიის სახელსა და საიდენტიფიკაციო კოდს თუ გამომიგზავნით, ინვოისს პირდაპირ თქვენს ბუღალტერს ელფოსტით გავუგზავნი [2].',
        },
        formal: {
          en: 'To issue the invoice, please provide the company name and ID code; it will be sent by email to your accounting department within one working day [2].',
          ka: 'ინვოისის გასაფორმებლად გთხოვთ, მიუთითოთ კომპანიის სახელი და საიდენტიფიკაციო კოდი; ის ელფოსტით გაეგზავნება თქვენს ბუღალტერიას ერთ სამუშაო დღეში [2].',
        },
      },
    ],
  },

  other: {
    commitment: false,
    knowledge: [
      {
        documentId: 'kb_contact',
        title: { en: 'Shop and contact', ka: 'მაღაზია და კონტაქტი' },
        snippet: {
          en: 'The Vazi shop is on Erekle II Street 14, Tbilisi. Orders and questions are answered in this chat in Georgian, English and Russian.',
          ka: 'ვაზის მაღაზია მდებარეობს თბილისში, ერეკლე II-ის ქუჩა 14. შეკვეთებსა და კითხვებს ამ ჩატში ვპასუხობთ ქართულად, ინგლისურად და რუსულად.',
        },
      },
    ],
    suggestions: [
      {
        kind: 'clarify',
        citations: [1],
        base: {
          en: 'Could you tell me a little more about what you need, so I can point you to the right person? [1]',
          ka: 'შეგიძლიათ, ცოტა უფრო დაწვრილებით მითხრათ, რა გჭირდებათ, რომ სწორ ადამიანს მივმართო? [1]',
          ru: 'Расскажите, пожалуйста, чуть подробнее, что вам нужно, чтобы я направил(а) вас к нужному человеку [1].',
        },
        shorter: {
          en: 'Could you tell me a bit more about what you need? [1]',
          ka: 'რა გჭირდებათ, ცოტა უფრო დაწვრილებით მითხარით. [1]',
        },
        warmer: {
          en: 'Of course, I’m happy to help! Could you tell me a little more about what you need, so I can point you to the right person? [1]',
          ka: 'რა თქმა უნდა, სიამოვნებით დაგეხმარებით! ცოტა უფრო დაწვრილებით მითხარით, რა გჭირდებათ, რომ სწორ ადამიანს მივმართო. [1]',
        },
        formal: {
          en: 'Could you kindly provide further details of your request so that we can direct it to the appropriate colleague? [1]',
          ka: 'გთხოვთ, დააკონკრეტოთ თქვენი მოთხოვნა, რათა იგი შესაბამის კოლეგას გადავუგზავნოთ. [1]',
        },
      },
      {
        kind: 'answer',
        citations: [1],
        base: {
          en: 'You can also visit our shop on Erekle II Street 14 in Tbilisi, and we’re happy to answer questions here in Georgian, English or Russian [1].',
          ka: 'ასევე შეგიძლიათ ეწვიოთ ჩვენს მაღაზიას თბილისში, ერეკლე II-ის ქუჩა 14, ხოლო კითხვებს აქ სიამოვნებით ვპასუხობთ ქართულად, ინგლისურად ან რუსულად [1].',
          ru: 'Вы также можете зайти в наш магазин в Тбилиси, улица Ираклия II, 14, а на вопросы здесь мы с радостью ответим по-грузински, по-английски или по-русски [1].',
        },
        shorter: {
          en: 'Visit us at Erekle II Street 14, Tbilisi, or ask here in Georgian, English or Russian [1].',
          ka: 'ეწვიეთ ერეკლე II-ის ქუჩა 14-ში ან აქ დასვით შეკითხვა ქართულად, ინგლისურად ან რუსულად [1].',
        },
        warmer: {
          en: 'We’d love to see you at our shop on Erekle II Street 14 in Tbilisi, and you’re always welcome to ask here in Georgian, English or Russian [1].',
          ka: 'სიამოვნებით გიმასპინძლებთ ჩვენს მაღაზიაში, თბილისში, ერეკლე II-ის ქუჩა 14, აქ კი ქართულად, ინგლისურად ან რუსულად ნებისმიერ დროს შეგიძლიათ შეკითხვა დასვათ [1].',
        },
        formal: {
          en: 'Our shop is located at Erekle II Street 14, Tbilisi. Enquiries in this chat are handled in Georgian, English and Russian [1].',
          ka: 'ჩვენი მაღაზია მდებარეობს თბილისში, ერეკლე II-ის ქუჩა 14. ამ ჩატში შეკითხვებს ვამუშავებთ ქართულად, ინგლისურად და რუსულად [1].',
        },
      },
    ],
  },
}

/** Single escalate suggestion used when the customer asks for a manager or complains. */
export const ESCALATE_CONTENT: { knowledge: KnowledgeSpec[]; suggestion: SuggestionSpec; summary: Duo; goal: Duo } = {
  knowledge: [
    {
      documentId: 'kb_escalation',
      title: { en: 'Escalation to a manager', ka: 'საკითხის მენეჯერისთვის გადაცემა' },
      snippet: {
        en: 'Complaints and requests beyond the standard policy go to the duty manager, who replies in the same chat within the hour.',
        ka: 'საჩივრები და სტანდარტულ წესებს მიღმა მოთხოვნები გადაეცემა მორიგე მენეჯერს, რომელიც იმავე ჩატში პასუხობს ერთი საათის განმავლობაში.',
      },
    },
  ],
  suggestion: {
    kind: 'escalate',
    citations: [1],
    base: {
      en: 'I understand, and I want to resolve this properly. I’m passing your case to our manager, who will contact you here within the hour [1].',
      ka: 'მესმის თქვენი და სწორად მინდა გადავწყვიტო საკითხი. საქმეს მენეჯერს გადავცემ, ის ერთი საათის განმავლობაში აქვე დაგიკავშირდებათ [1].',
      ru: 'Понимаю вас и хочу решить вопрос как следует. Передаю ваше обращение менеджеру, он свяжется с вами здесь в течение часа [1].',
    },
    shorter: {
      en: 'I’m passing this to our manager, who will reply here within the hour [1].',
      ka: 'საკითხს მენეჯერს გადავცემ, ის ერთ საათში აქვე გიპასუხებთ [1].',
    },
    warmer: {
      en: 'I’m really sorry this has been such a hassle. I’m personally passing your case to our manager, who will get back to you here within the hour [1].',
      ka: 'ძალიან ვწუხვარ, რომ ასეთი უხერხულობა შეგექმნათ. თქვენს საქმეს პირადად გადავცემ მენეჯერს, რომელიც ერთი საათის განმავლობაში აქვე დაგიბრუნდებათ [1].',
    },
    formal: {
      en: 'Your case has been escalated to our duty manager, who will respond in this chat within one hour [1].',
      ka: 'თქვენი საქმე გადაეცა მორიგე მენეჯერს, რომელიც ამ ჩატში ერთი საათის განმავლობაში გიპასუხებთ [1].',
    },
  },
  summary: {
    en: 'The customer is asking for a manager or has raised a complaint that goes beyond the standard policy.',
    ka: 'კლიენტი მენეჯერს ითხოვს ან სტანდარტულ წესებს მიღმა მოთხოვნით საჩივარი აქვს გამოთქმული.',
  },
  goal: {
    en: 'Hand over to a manager and agree a goodwill gesture.',
    ka: 'საკითხის მენეჯერისთვის გადაცემა და კომპენსაციაზე შეთანხმება.',
  },
}

/** The customer asks for a manager / files a complaint: Copilot recommends escalating. */
export const ESCALATE_RE = /manager|supervisor|complaint|lawyer|unacceptable|მენეჯერ|საჩივარ|ადვოკატ|მიუღებელი|менеджер|жалоб|юрист/i

/** A short thank-you or acknowledgement: nothing to suggest. */
export const ACK_RE = /^(ok(ay)?|thanks?( you)?|thank you so much|thx|great|perfect|👍|🙏|მადლობა|დიდი მადლობა|გმადლობთ|კარგი|კარგით|გასაგებია|ბარო|спасибо|хорошо|ок)[\s!.🙏👍]*$/i

const RU_TONE: Record<Exclude<Tone, 'base'>, (text: string) => string> = {
  shorter: (text) => text.split(/(?<=[.!?])\s/)[0] ?? text,
  warmer: (text) => `Спасибо за терпение! ${text}`,
  formal: (text) => `Здравствуйте! ${text}`,
}

/** The text of one suggestion for a language and tone. */
export function suggestionText(spec: SuggestionSpec, lang: ContentLang, tone: Tone): string {
  if (tone === 'base') return spec.base[lang]
  if (lang === 'ru') return RU_TONE[tone](spec.base.ru)
  return spec[tone][lang]
}

/** Language / tone after applying a transform to the current state. */
export function applyTransform(state: { lang: ContentLang; tone: Tone }, transform: CopilotTransform): { lang: ContentLang; tone: Tone } {
  switch (transform) {
    case 'shorter':
      return { lang: state.lang, tone: 'shorter' }
    case 'warmer':
      return { lang: state.lang, tone: 'warmer' }
    case 'formal':
      return { lang: state.lang, tone: 'formal' }
    case 'to_ru':
      return { lang: 'ru', tone: state.tone }
    case 'to_ka':
      return { lang: 'ka', tone: state.tone }
    case 'to_en':
      return { lang: 'en', tone: state.tone }
  }
}
