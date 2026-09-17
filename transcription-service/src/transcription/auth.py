"""Bearer token verification against the realm's signing keys."""

from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Protocol

import jwt
from jwt import PyJWK, PyJWKClientConnectionError, PyJWKClientError

AUTHOR = "author"

# Same skew the Java services allow: Spring's JwtTimestampValidator defaults to 60 seconds.
_LEEWAY = timedelta(seconds=60)


class TokenRejectedError(Exception):
    """The token is not one this service accepts."""


class KeysUnavailableError(Exception):
    """The signing keys could not be fetched, so nothing can be verified."""


class SigningKeys(Protocol):
    def get_signing_key_from_jwt(self, token: str) -> PyJWK: ...


@dataclass(frozen=True, slots=True)
class Principal:
    sub: str
    username: str | None
    roles: frozenset[str]


class TokenVerifier:
    def __init__(self, keys: SigningKeys, issuer: str, audience: str) -> None:
        self._keys = keys
        self._issuer = issuer
        self._audience = audience

    def verify(self, token: str) -> Principal:
        try:
            key = self._keys.get_signing_key_from_jwt(token)
            claims = jwt.decode(
                token,
                key,
                algorithms=["RS256"],
                audience=self._audience,
                issuer=self._issuer,
                leeway=_LEEWAY,
                options={"require": ["exp", "iss", "aud", "sub"]},
            )
        # Before PyJWKClientError, which it extends: an unreachable key endpoint says nothing
        # about the token.
        except PyJWKClientConnectionError as exc:
            raise KeysUnavailableError from exc
        except (PyJWKClientError, jwt.InvalidTokenError) as exc:
            raise TokenRejectedError(str(exc)) from exc

        username = claims.get("preferred_username")
        return Principal(
            sub=claims["sub"],
            username=username if isinstance(username, str) else None,
            roles=_realm_roles(claims),
        )


def _realm_roles(claims: dict[str, Any]) -> frozenset[str]:
    # Malformed roles grant nothing rather than failing, as in auth-support's converter.
    realm_access = claims.get("realm_access")
    roles = realm_access.get("roles") if isinstance(realm_access, dict) else None
    if not isinstance(roles, list):
        return frozenset()
    return frozenset(role for role in roles if isinstance(role, str))
