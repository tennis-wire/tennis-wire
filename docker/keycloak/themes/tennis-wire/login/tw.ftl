<#-- Pieces the layout and the pages share -->

<#macro wordmark className>
    <#if client?? && client.baseUrl?has_content>
        <a class="${className}" href="${client.baseUrl}">Tennis&nbsp;Wire</a>
    <#else>
        <span class="${className}">Tennis&nbsp;Wire</span>
    </#if>
</#macro>

<#macro backToSite className>
    <#if client?? && client.baseUrl?has_content>
        <a class="${className}" href="${client.baseUrl}">${msg("twBackToSite")}</a>
    </#if>
</#macro>

<#-- The identity providers of the realm, then Telegram while the realm has none of that name:
     shown as coming, so the row keeps its shape when it arrives -->
<#macro socialTiles>
    <#assign providers = (social.providers)![]>
    <#assign hasTelegram = providers?filter(p -> p.alias == "telegram")?has_content>
    <div class="tw-social">
        <#list providers as p>
            <a data-once-link data-disabled-class="tw-social-busy" id="social-${p.alias}"
               class="tw-social-tile" href="${p.loginUrl}">
                <@providerIcon p.alias/>
                <span>${p.displayName!p.alias}</span>
            </a>
        </#list>
        <#if !hasTelegram>
            <span class="tw-social-tile tw-social-soon" aria-disabled="true" title="${msg("twSoon")}">
                <@providerIcon "telegram"/>
                <span>Telegram</span>
                <small>${msg("twSoon")}</small>
            </span>
        </#if>
    </div>
    <div class="tw-divider"><span>${msg("twOrByEmail")}</span></div>
</#macro>

<#macro providerIcon alias>
    <#if alias == "google">
        <svg class="tw-social-icon" viewBox="0 0 48 48" aria-hidden="true">
            <path fill="#EA4335" d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"/>
            <path fill="#4285F4" d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"/>
            <path fill="#FBBC05" d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"/>
            <path fill="#34A853" d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"/>
        </svg>
    <#elseif alias == "telegram">
        <svg class="tw-social-icon" viewBox="0 0 24 24" aria-hidden="true">
            <circle cx="12" cy="12" r="12" fill="#27A6E5"/>
            <path fill="#FFFFFF" d="M5.4 11.8l11.6-4.5c.54-.2 1.01.13.83.95l-1.97 9.3c-.15.66-.54.82-1.09.51l-3-2.21-1.45 1.39c-.16.16-.3.3-.61.3l.21-3.06 5.57-5.03c.24-.21-.05-.33-.38-.12l-6.88 4.33-2.96-.93c-.64-.2-.66-.64.13-.95z"/>
        </svg>
    <#else>
        <span class="tw-social-icon tw-social-letter" aria-hidden="true">${alias?substring(0, 1)?upper_case}</span>
    </#if>
</#macro>
