module.exports = ({ managers }) => {
    return async ({ req, res, next, end }) => {
        const { moduleName, fnName } = req.params
        const token = req.headers.token

        if (!token) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                message: "Unauthorized - No token provided",
            })
        }

        // Verify token and get user
        const decoded = managers.token.verifyShortToken({ token })
        if (!decoded) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                message: "Unauthorized - Invalid token",
            })
        }

        // Check if user has permission for this operation
        const hasPermission = await managers.permission.hasPermission({
            userId: decoded.userId,
            resource: moduleName,
            action: fnName,
        })

        if (!hasPermission) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Forbidden - Insufficient permissions",
            })
        }

        next({ userId: decoded.userId })
    }
}
