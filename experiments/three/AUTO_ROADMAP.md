# ASCII Meadow — рабочая очередь переноса T00–T09

**Актуализировано:** 2026-10-16 (срез 18:54 UTC). Источник подтверждённых статусов — [STATUS.md](STATUS.md), история — [ENVIRONMENT_MIGRATION_LOG.md](ENVIRONMENT_MIGRATION_LOG.md), общая задача — [issue #53](https://github.com/aostera/ASCII-Meadow/issues/53).

## Приоритеты

Владелец изменил порядок 16 октября: **сначала системный перенос**, только потом художественная полировка архитектуры. Одновременно допустимы **разные** задачи с разными PR; не мержить одни и те же файлы без синхронизации GPT/Claude. Рабочая база — `experiment/threejs-ascii-prototype`, не `main`.

| ID | Статус | Задача / критерий окончания |
|---|---|---|
| T00 | DONE | Первоначальный full CI экспериментального native |
| T01 | DONE (аудит) | Desktop + mobile viewport, 4 здания; это не финальный art sign-off |
| T04 | IN_REVIEW | [#59](https://github.com/aostera/ASCII-Meadow/pull/59) + [#60](https://github.com/aostera/ASCII-Meadow/pull/60) merged. Проверить тени всех объектов с проёмами, поворотами и undo/redo без прямоугольников/ghost-shadows |
| T05 | IN_REVIEW | Растительность/глубина/пружины; читаемость NPC в кустах — [PR #64](https://github.com/aostera/ASCII-Meadow/pull/64); «разрез ножом» заменён естественным изгибом веток (`fix/three-t05-bush-natural-parting`); реальный телефон остаётся gate |
| T06 | IN_PROGRESS | Tents/fences/fires/road/stone/Gothic props, collision и grounding без плоских подмен |
| T07 | IN_PROGRESS | Touch pan/pinch [#62](https://github.com/aostera/ASCII-Meadow/pull/62) merged (`73cf6c8`); editor scroll, HUD, lifecycle, контекст и настоящий Safari |
| T08 | IN_PROGRESS (baseline draft) | [#61](https://github.com/aostera/ASCII-Meadow/pull/61) — baseline native perf, никаких недоказанных FPS |
| T02 | PARKED | Замок: [#54](https://github.com/aostera/ASCII-Meadow/pull/54) draft, невидимый рельеф не принимать как готовую геометрию |
| T03 | PARKED | Три разные руины: [#58](https://github.com/aostera/ASCII-Meadow/pull/58) draft/stacked |
| T10 | TODO | **Управление на телефоне и планшете** (владелец 17.10: «супер корявое»). Сейчас в `src/core/input.js` ходьба = удержание и протяжка к точке пальца относительно рыцаря, бег только при протяжке дальше 28 клеток, прыжок = короткий тап рядом с рыцарем, тап в стороне = порыв ветра, «использовать» только тапом по рамке; нет видимого джойстика/кнопок и мультитача. Сделать native-слой: плавающий стик + кнопки прыжка/действия/бега, мёртвая зона, без конфликта с редактором и pinch, phone portrait/landscape и планшет; тест Chromium touch + отметка о непроверенном реальном iOS/Android |
| T09 | TODO | Full-game parity (после T10), QA реальных устройств, возврат GPU/fallback, контроль карты, художественное решение владельца |

**Технически подтверждено:** head `c1f12b6496` после #60 имеет [CI success](https://github.com/aostera/ASCII-Meadow/actions/runs/38944223018) и [editor/character success](https://github.com/aostera/ASCII-Meadow/actions/runs/38944215332). Обновлённые PR проверять по их собственному CI, а не по зелёному предыдущей базы.

## Как закрывать этап

1. Сверить текущий branch head, последний PR и [issue #53](https://github.com/aostera/ASCII-Meadow/issues/53); не считать старое `IN_PROGRESS` доказательством, что работа не была сделана.
2. Сделать изменение **в native game**, тесты desktop/phone Chromium/SwiftShader, доказательство отсутствия изменений `src/data/map.js`, отсутствие регрессий архитектурной глубины, input и fallback. Для визуального эффекта — реальные changed pixels / on-off-on, а не только количество meshes.
3. После merge в experiment проверить новый head CI, branch deployment (если доступен), записать реальные ограничения, отдельно выделить **hardware pending**. Только затем закрыть этап и синхронизировать `STATUS.md`, этот документ и issue #53.
4. Если внешняя проверка невозможна — `BLOCKED_EXTERNAL` с точным недостающим устройством/артефактом, двигаться по следующему независимому пункту. Никакой автоматической публикации в `main`.
5. T02 и T03 не брать как следующие после T04, пока не закрыты T05–T08 или владелец прямо не поменяет приоритет. T09 — в последнюю очередь.

Технический gate ≠ художественная приёмка ≠ релиз. PR #37 (experimental → main) остаётся draft. Персонажи/Ashen Vow — отдельный трек; платный Tripo без разрешения не запускать.

**Передача между GPT и Claude:** в описании каждого PR или handoff оставлять цель, номер задачи, затронутые файлы, CI run, фактический SHA, визуальные ограничения и следующий шаг. Работа поровну, без иерархии. Скриншоты — по ссылкам на GitHub artifacts, не маленькими вставками в чат.
