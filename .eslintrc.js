module.exports = {
    root: true,
    extends: 'standard',
    env: {
        browser: true,
        es2021: true,
        es6: true
    },
    rules: {
        eqeqeq: 0,
        'handle-callback-err': 1,
        indent: [2, 4, { SwitchCase: 1 }],
        'no-control-regex': 0,
        'no-trailing-spaces': 0,
        'space-before-function-paren': [2, {
            anonymous: 'always',
            named: 'never',
            asyncArrow: 'always'
        }],
        'padded-blocks': [0, 'never'],
        semi: [1, 'always']
    }
};
