/**
 * Conversation content for Vazi Wine Cellar: one short, realistic script per
 * topic and language, used for the seeded full transcripts AND by
 * `engine.ensureTranscript` to generate the "summary" transcripts on first
 * read. Generation is deterministic per session id, so two tabs produce the
 * same messages with the same ids.
 */
import type { ChatSession, ContentLang, Message, MessageSender, SessionTopic } from '@/types'

import { hashString, mediaFile, SEC, type MediaKey } from './util'

/** `[who, text, attachment?]`; `{order}` becomes the session's order number. */
type Line = readonly [who: 'u' | 'o', text: string, attachment?: MediaKey]

const EN: Record<SessionTopic, Line[]> = {
  delivery: [
    ['u', 'Hi! Do you deliver to Vake today? I’d like 3 bottles of Saperavi for a dinner tonight.'],
    ['o', 'Hi! Yes, orders placed before 16:00 go out the same day in Tbilisi. Vake is usually 18:00–20:00.'],
    ['u', 'Perfect. Is delivery free?'],
    ['o', 'Free from 120 ₾. Three bottles of our 2021 Saperavi come to 141 ₾, so you’re covered.'],
    ['u', 'Great, can I pay on delivery?'],
    ['o', 'Of course, card or cash at the door. Shall I place the order with the phone number you gave?'],
    ['u', 'Yes please. The address is Chavchavadze 37, flat 12.'],
    ['o', 'Done! Order {order} is confirmed for today 18:00–20:00. The courier will call 15 minutes before.'],
    ['u', 'Thank you!'],
    ['o', 'Enjoy the dinner! 🍷'],
  ],
  order_status: [
    ['u', 'Hello, I ordered on Saturday and haven’t received anything yet. Order {order}.'],
    ['o', 'Hi! Let me check that for you, one moment.'],
    ['o', 'I see it: it left our warehouse this morning and is with the courier now.'],
    ['u', 'Any idea what time?'],
    ['o', 'The route shows between 14:00 and 16:00. I’ve asked the courier to call you first.'],
    ['u', 'OK, thanks. Sorry for the rush, it’s a gift.'],
    ['o', 'No problem at all. If anything changes I’ll message you here.'],
    ['u', '👍'],
  ],
  returns: [
    ['u', 'Hi, one of the bottles arrived broken. The box was wet when it came.'],
    ['o', 'I’m so sorry about that! Could you send a photo of the bottle and the label?'],
    ['u', '', 'broken'],
    ['o', 'Thank you. We’ll replace it free of charge, no need to return the broken one.'],
    ['u', 'Can it come tomorrow?'],
    ['o', 'Yes, tomorrow between 11:00 and 14:00. I’ve added a small gift for the trouble.'],
    ['u', 'That’s very kind, thank you.'],
    ['o', 'Thank you for letting us know. Have a lovely evening!'],
  ],
  payment: [
    ['u', 'Hi, my card payment failed twice but I think money was taken.'],
    ['o', 'Hi! Sorry for the trouble. Could you tell me the order number?'],
    ['u', '{order}'],
    ['o', 'Thanks. I see two pending authorisations. They were not captured and your bank will release them within 3 working days.'],
    ['u', 'So should I pay again?'],
    ['o', 'I can send you a fresh payment link, or you can pay the courier by card on delivery.'],
    ['u', 'Cash on delivery is fine.'],
    ['o', 'Done, switched to payment on delivery. Nothing else to do on your side.'],
  ],
  pairing: [
    ['u', 'Hi! What would you recommend with khinkali and grilled pork? Something not too heavy.'],
    ['o', 'Hi! A young Saperavi or a slightly chilled Ojaleshi works beautifully with mtsvadi.'],
    ['u', 'And for white? My wife prefers white.'],
    ['o', 'Try the Tsolikouri 2023: fresh, a little citrusy. Or the qvevri Rkatsiteli if she likes amber wines.'],
    ['u', 'Amber sounds interesting. What’s the price?'],
    ['o', 'Qvevri Rkatsiteli 2021 is 38 ₾, Ojaleshi is 45 ₾.'],
    ['u', 'I’ll take one of each.'],
    ['o', 'Great choice! I’ve put them in a cart for you, here’s the photo of both.'],
    ['o', '', 'bottles'],
    ['u', 'Lovely, thanks!'],
  ],
  gift: [
    ['u', 'Hi, I need a gift box for my boss, around 150 ₾.'],
    ['o', 'Hi! Our “Kakheti trio” box is 145 ₾: Saperavi, Mtsvane and Kindzmarauli in a wooden case.'],
    ['o', '', 'gift'],
    ['u', 'Can you add a card with a message?'],
    ['o', 'Of course. What should it say?'],
    ['u', '“Thank you for a great year, from the whole team”'],
    ['o', 'Lovely. Delivered to the office, or will you pick it up?'],
    ['u', 'Office please, Friday morning.'],
    ['o', 'Done. Friday 10:00–13:00, with the card. We’ll send you a photo before it leaves.'],
  ],
  corporate: [
    ['u', 'Hello, we’re planning a company dinner for 40 people. Do you take corporate orders?'],
    ['o', 'Hello! Yes: from 24 bottles we give 12% off and can invoice your company.'],
    ['u', 'We’d need about 30 bottles, mixed red and white.'],
    ['o', 'I’d suggest 18 Saperavi and 12 Tsinandali. That’s 1,236 ₾ after the discount.'],
    ['u', 'Can you send an invoice to our accountant?'],
    ['o', 'Sure. Send me the company name and ID code and I’ll email the invoice today.'],
    ['u', 'I’ll send it here in a minute.'],
    ['o', 'Here is our autumn price list in the meantime.', 'priceList'],
    ['o', 'Perfect, thank you!'],
  ],
  other: [
    ['u', 'Hi, do you have a shop where I can taste before buying?'],
    ['o', 'Hi! Our tasting room is at 14 Erekle II Street, open daily 12:00–22:00.'],
    ['u', 'Do I need to book?'],
    ['o', 'For groups of more than 6 people, yes. Otherwise just drop by.'],
    ['u', 'Great, see you on Saturday.'],
    ['o', 'See you then! 🍇'],
  ],
}

