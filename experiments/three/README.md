# ASCII Meadow — перенос на native Three.js

**Статус:** играбельный эксперимент, **ещё не новый production**. [Текущее состояние T00–T09](STATUS.md) · [Очередь](AUTO_ROADMAP.md) · [журнал реализации](ENVIRONMENT_MIGRATION_LOG.md).

- [Игровая версия native Three.js](https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/native.html) — целевая точка интеграции.
- [Редактор native](https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/native.html?edit=1) — изменение объектов без перезаписи исходной карты.
- [Лаборатория сравнения](https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/) и `parity.html` — диагностика, а не новая игра; `procedural.html` — исторический упрощённый прототип.
- [Стабильная оригинальная игра](https://ascii-meadow.aloster36.workers.dev/) — `main`, не заменять без разрешения владельца.

## Локальный запуск

Из корня репозитория: `python3 -m http.server 8080`; открыть `http://localhost:8080/experiments/three/native.html`. Three.js использует pinned CDN 0.186.1, поэтому для первоначальной загрузки нужен интернет. Не запускать игру через `file://` как эквивалент HTTP.

## Архитектура в двух словах

Native читает authored мир, `src/data/map.js`, персонажей и глифы исходной игры. `native-gl.js`/`three-glyphs.js` заменяют путь WebGL2-глифов на Three, при этом сохраняются исходные визуальные данные, игровой рендер, редактор и Canvas2D fallback; используется один WebGL2 контекст. Дополнительно подмешиваются source-derived 3D-глубина реального замка/руин, деревьев, камней/кустов, пружинное взаимодействие и локальные shadow fixes. Это **не** означает готовность всех 3D объектов или арт-моделей рыцаря.

## Подтверждённое и незавершённое

По состоянию на 16 октября в experiment объединены #46–51, #59 и #60; [последний проверенный CI](https://github.com/aostera/ASCII-Meadow/actions/runs/38944223018) — success на `c1f12b6496`. T07 mobile/editor [#62](https://github.com/aostera/ASCII-Meadow/pull/62) ещё открыт; T08 performance [#61](https://github.com/aostera/ASCII-Meadow/pull/61) draft; T02/#54 и T03/#58 отложены; остальные точные статусы — в [STATUS.md](STATUS.md). CI desktop/phone viewport не заменяет физические iPhone/iPad/Android и не подтверждает FPS на реальном GPU.

## QA и правила публикации

- На каждом PR проверять `tools/check/three-*` с подходящими workflow, карту, управление, WebGL2/Canvas2D, потери контекста, shadow/depth, desktop и phone.
- Новые объекты/риг/эффекты не менять в `src/` и `main`, читать `src/data/map.js` только как источник правды; не менять глобальную яркость/прозрачность для маскировки багов.
- GitHub PR в `experiment/threejs-ascii-prototype` и branch-preview — отдельны от оригинального production. Никакого auto-merge экспериментальной игры в `main`.
- [Инструкции обоим исполнителям](CLAUDE.md) · [контракт parity](PARITY_MIGRATION.md) · [архитектурный аудит](ARCHITECTURE_VISUAL_AUDIT_T01.md).
