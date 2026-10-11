# Georgian copy — review status and worklist

Every Georgian string in the portal and in the seven new demos was first written by an AI in a
single pass. A second, independent AI review then went through them with a native-level rubric
(meaning, grammar, terminology, register, UI conventions). **That is not a substitute for a human
native reader**, and this page is the worklist for one: what was checked, what was found, what is
still doubtful.

## What was checked

| Area | Georgian strings | Read in depth | Strings fixed | Error rate in what was read |
|---|---:|---:|---:|---|
| Portal UI (`site/src/i18n/ka.ts`, demo bar) | 112 | 112 (all) | 14 | ~12% touched, ~5% real errors |
| Portfolio entries, 11 × (`projects.ka.json`) | 1,315 | ~all long-form prose | ~380 | **36–49% of strings had a clear problem** (all fixed) |
| Tova | 760 | 418 | 99 | 10% sample · 7–12% first screens |
| Bani | 1,388 | 620 | 103 | 15% sample · 9.6% first screens |
| Rigi | 2,310 | 617 | 217 | 9.3% sample (2.7% language errors, rest terminology) |
| Sinji | 2,881 | 680 | 153 | 9.9% sample · 3.5% first screens |
| Dareke | 1,233 | 742 | 111 | 10.8% sample · 6.5% first screens |
| Chiti | 2,103 | 790 | 123 | 8.7% sample · 6.6% first screens |
| Azri | 594 | 594 (all) | 69 | 11.6% (about 4% grammar/meaning, the rest terminology) |

"Read in depth" for the demos means: all of `common`, login, the shell and the first screen of each
role, plus a seeded-random sample of 120–150 strings, plus everything an automatic lint flagged
(untranslated, Latin letters inside Georgian words, differing `{{variables}}`, odd length ratios).
Systematic problems found in that sample were then fixed everywhere by search. **Roughly 60% of
demo strings were not read one by one.** Highest-risk places, per the reviewers:

- **Sinji** `kb.json` and `kbQuality.json` — the highest error density, including outside the sample.
- **Bani** — the `access`, `agents`, `archive`, `campaigns`, `health` and `people` namespaces were not
  read; expect roughly 10–15% defects there.
- **Dareke** — a skim of the 491 unread strings still found 59 problems.

Rigi's seeded sample content (task titles, mail subjects and bodies, project names, chat messages,
invoice lines, audit and system-log messages) is now also Georgian when the UI is: about 98% of the
visible seed strings. It is applied as a dictionary over the mock API's responses
(`demos/rigi/src/demo/ka/`), so the English seed stays the source of truth.

## Typical errors (so a reader knows what to look for)

1. **Wrong sense of a technical term** — the costly kind: "event bus" → ავტობუსი (a vehicle),
   "credentials" → სერტიფიკატები, "ticket stub" → ყუნწი (a stalk), "drawer" → განყოფილება,
   "mail clients" → კლიენტები, "iterate" → ითვლის (counts), "race condition" → რბოლა (a contest).
2. **Calques and stilted order** from English.
3. **One concept, several words** — the most common issue in the UI strings.
4. **Register** — portal copy uses informal „შენ“ to match boulder.ge; the demos and the demo bar use
   formal „თქვენ“. This split is deliberate (see the open question below).
5. Numerals taking a plural noun, case endings on Latin names, and similar grammar slips.

## Terms that were settled (so all eleven projects read as one voice)

| English | Georgian | Notes |
|---|---|---|
| we built it | ავაგეთ | replaced ავაწყეთ / ავაწყვეთ everywhere |
| demo | დემო | live demo = ცოცხალი დემო |
| mocked / simulated | სიმულირებული | noun: სიმულაცია |
| tab | ჩანართი | |
| invoice | ინვოისი | kept over ანგარიშფაქტურა: Rigi's UI uses it 100+ times |
| phone call | ზარი | only phone calls; a log line is სტრიქონი |
| customer / end user | მომხმარებელი | studio's client / tenant business = კლიენტი |
| endpoint | ენდფოინთი | |
| event bus | მოვლენათა არხი | |
| credentials | კრედენციალები | alternative: წვდომის მონაცემები |
| dashboard | მართვის პანელი | |
| knowledge base | ცოდნის ბაზა | |
| workspace | სამუშაო სივრცე | |
| PBX extension | შიდა ნომერი | directory = ცნობარი |
| stack | სტეკი | |
| seed data | საწყისი მონაცემები | |
| Tova: event | ღონისძიება | brand "Ritmuli Events" stays |

## Open questions for a native reader

