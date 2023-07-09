cmake_minimum_required(VERSION 3.12)

set(APP_JS_DIR ${CMAKE_CURRENT_LIST_DIR})

###############################################################
# 公共模块，微应用以及核心管理应用
# modules & tpm.app

set(app_js_files
    ${APP_JS_DIR}/modules/bin/*.js
    ${APP_JS_DIR}/modules/system/*.js
    ${APP_JS_DIR}/modules/utils/*.js
    ${APP_JS_DIR}/modules/vendor/*.js
    ${APP_JS_DIR}/tpm/src/*.js
    ${APP_JS_DIR}/tpm/*.js
)

###############################################################
# SDK 打包应用
# build.app

if (BUILD_APP_BUILD_JS)
    set(app_js_files ${app_js_files}
        ${APP_JS_DIR}/build/*.js
        ${APP_JS_DIR}/build/src/*.js
    )
endif ()

###############################################################
# build app js files to c files
# 通过下面的自定义命令将 app 的脚本文件编译成 C 语言文件

add_custom_command(
    COMMAND
        ${TJS_COMPILER} # tjsc 编译器
        -b "${APP_JS_DIR}/" # tjsc 工作目录
        -l "app" # 编译后的模块名前缀
        -o ${CMAKE_CURRENT_BINARY_DIR}/app-js.c # 输出文件
        -m ${app_js_files} # 要编译的所有源文件
    DEPENDS
        ${TJS_COMPILER}
        ${app_js_files}
    OUTPUT
        ${CMAKE_CURRENT_BINARY_DIR}/app-js.c
    COMMENT
        "Built app js files"
)
