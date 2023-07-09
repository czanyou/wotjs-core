#include <errno.h>
#include <fcntl.h>
#include <stdlib.h>
#include <string.h>
#include <unistd.h>

#if defined(__linux__) || defined(__linux)
#include <sys/ioctl.h>
#include <sys/select.h>
#include <sys/stat.h>
#include <syslog.h>
#include <termios.h>
#endif

#include "private.h"
#include "utils.h"

/**
 * MRAA return codes
 */
typedef enum tjs_uart_result_codes {
    TJS_UART_SUCCESS = 0, /**< Expected response */
    TJS_UART_FEATURE_NOT_IMPLEMENTED = 1, /**< Feature TODO */
    TJS_UART_FEATURE_NOT_SUPPORTED = 2, /**< Feature not supported by HW */
    TJS_UART_INVALID_VERBOSITY_LEVEL = 3, /**< Verbosity level wrong */
    TJS_UART_INVALID_PARAMETER = 4, /**< Parameter invalid */
    TJS_UART_INVALID_HANDLE = 5, /**< Handle invalid */
    TJS_UART_NO_RESOURCES = 6, /**< No resource of that type avail */
    TJS_UART_INVALID_RESOURCE = 7, /**< Resource invalid */
    TJS_UART_INVALID_QUEUE_TYPE = 8, /**< Queue type incorrect */
    TJS_UART_NO_DATA_AVAILABLE = 9, /**< No data available */
    TJS_UART_INVALID_PLATFORM = 10, /**< Platform not recognised */
    TJS_UART_PLATFORM_NOT_INITIALISED = 11, /**< Board information not initialised */
    TJS_UART_UART_OW_SHORTED = 12, /**< UART OW Short Circuit Detected*/
    TJS_UART_UART_OW_NO_DEVICES = 13, /**< UART OW No devices detected */
    TJS_UART_UART_OW_DATA_ERROR = 14, /**< UART OW Data/Bus error detected */

    TJS_UART_UNSPECIFIED = 99 /**< Unknown Error */
} tjs_uart_result_t;

/**
 * Enum representing different uart parity states
 */
typedef enum tjs_uart_parity_e {
    TJS_UART_PARITY_NONE = 'N',
    TJS_UART_PARITY_EVEN = 'E',
    TJS_UART_PARITY_ODD = 'O',
    TJS_UART_PARITY_MARK = 'M',
    TJS_UART_PARITY_SPACE = 'S'
} tjs_uart_parity_t;

/* Events */
enum tjs_uart_events {
    TJS_UART_EVENT_CLOSE = 0,
    TJS_UART_EVENT_DISCONNECT,
    TJS_UART_EVENT_OPEN,
    TJS_UART_EVENT_ERROR,
    TJS_UART_EVENT_MESSAGE,
    TJS_UART_EVENT_MAX,
};

typedef struct tjs_uart_t {
    JSContext* ctx;
    int readStart;
    int closed;
    int fd;
    int finalized;

    uv_poll_t pollHandle;
    JSValue events[TJS_UART_EVENT_MAX];
    DynBuf readBuffer;
} TJSUart;

static JSClassID tjs_uart_class_id;
static tjs_uart_result_t tjs__uart_set_baudrate(int fd, unsigned int baud);

#if defined(__linux__) || defined(__linux)

#ifndef CMSPAR
#define CMSPAR 010000000000
#endif

// This function takes an unsigned int and converts it to a B* speed_t
// that can be used with linux/posix termios
static speed_t tjs__uart_uint_to_speed(unsigned int speed)
{
    switch (speed) {
    case 0:
        return B0; // hangup, not too useful otherwise
    case 50:
        return B50;
    case 75:
        return B75;
    case 110:
        return B110;
    case 150:
        return B150;
    case 200:
        return B200;
    case 300:
        return B300;
    case 600:
        return B600;
    case 1200:
        return B1200;
    case 1800:
        return B1800;
    case 2400:
        return B2400;
    case 4800:
        return B4800;
    case 9600:
        return B9600;
    case 19200:
        return B19200;
    case 38400:
        return B38400;
    case 57600:
        return B57600;
    case 115200:
        return B115200;
    case 230400:
        return B230400;
    case 460800:
        return B460800;
    case 500000:
        return B500000;
    case 576000:
        return B576000;
    case 921600:
        return B921600;
    case 1000000:
        return B1000000;
    case 1152000:
        return B1152000;
    case 1500000:
        return B1500000;
    case 2000000:
        return B2000000;
    case 2500000:
        return B2500000;
    case 3000000:
        return B3000000;
#if !defined(MSYS)
    case 3500000:
        return B3500000;
    case 4000000:
        return B4000000;
#endif
    default:
        // if we are here, then an unsupported baudrate was selected.
        return B0;
    }
}

static unsigned int tjs__uart_speed_to_uint(speed_t speedt)
{
    struct baud_table {
        speed_t speedt;
        unsigned int baudrate;
    };

    static const struct baud_table bauds[] = {
        { B50, 50 },
        { B75, 75 },
        { B110, 110 },
        { B150, 150 },
        { B200, 200 },
        { B300, 300 },
        { B600, 600 },
        { B1200, 1200 },
        { B1800, 1800 },
        { B2400, 2400 },
        { B9600, 9600 },
        { B19200, 19200 },
        { B38400, 38400 },
        { B57600, 57600 },
        { B115200, 115200 },
        { B230400, 230400 },
        { B460800, 460800 },
        { B500000, 500000 },
        { B576000, 576000 },
        { B921600, 921600 },
        { B1000000, 1000000 },
        { B1152000, 1152000 },
        { B1500000, 1500000 },
        { B2000000, 2000000 },
        { B2500000, 2500000 },
        { B3000000, 3000000 },
#if !defined(MSYS)
        { B3500000, 3500000 },
        { B4000000, 4000000 },
#endif
        { B0, 0 } /* Must be last in this table */
    };
    int i = 0;

    while (bauds[i].baudrate > 0) {
        if (speedt == bauds[i].speedt) {
            return bauds[i].baudrate;
        }
        i++;
    }
    return 0;
}

