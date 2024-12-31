const Oyster = require("oyster-db")
const config = require("../config/index.config.js")

// Global setup
beforeAll(async () => {
    // Setup global test database connection
    global.oyster = new Oyster({
        url: config.dotEnv.OYSTER_REDIS,
        prefix: "test_" + config.dotEnv.OYSTER_PREFIX,
    })
})

// Global teardown
afterAll(() => {
    // Close database connection
    if (global.oyster) {
        global.oyster.close()
    }
})
