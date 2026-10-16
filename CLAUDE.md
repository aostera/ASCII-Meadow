# ASCII Meadow — правила для GPT и Claude

**Актуализация 2026-10-16.** Это единый маршрут независимо от того, кто исполняет задачу. При разногласиях сначала проверяйте фактический GitHub head/PR/CI и [живой статус Three](https://github.com/aostera/ASCII-Meadow/blob/experiment/threejs-ascii-prototype/experiments/three/STATUS.md).

## Две ветки, одно правило изоляции

- **`main`** = стабильная исходная игра, https://ascii-meadow.aloster36.workers.dev/, корневой `index.html` и `src/`. Поддержка только по отдельному прямому запросу. Не менять там визуал/спрайты/карту ради переноса.
- **`experiment/threejs-ascii-prototype`** = работа над новым движком. Feature-ветка от свежего tip, PR **в experiment**, не в `main`. Целевой экран `experiments/three/native.html` (публичный [preview](https://experiment-threejs-ascii-prototype-ascii-meadow.aloster36.workers.dev/experiments/three/native.html)).
- `experiments/three/index.html` и `parity.html` — только лаборатории; `procedural.html` — старый визуальный прототип. Фича готова к проверке, когда интегрирована именно в `native.html`.
- Код/ассеты нового движка под `experiments/three/`, QA под `tools/check/three-*`; производственные `src/data/knight-frames.js`, `src/data/cow-frames.js`, `src/data/map.js` использовать read-only.

## Самая свежая очередь — не здесь

**Начинать с:** [STATUS.md](https://github.com/aostera/ASCII-Meadow/blob/experiment/threejs-ascii-prototype/experiments/three/STATUS.md), затем [AUTO_ROADMAP.md](https://github.com/aostera/ASCII-Meadow/blob/experiment/threejs-ascii-prototype/experiments/three/AUTO_ROADMAP.md), [issue #53](https://github.com/aostera/ASCII-Meadow/issues/53), открытых PR и последних Actions. Краткие состояния на 16 октября: T00/T01 done, T04 needs acceptance after #59/#60, T05/T06/T07/T08 active, T02/T03 parked, T09 todo. **Статус может измениться.**

Персонажи/Ashen Vow и glTF/Tripo — отдельная очередь и draft PR. Не запускать платные генерации без явного разрешения. Для заказанных sprite-анимаций движения `walk/run/jump` — не меньше 60 кадров на требуемый ракурс и почти круговой набор направлений; не выдавать наличие короткой glTF-анимации за соответствие спрайтовому требованию.

## Неприкосновенные вещи

- Авторская `src/data/map.js`, расстановка, исходные атласы и геометрия — без перегенерации и произвольной подмены.
- Визуал — почти монохромная мёртвая готика; объём, корректный Z/depth, открытые арки, локальные источники света, правдоподобная жёсткость анимаций и физический контакт растений. Не маскировать проблемы общей яркостью/alpha или плоскими прямоугольными накладками.
- В native один WebGL2 context; Canvas2D fallback, input/resize, editor export/undo и context restore сохранять.
- Каждый PR: исходная карта неизменна, Chromium WebGL2 desktop+phone, профильный тест, визуальная проверка **реальных пикселей**, CI ссылки и отметка, какой device **не** тестировался. Реальный Android/iOS/Safari и измерения физического GPU — отдельный release gate.
- **Никакого переключения production и merge PR #37 в `main` без отдельного прямого решения владельца.**

## Взаимодействие

GPT и Claude **равноправны, работу делить 50/50**, без самоназначенного арт-директора. Не править одни документы/модули одновременно. После каждого блока — история `Txx | что сделано | PR/ветка/commit | тесты | что осталось | следующий исполнитель`, обновить STATUS/roadmap и issue при изменении статуса. Не вставлять трудно открываемые мелкие скриншоты; передавать полноразмерные GitHub artifacts/прямые ссылки.

[Текущая документация](notes/README.md) · [история](notes/Хронология.md) · [визуальные правила](notes/Визуальное%20направление.md).