tjs_uart_result_t tjs__uart_init(int fd)
{
    tjs_uart_result_t status = TJS_UART_SUCCESS;

    // now setup the tty and the selected baud rate
    struct termios termio;

    // get current modes
    if (tcgetattr(fd, &termio)) {
        syslog(LOG_ERR, "uart: tcgetattr(%d) failed: %s", fd, strerror(errno));
        status = TJS_UART_INVALID_RESOURCE;
        goto init_raw_cleanup;
    }

    // setup for a 'raw' mode.  8N1, no echo or special character
    // handling, such as flow control or line editing semantics.
    // cfmakeraw is not POSIX!
    cfmakeraw(&termio);
    if (tcsetattr(fd, TCSAFLUSH, &termio) < 0) {
        syslog(LOG_ERR, "uart: tcsetattr(%d) failed after cfmakeraw(): %s", fd, strerror(errno));
        status = TJS_UART_INVALID_RESOURCE;
        goto init_raw_cleanup;
    }

    if (tjs__uart_set_baudrate(fd, 9600) != TJS_UART_SUCCESS) {
        status = TJS_UART_INVALID_RESOURCE;
        goto init_raw_cleanup;
    }

init_raw_cleanup:
    return 0;
}

static tjs_uart_result_t tjs__uart_flush(int fd)
{
    if (fd <= 0) {
        syslog(LOG_ERR, "uart: flush: context is NULL");
        return TJS_UART_INVALID_HANDLE;
    }

#if !defined(PERIPHERALMAN)
    if (tcdrain(fd) == -1) {
        return TJS_UART_FEATURE_NOT_SUPPORTED;
    }
#endif

    return TJS_UART_SUCCESS;
}

static tjs_uart_result_t tjs__uart_open(const char* device)
{
    int flags;
    int debug = 0;

    /* The O_NOCTTY flag tells UNIX that this program doesn't want
       to be the "controlling terminal" for that port. If you
       don't specify this then any input (such as keyboard abort
       signals and so forth) will affect your process

       Timeouts are ignored in canonical input mode or when the
       NDELAY option is set on the file via open or fcntl */
    flags = O_RDWR | O_NOCTTY | O_NDELAY | O_EXCL;
#ifdef O_CLOEXEC // 防止在 exec 后被子进程继承
    flags |= O_CLOEXEC;
#endif

    int fd = open(device, flags);
    if (fd == -1) {
        if (debug) {
            fprintf(stderr, "ERROR Can't open the device %s (%s)\n",
                device, strerror(errno));
        }
        return -1;
    }

    return fd;
}

static int tjs__uart_read(int fd, char* buf, size_t len)
{
    if (fd < 0) {
        syslog(LOG_ERR, "uart%i: read: port is not open", fd);
        return TJS_UART_INVALID_RESOURCE;
    }

    return read(fd, buf, len);
}

static tjs_uart_result_t tjs__uart_sendbreak(int fd, int duration)
{
#if !defined(PERIPHERALMAN)
    if (tcsendbreak(fd, duration) == -1) {
        return TJS_UART_INVALID_PARAMETER;
    }
#endif

    return TJS_UART_SUCCESS;
}

static tjs_uart_result_t tjs__uart_set_baudrate(int fd, unsigned int baud)
{
    if (fd <= 0) {
        syslog(LOG_ERR, "uart: set_baudrate: context is NULL");
        return TJS_UART_INVALID_HANDLE;
    }

    struct termios termio;
    if (tcgetattr(fd, &termio)) {
        syslog(LOG_ERR, "uart%i: set_baudrate: tcgetattr() failed: %s", fd, strerror(errno));
        return TJS_UART_INVALID_RESOURCE;
    }

    // set our baud rates
    speed_t speed = tjs__uart_uint_to_speed(baud);
    if (speed == B0) {
        syslog(LOG_ERR, "uart%i: set_baudrate: invalid baudrate: %i", fd, baud);
        return TJS_UART_INVALID_PARAMETER;
    }
    cfsetispeed(&termio, speed);
    cfsetospeed(&termio, speed);

    // make it so
    if (tcsetattr(fd, TCSAFLUSH, &termio) < 0) {
        syslog(LOG_ERR, "uart%i: set_baudrate: tcsetattr() failed: %s", fd, strerror(errno));
        return TJS_UART_FEATURE_NOT_SUPPORTED;
    }
    return TJS_UART_SUCCESS;
}

