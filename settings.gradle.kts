plugins {
    id("org.gradle.toolchains.foojay-resolver-convention") version "1.0.0"
}

rootProject.name = "tennis-wire"

include("auth-support")
include("editorial-bff")
include("api-gateway")
include("content-service")
include("discussion-service")
