# ASCII Meadow

Браузерная готическая ASCII-игра: рыцарь, живой травяной мир, лагерь, коровы, NPC, туман и масштабный замок с руинами. Мрачное монохромное пространство, в котором объекты и персонажи состоят из одной сетки глифов.

> **Две независимые линии.** `main` — стабильная оригинальная игра; `experiment/threejs-ascii-prototype` — активный перенос рендера/мира на Three.js. Новые эффекты, модели и анимации сейчас разрабатываются **только в эксперименте**. Нельзя выдавать его за опубликованную замену production.

## Открыть

- **Оригинальная игра (`main`):** https://ascii-meadow.aloster36.workers.dev/
- **Новый playable native Three.js (experiment):** https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/native.html
- **Новый редактор:** https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/native.html?edit=1
- **Прогресс нового движка:** [STATUS.md](https://github.com/aostera/ASCII-Meadow/blob/experiment/threejs-ascii-prototype/experiments/three/STATUS.md) · [T00–T09 roadmap](https://github.com/aostera/ASCII-Meadow/blob/experiment/threejs-ascii-prototype/experiments/three/AUTO_ROADMAP.md) · [issue #53](https://github.com/aostera/ASCII-Meadow/issues/53) · [PR #37](https://github.com/aostera/ASCII-Meadow/pull/37) (draft).

По срезу 16.10.2026 исправления теней #59/#60 объединены в experiment; T05/T06 ещё проверяются, жесты редактора T07 [#62](https://github.com/aostera/ASCII-Meadow/pull/62) влиты (остальной T07 в работе), T08 [#61](https://github.com/aostera/ASCII-Meadow/pull/61) draft, T02/T03 art отложены. Сверяй актуальный GitHub head перед заявлениями о готовности.

## Запуск локально

Старый `index.html` открывается непосредственно в браузере. Для эксперимента (ES modules / Three.js CDN) нужен HTTP:

```sh
python3 -m http.server 8080
# затем: http://localhost:8080/experiments/three/native.html
```

Для dev/QA: `npm ci` (Node 22 и Playwright для browser QA), `npm run check:static`, `npm run check`. Сборка сайта: `sh tools/build_site.sh dist`. Это **не** визуальная приёмка и не проверка физического iPhone/Android.

## Управление старой игрой

| Действие | Управление |
|---|---|
| Ходьба | WASD / стрелки / перемещение пальцем |
| Бег | Shift или длинное мобильное движение |
| Прыжок | Space / тап по рыцарю |
| Взаимодействие | E / тап по подсказке |
| Порыв ветра | G |
| Редактор | M или кнопка внизу слева |

Редактор умеет двигать/вращать объекты, работать кистями, туманом, NPC, кострами, лагерем и руинами, выполнять undo/redo. В экспериментальном `native.html` редактор на телефоне/планшете двигается двумя пальцами и масштабируется щипком (PR #62, проверено в эмуляции Chromium, не на реальных устройствах).

## Авторская карта — не регенерировать

`src/data/map.js` — пользовательский результат ручной работы: координаты, растительность, тропинки, NPC, костры, руины, туман и RLE-кисти. Никогда не заменять её демо-картой, не применять `tools/map/compose.cjs` как импорт. Экспорт из редактора: «Сохранить» → файл `map.js`; проверить и затем импортировать **ровно этот файл**:

```sh
node tools/map/import.cjs "/путь/к/map.js"
node tools/map/import.cjs "/путь/к/map.js" --apply
node tools/map/import.cjs --check
git diff -- src/data/map.js
```

**Во время переноса на Three.js не запускать `--apply` вообще:** оригинальная карта используется read-only; изменение карты — отдельная явная задача владельца.

## Код и документация

| Папка | Роль |
|---|---|
| `src/core/` | игровой цикл, ввод, состояние, камера |
| `src/renderer/` | глифы, WebGL2 и Canvas2D, освещение, painter |
| `src/world/` | карта, замок и руины, растения, лагерь, ветер, туман, тени |
| `src/entities/` и `src/systems/` | рыцарь, коровы, NPC, анимации, физика, взаимодействия |
| `src/editor/` и `src/data/` | редактор и авторская карта/кадры |
| `experiments/three/` | **только в экспериментальной ветке**: native Three.js, GPU глубина, сцена, QA, текущая очередь |
| `tools/check/` | Node/Chromium тесты исходной и новой версии |
| `notes/` | обзор, стиль, архитектура и **исторические** сессии |

[Инструкции GPT/Claude](CLAUDE.md) · [индекс документов](notes/README.md) · [визуальные правила](notes/Визуальное%20направление.md). Полная история прежних подробных README сохраняется в Git, но не используется как текущая спецификация.