const KA: Record<SessionTopic, Line[]> = {
  delivery: [
    ['u', 'გამარჯობა! დღეს ვაკეში მოიტანთ? საღამოსთვის 3 ბოთლი საფერავი მინდა.'],
    ['o', 'გამარჯობა! კი, 16:00-მდე გაფორმებული შეკვეთა თბილისში იმავე დღეს მიდის. ვაკეში ჩვეულებრივ 18:00–20:00-ზე მოგიტანთ.'],
    ['u', 'მიტანა უფასოა?'],
    ['o', '120 ₾-დან უფასოა. სამი ბოთლი საფერავი 2021 ჯამში 141 ₾ ღირს, ასე რომ უფასოდ მოგიტანთ.'],
    ['u', 'ადგილზე გადახდა შეიძლება?'],
    ['o', 'რა თქმა უნდა, ბარათით ან ნაღდით კურიერთან. მითითებულ ნომერზე გავაფორმო შეკვეთა?'],
    ['u', 'დიახ. მისამართი: ჭავჭავაძის 37, ბინა 12.'],
    ['o', 'მზადაა! შეკვეთა {order} დადასტურებულია დღეს 18:00–20:00-ზე. კურიერი 15 წუთით ადრე დაგირეკავთ.'],
    ['u', 'დიდი მადლობა!'],
    ['o', 'გემრიელ ვახშამს გისურვებთ! 🍷'],
  ],
  order_status: [
    ['u', 'გამარჯობა, შაბათს შევუკვეთე და ჯერ არაფერი მიმიღია. შეკვეთა {order}.'],
    ['o', 'გამარჯობა! ერთი წუთით, გადავამოწმებ.'],
    ['o', 'ვხედავ: დილით გავიდა საწყობიდან და ახლა კურიერთანაა.'],
    ['u', 'დაახლოებით რომელ საათზე?'],
    ['o', 'მარშრუტით 14:00-დან 16:00-მდე. კურიერს ვთხოვე, ჯერ დაგირეკოთ.'],
    ['u', 'კარგი, მადლობა. საჩუქარია და ამიტომ ვჩქარობ.'],
    ['o', 'არაფრის. თუ რამე შეიცვლება, აქვე მოგწერთ.'],
    ['u', '👍'],
  ],
  returns: [
    ['u', 'გამარჯობა, ერთი ბოთლი გატეხილი მოვიდა. ყუთი სველი იყო.'],
    ['o', 'ძალიან ვწუხვართ! ბოთლისა და ეტიკეტის ფოტოს გამომიგზავნით?'],
    ['u', '', 'broken'],
    ['o', 'მადლობა. უფასოდ შეგიცვლით, გატეხილის დაბრუნება საჭირო არ არის.'],
    ['u', 'ხვალ მოიტანთ?'],
    ['o', 'დიახ, ხვალ 11:00–14:00-ზე. შეწუხებისთვის პატარა საჩუქარიც დავამატე.'],
    ['u', 'ძალიან კარგი, მადლობა.'],
    ['o', 'მადლობა, რომ შეგვატყობინეთ. სასიამოვნო საღამოს გისურვებთ!'],
  ],
  payment: [
    ['u', 'გამარჯობა, ბარათით გადახდა ორჯერ ვერ შედგა, მაგრამ თანხა თითქოს ჩამომეჭრა.'],
    ['o', 'გამარჯობა! ბოდიში შეფერხებისთვის. შეკვეთის ნომერს მეტყვით?'],
    ['u', '{order}'],
    ['o', 'მადლობა. ორი დაბლოკილი ავტორიზაცია ჩანს: თანხა არ ჩამოჭრილა და ბანკი 3 სამუშაო დღეში გაგიხსნით.'],
    ['u', 'ანუ თავიდან გადავიხადო?'],
    ['o', 'შემიძლია ახალი გადახდის ბმული გამოგიგზავნოთ, ან კურიერთან გადაიხადოთ ბარათით.'],
    ['u', 'კურიერთან გადავიხდი.'],
    ['o', 'მზადაა, გადახდის მეთოდი მიტანისას გადახდით შევცვალე. თქვენი მხრიდან მეტი არაფერია საჭირო.'],
  ],
  pairing: [
    ['u', 'გამარჯობა! ხინკალთან და მწვადთან რას მირჩევთ? ძალიან მძიმე არ მინდა.'],
    ['o', 'გამარჯობა! ახალგაზრდა საფერავი ან ოდნავ გაციებული ოჯალეში მწვადს მშვენივრად უხდება.'],
    ['u', 'თეთრი? მეუღლეს თეთრი ურჩევნია.'],
    ['o', 'ცოლიკოური 2023 სცადეთ, ხალისიანი და ოდნავ ციტრუსიანია. ან ქვევრის რქაწითელი, თუ ქარვისფერი ღვინო უყვარს.'],
    ['u', 'ქვევრის საინტერესოდ ჟღერს. რა ღირს?'],
    ['o', 'ქვევრის რქაწითელი 2021 — 38 ₾, ოჯალეში — 45 ₾.'],
    ['u', 'თითო ავიღებ.'],
    ['o', 'შესანიშნავი არჩევანია! კალათაში დაგიმატეთ, აი ორივეს ფოტო.'],
    ['o', '', 'bottles'],
    ['u', 'მადლობა!'],
  ],
  gift: [
    ['u', 'გამარჯობა, ხელმძღვანელისთვის საჩუქრის ყუთი მჭირდება, დაახლოებით 150 ₾.'],
    ['o', 'გამარჯობა! „კახური ტრიო“ 145 ₾ ღირს: საფერავი, მწვანე და ქინძმარაული ხის ყუთში.'],
    ['o', '', 'gift'],
    ['u', 'ბარათის დამატება შეიძლება?'],
    ['o', 'რა თქმა უნდა. რა დავწეროთ?'],
    ['u', '„მადლობა შესანიშნავი წლისთვის, მთელი გუნდისგან“'],
    ['o', 'მშვენიერია. ოფისში მივიტანოთ თუ თავად წაიღებთ?'],
    ['u', 'ოფისში, პარასკევს დილით.'],
    ['o', 'მზადაა. პარასკევს 10:00–13:00-ზე, ბარათით. გაგზავნამდე ფოტოს გამოგიგზავნით.'],
  ],
  corporate: [
    ['u', 'გამარჯობა, 40-კაციან კორპორატიულ ვახშამს ვგეგმავთ. კორპორატიულ შეკვეთებს იღებთ?'],
    ['o', 'გამარჯობა! კი: 24 ბოთლიდან 12% ფასდაკლებაა და კომპანიაზე ინვოისსაც გამოგიწერთ.'],
    ['u', 'დაახლოებით 30 ბოთლი გვჭირდება, წითელიც და თეთრიც.'],
    ['o', 'გირჩევთ 18 საფერავს და 12 წინანდალს. ფასდაკლებით 1 236 ₾ გამოდის.'],
    ['u', 'ინვოისს ჩვენს ბუღალტერს გაუგზავნით?'],
    ['o', 'რა თქმა უნდა. მომწერეთ კომპანიის სახელი და საიდენტიფიკაციო კოდი და დღესვე გამოგიგზავნით.'],
    ['u', 'ერთ წუთში აქ მოგწერთ.'],
    ['o', 'მანამდე აი ჩვენი შემოდგომის ფასები.', 'priceList'],
    ['o', 'მშვენიერია, მადლობა!'],
  ],
  other: [
    ['u', 'გამარჯობა, მაღაზია გაქვთ, სადაც ყიდვამდე დაგემოვნება შეიძლება?'],
    ['o', 'გამარჯობა! სადეგუსტაციო დარბაზი ერეკლე II-ის ქუჩა 14-ში გვაქვს, ყოველდღე 12:00–22:00.'],
    ['u', 'დაჯავშნა საჭიროა?'],
    ['o', '6 კაცზე მეტ ჯგუფს — კი. სხვა შემთხვევაში უბრალოდ შემოიარეთ.'],
    ['u', 'მშვენიერია, შაბათს გნახავთ.'],
    ['o', 'გელოდებით! 🍇'],
  ],
}

