cmake_minimum_required(VERSION 3.12)

set(LIBMBEDTLS_DIR ${CMAKE_CURRENT_LIST_DIR}/mbedtls)

set(SOURCES
	# libcrypto
	${LIBMBEDTLS_DIR}/library/aes.c
	${LIBMBEDTLS_DIR}/library/aesni.c
	${LIBMBEDTLS_DIR}/library/asn1parse.c
	${LIBMBEDTLS_DIR}/library/asn1write.c
	${LIBMBEDTLS_DIR}/library/base64.c
	${LIBMBEDTLS_DIR}/library/bignum.c
	${LIBMBEDTLS_DIR}/library/rsa_alt_helpers.c
	${LIBMBEDTLS_DIR}/library/camellia.c
	${LIBMBEDTLS_DIR}/library/ccm.c
	${LIBMBEDTLS_DIR}/library/chacha20.c
	${LIBMBEDTLS_DIR}/library/chachapoly.c
	${LIBMBEDTLS_DIR}/library/cipher_wrap.c
	${LIBMBEDTLS_DIR}/library/cipher.c
	${LIBMBEDTLS_DIR}/library/ctr_drbg.c
	${LIBMBEDTLS_DIR}/library/des.c
	${LIBMBEDTLS_DIR}/library/dhm.c
	${LIBMBEDTLS_DIR}/library/ecdh.c
	${LIBMBEDTLS_DIR}/library/ecdsa.c
	${LIBMBEDTLS_DIR}/library/ecjpake.c
	${LIBMBEDTLS_DIR}/library/ecp_curves.c
	${LIBMBEDTLS_DIR}/library/ecp.c
	${LIBMBEDTLS_DIR}/library/entropy_poll.c
	${LIBMBEDTLS_DIR}/library/entropy.c
	${LIBMBEDTLS_DIR}/library/error.c
	${LIBMBEDTLS_DIR}/library/gcm.c
	${LIBMBEDTLS_DIR}/library/constant_time.c
	${LIBMBEDTLS_DIR}/library/hmac_drbg.c
	${LIBMBEDTLS_DIR}/library/md.c
	${LIBMBEDTLS_DIR}/library/md5.c
	${LIBMBEDTLS_DIR}/library/memory_buffer_alloc.c
	${LIBMBEDTLS_DIR}/library/oid.c
	${LIBMBEDTLS_DIR}/library/padlock.c
	${LIBMBEDTLS_DIR}/library/pem.c
	${LIBMBEDTLS_DIR}/library/pk_wrap.c
	${LIBMBEDTLS_DIR}/library/pk.c
	${LIBMBEDTLS_DIR}/library/pkcs12.c
	${LIBMBEDTLS_DIR}/library/pkcs5.c
	${LIBMBEDTLS_DIR}/library/pkparse.c
	${LIBMBEDTLS_DIR}/library/pkwrite.c
	${LIBMBEDTLS_DIR}/library/platform_util.c
	${LIBMBEDTLS_DIR}/library/platform.c
	${LIBMBEDTLS_DIR}/library/poly1305.c
	${LIBMBEDTLS_DIR}/library/ripemd160.c
	${LIBMBEDTLS_DIR}/library/nist_kw.c
	${LIBMBEDTLS_DIR}/library/rsa.c
	${LIBMBEDTLS_DIR}/library/sha1.c
	${LIBMBEDTLS_DIR}/library/sha256.c
	${LIBMBEDTLS_DIR}/library/sha512.c
	${LIBMBEDTLS_DIR}/library/threading.c
	${LIBMBEDTLS_DIR}/library/timing.c
	${LIBMBEDTLS_DIR}/library/version_features.c
	${LIBMBEDTLS_DIR}/library/version.c
	${LIBMBEDTLS_DIR}/library/aria.c

	# libx509
	${LIBMBEDTLS_DIR}/library/x509_create.c
	${LIBMBEDTLS_DIR}/library/x509_crl.c
	${LIBMBEDTLS_DIR}/library/x509_crt.c
	${LIBMBEDTLS_DIR}/library/x509_csr.c
	${LIBMBEDTLS_DIR}/library/x509.c
	${LIBMBEDTLS_DIR}/library/x509write_crt.c
	${LIBMBEDTLS_DIR}/library/x509write_csr.c

	# libtls
	${LIBMBEDTLS_DIR}/library/debug.c
	${LIBMBEDTLS_DIR}/library/ssl_cache.c
	${LIBMBEDTLS_DIR}/library/ssl_ciphersuites.c
	${LIBMBEDTLS_DIR}/library/ssl_cli.c
	${LIBMBEDTLS_DIR}/library/ssl_cookie.c
	${LIBMBEDTLS_DIR}/library/ssl_msg.c
	${LIBMBEDTLS_DIR}/library/ssl_srv.c
	${LIBMBEDTLS_DIR}/library/ssl_ticket.c
	${LIBMBEDTLS_DIR}/library/ssl_tls.c
)

if (BUILD_SHARED_LIBS)
	add_library(tjs_mbedtls SHARED ${SOURCES})
	
else ()
	add_library(tjs_mbedtls STATIC ${SOURCES})
endif ()

target_include_directories(tjs_mbedtls PUBLIC ${LIBMBEDTLS_DIR}/include)

# set_target_properties(tjs_mbedtls PROPERTIES PREFIX "")
