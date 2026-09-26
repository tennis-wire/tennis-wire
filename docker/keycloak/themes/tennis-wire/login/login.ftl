<#import "template.ftl" as layout>
<#import "passkeys.ftl" as passkeys>
<#import "tw.ftl" as tw>
<#-- base/login/login.ftl with the services on top and the reset link beside the password label -->
<@layout.registrationLayout displayMessage=!messagesPerField.existsError('username','password') displayInfo=realm.password && realm.registrationAllowed && !registrationDisabled??; section>
    <#if section = "header">
        ${msg("loginAccountTitle")}
    <#elseif section = "info">
        <p class="tw-subtitle">${msg("noAccount")} <a tabindex="8" href="${url.registrationUrl}">${msg("twRegisterLink")}</a></p>
    <#elseif section = "form">
        <#if realm.password>
            <@tw.socialTiles/>
            <form id="kc-form-login" class="${properties.kcFormClass!}" onsubmit="login.disabled = true; return true;" action="${url.loginAction}" method="post">
                <#if !usernameHidden??>
                    <div class="${properties.kcFormGroupClass!}">
                        <label for="username" class="${properties.kcLabelClass!}"><#if !realm.loginWithEmailAllowed>${msg("username")}<#elseif !realm.registrationEmailAsUsername>${msg("usernameOrEmail")}<#else>${msg("email")}</#if></label>
                        <input tabindex="2" id="username" class="${properties.kcInputClass!}" name="username" value="${(login.username!'')}" type="text"
                               autofocus autocomplete="${(enableWebAuthnConditionalUI?has_content)?then('username webauthn', 'username')}"
                               aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                               dir="ltr"
                        />
                        <#if messagesPerField.existsError('username','password')>
                            <span id="input-error" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                                ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                            </span>
                        </#if>
                    </div>
                </#if>

                <div class="${properties.kcFormGroupClass!}">
                    <div class="tw-label-row">
                        <label for="password" class="${properties.kcLabelClass!}">${msg("password")}</label>
                        <#if realm.resetPasswordAllowed>
                            <a tabindex="6" class="tw-label-link" href="${url.loginResetCredentialsUrl}">${msg("doForgotPassword")}</a>
                        </#if>
                    </div>
                    <div class="${properties.kcInputGroup!}" dir="ltr">
                        <input tabindex="3" id="password" class="${properties.kcInputClass!}" name="password" type="password" autocomplete="current-password"
                               aria-invalid="<#if messagesPerField.existsError('username','password')>true</#if>"
                        />
                        <button class="${properties.kcFormPasswordVisibilityButtonClass!}" type="button" aria-label="${msg("showPassword")}"
                                aria-controls="password" data-password-toggle tabindex="4"
                                data-icon-show="${properties.kcFormPasswordVisibilityIconShow!}" data-icon-hide="${properties.kcFormPasswordVisibilityIconHide!}"
                                data-label-show="${msg('showPassword')}" data-label-hide="${msg('hidePassword')}">
                            <i class="${properties.kcFormPasswordVisibilityIconShow!}" aria-hidden="true"></i>
                        </button>
                    </div>
                    <#if usernameHidden?? && messagesPerField.existsError('username','password')>
                        <span id="input-error" class="${properties.kcInputErrorMessageClass!}" aria-live="polite">
                            ${kcSanitize(messagesPerField.getFirstError('username','password'))?no_esc}
                        </span>
                    </#if>
                </div>

                <#if realm.rememberMe && !usernameHidden??>
                    <div class="${properties.kcFormGroupClass!} tw-remember">
                        <label>
                            <input tabindex="5" id="rememberMe" name="rememberMe" type="checkbox" class="${properties.kcCheckboxInputClass!}"<#if login.rememberMe??> checked</#if>>
                            ${msg("rememberMe")}
                        </label>
                    </div>
                </#if>

                <div id="kc-form-buttons" class="${properties.kcFormButtonsClass!}">
                    <input type="hidden" id="id-hidden-input" name="credentialId" <#if auth.selectedCredential?has_content>value="${auth.selectedCredential}"</#if>/>
                    <input tabindex="7" class="${properties.kcButtonClass!} ${properties.kcButtonPrimaryClass!} ${properties.kcButtonBlockClass!}" name="login" id="kc-login" type="submit" value="${msg("doLogIn")}"/>
                </div>
            </form>
        </#if>
        <@passkeys.conditionalUIData />
        <script type="module" src="${url.resourcesPath}/js/passwordVisibility.js"></script>
    </#if>
</@layout.registrationLayout>
