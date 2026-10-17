# ASCII Meadow — текущее состояние Three.js

**Срез:** 2026-10-16, 18:54 UTC. Это точка входа для GPT и Claude; статус не заменяет проверку нового head/PR/CI перед следующей задачей.

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
| T05 | IN_REVIEW | [PR #64](https://github.com/aostera/ASCII-Meadow/pull/64) merged, но владелец 17.10: куст «режется как ножом». Исправление — ветка `fix/three-t05-bush-natural-parting`: вместо прямой щели V-образный след, ветви отгибаются от корня и чуть провисают, ноги остаются в листве; худшая заросль 34–46% вместо 15–18% (Chromium desktop+phone). Остались: реальный телефон, взгляд владельца |
| T06 | IN_PROGRESS | Довести шатры, заборы, костры, дороги/декор, истинные основания/коллизии без заглушек |
| T07 | IN_PROGRESS | Сенсорный pan/pinch редактора — [PR #62](https://github.com/aostera/ASCII-Meadow/pull/62) **merged** (`73cf6c8`, CI зелёный, только эмуляция Chromium); mobile lifecycle, HUD, WebGL recovery и реальный Safari остаются gate |
| T08 | IN_PROGRESS — baseline | [PR #61](https://github.com/aostera/ASCII-Meadow/pull/61) **draft**; нельзя объявлять доказанными аппаратные FPS |
| T02 / T03 | PARKED | Детализация замка [#54](https://github.com/aostera/ASCII-Meadow/pull/54) и трёх руин [#58](https://github.com/aostera/ASCII-Meadow/pull/58) — draft, не мержить до снятия приоритета системного переноса; у #54 был визуально невидимый relief |
| T10 | TODO | Управление на телефоне и планшете: владелец 17.10 назвал его «супер корявым». Нужны видимый стик, кнопки прыжка/действия/бега и проверка на планшете — см. [AUTO_ROADMAP.md](AUTO_ROADMAP.md) |
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