Each item is a passage the reviewers themselves were unsure about (file:key, the Georgian, the concern).

### Portal and demo bar
- `meta.title` "მოსინჯავ" for "click through"; `portal.lead` "რეალურ საქმეზე მომუშავე ბიზნესებისთვის" is a loose
  rendering of "real-world operations".
- Register: portal copy is informal „შენ“ (as boulder.ge, whose source says never თქვენ), the demo bar is formal „თქვენ“.
  Is that split what you want?
- `status.live` "მოქმედი"; `detail.creative` "კრეატიული გადაწყვეტები" for "solved creatively"; `reset`
  "დემო მონაცემების აღდგენა" is exactly 1.6× the English (button width); `builtBy` "შექმნა Boulder-მა".
- `nav.works` is 2.2× and `portal.all` 1.67× the English length. Both are boulder.ge's own words — check the
  mobile header width.

### Portfolio entries
- **Tova / Bani:** "ეჭიმება/ჭიმვა" for "stutter" (may be slang); "ოთხროლიან კონსოლშია" (a coinage); "საწარმოო
  პლატფორმა" for "enterprise platform" (may read as "manufacturing" — "კორპორატიული"?); "მონაკვეთი" for a call leg
  (the demo UI says "სეგმენტი"); "დონეშესაცვლელი" (coinage); "ესქეიპდება", "ფიქსტურა" (transliterations).
- **Rigi / Sinji:** "ბილეთის ყუის" for "ticket stub"; "ადმინისტრაციული სივრცე" for "back office" (ბექ-ოფისი?);
  "ტილო" for canvas; "რეალმი" for realm; "განაჩენი" for verdict (a court sentence — "დასკვნა"?); "პასაჟი"/"ჩანკი"
  (the UI says ნაწყვეტი/ფრაგმენტი); "დაფუძნება" vs the UI's "გამყარება" for grounding; "წინადადება" for proposal
  can read as "sentence" ("შეთავაზება"?).
- **Dareke / Chiti / Azri:** "ეკრანი მარშრუტით" for "routed screens"; "წესდება" for "rulebook"; "კომპოზერი" for the
  message composer; "ღია circuit breaker"; "ინექტირებული საათი" for "injected clock"; "პერსონა"; "ეჯდა" ("sat on it").
- **Tonnaro / Nabadi:** "ფასის გარეშე შეთავაზებაც…" ("unpriced offer": the code holds the truck from `offer_sent`, so
  "unaccepted" may be meant); "დანიშვნა" for vehicle/driver assignment (მიბმა? გამოყოფა?); "ესკეიპირებს" for CSV
  escaping; "რბოლა" for race condition; "დღიური" for "diary" (an appointment book — can read as a personal
  journal); "ჯავშნის გარეშე მოსულები" for "walk-ins"; "ორაკული".
- **Printomato / Gisheri:** "შეკვეთების წიგნი" for "order book" ("ჟურნალი"? "რეესტრი"?); ფლაგი / დროშა / ალამი for
  "flag"; "ფასეტი" for "facet" also means a gem cut; "ქსელი" is used both for the kiosk fleet and for the network
  (`ქსელიდან ითიშება`); "სანდო წყარო" for "authority"; "ლოგიკა (backoff)"; "გაუმჭვირვალე შიფრტექსტი".
- **Stack chips:** `TypeScript 5.7 (strict)` kept in English ("strict რეჟიმი"?); "i18next (KA/EN)"; "Tailwind CSS 4
  (კონფიგურაცია CSS-ში, @theme)" is a loose rendering; "smsoffice.ge SMS გეითვეი"; "ბანდლი" is IT slang.
- **Printomato role:** "Full-stack, on a two-developer project. We owned the payment stack…" — please confirm this is
  accurate for the studio.

### Demos (interface strings)
- **Tova:** ღონისძიება vs ივენთი (45 strings changed to ღონისძიება); "ჩამოვარდნილი ნივთები" reads as "fallen"
  rather than "falling"; "ონლაინ ცხრილი" may read as "web-based" not "live"; "ნათამაშები"; "წრიული ღილაკით" (calque of
  "radio button"); "არ უჩანთ"; "სუპერვაიზერი" vs "ზედამხედველი"; "ნარინჯისფერი" for "persimmon"; "განულება" for
  reset; "თამაშის ლეგენდა"; "განახლდა" vs "Computed at"; "გაუშვით" for "Let it fall".