static tjs_uart_result_t tjs__uart_set_flowcontrol(int fd, int xonxoff, int rtscts)
{
    if (fd <= 0) {
        syslog(LOG_ERR, "uart: set_flowcontrol: context is NULL");
        return TJS_UART_INVALID_HANDLE;
    }

    if (rtscts) {
    }

    // hardware flow control
    int action = TCIOFF;
    if (xonxoff) {
        action = TCION;
    }
    if (tcflow(fd, action)) {
        return TJS_UART_FEATURE_NOT_SUPPORTED;
    }

    // rtscts
    struct termios termio;

    // get current modes
    if (tcgetattr(fd, &termio)) {
        syslog(LOG_ERR, "uart%i: set_flowcontrol: tcgetattr() failed: %s", fd, strerror(errno));
        return TJS_UART_INVALID_RESOURCE;
    }

    if (rtscts) {
        termio.c_cflag |= CRTSCTS;
    } else {
        termio.c_cflag &= ~CRTSCTS;
    }

    if (tcsetattr(fd, TCSAFLUSH, &termio) < 0) {
        syslog(LOG_ERR, "uart%i: set_flowcontrol: tcsetattr() failed: %s", fd, strerror(errno));
        return TJS_UART_FEATURE_NOT_SUPPORTED;
    }

    return TJS_UART_SUCCESS;
}

static tjs_uart_result_t tjs__uart_set_mode(int fd, int bytesize, tjs_uart_parity_t parity, int stopbits)
{
    if (fd <= 0) {
        syslog(LOG_ERR, "uart: set_mode: context is NULL");
        return TJS_UART_INVALID_HANDLE;
    }

    struct termios termio;
    if (tcgetattr(fd, &termio)) {
        syslog(LOG_ERR, "uart%i: set_mode: tcgetattr() failed: %s", fd, strerror(errno));
        return TJS_UART_INVALID_RESOURCE;
    }

    termio.c_cflag &= ~CSIZE;
    switch (bytesize) {
    case 8:
        termio.c_cflag |= CS8;
        break;
    case 7:
        termio.c_cflag |= CS7;
        break;
    case 6:
        termio.c_cflag |= CS6;
        break;
    case 5:
        termio.c_cflag |= CS5;
        break;
    default:
        termio.c_cflag |= CS8;
        break;
    }

    // POSIX & linux doesn't support 1.5 and I've got bigger fish to fry
    switch (stopbits) {
    case 1:
        termio.c_cflag &= ~CSTOPB;
        break;
    case 2:
        termio.c_cflag |= CSTOPB;
    default:
        break;
    }

    switch (parity) {
    case TJS_UART_PARITY_NONE:
        termio.c_cflag &= ~(PARENB | PARODD);
        break;
    case TJS_UART_PARITY_EVEN:
        termio.c_cflag |= PARENB;
        termio.c_cflag &= ~PARODD;
        break;
    case TJS_UART_PARITY_ODD:
        termio.c_cflag |= PARENB | PARODD;
        break;
    case TJS_UART_PARITY_MARK: // not POSIX
        termio.c_cflag |= PARENB | CMSPAR | PARODD;
        break;
    case TJS_UART_PARITY_SPACE: // not POSIX
        termio.c_cflag |= PARENB | CMSPAR;
        termio.c_cflag &= ~PARODD;
        break;
    }

    if (tcsetattr(fd, TCSAFLUSH, &termio) < 0) {
        syslog(LOG_ERR, "uart%i: set_mode: tcsetattr() failed: %s", fd, strerror(errno));
        return TJS_UART_FEATURE_NOT_SUPPORTED;
    }

    return TJS_UART_SUCCESS;
}

static tjs_uart_result_t tjs__uart_set_non_blocking(int fd, int nonblock)
{
    // get current flags
    int flags = fcntl(fd, F_GETFL);

    // update flags with new blocking state according to nonblock bool
    if (nonblock) {
        flags |= O_NONBLOCK;
    } else {
        flags &= ~O_NONBLOCK;
    }

    // set new flags
    if (fcntl(fd, F_SETFL, flags) < 0) {
        syslog(LOG_ERR, "uart%i: non_blocking: failed changing fd blocking state: %s", fd, strerror(errno));
        return TJS_UART_UNSPECIFIED;
    }

    return TJS_UART_SUCCESS;
}

static tjs_uart_result_t tjs__uart_set_timeout(int fd, int read, int write, int interchar)
{
    if (fd <= 0) {
        syslog(LOG_ERR, "uart: set_timeout: context is NULL");
        return TJS_UART_INVALID_HANDLE;
    }

    struct termios termio;
    // get current modes
    if (tcgetattr(fd, &termio)) {
        syslog(LOG_ERR, "uart%i: set_timeout: tcgetattr() failed: %s", fd, strerror(errno));
        return TJS_UART_INVALID_RESOURCE;
    }
    if (read > 0) {
        read = read / 100;
        if (read == 0)
            read = 1;
    }
    termio.c_lflag &= ~ICANON; /* Set non-canonical mode */
    termio.c_cc[VTIME] = read; /* Set timeout in tenth seconds */
    if (tcsetattr(fd, TCSANOW, &termio) < 0) {
        syslog(LOG_ERR, "uart%i: set_timeout: tcsetattr() failed: %s", fd, strerror(errno));
        return TJS_UART_FEATURE_NOT_SUPPORTED;
    }

    return TJS_UART_SUCCESS;
}