const RU: Partial<Record<SessionTopic, Line[]>> = {
  delivery: [
    ['u', 'Здравствуйте! Можно доставить 3 бутылки Саперави сегодня в Ваке?'],
    ['o', 'Здравствуйте! Да, заказы до 16:00 доставляем по Тбилиси в тот же день, в Ваке обычно 18:00–20:00.'],
    ['u', 'Доставка бесплатная?'],
    ['o', 'От 120 ₾ бесплатно. Три бутылки Саперави 2021 стоят 141 ₾, так что доставка за наш счёт.'],
    ['u', 'Отлично, оформляйте. Оплачу курьеру картой.'],
    ['o', 'Готово! Заказ {order} подтверждён, курьер позвонит за 15 минут.'],
    ['u', 'Спасибо!'],
  ],
  order_status: [
    ['u', 'Здравствуйте, заказ {order} ещё не пришёл, хотя должен был вчера.'],
    ['o', 'Здравствуйте! Сейчас проверю, одну минуту.'],
    ['o', 'Заказ у курьера, по маршруту между 14:00 и 16:00. Попросил курьера сначала позвонить вам.'],
    ['u', 'Хорошо, спасибо.'],
    ['o', 'Если что-то изменится, напишу здесь же.'],
  ],
  payment: [
    ['u', 'Здравствуйте, оплата картой не прошла, но деньги как будто списались.'],
    ['o', 'Здравствуйте! Подскажите номер заказа?'],
    ['u', '{order}'],
    ['o', 'Вижу две блокировки: деньги не списаны, банк вернёт их в течение 3 рабочих дней.'],
    ['u', 'А как теперь оплатить?'],
    ['o', 'Можно оплатить курьеру при доставке. Переключил заказ на оплату при получении.'],
    ['u', 'Спасибо, так удобнее.'],
  ],
}

