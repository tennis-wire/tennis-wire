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
./gradlew :user-service:bootRun                                                # 8092, нужен всему, кроме анонимного чтения
./gradlew :discussion-service:bootRun --args='--spring.profiles.active=local'  # swagger на :8093/swagger-ui.html
./gradlew :discussion-service:test                                             # Testcontainers, postgres:18
discussion-service/scripts/smoke.sh                                            # сквозной прогон через dev-realm
BASE=http://localhost:8090 discussion-service/scripts/smoke.sh                 # то же через gateway
```

Сервис ходит в user-service напрямую по `USER_SERVICE_URL` (по умолчанию
`http://localhost:8092`), минуя gateway: `/internal/**` тот не маршрутизирует. Без user-service
чтение с токеном, любая запись и `smoke.sh` отвечают 503; анонимное чтение работает. Исходящий
токен — client_credentials клиента `discussion-service`, секрет в
`DISCUSSION_SERVICE_CLIENT_SECRET` (по умолчанию dev-значение из realm-файла). Keycloak при
старте не нужен: в конфигурации указан `token-uri`, а не `issuer-uri`.

## API

| Метод | Путь | Роль | Что |
|---|---|---|---|
| GET | `/comments?subjectType=&subjectId=` | аноним | топ-левел, `items[].replyCount`, `nextCursor` (пока всегда `null`) |
| POST | `/comments` `{subjectType, subjectId, body}` | `user` | 201 `{comment, mutedByRecipient:false}`; профиль автора запрашивается до записи, поэтому 503 не оставляет комментарий |
| POST | `/comments/{id}/replies` `{body}` | `user` | 201; subject наследуется от родителя; `mutedByRecipient` — автор родителя заблокировал автора |
| GET | `/comments/{id}/branch` | аноним | `{root, nextCursor}`; `root.replies` вложены рекурсивно |
| GET | `/comments/{id}/ancestry` | аноним | `{chain:[root … id]}` без вложенных ответов |
| DELETE | `/comments/{id}` | `user`, только автор | soft-delete, идемпотентно |
| GET / PUT / DELETE | `/blocks`, `/blocks/{blockedId}` `{mode}` | `user` | `mode`: `soft` \| `gravestone` \| `subtree_removal`; PUT меняет режим у существующего |
| DELETE | `/moderation/comments/{id}` | `moderator`, `moderator-bot` | soft-delete без проверки автора |
| POST / GET / DELETE | `/moderation/restrictions` | `moderator` | `{userId, expiresAt?, reason?}`; GET `?userId=` — активные |

Все пути под `/api/discussion`. Токен на GET необязателен, но если есть — валидируется, и по нему
применяются блокировки зрителя.

`visibility` у коммента: `visible` | `soft_hidden` (body и author есть, клиент сворачивает) |
`gravestone` (нет ни того, ни другого) | `deleted` (то же, ответы на месте).

`author` — в двух формах: `{id, displayName, avatarUrl}` у обычного автора (`avatarUrl` всегда
`null`, аватары не в v1) и `{id, restricted: true}`, если у автора действует ограничение на
комментирование. Во второй форме имени нет вовсе, а слово («заблокирован», «banned») выбирает
клиент: строка в API была бы непереводимой при двуязычном фронте. Поля нет совсем, когда
автора показывать нечего: `gravestone`, `deleted` или профиля нет в user-service.

Ошибки — `{error, message, violations?, details?, timestamp}`; отказ гейта — 403
`COMMENTING_RESTRICTED` с `details.restrictedUntil` (`null` = бессрочно); недоступность
user-service — 503 `SERVICE_UNAVAILABLE`.

## Решения, которых нет в спеке

- `author_id` — платформенный `user_id` из user-service (`auth.md` §5). `RemoteUserIdResolver`
  пересылает токен самого читателя в `POST /internal/identities/resolve` и кэширует
  `sub → user_id` без TTL: связка неизменна. Токен без роли `user` резолв не вызывает — такой
  зритель читает как аноним, а на пишущем пути получает 403.
- `author` в ответе собирает `controller/CommentResponses`, уже после транзакции: ограничение —
  свой SQL-запрос на всю страницу, имена — один batch-вызов `AuthorProfileClient` с TTL 2 минуты.
  У ограниченного автора имя не запрашивается вовсе. Профиля нет в user-service — поля нет и WARN
  в лог, чтобы одна такая строка не роняла всю ветку.
- Копии ника в `comment` нет: переименованный модератором ник иначе остался бы в старых
  комментариях до бэкфилла. Падение user-service закрывает кэш, а не копия.
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