/* Sets up a serial port for RTU communications */
static tjs_uart_result_t tjs__uart_set_options(int fd, int baud, int parity, int data_bit, int stop_bit)
{
    struct termios tios;
    speed_t speed;
    int debug = 0;

    if (debug) {
        printf("Set uart as %d (%c, %d, %d)\n", baud, parity, data_bit, stop_bit);
    }

    /* Save */
    // tcgetattr(fd, &ctx_rtu->old_tios);

    memset(&tios, 0, sizeof(struct termios));

    /* C_ISPEED     Input baud (new interface)
       C_OSPEED     Output baud (new interface)
    */
    switch (baud) {
    case 110:
        speed = B110;
        break;
    case 300:
        speed = B300;
        break;
    case 600:
        speed = B600;
        break;
    case 1200:
        speed = B1200;
        break;
    case 2400:
        speed = B2400;
        break;
    case 4800:
        speed = B4800;
        break;
    case 9600:
        speed = B9600;
        break;
    case 19200:
        speed = B19200;
        break;
    case 38400:
        speed = B38400;
        break;
#ifdef B57600
    case 57600:
        speed = B57600;
        break;
#endif
#ifdef B115200
    case 115200:
        speed = B115200;
        break;
#endif
#ifdef B230400
    case 230400:
        speed = B230400;
        break;
#endif
#ifdef B460800
    case 460800:
        speed = B460800;
        break;
#endif
#ifdef B500000
    case 500000:
        speed = B500000;
        break;
#endif
#ifdef B576000
    case 576000:
        speed = B576000;
        break;
#endif
#ifdef B921600
    case 921600:
        speed = B921600;
        break;
#endif
#ifdef B1000000
    case 1000000:
        speed = B1000000;
        break;
#endif
#ifdef B1152000
    case 1152000:
        speed = B1152000;
        break;
#endif
#ifdef B1500000
    case 1500000:
        speed = B1500000;
        break;
#endif
#ifdef B2500000
    case 2500000:
        speed = B2500000;
        break;
#endif
#ifdef B3000000
    case 3000000:
        speed = B3000000;
        break;
#endif
#ifdef B3500000
    case 3500000:
        speed = B3500000;
        break;
#endif
#ifdef B4000000
    case 4000000:
        speed = B4000000;
        break;
#endif
    default:
        speed = B9600;
        if (debug) {
            fprintf(stderr,
                "WARNING Unknown baud rate %d for %d (B9600 used)\n",
                baud, fd);
        }
    }

    /* Set the baud rate */
    if ((cfsetispeed(&tios, speed) < 0) || (cfsetospeed(&tios, speed) < 0)) {
        return -1;
    }

    /* C_CFLAG      Control options
       CLOCAL       Local line - do not change "owner" of port
       CREAD        Enable receiver
    */
    tios.c_cflag |= (CREAD | CLOCAL);
    /* CSIZE, HUPCL, CRTSCTS (hardware flow control) */

    /* Set data bits (5, 6, 7, 8 bits)
       CSIZE        Bit mask for data bits
    */
    tios.c_cflag &= ~CSIZE;
    switch (data_bit) {
    case 5:
        tios.c_cflag |= CS5;
        break;
    case 6:
        tios.c_cflag |= CS6;
        break;
    case 7:
        tios.c_cflag |= CS7;
        break;
    case 8:
    default:
        tios.c_cflag |= CS8;
        break;
    }

    /* Stop bit (1 or 2) */
    if (stop_bit == 1)
        tios.c_cflag &= ~CSTOPB;
    else /* 2 */
        tios.c_cflag |= CSTOPB;

    /* PARENB       Enable parity bit
       PARODD       Use odd parity instead of even */
    if (parity == 'N') {
        /* None */
        tios.c_cflag &= ~PARENB;
    } else if (parity == 'E') {
        /* Even */
        tios.c_cflag |= PARENB;
        tios.c_cflag &= ~PARODD;
    } else {
        /* Odd */
        tios.c_cflag |= PARENB;
        tios.c_cflag |= PARODD;
    }

    /* Read the man page of termios if you need more information. */

    /* This field isn't used on POSIX systems
       tios.c_line = 0;
    */

    /* C_LFLAG      Line options

       ISIG Enable SIGINTR, SIGSUSP, SIGDSUSP, and SIGQUIT signals
       ICANON       Enable canonical input (else raw)
       XCASE        Map uppercase \lowercase (obsolete)
       ECHO Enable echoing of input characters
       ECHOE        Echo erase character as BS-SP-BS
       ECHOK        Echo NL after kill character
       ECHONL       Echo NL
       NOFLSH       Disable flushing of input buffers after
       interrupt or quit characters
       IEXTEN       Enable extended functions
       ECHOCTL      Echo control characters as ^char and delete as ~?
       ECHOPRT      Echo erased character as character erased
       ECHOKE       BS-SP-BS entire line on line kill
       FLUSHO       Output being flushed
       PENDIN       Retype pending input at next read or input char
       TOSTOP       Send SIGTTOU for background output

       Canonical input is line-oriented. Input characters are put
       into a buffer which can be edited interactively by the user
       until a CR (carriage return) or LF (line feed) character is
       received.

       Raw input is unprocessed. Input characters are passed
       through exactly as they are received, when they are
       received. Generally you'll deselect the ICANON, ECHO,
       ECHOE, and ISIG options when using raw input
    */

    /* Raw input */
    tios.c_lflag &= ~(ICANON | ECHO | ECHOE | ISIG);

    /* C_IFLAG      Input options

       Constant     Description
       INPCK        Enable parity check
       IGNPAR       Ignore parity errors
       PARMRK       Mark parity errors
       ISTRIP       Strip parity bits
       IXON Enable software flow control (outgoing)
       IXOFF        Enable software flow control (incoming)
       IXANY        Allow any character to start flow again
       IGNBRK       Ignore break condition
       BRKINT       Send a SIGINT when a break condition is detected
       INLCR        Map NL to CR
       IGNCR        Ignore CR
       ICRNL        Map CR to NL
       IUCLC        Map uppercase to lowercase
       IMAXBEL      Echo BEL on input line too long
    */
    if (parity == 'N') {
        /* None */
        tios.c_iflag &= ~INPCK;
    } else {
        tios.c_iflag |= INPCK;
    }

    /* Software flow control is disabled */
    tios.c_iflag &= ~(IXON | IXOFF | IXANY);

    /* C_OFLAG      Output options
       OPOST        Postprocess output (not set = raw output)
       ONLCR        Map NL to CR-NL

       ONCLR ant others needs OPOST to be enabled
    */

    /* Raw ouput */
    tios.c_oflag &= ~OPOST;

    /* C_CC         Control characters
       VMIN         Minimum number of characters to read
       VTIME        Time to wait for data (tenths of seconds)

       UNIX serial interface drivers provide the ability to
       specify character and packet timeouts. Two elements of the
       c_cc array are used for timeouts: VMIN and VTIME. Timeouts
       are ignored in canonical input mode or when the NDELAY
       option is set on the file via open or fcntl.

       VMIN specifies the minimum number of characters to read. If
       it is set to 0, then the VTIME value specifies the time to
       wait for every character read. Note that this does not mean
       that a read call for N bytes will wait for N characters to
       come in. Rather, the timeout will apply to the first
       character and the read call will return the number of
       characters immediately available (up to the number you
       request).

       If VMIN is non-zero, VTIME specifies the time to wait for
       the first character read. If a character is read within the
       time given, any read will block (wait) until all VMIN
       characters are read. That is, once the first character is
       read, the serial interface driver expects to receive an
       entire packet of characters (VMIN bytes total). If no
       character is read within the time allowed, then the call to
       read returns 0. This method allows you to tell the serial
       driver you need exactly N bytes and any read call will
       return 0 or N bytes. However, the timeout only applies to
       the first character read, so if for some reason the driver
       misses one character inside the N byte packet then the read
       call could block forever waiting for additional input
       characters.

       VTIME specifies the amount of time to wait for incoming
       characters in tenths of seconds. If VTIME is set to 0 (the
       default), reads will block (wait) indefinitely unless the
       NDELAY option is set on the port with open or fcntl.
    */
    /* Unused because we use open with the NDELAY option */
    tios.c_cc[VMIN] = 0;
    tios.c_cc[VTIME] = 0;

    if (tcsetattr(fd, TCSANOW, &tios) < 0) {
        return -1;
    }

    return 0;
}

