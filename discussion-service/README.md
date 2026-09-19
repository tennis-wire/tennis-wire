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
| GET | `/comments?subjectType=&subjectId=&limit=&cursor=` | аноним | верхний уровень от старых к новым, `{items, nextCursor, viewer?}`. `limit` по умолчанию 50, вне 1–200 приводится к границе. `subjectType` не из allowlist — 400 `UNKNOWN_SUBJECT_TYPE`, битый курсор — 400 `INVALID_CURSOR` |
| GET | `/comments/{id}/branch` | аноним | `{root}`: комментарий и ответы под ним на 5 уровней, до 20 прямых ответов у узла и до 500 строк на ответ |
| GET | `/comments/{id}/replies?limit=&cursor=` | аноним | прямые ответы страницами, `{items, nextCursor}`, лимиты как у верхнего уровня |
| GET | `/comments/{id}/ancestry` | аноним | `{chain: [корень … id], viewer?}` без вложенных ответов |

`branch`, `replies` и `ancestry` отвечают 404 `NOT_FOUND`, если комментария нет или это заглушка,
которую не видит никто. 404 `HIDDEN_BY_BLOCK` — если сам комментарий или комментарий выше по цепочке
написан тем, кого зритель убрал игнором «с ветками»; в `details.blockedIds` эти авторы, от корня
вниз. Автор заглушки туда не попадает: заглушка не подписана, в том числе для игнорирующего, и
список бывает пустым.

`viewer` — положение вошедшего читателя в ответах, с которых открывается ветка: в листинге (на каждой
странице) и в `ancestry`. `{restriction: {until}}` — действующий бан на комментирование, `until: null` —
бессрочный; `{restriction: null}` — ничего не мешает. У анонима и в `/replies` поля нет.

**Запись**

| Метод | Путь | Роль | Что |
|---|---|---|---|
| POST | `/comments` `{subjectType, subjectId, body}` | `user` | 201 `{comment, mutedByRecipient: false}`. `body` до 2000. Профиль автора запрашивается до записи, поэтому 503 не оставляет комментарий. Необязательный `Idempotency-Key` (UUID) — ниже |
| POST | `/comments/{id}/replies` `{body}` | `user` | 201 `{comment, mutedByRecipient}`: `true`, если автор родителя игнорирует пишущего. Subject наследуется от родителя; родитель удалён — 409 `PARENT_DELETED`, ушёл целиком — 404 `NOT_FOUND`. Необязательный `Idempotency-Key` — ниже |
| PATCH | `/comments/{id}` `{body}` | `user`, только автор | 200 `{id, body, updatedAt, edited}`. Требования к тексту те же, что при публикации. Окно правки задаёт `discussion.comment.edit-window`, счёт от `createdAt`; после него 403 `EDIT_WINDOW_CLOSED`. Удалён автором: 409 `COMMENT_DELETED`, снят модерацией: 409 `COMMENT_ALREADY_REMOVED`, чужой: 403 `FORBIDDEN`. Тот же текст ничего не меняет и не ставит `edited` |
| DELETE | `/comments/{id}` | `user`, только автор | 204, идемпотентно |
| PUT | `/comments/{id}/reactions/vote` `{value}` | `user` | 204. `like` или `dislike`, иначе 400 `UNKNOWN_REACTION`. На свой комментарий и на автора в игноре (кроме `soft`): 403. Под баном 403 `COMMENTING_RESTRICTED` |
| DELETE | `/comments/{id}/reactions/vote` | `user` | 204, идемпотентно. Работает и под баном |
| PUT | `/comments/{id}/reactions/emoji` `{value}` | `user` | 204. Ключ из `discussion.reaction.emoji`, иначе 400 `UNKNOWN_REACTION`. Остальное как у `vote` |
| DELETE | `/comments/{id}/reactions/emoji` | `user` | 204, идемпотентно |
| POST | `/comments/{id}/reports` `{reason}` | `user` | 204 на любую принятую, в том числе повторную. `reason` из `discussion.reports.reasons`. Свой комментарий или автор в игноре не в режиме `soft` — 403, снят модерацией — 409 `COMMENT_ALREADY_REMOVED`, текста уже нет (стёрт аккаунт или вышел срок) — 404 `NOT_FOUND` |

`Idempotency-Key` на обеих записях. Тот же ключ того же автора с тем же текстом в то же место — 201
и комментарий, записанный первым запросом, `mutedByRecipient` пересчитан; второго комментария нет.
Тот же ключ с другим текстом или местом — 422 `IDEMPOTENCY_KEY_REUSED`. Повтор, пришедший, пока
первый запрос ещё пишется, ждёт его и получает тот же ответ. Без заголовка — как раньше.

