// @ts-check
/// <reference path ="../../types/index.d.ts" />
import * as native from '@tjs/native';
import * as dns from '@tjs/dns';

import { defineEventAttribute, EventTarget } from '@tjs/event-target';

/* global MessageEvent Event ErrorEvent */

export const rootCertificates = [
    // EMQX CA
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIDUTCCAjmgAwIBAgIJAPPYCjTmxdt/MA0GCSqGSIb3DQEBCwUAMD8xCzAJBgNV\r\n' +
    'BAYTAkNOMREwDwYDVQQIDAhoYW5nemhvdTEMMAoGA1UECgwDRU1RMQ8wDQYDVQQD\r\n' +
    'DAZSb290Q0EwHhcNMjAwNTA4MDgwNjUyWhcNMzAwNTA2MDgwNjUyWjA/MQswCQYD\r\n' +
    'VQQGEwJDTjERMA8GA1UECAwIaGFuZ3pob3UxDDAKBgNVBAoMA0VNUTEPMA0GA1UE\r\n' +
    'AwwGUm9vdENBMIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAzcgVLex1\r\n' +
    'EZ9ON64EX8v+wcSjzOZpiEOsAOuSXOEN3wb8FKUxCdsGrsJYB7a5VM/Jot25Mod2\r\n' +
    'juS3OBMg6r85k2TWjdxUoUs+HiUB/pP/ARaaW6VntpAEokpij/przWMPgJnBF3Ur\r\n' +
    'MjtbLayH9hGmpQrI5c2vmHQ2reRZnSFbY+2b8SXZ+3lZZgz9+BaQYWdQWfaUWEHZ\r\n' +
    'uDaNiViVO0OT8DRjCuiDp3yYDj3iLWbTA/gDL6Tf5XuHuEwcOQUrd+h0hyIphO8D\r\n' +
    'tsrsHZ14j4AWYLk1CPA6pq1HIUvEl2rANx2lVUNv+nt64K/Mr3RnVQd9s8bK+TXQ\r\n' +
    'KGHd2Lv/PALYuwIDAQABo1AwTjAdBgNVHQ4EFgQUGBmW+iDzxctWAWxmhgdlE8Pj\r\n' +
    'EbQwHwYDVR0jBBgwFoAUGBmW+iDzxctWAWxmhgdlE8PjEbQwDAYDVR0TBAUwAwEB\r\n' +
    '/zANBgkqhkiG9w0BAQsFAAOCAQEAGbhRUjpIred4cFAFJ7bbYD9hKu/yzWPWkMRa\r\n' +
    'ErlCKHmuYsYk+5d16JQhJaFy6MGXfLgo3KV2itl0d+OWNH0U9ULXcglTxy6+njo5\r\n' +
    'CFqdUBPwN1jxhzo9yteDMKF4+AHIxbvCAJa17qcwUKR5MKNvv09C6pvQDJLzid7y\r\n' +
    'E2dkgSuggik3oa0427KvctFf8uhOV94RvEDyqvT5+pgNYZ2Yfga9pD/jjpoHEUlo\r\n' +
    '88IGU8/wJCx3Ds2yc8+oBg/ynxG8f/HmCC1ET6EHHoe2jlo8FpU/SgGtghS1YL30\r\n' +
    'IWxNsPrUP+XsZpBJy/mvOhE5QXo6Y35zDqqj8tI7AGmAWu22jg==\r\n' +
    '-----END CERTIFICATE-----\r\n',

    // Starfield Class 2 Certification Authority
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIEDzCCAvegAwIBAgIBADANBgkqhkiG9w0BAQUFADBoMQswCQYDVQQGEwJVUzEl\r\n' +
    'MCMGA1UEChMcU3RhcmZpZWxkIFRlY2hub2xvZ2llcywgSW5jLjEyMDAGA1UECxMp\r\n' +
    'U3RhcmZpZWxkIENsYXNzIDIgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwHhcNMDQw\r\n' +
    'NjI5MTczOTE2WhcNMzQwNjI5MTczOTE2WjBoMQswCQYDVQQGEwJVUzElMCMGA1UE\r\n' +
    'ChMcU3RhcmZpZWxkIFRlY2hub2xvZ2llcywgSW5jLjEyMDAGA1UECxMpU3RhcmZp\r\n' +
    'ZWxkIENsYXNzIDIgQ2VydGlmaWNhdGlvbiBBdXRob3JpdHkwggEgMA0GCSqGSIb3\r\n' +
    'DQEBAQUAA4IBDQAwggEIAoIBAQC3Msj+6XGmBIWtDBFk385N78gDGIc/oav7PKaf\r\n' +
    '8MOh2tTYbitTkPskpD6E8J7oX+zlJ0T1KKY/e97gKvDIr1MvnsoFAZMej2YcOadN\r\n' +
    '+lq2cwQlZut3f+dZxkqZJRRU6ybH838Z1TBwj6+wRir/resp7defqgSHo9T5iaU0\r\n' +
    'X9tDkYI22WY8sbi5gv2cOj4QyDvvBmVmepsZGD3/cVE8MC5fvj13c7JdBmzDI1aa\r\n' +
    'K4UmkhynArPkPw2vCHmCuDY96pzTNbO8acr1zJ3o/WSNF4Azbl5KXZnJHoe0nRrA\r\n' +
    '1W4TNSNe35tfPe/W93bC6j67eA0cQmdrBNj41tpvi/JEoAGrAgEDo4HFMIHCMB0G\r\n' +
    'A1UdDgQWBBS/X7fRzt0fhvRbVazc1xDCDqmI5zCBkgYDVR0jBIGKMIGHgBS/X7fR\r\n' +
    'zt0fhvRbVazc1xDCDqmI56FspGowaDELMAkGA1UEBhMCVVMxJTAjBgNVBAoTHFN0\r\n' +
    'YXJmaWVsZCBUZWNobm9sb2dpZXMsIEluYy4xMjAwBgNVBAsTKVN0YXJmaWVsZCBD\r\n' +
    'bGFzcyAyIENlcnRpZmljYXRpb24gQXV0aG9yaXR5ggEAMAwGA1UdEwQFMAMBAf8w\r\n' +
    'DQYJKoZIhvcNAQEFBQADggEBAAWdP4id0ckaVaGsafPzWdqbAYcaT1epoXkJKtv3\r\n' +
    'L7IezMdeatiDh6GX70k1PncGQVhiv45YuApnP+yz3SFmH8lU+nLMPUxA2IGvd56D\r\n' +
    'eruix/U0F47ZEUD0/CwqTRV/p2JdLiXTAAsgGh1o+Re49L2L7ShZ3U0WixeDyLJl\r\n' +
    'xy16paq8U4Zt3VekyvggQQto8PT7dL5WXXp59fkdheMtlb71cZBDzI0fmgAKhynp\r\n' +
    'VSJYACPq4xJDKVtHCN2MQWplBqjlIapBtJUhlbl90TSrE9atvNziPTnNvT51cKEY\r\n' +
    'WQPJIrSPnNVeKtelttQKbfi3QBFGmh95DmK/D5fs4C8fF5Q=\r\n' +
    '-----END CERTIFICATE-----\r\n',

    //  GlobalSign Root CA - R3
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIDXzCCAkegAwIBAgILBAAAAAABIVhTCKIwDQYJKoZIhvcNAQELBQAwTDEgMB4G\r\n' +
    'A1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjMxEzARBgNVBAoTCkdsb2JhbFNp\r\n' +
    'Z24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMDkwMzE4MTAwMDAwWhcNMjkwMzE4\r\n' +
    'MTAwMDAwWjBMMSAwHgYDVQQLExdHbG9iYWxTaWduIFJvb3QgQ0EgLSBSMzETMBEG\r\n' +
    'A1UEChMKR2xvYmFsU2lnbjETMBEGA1UEAxMKR2xvYmFsU2lnbjCCASIwDQYJKoZI\r\n' +
    'hvcNAQEBBQADggEPADCCAQoCggEBAMwldpB5BngiFvXAg7aEyiie/QV2EcWtiHL8\r\n' +
    'RgJDx7KKnQRfJMsuS+FggkbhUqsMgUdwbN1k0ev1LKMPgj0MK66X17YUhhB5uzsT\r\n' +
    'gHeMCOFJ0mpiLx9e+pZo34knlTifBtc+ycsmWQ1z3rDI6SYOgxXG71uL0gRgykmm\r\n' +
    'KPZpO/bLyCiR5Z2KYVc3rHQU3HTgOu5yLy6c+9C7v/U9AOEGM+iCK65TpjoWc4zd\r\n' +
    'QQ4gOsC0p6Hpsk+QLjJg6VfLuQSSaGjlOCZgdbKfd/+RFO+uIEn8rUAVSNECMWEZ\r\n' +
    'XriX7613t2Saer9fwRPvm2L7DWzgVGkWqQPabumDk3F2xmmFghcCAwEAAaNCMEAw\r\n' +
    'DgYDVR0PAQH/BAQDAgEGMA8GA1UdEwEB/wQFMAMBAf8wHQYDVR0OBBYEFI/wS3+o\r\n' +
    'LkUkrk1Q+mOai97i3Ru8MA0GCSqGSIb3DQEBCwUAA4IBAQBLQNvAUKr+yAzv95ZU\r\n' +
    'RUm7lgAJQayzE4aGKAczymvmdLm6AC2upArT9fHxD4q/c2dKg8dEe3jgr25sbwMp\r\n' +
    'jjM5RcOO5LlXbKr8EpbsU8Yt5CRsuZRj+9xTaGdWPoO4zzUhw8lo/s7awlOqzJCK\r\n' +
    '6fBdRoyV3XpYKBovHd7NADdBj+1EbddTKJd+82cEHhXXipa0095MJ6RMG3NzdvQX\r\n' +
    'mcIfeg7jLQitChws/zyrVQ4PkX4268NXSb7hLi18YIvDQVETI53O9zJrlAGomecs\r\n' +
    'Mx86OyXShkDOOyyGeMlhLxS67ttVb9+E7gUJTb0o2HLO02JQZR7rkpeDMdmztcpH\r\n' +
    'WD9f\r\n' +
    '-----END CERTIFICATE-----\r\n',

    //  Actalis Authentication Root CA
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIFuzCCA6OgAwIBAgIIVwoRl0LE48wwDQYJKoZIhvcNAQELBQAwazELMAkGA1UE\r\n' +
    'BhMCSVQxDjAMBgNVBAcMBU1pbGFuMSMwIQYDVQQKDBpBY3RhbGlzIFMucC5BLi8w\r\n' +
    'MzM1ODUyMDk2NzEnMCUGA1UEAwweQWN0YWxpcyBBdXRoZW50aWNhdGlvbiBSb290\r\n' +
    'IENBMB4XDTExMDkyMjExMjIwMloXDTMwMDkyMjExMjIwMlowazELMAkGA1UEBhMC\r\n' +
    'SVQxDjAMBgNVBAcMBU1pbGFuMSMwIQYDVQQKDBpBY3RhbGlzIFMucC5BLi8wMzM1\r\n' +
    'ODUyMDk2NzEnMCUGA1UEAwweQWN0YWxpcyBBdXRoZW50aWNhdGlvbiBSb290IENB\r\n' +
    'MIICIjANBgkqhkiG9w0BAQEFAAOCAg8AMIICCgKCAgEAp8bEpSmkLO/lGMWwUKNv\r\n' +
    'UTufClrJwkg4CsIcoBh/kbWHuUA/3R1oHwiD1S0eiKD4j1aPbZkCkpAW1V8IbInX\r\n' +
    '4ay8IMKx4INRimlNAJZaby/ARH6jDuSRzVju3PvHHkVH3Se5CAGfpiEd9UEtL0z9\r\n' +
    'KK3giq0itFZljoZUj5NDKd45RnijMCO6zfB9E1fAXdKDa0hMxKufgFpbOr3JpyI/\r\n' +
    'gCczWw63igxdBzcIy2zSekciRDXFzMwujt0q7bd9Zg1fYVEiVRvjRuPjPdA1Yprb\r\n' +
    'rxTIW6HMiRvhMCb8oJsfgadHHwTrozmSBp+Z07/T6k9QnBn+locePGX2oxgkg4YQ\r\n' +
    '51Q+qDp2JE+BIcXjDwL4k5RHILv+1A7TaLndxHqEguNTVHnd25zS8gebLra8Pu2F\r\n' +
    'be8lEfKXGkJh90qX6IuxEAf6ZYGyojnP9zz/GPvG8VqLWeICrHuS0E4UT1lF9gxe\r\n' +
    'KF+w6D9Fz8+vm2/7hNN3WpVvrJSEnu68wEqPSpP4RCHiMUVhUE4Q2OM1fEwZtN4F\r\n' +
    'v6MGn8i1zeQf1xcGDXqVdFUNaBr8EBtiZJ1t4JWgw5QHVw0U5r0F+7if5t+L4sbn\r\n' +
    'fpb2U8WANFAoWPASUHEXMLrmeGO89LKtmyuy/uE5jF66CyCU3nuDuP/jVo23Eek7\r\n' +
    'jPKxwV2dpAtMK9myGPW1n0sCAwEAAaNjMGEwHQYDVR0OBBYEFFLYiDrIn3hm7Ynz\r\n' +
    'ezhwlMkCAjbQMA8GA1UdEwEB/wQFMAMBAf8wHwYDVR0jBBgwFoAUUtiIOsifeGbt\r\n' +
    'ifN7OHCUyQICNtAwDgYDVR0PAQH/BAQDAgEGMA0GCSqGSIb3DQEBCwUAA4ICAQAL\r\n' +
    'e3KHwGCmSUyIWOYdiPcUZEim2FgKDk8TNd81HdTtBjHIgT5q1d07GjLukD0R0i70\r\n' +
    'jsNjLiNmsGe+b7bAEzlgqqI0JZN1Ut6nna0Oh4lScWoWPBkdg/iaKWW+9D+a2fDz\r\n' +
    'WochcYBNy+A4mz+7+uAwTc+G02UQGRjRlwKxK3JCaKygvU5a2hi/a5iB0P2avl4V\r\n' +
    'SM0RFbnAKVy06Ij3Pjaut2L9HmLecHgQHEhb2rykOLpn7VU+Xlff1ANATIGk0k9j\r\n' +
    'pwlCCRT8AKnCgHNPLsBA2RF7SOp6AsDT6ygBJlh0wcBzIm2Tlf05fbsq4/aC4yyX\r\n' +
    'X04fkZT6/iyj2HYauE2yOE+b+h1IYHkm4vP9qdCa6HCPSXrW5b0KDtst842/6+Ok\r\n' +
    'fcvHlXHo2qN8xcL4dJIEG4aspCJTQLas/kx2z/uUMsA1n3Y/buWQbqCmJqK4LL7R\r\n' +
    'K4X9p2jIugErsWx0Hbhzlefut8cl8ABMALJ+tguLHPPAUJ4lueAI3jZm/zel0btU\r\n' +
    'ZCzJJ7VLkn5l/9Mt4blOvH+kQSGQQXemOR/qnuOf0GZvBeyqdn6/axag67XH/JJU\r\n' +
    'LysRJyU3eExRarDzzFhdFPFqSBX/wge2sY0PjlxQRrM9vwGYT7JZVEc+NHt4bVaT\r\n' +
    'LnPqZih4zR0Uv6CPLy64Lo7yFIrM6bV8+2ydDKXhlg==\r\n' +
    '-----END CERTIFICATE-----\r\n',

    // Go Daddy Class 2 Certification Authority
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIEADCCAuigAwIBAgIBADANBgkqhkiG9w0BAQUFADBjMQswCQYDVQQGEwJVUzEh\r\n' +
    'MB8GA1UEChMYVGhlIEdvIERhZGR5IEdyb3VwLCBJbmMuMTEwLwYDVQQLEyhHbyBE\r\n' +
    'YWRkeSBDbGFzcyAyIENlcnRpZmljYXRpb24gQXV0aG9yaXR5MB4XDTA0MDYyOTE3\r\n' +
    'MDYyMFoXDTM0MDYyOTE3MDYyMFowYzELMAkGA1UEBhMCVVMxITAfBgNVBAoTGFRo\r\n' +
    'ZSBHbyBEYWRkeSBHcm91cCwgSW5jLjExMC8GA1UECxMoR28gRGFkZHkgQ2xhc3Mg\r\n' +
    'MiBDZXJ0aWZpY2F0aW9uIEF1dGhvcml0eTCCASAwDQYJKoZIhvcNAQEBBQADggEN\r\n' +
    'ADCCAQgCggEBAN6d1+pXGEmhW+vXX0iG6r7d/+TvZxz0ZWizV3GgXne77ZtJ6XCA\r\n' +
    'PVYYYwhv2vLM0D9/AlQiVBDYsoHUwHU9S3/Hd8M+eKsaA7Ugay9qK7HFiH7Eux6w\r\n' +
    'wdhFJ2+qN1j3hybX2C32qRe3H3I2TqYXP2WYktsqbl2i/ojgC95/5Y0V4evLOtXi\r\n' +
    'EqITLdiOr18SPaAIBQi2XKVlOARFmR6jYGB0xUGlcmIbYsUfb18aQr4CUWWoriMY\r\n' +
    'avx4A6lNf4DD+qta/KFApMoZFv6yyO9ecw3ud72a9nmYvLEHZ6IVDd2gWMZEewo+\r\n' +
    'YihfukEHU1jPEX44dMX4/7VpkI+EdOqXG68CAQOjgcAwgb0wHQYDVR0OBBYEFNLE\r\n' +
    'sNKR1EwRcbNhyz2h/t2oatTjMIGNBgNVHSMEgYUwgYKAFNLEsNKR1EwRcbNhyz2h\r\n' +
    '/t2oatTjoWekZTBjMQswCQYDVQQGEwJVUzEhMB8GA1UEChMYVGhlIEdvIERhZGR5\r\n' +
    'IEdyb3VwLCBJbmMuMTEwLwYDVQQLEyhHbyBEYWRkeSBDbGFzcyAyIENlcnRpZmlj\r\n' +
    'YXRpb24gQXV0aG9yaXR5ggEAMAwGA1UdEwQFMAMBAf8wDQYJKoZIhvcNAQEFBQAD\r\n' +
    'ggEBADJL87LKPpH8EsahB4yOd6AzBhRckB4Y9wimPQoZ+YeAEW5p5JYXMP80kWNy\r\n' +
    'OO7MHAGjHZQopDH2esRU1/blMVgDoszOYtuURXO1v0XJJLXVggKtI3lpjbi2Tc7P\r\n' +
    'TMozI+gciKqdi0FuFskg5YmezTvacPd+mSYgFFQlq25zheabIZ0KbIIOqPjCDPoQ\r\n' +
    'HmyW74cNxA9hi63ugyuV+I6ShHI56yDqg+2DzZduCLzrTia2cyvk0/ZM/iZx4mER\r\n' +
    'dEr/VxqHD3VILs9RaRegAhJhldXRQLIQTO7ErBBDpqWeCtWVYpoNz4iCxTIM5Cuf\r\n' +
    'ReYNnyicsbkqWletNw+vHX/bvZ8=\r\n' +
    '-----END CERTIFICATE-----\r\n',

    // GlobalSign Root CA - R2
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIDujCCAqKgAwIBAgILBAAAAAABD4Ym5g0wDQYJKoZIhvcNAQEFBQAwTDEgMB4G\r\n' +
    'A1UECxMXR2xvYmFsU2lnbiBSb290IENBIC0gUjIxEzARBgNVBAoTCkdsb2JhbFNp\r\n' +
    'Z24xEzARBgNVBAMTCkdsb2JhbFNpZ24wHhcNMDYxMjE1MDgwMDAwWhcNMjExMjE1\r\n' +
    'MDgwMDAwWjBMMSAwHgYDVQQLExdHbG9iYWxTaWduIFJvb3QgQ0EgLSBSMjETMBEG\r\n' +
    'A1UEChMKR2xvYmFsU2lnbjETMBEGA1UEAxMKR2xvYmFsU2lnbjCCASIwDQYJKoZI\r\n' +
    'hvcNAQEBBQADggEPADCCAQoCggEBAKbPJA6+Lm8omUVCxKs+IVSbC9N/hHD6ErPL\r\n' +
    'v4dfxn+G07IwXNb9rfF73OX4YJYJkhD10FPe+3t+c4isUoh7SqbKSaZeqKeMWhG8\r\n' +
    'eoLrvozps6yWJQeXSpkqBy+0Hne/ig+1AnwblrjFuTosvNYSuetZfeLQBoZfXklq\r\n' +
    'tTleiDTsvHgMCJiEbKjNS7SgfQx5TfC4LcshytVsW33hoCmEofnTlEnLJGKRILzd\r\n' +
    'C9XZzPnqJworc5HGnRusyMvo4KD0L5CLTfuwNhv2GXqF4G3yYROIXJ/gkwpRl4pa\r\n' +
    'zq+r1feqCapgvdzZX99yqWATXgAByUr6P6TqBwMhAo6CygPCm48CAwEAAaOBnDCB\r\n' +
    'mTAOBgNVHQ8BAf8EBAMCAQYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUm+IH\r\n' +
    'V2ccHsBqBt5ZtJot39wZhi4wNgYDVR0fBC8wLTAroCmgJ4YlaHR0cDovL2NybC5n\r\n' +
    'bG9iYWxzaWduLm5ldC9yb290LXIyLmNybDAfBgNVHSMEGDAWgBSb4gdXZxwewGoG\r\n' +
    '3lm0mi3f3BmGLjANBgkqhkiG9w0BAQUFAAOCAQEAmYFThxxol4aR7OBKuEQLq4Gs\r\n' +
    'J0/WwbgcQ3izDJr86iw8bmEbTUsp9Z8FHSbBuOmDAGJFtqkIk7mpM0sYmsL4h4hO\r\n' +
    '291xNBrBVNpGP+DTKqttVCL1OmLNIG+6KYnX3ZHu01yiPqFbQfXf5WRDLenVOavS\r\n' +
    'ot+3i9DAgBkcRcAtjOj4LaR0VknFBbVPFd5uRHg5h6h+u/N5GJG79G+dwfCMNYxd\r\n' +
    'AfvDbbnvRG15RjF+Cv6pgsH/76tuIMRQyV+dTZsXjAzlAcmgQWpzU/qlULRuJQ/7\r\n' +
    'TBj0/VLZjmmx6BEP3ojY+x1J96relc8geMJgEtslQIxq/H5COEBkEveegeGTLg==\r\n' +
    '-----END CERTIFICATE-----\r\n',

    // Baltimore CyberTrust Root
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIDdzCCAl+gAwIBAgIEAgAAuTANBgkqhkiG9w0BAQUFADBaMQswCQYDVQQGEwJJ\r\n' +
    'RTESMBAGA1UEChMJQmFsdGltb3JlMRMwEQYDVQQLEwpDeWJlclRydXN0MSIwIAYD\r\n' +
    'VQQDExlCYWx0aW1vcmUgQ3liZXJUcnVzdCBSb290MB4XDTAwMDUxMjE4NDYwMFoX\r\n' +
    'DTI1MDUxMjIzNTkwMFowWjELMAkGA1UEBhMCSUUxEjAQBgNVBAoTCUJhbHRpbW9y\r\n' +
    'ZTETMBEGA1UECxMKQ3liZXJUcnVzdDEiMCAGA1UEAxMZQmFsdGltb3JlIEN5YmVy\r\n' +
    'VHJ1c3QgUm9vdDCCASIwDQYJKoZIhvcNAQEBBQADggEPADCCAQoCggEBAKMEuyKr\r\n' +
    'mD1X6CZymrV51Cni4eiVgLGw41uOKymaZN+hXe2wCQVt2yguzmKiYv60iNoS6zjr\r\n' +
    'IZ3AQSsBUnuId9Mcj8e6uYi1agnnc+gRQKfRzMpijS3ljwumUNKoUMMo6vWrJYeK\r\n' +
    'mpYcqWe4PwzV9/lSEy/CG9VwcPCPwBLKBsua4dnKM3p31vjsufFoREJIE9LAwqSu\r\n' +
    'XmD+tqYF/LTdB1kC1FkYmGP1pWPgkAx9XbIGevOF6uvUA65ehD5f/xXtabz5OTZy\r\n' +
    'dc93Uk3zyZAsuT3lySNTPx8kmCFcB5kpvcY67Oduhjprl3RjM71oGDHweI12v/ye\r\n' +
    'jl0qhqdNkNwnGjkCAwEAAaNFMEMwHQYDVR0OBBYEFOWdWTCCR1jMrPoIVDaGezq1\r\n' +
    'BE3wMBIGA1UdEwEB/wQIMAYBAf8CAQMwDgYDVR0PAQH/BAQDAgEGMA0GCSqGSIb3\r\n' +
    'DQEBBQUAA4IBAQCFDF2O5G9RaEIFoN27TyclhAO992T9Ldcw46QQF+vaKSm2eT92\r\n' +
    '9hkTI7gQCvlYpNRhcL0EYWoSihfVCr3FvDB81ukMJY2GQE/szKN+OMY3EU/t3Wgx\r\n' +
    'jkzSswF07r51XgdIGn9w/xZchMB5hbgF/X++ZRGjD8ACtPhSNzkE1akxehi/oCr0\r\n' +
    'Epn3o0WC4zxe9Z2etciefC7IpJ5OCBRLbf1wbWsaY71k5h+3zvDyny67G7fyUIhz\r\n' +
    'ksLi4xaNmjICq44Y3ekQEe5+NauQrz4wlHrQMz2nZQ/1/I6eYs9HRCwBXbsdtTLS\r\n' +
    'R9I4LtD+gdwyah617jzV/OeBHRnDJELqYzmp\r\n' +
    '-----END CERTIFICATE-----\r\n',

    // GlobalSign Root CA - R1
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIDdTCCAl2gAwIBAgILBAAAAAABFUtaw5QwDQYJKoZIhvcNAQEFBQAwVzELMAkG\r\n' +
    'A1UEBhMCQkUxGTAXBgNVBAoTEEdsb2JhbFNpZ24gbnYtc2ExEDAOBgNVBAsTB1Jv\r\n' +
    'b3QgQ0ExGzAZBgNVBAMTEkdsb2JhbFNpZ24gUm9vdCBDQTAeFw05ODA5MDExMjAw\r\n' +
    'MDBaFw0yODAxMjgxMjAwMDBaMFcxCzAJBgNVBAYTAkJFMRkwFwYDVQQKExBHbG9i\r\n' +
    'YWxTaWduIG52LXNhMRAwDgYDVQQLEwdSb290IENBMRswGQYDVQQDExJHbG9iYWxT\r\n' +
    'aWduIFJvb3QgQ0EwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIBAQDaDuaZ\r\n' +
    'jc6j40+Kfvvxi4Mla+pIH/EqsLmVEQS98GPR4mdmzxzdzxtIK+6NiY6arymAZavp\r\n' +
    'xy0Sy6scTHAHoT0KMM0VjU/43dSMUBUc71DuxC73/OlS8pF94G3VNTCOXkNz8kHp\r\n' +
    '1Wrjsok6Vjk4bwY8iGlbKk3Fp1S4bInMm/k8yuX9ifUSPJJ4ltbcdG6TRGHRjcdG\r\n' +
    'snUOhugZitVtbNV4FpWi6cgKOOvyJBNPc1STE4U6G7weNLWLBYy5d4ux2x8gkasJ\r\n' +
    'U26Qzns3dLlwR5EiUWMWea6xrkEmCMgZK9FGqkjWZCrXgzT/LCrBbBlDSgeF59N8\r\n' +
    '9iFo7+ryUp9/k5DPAgMBAAGjQjBAMA4GA1UdDwEB/wQEAwIBBjAPBgNVHRMBAf8E\r\n' +
    'BTADAQH/MB0GA1UdDgQWBBRge2YaRQ2XyolQL30EzTSo//z9SzANBgkqhkiG9w0B\r\n' +
    'AQUFAAOCAQEA1nPnfE920I2/7LqivjTFKDK1fPxsnCwrvQmeU79rXqoRSLblCKOz\r\n' +
    'yj1hTdNGCbM+w6DjY1Ub8rrvrTnhQ7k4o+YviiY776BQVvnGCv04zcQLcFGUl5gE\r\n' +
    '38NflNUVyRRBnMRddWQVDf9VMOyGj/8N7yy5Y0b2qvzfvGn9LhJIZJrglfCm7ymP\r\n' +
    'AbEVtQwdpf5pLGkkeB6zpxxxYu7KyJesF12KwvhHhm4qxFYxldBniYUr+WymXUad\r\n' +
    'DKqC5JlR3XC321Y9YeRq4VzW9v493kHMB65jUr9TU/Qr6cf9tveCX4XSQRjbgbME\r\n' +
    'HMUfpIBvFSDJ3gyICh3WZlXi/EjJKSZp4A==\r\n' +
    '-----END CERTIFICATE-----\r\n',

    // DigiCert Root CA
    '-----BEGIN CERTIFICATE-----\r\n' +
    'MIIDrzCCApegAwIBAgIQCDvgVpBCRrGhdWrJWZHHSjANBgkqhkiG9w0BAQUFADBh\r\n' +
    'MQswCQYDVQQGEwJVUzEVMBMGA1UEChMMRGlnaUNlcnQgSW5jMRkwFwYDVQQLExB3\r\n' +
    'd3cuZGlnaWNlcnQuY29tMSAwHgYDVQQDExdEaWdpQ2VydCBHbG9iYWwgUm9vdCBD\r\n' +
    'QTAeFw0wNjExMTAwMDAwMDBaFw0zMTExMTAwMDAwMDBaMGExCzAJBgNVBAYTAlVT\r\n' +
    'MRUwEwYDVQQKEwxEaWdpQ2VydCBJbmMxGTAXBgNVBAsTEHd3dy5kaWdpY2VydC5j\r\n' +
    'b20xIDAeBgNVBAMTF0RpZ2lDZXJ0IEdsb2JhbCBSb290IENBMIIBIjANBgkqhkiG\r\n' +
    '9w0BAQEFAAOCAQ8AMIIBCgKCAQEA4jvhEXLeqKTTo1eqUKKPC3eQyaKl7hLOllsB\r\n' +
    'CSDMAZOnTjC3U/dDxGkAV53ijSLdhwZAAIEJzs4bg7/fzTtxRuLWZscFs3YnFo97\r\n' +
    'nh6Vfe63SKMI2tavegw5BmV/Sl0fvBf4q77uKNd0f3p4mVmFaG5cIzJLv07A6Fpt\r\n' +
    '43C/dxC//AH2hdmoRBBYMql1GNXRor5H4idq9Joz+EkIYIvUX7Q6hL+hqkpMfT7P\r\n' +
    'T19sdl6gSzeRntwi5m3OFBqOasv+zbMUZBfHWymeMr/y7vrTC0LUq7dBMtoM1O/4\r\n' +
    'gdW7jVg/tRvoSSiicNoxBN33shbyTApOB6jtSj1etX+jkMOvJwIDAQABo2MwYTAO\r\n' +
    'BgNVHQ8BAf8EBAMCAYYwDwYDVR0TAQH/BAUwAwEB/zAdBgNVHQ4EFgQUA95QNVbR\r\n' +
    'TLtm8KPiGxvDl7I90VUwHwYDVR0jBBgwFoAUA95QNVbRTLtm8KPiGxvDl7I90VUw\r\n' +
    'DQYJKoZIhvcNAQEFBQADggEBAMucN6pIExIK+t1EnE9SsPTfrgT1eXkIoyQY/Esr\r\n' +
    'hMAtudXH/vTBH1jLuG2cenTnmCmrEbXjcKChzUyImZOMkXDiqw8cvpOp/2PV5Adg\r\n' +
    '06O/nVsJ8dWO41P0jmP6P6fbtGbfYmbW0W5BjfIttep3Sp+dWOIrWcBAI+0tKIJF\r\n' +
    'PnlUkiaY4IBIqDfv8NZ5YBberOgOzW6sRBc4L0na4UU+Krk2U886UAb3LujEV0ls\r\n' +
    'YSEY1QSteDwsOoBrp+uvFRTp2InBuThs4pFsiv9kuXclVzDAGySj4dzp30d8tbQk\r\n' +
    'CAUw7C29C79Fv1C5qfPrmAESrciIxpg0X40KPMbp1ZWVbd4=\r\n' +
    '-----END CERTIFICATE-----\r\n'
];