/**
 * Follow-up questions some customers come back with after the main script,
 * two per topic: `[customer question, operator answer]`. They make roughly a
 * third of the full transcripts run longer (12-24 messages instead of 6-10).
 */
const FOLLOW_UPS: Record<'en' | 'ka', Record<SessionTopic, readonly [q: string, a: string][]>> = {
  en: {
    delivery: [
      ['Could the courier leave it with my neighbour if I’m not home?', 'We hand wine over to an adult (18+) only, but a neighbour is fine. Tell us their name and the courier will call you first.'],
      ['Do you deliver outside Tbilisi too?', 'Yes: Rustavi and Mtskheta the next day, the rest of Georgia within 2–3 days by courier. Delivery outside the capital is 8 ₾.'],
    ],
    order_status: [
      ['Can I change the delivery address now?', 'If it’s with the courier I can still ask for a reroute within Tbilisi. What is the new address?'],
      ['Will I get a message when it’s delivered?', 'Yes, you’ll get a confirmation here and by SMS as soon as the courier hands it over.'],
    ],
    returns: [
      ['Are the other bottles in the box fine to drink?', 'If the bottles are intact, yes: cardboard doesn’t affect the wine. Check the corks for leaks and write to us if anything looks off.'],
      ['Can I return a bottle I simply didn’t like?', 'Unopened bottles can be returned within 14 days with the receipt. Opened ones only if there is a fault.'],
    ],
    payment: [
      ['Could you send me a receipt for my records?', 'Of course, I’ll email it to the address on the order within the hour.'],
      ['Do you accept payment in instalments?', 'Orders over 200 ₾ can be split into 3 interest-free instalments with selected banks. I’ll send you the link.'],
    ],
    pairing: [
      ['Do you have anything sweet for dessert? Not too sugary.', 'Our semi-sweet Khvanchkara 2019 (52 ₾) is lovely with fruit and walnuts, and the Kindzmarauli goes well with chocolate.'],
      ['How should I serve the qvevri wine?', 'Slightly cooler than room temperature, about 14–16 °C, and open it 20 minutes ahead.'],
    ],
    gift: [
      ['Can you wrap it in something other than the wooden case?', 'Yes, we also have a black gift bag and a paper-wrapped option, both free.'],
      ['What if the recipient isn’t at the office?', 'The courier will call you, and we can leave it with reception. We’ll message you the moment it’s delivered.'],
    ],
    corporate: [
      ['Can we pay by bank transfer after delivery?', 'We invoice companies with 14 days’ payment terms; the first order is paid upfront.'],
      ['Do you offer a team tasting before we order?', 'Yes, the tasting room fits up to 12 people. A corporate tasting is 20 ₾ per person.'],
    ],
    other: [
      ['Do you sell glasses and decanters too?', 'Yes, a small selection at the tasting room and in the shop. I’ll send you a link.'],
      ['Is there parking nearby?', 'There’s a paid car park on the next street, and the metro is a 5-minute walk.'],
    ],
  },
  ka: {
    delivery: [
      ['თუ სახლში არ ვიქნები, მეზობელს ჩააბარებს კურიერი?', 'ღვინოს მხოლოდ სრულწლოვანს ვაბარებთ, მეზობელი კი გამოდგება. მისი სახელი მითხარით და კურიერი ჯერ დაგირეკავთ.'],
      ['თბილისს გარეთაც მიიტანთ?', 'დიახ: რუსთავსა და მცხეთაში მეორე დღეს, დანარჩენ საქართველოში 2–3 დღეში კურიერით. თბილისს გარეთ მიტანა 8 ₾ ღირს.'],
    ],
    order_status: [
      ['მისამართის შეცვლა ახლა შეიძლება?', 'თუ კურიერთანაა, თბილისის ფარგლებში მარშრუტის შეცვლას ვთხოვ. რა არის ახალი მისამართი?'],
      ['მიტანისას შეტყობინება მომივა?', 'დიახ, კურიერის მიერ გადაცემისთანავე აქვე და SMS-ითაც მიიღებთ დადასტურებას.'],
    ],
    returns: [
      ['ყუთში დარჩენილი ბოთლები დასალევად ვარგისია?', 'თუ ბოთლები მთელია, დიახ, მუყაო ღვინოს არ აზიანებს. საცობები შეამოწმეთ და თუ რამე არასწორად ჩანს, მოგვწერეთ.'],
      ['ბოთლის დაბრუნება შეიძლება, თუ უბრალოდ არ მომეწონა?', 'გაუხსნელი ბოთლი 14 დღეში ჩეკით ბრუნდება. გახსნილი — მხოლოდ დეფექტის შემთხვევაში.'],
    ],
    payment: [
      ['ჩეკს გამომიგზავნით?', 'რა თქმა უნდა, შეკვეთაზე მითითებულ ელფოსტაზე ერთ საათში გამოგიგზავნით.'],
      ['განვადებით გადახდა შეიძლება?', '200 ₾-ზე მეტი შეკვეთა შერჩეულ ბანკებთან 3 თვეში, პროცენტის გარეშე შეიძლება. ბმულს გამოგიგზავნით.'],
    ],
    pairing: [
      ['დესერტისთვის რამე ტკბილი გაქვთ? ძალიან შაქრიანი არა.', 'ნახევრად ტკბილი ხვანჭკარა 2019 (52 ₾) ხილსა და ნიგოზს უხდება, ქინძმარაული — შოკოლადს.'],
      ['ქვევრის ღვინო როგორ მივართვა?', 'ოთახის ტემპერატურაზე ოდნავ გრილი, დაახლოებით 14–16 °C, და 20 წუთით ადრე გახსენით.'],
    ],
    gift: [
      ['ხის ყუთის ნაცვლად სხვანაირად შეფუთავთ?', 'დიახ, გვაქვს შავი საჩუქრის ჩანთა და ქაღალდის შეფუთვაც, ორივე უფასოა.'],
      ['თუ ადრესატი ოფისში არ იქნება?', 'კურიერი დაგირეკავთ და მიღების განყოფილებაში დავტოვებთ. ჩაბარებისთანავე შეგატყობინებთ.'],
    ],
    corporate: [
      ['მიტანის შემდეგ ბანკით გადარიცხვით გადავიხდით?', 'კომპანიებს 14-დღიანი ვადით ვუწერთ ინვოისს; პირველი შეკვეთა წინასწარ ფასდება.'],
      ['შეკვეთამდე გუნდისთვის დეგუსტაციას გვთავაზობთ?', 'დიახ, სადეგუსტაციო დარბაზი 12 კაცს იტევს. კორპორატიულ დეგუსტაციაზე პირს 20 ₾ ეღირება.'],
    ],
    other: [
      ['ჭიქებსა და დეკანტერებსაც ყიდით?', 'დიახ, მცირე არჩევანი სადეგუსტაციო დარბაზსა და მაღაზიაში გვაქვს. ბმულს გამოგიგზავნით.'],
      ['ახლოს პარკინგია?', 'მომდევნო ქუჩაზე ფასიანი პარკინგია, მეტრო კი ფეხით 5 წუთშია.'],
    ],
  },
}

