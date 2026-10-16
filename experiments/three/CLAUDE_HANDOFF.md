# Claude / GPT — handoff по Three.js

**Актуально на 2026-10-16 18:54 UTC.** Старые посессионные handoff с временными статусами (PR pending, Stage 2 opt-in, T02 ACTIVE и т.п.) удалены отсюда как рабочие инструкции. Их исходный текст остаётся в Git-истории. Действующие документы:

1. [STATUS.md](STATUS.md) — подтверждённый head, принятые технические исправления, текущие блокеры и PR.
2. [AUTO_ROADMAP.md](AUTO_ROADMAP.md) — очередь T00–T09. Т02/Т03 PARKED, T04 IN_REVIEW, T05–T08 IN_PROGRESS.
3. [ENVIRONMENT_MIGRATION_LOG.md](ENVIRONMENT_MIGRATION_LOG.md) — история реализации и объяснение решений, **не** источник свежего статуса.
4. [PARITY_MIGRATION.md](PARITY_MIGRATION.md) — границы 1:1 и release gate.
5. [ARCHITECTURE_VISUAL_AUDIT_T01.md](ARCHITECTURE_VISUAL_AUDIT_T01.md) — что именно обнаружено на восьми скриншотах.

Перед продолжением задачи проверь новые PR #61 (T08 draft); #62 (T07 touch pan/pinch) merged в `73cf6c8`, поскольку они могут измениться. PR #59 и #60 уже в experiment и прошли профильный CI на head `c1f12b6496`; не переделывай их без нового воспроизводимого дефекта.

**Не трогать `main`, `src/data/map.js`, цвета/alpha и авторские атласы.** Новые исправления только в native, отдельные PR в experiment; 1 WebGL2 context + Canvas2D fallback. Работу GPT и Claude делить 50/50, отдавать друг другу краткую фактическую историю с SHA/тестами/ограничениями, без фиктивного завершения и самоназначенных ролей.
