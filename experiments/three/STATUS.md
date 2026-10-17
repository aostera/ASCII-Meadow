# ASCII Meadow — текущее состояние Three.js

**Срез:** 2026-10-17 (интерьер V2). Базовый системный статус T00–T09 ниже содержит исторический срез 16 октября; проверять актуальные PR/CI перед новыми правками.

## Обновление 2026-10-17 — V2 башен и галерей (merged, арт на ревью)

- [PR #83](https://github.com/aostera/ASCII-Meadow/pull/83) **merged только в experiment**: кроме девяти помещений первого яруса теперь две функциональные винтовые лестницы, два верхних зала башен и две проходные галереи (**всего 13 связанных зон**); анимированная высота 0↔7,5, на II ярусе собственные коллизии и запрет выхода из замка поверху. Мебель, колонны, алтарь и саркофаги перестали быть проходимыми насквозь.
- Сохранены сенсорные элементы Claude из [PR #81](https://github.com/aostera/ASCII-Meadow/pull/81) и самостоятельное управление/кнопка лестницы внутри замка, без вмешательства в исходный `src/`, `MEADOW_MAP` и production `main`.
- [QA #83](https://github.com/aostera/ASCII-Meadow/actions/runs/39058605309) PASS: Chromium на компьютере и телефоне, реальный маршрут от нефa до западной башни, подъём/спуск через `E` и *touch-button*, повтор в Cloudflare-compatible `dist/`, карта остаётся неизменной. Live Cloudflare подтверждается отдельно [Published Castle Entry QA](https://github.com/aostera/ASCII-Meadow/actions/workflows/castle-live-entry-probe.yml) по хэшу опубликованного коммита.
- Это **не финальный арт**: внутри по-прежнему малополигональная архитектура, не полное ASCII-преобразование, placeholder рыцаря до интеграции параллельного Ashen Vow, нужны визуальная приёмка пользователя и реальные iOS/Android. Подробный контракт: [CASTLE_INTERIOR.md](CASTLE_INTERIOR.md).

## Обновление 2026-10-17 — интерьер замка, V1 (история) (IN_REVIEW)

- [PR #79](https://github.com/aostera/ASCII-Meadow/pull/79) **merged в experiment, не в main**: действующий вход через центральные ворота (`E` / кнопка на телефоне), 9 связанных помещений с физическими проходами и коллизиями (зал, алтарь, часовня, оружейная, два коридора, две башни, привратный зал), выход обратно в наружную карту без изменений `MEADOW_MAP`.
- Файлы только в `experiments/three/`: `castle-interior.mjs`, `castle-interior-layout.mjs`, `native.js`, `native.css`, [CASTLE_INTERIOR.md](CASTLE_INTERIOR.md). В `tools/` добавлены тесты и защищённая публикация *только* native Three runtime через Cloudflare dist; `src/` и production не изменялись.
- [Castle Interior QA success](https://github.com/aostera/ASCII-Meadow/actions/runs/39039002408): настоящий WebGL2/Chromium desktop/phone, тест исходной сцены и опубликованного `dist/`, 9 комнат, вход `E`, выход и отсутствие изменений карты. Cloudflare feature-preview build success, но доступность публичной страницы из внешнего клиента проверить отдельно. История секретов clean по шаблонам.
- **НЕ FINISHED ART:** пока это мрачный low-poly архитектурный blockout с основными арками и проходами, не утверждённый финальный интерьер; лестницы в башнях пока декоративные, нет функционального второго этажа, нужно художественное ревью и реальные Android/iOS. Два соседних долгих QA на момент этого обновления ещё выполнялись: editor/character и bush. `main` не трогать.

## Где работает проект

- **Production:** `main`; https://ascii-meadow.aloster36.workers.dev/ — исходная игра, не менять без отдельной команды владельца.
- **Рабочая база переноса:** `experiment/threejs-ascii-prototype`; https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/native.html — настоящая игровая страница нового рендера, но **не завершённая миграция**.
- `experiments/three/index.html` / `parity.html` — лаборатории и сравнения; `procedural.html` — устаревший прототип, **не** конечная игра.
- Критичные файлы: `native.html`, `native.js`, `native-gl.js`, `three-glyphs.js`, `native-architecture-depth.mjs`, `native-shadow-coverage.js`, `native-body-shadows.js`, `native-bushes.js`, `native-npcs.js`, `native-mobile-lifecycle.mjs`, `native-editor-models.mjs`, `native-editor-touch.js`. Порядок загрузки в `native.html` значим: `native-body-shadows.js` сразу после `src/world/shadows.js`, `native-editor-touch.js` до `src/editor/editor.js`, `native-shadow-coverage.js` до `native-shadow-soften.js`. Весь оригинальный `src/` читается без записи. Авторская `src/data/map.js` неизменна.

## Доказанное на базовой ветке

- После merge [#59](https://github.com/aostera/ASCII-Meadow/pull/59) исправлены обрезка теней замка исходным окном и геометрические края 3×3; после [#60](https://github.com/aostera/ASCII-Meadow/pull/60) сглажена **только контактная** тень рыцаря/NPC/коров, без изменения направленных теней от солнца, огня и молнии.
- Уже в базе: NPC World GPU-порядок для зарегистрированных палитр, ветки мёртвых деревьев и камни в 3D depth, пружинные кусты и их 3D occlusion, контактная трава у каменной геометрии, вращение серых объектов в редакторе, source-геометрия архитектуры и Canvas2D fallback.
- Контрольный head `c1f12b6496cb245ac503b7c214d0825715df8fbb`: [общий CI success](https://github.com/aostera/ASCII-Meadow/actions/runs/38944223018), [editor/character QA success](https://github.com/aostera/ASCII-Meadow/actions/runs/38944215332). Это Chromium/CI, **не** реальный Android/iOS и не художественная приёмка.
- Статус *merged* относится к коду в experiment, а не к production; доступность конкретной версии на Cloudflare надо подтверждать отдельно.

## Очередь (не путать код и приёмку)

| Пункт | Состояние на указанное время | Что действительно осталось |
| --- | --- | --- |
| T00 | DONE | Проверки исходной базы проведены |
| T01 | DONE — аудит, не арт-приёмка | Восемь кадров замка и трёх руин изучены; дефекты в `ARCHITECTURE_VISUAL_AUDIT_T01.md` |
| T04 | IN_REVIEW | #59/#60 merged и CI зелёный; проверить весь спектр теней, проёмы, повороты, undo/redo, ghost-shadow на живой карте. **Нужен взгляд владельца:** после #59 тень шпилей реально ложится на траву к северо-востоку от замка, эта зона заметно темнее прежнего |
| T05 | IN_REVIEW | [PR #64](https://github.com/aostera/ASCII-Meadow/pull/64) раскрывал куст щелью — владелец 17.10: «режет как нож», и V-клин тоже «всё сливается». Решение владельца: куст **не раздвигать**, а живо шевелить. [PR #65](https://github.com/aostera/ASCII-Meadow/pull/65): толчки веток от каждого шага, раскачивание и затухание, крона перед телом цела (Chromium desktop+phone). Остались: реальный телефон, взгляд владельца |
| T06 | IN_PROGRESS | Довести шатры, заборы, костры, дороги/декор, истинные основания/коллизии без заглушек. 2026-10-17: лагерь в native визуально совпадает с исходной игрой; глубина шатров/заборов и порядок/коллизия костров теперь проверяются на каждом PR в experiment (`three-camp-qa.yml`). Ждём от владельца, что именно в лагере выглядит не так |
| T07 | IN_PROGRESS | Сенсорный pan/pinch редактора — [PR #62](https://github.com/aostera/ASCII-Meadow/pull/62) **merged** (`73cf6c8`, CI зелёный, только эмуляция Chromium); mobile lifecycle, HUD, WebGL recovery и реальный Safari остаются gate |
| T08 | IN_PROGRESS — baseline | [PR #61](https://github.com/aostera/ASCII-Meadow/pull/61) **draft**; нельзя объявлять доказанными аппаратные FPS |
| T02 / T03 | PARKED | Детализация замка [#54](https://github.com/aostera/ASCII-Meadow/pull/54) и трёх руин [#58](https://github.com/aostera/ASCII-Meadow/pull/58) — draft, не мержить до снятия приоритета системного переноса; у #54 был визуально невидимый relief |
| T10 | IN_REVIEW | Управление пальцем в `native.html`: плавающий стик, кнопки прыжка/действия, мультитач — [PR #81](https://github.com/aostera/ASCII-Meadow/pull/81) merged в experiment. Только Chromium-эмуляция; реальные Android/iOS не проверены |
| T09 | TODO | Сквозная parity, реальные Android/iOS, art sign-off и только потом **явное** разрешение владельца на `main` |

Персонажи/Ashen Vow/Tripo — отдельные draft PR #38, #41–45, #52, #55, #56 (#54 — это T02 замок, не персонаж). **Не смешивать** с экологической очередью T04–T09 и не списывать платные кредиты без разрешения. Наличие GLB в feature-ветке не означает интеграцию в базу.

**Открытый PR в `main`:** [#36](https://github.com/aostera/ASCII-Meadow/pull/36) (оптимизация рендера от 13.10) не draft и направлен в production. Не мержить без отдельного решения владельца; к очереди T00–T09 не относится.

## Протокол для двух исполнителей

GPT и Claude — **равноправные исполнители (50/50)**, без самоназначенного арт-директора. Делить независимые задачи/файлы и писать короткий handoff: задача → ветка/PR → фактические файлы → CI/SHA → что не принято → следующий шаг. Не делать параллельных правок одного файла и не использовать старые чек-листы как источник актуального статуса. Сначала обновить эту страницу и [AUTO_ROADMAP.md](AUTO_ROADMAP.md) по проверенным PR, затем [issue #53](https://github.com/aostera/ASCII-Meadow/issues/53). Итоговые сообщения без необработанных скриншотов внутри чата: прямые GitHub-ссылки на PR и артефакты, удобные для телефона.

## Неприкосновенные условия

Не менять `main`, `src/data/map.js`, авторские позиции, исходные спрайты, глобальную яркость/альфу. Новые эффекты и анимации — только в `experiments/three/` в дочерних feature-ветках от свежей experiment; сохранять единственный WebGL2-контекст и Canvas2D fallback. Не выдавать зелёный CI за визуальное совпадение; отдельно отмечать CI viewport vs реальное устройство, опубликованный preview и решение владельца.

## Где история

- [ENVIRONMENT_MIGRATION_LOG.md](ENVIRONMENT_MIGRATION_LOG.md) — хронологический журнал, не текущая очередь.
- [AUTO_ROADMAP.md](AUTO_ROADMAP.md) — статус этапов и порядок.
- [ARCHITECTURE_VISUAL_AUDIT_T01.md](ARCHITECTURE_VISUAL_AUDIT_T01.md) — реальные T01 наблюдения.
- [ASHEN_VOW_REFERENCE_LOCK.md](ASHEN_VOW_REFERENCE_LOCK.md) — неизменённые арт-ограничения персонажа.
