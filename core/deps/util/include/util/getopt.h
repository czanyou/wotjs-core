#ifndef _FLAGS_H
#define _FLAGS_H

#define OPT_PREFIX '-'
#define OPT_ASSIGN '='

/**
 * @brief 选项
 * 
 */
typedef struct option_t {
    /** 选项类型 */
    char key;

    /** 选项名称 */
    char* name;

    /** 选项值 */
    char* value;

    /** 选项名称长度 */
    size_t length;

    int argc;
    
    char** argv;

    char* arg;

    int index;
} option_t;

int option_init(option_t* option, int argc, char** argv);

/**
 * @brief 
 * 
 * @param arg 要解析的参数
 * @param option 解析后的参数
 * @return true 解析成功
 * @return false 解析失败，停止继续扫描参数
 */
bool option_get(option_t* option);

/**
 * @brief 
 * 
 * @param option 
 * @return char* 
 */
char* option_get_value(option_t* option);

/**
 * @brief 
 * 
 * @param option 
 * @param type 
 * @param name 
 * @return true 
 * @return false 
 */
bool option_is(option_t* option, char type, char* name);

#endif
