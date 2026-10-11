/**
 * Scripted content for the customer widget (owner: widget group).
 * - the bot's knowledge entries (en / ka / ru keywords, answers, citations)
 * - the bot's fixed lines (greeting, clarification, hand-off acknowledgements)
 * - the canned lines Mariam answers with when nobody drives the operator inbox.
 * Pure data and pure helpers: no store access, no timers.
 */
import type { ContentLang, SessionTopic } from '@/types'

type Text3 = Record<ContentLang, string>

export const BOT_DISPLAY_NAME = 'Chiti Assistant'

/* ------------------------------------------------------------- knowledge */

export interface KnowledgeEntry {
  id: string
  topic: SessionTopic
  /** Shown as the citation chip under the answer. */
  title: Text3
  /** Lower-case fragments; Georgian and Russian ones are stems so inflections match. */
  keywords: Record<ContentLang, string[]>
  answer: Text3
}

export const KNOWLEDGE: KnowledgeEntry[] = [
  {
    id: 'kb_delivery_tbilisi',
    topic: 'delivery',
    title: { en: 'Delivery in Tbilisi', ka: 'მიტანა თბილისში', ru: 'Доставка по Тбилиси' },
    keywords: {
      en: ['tbilisi', 'same day', 'same-day', 'delivery time', 'deliver today', 'how fast', 'when will', 'delivery zone', 'delivery'],
      ka: ['თბილის', 'იმავე დღეს', 'მიტანის დრო', 'მიტანა', 'მოგიტან', 'როდის მივიღებ', 'მიწოდება'],
      ru: ['тбилис', 'в тот же день', 'срок доставки', 'доставк', 'когда привез'],
    },
    answer: {
      en: 'In Tbilisi we deliver the same day for orders placed before 16:00, and the next morning after that. Delivery is free from 120 ₾.',
      ka: 'თბილისში 16:00-მდე გაფორმებულ შეკვეთას იმავე დღეს მოგიტანთ, უფრო გვიან გაფორმებულს - მეორე დილით. მიტანა 120 ₾-დან უფასოა.',
      ru: 'По Тбилиси заказы до 16:00 доставляем в тот же день, позже - на следующее утро. Доставка бесплатна от 120 ₾.',
    },
  },
  {
    id: 'kb_delivery_regions',
    topic: 'delivery',
    title: { en: 'Delivery to other cities', ka: 'მიტანა სხვა ქალაქებში', ru: 'Доставка в другие города' },
    keywords: {
      en: ['batumi', 'kutaisi', 'telavi', 'other city', 'other cities', 'region', 'outside tbilisi', 'courier', 'rustavi', 'mtskheta'],
      ka: ['ბათუმ', 'ქუთაის', 'თელავ', 'რეგიონ', 'სხვა ქალაქ', 'კურიერ', 'რუსთავ', 'მცხეთ'],
      ru: ['батуми', 'кутаис', 'телав', 'регион', 'другие города', 'курьер', 'рустав'],
    },
    answer: {
      en: 'Batumi, Kutaisi and Telavi: 1-2 working days by courier for 8 ₾. Other towns: 2-3 working days.',
      ka: 'ბათუმი, ქუთაისი და თელავი: 1-2 სამუშაო დღე კურიერით, 8 ₾. სხვა ქალაქები: 2-3 სამუშაო დღე.',
      ru: 'Батуми, Кутаиси и Телави: 1-2 рабочих дня курьером, 8 ₾. Другие города: 2-3 рабочих дня.',
    },
  },
  {
    id: 'kb_delivery_cost',
    topic: 'delivery',
    title: { en: 'Delivery fees', ka: 'მიტანის საფასური', ru: 'Стоимость доставки' },
    keywords: {
      en: ['delivery fee', 'delivery cost', 'shipping cost', 'shipping fee', 'free delivery', 'free shipping', 'how much is delivery', 'minimum order'],
      ka: ['მიტანის ფასი', 'მიტანის საფასური', 'უფასო მიტანა', 'რა ღირს მიტანა', 'მიტანა რა ღირს', 'მინიმალური შეკვეთ'],
      ru: ['стоимость доставки', 'бесплатная доставка', 'сколько стоит доставка', 'минимальный заказ'],
    },
    answer: {
      en: 'Delivery in Tbilisi is free from 120 ₾ and 6 ₾ below that. Courier delivery to Batumi, Kutaisi and Telavi is 8 ₾.',
      ka: 'თბილისში მიტანა 120 ₾-დან უფასოა, ნაკლებზე - 6 ₾. ბათუმში, ქუთაისსა და თელავში კურიერით მიტანა 8 ₾-ია.',
      ru: 'Доставка по Тбилиси бесплатна от 120 ₾, ниже - 6 ₾. Курьером в Батуми, Кутаиси и Телави - 8 ₾.',
    },
  },
  {
    id: 'kb_order_status',
    topic: 'order_status',
    title: { en: 'Where is my order?', ka: 'სად არის ჩემი შეკვეთა?', ru: 'Где мой заказ?' },
    keywords: {
      en: ['order status', 'where is my order', 'my order', 'track', 'tracking', 'late', 'not arrived', "hasn't arrived", 'has not arrived', 'delayed'],
      ka: ['შეკვეთის სტატუს', 'სად არის', 'აგვიანებს', 'არ მოსულა', 'არ მომიტანეს', 'ტრექინგ', 'შეკვეთა'],
      ru: ['статус заказа', 'где мой заказ', 'опаздывает', 'не пришёл', 'не пришел', 'отследить', 'заказ'],
    },
    answer: {
      en: 'Sorry for the wait! The link in your confirmation SMS shows where the courier is. If the order is more than a day late, send us your order number and a colleague will check it.',
      ka: 'ბოდიში ლოდინისთვის! დადასტურების SMS-ში მიღებული ბმულით ნახავთ, სადაა კურიერი. თუ შეკვეთა ერთ დღეზე მეტით აგვიანებს, მოგვწერეთ შეკვეთის ნომერი და კოლეგა გადაამოწმებს.',
      ru: 'Извините за ожидание! Ссылка в SMS с подтверждением показывает, где курьер. Если заказ опаздывает больше чем на день, пришлите номер заказа, и коллега проверит.',
    },
  },
  {
    id: 'kb_change_order',
    topic: 'order_status',
    title: { en: 'Changing an order', ka: 'შეკვეთის შეცვლა', ru: 'Изменение заказа' },
    keywords: {
      en: ['change my order', 'change order', 'cancel', 'modify', 'edit my order', 'add a bottle', 'change address', 'change the address'],
      ka: ['შეკვეთის შეცვლა', 'გაუქმება', 'გავაუქმო', 'მისამართის შეცვლა', 'დავამატო', 'შევცვალო'],
      ru: ['изменить заказ', 'отменить', 'отмена', 'сменить адрес', 'добавить бутылку'],
    },
    answer: {
      en: 'Orders can be changed or cancelled until the courier picks them up. I can pass this to a colleague who will update it right away - just say "operator".',
      ka: 'შეკვეთის შეცვლა ან გაუქმება შეიძლება, სანამ კურიერი არ წაიღებს. კოლეგას გადავცემ, ახლავე განაახლებს - დაწერეთ „ოპერატორი“.',
      ru: 'Заказ можно изменить или отменить, пока его не забрал курьер. Могу передать коллеге, он обновит сразу - напишите «оператор».',
    },
  },
  {
    id: 'kb_returns',
    topic: 'returns',
    title: { en: 'Returns policy', ka: 'დაბრუნების პირობები', ru: 'Условия возврата' },
    keywords: {
      en: ['return', 'refund', 'money back', 'send back', 'exchange'],
      ka: ['დაბრუნ', 'თანხის დაბრუნება', 'გაცვლა', 'ფულის დაბრუნება'],
      ru: ['возврат', 'вернуть', 'обмен', 'деньги обратно'],
    },
    answer: {
      en: 'Unopened wine can be returned within 14 days of delivery. Keep the bottle in its box and we will arrange the pickup and refund.',
      ka: 'გაუხსნელი ღვინის დაბრუნება მიტანიდან 14 დღის განმავლობაში შეიძლება. ბოთლი ყუთში შეინახეთ, ჩვენ მივაკითხავთ და თანხას დაგიბრუნებთ.',
      ru: 'Неоткрытое вино можно вернуть в течение 14 дней после доставки. Оставьте бутылку в коробке, мы организуем забор и вернём деньги.',
    },
  },
  {
    id: 'kb_broken',
    topic: 'returns',
    title: { en: 'Broken or damaged bottles', ka: 'გატეხილი ბოთლი', ru: 'Разбитые бутылки' },
    keywords: {
      en: ['broken', 'broke', 'damaged', 'leak', 'smashed', 'cracked', 'bottle arrived'],
      ka: ['გატეხ', 'დაზიან', 'გაჟონ', 'ჩამტვრეულ', 'ბოთლი მოვიდა'],
      ru: ['разбит', 'сломан', 'повреждён', 'повреждена', 'протекает', 'треснул'],
    },
    answer: {
      en: 'A bottle arrived broken? Send us a photo within 48 hours and we will replace it for free. You can attach the photo right here.',
      ka: 'ბოთლი გატეხილი მოვიდა? 48 საათში გამოგვიგზავნეთ ფოტო და უფასოდ შეგიცვლით. ფოტოს აქვე დაურთეთ.',
      ru: 'Бутылка пришла разбитой? Пришлите фото в течение 48 часов, и мы бесплатно её заменим. Фото можно приложить прямо здесь.',
    },
  },
  {
    id: 'kb_payment',
    topic: 'payment',
    title: { en: 'Payment methods', ka: 'გადახდის მეთოდები', ru: 'Способы оплаты' },
    keywords: {
      en: ['pay', 'payment', 'card', 'apple pay', 'cash', 'invoice', 'visa', 'mastercard', 'installment'],
      ka: ['გადახდ', 'ბარათ', 'ნაღდი', 'ინვოის', 'გადავიხადო', 'განვადებ'],
      ru: ['оплат', 'карт', 'наличн', 'счёт', 'счет', 'рассрочк'],
    },
    answer: {
      en: 'We accept cards, Apple Pay and cash on delivery in Tbilisi. Companies can pay by invoice.',
      ka: 'ვიღებთ ბარათს, Apple Pay-ს და თბილისში ნაღდ ანგარიშსწორებას მიტანისას. კომპანიებს ინვოისით გადახდაც შეუძლიათ.',
      ru: 'Принимаем карты, Apple Pay и наличные при доставке по Тбилиси. Компании могут оплатить по счёту.',
    },
  },
  {
    id: 'kb_pairing',
    topic: 'pairing',
    title: { en: 'Food pairing advice', ka: 'ღვინო და კერძი', ru: 'Вино к блюдам' },
    keywords: {
      en: ['pair', 'pairing', 'goes with', 'go with', 'recommend', 'which wine', 'what wine', 'khachapuri', 'steak', 'cheese', 'dinner', 'shashlik', 'mtsvadi'],
      ka: ['რომელი ღვინო', 'რეკომენდაც', 'შეუწყობ', 'მიესადაგ', 'ხაჭაპურ', 'მწვადი', 'ყველ', 'სადილ', 'ვახშამ'],
      ru: ['какое вино', 'посоветуй', 'порекоменд', 'сочета', 'хачапури', 'мясо', 'сыр', 'ужин', 'шашлык'],
    },
    answer: {
      en: 'Quick pairing guide: Saperavi or Mukuzani with grilled meat and mtsvadi, amber Rkatsiteli with khachapuri and aged cheeses, crisp Mtsvane with fish and salads, semi-sweet Kindzmarauli with desserts. Tell me the dish and I will narrow it down.',
      ka: 'მოკლე გზამკვლევი: საფერავი ან მუკუზანი - მწვადთან და შემწვარ ხორცთან, ქარვისფერი რქაწითელი - ხაჭაპურთან და დავარგებულ ყველთან, მწვანე - თევზთან და სალათებთან, ნახევრადტკბილი ქინძმარაული - დესერტთან. მითხარით კერძი და უფრო დავაზუსტებ.',
      ru: 'Коротко: Саперави или Мукузани - к мясу на углях, янтарный Ркацители - к хачапури и выдержанным сырам, свежий Мцване - к рыбе и салатам, полусладкий Киндзмараули - к десертам. Назовите блюдо, и я уточню.',
    },
  },
  {
    id: 'kb_gift',
    topic: 'gift',
    title: { en: 'Gift wrapping', ka: 'საჩუქრად შეფუთვა', ru: 'Подарочная упаковка' },
    keywords: {
      en: ['gift', 'wrap', 'wrapping', 'present', 'card message', 'birthday', 'box'],
      ka: ['საჩუქ', 'შეფუთ', 'ყუთი', 'დაბადების დღე', 'ბარათი'],
      ru: ['подар', 'упаков', 'коробк', 'открытк', 'день рождения'],
    },
    answer: {
      en: 'Gift boxes for 1-3 bottles start at 12 ₾, with a free handwritten card. Add your message at checkout or tell us here.',
      ka: 'საჩუქრის ყუთები 1-3 ბოთლისთვის 12 ₾-დან, ხელით დაწერილი ბარათი უფასოა. ტექსტი შეკვეთისას მიუთითეთ ან აქვე მოგვწერეთ.',
      ru: 'Подарочные коробки на 1-3 бутылки от 12 ₾, открытка от руки бесплатно. Текст можно указать при заказе или написать здесь.',
    },
  },
  {
    id: 'kb_corporate',
    topic: 'corporate',
    title: { en: 'Corporate orders', ka: 'კორპორატიული შეკვეთები', ru: 'Корпоративные заказы' },
    keywords: {
      en: ['corporate', 'company', 'business', 'bulk', 'wholesale', 'office', 'event', 'wedding', '24 bottles', 'discount'],
      ka: ['კორპორატ', 'კომპან', 'ბიზნეს', 'საბითუმო', 'ოფის', 'ღონისძიებ', 'ქორწილ', 'ფასდაკლებ'],
      ru: ['корпоратив', 'компани', 'бизнес', 'опт', 'офис', 'мероприят', 'свадьб', 'скидк'],
    },
    answer: {
      en: 'From 24 bottles companies get 12% off, with invoice payment and a dedicated delivery slot. A colleague can prepare an offer - just say "operator".',
      ka: '24 ბოთლიდან კომპანიებს 12% ფასდაკლება აქვთ, ინვოისით გადახდითა და ცალკე მიტანის დროით. კოლეგა შეთავაზებას მოგიმზადებთ - დაწერეთ „ოპერატორი“.',
      ru: 'От 24 бутылок компаниям скидка 12%, оплата по счёту и отдельное окно доставки. Коллега подготовит предложение - напишите «оператор».',
    },
  },
  {
    id: 'kb_hours',
    topic: 'other',
    title: { en: 'Opening hours', ka: 'სამუშაო საათები', ru: 'Часы работы' },
    keywords: {
      en: ['opening hours', 'open', 'close', 'closing', 'hours', 'sunday', 'saturday', 'what time', 'working hours'],
      ka: ['სამუშაო საათ', 'როდის მუშაობ', 'ღიაა', 'დაკეტილ', 'კვირა', 'შაბათ', 'რომელ საათზე'],
      ru: ['часы работы', 'режим работы', 'открыт', 'закрыт', 'воскресенье', 'суббота', 'во сколько'],
    },
    answer: {
      en: 'We are open Monday to Saturday, 09:00-21:00, and closed on Sundays. Orders placed on Sunday are delivered on Monday.',
      ka: 'ორშაბათიდან შაბათის ჩათვლით ვმუშაობთ 09:00-დან 21:00-მდე, კვირას დასვენება გვაქვს. კვირას გაფორმებულ შეკვეთას ორშაბათს მოგიტანთ.',
      ru: 'Работаем с понедельника по субботу, 09:00-21:00, в воскресенье выходной. Заказы, оформленные в воскресенье, доставляем в понедельник.',
    },
  },
  {
    id: 'kb_qvevri',
    topic: 'pairing',
    title: { en: 'Qvevri wines', ka: 'ქვევრის ღვინოები', ru: 'Вина из квеври' },
    keywords: {
      en: ['qvevri', 'kvevri', 'amber', 'orange wine', 'skin contact', 'traditional', 'clay'],
      ka: ['ქვევრ', 'ქარვის', 'ტრადიციულ', 'კახური', 'ჭაჭ'],
      ru: ['квеври', 'янтарн', 'оранжев', 'традицион', 'глин'],
    },
    answer: {
      en: 'Qvevri wines are fermented and aged in buried clay vessels, white grapes together with their skins, which gives amber colour and a gentle tannic grip. Our Rkatsiteli Qvevri is a good first bottle; serve it slightly cool, around 14 °C.',
      ka: 'ქვევრის ღვინოს მიწაში ჩაფლულ თიხის ჭურჭელში ადუღებენ და აძველებენ, თეთრ ყურძენს კანთან ერთად - აქედან მოდის ქარვისფერი და რბილი ტანინი. რქაწითელი ქვევრი კარგი პირველი არჩევანია; მიირთვით ოდნავ გაგრილებული, დაახლოებით 14 °C.',
      ru: 'Вина из квеври бродят и выдерживаются в зарытых глиняных сосудах, белый виноград - вместе с кожурой, отсюда янтарный цвет и мягкие танины. Наш Ркацители Квеври - хорошая первая бутылка; подавайте слегка охлаждённым, около 14 °C.',
    },
  },
  {
    id: 'kb_age',
    topic: 'other',
    title: { en: 'Age check', ka: 'ასაკის შემოწმება', ru: 'Проверка возраста' },
    keywords: {
      en: ['age', '18', '21', 'id', 'passport', 'underage', 'minimum age', 'how old'],
      ka: ['ასაკ', '18', '21', 'პირადობ', 'პასპორტ', 'არასრულწლოვან'],
      ru: ['возраст', '18', '21', 'паспорт', 'удостоверени', 'несовершеннолет'],
    },
    answer: {
      en: 'Wine is sold to customers aged 21 and over. The courier checks an ID at the door, so please have it ready.',
      ka: 'ღვინო იყიდება 21 წლის და უფროსი ასაკის მომხმარებლებზე. კურიერი კართან პირადობას გადაამოწმებს, გთხოვთ, მზად გქონდეთ.',
      ru: 'Вино продаётся клиентам от 21 года. Курьер проверяет документ у двери, пожалуйста, приготовьте его.',
    },
  },
  {
    id: 'kb_storage',
    topic: 'pairing',
    title: { en: 'Storing and serving', ka: 'შენახვა და მირთმევა', ru: 'Хранение и подача' },
    keywords: {
      en: ['store', 'storage', 'serve', 'serving', 'temperature', 'decant', 'fridge', 'open bottle', 'how long'],
      ka: ['შენახ', 'მირთმ', 'ტემპერატურ', 'გაციებ', 'ცივი', 'გახსნილი ბოთლი', 'რამდენ ხანს'],
      ru: ['хранить', 'хранение', 'подава', 'температур', 'декант', 'холодильник', 'открытая бутылка'],
    },
    answer: {
      en: 'Keep bottles lying down in a cool, dark place. Serve reds at 16-18 °C, whites and amber wines at 10-14 °C. An opened bottle keeps 2-3 days with a stopper in the fridge.',
      ka: 'ბოთლები გრილ, ბნელ ადგილას დაწვენილად შეინახეთ. წითელი 16-18 °C-ზე მიირთვით, თეთრი და ქარვისფერი - 10-14 °C-ზე. გახსნილი ბოთლი საცობით მაცივარში 2-3 დღე გასტანს.',
      ru: 'Храните бутылки лёжа в прохладном тёмном месте. Красное подавайте при 16-18 °C, белое и янтарное - при 10-14 °C. Открытая бутылка с пробкой в холодильнике хранится 2-3 дня.',
    },
  },
  {
    id: 'kb_tasting',
    topic: 'other',
    title: { en: 'Tastings at the cellar', ka: 'დეგუსტაციები მარანში', ru: 'Дегустации в погребе' },
    keywords: {
      en: ['tasting', 'visit', 'cellar', 'shop', 'pickup', 'pick up', 'collect', 'address', 'where are you'],
      ka: ['დეგუსტაც', 'მარანი', 'მარანში', 'მაღაზია', 'ადგილზე წამოღება', 'მისამართი', 'სად ხართ'],
      ru: ['дегустац', 'погреб', 'магазин', 'самовывоз', 'забрать', 'адрес', 'где вы'],
    },
    answer: {
      en: 'You are welcome at the cellar on Rustaveli Avenue, Tbilisi: pickup is free and ready within an hour. Autumn tastings run on Saturdays at 18:00 - seats are limited.',
      ka: 'მარანში, თბილისში, რუსთაველის გამზირზე, გელოდებით: წამოღება უფასოა და ერთ საათში მზადაა. შემოდგომის დეგუსტაციები შაბათობით 18:00 საათზე ტარდება - ადგილები შეზღუდულია.',
      ru: 'Ждём вас в погребе на проспекте Руставели в Тбилиси: самовывоз бесплатный, заказ готов в течение часа. Осенние дегустации по субботам в 18:00 - мест немного.',
    },
  },
]

