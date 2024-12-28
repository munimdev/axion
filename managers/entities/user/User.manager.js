const bcrypt = require("bcrypt")
const { nanoid } = require("nanoid")

module.exports = class UserManager {
    constructor({ utils, cache, config, cortex, managers, validators, oyster }) {
        this.utils = utils
        this.config = config
        this.cortex = cortex
        this.validators = validators
        this.oyster = oyster
        this.tokenManager = managers.token
        this.permissionManager = managers.permission
        this.responseDispatcher = managers.responseDispatcher
        this.userPrefix = "user"

        // Exposed HTTP endpoints
        this.httpExposed = ["createUser", "loginUser", "updateUser", "deleteUser", "getUser"]
    }

    async _hashPassword(password) {
        return bcrypt.hash(password, 10)
    }

    async _verifyPassword(password, hash) {
        return bcrypt.compare(password, hash)
    }

    async createUser({ username, email, password, role = "user", res }) {
        // Validate input
        const validationResult = await this.validators.user.createUser({ username, email, password, role })
        if (validationResult) return validationResult

        // Check if user exists
        const existingUser = await this.oyster.call("get_block", `${this.userPrefix}:${email}`)
        if (existingUser && !this.utils.isEmptyObject(existingUser)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 409,
                message: "User already exists",
            })
            return { selfHandleResponse: true }
        }

        // Create user
        const hashedPassword = await this._hashPassword(password)
        const userId = nanoid()
        const user = await this.oyster.call("add_block", {
            _id: `${this.userPrefix}:${email}`,
            _label: this.userPrefix,
            userId,
            email,
            username,
            password: hashedPassword,
            role,
            createdAt: Date.now(),
        })

        if (user.error) {
            console.error("Failed to create user:", user.error)
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 500,
                message: "Failed to create user",
            })
            return { selfHandleResponse: true }
        }

        // Assign role
        await this.permissionManager.assignRole({ userId: email, role })

        // Generate tokens
        const longToken = this.tokenManager.genLongToken({
            userId: email,
            userKey: user.key,
        })

        const { password: _, ...userWithoutPassword } = user
        return {
            user: userWithoutPassword,
            longToken,
        }
    }

    async loginUser({ email, password, res }) {
        // Validate input
        const validationResult = await this.validators.user.loginUser({ email, password })
        if (validationResult) return validationResult

        // Get user
        const user = await this.oyster.call("get_block", `${this.userPrefix}:${email}`)
        if (!user || this.utils.isEmptyObject(user)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "User not found",
            })
            return { selfHandleResponse: true }
        }

        // Verify password
        const isValid = await this._verifyPassword(password, user.password)
        if (!isValid) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                message: "Invalid credentials",
            })
            return { selfHandleResponse: true }
        }

        // Generate token
        const longToken = this.tokenManager.genLongToken({
            userId: email,
            userKey: user.key,
        })

        const { password: _, ...userWithoutPassword } = user
        return {
            user: userWithoutPassword,
            longToken,
        }
    }

    async updateUser({ __role, id, username, email, role, res }) {
        // Validate input
        const validationResult = await this.validators.user.updateUser({ username, email, role })
        if (validationResult) return validationResult

        // Get user
        const user = await this.oyster.call("get_block", `${this.userPrefix}:${id}`)
        if (!user || this.utils.isEmptyObject(user)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "User not found",
            })
            return { selfHandleResponse: true }
        }

        // Update user
        const updates = {}
        if (username) updates.username = username
        if (email) updates.email = email
        if (role) {
            updates.role = role
            await this.permissionManager.assignRole({ userId: id, role })
        }

        const updatedUser = await this.oyster.call("update_block", {
            _id: `${this.userPrefix}:${id}`,
            ...updates,
        })

        const { password: _, ...userWithoutPassword } = updatedUser
        return { user: userWithoutPassword }
    }

    async deleteUser({ __role, id, res }) {
        // Validate input
        const validationResult = await this.validators.user.deleteUser({ id })
        if (validationResult) return validationResult

        // Get user
        const user = await this.oyster.call("get_block", `${this.userPrefix}:${id}`)
        if (!user || this.utils.isEmptyObject(user)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "User not found",
            })
            return { selfHandleResponse: true }
        }

        // Delete user
        await this.oyster.call("delete_block", `${this.userPrefix}:${id}`)
        return { message: "User deleted successfully" }
    }

    async getUser({ __role, id, res }) {
        // Validate input
        const validationResult = await this.validators.user.getUser({ id })
        if (validationResult) return validationResult

        // Get user
        const user = await this.oyster.call("get_block", `${this.userPrefix}:${id}`)
        if (!user || this.utils.isEmptyObject(user)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "User not found",
            })
            return { selfHandleResponse: true }
        }

        const { password: _, ...userWithoutPassword } = user
        return { user: userWithoutPassword }
    }
}
