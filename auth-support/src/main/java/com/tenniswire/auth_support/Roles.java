package com.tenniswire.auth_support;

public final class Roles {

    public static final String USER = "user";
    public static final String AUTHOR = "author";
    public static final String CHIEF_EDITOR = "chief-editor";
    public static final String MODERATOR = "moderator";
    public static final String MODERATOR_BOT = "moderator-bot";
    public static final String ADMIN = "admin";

    public static final String SERVICE = "service";
    // The news collector: aggregator-service /internal/** and nothing else
    public static final String PARSER = "parser";

    private Roles() {}
}
