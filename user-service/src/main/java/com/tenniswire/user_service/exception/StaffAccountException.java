package com.tenniswire.user_service.exception;

public class StaffAccountException extends RuntimeException {

    public StaffAccountException() {
        super("a staff account is disabled by an administrator, not deleted");
    }
}
