"""Token verification: what the realm signs is accepted, nothing else."""

import time

import pytest
from cryptography.hazmat.primitives.asymmetric import rsa
from jwt import PyJWK, PyJWKClientConnectionError

from tests.conftest import AUTHOR_SUB, TokenFactory
from transcription.auth import KeysUnavailableError, TokenRejectedError, TokenVerifier
from transcription.config import Settings


def test_accepts_a_realm_token(token_verifier: TokenVerifier, make_token: TokenFactory) -> None:
    principal = token_verifier.verify(make_token())

    assert principal.sub == AUTHOR_SUB
    assert principal.username == "dev"
    assert principal.roles == {"author"}


def test_expiry_within_the_skew_still_passes(
    token_verifier: TokenVerifier, make_token: TokenFactory
) -> None:
    token_verifier.verify(make_token(exp=int(time.time()) - 30))


@pytest.mark.parametrize(
    "overrides",
    [
        {"exp": int(time.time()) - 120},
        {"exp": None},
        {"iss": "http://localhost:8180/realms/master"},
        {"iss": None},
        {"aud": ["account"]},
        {"aud": None},
        {"sub": None},
    ],
    ids=["expired", "no-exp", "foreign-issuer", "no-iss", "foreign-audience", "no-aud", "no-sub"],
)
def test_rejects_claims_that_do_not_fit(
    token_verifier: TokenVerifier, make_token: TokenFactory, overrides: dict[str, object]
) -> None:
    with pytest.raises(TokenRejectedError):
        token_verifier.verify(make_token(**overrides))


def test_rejects_another_signer_under_the_same_kid(
    token_verifier: TokenVerifier, make_token: TokenFactory
) -> None:
    other = rsa.generate_private_key(public_exponent=65537, key_size=2048)

    with pytest.raises(TokenRejectedError):
        token_verifier.verify(make_token(key=other))


def test_rejects_an_unknown_kid(token_verifier: TokenVerifier, make_token: TokenFactory) -> None:
    with pytest.raises(TokenRejectedError):
        token_verifier.verify(make_token(kid="rotated-away"))


def test_rejects_an_unsigned_token(token_verifier: TokenVerifier, make_token: TokenFactory) -> None:
    with pytest.raises(TokenRejectedError):
        token_verifier.verify(make_token(key="", algorithm="none"))


def test_rejects_garbage(token_verifier: TokenVerifier) -> None:
    with pytest.raises(TokenRejectedError):
        token_verifier.verify("not.a.jwt")


def test_malformed_roles_grant_nothing(
    token_verifier: TokenVerifier, make_token: TokenFactory
) -> None:
    principal = token_verifier.verify(make_token(realm_access={"roles": "author"}))

    assert principal.roles == frozenset()


def test_unreachable_keys_are_not_a_bad_token(settings: Settings, make_token: TokenFactory) -> None:
    class Unreachable:
        def get_signing_key_from_jwt(self, token: str) -> PyJWK:
            raise PyJWKClientConnectionError("connection refused")

    verifier = TokenVerifier(Unreachable(), settings.keycloak_issuer_uri, settings.jwt_audience)

    with pytest.raises(KeysUnavailableError):
        verifier.verify(make_token())