const FOLLOW_UP_FRAME: Record<'en' | 'ka', { again: [string, string]; more: [string, string]; thanks: [string, string] }> = {
  en: {
    again: ['Sorry, one more question before I go.', 'Of course, go ahead.'],
    more: ['And one last thing.', 'Sure.'],
    thanks: ['Perfect, thanks again!', 'You’re welcome, have a lovely day!'],
  },
  ka: {
    again: ['ბოდიში, წასვლამდე კიდევ ერთი კითხვა მაქვს.', 'რა თქმა უნდა, გისმენთ.'],
    more: ['და ბოლო კითხვა.', 'გისმენთ.'],
    thanks: ['შესანიშნავია, კიდევ ერთხელ მადლობა!', 'არაფრის, სასიამოვნო დღეს გისურვებთ!'],
  },
}

/** How many follow-up questions a session comes back with (0 for most, 1 for a third, 2 for one in twelve). */
function followUpCount(sessionId: string): 0 | 1 | 2 {
  const roll = hashString(`${sessionId}:follow-up`)
  return roll % 12 === 0 ? 2 : roll % 3 === 1 ? 1 : 0
}

/** Topics a Russian-speaking customer is seeded with (the ones with a script). */
export const RU_TOPICS: readonly SessionTopic[] = ['delivery', 'order_status', 'payment']

