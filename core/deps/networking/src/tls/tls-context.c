#include "tls/tls-context.h"
#include "mbedtls/platform.h"

#include <assert.h>

const char uv_tls_ca_root_certs[] =

    // GlobalSign Root CA
    "-----BEGIN CERTIFICATE-----\r\n"
    "MIIE0DCCBDmgAwIBAgIQJQzo4DBhLp8rifcFTXz4/TANBgkqhkiG9w0BAQUFADBf\r\n"
    "MQswCQYDVQQGEwJVUzEXMBUGA1UEChMOVmVyaVNpZ24sIEluYy4xNzA1BgNVBAsT\r\n"
    "LkNsYXNzIDMgUHVibGljIFByaW1hcnkgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkw\r\n"
    "HhcNMDYxMTA4MDAwMDAwWhcNMjExMTA3MjM1OTU5WjCByjELMAkGA1UEBhMCVVMx\r\n"
    "FzAVBgNVBAoTDlZlcmlTaWduLCBJbmMuMR8wHQYDVQQLExZWZXJpU2lnbiBUcnVz\r\n"
    "dCBOZXR3b3JrMTowOAYDVQQLEzEoYykgMjAwNiBWZXJpU2lnbiwgSW5jLiAtIEZv\r\n"
    "ciBhdXRob3JpemVkIHVzZSBvbmx5MUUwQwYDVQQDEzxWZXJpU2lnbiBDbGFzcyAz\r\n"
    "IFB1YmxpYyBQcmltYXJ5IENlcnRpZmljYXRpb24gQXV0aG9yaXR5IC0gRzUwggEi\r\n"
    "MA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQCvJAgIKXo1nmAMqudLO07cfLw8\r\n"
    "RRy7K+D+KQL5VwijZIUVJ/XxrcgxiV0i6CqqpkKzj/i5Vbext0uz/o9+B1fs70Pb\r\n"
    "ZmIVYc9gDaTY3vjgw2IIPVQT60nKWVSFJuUrjxuf6/WhkcIzSdhDY2pSS9KP6HBR\r\n"
    "TdGJaXvHcPaz3BJ023tdS1bTlr8Vd6Gw9KIl8q8ckmcY5fQGBO+QueQA5N06tRn/\r\n"
    "Arr0PO7gi+s3i+z016zy9vA9r911kTMZHRxAy3QkGSGT2RT+rCpSx4/VBEnkjWNH\r\n"
    "iDxpg8v+R70rfk/Fla4OndTRQ8Bnc+MUCH7lP59zuDMKz10/NIeWiu5T6CUVAgMB\r\n"
    "AAGjggGbMIIBlzAPBgNVHRMBAf8EBTADAQH/MDEGA1UdHwQqMCgwJqAkoCKGIGh0\r\n"
    "dHA6Ly9jcmwudmVyaXNpZ24uY29tL3BjYTMuY3JsMA4GA1UdDwEB/wQEAwIBBjA9\r\n"
    "BgNVHSAENjA0MDIGBFUdIAAwKjAoBggrBgEFBQcCARYcaHR0cHM6Ly93d3cudmVy\r\n"
    "aXNpZ24uY29tL2NwczAdBgNVHQ4EFgQUf9Nlp8Ld7LvwMAnzQzn6Aq8zMTMwbQYI\r\n"
    "KwYBBQUHAQwEYTBfoV2gWzBZMFcwVRYJaW1hZ2UvZ2lmMCEwHzAHBgUrDgMCGgQU\r\n"
    "j+XTGoasjY5rw8+AatRIGCx7GS4wJRYjaHR0cDovL2xvZ28udmVyaXNpZ24uY29t\r\n"
    "L3ZzbG9nby5naWYwNAYIKwYBBQUHAQEEKDAmMCQGCCsGAQUFBzABhhhodHRwOi8v\r\n"
    "b2NzcC52ZXJpc2lnbi5jb20wPgYDVR0lBDcwNQYIKwYBBQUHAwEGCCsGAQUFBwMC\r\n"
    "BggrBgEFBQcDAwYJYIZIAYb4QgQBBgpghkgBhvhFAQgBMA0GCSqGSIb3DQEBBQUA\r\n"
    "A4GBABMC3fjohgDyWvj4IAxZiGIHzs73Tvm7WaGY5eE43U68ZhjTresY8g3JbT5K\r\n"
    "lCDDPLq9ZVTGr0SzEK0saz6r1we2uIFjxfleLuUqZ87NMwwq14lWAyMfs77oOghZ\r\n"
    "tOxFNfeKW/9mz1Cvxm1XjRl4t7mi0VfqH5pLr7rJjhJ+xr3/\r\n"
    "-----END CERTIFICATE-----\r\n"
    "-----BEGIN CERTIFICATE-----\r\n"
    "MIIEADCCAuigAwIBAgIBADANBgkqhkiG9w0BAQUFADBjMQswCQYDVQQGEwJVUzEh\r\n"
    "MB8GA1UEChMYVGhlIEdvIERhZGR5IEdyb3VwLCBJbmMuMTEwLwYDVQQLEyhHbyBE\r\n"
    "YWRkeSBDbGFzcyAyIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MB4XDTA0MDYyOTE3\r\n"
    "MDYyMFoXDTM0MDYyOTE3MDYyMFowYzELMAkGA1UEBhMCVVMxITAfBgNVBAoTGFRo\r\n"
    "ZSBHbyBEYWRkeSBHcm91cCwgSW5jLjExMC8GA1UECxMoR28gRGFkZHkgQ2xhc3Mg\r\n"
    "MiBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTCCASAwDQYJKoZIhvcNAQEBBQADggEN\r\n"
    "ADCCAQgCggEBAN6d1+pXGEmhW+vXX0iG6r7d/+TvZxz0ZWizV3GgXne77ZtJ6XCA\r\n"
    "PVYYYwhv2vLM0D9/AlQiVBDYsoHUwHU9S3/Hd8M+eKsaA7Ugay9qK7HFiH7Eux6w\r\n"
    "wdhFJ2+qN1j3hybX2C32qRe3H3I2TqYXP2WYktsqbl2i/ojgC95/5Y0V4evLOtXi\r\n"
    "EqITLdiOr18SPaAIBQi2XKVlOARFmR6jYGB0xUGlcmIbYsUfb18aQr4CUWWoriMY\r\n"
    "avx4A6lNf4DD+qta/KFApMoZFv6yyO9ecw3ud72a9nmYvLEHZ6IVDd2gWMZEewo+\r\n"
    "YihfukEHU1jPEX44dMX4/7VpkI+EdOqXG68CAQOjgcAwgb0wHQYDVR0OBBYEFNLE\r\n"
    "sNKR1EwRcbNhyz2h/t2oatTjMIGNBgNVHSMEgYUwgYKAFNLEsNKR1EwRcbNhyz2h\r\n"
    "/t2oatTjoWekZTBjMQswCQYDVQQGEwJVUzEhMB8GA1UEChMYVGhlIEdvIERhZGR5\r\n"
    "IEdyb3VwLCBJbmMuMTEwLwYDVQQLEyhHbyBEYWRkeSBDbGFzcyAyIENlcnRpZmlj\r\n"
    "YXRpb24gQXV0aG9yaXR5ggEAMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQAD\r\n"
    "ggEBADJL87LKPpH8EsahB4yOd6AzBhRckB4Y9wimPQoZ+YeAEW5p5JYXMP80kWNy\r\n"
    "OO7MHAGjHZQopDH2esRU1/blMVgDoszOYtuURXO1v0XJJLXVggKtI3lpjbi2Tc7P\r\n"
    "TMozI+gciKqdi0FuFskg5YmezTvacPd+mSYgFFQlq25zheabIZ0KbIIOqPjCDPoQ\r\n"
    "HmyW74cNxA9hi63ugyuV+I6ShHI56yDqg+2DzZduCLzrTia2cyvk0/ZM/iZx4mER\r\n"
    "dEr/VxqHD3VILs9RaRegAhJhldXRQLIQTO7ErBBDpqWeCtWVYpoNz4iCxTIM5Cuf\r\n"
    "ReYNnyicsbkqWletNw+vHX/bvZ8=\r\n"
    "-----END CERTIFICATE-----\r\n"
    "";

