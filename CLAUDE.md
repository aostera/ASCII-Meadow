# ASCII Meadow — инструкции для Claude

Проект: `aostera/ASCII-Meadow`, ветка `main`. Не предполагай, что успешный локальный CI автоматически означает, что пользователь видит актуальный прод.

## Прочитай перед каждым изменением
1. `notes/Для Claude.md` — требования автора, стиль игры, правила и handoff.
2. `notes/Сессия 2026-10-13.md` — актуальные баги с тенями, травой, слоем деревьев и публикацией.
3. `notes/Техническая архитектура.md` — порядок подключения систем, управление сценой и физикой.
4. `notes/Хронология.md` — прошлые решения и отказы.
5. `notes/Бэклог.md` — незавершённые задачи.

## Контракт работы
- Вся графика — согласованное монохромное готическое ASCII. Ни один новый объект не должен выглядеть отдельно наклеенным слоем.
- `src/data/map.js` — вручную созданная карта автора. Нельзя регенерировать координаты, стирать объекты или подменять её произвольной тестовой картой. Отдельно проверяй её наличие в **публичном production**.
- Отрисовка: depth для замка/руин, Y-sorted 3D tree/tent/fence, ближний объект закрывает дальний; трава физически взаимодействует со всеми объектами и сохраняет корни у подножий. Тени должны опираться на `LGT`, реальную геометрию и ground projection.
- Любые изменения должны работать в WebGL2 и Canvas2D, на мобильном экране, в редакторе и после resize/undo/redo.
- Успешный `Workers Builds` означает только успешный процесс Cloudflare. **Обязательно** сверяй реальный endpoint: `node tools/check/production-parity.cjs` (нужен `dist/` после `sh tools/build_site.sh dist`) и браузерные проверки.
- `tools/build_site.sh` проставляет уникальный revision query для каждого JS/CSS и создаёт `build.json` и `_headers`. Не удалять это без эквивалентной защиты от старой карты в браузерном кеше.
- Не путать «код внесён», «CI зелёный», «прод отдаёт нужные ресурсы» и «сцена визуально соответствует запросу» — это разные уровни проверки.
- По окончании каждого значимого пакета обновить `notes/Для Claude.md`, `notes/Хронология.md`, `notes/Техническая архитектура.md`, `notes/Бэклог.md`, `notes/Сессия YYYY-MM-DD.md`: проблема, причина, решение, файлы/функции, проверки, что ещё не подтверждено.


## Three.js experiment (2026-10-13)
- Branch `experiment/threejs-ascii-prototype`, draft PR #37; this does not replace `main` or alter the map. Claude handoff: `experiments/three/CLAUDE_HANDOFF.md`.
- `gothic.js` real 3D arches/buttresses/batched stone, `knight-rig.js` test idle/walk/run/jump/cape, `ground-contacts.js` approximate grass/structure contacts; all isolated.
- No claim of full sprite, world or performance parity. Must inspect browser screenshots and test real iPad Safari before merging.
