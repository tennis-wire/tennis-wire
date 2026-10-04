package com.tenniswire.content_service.exception;

import lombok.Getter;

// Why a picture could not be taken from a link. The reason goes to the editor as the error code,
// and the editor words it.
@Getter
public class ImageLinkException extends RuntimeException {

    public enum Reason {
        // not http or https, a login in it, an odd port, or no link at all
        BAD_LINK(400),
        // the host is the server's own network, or nobody's
        LOCAL_ADDRESS(400),
        // no answer: unknown host, refused connection, timeout
        LINK_UNREACHABLE(502),
        // an answer other than the picture: an error status, or redirects going round
        LINK_REFUSED(502),
        // more than an upload may be
        LINK_TOO_LARGE(413);

        private final int status;

        Reason(int status) {
            this.status = status;
        }

        public int status() {
            return status;
        }
    }

    private final Reason reason;

    public ImageLinkException(Reason reason, String message) {
        super(message);
        this.reason = reason;
    }

    public ImageLinkException(Reason reason, String message, Throwable cause) {
        super(message, cause);
        this.reason = reason;
    }
}
