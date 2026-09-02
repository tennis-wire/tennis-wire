# Аутентификация и авторизация — целевой дизайн

Живой документ: правится по мере реализации. Решение «почему Keycloak» зафиксировано в [ADR-0001](../docs/adr/0001-identity-provider.md). Топология — в `model_v2.c4`, вид `authFlowTarget`. Имена ролей и клиентов в модели и в коде берутся отсюда; этот файл — источник правды.

## 1. Принципы

1. **Keycloak — только identity.** Кто это, какие роли, какие токены. Профили, настройки, фэнтези, аватары — в `user-service` и профильных сервисах.
2. **Сервисы — OIDC resource servers.** Каждый сервис валидирует JWT сам по JWKS: gateway не единственная линия обороны.
3. **Проверяем роли, а не факт логина.** С первого дня gateway и сервисы авторизуют по ролям, даже пока в системе один человек со всеми ролями. Появление сотрудника — создание учётки и выдача роли, без изменений в коде.
4. **Realm как код.** Конфигурация realm лежит в репозитории; ручные правки через UI экспортируются и коммитятся.
5. **Внутренний `user_id`.** `sub` из Keycloak — не первичный ключ пользователя в наших сервисах (см. §5).

## 2. Роли

Realm-роли (client-роли не используем — проще маппинг и одна точка правды):

| Роль | Кому | Как выдаётся | Что даёт |
|---|---|---|---|
| `user` | Зарегистрированный читатель | Автоматически при саморегистрации (default role) | Комментарии, фэнтези, личный кабинет |
| `author` | Сотрудник-автор | Вручную администратором | Редакторский контур: черновики, AI-чат, перевод, транскрипция |
| `moderator` | Сотрудник-модератор | Вручную администратором | Модерация комментариев: скрытие, бан, разбор жалоб и сигналов бота |
| `moderator-bot` | Service account бота | Назначается клиенту `moderation-bot` | Узкий поднабор модерации (пометка / скрытие), без бана |
| `admin` | Администратор | Вручную; composite из `user`, `author`, `moderator` | Управление пользователями и системой |

`author` и `moderator` независимы: у одного человека могут быть обе.

Отзыв доступа сотруднику: снять роль или выключить пользователя (Enabled = off) в admin-консоли. Новые токены и refresh перестают выдаваться мгновенно; уже выданные access-токены доживают до истечения TTL (§4), поэтому TTL короткий.

## 3. Клиенты

| Client ID | Приложение | Тип | Flow | Библиотека |
|---|---|---|---|---|
| `editorial-ui` | `apps/editorial-ui` (SPA) | public | Authorization Code + PKCE | `oidc-client-ts`; токены в памяти |
| `public-web` | `apps/public-web` (Next.js, SSR) | confidential | Authorization Code, секрет на сервере | Auth.js, провайдер Keycloak; сессия в cookie |
| `mobile` | `apps/mobile` (Expo) | public | Authorization Code + PKCE | `expo-auth-session` |
| `moderation-bot` | бот-модератор | confidential, service account | `client_credentials` | — |

Путь к `author` / `moderator` — только через администратора.

Саморегистрация в realm **выключена** до запуска читателей: роль `user` пока некому потреблять, а открытая регистрация — лишняя поверхность на staff-only системе. Включается вместе с comments/fantasy, тогда же `user` становится default-ролью realm.

Локально в realm есть ещё клиент `dev-cli` (public, password grant) и пользователи `dev` / `reader` — артефакты разработки для `curl` и тестов. В целевом realm их нет.

## 4. Токены

- **Access token:** 5 минут. Определяет верхнюю границу задержки отзыва доступа.
- **SSO session (realm-уровень, staff-ориентировано):** idle 30 минут, max 8 часов.
- **Читательские клиенты (`public-web`, `mobile`):** более длинные сессии через per-client override — конкретные значения решаются на этапе подключения читателей.
- **Формат:** JWT, подпись RS256, ключи ротируются в Keycloak; сервисы берут их по JWKS.
- **Роли в токене:** `realm_access.roles`. В Spring нужен `JwtAuthenticationConverter` с маппингом в `ROLE_*`.
- **Audience:** Keycloak по умолчанию не ставит `aud` для API. В каждом клиенте заводится audience mapper (`oidc-audience-mapper`, `included.custom.audience: tennis-wire-api`); gateway и сервисы проверяют `aud`, а не только `iss`.
  Маппер намеренно продублирован по клиентам, а не вынесен в общий client scope: realm-уровневый массив `clientScopes` в файле импорта **заменяет** встроенные scope'ы вместо того, чтобы дополнять их, и вместе с ними пропадает `roles` — токены приходят без `realm_access.roles`. Четыре копии маппера дешевле, чем ручное описание всех встроенных scope'ов.