static int tjs__uart_wait(int fd, unsigned int millis)
{
    if (fd < 0) {
        syslog(LOG_ERR, "uart%i: data_available: port is not open", fd);
        return 0;
    }

    struct timeval timeout;

    if (millis == 0) {
        // no waiting
        timeout.tv_sec = 0;
        timeout.tv_usec = 0;
    } else {
        timeout.tv_sec = millis / 1000;
        timeout.tv_usec = (millis % 1000) * 1000;
    }

    fd_set readfds;

#if !defined(PERIPHERALMAN)
    FD_ZERO(&readfds);
    FD_SET(fd, &readfds);
#endif

    if (select(fd + 1, &readfds, NULL, NULL, &timeout) > 0) {
        return 1; // data is ready
    } else {
        return 0;
    }
}

static int tjs__uart_write(int fd, const char* buf, size_t len)
{
    if (fd < 0) {
        syslog(LOG_ERR, "uart%i: write: port is not open", fd);
        return TJS_UART_INVALID_RESOURCE;
    }

    return write(fd, buf, len);
}

static int tjs_uart_poll_start(JSContext* ctx, TJSUart* uartObject);
static int tjs_uart_poll_stop(JSContext* ctx, TJSUart* uartObject);

static TJSUart* tjs_uart_get(JSContext* ctx, JSValueConst obj)
{
    return JS_GetOpaque2(ctx, obj, tjs_uart_class_id);
}

static JSValue tjs_uart_close(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    if (uartObject->fd > 0) {
        uv_poll_stop(&uartObject->pollHandle);

        close(uartObject->fd);
        uartObject->fd = -1;
    }

    return JS_UNDEFINED;
}

static void tjs_uart_emit_event(JSContext* ctx, TJSUart* uartObject, int event, JSValue arg)
{
    JSValue callback = uartObject->events[event];
    if (!JS_IsFunction(ctx, callback)) {
        JS_FreeValue(ctx, arg);
        return;
    }

    JSValue func = JS_DupValue(ctx, callback);
    JSValue ret = JS_Call(ctx, func, JS_UNDEFINED, 1, (JSValueConst*)&arg);
    if (JS_IsException(ret)) {
        tjs_dump_error(ctx);
    }

    JS_FreeValue(ctx, ret);
    JS_FreeValue(ctx, func);
    JS_FreeValue(ctx, arg);
}

static JSValue tjs_uart_event_get(JSContext* ctx, JSValueConst this_val, int magic)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    return JS_DupValue(ctx, uartObject->events[magic]);
}

static JSValue tjs_uart_event_set(JSContext* ctx, JSValueConst this_val, JSValueConst value, int magic)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    if (!(JS_IsFunction(ctx, value) || JS_IsUndefined(value) || JS_IsNull(value))) {
        return JS_UNDEFINED;
    }

    if (magic == TJS_UART_EVENT_MESSAGE) {
        if (JS_IsFunction(ctx, value)) {
            if (!uartObject->readStart) {
                uartObject->readStart = 1;
                tjs_uart_poll_start(ctx, uartObject);
            }

        } else {
            if (uartObject->readStart) {
                uartObject->readStart = 0;
                tjs_uart_poll_stop(ctx, uartObject);
            }
        }
    }

    JS_FreeValue(ctx, uartObject->events[magic]);
    uartObject->events[magic] = JS_DupValue(ctx, value);

    return JS_UNDEFINED;
}

