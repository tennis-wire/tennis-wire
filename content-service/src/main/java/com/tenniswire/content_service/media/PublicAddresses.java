package com.tenniswire.content_service.media;

import java.net.Inet4Address;
import java.net.Inet6Address;
import java.net.InetAddress;
import java.net.UnknownHostException;

// Whether an address is out on the internet rather than ours or nobody's. A picture is fetched
// from a link an author pastes, and the server doing the fetching sits next to the database, the
// object storage and the cloud's metadata endpoint: none of those may be reachable that way.
public final class PublicAddresses {

    private PublicAddresses() {}

    public static boolean isPublic(InetAddress address) {
        if (address.isAnyLocalAddress()
                || address.isLoopbackAddress()
                || address.isLinkLocalAddress()
                || address.isSiteLocalAddress()
                || address.isMulticastAddress()) {
            return false;
        }
        var bytes = address.getAddress();
        if (address instanceof Inet4Address) {
            return isPublicV4(bytes);
        }
        if (address instanceof Inet6Address) {
            return isPublicV6(bytes);
        }
        return false;
    }

    // Beyond what InetAddress knows: "this network", carrier-grade NAT, the IETF and benchmarking
    // blocks, the documentation ranges and everything from 240 up, broadcast included
    private static boolean isPublicV4(byte[] ip) {
        int a = ip[0] & 0xFF;
        int b = ip[1] & 0xFF;
        int c = ip[2] & 0xFF;
        return a != 0
                && !(a == 100 && b >= 64 && b <= 127)
                && !(a == 192 && b == 0 && (c == 0 || c == 2))
                && !(a == 198 && (b == 18 || b == 19))
                && !(a == 198 && b == 51 && c == 100)
                && !(a == 203 && b == 0 && c == 113)
                && a < 240;
    }

    // Unique local fc00::/7 and documentation 2001:db8::/32; an IPv4 address mapped into IPv6 or
    // carried by NAT64, 6to4 or Teredo is judged as the IPv4 address it stands for
    private static boolean isPublicV6(byte[] ip) {
        if ((ip[0] & 0xFE) == 0xFC) {
            return false;
        }
        if (ip[0] == 0x20 && ip[1] == 0x01 && ip[2] == 0x0D && (ip[3] & 0xFF) == 0xB8) {
            return false;
        }
        var embedded = embeddedV4(ip);
        if (embedded != null) {
            return isPublic(embedded);
        }
        return true;
    }

    private static InetAddress embeddedV4(byte[] ip) {
        try {
            // mapped ::ffff:a.b.c.d, and the old compatible ::a.b.c.d
            boolean mapped = isZero(ip, 0, 10) && (ip[10] & 0xFF) == 0xFF && (ip[11] & 0xFF) == 0xFF;
            if (mapped || isZero(ip, 0, 12)) {
                return InetAddress.getByAddress(slice(ip, 12));
            }
            // NAT64, 64:ff9b::/96
            if (ip[0] == 0x00 && ip[1] == 0x64 && (ip[2] & 0xFF) == 0xFF && (ip[3] & 0xFF) == 0x9B) {
                return InetAddress.getByAddress(slice(ip, 12));
            }
            // 6to4, 2002::/16: the IPv4 address follows the prefix
            if (ip[0] == 0x20 && ip[1] == 0x02) {
                return InetAddress.getByAddress(slice(ip, 2));
            }
            // Teredo, 2001::/32: the client's address is the last four bytes, inverted
            if (ip[0] == 0x20 && ip[1] == 0x01 && ip[2] == 0x00 && ip[3] == 0x00) {
                var client = slice(ip, 12);
                for (int i = 0; i < client.length; i++) {
                    client[i] = (byte) ~client[i];
                }
                return InetAddress.getByAddress(client);
            }
            return null;
        } catch (UnknownHostException e) {
            return null;
        }
    }

    private static boolean isZero(byte[] ip, int from, int to) {
        for (int i = from; i < to; i++) {
            if (ip[i] != 0) {
                return false;
            }
        }
        return true;
    }

    private static byte[] slice(byte[] ip, int from) {
        var out = new byte[4];
        System.arraycopy(ip, from, out, 0, 4);
        return out;
    }
}
