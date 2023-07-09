#ifndef _UV_UART_H
#define _UV_UART_H

/**
 * MRAA return codes
 */
typedef enum uart_result_codes {
    UART_SUCCESS = 0, /**< Expected response */
    UART_FEATURE_NOT_IMPLEMENTED = 1, /**< Feature TODO */
    UART_FEATURE_NOT_SUPPORTED = 2, /**< Feature not supported by HW */
    UART_INVALID_VERBOSITY_LEVEL = 3, /**< Verbosity level wrong */
    UART_INVALID_PARAMETER = 4, /**< Parameter invalid */
    UART_INVALID_HANDLE = 5, /**< Handle invalid */
    UART_NO_RESOURCES = 6, /**< No resource of that type avail */
    UART_INVALID_RESOURCE = 7, /**< Resource invalid */
    UART_INVALID_QUEUE_TYPE = 8, /**< Queue type incorrect */
    UART_NO_DATA_AVAILABLE = 9, /**< No data available */
    UART_INVALID_PLATFORM = 10, /**< Platform not recognised */
    UART_PLATFORM_NOT_INITIALISED = 11, /**< Board information not initialised */
    UART_UART_OW_SHORTED = 12, /**< UART OW Short Circuit Detected*/
    UART_UART_OW_NO_DEVICES = 13, /**< UART OW No devices detected */
    UART_UART_OW_DATA_ERROR = 14, /**< UART OW Data/Bus error detected */

    UART_UNSPECIFIED = 99 /**< Unknown Error */
} uart_result_t;

/**
 * Enum representing different uart parity states
 */
typedef enum uart_parity_e {
    UART_PARITY_NONE = 'N',
    UART_PARITY_EVEN = 'E',
    UART_PARITY_ODD = 'O',
    UART_PARITY_MARK = 'M',
    UART_PARITY_SPACE = 'S'
} uart_parity_t;

int uart_flush(int fd);
int uart_open(const char* device);
int uart_read(int fd, unsigned char* buf, size_t len);
int uart_set_baudrate(int fd, unsigned int baud);
int uart_set_flow_control(int fd, int xonxoff, int rtscts);
int uart_set_mode(int fd, int bytesize, uart_parity_t parity, int stopbits);
int uart_set_non_blocking(int fd, int nonblock);
int uart_set_options(int fd, int baud, int parity, int data_bit, int stop_bit);
int uart_set_timeout(int fd, int read, int write, int interchar);
int uart_wait(int fd, unsigned int millis);
int uart_write(int fd, const unsigned char* buf, size_t len);

#endif // _UV_UART_H
