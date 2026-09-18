import type { BlockMode } from '@/lib/discussion/modes'
import type { ReportReason } from '@/lib/discussion/reasons'

// Reader-facing wording of the comments block. Russian only for now; the bilingual front is a
// later step, and this is the one file it will touch here.
export const strings = {
    heading: 'Комментарии',
    loading: 'Загрузка…',
    none: 'Пока нет комментариев',
    loadFailed: 'Не удалось загрузить комментарии',
    offline: 'Нет подключения к интернету',
    retry: 'Повторить',
    more: 'Показать ещё',
    moreFailed: 'Не удалось загрузить',
    showReplies: (count: number) => `Показать ответы (${count})`,
    moreReplies: 'Показать ещё ответы',
    repliesFailed: 'Не удалось загрузить ответы',
    noRepliesLeft: 'Ответов больше нет',
    ignoring: 'Вы игнорируете автора',
    reveal: 'Показать',
    hidden: 'Скрытый комментарий',
    deleted: 'Комментарий удалён',
    removed: 'Комментарий удалён модерацией',
    // instead of the name, for an author under a restriction
    restricted: 'заблокирован',
    // a visible comment whose author user-service does not know
    nobody: 'Пользователь',
    allComments: 'Ко всем комментариям',
    missing: 'Комментарий не найден',
    hiddenByIgnore: 'Этот комментарий в ветке, которую скрывает ваш игнор',
    wholeIgnoreList: 'Весь игнор-лист',
    inReplyTo: 'В ответ на',
    signInToComment: 'Войдите, чтобы комментировать',
    signInToReply: 'Войдите, чтобы ответить',
    sessionExpired: 'Сессия истекла, войдите снова',
    signIn: 'Войти',
    reply: 'Ответить',
    send: 'Отправить',
    sending: 'Отправка…',
    cancel: 'Отмена',
    yourComment: 'Ваш комментарий',
    yourReply: 'Ваш ответ',
    counter: (length: number, max: number) => `${length} / ${max}`,
    tooLong: (max: number) => `Не больше ${max} символов`,
    tooManyLinks: (max: number) => `Не больше ${max} ссылок в комментарии`,
    sendFailed: 'Не удалось отправить',
    tooOften: 'Слишком часто, попробуйте позже',
    parentDeleted: 'Комментарий, на который вы отвечаете, удалён',
    postAsNew: 'Опубликовать как новый комментарий',
    mutedByRecipient: 'Автор комментария вас игнорирует — ваш ответ у него скрыт',
    restrictedUntil: (when: string) => `Вы не можете комментировать до ${when}`,
    restrictedIndefinitely: 'Комментирование недоступно',

    // editing one's own comment
    edit: 'Изменить',
    edited: 'изменено',
    editedAt: (when: string) => `Изменено ${when}`,
    saveEdit: 'Сохранить',
    editFailed: 'Не удалось сохранить',
    editTooLate: 'Время на правку истекло',
    editGone: 'Комментарий уже удалён',
    editRemoved: 'Комментарий удалён модерацией',

    // the comment menu
    actions: 'Действия',
    remove: 'Удалить',
    confirmRemove: 'Удалить комментарий? Отменить нельзя',
    confirmRemoveReplies: 'Ответы останутся, а вместо текста будет „Комментарий удалён“',
    removeFailed: 'Не удалось удалить',
    gone: 'Комментарий удалён',

    // reporting
    report: 'Пожаловаться',
    reportReason: 'Причина',
    reasons: {
        spam: 'Спам',
        insult: 'Оскорбления',
        hate: 'Разжигание ненависти',
        illegal: 'Противоправное',
        personal_data: 'Личные данные',
        other: 'Другое',
    } satisfies Record<ReportReason, string>,
    reported: 'Жалоба отправлена',
    reportFailed: 'Не удалось отправить',
    tooManyReports: 'Слишком много жалоб, попробуйте позже',
    alreadyRemoved: 'Комментарий уже удалён модерацией',
    signInToReport: 'Войдите, чтобы пожаловаться',
    // offered once the report is sent
    ignoreAuthor: 'Игнорировать автора?',
    close: 'Закрыть',

    // ignoring
    ignore: 'Игнорировать',
    ignoreWhom: (name: string | null) => (name ? `Игнорировать ${name}` : 'Игнорировать автора'),
    ignoringWhom: (name: string | null) =>
        name ? `Вы игнорируете ${name}` : 'Вы игнорируете автора',
    // the menu item on a comment already collapsed by the reader and opened again
    ignoredAs: (mode: string) => `Игнор: ${mode.toLowerCase()}`,
    ignoreFailed: 'Не удалось игнорировать',
    signInToIgnore: 'Войдите, чтобы игнорировать',
    modes: {
        soft: 'Сворачивать',
        gravestone: 'Скрывать',
        subtree_removal: 'Убирать с ветками',
    } satisfies Record<BlockMode, string>,
    modeHints: {
        soft: 'Комментарий свёрнут, его можно раскрыть',
        gravestone: 'Вместо комментария — «Скрытый комментарий»',
        subtree_removal: 'Не видно ни комментария, ни ответов под ним',
    } satisfies Record<BlockMode, string>,
    ignoreMode: 'Режим игнора',
    subtreeWarning: 'Пропадут и ответы на комментарии этого автора, включая ваши',
    save: 'Сохранить',
    saving: 'Сохраняем…',
    saveFailed: 'Не удалось сохранить',
    ignoreListFull: 'Игнор-лист заполнен: уберите из него кого-нибудь',

    // the ignore list in the cabinet
    ignoreList: 'Игнор-лист',
    ignoreListAbout:
        'Люди, чьи комментарии вы сворачиваете, скрываете или не видите вовсе. Они об этом не узнают.',
    ignoreListEmpty:
        'Вы никого не игнорируете. Игнорировать автора можно из меню «···» у его комментария.',
    ignoreListFailed: 'Не удалось загрузить игнор-лист',
    signInToIgnoreList: 'Войдите, чтобы увидеть свой игнор-лист',
    ignoringSince: (day: string) => `с ${day}`,
    changeMode: 'Изменить',
    unignore: 'Не игнорировать',
    unignoreFailed: 'Не удалось снять игнор',
    notIgnoring: 'Больше не игнорируете',
    restore: 'Вернуть',
    restoreFailed: 'Не удалось вернуть',
}