int tls_print_error(int error_code, char* buffer, size_t buffer_size)
{
    assert(buffer != NULL && buffer_size > 0);

    mbedtls_strerror(error_code, buffer, buffer_size);
    return 0;
}

int tls_client_init(tls_context_t* context)
{
    assert(context != NULL);

    int ret;

    /** 0. Initialize the RNG and the session data */
    mbedtls_ssl_init(&context->ssl);
    mbedtls_ssl_config_init(&context->conf);
    mbedtls_x509_crt_init(&context->cacert);
    mbedtls_ctr_drbg_init(&context->ctr_drbg);

    // mbedtls_printf( "\n  . Seeding the random number generator...\n" );
    const unsigned char* pers = "chat";
    mbedtls_entropy_init(&context->entropy);
    ret = mbedtls_ctr_drbg_seed(&context->ctr_drbg, mbedtls_entropy_func, &context->entropy, pers, strlen(pers));
    if (ret != 0) {
        return ret;
    }

    /** 0. Initialize certificates */
    // mbedtls_printf( "  . Loading the CA root certificate ...\n" );
#if 1
    ret = mbedtls_x509_crt_parse(&context->cacert, (const unsigned char*)uv_tls_ca_root_certs, sizeof(uv_tls_ca_root_certs));
    if (ret < 0) {
        return ret;
    }
#endif

    return 0;
}

int tls_client_set_cacerts(tls_context_t* context, const char* certs, size_t certs_size)
{
    assert(context != NULL);

    /** 0. Initialize certificates */
    return mbedtls_x509_crt_parse(&context->cacert, (const unsigned char*)certs, certs_size);
}