// ////////////////////////////////////////////////////////////
// TLSSocket

export class TLSSocket extends EventTarget {
    constructor(options) {
        super();

        this._options = options;
        this._handle = options && options.handle;

        this.authorized = false;
        this.authorizationError = null;
        this.bytesRead = 0;
        this.bytesWritten = 0;
        this.encrypted = true;
        this.readyState = TLSSocket.CLOSED;
        this.timeout = undefined;

        if (this._handle) {
            this._setHandle(this._handle);
        }
    }

    get [Symbol.toStringTag]() {
        return 'TLSSocket';
    }

    get connecting() {
        return this.readyState == TLSSocket.CONNECTING;
    }

    get bufferedAmount() {
        const handle = this._handle;
        return handle?.bufferedAmount();
    }

    async connect(port, host) {
        if (this.readyState != TLSSocket.CLOSED) {
            return;

        } else if (!port) {
            return;
        }

        const self = this;
        async function lookup() {
            let options = null;
            if (typeof port == 'object') {
                options = port;

            } else if (typeof port == 'number') {
                options = { port, host };
            }

            const address = await dns.lookup(options.host, { family: 4 });
            if (Array.isArray(address)) {
                return;
            }

            address.port = options.port || 80;
            address.host = options.host;

            const event = new Event('lookup');
            // @ts-ignore
            event.address = address;
            self.dispatchEvent(event);

            return address;
        }

        try {
            this.readyState = TLSSocket.CONNECTING;

            if (this.timeout && this.timeout > 0) {
                this._connectTimeoutTimer = setTimeout(() => {
                    this.dispatchEvent(new Event('timeout'));
                }, this.timeout);
            }

            const address = await lookup();

            const options = { cacert: rootCertificates.join('') };
            const handle = new native.TLS(options);
            this._handle = handle;

            const client = this._handle;

            this._setHandle(client);

            // console.log('address', address);
            await client.connect(address);

            this.readyState = TLSSocket.OPEN;

            if (this._connectTimeoutTimer) {
                clearTimeout(this._connectTimeoutTimer);
                this._connectTimeoutTimer = null;
            }

            this.dispatchEvent(new Event('open'));

        } catch (error) {
            this.readyState = TLSSocket.CLOSED;

            if (this._connectTimeoutTimer) {
                clearTimeout(this._connectTimeoutTimer);
                this._connectTimeoutTimer = null;
            }

            this.dispatchEvent(new ErrorEvent('error', { error }));
            await this.close();
        }

        return this;
    }

