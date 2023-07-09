/*
 * Copyright (c) 2003  Jeremie Miller <jer@jabber.org>
 * Copyright (c) 2016-2021  Joachim Wiberg <troglobit@gmail.com>
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *     * Redistributions of source code must retain the above copyright
 *       notice, this list of conditions and the following disclaimer.
 *     * Redistributions in binary form must reproduce the above copyright
 *       notice, this list of conditions and the following disclaimer in the
 *       documentation and/or other materials provided with the distribution.
 *     * Neither the name of the copyright holders nor the names of its
 *       contributors may be used to endorse or promote products derived from
 *       this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE
 * ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDERS OR CONTRIBUTORS BE
 * LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR
 * CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF
 * SUBSTITUTE GOODS OR SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS
 * INTERRUPTION) HOWEVER CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN
 * CONTRACT, STRICT LIABILITY, OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE)
 * ARISING IN ANY WAY OUT OF THE USE OF THIS SOFTWARE, EVEN IF ADVISED OF THE
 * POSSIBILITY OF SUCH DAMAGE.
 */

#include <arpa/inet.h>
#include <errno.h>
#include <fcntl.h>
#include <netinet/in.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>
#include <sys/socket.h>
#include <sys/types.h>
#include <time.h>
#include <unistd.h>

#include <libmdnsd/mdnsd.h>

void mdnsd_conflict(char* name, int type, void* arg)
{
    WARN("conflicting name detected %s for type %d, reload config ...", name, type);
}

/* Print an answer */
static int mdns_answer_callback(mdns_answer_t* answer, void* arg)
{
    int now;
    if (answer->ttl == 0) {
        now = 0;
		
	} else {
        now = answer->ttl - time(0);
	}

    switch (answer->type) {
    case QTYPE_A:
        printf("A %s for %d seconds to ip %s\n", answer->name, now, inet_ntoa(answer->ip));
        break;

    case QTYPE_PTR: {
		char buffer[256];
		memset(buffer, 0, sizeof(buffer));
		strncpy(buffer, answer->rdname, sizeof(buffer));

		int name_len = strlen(answer->name);
		int rdname_len = strlen(answer->rdname);
		if (rdname_len > name_len) {
			rdname_len -= name_len;
			buffer[rdname_len] = '\0';
			if (buffer[rdname_len - 1] == '.') {
				buffer[rdname_len - 1] = '\0';
			}
		}

        // printf("PTR %s for %d seconds to %s@%s\n", answer->name, now, answer->rdname, inet_ntoa(answer->ip));
        printf("- %s@%s\n", buffer, inet_ntoa(answer->ip));
        break;
	}
    case QTYPE_SRV:
        printf("SRV %s for %d seconds to %s:%d\n", answer->name, now, answer->rdname, answer->srv.port);
        break;

    default:
        printf("%d %s for %d seconds with %d data\n", answer->type, answer->name, now, answer->rdlen);
    }

    return 0;
}

/* Create multicast 224.0.0.251:5353 socket */
static int mdns_create_socket(void)
{
    struct sockaddr_in sin;
    struct ip_mreq imr;
    int sd, flag = 1;

    sd = socket(AF_INET, SOCK_DGRAM | SOCK_NONBLOCK, 0);
    if (sd < 0)
        return 0;

#ifdef SO_REUSEPORT
    if (setsockopt(sd, SOL_SOCKET, SO_REUSEPORT, &flag, sizeof(flag)))
        WARN("Failed setting SO_REUSEPORT: %s", strerror(errno));
#endif
    if (setsockopt(sd, SOL_SOCKET, SO_REUSEADDR, &flag, sizeof(flag)))
        WARN("Failed setting SO_REUSEADDR: %s", strerror(errno));

    memset(&sin, 0, sizeof(sin));
    sin.sin_family = AF_INET;
    sin.sin_port = htons(5353);
    sin.sin_addr.s_addr = 0;

    if (bind(sd, (struct sockaddr*)&sin, sizeof(sin))) {
        close(sd);
        return 0;
    }

    imr.imr_multiaddr.s_addr = inet_addr("224.0.0.251");
    imr.imr_interface.s_addr = htonl(INADDR_ANY);
    if (setsockopt(sd, IPPROTO_IP, IP_ADD_MEMBERSHIP, &imr, sizeof(imr)))
        WARN("Failed joining mDMS group 224.0.0.251: %s", strerror(errno));

    return sd;
}

static int usage(int code)
{
    /* mquery 12 _http._tcp.local. */
    printf("usage: mscan [-h] [-t TYPE] [NAME]\n\nmDNS scan:\n");
    return code;
}

int main(int argc, char* argv[])
{
    mdns_daemon_t* daemon;
    struct message mdns_message;
    struct in_addr ip;
    unsigned short port;
    ssize_t bsize;
    socklen_t ssize;
    unsigned char buf[MAX_PACKET_LEN];
    struct sockaddr_in from, to;
    fd_set fds;
    // char *name = DISCO_NAME;
    char* name = "_webthing._tcp.local.";
    int type = QTYPE_PTR; /* 12 */
    int sockfd, c;

    while ((c = getopt(argc, argv, "h?t:")) != EOF) {
        switch (c) {
        case 'h':
        case '?':
            return usage(0);

        case 't':
            type = atoi(optarg);
            break;

        default:
            return usage(1);
        }
    }

    // mdnsd_log_level("info");

    if (optind < argc) {
        name = argv[optind];
    }

    daemon = mdnsd_new(1, 1000);
    sockfd = mdns_create_socket();
    if (sockfd == -1) {
        printf("Failed creating multicast socket: %s\n", strerror(errno));
        return 1;
    }

    // printf("Scan type %d for `%s` ...\n", type, name);
	printf("Scanning web of things ...\n\n");
    mdnsd_query(daemon, name, type, mdns_answer_callback, NULL);

    while (1) {
        struct timeval* tv;
        tv = mdnsd_sleep(daemon);

        FD_ZERO(&fds);
        FD_SET(sockfd, &fds);
        select(sockfd + 1, &fds, 0, 0, tv);

        if (FD_ISSET(sockfd, &fds)) {
            ssize = sizeof(struct sockaddr_in);

            // 处理收到的消息
            while ((bsize = recvfrom(sockfd, buf, MAX_PACKET_LEN, 0, (struct sockaddr*)&from, &ssize)) > 0) {
                memset(&mdns_message, 0, sizeof(struct message));
                if (message_parse(&mdns_message, buf) == 0) {
                    // printf("reading from socket %d: %s\n", from.sin_port, inet_ntoa(from.sin_addr));
                    mdnsd_in(daemon, &mdns_message, from.sin_addr, from.sin_port);
                }
            }

            if (bsize < 0 && errno != EAGAIN) {
                printf("Failed reading from socket %d: %s\n", errno, strerror(errno));
                return 1;
            }
        }

        // 需要外发的消息
        while (mdnsd_out(daemon, &mdns_message, &ip, &port)) {
            memset(&to, 0, sizeof(to));
            to.sin_family = AF_INET;
            to.sin_port = port;
            to.sin_addr = ip;

            unsigned char* packet = message_packet(&mdns_message);
            int length = message_packet_len(&mdns_message);
            ssize = sizeof(struct sockaddr_in);
            if (sendto(sockfd, packet, length, 0, (struct sockaddr*)&to, ssize) != length) {
                printf("Failed writing to socket: %s\n", strerror(errno));
                return 1;
            }
        }
    }

    mdnsd_shutdown(daemon);
    mdnsd_free(daemon);

    return 0;
}
