<#import "tw.ftl" as tw>
<#-- base/login/template.ftl in another frame: the scripts and the sections it passes to the
     pages are kept as they are, since the flow relies on them -->
<#macro registrationLayout bodyClass="" displayInfo=false displayMessage=true displayRequiredFields=false>
<#assign registering = pageId == "register">
<#-- Pages whose info section reads as a subtitle rather than a footnote -->
<#assign infoFirst = pageId == "login" || pageId == "login-reset-password">
<!DOCTYPE html>
<html lang="${lang}">

<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <meta name="color-scheme" content="light dark">
    <meta name="robots" content="noindex, nofollow">
    <title>${title!}</title>
    <link rel="icon" type="image/svg+xml" href="${url.resourcesPath}/img/favicon.svg">
    <#if properties.styles?has_content>
        <#list properties.styles?split(' ') as style>
            <link href="${url.resourcesPath}/${style}" rel="stylesheet" />
        </#list>
    </#if>
    <#if properties.scripts?has_content>
        <#list properties.scripts?split(' ') as script>
            <script src="${url.resourcesPath}/${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="importmap">
        {
            "imports": {
                "rfc4648": "${url.resourcesCommonPath}/vendor/rfc4648/rfc4648.js"
            }
        }
    </script>
    <#if scripts??>
        <#list scripts as script>
            <script src="${script}" type="text/javascript"></script>
        </#list>
    </#if>
    <script type="module">
        <#outputformat "JavaScript">
        import { startSessionPolling } from ${(url.resourcesPath + "/js/authChecker.js")?c};

        startSessionPolling(
            ${url.ssoLoginInOtherTabsUrl?c}
        );
        </#outputformat>
    </script>
    <script type="module">
        document.addEventListener("click", (event) => {
            const link = event.target.closest("a[data-once-link]");

            if (!link) {
                return;
            }

            if (link.getAttribute("aria-disabled") === "true") {
                event.preventDefault();
                return;
            }

            const { disabledClass } = link.dataset;

            if (disabledClass) {
                link.classList.add(...disabledClass.trim().split(/\s+/));
            }

            link.setAttribute("role", "link");
            link.setAttribute("aria-disabled", "true");
        });
    </script>
    <#if authenticationSession??>
        <script type="module">
            <#outputformat "JavaScript">
            import { checkAuthSession } from ${(url.resourcesPath + "/js/authChecker.js")?c};

            checkAuthSession(
                ${authenticationSession.authSessionIdHash?c}
            );
            </#outputformat>
        </script>
    </#if>
</head>

<body class="${properties.kcBodyClass!} ${registering?then('tw-registering', 'tw-signing-in')}" data-page-id="login-${pageId}">
<div class="tw-frame">
    <#-- On registration this panel gives way to the reasons for an account, except on a phone,
         where it is the strip above the form on every page -->
    <aside class="tw-brand">
        <@tw.wordmark "tw-wordmark"/>
        <div class="tw-brand-space"></div>
        <p class="tw-brand-lead">${msg("twBrandLead")}</p>
        <@tw.backToSite "tw-brand-back"/>
    </aside>

    <main class="tw-main">
        <div class="tw-card">
            <header class="tw-card-header">
                <#if !(auth?has_content && auth.showUsername() && !auth.showResetCredentials())>
                    <h1 id="kc-page-title"><#nested "header"></h1>
                <#else>
                    <#nested "show-username">
                    <h1 id="kc-page-title"><#nested "header"></h1>
                    <div id="kc-username" class="tw-attempted">
                        <span id="kc-attempted-username">${auth.attemptedUsername}</span>
                        <a id="reset-login" href="${url.loginRestartFlowUrl}">${msg("restartLoginTooltip")}</a>
                    </div>
                </#if>
                <#if registering>
                    <p class="tw-subtitle">${msg("twHaveAccount")} <a href="${url.loginUrl}">${msg("doLogIn")}</a></p>
                </#if>
            </header>

            <#if displayInfo && infoFirst>
                <div id="kc-info" class="${properties.kcSignUpClass!} tw-info-first">
                    <#nested "info">
                </div>
            </#if>

            <#-- App-initiated actions should not see warnings about completing the action during login -->
            <#if displayMessage && message?has_content && (message.type != 'warning' || !isAppInitiatedAction??)>
                <div class="${properties.kcAlertClass!} tw-alert-${message.type}" role="<#if message.type == 'error'>alert<#else>status</#if>">
                    <span class="${properties.kcAlertTitleClass!}">${kcSanitize(message.summary)?no_esc}</span>
                </div>
            </#if>

            <#if registering && realm.password>
                <@tw.socialTiles/>
            </#if>

            <#nested "form">

            <#if auth?has_content && auth.showTryAnotherWayLink()>
                <form id="kc-select-try-another-way-form" action="${url.loginAction}" method="post">
                    <div class="${properties.kcFormGroupClass!}">
                        <input type="hidden" name="tryAnotherWay" value="on"/>
                        <a href="#" id="try-another-way"
                           onclick="document.forms['kc-select-try-another-way-form'].requestSubmit();return false;">${msg("doTryAnotherWay")}</a>
                    </div>
                </form>
            </#if>

            <#if switchOrganizationEnabled?? && switchOrganizationEnabled>
                <form id="kc-switch-organization-form" action="${url.loginAction}" method="post">
                    <div class="${properties.kcFormGroupClass!}">
                        <input type="hidden" name="switchOrganization" value="true"/>
                        <a href="#" id="switch-organization"
                           onclick="document.forms['kc-switch-organization-form'].requestSubmit();return false;">${msg("doSwitchOrganization")}</a>
                    </div>
                </form>
            </#if>

            <#nested "socialProviders">

            <#if displayInfo && !infoFirst>
                <div id="kc-info" class="${properties.kcSignUpClass!}">
                    <#nested "info">
                </div>
            </#if>
        </div>
    </main>

    <#if registering>
        <aside class="tw-benefits">
            <div class="tw-benefits-top">
                <@tw.wordmark "tw-wordmark"/>
                <@tw.backToSite "tw-benefits-back"/>
            </div>
            <div class="tw-brand-space"></div>
            <p class="tw-benefits-title">${msg("twBenefitsTitle")}</p>
            <ol class="tw-benefits-list">
                <li><strong>${msg("twBenefit1Title")}</strong><span>${msg("twBenefit1Text")}</span></li>
                <li><strong>${msg("twBenefit2Title")}</strong><span>${msg("twBenefit2Text")}</span></li>
                <li><strong>${msg("twBenefit3Title")}</strong><span>${msg("twBenefit3Text")}</span></li>
            </ol>
            <div class="tw-brand-space"></div>
        </aside>
    </#if>
</div>
</body>
</html>
</#macro>