    address() {
        const handle = this._handle;
        return handle?.address();
    }

    remoteAddress() {
        const handle = this._handle;
        return handle?.remoteAddress();
    }

    async close(code, reason) {
        const handle = this._handle;
        if (handle) {
            this._handle = null;

            await handle.close();
        }

        if (this.readyState != TLSSocket.CLOSED) {
            this.readyState = TLSSocket.CLOSED;

            this.dispatchEvent(new Event('close'));
        }

        return this;
    }

    async end(data, encoding) {
        if (data) {
            await this.write(data, encoding);
        }

        const handle = this._handle;
        if (!handle) {
            return this;
        }

        try {
            await handle.shutdown();

        } catch (error) {
            this.dispatchEvent(new ErrorEvent('error', { error }));
            await this.close(error);
        }

        return this;
    }

    setKeepAlive(enable = true, delay = 0) {
        const handle = this._handle;
        handle?.setKeepAlive(enable, delay);
        return this;
    }

    setNoDelay(enable = true) {
        const handle = this._handle;
        handle?.setNoDelay(enable);
        return this;
    }

    setTimeout(timeout) {
        this.timeout = Number.parseInt(timeout);
        return this;
    }

    async write(data, encoding) {
        if (!data) {
            return;
        }

        this.bytesWritten += data.byteLength || data.length || 0;

        const handle = this._handle;
        if (!handle) {
            return;
        }

        try {
            const result = await handle.write(data, encoding);
            return result;

        } catch (error) {
            self.dispatchEvent(new ErrorEvent('error', { error }));
            await this.close(error);
        }
    }

