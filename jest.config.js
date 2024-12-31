module.exports = {
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.js"],
    verbose: true,
    setupFilesAfterEnv: ["./tests/setup.js"],
    testTimeout: 10000,
    clearMocks: true,
    collectCoverage: true,
    coverageDirectory: "coverage",
    coveragePathIgnorePatterns: ["/node_modules/"],
}
