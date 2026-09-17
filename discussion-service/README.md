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

Все пути под `/api/discussion`, кроме `/internal/**`: его gateway не маршрутизирует. Токен на GET
необязателен, но если есть, валидируется, и по нему применяется игнор зрителя.

**Чтение**

| Метод | Путь | Роль | Что |
|---|---|---|---|
| GET | `/comments?subjectType=&subjectId=&limit=&cursor=` | аноним | верхний уровень от старых к новым, `{items, nextCursor}`. `limit` по умолчанию 50, вне 1–200 приводится к границе. `subjectType` не из allowlist — 400 `UNKNOWN_SUBJECT_TYPE`, битый курсор — 400 `INVALID_CURSOR` |
| GET | `/comments/{id}/branch` | аноним | `{root}`: комментарий и ответы под ним на 5 уровней, до 20 прямых ответов у узла и до 500 строк на ответ |
| GET | `/comments/{id}/replies?limit=&cursor=` | аноним | прямые ответы страницами, `{items, nextCursor}`, лимиты как у верхнего уровня |
| GET | `/comments/{id}/ancestry` | аноним | `{chain: [корень … id]}` без вложенных ответов |

`branch`, `replies` и `ancestry` отвечают 404 `NOT_FOUND`, если комментария нет или это заглушка,
которую не видит никто. 404 `HIDDEN_BY_BLOCK` — если сам комментарий или комментарий выше по цепочке
написан тем, кого зритель убрал игнором «с ветками»; в `details.blockedIds` эти авторы, от корня
вниз. Автор заглушки туда не попадает: заглушка не подписана, в том числе для игнорирующего, и
список бывает пустым.

**Запись**

| Метод | Путь | Роль | Что |
|---|---|---|---|
| POST | `/comments` `{subjectType, subjectId, body}` | `user` | 201 `{comment, mutedByRecipient: false}`. `body` до 2000. Профиль автора запрашивается до записи, поэтому 503 не оставляет комментарий |
| POST | `/comments/{id}/replies` `{body}` | `user` | 201 `{comment, mutedByRecipient}`: `true`, если автор родителя игнорирует пишущего. Subject наследуется от родителя; родитель удалён — 409 `PARENT_DELETED`, ушёл целиком — 404 `NOT_FOUND` |
| DELETE | `/comments/{id}` | `user`, только автор | 204, идемпотентно |
| POST | `/comments/{id}/reports` `{reason}` | `user` | 204 на любую принятую, в том числе повторную. `reason` из `discussion.reports.reasons`. Свой комментарий или автор в игноре не в режиме `soft` — 403, снят модерацией — 409 `COMMENT_ALREADY_REMOVED` |

Отказ гейта на запись — 403 `COMMENTING_RESTRICTED` с `details.restrictedUntil` (`null` —
бессрочно).

**Игнор-лист** — только свой: кто игнорирует, всегда владелец токена, кого — в пути.

| Метод | Путь | Роль | Что |
|---|---|---|---|
| GET | `/blocks?limit=&cursor=` | `user` | `{items: [{blockedId, user?, mode, createdAt}], nextCursor}`, новые сверху, лимиты как у листингов |
| GET | `/blocks/{blockedId}` | `user` | одна строка; нет такой — 404 `NOT_FOUND` |
| PUT | `/blocks/{blockedId}` `{mode}` | `user` | создаёт строку или меняет режим, 200 со строкой. `mode`: `soft` \| `gravestone` \| `subtree_removal`. Себя — 400, пользователя нет в user-service — 404 `USER_NOT_FOUND`, новый человек в списке из 1000 — 409 `BLOCK_LIST_FULL` с `details.limit` |
| DELETE | `/blocks/{blockedId}` | `user` | 204, идемпотентно |

`user` в строке — те же формы, что `author` у комментария, и так же нет поля, когда нет профиля.
Смена режима строку в списке не двигает: `createdAt` — время первого игнора.

**Модерация**

| Метод | Путь | Роль | Что |
|---|---|---|---|
| DELETE | `/moderation/comments/{id}` | `moderator`, `moderator-bot` | снять комментарий; снятое ботом не подписано |
| POST | `/moderation/reports` `{commentId, reason}` | `moderator-bot` | 204, жалоба классификатора |
| GET | `/moderation/reports?status=open&page=&size=` | `moderator` | очередь, карточка на комментарий, `{items, page, size}`; `size` до 200 |
| PATCH | `/moderation/reports/{commentId}` `{resolution}` | `moderator` | 204, закрывает карточку целиком: `hidden` \| `dismissed` \| `counted`. `counted` — только у удалённого автором, иначе 409 `RESOLUTION_NOT_APPLICABLE` |
| POST | `/moderation/restrictions` `{userId, expiresAt?, reason?}` | `moderator` | 201, ограничение на комментирование; без `expiresAt` — бессрочное |
| GET | `/moderation/restrictions?userId=` | `moderator` | действующие ограничения |
| DELETE | `/moderation/restrictions/{id}` | `moderator` | 204 |