    _setHandle(handle) {
        const self = this;

        handle.onconnect = function () {
            self.dispatchEvent(new Event('connect'));
        };

        handle.onclose = function () {
            self.close();
        };

        handle.onerror = function (error) {
            self.dispatchEvent(new ErrorEvent('error', { error }));
        };

        handle.onmessage = function (message) {
            if (message) {
                self.bytesRead += message.byteLength || 0;
            }

            self.dispatchEvent(new MessageEvent('message', { data: message }));
        };

        handle.onopen = function (status) {
            if (status && status.error) {
                self.authorized = false;
                self.authorizationError = status.error;

            } else {
                self.authorized = true;
                self.authorizationError = null;
            }
        };
    }
}

/** 正在连接中 */
TLSSocket.CONNECTING = 0;

/** 已连接 */
TLSSocket.OPEN = 1;

/** 正在关闭连接 */
TLSSocket.CLOSING = 2;

/** 连接已关闭 */
TLSSocket.CLOSED = 3;

defineEventAttribute(TLSSocket.prototype, 'close');
defineEventAttribute(TLSSocket.prototype, 'connect');
defineEventAttribute(TLSSocket.prototype, 'error');
defineEventAttribute(TLSSocket.prototype, 'lookup');
defineEventAttribute(TLSSocket.prototype, 'message');
defineEventAttribute(TLSSocket.prototype, 'open');
defineEventAttribute(TLSSocket.prototype, 'timeout');

