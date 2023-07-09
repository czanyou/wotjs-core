#!/bin/env tjs
// @ts-check
/// <reference path ="../../modules/types/index.d.ts" />
import * as native from '@tjs/native';
import * as process from '@tjs/process';

/**
 * 返回应用信息
 * @returns {{applications: string[], applets: string[]}}
 */
export function getApplications() {
    const modules = native.util.applications().sort();

    const applications = [];
    const applets = [];
    for (const name of modules) {
        const tokens = name.split('/');
        // console.log(tokens);

        const app = tokens[1];
        if (!app) {
            continue;

        } else if (app == 'modules') {
            // applet: @app/modules/bin/:name.js
            if (tokens[2] == 'bin') {
                const filename = tokens[3];
                if (filename?.endsWith('.js')) {
                    applets.push(filename.substring(0, filename.length - 3));
                }
            }

        } else if (tokens[2] == 'app.js') {
            // application: @app/:name/app.js
            applications.push(app);
        }
    }

    return { applets, applications };
}

export function getApplicationModules() {
    const modules = native.util.applications().sort();

    const result = [];
    for (const name of modules) {
        const tokens = name.split('/');
        const app = tokens[1];
        if (!app) {
            continue;

        } else if (app != 'modules') {
            continue;

        } else if (tokens[2] == 'bin') {
            continue;
        }

        // filename
        let filename = name;
        if (name.endsWith('.js')) {
            filename = name.substring(0, name.length - 3);
        }

        result.push(filename);
    }

    return result;
}

/**
 * 显示帮助信息
 * @param {string} [execute]
 * @param {string} [script]
 * @param {string} [type]
 */
function help(execute, script, type) {
    const colors = console.colors;

    /**
     * 
     * @param {string} type 
     * @param {string[]} modules 
     * @param {string=} prefix 
     */
    function printList(type, modules, prefix) {
        if (modules.length) {
            console.print(colors.green(type));

            modules.forEach(value => {
                console.print(value || '');
            });

            console.print('');
        }
    }

    const modules = native.util.modules().sort();

    const applicationsInfo = getApplications();
    const applications = applicationsInfo.applications.join(', ');
    const applets = applicationsInfo.applets.join(', ');

    console.print(`tjs is a JavaScript runtime for Web of Things

${colors.white('Usage:')}

  tjs [options] <script.js> [arguments]
  tjs [options] <command> <subcommand> [arguments]
  
${colors.white('Options:')}

  -v, --version             print tjs version
  -h, --help                list options
      --dump                dump the memory usage stats
      --unhandled-rejection abort when a rejected promise is not caught
      --memory-limit n      limit the memory usage to 'n' bytes
      --stack-size n        limit the stack size to 'n' bytes

${colors.white('Commands:')}

  ${applications}, ${applets}

${process.version}@${process.execPath()}:${process.scriptPath()}`);

    if (type == 'modules') {
        const applications = getApplicationModules();
        printList('Core modules:', modules, '@tjs/');
        printList('App modules:', applications, '@app/modules/');
    }
}

help(...process.argv);