/* ----------------------------------------------------------------- helpers */

/** The language a text is written in, falling back to the widget language. */
export function detectLang(text: string, fallback: ContentLang): ContentLang {
  if (/[Ⴀ-ჿ]/.test(text)) return 'ka'
  if (/[Ѐ-ӿ]/.test(text)) return 'ru'
  if (/[a-z]/i.test(text)) return 'en'
  return fallback
}

/** Keyword hit: ASCII words match at a word start (<= 3 letters: the whole word); Georgian and Russian stems match anywhere. */
export function hit(lower: string, keyword: string): boolean {
  if (/^[a-z0-9' -]+$/.test(keyword)) {
    const escaped = keyword.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const tail = keyword.length <= 3 ? '(?![a-z0-9])' : ''
    return new RegExp(`(?<![a-z0-9])${escaped}${tail}`).test(lower)
  }
  return lower.includes(keyword)
}

const HUMAN_WORDS = [
  'operator', 'human', 'real person', 'a person', 'agent', 'someone real', 'speak to someone', 'talk to someone',
  'ოპერატორ', 'ადამიან', 'ცოცხალ', 'კონსულტანტ',
  'оператор', 'человек', 'живой', 'живого', 'консультант',
]

export function wantsHuman(text: string): boolean {
  const lower = text.toLowerCase()
  return HUMAN_WORDS.some((word) => hit(lower, word))
}

const GREETING_WORDS = ['hi', 'hello', 'hey', 'good morning', 'good evening', 'გამარჯობა', 'სალამი', 'დილა მშვიდობის', 'привет', 'здравствуйте', 'добрый день']
const THANKS_WORDS = ['thank', 'thanks', 'cheers', 'მადლობა', 'გმადლობ', 'спасибо', 'благодар']

export function isGreeting(text: string): boolean {
  const lower = text.toLowerCase().trim()
  return GREETING_WORDS.some((word) => lower === word || lower.startsWith(`${word} `) || lower.startsWith(`${word}!`) || lower.startsWith(`${word},`))
}

export function isThanks(text: string): boolean {
  const lower = text.toLowerCase()
  return THANKS_WORDS.some((word) => hit(lower, word))
}

/** Best knowledge entry for a message, or null when nothing matches. */
export function matchKnowledge(text: string): KnowledgeEntry | null {
  const lower = text.toLowerCase()
  let best: { entry: KnowledgeEntry; score: number } | null = null
  for (const entry of KNOWLEDGE) {
    let score = 0
    for (const lang of ['en', 'ka', 'ru'] as const) {
      for (const keyword of entry.keywords[lang]) {
        if (hit(lower, keyword)) score += Math.min(4, 1 + Math.floor(keyword.length / 6))
      }
    }
    if (score > 0 && (!best || score > best.score)) best = { entry, score }
  }
  return best?.entry ?? null
}

/* ------------------------------------------------------------ fixed lines */

export const BOT_LINES = {
  greeting: (name: string, lang: ContentLang): string => {
    const first = name.trim().split(/\s+/)[0] ?? ''
    if (lang === 'ka') return `გამარჯობა${first ? `, ${first}` : ''}! მე ვარ ჩიტი ასისტენტი, ხელოვნური ინტელექტი ვაზის სახელით. მკითხეთ მიტანაზე, შეკვეთაზე, დაბრუნებაზე ან ღვინის შერჩევაზე. ადამიანთან საუბარი ნებისმიერ დროს შეგიძლიათ.`
    if (lang === 'ru') return `Здравствуйте${first ? `, ${first}` : ''}! Я Chiti Assistant, ИИ-помощник Вази. Спрашивайте о доставке, заказе, возврате или выборе вина. С человеком можно поговорить в любой момент.`
    return `Hi${first ? ` ${first}` : ''}! I'm Chiti Assistant, an AI helper for Vazi Wine Cellar. Ask me about delivery, orders, returns or choosing a wine. You can talk to a person at any time.`
  },
  disclosure: (lang: ContentLang): string => {
    if (lang === 'ka') return 'ეს პასუხი გაიცა ხელოვნური ინტელექტის მიერ. ადამიანთან საუბრისთვის დაწერეთ „ოპერატორი“.'
    if (lang === 'ru') return 'Этот ответ дал ИИ-помощник. Чтобы поговорить с человеком, напишите «оператор».'
    return 'This answer was written by an AI assistant. Write "operator" to talk to a person.'
  },
  greetingReply: (lang: ContentLang): string => {
    if (lang === 'ka') return 'გამარჯობა! რით დაგეხმაროთ - მიტანა, შეკვეთა, დაბრუნება თუ ღვინის შერჩევა?'
    if (lang === 'ru') return 'Здравствуйте! Чем помочь - доставка, заказ, возврат или выбор вина?'
    return 'Hello! What can I help with - delivery, an order, a return or choosing a wine?'
  },
  thanksReply: (lang: ContentLang): string => {
    if (lang === 'ka') return 'სიამოვნებით! თუ კიდევ რამე დაგჭირდებათ, აქ ვარ.'
    if (lang === 'ru') return 'Пожалуйста! Если что-то ещё понадобится, я здесь.'
    return "You're welcome! If you need anything else, I'm right here."
  },
  clarify: (lang: ContentLang): string => {
    if (lang === 'ka') return 'სრულად ვერ გავიგე. შეგიძლიათ სხვანაირად ჩამოაყალიბოთ? მაგალითად: „როდის მოვა შეკვეთა?“, „ბოთლი გატეხილი მომივიდა“ ან „რა მივირთვა ხაჭაპურთან?“.'
    if (lang === 'ru') return 'Я не совсем понял. Можете спросить иначе? Например: «Когда придёт заказ?», «Бутылка пришла разбитой» или «Что подать к хачапури?».'
    return 'I did not quite get that. Could you put it another way? For example: "When will my order arrive?", "A bottle arrived broken" or "What goes with khachapuri?".'
  },
  handoff: {
    customer_request: (lang: ContentLang): string => handoffLine(lang, 'request'),
    unsupported_content: (lang: ContentLang): string => handoffLine(lang, 'attachment'),
    no_answer: (lang: ContentLang): string => handoffLine(lang, 'noanswer'),
    circuit_open: (lang: ContentLang): string => handoffLine(lang, 'outage'),
    bot_paused: (lang: ContentLang): string => handoffLine(lang, 'paused'),
  },
} as const

type HandoffKind = 'request' | 'attachment' | 'noanswer' | 'outage' | 'paused'

function handoffLine(lang: ContentLang, kind: HandoffKind): string {
  const lines: Record<HandoffKind, Text3> = {
    request: {
      en: 'Of course - I am passing you to a colleague with everything you told me, so you will not need to repeat it. Someone will join this chat shortly.',
      ka: 'რა თქმა უნდა - კოლეგას გადაგცემთ ყველაფერთან ერთად, რაც მითხარით, ასე რომ, თავიდან აღარ მოგიწევთ ახსნა. ოპერატორი მალე შემოგიერთდებათ.',
      ru: 'Конечно - передаю вас коллеге вместе со всем, что вы рассказали, повторять не придётся. Оператор скоро подключится к чату.',
    },
    attachment: {
      en: 'Thanks, I cannot look at files or locations myself, so I am handing this over to a colleague who can. Someone will join shortly.',
      ka: 'გმადლობთ, ფაილებს და ლოკაციებს მე ვერ ვხედავ, ამიტომ კოლეგას გადავცემ. ოპერატორი მალე შემოგიერთდებათ.',
      ru: 'Спасибо, я не могу смотреть файлы и геолокации, поэтому передаю разговор коллеге. Оператор скоро подключится.',
    },
    noanswer: {
      en: 'I could not find a good answer for that, so I am bringing in a colleague who can help. Someone will join shortly.',
      ka: 'ამაზე კარგ პასუხს ვერ ვპოულობ, ამიტომ კოლეგას ვიძახებ. ოპერატორი მალე შემოგიერთდებათ.',
      ru: 'Хорошего ответа на это у меня нет, поэтому зову коллегу. Оператор скоро подключится.',
    },
    outage: {
      en: 'My assistant service is unavailable at the moment, so I am passing you to a colleague. Someone will join shortly.',
      ka: 'ასისტენტის სერვისი ამჟამად მიუწვდომელია, ამიტომ კოლეგას გადაგცემთ. ოპერატორი მალე შემოგიერთდებათ.',
      ru: 'Сервис помощника сейчас недоступен, поэтому передаю вас коллеге. Оператор скоро подключится.',
    },
    paused: {
      en: 'The assistant has been switched off for this shop, so a colleague will take over. Someone will join shortly.',
      ka: 'ამ მაღაზიაში ასისტენტი გამორთულია, ამიტომ საუბარს კოლეგა გააგრძელებს. ოპერატორი მალე შემოგიერთდებათ.',
      ru: 'Помощник для этого магазина отключён, поэтому разговор продолжит коллега. Оператор скоро подключится.',
    },
  }
  return lines[kind][lang]
}

/* ----------------------------------------------------- handoff briefing */

const TOPIC_GOAL: Record<SessionTopic, Text3> = {
  delivery: {
    en: 'Confirm the delivery slot and address.',
    ka: 'დაადასტურეთ მიტანის დრო და მისამართი.',
    ru: 'Подтвердить время и адрес доставки.',
  },
  order_status: {
    en: 'Check the order with the courier and give the customer a firm arrival time.',
    ka: 'გადაამოწმეთ შეკვეთა კურიერთან და უთხარით მომხმარებელს ზუსტი დრო.',
    ru: 'Уточнить заказ у курьера и назвать точное время прибытия.',
  },
  returns: {
    en: 'Arrange a free replacement or the return pickup.',
    ka: 'მოაწყვეთ უფასო ჩანაცვლება ან დაბრუნების წამოღება.',
    ru: 'Организовать бесплатную замену или забор возврата.',
  },
  payment: {
    en: 'Resolve the payment question.',
    ka: 'გადაწყვიტეთ გადახდასთან დაკავშირებული საკითხი.',
    ru: 'Решить вопрос с оплатой.',
  },
  pairing: {
    en: 'Recommend two or three bottles for the dish or occasion.',
    ka: 'შესთავაზეთ ორი-სამი ბოთლი კერძის ან შემთხვევის მიხედვით.',
    ru: 'Предложить две-три бутылки под блюдо или повод.',
  },
  gift: {
    en: 'Put together a gift box and confirm the card message.',
    ka: 'მოამზადეთ საჩუქრის ყუთი და დაადასტურეთ ბარათის ტექსტი.',
    ru: 'Собрать подарочную коробку и подтвердить текст открытки.',
  },
  corporate: {
    en: 'Prepare a corporate offer with the 12% discount and invoice terms.',
    ka: 'მოამზადეთ კორპორატიული შეთავაზება 12% ფასდაკლებით და ინვოისის პირობებით.',
    ru: 'Подготовить корпоративное предложение со скидкой 12% и условиями счёта.',
  },
  other: {
    en: 'Find out what the customer needs and help them.',
    ka: 'გაარკვიეთ, რა სჭირდება მომხმარებელს და დაეხმარეთ.',
    ru: 'Выяснить, что нужно клиенту, и помочь.',
  },
}

const TOPIC_LABEL: Record<SessionTopic, Text3> = {
  delivery: { en: 'delivery', ka: 'მიტანა', ru: 'доставка' },
  order_status: { en: 'order status', ka: 'შეკვეთის სტატუსი', ru: 'статус заказа' },
  returns: { en: 'returns and damaged bottles', ka: 'დაბრუნება და გატეხილი ბოთლი', ru: 'возврат и разбитые бутылки' },
  payment: { en: 'payment', ka: 'გადახდა', ru: 'оплата' },
  pairing: { en: 'wine advice', ka: 'ღვინის შერჩევა', ru: 'выбор вина' },
  gift: { en: 'gifts', ka: 'საჩუქრები', ru: 'подарки' },
  corporate: { en: 'a corporate order', ka: 'კორპორატიული შეკვეთა', ru: 'корпоративный заказ' },
  other: { en: 'a general question', ka: 'ზოგადი კითხვა', ru: 'общий вопрос' },
}

export function topicOf(text: string): SessionTopic | null {
  return matchKnowledge(text)?.topic ?? null
}

/** The briefing the operator sees on a bot hand-off, written in the customer's language. */
export function buildBriefing(input: {
  name: string
  topic: SessionTopic
  lastMessage: string | null
  lang: ContentLang
  reason: 'request' | 'attachment' | 'noanswer' | 'outage' | 'paused'
}): { summary: string; goal: string } {
  const { name, topic, lastMessage, lang } = input
  const label = TOPIC_LABEL[topic][lang]
  const quoted = lastMessage ? ` "${lastMessage.slice(0, 120)}"` : ''
  const why: Record<typeof input.reason, Text3> = {
    request: { en: 'asked for a person', ka: 'ითხოვს ადამიანს', ru: 'просит человека' },
    attachment: { en: 'sent an attachment the assistant cannot read', ka: 'გამოგზავნა ფაილი, რომელსაც ასისტენტი ვერ კითხულობს', ru: 'прислал вложение, которое помощник не читает' },
    noanswer: { en: 'asked something the assistant could not answer', ka: 'იკითხა ისეთი რამ, რაზეც ასისტენტმა პასუხი ვერ იპოვა', ru: 'задал вопрос, на который помощник не нашёл ответа' },
    outage: { en: 'was passed on while the assistant was unavailable', ka: 'გადმოგვცა, რადგან ასისტენტი მიუწვდომელი იყო', ru: 'передан, пока помощник был недоступен' },
    paused: { en: 'was passed on because the assistant is switched off', ka: 'გადმოგვცა, რადგან ასისტენტი გამორთულია', ru: 'передан, так как помощник отключён' },
  }
  const summary =
    lang === 'ka'
      ? `${name} - თემა: ${label}. ${why[input.reason][lang]}.${quoted ? ` ბოლო შეტყობინება:${quoted}` : ''}`
      : lang === 'ru'
        ? `${name} - тема: ${label}; ${why[input.reason][lang]}.${quoted ? ` Последнее сообщение:${quoted}` : ''}`
        : `${name} - topic: ${label}; ${why[input.reason][lang]}.${quoted ? ` Last message:${quoted}` : ''}`
  return { summary, goal: TOPIC_GOAL[topic][lang] }
}

/* ------------------------------------------------------ Mariam's canned lines */

interface CannedLine {
  keywords: string[]
  en: string
  ka: string
}

const CANNED: CannedLine[] = [
  {
    keywords: ['broken', 'damaged', 'photo', 'გატეხ', 'ფოტო', 'დაზიან', 'image'],
    en: 'I am so sorry about that! Thank you for the photo - I am arranging a free replacement bottle for you right now. It will come with tomorrow morning delivery.',
    ka: 'ძალიან ვწუხვარ! ფოტოსთვის მადლობა - ახლავე ვაფორმებ უფასო ჩანაცვლებას. ხვალ დილის მიტანასთან ერთად მოგივათ.',
  },
  {
    keywords: ['order', 'late', 'arrive', 'where', 'track', 'შეკვეთ', 'აგვიანებ', 'სად არის', 'კურიერ'],
    en: 'Let me check that for you. I can see the order is out for delivery and the courier should reach you within the next hour. I will message you if anything changes.',
    ka: 'ახლავე გადავამოწმებ. ვხედავ, რომ შეკვეთა გზაშია და კურიერი ერთ საათში მოგივათ. თუ რამე შეიცვლება, მოგწერთ.',
  },
  {
    keywords: ['deliver', 'address', 'when', 'today', 'tomorrow', 'მიტან', 'მისამართ', 'როდის', 'დღეს', 'ხვალ'],
    en: 'Delivery is possible today if you order before 16:00, otherwise tomorrow morning. Which address and time slot work best for you?',
    ka: 'დღეს მიტანა შესაძლებელია, თუ 16:00-მდე გააფორმებთ, თორემ ხვალ დილით. რომელი მისამართი და დრო გიხდებათ უკეთ?',
  },
  {
    keywords: ['pay', 'card', 'cash', 'invoice', 'გადახდ', 'ბარათ', 'ნაღდ', 'ინვოის'],
    en: 'You can pay by card, Apple Pay or cash on delivery. If you prefer, I can send a secure payment link to your phone right now.',
    ka: 'შეგიძლიათ გადაიხადოთ ბარათით, Apple Pay-თი ან ნაღდით მიტანისას. თუ გირჩევნიათ, ახლავე გამოგიგზავნით გადახდის ბმულს.',
  },
  {
    keywords: ['wine', 'recommend', 'gift', 'pair', 'ღვინო', 'რეკომენდ', 'საჩუქ', 'ხაჭაპურ', 'მწვად'],
    en: 'Happy to help you choose! For a dinner with friends I would go with the Saperavi Reserve, and the amber Rkatsiteli if you like something different. How many people and what will you serve?',
    ka: 'სიამოვნებით დაგეხმარებით არჩევაში! მეგობრებთან ვახშმისთვის საფერავ რეზერვს ავირჩევდი, ხოლო თუ რაღაც განსხვავებული გინდათ - ქარვისფერ რქაწითელს. რამდენი ადამიანი იქნება და რას მიართმევთ?',
  },
  {
    keywords: ['thank', 'thanks', 'მადლობ', 'გმადლობ'],
    en: 'You are very welcome! Is there anything else I can help you with today?',
    ka: 'არაფრის! კიდევ რაიმეში დაგეხმაროთ დღეს?',
  },
  {
    keywords: ['hi', 'hello', 'გამარჯობ'],
    en: 'Hello! Mariam here from Vazi Wine Cellar - how can I help you today?',
    ka: 'გამარჯობა! მარიამი ვარ ვაზიდან - რით შემიძლია დაგეხმაროთ?',
  },
]

const CANNED_DEFAULT: CannedLine = {
  keywords: [],
  en: 'Thank you for the details! Give me a moment while I look into this for you.',
  ka: 'გმადლობთ დეტალებისთვის! ერთი წუთით, ახლავე გადავხედავ.',
}

const CANNED_ATTACHMENT = {
  en: 'Thank you, I can see what you sent. Let me take a look and come right back to you.',
  ka: 'გმადლობთ, ვხედავ რაც გამოგზავნეთ. ერთი წუთით, ახლავე გადავხედავ.',
}

/** Mariam's reply to a customer message (en or ka only). */
export function operatorReply(text: string, hasAttachment: boolean, lang: ContentLang): string {
  const language: 'en' | 'ka' = lang === 'ka' ? 'ka' : 'en'
  if (hasAttachment && !text.trim()) return CANNED_ATTACHMENT[language]
  const lower = text.toLowerCase()
  let best: { line: CannedLine; score: number } | null = null
  for (const line of CANNED) {
    const score = line.keywords.filter((word) => hit(lower, word)).length
    if (score > 0 && (!best || score > best.score)) best = { line, score }
  }
  return (best?.line ?? CANNED_DEFAULT)[language]
}