int tls_client_setup(tls_context_t* context, const char* hostname)
{
    assert(context != NULL);

    int endpoint = MBEDTLS_SSL_IS_CLIENT;
    int transport = MBEDTLS_SSL_TRANSPORT_STREAM;
    int preset = MBEDTLS_SSL_PRESET_DEFAULT;
    int ret = mbedtls_ssl_config_defaults(&context->conf, endpoint, transport, preset);
    if (ret != 0) {
        return ret;
    }

    /* OPTIONAL is not optimal for security,
     * but makes interop easier in this simplified example */
    mbedtls_ssl_conf_authmode(&context->conf, MBEDTLS_SSL_VERIFY_OPTIONAL);
    mbedtls_ssl_conf_ca_chain(&context->conf, &context->cacert, NULL);
    mbedtls_ssl_conf_rng(&context->conf, mbedtls_ctr_drbg_random, &context->ctr_drbg);
    ret = mbedtls_ssl_setup(&context->ssl, &context->conf);
    if (ret != 0) {
        return ret;
    }

    ret = mbedtls_ssl_set_hostname(&context->ssl, hostname);
    if (ret != 0) {
        return ret;
    }

    return 0;
}

int tls_client_write(tls_context_t* context, const uint8_t* data, size_t size)
{
    assert(context != NULL);
    if (data == NULL || size <= 0) {
        return -1;
    }

    int leftover = size;
    int offset = 0;
    int result = 0;
    while (leftover > 0) {
        int ret = mbedtls_ssl_write(&context->ssl, data + offset, leftover);
        if (ret <= 0) {
            result = ret;
            break;

        } else if (ret > 0) {
            leftover -= ret;
            offset += ret;
        }
    }

    return result;
}

int tls_client_destroy(tls_context_t* context)
{
    assert(context != NULL);

    mbedtls_x509_crt_free(&context->cacert);
    mbedtls_ssl_free(&context->ssl);
    mbedtls_ssl_config_free(&context->conf);
    mbedtls_ctr_drbg_free(&context->ctr_drbg);
    mbedtls_entropy_free(&context->entropy);

    return 0;
}

int tls_server_init(tls_context_t* context)
{
    assert(context != NULL);

    int ret;

    /** 0. Initialize the RNG and the session data */
    mbedtls_ssl_init(&context->ssl);
    mbedtls_ssl_config_init(&context->conf);
    mbedtls_x509_crt_init(&context->cacert);
    mbedtls_ctr_drbg_init(&context->ctr_drbg);

    // mbedtls_printf( "\n  . Seeding the random number generator...\n" );
    const unsigned char* pers = "chat";
    mbedtls_entropy_init(&context->entropy);
    ret = mbedtls_ctr_drbg_seed(&context->ctr_drbg, mbedtls_entropy_func, &context->entropy, pers, strlen(pers));
    if (ret != 0) {
        mbedtls_printf(" failed\n  ! mbedtls_ctr_drbg_seed returned %d\n", ret);
        return ret;
    }

    /** 0. Initialize certificates */
    // mbedtls_printf( "  . Loading the CA root certificate ...\n" );
    ret = mbedtls_x509_crt_parse(&context->cacert, (const unsigned char*)uv_tls_ca_root_certs, sizeof(uv_tls_ca_root_certs));
    if (ret < 0) {
        mbedtls_printf(" failed\n  !  mbedtls_x509_crt_parse returned -0x%x\n\n", -ret);
        return ret;
    }

    // ret = mbedtls_x509_crt_parse( &srvcert, (const unsigned char *) mbedtls_test_cas_pem, mbedtls_test_cas_pem_len );
    // ret = mbedtls_pk_parse_key( &pkey, (const unsigned char *) mbedtls_test_srv_key, mbedtls_test_srv_key_len, NULL, 0 );

    return 0;
}

int tls_server_setup(tls_context_t* context)
{
    assert(context != NULL);

    int endpoint = MBEDTLS_SSL_IS_SERVER;
    int transport = MBEDTLS_SSL_TRANSPORT_STREAM;
    int preset = MBEDTLS_SSL_PRESET_DEFAULT;
    int ret = mbedtls_ssl_config_defaults(&context->conf, endpoint, transport, preset);
    if (ret != 0) {
        return ret;
    }

    mbedtls_ssl_conf_rng(&context->conf, mbedtls_ctr_drbg_random, &context->ctr_drbg);
    mbedtls_ssl_conf_ca_chain(&context->conf, &context->cacert, NULL);
    // ret = mbedtls_ssl_conf_own_cert( &conf, &srvcert, &pkey);

    ret = mbedtls_ssl_setup(&context->ssl, &context->conf);
    if (ret != 0) {
        return ret;
    }

    mbedtls_ssl_session_reset(&context->ssl);
    return 0;
}
