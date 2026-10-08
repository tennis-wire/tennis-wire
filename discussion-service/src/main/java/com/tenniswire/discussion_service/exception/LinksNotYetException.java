package com.tenniswire.discussion_service.exception;

/** A link from a newcomer: links come once his first comments have stood a while. */
public class LinksNotYetException extends RuntimeException {

    public LinksNotYetException() {
        super("Links are not allowed until the author's first comments have stood a while");
    }
}