- **Bani:** `common:features.cdr` "ზარების ჩანაწერები" clashes with "ჩანაწერი" = recording ("ზარების ჟურნალი"?);
  `roles.cc-admin` "…ადმინი" vs `roles.admin` "ადმინისტრატორი"; `calls:reasons.transfer` "გადართვა" — check the
  transfer / forward / redirect split against PBX docs; `health:lanes.rtt` "მიმოცვლის დრო" (just "RTT"?);
  "გაერთიანების ფანჯარა"; "ჩვენებადი სახელი"; "გასუფთავება" used to revert pending roster changes;
  "რაღაც შეცდომა მოხდა" (casual); "ღამის გადავსება" (overflow queue); "ზარალის ხაზი" (claims line);
  `shell:header.viewAs` "ნახვა როგორც"; "არქივის გასუფთავება" for a destructive purge (წაშლა?);
  `calls:form.from/to` bare "დან" / "მდე" as labels.
- **Rigi:** all "ინვოისი" (110 uses — swapping to ანგარიშფაქტურა is mechanical if wanted); `actions.reset`
  "საწყისზე დაბრუნება" (button width); `actions.discard` "უარყოფა"; `architecture.onprem` "ლოკალური";
  "ინტერაქტიული დემო"; `ledger:invoice.dispute.open` "ინვოისის გასაჩივრება"; `mailStatus.followup` "საჭიროებს
  რეაგირებას"; `ops:backfill.title` "ბექფილი"; `nav.unusedAllowance` "აუთვისებელი ლიმიტი"; `nav.reports` "ანგარიშები"
  clashes with ანგარიში = account; `line-items` "სტრიქონები" (პოზიციები is the business term); `lineKind.subscription`
  "გამოწერა"; `partners:overview.seatPool` "ადგილების ფონდი"; `portal:task.verify.title` "დავადასტუროთ…?".
- **Sinji:** "ხედავთ როგორც: {{name}}" ("Viewing as") is awkward; "კრედენციალი" (alt: წვდომის მონაცემები);
  "დაიჯესტი" for digest (~50 strings); "წინადადება" for proposal (18 strings; "შეთავაზება"?); "განწყობის წაკითხვა"
  (calque of "read sentiment"); "ცვლილება" for "override"; "ჩართ." / "გამორთ." abbreviations;
  "შედით მეტი შესაძლებლობისთვის"; "გაიარა {{passed}}-მა"; "გატარება და დადასტურება". **Read `kb.json` and
  `kbQuality.json` in full.**
- **Dareke:** `agent:dialbar.hold` "მოცდა" (alt: "ლოდინი"); `unmute` "ხმის ჩართვა" does not mirror mute "დადუმება";
  `shell:nav.reports` changed to "რეპორტები" to avoid ანგარიში; `config:statuses.description` "ზეგანაკვეთურად
  ინიშნება" vs the wall's "დრო ამოიწურა".
- **Chiti:** `widget:chat.talkToHuman` "ადამიანთან საუბარი" (alt: "ცოცხალი ოპერატორი"); "აყვანა" for taking a chat
  ("აღება"?); "ცოცხალი სამუშაო მაგიდა" for "live desk" (calque); `superadmin:origins.title` "წყაროები";
  `widget:live.steps.ask.body` "რა მივირთვა ხაჭაპურთან?" means "what to eat" (same line in `demo/content/widget.ts`);
  `widget:store.add` "კალათაში" has no verb; "მუხაში დაძველებული" (clipped); `widget:status.waiting` "ველოდებით
  ოპერატორს" is first person plural; `copilot.circuitBody` "წრედი გახსნილია" (jargon).
- **Azri:** `respondent.poweredBy` "ტექნოლოგია:" before a logo; "API საცდელი გარემო"; "ინტერაქტიული დემო" for "Live
  demo"; `inbox.message.expiresIn_*` "ვადა: {{count}} დღე" reads as a lifetime, not time remaining; "SMS ჟურნალი"
  may read as "magazine"; "შეცდომა" for "Something went wrong"; `rating.2` "სუსტი" for "Fair"; `status.unknown`
  "არასწორი ბმული"; `intro.openUntil` "9 ოქტ 2026-მდე"; "მოთხოვნის სხეული" for request body. The respondent footer
  hard-codes Latin "Azri" while the rest of the Georgian UI says "აზრი".

## Not covered

- The Georgian SMS body in `demos/azri/src/features/staff/sms.ts` and the seed JSON of most demos (Rigi's is covered).
- The four original demos' interface strings (Tonnaro, Nabadi, Printomato, Gisheri) — only their portfolio entries were
  reviewed.
- Dates and relative times: some Chromium builds lack `ka-GE` date data and show English dates; Chrome, Safari and
  Firefox are fine.
