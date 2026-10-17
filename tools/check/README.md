# Проверки

Самой игре ничего не нужно. Инструментам проверки нужны Node 22 и `npm ci` (eslint, playwright).
Chromium ставится командой `npx playwright install chromium`; можно указать свой: `CHROMIUM=/путь/к/chromium`.
WebGL в безголовом режиме работает через SwiftShader, флаги уже в скриптах.

| Скрипт | Что проверяет |
| --- | --- |
| `syntax.cjs` | `node --check` всех скриптов `src/` и `tools/` |
| `lint.cjs [--warnings]` | ESLint по скриптам, склеенным в порядке загрузки (одна глобальная область): `no-undef`, `no-redeclare`, `no-dupe-keys`; ответ — `файл:строка` |
| `resources.cjs` | подключения существуют и относительны, каждый файл `src/` подключён ровно один раз, нет встроенного кода в `index.html`, `main.js` последний |
| `smoke.cjs <url> [--out DIR] [--quick]` | игра в Chromium с утверждениями: мир, WebGL2, 2D, управление, коровы, касания, ресайз, старт в окне нулевого размера, консоль |
| `det.cjs` + `diff.py` | детерминированный прогон и попиксельное сравнение «до/после» |
| `perf.cjs <A> <B> [N]` | загрузка, CPU на кадр (у старта и в пути), глифы и вызовы отрисовки, куча JS; медиана N прогонов |

`common.cjs` — общее для всех: запуск Chromium и детерминированная среда.
- `Math.random` с фиксированным зерном.
- Фиктивные `performance.now`, `Date.now`, `requestAnimationFrame` и `setTimeout`.
- Счётчики отправок на GPU и флаг `__noGPU`, который их глушит (для быстрых перемещений). Кадр при этом всё равно собирается.

## Сравнение «до/после»

Одинаковый код и одинаковый ввод дают одинаковые пиксели. Поэтому перенос кода проверяется сравнением скриншотов:

```sh
git show <коммит>:index.html > /tmp/before.html          # версия до правки (одним файлом)
#   или git worktree add /tmp/before <коммит>            # модульная версия
node tools/check/det.cjs file:///tmp/before.html /tmp/shots/b gl
node tools/check/det.cjs "file://$PWD/index.html" /tmp/shots/a gl
python3 tools/check/diff.py /tmp/shots/b /tmp/shots/a --out /tmp/shots/diff   # код выхода 0 = совпадает
```

- **Аргументы `det.cjs`:** `<url> <префикс> [gl|2d] [ширина] [высота] [mob] [сценарий]`.
- **Сценарии:**
  - `main` — старт, ходьба, бег, прыжок, мышь, ресайз;
  - `dirs` — 8 направлений, бег, коровы;
  - `cows` — стадо, испуг;
  - `castle` — стена, лестница, ворота, «E»;
  - `touch` — касания (вместе с `mob`).
- **Режимы:** 2D-резерв удобнее гонять в окне 640×400; мобильный режим — `gl 0 0 mob`.
- **`diff.py`:** падает на пустом наборе, на пропусках и на различиях. `--tolerance 1` гасит шум ±1 в тексте на мобильном: такой шум есть даже между двумя прогонами одной версии.



| `npc-atlas.cjs` | Спецификация PNG: размеры, ≤60 кадров, FPS, 1/8 ракурсов, безопасные пути, fallback |
| `npc-atlas-browser.cjs` | Синтетический PNG через реальный UI редактора, `idle/walk/talk`, runtime rendering WebGL2 / Canvas 2D и проверка неизменности `map.js` |

| `npc-atlas-audit.cjs` | Unit: пустые/дублирующиеся кадры, одинаковые 8 направлений, скачки силуэта, валидные кадры |

| `npc-gallery.cjs` | Узловые правила выборки кадров для contact sheet, лимиты 4/2 и гарантированный выбор последнего сегмента |

| `npc-hermit-art.cjs` | Проверка 288 кадров, 8 ракурсов, прозрачности и регенерации PNG Отшельника |
| `npc-readability.cjs` | Два постоянных NPC: занятость мелкой 12×14 ASCII-сетки и тональный диапазон во всех 576 кадрах |

| `standalone-npc.cjs` | Встроенные villager/hermit PNG в автономной HTML и body-сборке, побайтовая сверка, отсутствие внешних путей |


## Native Three.js: профильные QA (ветка experiment)

| Тест/набор | Охват |
|---|---|
| `three-native-game.cjs`, `three-parity.cjs` | Настоящий native runtime, одно WebGL2-окно, source-сцена, fallback, frozen parity |
| `three-native-shadow-layer.cjs`, `three-native-shadow-coverage.cjs`, `three-native-body-shadows.cjs` | Слой архитектурных теней; тень замка за пределами исходного окна и края 3×3; контактная тень рыцаря/NPC/коров без изменения directional casts |
| `three-native-tree-depth.cjs`, `three-native-bush-depth.cjs`, `three-native-stone-depth.cjs` | Объекты и GPU depth/occlusion на desktop и phone viewport |
| `three-native-bush-contact.cjs` | T05: NPC идёт сквозь самые густые заросли — ветви раскачиваются от шагов (пик, смены направления, реальные пиксели), листва перед телом остаётся (≥50% от покоя, без «щели»), после ухода крона затухает до исходного рисунка без рывка |
| `three-native-camp-fire.cjs` | T06: рыцарь за каждым authored костром и перед ним — порядок отрисовки как в исходной игре (котёл и пламя перекрывают ноги сзади, рыцарь перекрывает огонь спереди, реальные пиксели меняются), центр огня твёрдый через общий `fireBlocksMove`, точки рядом проходимы; desktop+phone, карта неизменна. Запускается в `three-camp-qa.yml` вместе с `three-native-props-depth.cjs` |
| `three-native-grey-editor.cjs`, `three-native-editor-touch.cjs` | Серые модели и поворот руин; pan двумя пальцами и pinch-zoom редактора (CDP touch, phone + tablet), undo восстанавливает карту побайтно |
| `three-native-recovery.cjs`, `three-native-android.cjs`, `three-native-mobile.mjs` | Потеря/восстановление WebGL, Android portrait/landscape, смена плотности, pointercancel, fallback без WebGL2 |
| `three-performance.cjs`, `three-device-profiler.cjs` | Лабораторная нагрузка; **не** аппаратные FPS |

Соответствующие workflow находятся в `.github/workflows/three-*`. Жесты редактора (#62) влиты; проверки оптимизации из PR #61 нельзя считать базовыми, пока PR не влит. Для локального прогона без доступа к CDN three.js нужен локальный пакет `three@0.186.1` (сеть контейнера может блокировать jsdelivr). Источник статуса — [Three STATUS](https://github.com/aostera/ASCII-Meadow/blob/experiment/threejs-ascii-prototype/experiments/three/STATUS.md).