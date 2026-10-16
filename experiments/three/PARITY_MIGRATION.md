# Контракт визуального и функционального переноса (Three.js)

**Действующая версия:** 2026-10-16. [Текущий статус](STATUS.md) · [очередь](AUTO_ROADMAP.md). Этапные заметки октября 14–16 сохранены в Git-истории и [журнале](ENVIRONMENT_MIGRATION_LOG.md); ранние "not implemented" списки здесь больше не задают работу.

## Принятое решение

Упрощённый процедурный 3D-рендер не может заменить авторскую ASCII-графику. Native-игра `experiments/three/native.html` использует оригинальные данные и игру, переносит GPU glyph output в Three WebGL2, поэтапно добавляет истинную глубину и взаимодействия **без замены автора**. `parity.html` и `index.html` нужны для сравнения/диагностики. `procedural.html` — исторический эксперимент. Production `main` остаётся изолирован.

## Схема

`src/` (read-only authored world + `MEADOW_MAP` + глифы) → `native-gl.js` / `three-glyphs.js` (один контекст WebGL2) → native Three depth/visibility, физика кустов, NPC layering, source-driven shadow layers → browser. Canvas2D fallback и исходный renderer должны продолжать работать. `native-architecture-depth.mjs` использует реальные source solids; архитектурная геометрия не заменяется кубами. Opt-in лабораторные кадры должны сохранять точный 1:1, изменения native мира могут целенаправленно менять пиксели.

## Обязательные gate

- **Source:** `src/data/map.js` и размещение/повороты объектов не меняются; исходные brightness, alpha, персонажные кадры не патчатся.
- **Rendering:** все видимые символы, ориентация персонажей, GPU depth, тени, огонь/молния, стек слоёв и физические контакты работают в native на desktop + phone Chromium; pixel/on-off-on QA для новых визуальных геометрий.
- **Editor:** импорт/экспорт/Undo/Redo, касания/pan/pinch, сохранение геометрии и поворота. Нельзя считать открытый PR внедрённым.
- **Reliability:** context loss/restore, Canvas2D fallback, resize, отсутствие второго WebGL-контекста, проверка опубликованного branch URL.
- **Performance:** равные сцены, draw calls/memory/p95 с проверяемым способом измерения; SwiftShader и виртуальный phone viewport не равны физической GPU.
- **Art/release:** Gothic вид/референсы оценивает владелец; реальные Safari/Android-устройства проверяются отдельно; только после полной приёмки владелец **явно** разрешает изменение `main`.

## Что уже доказано, а что нет

На head `c1f12b6496` CI success после объединения #59/#60, а ранее объединены #46–51. Это доказательство прохождения CI на коде experiment, **не** окончательной архитектуры, T05–T08, кадров 60+ всех спрайтов или FPS на физических устройствах. T02/T03 PARKED, T07/#62 merged (`73cf6c8`) и T08/#61 draft по срезу. Проверять [STATUS.md](STATUS.md) перед новой работой.