- **Обязательные claims для сервисов:** `iss`, `aud`, `sub`, `exp`, `realm_access.roles`, `azp` (какой клиент выпустил). Для staff дополнительно `email`, `preferred_username` — для логов и owner у задач.

## 5. Модель идентичности

- `user-service` владеет собственным `user_id` (UUID) и таблицей `identity_link (provider, sub) → user_id`. Запись создаётся при первом аутентифицированном обращении (upsert по `(provider, sub)`).
- Остальные сервисы с пользовательскими данными (comments, fantasy) хранят только `user_id`. `sub` у них не появляется в схеме.
- **Staff-контур** (`content-service`, `transcription-service`) использует `sub` напрямую — для owner у задач и аудита. Смена провайдера в staff-контуре обрабатывается вручную, объём данных мал.
- **Открытый вопрос:** как сервисы получают `user_id` из запроса, в котором есть только `sub`. Варианты: (а) резолв через `user-service` с кэшем; (б) custom claim `user_id` через user attribute + protocol mapper — но первый токен после регистрации claim не содержит. Решать при появлении второго сервиса-потребителя.

## 6. Маршруты gateway → роль

| Маршрут | Требование | Примечание |
|---|---|---|
| `/actuator/health`, `/actuator/info` | анонимно | `show-details: when-authorized`; K8s-пробам нужен именно анонимный health без деталей |
| `/actuator/gateway` | не экспонируется | Только в локальном профиле для отладки |
| `/api/public/**` | анонимно | |
| `/api/editorial/**`, `/api/ai/**`, `/api/translate/**`, `/api/transcribe/**` | `author` | |
| `/api/aggregator/**` | `author` | planned |
| `/api/comments/**` GET | анонимно | planned |
| `/api/comments/**` POST/PATCH/DELETE (свои) | `user` | planned |
| `/api/comments/**` модерационные операции | `moderator` или `moderator-bot` | planned; точный набор путей — при проектировании comments-service |
| `/api/users/me/**` | `user` | planned |
| `/api/users/**` (прочее) | `admin` | planned |

CORS терминируется в gateway (сделано).

## 7. Валидация в сервисах

- **Java (`api-gateway`, `content-service`, `editorial-bff`):** `spring-boot-starter-oauth2-resource-server`. `issuer-uri` и `audiences` — свойства `spring.security.oauth2.resourceserver.jwt.*`, кода для проверки `aud` писать не нужно: Boot сам добавляет валидатор (свойство есть с 2.7, работает одинаково для servlet и reactive). Собственного кода остаётся только конвертер ролей `realm_access.roles` → `ROLE_*`. Gateway дополнительно пробрасывает `Authorization` downstream (token relay).
- **Python (`transcription-service`):** PyJWT + `PyJWKClient` (кэш JWKS из коробки), проверка `iss`, `aud`, `exp`, роли `author`. Зависимость FastAPI в `api/deps.py`. Не считается долгом — делается в том же шаге, что и Java-сервисы.
- **`transcription-service` — owner у задачи:** при создании job сохраняется `sub` (и `preferred_username` для логов); появляется список «мои задачи»; вопрос «кто занял GPU-воркера» получает ответ.

## 8. Realm как код