Правка не трогает ответы, счётчики и ссылки и никого не уведомляет. `edited` есть у каждого комментария в чтениях и считается как `updatedAt > createdAt`: триггер `updated_at` срабатывает только на смене текста, так что ни стирание, ни модерация за правку не считаются. Правка возвращает комментарий в очередь, если модератор его оставил, и запоминает прежний текст в открытых жалобах (`body_at_report`), откуда карточка берёт `bodyAtFirstReport`. Снимок стирается вместе с хешем пожаловавшегося при любом закрытии карточки.

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
| POST | `/moderation/reports` `{commentId, reason}` | `moderator-bot` | 204, жалоба классификатора; снят модерацией — 409, текста нет — 404, как у читательской |
| GET | `/moderation/reports?status=open&page=&size=` | `moderator` | очередь, карточка на комментарий, `{items, page, size}`; `size` до 200. Карточку удалённого автором комментария сервис закрывает сам через 30 дней после удаления, вместе с текстом (`expired`) |
| PATCH | `/moderation/reports/{commentId}` `{resolution}` | `moderator` | 204, закрывает карточку целиком: `hidden` \| `dismissed` \| `counted`. `counted` — только у удалённого автором и пока его текст хранится, иначе 409 `RESOLUTION_NOT_APPLICABLE`. `voided` и `expired` пишет только сам сервис — 400 |
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
- Триггер `updated_at` срабатывает, только когда пишется новый `body`: инкремент `reply_count`,
  soft-delete и зануление текста (стирание аккаунта, срок) правкой не считаются.
- `id` генерится Hibernate (`@UuidGenerator VERSION_7`), а не DB-default: известен до flush.
  `path`, `root_id`, `path_key`, таймстемпы — `@Generated`, приходят из `INSERT … RETURNING`.
- `reply_count` пишется только атомарным `UPDATE … +1`, сущность его никогда не записывает.
- Одно дерево — один пишущий. Ответ, удаление автором, снятие модерацией, решение по жалобе,
  жалоба, стирание аккаунта и стирание текста по сроку сначала берут `pg_advisory_xact_lock` по
  `root_id` (`TreeLock`), оба стирания — по всем деревьям батча в порядке ключей. Иначе двое
  действуют по одним и тем же счётчикам: заглушка остаётся без ответов, родитель считает невидимый
  ответ, ответ ложится под удалённый комментарий или падает на FK. Блокировка берётся до первого
  чтения комментария в транзакции: сущность, прочитанная раньше, после ожидания вернулась бы из
  persistence context прежней. Держится на READ COMMITTED.
- Текст удалённого автором и снятого модерацией комментария стирается через 30 дней после
  `deleted_at`, строка остаётся (`TextExpiryJob`, `discussion.text-expiry`: `after`, `interval`,
  `batch-size`). Проход идёт на каждом инстансе; батч — транзакция, которая начинается с
  `pg_try_advisory_xact_lock(2, 0)`: не взята — инстанс пропускает тик, и батчи всех инстансов идут
  по одному. Id батча читаются без блокировки строк, потом `TreeLock`, условие повторяется в
  `UPDATE`. Не `SKIP LOCKED`: строку старой заглушки пишет и схлопывание, уже держа дерево, и
  строка, взятая до дерева, дала бы дедлок. Открытые жалобы на эти комментарии закрываются как
  `expired` той же транзакцией: засчитывать без текста нечего. Под профилем `test` проход
  выключен, `TextExpiryIT` вызывает его сам.
- `comment.created` уходит в `ApplicationEventPublisher`; слушатель — `@TransactionalEventListener`
  (after-commit). Брокер не выбран; `DomainEventPublisher` — точка замены.
- Ограничение читателя приходит в листинге и `ancestry`, а не отдельным `GET /me`: по §3.7 бан
  известен вместе со списком, а не вторым запросом со своим отказом, и туда же ляжет состояние
  обсуждения (§14): что стоит вместо формы, решают оба, закрытое обсуждение — прежде бана (§14.6).
- Ключ идемпотентности живёт в самом комментарии: `idempotency_key` и уникальный индекс по
  `(author_id, idempotency_key)`. Таблицы и срока нет — ключ уходит вместе со строкой, а стирание
  аккаунта обнуляет `author_id`, и пара больше ничего не находит. Повтор ищется под
  `pg_advisory_xact_lock(1, …)` — пространство из двух int, с блокировкой дерева не пересекается;
  берётся до неё. Гейт бана на повторе не проверяется: первый запрос его прошёл.
- Ответ на удалённый комментарий не принимается: 409 `PARENT_DELETED`. Верхний уровень и ответы —
  от старых к новым.
- Пути `/api/discussion/**`, а не `/api/comments/**`: `comments/{id}` и `comments/blocks` иначе
  пересекаются.
