package com.mandat.api.common.security;

import java.io.Serial;
import java.util.List;
import org.springframework.security.authentication.AbstractAuthenticationToken;

/** Authentication built from a valid access token; its principal is the {@link AuthenticatedUser}. */
public final class AuthenticatedUserAuthentication extends AbstractAuthenticationToken {

    @Serial
    private static final long serialVersionUID = 1L;

    private final AuthenticatedUser principal;

    public AuthenticatedUserAuthentication(AuthenticatedUser principal) {
        super(List.of());
        this.principal = principal;
        setAuthenticated(true);
    }

    @Override
    public AuthenticatedUser getPrincipal() {
        return principal;
    }

    @Override
    public Object getCredentials() {
        return null;
    }

    @Override
    public String getName() {
        return principal.id().toString();
    }
}