static JSValue tjs_uart_fileno(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    return JS_NewInt32(ctx, uartObject->fd);
}

static JSValue tjs_uart_flush(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    tjs_uart_result_t status = tjs__uart_flush(uartObject->fd);
    return JS_NewInt32(ctx, status);
}

static void tjs_uart_poll_callback(uv_poll_t* handle, int status, int events)
{
    // printf("tjs_uart_poll_callback(%d) = %d\r\n", status, events);
    TJSUart* uartObject = (TJSUart*)handle->data;
    JSContext* ctx = uartObject->ctx;

    if (events & UV_READABLE) {
        size_t size = 64;
        char* buffer = js_malloc(ctx, size);

        int ret = tjs__uart_read(uartObject->fd, buffer, size);
        if (ret <= 0) {
            js_free(ctx, buffer);
            return;
        }

        JSValue data = TJS_NewArrayBuffer(ctx, buffer, ret);
        tjs_uart_emit_event(uartObject->ctx, uartObject, TJS_UART_EVENT_MESSAGE, data);

    } else if (events & UV_DISCONNECT) {
        tjs_uart_emit_event(uartObject->ctx, uartObject, TJS_UART_EVENT_DISCONNECT, JS_UNDEFINED);
    }
}

static int tjs_uart_poll_start(JSContext* ctx, TJSUart* uartObject)
{
    if (uartObject->fd <= 0) {
        return -1;
    }

    int ret = uv_poll_start(&uartObject->pollHandle, UV_READABLE, tjs_uart_poll_callback);
    return ret;
}

static int tjs_uart_poll_stop(JSContext* ctx, TJSUart* uartObject)
{
    int ret = uv_poll_stop(&uartObject->pollHandle);
    return ret;
}

static JSValue tjs_uart_read(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    size_t size = 128;
    char* buffer = js_malloc(ctx, size);

    int ret = tjs__uart_read(uartObject->fd, buffer, size);
    if (ret <= 0) {
        js_free(ctx, buffer);
        return JS_UNDEFINED;
    }

    return TJS_NewArrayBuffer(ctx, buffer, ret);
}