- Файл: `docker/keycloak/import/tennis-wire-realm.json`. Содержит realm `tennis-wire`, роли §2, клиенты §3 с audience mapper, TTL §4, dev-пользователей и dev-клиент (§3).
- **Файл пишется руками, экспорт не используется.** Три причины: `kc.sh export` не работает против живого `start-dev` (H2-файл заблокирован процессом, а без volume экспортировать потом неоткуда); partial export из консоли не содержит пользователей и заменяет секреты клиентов на звёздочки; полный экспорт — тысячи строк сгенерированных UUID, дифф нечитаем.
- **Что описываем:** только своё. Встроенные client scopes, authentication flows и `default-roles-tennis-wire` Keycloak создаёт сам; попытка описать их руками ломает импорт или молча обнуляет дефолты (см. §4 про `clientScopes`).
- **Локально:** Keycloak в `docker-compose.yml`, порт `127.0.0.1:8180`, `start-dev --import-realm`, **без volume** (dev-file H2). Realm реимпортируется при пересоздании контейнера: `docker compose up -d --force-recreate keycloak`. `restart` и обычный `up -d` при изменении только смонтированного JSON импорт не запускают — стратегия импорта `IGNORE_EXISTING`.
- **Консоль** используется для экспериментов; найденное переносится в JSON руками. Правка без переноса теряется при пересоздании контейнера — это намеренно.
- **Прод — отдельный механизм, решение отложено до шага 5.** `--import-realm` создаёт realm только если его ещё нет и не применяет обновления, поэтому управлять конфигурацией им нельзя. Кандидаты: `keycloak-config-cli` (декларативно и идемпотентно, но community и привязан к версиям Keycloak — проверить наличие сборки под текущий мажор) либо Terraform-провайдер. Общими между локальным и прод-realm должны остаться имена ролей, клиентов и audience — они зафиксированы здесь, в §2–§4, а не в JSON.
- **Прод-инфраструктура:** `start --optimized`, `KC_DB=postgres`, отдельная БД `keycloak` и владеющая роль создаются init-скриптом до первого старта (та же последовательность, что с Liquibase); hostname и TLS — через ingress.
- **Версия:** образ `quay.io/keycloak/keycloak`, пин полной версии, минорные обновления Renovate разрешены (в отличие от MinIO). В community-сборке нет LTS: security-фиксы получает только последний релиз, поэтому отставать нельзя. Бутстрап-админ в 26.x: `KC_BOOTSTRAP_ADMIN_USERNAME` / `KC_BOOTSTRAP_ADMIN_PASSWORD`.

## 9. Тестирование

Решается **до** шага 2, потому что gateway становится resource server первым.

- **Основной объём — без Keycloak:** тестовая RSA-пара в test resources; в Spring — `mockJwt()` из `spring-security-test` (для WebFlux — `SecurityMockServerConfigurers.mockJwt()`), в Python — PyJWT с тестовым ключом и подмена `issuer`/`jwks` через `dependency_overrides`.
- **Один интеграционный тест на реальный flow:** Testcontainers-модуль Keycloak, поднимающий контейнер с тем же `realm-export.json`. Медленный, поэтому один. Он же проверяет, что realm JSON валиден и маппинг `realm_access.roles` работает с настоящим токеном.

## 10. Порядок реализации

| Шаг | Ветка | Содержание |
|---|---|---|
| 1 | `chore/keycloak-local` | Keycloak в compose, `tennis-wire-realm.json` (§2–§4, §8), dev-клиент и dev-пользователи; проверка руками: логин в консоль, получение токена `curl`, разбор claims |
| 2 | `security/gateway-auth` | Gateway → resource server: §6, конвертер ролей, `aud`, закрытие actuator; тестовая RSA-пара + один Testcontainers-тест |
| 3 | `security/editorial-ui-login` | PKCE в `editorial-ui`, Bearer в запросах к gateway |
| 4 | `security/services-jwt` | `content-service` и `transcription-service` валидируют JWT сами; owner у job и список «мои» |
| 5 | позже | `public-web` (Auth.js), `mobile` (`expo-auth-session`), `user-service` с `user_id` и `identity_link`, per-client сессии для читателей |

Модель `model_v2.c4` обновляется отдельной веткой после шага 2, когда топология реально изменится.

## 11. Отложено / открытые вопросы

- **Социальный вход:** Google + Apple при запуске регистрации читателей. Google в iOS-приложении обязывает добавить Sign in with Apple. В Keycloak — identity providers в realm, без кода.
- **MFA для сотрудников:** conditional OTP по роли `author` / `moderator` / `admin` — конфигурация flow, включается при росте команды.
- **Доставка `user_id` в сервисы** — §5.
- **Бот-модератор:** способ реализации (регулярки + LLM) и место в топологии не определены; изучить существующие подходы ближе к делу. В identity-модели у него уже есть место: клиент `moderation-bot` и роль `moderator-bot`.
- **Интерфейс модератора:** где живёт — в `editorial-ui` или в отдельном разделе `public-web`. Не спроектирован.
- **Кастомизация страниц логина** Keycloak под бренд — отдельная задача, не блокирует.
