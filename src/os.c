#include "private.h"
#include "utils.h"
#include "version.h"

#include <unistd.h>

#if defined(__linux__) || defined(__linux)
#include <net/if.h>
#include <sys/ioctl.h>
#include <sys/reboot.h>
#include <sys/socket.h>
#endif

static JSValue tjs_cpu_info(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uv_cpu_info_t* cpu_infos;
    int count, i;
    int ret = uv_cpu_info(&cpu_infos, &count);
    if (ret < 0) {
        return JS_UNDEFINED;
    }

    JSValue array = JS_NewArray(ctx);
    for (i = 0; i < count; i++) {
        JSValue item = JS_NewObjectProto(ctx, JS_NULL);
        JS_DefinePropertyValueStr(ctx, item, "model", JS_NewString(ctx, cpu_infos[i].model), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "speed", JS_NewUint32(ctx, cpu_infos[i].speed), JS_PROP_C_W_E);

        JS_DefinePropertyValueStr(ctx, item, "user", JS_NewUint32(ctx, cpu_infos[i].cpu_times.user), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "nice", JS_NewUint32(ctx, cpu_infos[i].cpu_times.nice), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "sys", JS_NewUint32(ctx, cpu_infos[i].cpu_times.sys), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "idle", JS_NewUint32(ctx, cpu_infos[i].cpu_times.idle), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "irq", JS_NewUint32(ctx, cpu_infos[i].cpu_times.irq), JS_PROP_C_W_E);

        JS_DefinePropertyValueUint32(ctx, array, i, item, JS_PROP_C_W_E);
    }

    return array;
}

static JSValue tjs_loadavg(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    double avg[3];
    uv_loadavg(avg);
    JSValue array = JS_NewArray(ctx);

    JS_DefinePropertyValueUint32(ctx, array, 0, JS_NewFloat64(ctx, avg[0]), JS_PROP_C_W_E);
    JS_DefinePropertyValueUint32(ctx, array, 1, JS_NewFloat64(ctx, avg[1]), JS_PROP_C_W_E);
    JS_DefinePropertyValueUint32(ctx, array, 2, JS_NewFloat64(ctx, avg[2]), JS_PROP_C_W_E);

    return array;
}