static JSValue tjs_uart_set_baudrate(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    int baud = 0;
    if (argc > 1) {
        int ret = JS_ToInt32(ctx, &baud, argv[1]);
        if (baud <= 0) {
            return JS_UNDEFINED;
        }
    }

    tjs_uart_result_t status = tjs__uart_set_baudrate(uartObject->fd, baud);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_set_flow_control(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    int ret = 0;
    int xonxoff = 0;
    if (argc > 1) {
        ret = JS_ToInt32(ctx, &xonxoff, argv[1]);
        if (xonxoff < 0) {
            return JS_UNDEFINED;
        }
    }

    int rtscts = 0;
    ret = JS_ToInt32(ctx, &rtscts, argv[2]);
    if (rtscts < 0) {
        return JS_UNDEFINED;
    }

    tjs_uart_result_t status = tjs__uart_set_flowcontrol(uartObject->fd, xonxoff, rtscts);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_set_mode(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    int ret = 0;
    int partiy = 0;
    if (argc > 1) {
        ret = JS_ToInt32(ctx, &partiy, argv[1]);
        if (partiy < 0) {
            partiy = TJS_UART_PARITY_NONE;
        }
    }

    int bytesize = 0;
    if (argc > 2) {
        ret = JS_ToInt32(ctx, &bytesize, argv[2]);
        if (bytesize <= 0) {
            bytesize = 8;
        }
    }

    int stopbits = 0;
    if (argc > 3) {
        ret = JS_ToInt32(ctx, &stopbits, argv[3]);
        if (stopbits <= 0) {
            stopbits = 1;
        }
    }

    tjs_uart_result_t status = tjs__uart_set_mode(uartObject->fd, bytesize, partiy, stopbits);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_set_non_blocking(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    int nonNlocking = 0;
    if (argc > 1) {
        int ret = JS_ToInt32(ctx, &nonNlocking, argv[1]);
        if (nonNlocking <= 0) {
            return JS_UNDEFINED;
        }
    }

    tjs_uart_result_t status = tjs__uart_set_non_blocking(uartObject->fd, nonNlocking);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_set_timeout(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    int timeout = 0;
    int ret = JS_ToInt32(ctx, &timeout, argv[0]);
    if (timeout <= 0) {
        return JS_UNDEFINED;
    }

    tjs_uart_result_t status = tjs__uart_set_timeout(uartObject->fd, timeout, 0, 0);
    return JS_NewInt32(ctx, status);
}

static JSValue tjs_uart_wait(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    int ret = tjs__uart_wait(uartObject->fd, 1000);
    return JS_UNDEFINED;
}

static JSValue tjs_uart_write(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    TJSUart* uartObject = tjs_uart_get(ctx, this_val);
    if (!uartObject) {
        return JS_EXCEPTION;
    }

    JSValue jsData = argv[0];
    bool is_string = false;
    size_t size;
    char* buf;

    if (JS_IsString(jsData)) {
        is_string = true;
        buf = (char*)JS_ToCStringLen(ctx, &size, jsData);
        if (!buf) {
            return JS_EXCEPTION;
        }

    } else {
        buf = JS_GetArrayBuffer(ctx, &size, jsData);
        if (buf == NULL) {
            size_t aoffset, asize;
            JSValue abuf = JS_GetTypedArrayBuffer(ctx, jsData, &aoffset, &asize, NULL);
            if (JS_IsException(abuf)) {
                return abuf;
            }

            buf = (char*)JS_GetArrayBuffer(ctx, &size, abuf);
            JS_FreeValue(ctx, abuf);
            if (!buf) {
                return JS_EXCEPTION;
            }

            buf += aoffset;
            size = asize;
        }
    }

    int ret = tjs__uart_write(uartObject->fd, buf, size);
    if (is_string) {
        JS_FreeCString(ctx, buf);
    }

    return JS_NewInt32(ctx, ret);
}

static void tjs_uart_close_callback(uv_handle_t* handle)
{
    TJSUart* uartObject = (TJSUart*)handle->data;
    CHECK_NOT_NULL(uartObject);

    uartObject->closed = 1;
    if (uartObject->finalized) {
        free(uartObject);
    }
}

static void tjs_uart_maybe_close(TJSUart* uartObject)
{
    if (!uv_is_closing((uv_handle_t*)&uartObject->pollHandle)) {
        uv_close((uv_handle_t*)&uartObject->pollHandle, tjs_uart_close_callback);
    }
}

static void tjs_uart_finalizer(JSRuntime* runtime, JSValue val)
{
    TJSUart* uartObject = JS_GetOpaque(val, tjs_uart_class_id);
    if (uartObject == NULL) {
        return;
    }

    for (int i = 0; i < TJS_UART_EVENT_MAX; i++) {
        JS_FreeValueRT(runtime, uartObject->events[i]);
    }

    uv_poll_stop(&uartObject->pollHandle);
    uv_close((uv_handle_t*)&uartObject->pollHandle, tjs_uart_close_callback);

    uartObject->finalized = 1;

    dbuf_free(&uartObject->readBuffer);

    if (uartObject->closed) {
        free(uartObject);

    } else {
        tjs_uart_maybe_close(uartObject);
    }
}

static void tjs_uart_mark(JSRuntime* runtime, JSValueConst val, JS_MarkFunc* mark_func)
{
    TJSUart* uartObject = JS_GetOpaque(val, tjs_uart_class_id);
    if (uartObject == NULL) {
        return;
    }

    for (int i = 0; i < TJS_UART_EVENT_MAX; i++) {
        JS_MarkValue(runtime, uartObject->events[i], mark_func);
    }
}

static JSClassDef tjs_uart_class = {
    "UART",
    .finalizer = tjs_uart_finalizer,
    .gc_mark = tjs_uart_mark,
};

static JSValue tjs_uart_constructor(JSContext* ctx, JSValueConst new_target, int argc, JSValueConst* argv)
{
    if (argc < 1) {
        return JS_EXCEPTION;
    }

    int fd = 0;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &fd, argv[0])) {
        return JS_EXCEPTION;
    }

    if (fd <= 0) {
        return JS_EXCEPTION;
    }

    TJSUart* uartObject;
    JSValue obj;
    int r;

    obj = JS_NewObjectClass(ctx, tjs_uart_class_id);
    if (JS_IsException(obj)) {
        return obj;
    }

    uartObject = calloc(1, sizeof(*uartObject));
    if (!uartObject) {
        JS_FreeValue(ctx, obj);
        return JS_EXCEPTION;
    }

    uartObject->ctx = ctx;

    dbuf_init(&uartObject->readBuffer);
    uartObject->readStart = 0;
    uartObject->finalized = 0;
    uartObject->closed = 0;
    uartObject->fd = fd;

    int ret = uv_poll_init(tjs_get_loop(ctx), &uartObject->pollHandle, uartObject->fd);
    uartObject->pollHandle.data = uartObject;

    JS_SetOpaque(obj, uartObject);
    return obj;
}

static JSValue tjs_uart_open(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int ret = 0;
    int baudrate = 0;
    if (argc > 1) {
        ret = JS_ToInt32(ctx, &baudrate, argv[1]);
        if (baudrate <= 0) {
            baudrate = 9600;
        }
    }

    int partiy = 0;
    if (argc > 2) {
        ret = JS_ToInt32(ctx, &partiy, argv[2]);
        if (partiy <= 0) {
            partiy = TJS_UART_PARITY_NONE;
        }
    }

    int databits = 0;
    if (argc > 3) {
        ret = JS_ToInt32(ctx, &databits, argv[3]);
        if (databits <= 0) {
            databits = 8;
        }
    }

    int stopbits = 0;
    if (argc > 4) {
        ret = JS_ToInt32(ctx, &stopbits, argv[4]);
        if (stopbits <= 0) {
            stopbits = 1;
        }
    }

    const char* path = NULL;
    if (argc > 0) {
        path = JS_ToCString(ctx, argv[0]);
    }

    if (!path) {
        return JS_UNDEFINED;
    }

    int fd = tjs__uart_open(path);
    JS_FreeCString(ctx, path);

    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    tjs__uart_set_options(fd, baudrate, partiy, databits, stopbits);
    return JS_NewInt32(ctx, fd);
}

static JSValue tjs_uart_set_rts(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        return JS_EXCEPTION;
    }

    // fd
    int fd = 0;
    int ret = JS_ToInt32(ctx, &fd, argv[0]);
    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    // flag
    int flag = 0;
    ret = JS_ToInt32(ctx, &flag, argv[1]);
    if (flag <= 0) {
        flag = 0;

    } else {
        flag = 1;
    }

    int ctrlbits = 0;
    ioctl(fd, TIOCMGET, &ctrlbits);
    if (flag) {
        ctrlbits |= TIOCM_RTS;

    } else {
        ctrlbits &= ~TIOCM_RTS;
    }

    ioctl(fd, TIOCMSET, &ctrlbits);
    return JS_UNDEFINED;
}

static JSValue tjs_uart_set_dtr(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc < 2) {
        return JS_EXCEPTION;
    }

    int fd = 0;
    int ret = JS_ToInt32(ctx, &fd, argv[0]);
    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    int flag = 0;
    ret = JS_ToInt32(ctx, &flag, argv[1]);
    if (flag <= 0) {
        flag = 0;

    } else {
        flag = 1;
    }

    int ctrlbits = 0;
    ioctl(fd, TIOCMGET, &ctrlbits);
    if (flag) {
        ctrlbits |= TIOCM_DTR;

    } else {
        ctrlbits &= ~TIOCM_DTR;
    }

    ioctl(fd, TIOCMSET, &ctrlbits);
    return JS_UNDEFINED;
}