function scriptFor(topic: SessionTopic, lang: ContentLang): Line[] {
  if (lang === 'ru') return RU[topic] ?? EN[topic]
  return lang === 'ka' ? KA[topic] : EN[topic]
}

/** The bot's one-line hand-over, when the session started with Chiti Assistant. */
export const BOT_HANDOVER_LINE: Record<ContentLang, string> = {
  en: 'I’m Chiti Assistant, Vazi’s virtual helper. Let me connect you with a colleague who can check this for you.',
  ka: 'მე ვარ ჩიტი ასისტენტი, ვაზის ვირტუალური დამხმარე. დაგაკავშირებთ კოლეგასთან, რომელიც ამას გადაამოწმებს.',
  ru: 'Я Чити Ассистент, виртуальный помощник Вази. Соединяю вас с коллегой, который это проверит.',
}

export const BOT_NAME = 'Chiti Assistant'

/** Short history-row summary of how a chat ended. */
const END_SUMMARY: Record<SessionTopic, Record<ContentLang, string>> = {
  delivery: { en: 'Same-day delivery booked', ka: 'მიტანა იმავე დღეს დაიგეგმა', ru: 'Доставка в тот же день' },
  order_status: { en: 'Courier ETA shared', ka: 'კურიერის მოსვლის დრო ეცნობა', ru: 'Сообщили время курьера' },
  returns: { en: 'Broken bottle replaced', ka: 'გატეხილი ბოთლი შეიცვალა', ru: 'Разбитую бутылку заменили' },
  payment: { en: 'Switched to pay on delivery', ka: 'გადახდა მიტანისას შეიცვალა', ru: 'Оплата при доставке' },
  pairing: { en: 'Pairing advice, 2 bottles added', ka: 'ღვინის რჩევა, 2 ბოთლი დაემატა', ru: 'Совет по вину, 2 бутылки' },
  gift: { en: 'Gift box with card for Friday', ka: 'საჩუქრის ყუთი ბარათით პარასკევს', ru: 'Подарочная коробка на пятницу' },
  corporate: { en: 'Corporate invoice requested', ka: 'კორპორატიული ინვოისი მოითხოვეს', ru: 'Запрошен счёт для компании' },
  other: { en: 'Tasting room hours shared', ka: 'სადეგუსტაციო დარბაზის საათები ეცნობა', ru: 'Часы дегустационного зала' },
}

const MISSED_SUMMARY: Record<ContentLang, string> = {
  en: 'No operator was available',
  ka: 'თავისუფალი ოპერატორი არ იყო',
  ru: 'Свободного оператора не было',
}

const SILENT_SUMMARY: Record<ContentLang, string> = {
  en: 'Customer stopped replying',
  ka: 'მომხმარებელმა აღარ უპასუხა',
  ru: 'Клиент перестал отвечать',
}

export function endSummaryFor(topic: SessionTopic, lang: ContentLang, kind: 'done' | 'missed' | 'silent' = 'done'): string {
  if (kind === 'missed') return MISSED_SUMMARY[lang]
  if (kind === 'silent') return SILENT_SUMMARY[lang]
  return END_SUMMARY[topic][lang]
}