static JSValue tjs_chdir(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    const char* path = JS_ToCString(ctx, argv[0]);
    if (!path) {
        return JS_EXCEPTION;
    }

    int ret = uv_chdir(path);
    JS_FreeCString(ctx, path);
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_uptime(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    double uptime = 0;
    int ret = uv_uptime(&uptime);
    return JS_NewFloat64(ctx, uptime);
}

static JSValue tjs_totalmem(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uint64_t ret = uv_get_total_memory();
    return JS_NewInt64(ctx, ret);
}

static JSValue tjs_freemem(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uint64_t ret = uv_get_free_memory();
    return JS_NewInt64(ctx, ret);
}

static JSValue tjs_resident_set_memory(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    size_t rss = 0;
    int ret = uv_resident_set_memory(&rss);
    return JS_NewInt64(ctx, rss);
}

static JSValue tjs_pid(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uv_pid_t ret = uv_os_getpid();
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_print_all_handles(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    FILE* file = fopen("/tmp/tjs-handles.txt", "w");
    if (file) {
        uv_print_all_handles(tjs_get_loop(ctx), file);
        fclose(file);
    }

    return JS_UNDEFINED;
}

static JSValue tjs_print_active_handles(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    FILE* file = stdout;
    uv_print_active_handles(tjs_get_loop(ctx), file);
    return JS_UNDEFINED;
}

static JSValue tjs_dump_objects(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    JSRuntime* runtime = JS_GetRuntime(ctx);
    JS_DumpObjects(runtime);
    return JS_UNDEFINED;
}

static JSValue tjs_print_memory_usage(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    FILE* file = fopen("/tmp/tjs-memory.txt", "w");
    if (!file) {
        return JS_UNDEFINED;
    }

    JSMemoryUsage stats = { 0 };
    JSRuntime* runtime = JS_GetRuntime(ctx);
    JS_ComputeMemoryUsage(runtime, &stats);

    fprintf(file, "memory allocated:   %8ld, size: %ld\r\n", stats.malloc_count, stats.malloc_size);
    fprintf(file, "memory used:        %8ld, size: %ld\r\n", stats.memory_used_count, stats.memory_used_size);
    fprintf(file, "atoms:              %8ld, size: %ld\r\n", stats.atom_count, stats.atom_size);
    fprintf(file, "strings:            %8ld, size: %ld\r\n", stats.str_count, stats.str_size);
    fprintf(file, "objects:            %8ld, size: %ld\r\n", stats.obj_count, stats.obj_size);
    fprintf(file, "properties:         %8ld, size: %ld\r\n", stats.prop_count, stats.prop_size);
    fprintf(file, "shapes:             %8ld, size: %ld\r\n", stats.shape_count, stats.shape_size);
    fprintf(file, "bytecode functions: %8ld, size: %ld, bytecode: %ld\r\n", stats.js_func_count, stats.js_func_size, stats.js_func_code_size);
    fprintf(file, "pc2line:            %8ld, size: %ld\r\n", stats.js_func_pc2line_count, stats.js_func_pc2line_size);
    fprintf(file, "C functions:        %8ld\r\n", stats.c_func_count);
    fprintf(file, "arrays:             %8ld, fast arrays: %ld, elements: %ld\r\n", stats.array_count, stats.fast_array_count, stats.fast_array_elements);
    fprintf(file, "binary objects:     %8ld, size: %ld\r\n", stats.binary_object_count, stats.binary_object_size);

    {
#if 1
        int* object_classes = &stats.object_classes[0];
        fprintf(file, "\n""JSObject classes (%d)\n", stats.class_count);
        if (object_classes[0]) {
            fprintf(file, "  %5d  %2.0d %s\n", object_classes[0], 0, "none");
        }

        int class_id = 0;
        int JS_CLASS_INIT_COUNT = stats.class_count;
        for (class_id = 1; class_id < JS_CLASS_INIT_COUNT; class_id++) {
            if (object_classes[class_id]) {
                char buf[64];
                fprintf(file, "  %5d  %d\n", object_classes[class_id], class_id);
            }
        }

        if (object_classes[JS_CLASS_INIT_COUNT]) {
            fprintf(file, "  %5d  %d\n", object_classes[JS_CLASS_INIT_COUNT], 0);
        }
#endif
    }

    fclose(file);
    
    return JS_UNDEFINED;
}

static JSValue tjs_ppid(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uv_pid_t ret = uv_os_getppid();
    return JS_NewInt32(ctx, ret);
}

static JSValue tjs_hostname(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    char buf[UV_MAXHOSTNAMESIZE];
    size_t size = UV_MAXHOSTNAMESIZE;

    int ret = uv_os_gethostname(buf, &size);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return JS_NewString(ctx, buf);
}

static JSValue tjs_reboot(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
#if defined(__linux__) || defined(__linux)
    sync();
    int ret = reboot(RB_AUTOBOOT);
    return JS_NewInt32(ctx, ret);

#else
    return JS_UNDEFINED;
#endif
}

static JSValue tjs_sleep(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    int32_t delay = 0;
    if (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &delay, argv[0])) {
        return JS_EXCEPTION;
    }

    uv_sleep(delay);
    return JS_UNDEFINED;
}

static JSValue tjs_process_title(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc > 0) {
        const char* title = JS_ToCString(ctx, argv[0]);
        if (!title) {
            return JS_EXCEPTION;
        }

        int ret = uv_set_process_title(title);
        JS_FreeCString(ctx, title);

        if (ret != 0) {
            return tjs_throw_errno(ctx, ret);
        }
    }

    char buffer[255];
    size_t buffer_size = 255;
    int ret = uv_get_process_title(buffer, buffer_size);
    if (ret != 0) {
        return tjs_throw_errno(ctx, ret);
    }

    return JS_NewString(ctx, buffer);
}

static JSValue tjs_kill(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    if (argc <= 0) {
        return JS_EXCEPTION;
    }

    int32_t pid = 0;
    if (argc < 1 || (!JS_IsUndefined(argv[0]) && JS_ToInt32(ctx, &pid, argv[0]))) {
        return JS_EXCEPTION;
    }

    int32_t sig_num = SIGTERM;
    if (argc > 1) {
        if (!JS_IsUndefined(argv[1]) && JS_ToInt32(ctx, &sig_num, argv[1])) {
            return JS_EXCEPTION;
        }
    }

    int r = uv_kill(pid, sig_num);
    if (r != 0) {
        return tjs_throw_errno(ctx, r);
    }

    return JS_UNDEFINED;
}

static int tjs_interface_flags(const char* facename)
{
    int flags = 0;

#if defined(__linux__) || defined(__linux)
    int sockfd = -1;
    struct ifreq ifr;

    if ((sockfd = socket(AF_INET, SOCK_STREAM, 0)) == -1) {
        return flags;
    }

    memset(&ifr, 0, sizeof(ifr));
    strncpy(ifr.ifr_name, facename, sizeof(ifr.ifr_name) - 1);

    if (ioctl(sockfd, SIOCGIFFLAGS, &ifr) < 0) {
        close(sockfd);
        return flags;
    }

    flags = ifr.ifr_flags;

    close(sockfd);
#endif

    return flags;
}

