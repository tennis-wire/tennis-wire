# discussion-service

Древовидные комментарии к любым сущностям платформы, peer-блокировки, временные ограничения на
комменты. Отдельная база `tennis_discussion`, порт 8093, за gateway под `/api/discussion/**`.

## Запуск

Все команды — из корня репозитория.

```bash
docker compose up -d postgres keycloak
# один раз, если volume создан до появления сервиса (два отдельных -c: CREATE DATABASE
# не работает внутри транзакции, в которую psql заворачивает одну строку команд):
docker compose exec postgres psql -U postgres \
  -c "CREATE ROLE discussion WITH LOGIN PASSWORD 'discussion'" \
  -c "CREATE DATABASE tennis_discussion OWNER discussion"
./gradlew :discussion-service:bootRun --args='--spring.profiles.active=local'  # swagger на :8093/swagger-ui.html
./gradlew :discussion-service:test                                             # Testcontainers, postgres:18
discussion-service/scripts/smoke.sh                                            # сквозной прогон через dev-realm
BASE=http://localhost:8090 discussion-service/scripts/smoke.sh                 # то же через gateway
```

## API

| Метод | Путь | Роль | Что |
|---|---|---|---|
| GET | `/comments?subjectType=&subjectId=` | аноним | топ-левел, `items[].replyCount`, `nextCursor` (пока всегда `null`) |
| POST | `/comments` `{subjectType, subjectId, body}` | `user` | 201 `{comment, mutedByRecipient:false}` |
| POST | `/comments/{id}/replies` `{body}` | `user` | 201; subject наследуется от родителя; `mutedByRecipient` — автор родителя заблокировал автора |
| GET | `/comments/{id}/branch` | аноним | `{root, nextCursor}`; `root.replies` вложены рекурсивно |
| GET | `/comments/{id}/ancestry` | аноним | `{chain:[root … id]}` без вложенных ответов |
| DELETE | `/comments/{id}` | `user`, только автор | soft-delete, идемпотентно |
| GET / PUT / DELETE | `/blocks`, `/blocks/{blockedId}` `{mode}` | `user` | `mode`: `soft` \| `gravestone` \| `subtree_removal`; PUT меняет режим у существующего |
| DELETE | `/moderation/comments/{id}` | `moderator`, `moderator-bot` | soft-delete без проверки автора |
| POST / GET / DELETE | `/moderation/restrictions` | `moderator` | `{userId, expiresAt?, reason?}`; GET `?userId=` — активные |

Все пути под `/api/discussion`. Токен на GET необязателен, но если есть — валидируется, и по нему
применяются блокировки зрителя.

`visibility` у коммента: `visible` | `soft_hidden` (body есть, клиент сворачивает) | `gravestone`
(body нет) | `deleted` (body и authorId нет, ответы на месте). Ошибки — `{error, message,
violations?, details?, timestamp}`; отказ гейта — 403 `COMMENTING_RESTRICTED` с
`details.restrictedUntil` (`null` = бессрочно).

## Решения, которых нет в спеке

- `author_id` — `security/UserIdResolver`: claim `user_id`, иначе `sub`. Временно, до
  user-service (auth.md §5); менять один бин.
- Триггер `updated_at` срабатывает только на смену `body`: инкремент `reply_count` и
  soft-delete правкой не считаются.
- `id` генерится Hibernate (`@UuidGenerator VERSION_7`), а не DB-default: известен до flush.
  `path`, `root_id`, `path_key`, таймстемпы — `@Generated`, приходят из `INSERT … RETURNING`.
- `reply_count` пишется только атомарным `UPDATE … +1`, сущность его никогда не записывает.
- `comment.created` уходит в `ApplicationEventPublisher`; слушатель — `@TransactionalEventListener`
  (after-commit). Брокер не выбран; `DomainEventPublisher` — точка замены.
- Ответ на удалённый коммент разрешён. Топ-левел и ответы — oldest-first.
- Пути `/api/discussion/**`, а не `/api/comments/**`: `comments/{id}` и `comments/blocks` иначе
  пересекаются.
