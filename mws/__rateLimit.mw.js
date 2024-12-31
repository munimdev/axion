module.exports = ({ cache, config }) => {
    const WINDOW_SIZE_IN_SECONDS = 60 // 1 minute window
    const MAX_REQUESTS_PER_WINDOW = 100 // 100 requests per minute

    return async ({ req, res, next, end }) => {
        const ip = req.ip || req.connection.remoteAddress
        const key = `rateLimit:${ip}`

        try {
            // Get the current count for this IP
            const currentCount = (await cache.get(key)) || 0

            if (currentCount >= MAX_REQUESTS_PER_WINDOW) {
                return end({
                    error: "Too many requests",
                    code: 429,
                })
            }

            // Increment the counter
            await cache.incr(key)

            // Set expiry if it's a new key
            if (currentCount === 0) {
                await cache.expire(key, WINDOW_SIZE_IN_SECONDS)
            }

            // Add rate limit headers
            res.setHeader("X-RateLimit-Limit", MAX_REQUESTS_PER_WINDOW)
            res.setHeader("X-RateLimit-Remaining", MAX_REQUESTS_PER_WINDOW - currentCount - 1)

            next()
        } catch (error) {
            console.error("Rate limiting error:", error)
            // If Redis fails, allow the request but log the error
            next()
        }
    }
}
