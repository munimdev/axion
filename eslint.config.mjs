import globals from "globals"
import pluginJs from "@eslint/js"
import pluginJest from "eslint-plugin-jest"

/** @type {import('eslint').Linter.Config[]} */
export default [
    {
        files: ["**/*.js"],
        languageOptions: {
            sourceType: "commonjs",
            ecmaVersion: 2022,
            globals: {
                ...globals.browser,
                ...globals.node,
                ...globals.jest,
            },
        },
        plugins: {
            jest: pluginJest,
        },
        rules: {
            ...pluginJs.configs.recommended.rules,
            "no-unused-vars": "off",
            "jest/expect-expect": "error",
            "jest/no-disabled-tests": "warn",
            "jest/no-focused-tests": "error",
            "jest/no-identical-title": "error",
            "jest/valid-expect": "error"
        },
    }
]