/** The bot's hand-over briefing (written in the customer's language). */
const HANDOFF: Record<SessionTopic, Record<'en' | 'ka', { summary: string; goal: string }>> = {
  delivery: {
    en: { summary: 'Asked about delivery timing to their area; the bot shared the delivery zones but the customer wants a confirmed slot.', goal: 'Confirm a delivery slot.' },
    ka: { summary: 'მიტანის დროზე იკითხა; ბოტმა მიტანის ზონები გაუზიარა, მაგრამ მომხმარებელს ზუსტი დრო სურს.', goal: 'დაადასტურეთ მიტანის დრო.' },
  },
  order_status: {
    en: { summary: 'Order {order} is late and nobody called; the bot shared the tracking link.', goal: 'Give a new delivery time.' },
    ka: { summary: 'შეკვეთა {order} აგვიანებს და არავინ დარეკა; ბოტმა თვალყურის ბმული მისცა.', goal: 'შეატყობინეთ მიტანის ახალი დრო.' },
  },
  returns: {
    en: { summary: 'A bottle arrived broken and the customer sent a photo.', goal: 'Arrange a replacement or a refund.' },
    ka: { summary: 'ბოთლი გატეხილი მივიდა და მომხმარებელმა ფოტო გამოგზავნა.', goal: 'შესთავაზეთ შეცვლა ან თანხის დაბრუნება.' },
  },
  payment: {
    en: { summary: 'Card payment failed but the customer thinks money was taken.', goal: 'Explain the pending charge and offer another way to pay.' },
    ka: { summary: 'ბარათით გადახდა ვერ შედგა, მომხმარებელი ფიქრობს, რომ თანხა ჩამოეჭრა.', goal: 'აუხსენით დაბლოკილი თანხა და შესთავაზეთ გადახდის სხვა გზა.' },
  },
  pairing: {
    en: { summary: 'Wants a wine for a dinner; nothing in the knowledge base matched the dish and budget.', goal: 'Recommend 1–2 wines within budget.' },
    ka: { summary: 'ვახშმისთვის ღვინო სურს; ცოდნის ბაზაში კერძსა და ბიუჯეტს შესაბამისი ვერაფერი მოიძებნა.', goal: 'ურჩიეთ 1–2 ღვინო ბიუჯეტის ფარგლებში.' },
  },
  gift: {
    en: { summary: 'Needs custom gift packing, which the bot can’t arrange.', goal: 'Put together a gift box and confirm the price.' },
    ka: { summary: 'სჭირდება საჩუქრის ინდივიდუალური შეფუთვა, რასაც ბოტი ვერ აკეთებს.', goal: 'შეუდგინეთ საჩუქრის ყუთი და დაუდასტურეთ ფასი.' },
  },
  corporate: {
    en: { summary: 'Corporate order with an invoice request.', goal: 'Collect the company details and send the invoice.' },
    ka: { summary: 'კორპორატიული შეკვეთა ინვოისის მოთხოვნით.', goal: 'მიიღეთ კომპანიის რეკვიზიტები და გაუგზავნეთ ინვოისი.' },
  },
  other: {
    en: { summary: 'A general question the bot could not answer.', goal: 'Answer the question.' },
    ka: { summary: 'ზოგადი კითხვა, რომელსაც ბოტმა ვერ უპასუხა.', goal: 'უპასუხეთ კითხვას.' },
  },
}

export function orderNumberFor(sessionId: string): string {
  return `VZ-2${String(4000 + (hashString(sessionId) % 6000)).padStart(4, '0')}`
}

/**
 * The bot's briefing for a session. Uses the order number the customer typed
 * (custom field ending in `order`); seeded sessions without one get a stable
 * generated number; visitor sessions without one get no number.
 */
export function handoffBrief(
  session: Pick<ChatSession, 'id' | 'topic' | 'clientLanguage'> & Partial<Pick<ChatSession, 'customFields' | 'origin'>>,
): { summary: string; goal: string } {
  const lang = session.clientLanguage === 'ka' ? 'ka' : 'en'
  const brief = HANDOFF[session.topic][lang]
  const typed = session.customFields?.find((field) => field.fieldId.endsWith('order'))?.value
  const order = typed || (session.origin && session.origin !== 'seed' ? '' : orderNumberFor(session.id))
  const summary = order
    ? brief.summary.replace('{order}', order)
    : brief.summary.replace('Order {order}', 'The order').replace(' {order}', '')
  return { summary, goal: brief.goal }
}

export interface TranscriptOperator {
  id: string
  nickname: string
}

interface Draft {
  sender: MessageSender
  senderId: string | null
  senderName: string | null
  content: string
  media: MediaKey | null
  isPreChat: boolean
  isAutoGreeting: boolean
}

