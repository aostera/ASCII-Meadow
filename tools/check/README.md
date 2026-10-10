# Проверка «до/после» без изменения поведения

Игра запускается детерминированно: `Math.random` с фиксированным зерном, фиктивные часы (`performance.now`,
`Date.now`, `requestAnimationFrame`, `setTimeout`), записанный ввод, шрифты из сети отключены. Одинаковый код
даёт одинаковые пиксели, поэтому перенос кода проверяется попиксельным сравнением скриншотов.

```sh
# эталон: версия до правки
git show <коммит>:index.html > /tmp/before.html          # однофайловая версия до рефакторинга
#   или: git worktree add /tmp/before <коммит>           # модульная версия
node tools/check/det.cjs file:///tmp/before.html /tmp/shots/b gl              # сценарий main (1280×800)
node tools/check/det.cjs file://$PWD/index.html  /tmp/shots/a gl
python3 tools/check/diff.py /tmp/shots/b /tmp/shots/a                        # identical / DIFF n px

# режимы: gl | 2d (запасной путь; для скорости 640 400); мобильный: gl 0 0 mob
# сценарии (7-й аргумент): main — старт, ходьба, бег, прыжок, мышь, ресайз; dirs — 8 направлений, бег, коровы;
#                         castle — путь к замку, лестница, «E»; touch — касания (с mob)
node tools/check/det.cjs file://$PWD/index.html /tmp/shots/a gl 1280 800 "" dirs

# CPU на кадр (отправка на GPU заглушена одинаково в обеих страницах), медиана N прогонов
node tools/check/perf.cjs file:///tmp/before.html file://$PWD/index.html 7
```

Нужны Playwright и Chromium (`CHROMIUM=/путь/к/chromium`, по умолчанию `/opt/pw-browsers/chromium`);
WebGL в безголовом режиме — через SwiftShader (флаги уже в скриптах). Мобильные снимки шумят на ±1 уровень
в паре пикселей текста HUD даже между двумя прогонами одной версии: это растеризация текста, не игра.
