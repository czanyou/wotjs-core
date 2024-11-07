#!/bin/env tjs
// @ts-check
/// <reference path ="../modules/types/index.d.ts" />
import * as native from '@tjs/native';
import * as process from '@tjs/process';

/**
 * 返回应用信息
 * @returns {{commands: string[], applets: string[]}}
 */
export function getCommands() {
    const modules = native.util.modules().sort();

    const commands = [];
    const applets = [];
    for (const name of modules) {
        const tokens = name.split('/');
        // console.log(tokens);

        const app = tokens[1];
        if (!app) {
            continue;

        } else if (app == 'bin') {
            // applet: @app/bin/:name.js
            const filename = tokens[2];
            if (filename?.endsWith('.js')) {
                applets.push(filename.substring(0, filename.length - 3));
            }

        } else if (tokens[2] == 'app.js') {
            // application: @app/:name/app.js
            commands.push(app);
        }
    }

    return { applets, commands };
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
     */
    function printList(type, modules) {
        if (modules.length) {
            console.print(colors.green(type));

            modules.forEach(value => {
                console.print(value || '');
            });

            console.print('');
        }
    }

    const modules = native.util.modules(); //.sort();

    const commandsInfo = getCommands();
    const commands = commandsInfo.commands.join(', ');
    const applets = commandsInfo.applets.join(', ');

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
  ${commands}, ${applets}

${process.version}@${process.execPath()}:${process.scriptPath()}`);

    if (type == 'modules') {
        printList('Core modules:', modules);
    }
}

help(...process.argv);