/**
 * A complete transcript for an ended session, timed evenly between
 * `startedAt` and `endedAt`. Ids are `${session.id}_m${n}`.
 */
export function buildTranscript(session: ChatSession, operator: TranscriptOperator | null, greeting: string | null): Message[] {
  const lang = session.clientLanguage
  const order = orderNumberFor(session.id)
  const script = scriptFor(session.topic, lang)
  const drafts: Draft[] = []
  const customer = (content: string, media: MediaKey | null = null, isPreChat = false): Draft => ({
    sender: 'user', senderId: session.customerId, senderName: session.customerName, content, media, isPreChat, isAutoGreeting: false,
  })

  for (const step of session.faqPath) {
    drafts.push({ sender: 'bot', senderId: null, senderName: BOT_NAME, content: step.question, media: null, isPreChat: true, isAutoGreeting: false })
    drafts.push(customer(step.answer, null, true))
  }

  const first = script[0]
  if (first) drafts.push(customer(first[1].replace('{order}', order), first[2] ?? null))
  if (session.aiHandoff) {
    drafts.push({ sender: 'bot', senderId: null, senderName: BOT_NAME, content: BOT_HANDOVER_LINE[lang], media: null, isPreChat: false, isAutoGreeting: false })
  }

  if (operator) {
    if (greeting) {
      drafts.push({ sender: 'operator', senderId: operator.id, senderName: operator.nickname, content: greeting, media: null, isPreChat: false, isAutoGreeting: true })
    }
    // Long chats get the whole script; short ones stop a little earlier.
    const keep = session.endedBy === 'customer' || session.endReason === 'inactivity'
      ? Math.max(3, script.length - 1 - (hashString(session.id) % 3))
      : script.length
    const staff = (content: string, media: MediaKey | null = null): Draft => ({
      sender: 'operator', senderId: operator.id, senderName: operator.nickname, content, media, isPreChat: false, isAutoGreeting: false,
    })
    for (const line of script.slice(1, keep)) {
      const text = line[1].replace('{order}', order)
      if (line[0] === 'u') drafts.push(customer(text, line[2] ?? null))
      else drafts.push(staff(text, line[2] ?? null))
    }
    // A customer who got everything they needed sometimes comes back with a follow-up.
    const tailLang = lang === 'ru' ? null : lang
    const followUps = keep === script.length && tailLang ? followUpCount(session.id) : 0
    if (tailLang && followUps > 0) {
      const frame = FOLLOW_UP_FRAME[tailLang]
      const pairs = FOLLOW_UPS[tailLang][session.topic]
      drafts.push(customer(frame.again[0]), staff(frame.again[1]))
      for (let index = 0; index < followUps; index += 1) {
        const [question, answer] = pairs[(hashString(session.id) + index) % pairs.length] as readonly [string, string]
        if (index > 0) drafts.push(customer(frame.more[0]), staff(frame.more[1]))
        drafts.push(customer(question), staff(answer))
      }
      drafts.push(customer(frame.thanks[0]), staff(frame.thanks[1]))
    }
  } else {
    const second = script[2]
    if (second && second[0] === 'u') drafts.push(customer(second[1].replace('{order}', order)))
  }

  const start = Date.parse(session.startedAt)
  const end = Date.parse(session.endedAt ?? session.lastActivity)
  const span = Math.max(drafts.length * 20 * SEC, end - start - 40 * SEC)
  const step = span / Math.max(1, drafts.length)

  return drafts.map((draft, index) => {
    const timestamp = new Date(start + 8 * SEC + Math.round(index * step) + (index % 3) * 3 * SEC).toISOString()
    const staff = draft.sender !== 'user'
    const seen = new Date(Date.parse(timestamp) + (staff ? 25 : 12) * SEC).toISOString()
    const file = draft.media ? mediaFile(draft.media) : null
    return {
      id: `${session.id}_m${index + 1}`,
      tenantId: session.tenantId,
      sessionId: session.id,
      sender: draft.sender,
      senderId: draft.senderId,
      senderName: draft.senderName,
      type: file ? (file.mimeType.startsWith('image/') ? 'image' : file.mimeType.startsWith('audio/') ? 'audio' : 'file') : 'text',
      content: draft.content,
      file,
      location: null,
      sentByAdmin: false,
      timestamp,
      deliveryStatus: staff ? 'read' : 'delivered',
      failureKind: null,
      seenAt: seen,
      reactionEmoji: null,
      channel: session.channel,
      isPreChat: draft.isPreChat,
      isAutoGreeting: draft.isAutoGreeting,
      citations: [],
      copilotRef: null,
      template: null,
    } satisfies Message
  })
}
