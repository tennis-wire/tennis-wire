package com.tenniswire.user_service.entity;

import jakarta.persistence.Column;
import jakarta.persistence.Embeddable;
import java.io.Serializable;
import lombok.AllArgsConstructor;
import lombok.EqualsAndHashCode;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;

@Embeddable
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@EqualsAndHashCode
public class IdentityLinkId implements Serializable {

    private static final long serialVersionUID = 1L;

    @Column(name = "provider", nullable = false)
    private String provider;

    @Column(name = "sub", nullable = false)
    private String sub;
}
