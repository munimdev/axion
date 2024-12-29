const { nanoid } = require("nanoid")

module.exports = class SchoolManager {
    constructor({ utils, cache, config, cortex, managers, validators, oyster }) {
        this.utils = utils
        this.config = config
        this.cortex = cortex
        this.validators = validators
        this.oyster = oyster
        this.shark = managers.shark
        this.responseDispatcher = managers.responseDispatcher
        this.schoolPrefix = "school"

        // Exposed HTTP endpoints
        this.httpExposed = [
            "createSchool",
            "patch=updateSchool",
            "delete=deleteSchool",
            "get=getSchool",
            "get=listSchools",
            "assignSchoolAdmin"
        ]
    }

    async _getUser({ userId }) {
        const user = await this.oyster.call("get_block", `user:${userId}`)
        if (!user || this.utils.isEmptyObject(user)) {
            return { error: "Invalid Token" }
        }
        return user
    }

    async _validatePermission({ userId, action, nodeId = "board.school" }) {
        const user = await this._getUser({ userId })
        if (user.error) return user

        if (!user.role) {
            return { error: "User role not found" }
        }

        const canDoAction = await this.shark.isGranted({
            layer: "board.school",
            action,
            userId,
            nodeId,
            role: user.role,
        })
        return { error: canDoAction ? undefined : "Permission denied" }
    }

    async createSchool({ __token, name, address, phone, email, res }) {
        const { userId } = __token

        // Permission check
        const canCreateSchool = await this._validatePermission({
            userId,
            action: "create"
        })

        if (canCreateSchool.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canCreateSchool.error
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.school.createSchool({
            name,
            address,
            phone,
            email
        })
        if (validationResult) return validationResult

        // Check if school exists
        const existingSchool = await this.oyster.call("get_block", `${this.schoolPrefix}:${email}`)
        if (existingSchool && !this.utils.isEmptyObject(existingSchool)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 409,
                message: "School already exists with this email"
            })
            return { selfHandleResponse: true }
        }

        // Create school
        const schoolId = nanoid()
        const school = await this.oyster.call("add_block", {
            _id: `${this.schoolPrefix}:${email}`,
            _label: this.schoolPrefix,
            schoolId,
            name,
            address,
            phone,
            email,
            createdAt: Date.now(),
            createdBy: userId
        })

        if (school.error) {
            console.error("Failed to create school:", school.error)
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 500,
                message: "Failed to create school"
            })
            return { selfHandleResponse: true }
        }

        return { school }
    }

    async updateSchool({ __token, id, name, address, phone, email, res }) {
        const { userId } = __token

        // Permission check
        const canUpdateSchool = await this._validatePermission({
            userId,
            action: "update",
            nodeId: `board.school.${id}`
        })

        if (canUpdateSchool.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateSchool.error
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.school.updateSchool({
            name,
            address,
            phone,
            email
        })
        if (validationResult) return validationResult

        // Get school
        const school = await this.oyster.call("get_block", `${this.schoolPrefix}:${id}`)
        if (!school || this.utils.isEmptyObject(school)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "School not found"
            })
            return { selfHandleResponse: true }
        }

        // Update school
        const updates = {}
        if (name) updates.name = name
        if (address) updates.address = address
        if (phone) updates.phone = phone
        if (email) updates.email = email
        updates.updatedAt = Date.now()
        updates.updatedBy = userId

        const updatedSchool = await this.oyster.call("update_block", {
            _id: `${this.schoolPrefix}:${id}`,
            ...updates
        })

        return { school: updatedSchool }
    }

    async deleteSchool({ __token, id, res }) {
        const { userId } = __token

        // Permission check
        const canDeleteSchool = await this._validatePermission({
            userId,
            action: "delete",
            nodeId: `board.school.${id}`
        })

        if (canDeleteSchool.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canDeleteSchool.error
            })
            return { selfHandleResponse: true }
        }

        // Get school
        const school = await this.oyster.call("get_block", `${this.schoolPrefix}:${id}`)
        if (!school || this.utils.isEmptyObject(school)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "School not found"
            })
            return { selfHandleResponse: true }
        }

        // Delete school
        await this.oyster.call("delete_block", `${this.schoolPrefix}:${id}`)

        // Remove all school relations
        await this.oyster.call("delete_relations", {
            _id: `${this.schoolPrefix}:${id}`
        })

        return { message: "School deleted successfully" }
    }

    async getSchool({ __token, id, res }) {
        const { userId } = __token

        // Permission check
        const canReadSchool = await this._validatePermission({
            userId,
            action: "read",
            nodeId: `board.school.${id}`
        })

        if (canReadSchool.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadSchool.error
            })
            return { selfHandleResponse: true }
        }

        // Get school
        const school = await this.oyster.call("get_block", `${this.schoolPrefix}:${id}`)
        if (!school || this.utils.isEmptyObject(school)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "School not found"
            })
            return { selfHandleResponse: true }
        }

        return { school }
    }

    async listSchools({ __token, res }) {
        const { userId } = __token

        // Permission check
        const canReadSchools = await this._validatePermission({
            userId,
            action: "read"
        })

        if (canReadSchools.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadSchools.error
            })
            return { selfHandleResponse: true }
        }

        const schools = await this.oyster.call("get_blocks", {
            _label: this.schoolPrefix
        })

        return { schools }
    }

    async assignSchoolAdmin({ __token, schoolId, adminUserId, res }) {
        const { userId } = __token

        // Permission check
        const canAssignAdmin = await this._validatePermission({
            userId,
            action: "config",
            nodeId: `board.school.${schoolId}`
        })

        if (canAssignAdmin.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canAssignAdmin.error
            })
            return { selfHandleResponse: true }
        }

        // Check if school exists
        const school = await this.oyster.call("get_block", `${this.schoolPrefix}:${schoolId}`)
        if (!school || this.utils.isEmptyObject(school)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "School not found"
            })
            return { selfHandleResponse: true }
        }

        // Add direct access for school admin
        await this.shark.addDirectAccess({
            userId: adminUserId,
            nodeId: `board.school.${schoolId}`,
            action: "update"
        })

        return { message: "School admin assigned successfully" }
    }
}
