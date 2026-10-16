---
tags: [проект, gamedev, ascii, gothic]
статус: активная разработка Three.js, исходная игра стабильна
обновлено: 2026-10-16
---

# ASCII Meadow

Мрачная готическая ASCII-игра в браузере с видом сверху под углом: рыцарь, высокая трава с ветром/контактом, лагерь, коровы и NPC, руины, дорога к огромному замку в тумане. Изображение составлено из символов одного размера.

## Версии

- [Стабильная исходная игра](https://ascii-meadow.aloster36.workers.dev/) = `main`.
- [Новая игровая версия native Three.js](https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/native.html) = рабочая `experiment/threejs-ascii-prototype`, **не production**.
- [Текущее состояние](https://github.com/aostera/ASCII-Meadow/blob/experiment/threejs-ascii-prototype/experiments/three/STATUS.md) и [очередь T00–T09](https://github.com/aostera/ASCII-Meadow/blob/experiment/threejs-ascii-prototype/experiments/three/AUTO_ROADMAP.md).

## Статус

Старый WebGL2 glyph batch + Canvas2D fallback остаются рабочими. Новый native Three переносит игровой кадр, истинную глубину, слои теней и окружение без переписывания авторской карты. На 16.10.2026 PR #59/#60 со shadow fixes и #62 с жестами редактора в экспериментальной базе; T05/T06/T07/T08 ещё не окончательно приняты, архитектурный арт T02/T03 отложен. Арт-приёмка и реальные мобильные устройства не завершены.

## Документы

[[Визуальное направление]] · [[Техническая архитектура]] · [[Бэклог]] · [[Хронология]] · [индекс](README.md). Исторические заметки за 9–14 октября читать как историю, не как рабочий порядок.
