package com.tenniswire.content_service.media;

import java.net.InetAddress;
import java.net.UnknownHostException;
import java.util.Arrays;
import org.apache.hc.client5.http.DnsResolver;
import org.apache.hc.client5.http.SystemDefaultDnsResolver;

// The one place the fetching client learns where a host is, so the address it connects to is the
// address that was checked: a name that resolves to a public address for a check and to a private
// one a moment later for the connection (DNS rebinding) has no second lookup to slip into.
// A host with any non-public address is refused whole rather than filtered.
final class PublicAddressResolver implements DnsResolver {

    private final boolean allowLocal;

    PublicAddressResolver(boolean allowLocal) {
        this.allowLocal = allowLocal;
    }

    @Override
    public InetAddress[] resolve(String host) throws UnknownHostException {
        var addresses = SystemDefaultDnsResolver.INSTANCE.resolve(host);
        if (!allowLocal && !Arrays.stream(addresses).allMatch(PublicAddresses::isPublic)) {
            throw new LocalAddressException(host);
        }
        return addresses;
    }

    @Override
    public String resolveCanonicalHostname(String host) throws UnknownHostException {
        return SystemDefaultDnsResolver.INSTANCE.resolveCanonicalHostname(host);
    }

    // An UnknownHostException so that it leaves the client the way a failed lookup does
    static final class LocalAddressException extends UnknownHostException {

        LocalAddressException(String host) {
            super(host + " is not a public address");
        }
    }
}
