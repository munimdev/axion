const { nanoid } = require("nanoid")

module.exports = class SchoolManager {
    constructor({ utils, cache, config, cortex, managers, validators, oyster }) {
        this.utils = utils
        this.config = config
        this.cortex = cortex
        this.validators = validators
        this.oyster = oyster
        this.permissionManager = managers.permission
        this.responseDispatcher = managers.responseDispatcher
        this.schoolPrefix = "school"

        // Exposed HTTP endpoints
        this.httpExposed = [
            "createSchool",
            "updateSchool",
            "deleteSchool",
            "getSchool",
            "listSchools",
            "assignSchoolAdmin",
        ]
    }

    async createSchool({ __role, name, address, phone, email, res }) {
        // Only superadmin can create schools
        if (__role !== "superadmin") {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only superadmin can create schools",
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.school.createSchool({
            name,
            address,
            phone,
            email,
        })
        if (validationResult) return validationResult

        // Check if school exists
        const existingSchool = await this.oyster.call("get_block", `${this.schoolPrefix}:${email}`)
        if (existingSchool && !this.utils.isEmptyObject(existingSchool)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 409,
                message: "School already exists with this email",
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
            createdBy: __role,
        })

        if (school.error) {
            console.error("Failed to create school:", school.error)
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 500,
                message: "Failed to create school",
            })
            return { selfHandleResponse: true }
        }

        return { school }
    }

    async updateSchool({ __role, id, name, address, contactNumber, capacity, email, res }) {
        // Only superadmin can update schools
        if (__role !== "superadmin") {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only superadmin can update schools",
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.school.updateSchool({
            name,
            address,
            contactNumber,
            capacity,
            email,
        })
        if (validationResult) return validationResult

        // Get school
        const school = await this.oyster.call("get_block", `${this.schoolPrefix}:${id}`)
        if (!school || this.utils.isEmptyObject(school)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "School not found",
            })
            return { selfHandleResponse: true }
        }

        // Update school
        const updates = {}
        if (name) updates.name = name
        if (address) updates.address = address
        if (contactNumber) updates.contactNumber = contactNumber
        if (capacity) updates.capacity = capacity
        if (email) updates.email = email
        updates.updatedAt = Date.now()
        updates.updatedBy = __role

        const updatedSchool = await this.oyster.call("update_block", {
            _id: `${this.schoolPrefix}:${id}`,
            ...updates,
        })

        return { school: updatedSchool }
    }

    async deleteSchool({ __role, id, res }) {
        // Only superadmin can delete schools
        if (__role !== "superadmin") {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only superadmin can delete schools",
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.school.deleteSchool({ id })
        if (validationResult) return validationResult

        // Get school
        const school = await this.oyster.call("get_block", `${this.schoolPrefix}:${id}`)
        if (!school || this.utils.isEmptyObject(school)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "School not found",
            })
            return { selfHandleResponse: true }
        }

        // Delete school
        await this.oyster.call("delete_block", `${this.schoolPrefix}:${id}`)

        // Remove all school relations
        await this.oyster.call("delete_relations", {
            _id: `${this.schoolPrefix}:${id}`,
        })

        return { message: "School deleted successfully" }
    }

    async getSchool({ __role, id, res }) {
        // Validate input
        const validationResult = await this.validators.school.getSchool({ id })
        if (validationResult) return validationResult

        // Get school
        const school = await this.oyster.call("get_block", `${this.schoolPrefix}:${id}`)
        if (!school || this.utils.isEmptyObject(school)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "School not found",
            })
            return { selfHandleResponse: true }
        }

        return { school }
    }

    async listSchools({ __role, res }) {
        const schools = await this.oyster.call("get_blocks", {
            _label: this.schoolPrefix,
        })

        return { schools }
    }

    async assignSchoolAdmin({ __role, schoolId, userId, res }) {
        // Only superadmin can assign school admins
        if (__role !== "superadmin") {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only superadmin can assign school admins",
            })
            return { selfHandleResponse: true }
        }

        // Check if school exists
        const school = await this.oyster.call("get_block", `${this.schoolPrefix}:${schoolId}`)
        if (!school || this.utils.isEmptyObject(school)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "School not found",
            })
            return { selfHandleResponse: true }
        }

        // Assign user as school admin
        await this.oyster.call("update_relations", {
            _id: `${this.schoolPrefix}:${schoolId}`,
            set: {
                _admins: [`user:${userId}`],
            },
        })

        // Update user's role to schoolAdmin
        await this.permissionManager.assignRole({ userId, role: "schoolAdmin" })

        return { message: "School admin assigned successfully" }
    }
}
