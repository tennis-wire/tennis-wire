<#import "template.ftl" as layout>
<#-- base/login/login-verify-email.ftl with the address set apart and the resend as a button -->
<@layout.registrationLayout displayInfo=true; section>
    <#if section = "header">
        <span class="tw-mail-mark" aria-hidden="true">
            <svg viewBox="0 0 24 24"><path d="M3 6.5h18v11H3z M3 7l9 6.5L21 7" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/></svg>
        </span>
        ${msg("emailVerifyTitle")}
    <#elseif section = "form">
        <p class="tw-lead">
            <#if verifyEmail??>
                ${msg("twVerifySent")} <strong>${verifyEmail}</strong>. ${msg("twVerifyFollow")}
            <#else>
                ${msg("emailVerifyInstruction4", user.email)}
            </#if>
        </p>
        <#if isAppInitiatedAction??>
            <form id="kc-verify-email-form" class="${properties.kcFormClass!}" action="${url.loginAction}" method="post">
                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <#if verifyEmail??>
                        <input class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!}" type="submit" value="${msg("emailVerifyResend")}" />
                    <#else>
                        <input class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}" type="submit" value="${msg("emailVerifySend")}" />
                    </#if>
                    <button class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!}" type="submit" name="cancel-aia" value="true" formnovalidate>${msg("doCancel")}</button>
                </div>
            </form>
        </#if>
    <#elseif section = "info">
        <#if !isAppInitiatedAction??>
            <p class="tw-muted">${msg("twVerifySpam")}</p>
            <a class="${properties.kcButtonClass!} ${properties.kcButtonDefaultClass!} ${properties.kcButtonBlockClass!}" href="${url.loginAction}">${msg("twVerifyResend")}</a>
        </#if>
    </#if>
</@layout.registrationLayout>
