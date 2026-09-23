import { useLocation, useParams } from 'react-router-dom'
import { useAuth } from 'react-oidc-context'

import Editor from './Editor.tsx'
import { NEW } from '../lib/draftBuffer'
import { sessionKeyOf } from '../lib/sessionKey'

export default function EditorRoute() {
    const { id = NEW } = useParams()
    const sessionKey = sessionKeyOf(useLocation())
    const sub = useAuth().user?.profile.sub

    // Mounted behind RequireRole, so there is a user; the check is for the type
    if (sub === undefined) return null
    return (
        <Editor
            key={sessionKey}
            sessionKey={sessionKey}
            articleId={id === NEW ? null : id}
            sub={sub}
        />
    )
}