// ////////////////////////////////////////////////////////////
// TLSServer

export class TLSServer extends EventTarget {
    constructor(options) {
        super();

        this._options = options;
        this._handle = null;
        this.onconnection = null;
    }

    get [Symbol.toStringTag]() {
        return 'TLSServer';
    }

    async accept() {
        const handle = this._handle;
        const result = handle && await handle.accept();
        return result;
    }

    address() {
        return this._handle && this._handle.address();
    }

    listen(options, backlog) {
        if (!options) {
            return;
        }

        try {
            if (typeof options == 'string') {
                const name = options;
                const handle = new native.Pipe();
                handle.bind(name);
                this._handle = handle;

            } else {
                const address = options;
                const handle = new native.TCP();
                handle.bind(address);
                this._handle = handle;
            }

        } catch (error) {
            this.dispatchEvent(new ErrorEvent('error', { error }));
            this.close();
            return;
        }

        const self = this;
        const server = this._handle;
        server.onconnection = async function () {
            // console.log('connection');
            const connection = await server.accept();
            const event = new Event('connection');
            // @ts-ignore
            event.connection = new TLSSocket({ handle: connection, isServer: true, server });
            self.dispatchEvent(event);
        };

        server.onerror = function (error) {
            self.dispatchEvent(new ErrorEvent('error', { error }));
        };

        server.listen(backlog);
        this.dispatchEvent(new Event('listening'));
    }

