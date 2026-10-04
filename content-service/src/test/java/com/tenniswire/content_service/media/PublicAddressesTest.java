package com.tenniswire.content_service.media;

import static org.assertj.core.api.Assertions.assertThat;

import java.net.InetAddress;
import java.net.UnknownHostException;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;

// The addresses are what is being tested, so they are written out as addresses
@SuppressWarnings("PMD.AvoidUsingHardCodedIP")
class PublicAddressesTest {

    @ParameterizedTest
    @ValueSource(
            strings = {
                "0.0.0.0",
                "127.0.0.1",
                "10.1.2.3",
                "172.16.0.1",
                "192.168.1.1",
                "169.254.169.254",
                "100.64.0.1",
                "192.0.0.8",
                "198.18.0.1",
                "203.0.113.5",
                "224.0.0.1",
                "255.255.255.255",
                "::",
                "::1",
                "fe80::1",
                "fc00::1",
                "fd12:3456::1",
                "2001:db8::1",
                "::ffff:127.0.0.1",
                "::ffff:169.254.169.254",
                "64:ff9b::a9fe:a9fe",
                "2002:0a00:0001::1",
            })
    void anAddressOfOursOrOfNobodyIsNotPublic(String address) throws UnknownHostException {
        assertThat(PublicAddresses.isPublic(InetAddress.getByName(address))).isFalse();
    }

    @ParameterizedTest
    @ValueSource(strings = {"8.8.8.8", "93.184.215.14", "2606:4700:4700::1111", "::ffff:8.8.8.8"})
    void anAddressOutOnTheInternetIs(String address) throws UnknownHostException {
        assertThat(PublicAddresses.isPublic(InetAddress.getByName(address))).isTrue();
    }
}
