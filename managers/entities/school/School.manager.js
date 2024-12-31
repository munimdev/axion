const { nanoid } = require("nanoid")

/**
 * Manages school-related operations in the school management system.
 * Handles CRUD operations and school administrator assignments.
 */
module.exports = class SchoolManager {
    /**
     * Initializes the SchoolManager with required dependencies
     * @param {Object} params - Dependency injection parameters
     * @param {Object} params.utils - Utility functions
     * @param {Object} params.config - System configuration
     * @param {Object} params.cortex - Core system functions
     * @param {Object} params.managers - Other manager instances
     * @param {Object} params.validators - Input validation functions
     * @param {Object} params.oyster - Data persistence layer
     */
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
            "assignSchoolAdmin",
        ]
    }

    /**
     * Retrieves user information by userId
     * @private
     * @param {Object} params - Function parameters
     * @param {string} params.userId - The ID of the user to retrieve
     * @returns {Promise<Object>} User object or error
     */
    async _getUser({ userId }) {
        const user = await this.oyster.call("get_block", `user:${userId}`)
        if (!user || this.utils.isEmptyObject(user)) {
            return { error: "Invalid Token" }
        }
        return user
    }

    /**
     * Validates user permissions for specific actions
     * @private
     * @param {Object} params - Function parameters
     * @param {string} params.userId - The ID of the user
     * @param {string} params.action - The action to validate (create, read, update, delete, config)
     * @param {string} [params.nodeId] - The node ID for permission check
     * @param {string} [params.schoolId] - School ID for school-specific permission checks
     * @returns {Promise<Object>} Validation result
     */
    async _validatePermission({ userId, action, nodeId = "board.school", schoolId }) {
        const user = await this._getUser({ userId })
        if (user.error) return user

        if (!user.role) {
            return { error: "User role not found" }
        }

        // For school admins, check if they are assigned to this specific school
        if (user.role === "schoolAdmin" && schoolId) {
            const schoolAdmins = await this.oyster.call("nav_relation", {
                _id: `${this.schoolPrefix}:${schoolId}`,
                relation: "_members",
                label: "user",
                withScores: true,
            })

            if (!schoolAdmins || !schoolAdmins[`user:${userId}`]) {
                return { error: "Permission denied" }
            }
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

    /**
     * Creates a new school record
     * @param {Object} params - School creation parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.name - School name
     * @param {string} params.address - School address
     * @param {string} params.phone - Contact phone number
     * @param {string} params.email - School email address
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Created school object or error
     */
    async createSchool({ __token, name, address, phone, email, res }) {
        const { userId } = __token

        // Permission check
        const canCreateSchool = await this._validatePermission({
            userId,
            action: "create",
        })

        if (canCreateSchool.error) {
            return canCreateSchool
        }

        // Validate input
        const validationResult = await this.validators.school.createSchool({
            name,
            address,
            phone,
            email,
        })
        if (validationResult) return validationResult

        // Create school
        const schoolId = nanoid()
        const school = await this.oyster.call("add_block", {
            _id: schoolId,
            _label: this.schoolPrefix,
            name,
            address,
            phone,
            email,
            createdAt: Date.now(),
            createdBy: userId,
            _admins: [`user:${userId}`],
        })

        if (school.error) {
            if (school.error.includes("already exists")) {
                this.responseDispatcher.dispatch(res, {
                    code: 409,
                    message: "School already exists",
                })
                return { selfHandleResponse: true }
            }

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

    /**
     * Updates an existing school's information
     * @param {Object} params - School update parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - School ID
     * @param {string} [params.name] - Updated school name
     * @param {string} [params.address] - Updated address
     * @param {string} [params.phone] - Updated phone number
     * @param {string} [params.email] - Updated email address
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Updated school object or error
     */
    async updateSchool({ __token, id, name, address, phone, email, res }) {
        const { userId } = __token

        // Permission check
        const canUpdateSchool = await this._validatePermission({
            userId,
            action: "update",
        })

        if (canUpdateSchool.error) {
            return canUpdateSchool
        }

        // Validate input
        const validationResult = await this.validators.school.updateSchool({
            name,
            address,
            phone,
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
        if (phone) updates.phone = phone
        if (email) updates.email = email
        updates.updatedAt = Date.now()
        updates.updatedBy = userId

        const updatedSchool = await this.oyster.call("update_block", {
            _id: `${this.schoolPrefix}:${id}`,
            ...updates,
        })

        return { school: updatedSchool }
    }

    /**
     * Deletes a school record and its relations
     * @param {Object} params - School deletion parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - School ID to delete
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Deletion result
     */
    async deleteSchool({ __token, id, res }) {
        const { userId } = __token

        // Permission check
        const canDeleteSchool = await this._validatePermission({
            userId,
            action: "delete",
        })

        if (canDeleteSchool.error) {
            return canDeleteSchool
        }

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

    /**
     * Retrieves a specific school's information
     * @param {Object} params - School retrieval parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - School ID to retrieve
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} School information or error
     */
    async getSchool({ __token, id, res }) {
        const { userId } = __token

        // Permission check - pass the school ID for validation
        const canReadSchool = await this._validatePermission({
            userId,
            action: "read",
            schoolId: id,
        })

        if (canReadSchool.error) {
            return canReadSchool
        }

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

    /**
     * Assigns a user as a school administrator
     * @param {Object} params - Admin assignment parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.schoolId - School ID to assign admin to
     * @param {string} params.adminUserId - User ID to be assigned as admin
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Assignment result or error
     */
    async assignSchoolAdmin({ __token, schoolId, adminUserId, res }) {
        const { userId } = __token

        // Permission check
        const canAssignAdmin = await this._validatePermission({
            userId,
            action: "config",
        })

        if (canAssignAdmin.error) {
            return canAssignAdmin
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

        // Create relation between admin and school using proper score format
        const relationResult = await this.oyster.call("update_relations", {
            _id: `${this.schoolPrefix}:${schoolId}`,
            add: {
                _members: [`user:${adminUserId}~1`], // Add score of 1 to indicate admin relationship
            },
        })

        if (relationResult.error) {
            console.error("Failed to create relation:", relationResult.error)
            return { error: "Failed to assign school admin" }
        }

        return { message: "School admin assigned successfully" }
    }
}