    async close(code, reason) {
        const handle = this._handle;
        if (handle) {
            this._handle = null;

            await handle.close();
            this.dispatchEvent(new Event('close'));
        }
    }
}

defineEventAttribute(TLSServer.prototype, 'close');
defineEventAttribute(TLSServer.prototype, 'connection');
defineEventAttribute(TLSServer.prototype, 'error');
defineEventAttribute(TLSServer.prototype, 'listening');

// ////////////////////////////////////////////////////////////
// DTLSSocket

export class DTLSSocket extends EventTarget {
    constructor(handle) {
        super();

        this._handle = handle;
    }
    
    get [Symbol.toStringTag]() {
        return 'DTLSSocket';
    }
}

defineEventAttribute(DTLSSocket.prototype, 'data');

// ////////////////////////////////////////////////////////////
// functions

/**
 * Creates a TCP client
 * @param {number} port 
 * @param {string} host 
 * @returns {TLSSocket}
 */
export function connect(port, host) {
    const socket = new TLSSocket();
    setTimeout(async () => {
        await socket.connect(port, host);
    }, 0);

    return socket;
}

export const createConnection = connect;

/**
 * Creates a TCP server
 * @param {function} connectionListener 
 * @returns {TLSServer}
 */
export function createServer(connectionListener) {
    const server = new TLSServer();
    server.onconnection = connectionListener;
    return server;
}

/**
 * Creates a UDP socket.
 * @param {object} options options or type
 * @param {string} options.type The family of socket, `udp4` or `udp6`
 * @returns {DTLSSocket}
 */
export function createSocket(options) {
    if (typeof options != 'object') {
        const type = options;
        options = { type };
    }

    const socket = new native.UDP();

    return new DTLSSocket(socket);
}