**Внутреннее**

| Метод | Путь | Роль | Что |
|---|---|---|---|
| DELETE | `/internal/users/{userId}` | `service` | стирает след читателя при удалении аккаунта; `{banned, bannedUntil}` — действующий бан, которого ждёт user-service |

`visibility` у комментария: `visible` | `soft_hidden` (body и author есть, клиент сворачивает) |
`gravestone` (нет ни того, ни другого) | `deleted` (то же, ответы на месте; снял автор) |
`removed` (то же; сняла модерация — надпись выбирает клиент, автору отдаётся то же, что всем).

`author` — в двух формах: `{id, displayName, avatarUrl}` у обычного автора (`avatarUrl` всегда
`null`, аватары не в v1) и `{id, restricted: true}`, если у автора действует ограничение на
комментирование. Во второй форме имени нет вовсе, а слово («заблокирован», «banned») выбирает
клиент: строка в API была бы непереводимой при двуязычном фронте. Поля нет совсем, когда
автора показывать нечего: `gravestone`, `deleted`, `removed` или профиля нет в user-service.

`replyCount` — сколько прямых ответов получит этот зритель: живые и заглушки, под которыми что-то
осталось, без тех, кого он убрал игнором «с ветками». Вычитаются только прямые ответы: ответ-заглушка,
под которой игнор убрал всё, в число входит. Заглушка, у которой для зрителя вышел ноль, ему не
отдаётся. `repliesTruncated` — в ответе меньше прямых ответов, чем получит зритель, остальное — в
`/replies` с первой страницы. Колонка `reply_count` при этом общая для всех.

Ошибки — `{error, message, violations?, details?, timestamp}`; недоступность user-service — 503
`SERVICE_UNAVAILABLE`.

## Решения, которых нет в спеке

- `author_id` — платформенный `user_id` из user-service (`auth.md` §5). `RemoteUserIdResolver`
  пересылает токен самого читателя в `POST /internal/identities/resolve` и кэширует
  `sub → user_id` без TTL: связка неизменна. Токен без роли `user` резолв не вызывает — такой
  зритель читает как аноним, а на пишущем пути получает 403.
- `author` у комментария и `user` в игнор-листе собирает `controller/reader/AuthorResponses`, уже
  после транзакции: ограничение — свой SQL-запрос на всю страницу, имена — один batch-вызов
  `AuthorProfileClient` с TTL 2 минуты.
  У ограниченного автора имя не запрашивается вовсе. Профиля нет в user-service — поля нет и WARN
  в лог, чтобы одна такая строка не роняла всю ветку.
- Копии ника в `comment` нет: переименованный модератором ник иначе остался бы в старых
  комментариях до бэкфилла. Падение user-service закрывает кэш, а не копия.
- Триггер `updated_at` срабатывает только на смену `body`: инкремент `reply_count` и
  soft-delete правкой не считаются.
- `id` генерится Hibernate (`@UuidGenerator VERSION_7`), а не DB-default: известен до flush.
  `path`, `root_id`, `path_key`, таймстемпы — `@Generated`, приходят из `INSERT … RETURNING`.
- `reply_count` пишется только атомарным `UPDATE … +1`, сущность его никогда не записывает.
- Одно дерево — один пишущий. Ответ, удаление автором, снятие модерацией, решение по жалобе,
  жалоба и стирание сначала берут `pg_advisory_xact_lock` по `root_id` (`TreeLock`), стирание —
  по всем деревьям батча в порядке ключей. Иначе двое действуют по одним и тем же счётчикам:
  заглушка остаётся без ответов, родитель считает невидимый ответ, ответ ложится под удалённый
  комментарий или падает на FK. Блокировка берётся до первого чтения комментария в транзакции:
  сущность, прочитанная раньше, после ожидания вернулась бы из persistence context прежней.
  Держится на READ COMMITTED.
- `comment.created` уходит в `ApplicationEventPublisher`; слушатель — `@TransactionalEventListener`
  (after-commit). Брокер не выбран; `DomainEventPublisher` — точка замены.
- Ответ на удалённый комментарий не принимается: 409 `PARENT_DELETED`. Верхний уровень и ответы —
  от старых к новым.
- Пути `/api/discussion/**`, а не `/api/comments/**`: `comments/{id}` и `comments/blocks` иначе
  пересекаются.
