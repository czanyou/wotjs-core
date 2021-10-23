#include "uv-tls-port.h"

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

int uv_tls_print_error(int errcode, const char* func) {
    char buffer[512];
    mbedtls_strerror(errcode, buffer, sizeof(buffer));
    printf("%s: errcode=-0x%X, error=%s\n", func, -errcode, buffer);
    return 0;
}

int uv_tls_port_init_client(uv_tls_port_t* tls)
{
    int ret;

    /** 0. Initialize the RNG and the session data */
    mbedtls_ssl_init(&tls->ssl);
    mbedtls_ssl_config_init(&tls->conf);
    mbedtls_x509_crt_init(&tls->cacert);
    mbedtls_ctr_drbg_init(&tls->ctr_drbg);

    // mbedtls_printf( "\n  . Seeding the random number generator...\n" );
    const unsigned char* pers = "chat";
    mbedtls_entropy_init(&tls->entropy);
    ret = mbedtls_ctr_drbg_seed(&tls->ctr_drbg, mbedtls_entropy_func, &tls->entropy, pers, strlen(pers));
    if (ret != 0) {
        uv_tls_print_error(ret, "mbedtls_ctr_drbg_seed");
        return ret;
    }

    /** 0. Initialize certificates */
    // mbedtls_printf( "  . Loading the CA root certificate ...\n" );
#if 1
    ret = mbedtls_x509_crt_parse(&tls->cacert, (const unsigned char*)uv_tls_ca_root_certs, sizeof(uv_tls_ca_root_certs));
    if (ret < 0) {
        uv_tls_print_error(ret, "mbedtls_x509_crt_parse");
        return ret;
    }
#endif

    return ERR_TLS_OK;
}

int uv_tls_port_set_cacerts(uv_tls_port_t* tls, const char* certs, size_t certs_size)
{
    /** 0. Initialize certificates */
    int ret = mbedtls_x509_crt_parse(&tls->cacert, (const unsigned char*)certs, certs_size);
    if (ret < 0) {
        uv_tls_print_error(ret, "mbedtls_x509_crt_parse");
        return ret;
    }

    return 0;
}

int uv_tls_port_init_server(uv_tls_port_t* tls)
{
    int ret;

    /** 0. Initialize the RNG and the session data */
    mbedtls_ssl_init(&tls->ssl);
    mbedtls_ssl_config_init(&tls->conf);
    mbedtls_x509_crt_init(&tls->cacert);
    mbedtls_ctr_drbg_init(&tls->ctr_drbg);

    // mbedtls_printf( "\n  . Seeding the random number generator...\n" );
    const unsigned char* pers = "chat";
    mbedtls_entropy_init(&tls->entropy);
    ret = mbedtls_ctr_drbg_seed(&tls->ctr_drbg, mbedtls_entropy_func, &tls->entropy, pers, strlen(pers));
    if (ret != 0) {
        mbedtls_printf(" failed\n  ! mbedtls_ctr_drbg_seed returned %d\n", ret);
        return ret;
    }

    /** 0. Initialize certificates */
    // mbedtls_printf( "  . Loading the CA root certificate ...\n" );
    ret = mbedtls_x509_crt_parse(&tls->cacert, (const unsigned char*)uv_tls_ca_root_certs, sizeof(uv_tls_ca_root_certs));
    if (ret < 0) {
        mbedtls_printf(" failed\n  !  mbedtls_x509_crt_parse returned -0x%x\n\n", -ret);
        return ret;
    }

    // ret = mbedtls_x509_crt_parse( &srvcert, (const unsigned char *) mbedtls_test_cas_pem, mbedtls_test_cas_pem_len );
    // ret = mbedtls_pk_parse_key( &pkey, (const unsigned char *) mbedtls_test_srv_key, mbedtls_test_srv_key_len, NULL, 0 );

    return ERR_TLS_OK;
}

int uv_tls_port_free(uv_tls_port_t* tls)
{
    mbedtls_x509_crt_free(&tls->cacert);
    mbedtls_ssl_free(&tls->ssl);
    mbedtls_ssl_config_free(&tls->conf);
    mbedtls_ctr_drbg_free(&tls->ctr_drbg);
    mbedtls_entropy_free(&tls->entropy);

    return ERR_TLS_OK;
}