static JSValue tjs_interfaces(JSContext* ctx, JSValueConst this_val, int argc, JSValueConst* argv)
{
    uv_interface_address_t* interfaces;
    int count, i;
    char ip[INET6_ADDRSTRLEN];
    char netmask[INET6_ADDRSTRLEN];
    char mac[64];

    uv_interface_addresses(&interfaces, &count);

    JSValue array = JS_NewArray(ctx);
    for (i = 0; i < count; i++) {
        JSValue item = JS_NewObjectProto(ctx, JS_NULL);

        uint8_t* addr = (uint8_t*)interfaces[i].phys_addr;
        sprintf(mac, "%02x:%02x:%02x:%02x:%02x:%02x", addr[0], addr[1], addr[2], addr[3], addr[4], addr[5]);
        JS_DefinePropertyValueStr(ctx, item, "mac", JS_NewString(ctx, mac), JS_PROP_C_W_E);

        JS_DefinePropertyValueStr(ctx, item, "name", JS_NewString(ctx, interfaces[i].name), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "internal", JS_NewUint32(ctx, interfaces[i].is_internal), JS_PROP_C_W_E);

        if (interfaces[i].address.address4.sin_family == AF_INET) {
            uv_ip4_name(&interfaces[i].address.address4, ip, sizeof(ip));
            uv_ip4_name(&interfaces[i].netmask.netmask4, netmask, sizeof(netmask));
            JS_DefinePropertyValueStr(ctx, item, "family", JS_NewString(ctx, "inet"), JS_PROP_C_W_E);

        } else if (interfaces[i].address.address4.sin_family == AF_INET6) {
            uv_ip6_name(&interfaces[i].address.address6, ip, sizeof(ip));
            uv_ip6_name(&interfaces[i].netmask.netmask6, netmask, sizeof(netmask));
            JS_DefinePropertyValueStr(ctx, item, "family", JS_NewString(ctx, "inet6"), JS_PROP_C_W_E);

        } else {
            strncpy(ip, "<unknown sa family>", INET6_ADDRSTRLEN);
            strncpy(netmask, "<unknown sa family>", INET6_ADDRSTRLEN);
        }

        int flags = tjs_interface_flags(interfaces[i].name);

        JS_DefinePropertyValueStr(ctx, item, "ip", JS_NewString(ctx, ip), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "netmask", JS_NewString(ctx, netmask), JS_PROP_C_W_E);
        JS_DefinePropertyValueStr(ctx, item, "flags", JS_NewUint32(ctx, flags), JS_PROP_C_W_E);

        JS_DefinePropertyValueUint32(ctx, array, i, item, JS_PROP_C_W_E);
    }
    uv_free_interface_addresses(interfaces, count);

    return array;
}

static const JSCFunctionListEntry tjs_os_funcs[] = {
    TJS_CFUNC_DEF("chdir", 0, tjs_chdir),
    TJS_CFUNC_DEF("cpuinfo", 0, tjs_cpu_info),
    TJS_CFUNC_DEF("freemem", 0, tjs_freemem),
    TJS_CFUNC_DEF("hostname", 0, tjs_hostname),
    TJS_CFUNC_DEF("interfaces", 0, tjs_interfaces),
    TJS_CFUNC_DEF("kill", 2, tjs_kill),
    TJS_CFUNC_DEF("loadavg", 0, tjs_loadavg),
    TJS_CFUNC_DEF("pid", 0, tjs_pid),
    TJS_CFUNC_DEF("ppid", 0, tjs_ppid),
    TJS_CFUNC_DEF("printHandles", 0, tjs_print_all_handles),
    TJS_CFUNC_DEF("printMemoryUsage", 0, tjs_print_memory_usage),
    TJS_CFUNC_DEF("dumpObjects", 0, tjs_dump_objects),
    TJS_CFUNC_DEF("processTitle", 1, tjs_process_title),
    TJS_CFUNC_DEF("reboot", 0, tjs_reboot),
    TJS_CFUNC_DEF("rssmem", 0, tjs_resident_set_memory),
    TJS_CFUNC_DEF("sleep", 1, tjs_sleep),
    TJS_CFUNC_DEF("totalmem", 0, tjs_totalmem),
    TJS_CFUNC_DEF("uptime", 0, tjs_uptime)
};

void tjs_mod_os_init(JSContext* ctx, JSModuleDef* module)
{
    JSValue os = JS_NewObject(ctx);
    JS_SetPropertyFunctionList(ctx, os, tjs_os_funcs, countof(tjs_os_funcs));

    JS_DefinePropertyValueStr(ctx, os, "platform", JS_NewString(ctx, TJS_PLATFORM), JS_PROP_C_W_E);
    JS_DefinePropertyValueStr(ctx, os, "arch", JS_NewString(ctx, TJS_ARCH), JS_PROP_C_W_E);

    JS_SetModuleExport(ctx, module, "os", os);
}

void tjs_mod_os_export(JSContext* ctx, JSModuleDef* module)
{
    JS_AddModuleExport(ctx, module, "os");
}
