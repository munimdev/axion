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
        this.shark = managers.shark
        this.responseDispatcher = managers.responseDispatcher
        this.userPrefix = "user"

        // Exposed HTTP endpoints
        this.httpExposed = ["createUser", "loginUser", "patch=updateUser", "delete=deleteUser", "get=getUser"]
    }

    async _hashPassword(password) {
        return bcrypt.hash(password, 10)
    }

    async _verifyPassword(password, hash) {
        return bcrypt.compare(password, hash)
    }

    async _setPermissions({ userId, role }) {
        const addDirectAccess = ({ nodeId, action }) => {
            return this.shark.addDirectAccess({
                userId,
                nodeId,
                action,
            })
        }

        const lookupTable = {
            schoolAdmin: async () => {
                const items = [
                    {
                        nodeId: "board.school",
                        action: "read",
                    },
                    {
                        nodeId: "board.school.class",
                        action: "update",
                    },
                    {
                        nodeId: "board.school.class.student",
                        action: "update",
                    },
                ]
                for (const item of items) {
                    await addDirectAccess(item)
                }
            },
            superadmin: async () => {
                const items = [
                    {
                        nodeId: "board.school",
                        layer: "board.school",
                        action: "delete",
                    },
                    {
                        nodeId: "board.school.class",
                        layer: "board.school.class",
                        action: "read",
                    },
                ]
                for (const item of items) {
                    await addDirectAccess(item)
                }
            },
        }

        if (lookupTable[role]) {
            await lookupTable[role]()
        }
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

        // Set role-based permissions
        await this._setPermissions({ userId: email, role })

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
        const isPasswordValid = await this._verifyPassword(password, user.password)
        if (!isPasswordValid) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                message: "Invalid password",
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

    async updateUser({ __token, id, username, email, password, role, res }) {
        const { userId } = __token

        // Only superadmin can update roles
        if (role) {
            const canUpdateRole = await this.shark.isGranted({
                layer: "board.user",
                action: "config",
                userId,
                nodeId: `board.user.${id}`,
                role: "superadmin",
            })

            if (!canUpdateRole) {
                this.responseDispatcher.dispatch(res, {
                    ok: false,
                    code: 403,
                    message: "Only superadmin can update user roles",
                })
                return { selfHandleResponse: true }
            }
        }

        // Validate input
        const validationResult = await this.validators.user.updateUser({
            username,
            email,
            password,
            role,
        })
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
        if (password) updates.password = await this._hashPassword(password)
        if (role) {
            updates.role = role
            // Update permissions if role changed
            await this._setPermissions({ userId: id, role })
        }
        updates.updatedAt = Date.now()
        updates.updatedBy = userId

        const updatedUser = await this.oyster.call("update_block", {
            _id: `${this.userPrefix}:${id}`,
            ...updates,
        })

        const { password: _, ...userWithoutPassword } = updatedUser
        return { user: userWithoutPassword }
    }

    async deleteUser({ __token, id, res }) {
        const { userId } = __token

        // Only superadmin can delete users
        const canDeleteUser = await this.shark.isGranted({
            layer: "board.user",
            action: "delete",
            userId,
            nodeId: `board.user.${id}`,
            role: "superadmin",
        })

        if (!canDeleteUser) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only superadmin can delete users",
            })
            return { selfHandleResponse: true }
        }

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

        // Remove all user relations
        await this.oyster.call("delete_relations", {
            _id: `${this.userPrefix}:${id}`,
        })

        return { message: "User deleted successfully" }
    }

    async getUser({ __token, id, res }) {
        const { userId } = __token

        // Only superadmin or the user themselves can view user details
        const canViewUser =
            (await this.shark.isGranted({
                layer: "board.user",
                action: "read",
                userId,
                nodeId: `board.user.${id}`,
                role: "superadmin",
            })) || userId === id

        if (!canViewUser) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Permission denied",
            })
            return { selfHandleResponse: true }
        }

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