static JSValue tjs_uart_set_options(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int fd = 0;
    int ret = JS_ToInt32(ctx, &fd, argv[0]);
    if (fd <= 0) {
        return JS_UNDEFINED;
    }

    int baudrate = 0;
    if (argc > 1) {
        ret = JS_ToInt32(ctx, &baudrate, argv[1]);
        if (baudrate <= 0) {
            baudrate = 9600;
        }
    }

    int partiy = 0;
    if (argc > 2) {
        ret = JS_ToInt32(ctx, &partiy, argv[2]);
        if (partiy < 0) {
            partiy = TJS_UART_PARITY_NONE;
        }
    }

    int databits = 0;
    if (argc > 3) {
        ret = JS_ToInt32(ctx, &databits, argv[3]);
        if (databits <= 0) {
            databits = 8;
        }
    }

    int stopbits = 0;
    if (argc > 4) {
        ret = JS_ToInt32(ctx, &stopbits, argv[4]);
        if (stopbits <= 0) {
            stopbits = 1;
        }
    }

    tjs__uart_set_options(fd, baudrate, partiy, databits, stopbits);
    return JS_NewInt32(ctx, fd);
}

static const JSCFunctionListEntry tjs_uart_proto_funcs[] = {
    TJS_CGETSET_MAGIC_DEF("onclose", tjs_uart_event_get, tjs_uart_event_set, TJS_UART_EVENT_CLOSE),
    TJS_CGETSET_MAGIC_DEF("onerror", tjs_uart_event_get, tjs_uart_event_set, TJS_UART_EVENT_ERROR),
    TJS_CGETSET_MAGIC_DEF("ondisconnect", tjs_uart_event_get, tjs_uart_event_set, TJS_UART_EVENT_DISCONNECT),
    TJS_CGETSET_MAGIC_DEF("onmessage", tjs_uart_event_get, tjs_uart_event_set, TJS_UART_EVENT_MESSAGE),
    TJS_CFUNC_DEF("fileno", 0, tjs_uart_fileno),
    TJS_CFUNC_DEF("flush", 0, tjs_uart_flush),
    TJS_CFUNC_DEF("read", 1, tjs_uart_read),
    TJS_CFUNC_DEF("close", 1, tjs_uart_close),
    TJS_CFUNC_DEF("setBaudrate", 1, tjs_uart_set_baudrate),
    TJS_CFUNC_DEF("setFlowControl", 1, tjs_uart_set_flow_control),
    TJS_CFUNC_DEF("setMode", 1, tjs_uart_set_mode),
    TJS_CFUNC_DEF("setNonBlocking ", 1, tjs_uart_set_non_blocking),
    TJS_CFUNC_DEF("setTimeout", 1, tjs_uart_set_timeout),
    TJS_CFUNC_DEF("wait", 1, tjs_uart_wait),
    TJS_CFUNC_DEF("write", 1, tjs_uart_write)
};

static const JSCFunctionListEntry tjs_uart_funcs[] = {
    JS_PROP_INT32_DEF("PARITY_EVEN", TJS_UART_PARITY_EVEN, 0),
    JS_PROP_INT32_DEF("PARITY_NONE", TJS_UART_PARITY_NONE, 0),
    JS_PROP_INT32_DEF("PARITY_ODD", TJS_UART_PARITY_ODD, 0),
    TJS_CFUNC_DEF("open", 5, tjs_uart_open),
    TJS_CFUNC_DEF("setDTR", 2, tjs_uart_set_dtr),
    TJS_CFUNC_DEF("setRTS", 2, tjs_uart_set_rts),
    TJS_CFUNC_DEF("setOptions", 5, tjs_uart_set_options)
};

#endif

void tjs_mod_uart_init(JSContext* ctx, JSModuleDef* module)
{
#if defined(__linux__) || defined(__linux)
    /* class */
    JS_NewClassID(&tjs_uart_class_id);
    JS_NewClass(JS_GetRuntime(ctx), tjs_uart_class_id, &tjs_uart_class);
    JSValue proto = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, proto, tjs_uart_proto_funcs, countof(tjs_uart_proto_funcs));
    JS_SetClassProto(ctx, tjs_uart_class_id, proto);

    /* object */
    JSValue uartClass = JS_NewCFunction2(ctx, tjs_uart_constructor, "UART", 1, JS_CFUNC_constructor, 0);

    JSValue uart = JS_NewObject(ctx);
    JS_DefinePropertyValueStr(ctx, uart, "UART", uartClass, JS_PROP_C_W_E);

    JS_SetPropertyFunctionList(ctx, uart, tjs_uart_funcs, countof(tjs_uart_funcs));
    JS_SetModuleExport(ctx, module, "uart", uart);

#endif
}

void tjs_mod_uart_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "uart");
}
