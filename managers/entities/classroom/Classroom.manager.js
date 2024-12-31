const { nanoid } = require("nanoid")

/**
 * Manages classroom-related operations in the school management system.
 * Handles CRUD operations, resource management, and student assignments.
 */
module.exports = class ClassroomManager {
    /**
     * Initializes the ClassroomManager with required dependencies
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
        this.classroomPrefix = "classroom"

        // Exposed HTTP endpoints
        this.httpExposed = [
            "createClassroom",
            "patch=updateClassroom",
            "delete=deleteClassroom",
            "get=getClassroom",
            "post=addResource",
            "delete=removeResource",
            "post=addStudent",
            "delete=removeStudent",
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
     * @param {string} params.action - The action to validate (create, read, update, delete)
     * @param {string} [params.nodeId] - The node ID for permission check
     * @returns {Promise<Object>} Validation result
     */
    async _validatePermission({ userId, action, nodeId = "board.school.class" }) {
        const user = await this._getUser({ userId })
        if (user.error) return user

        if (!user.role) {
            return { error: "User role not found" }
        }

        const canDoAction = await this.shark.isGranted({
            layer: "board.school.class",
            action,
            userId,
            nodeId,
            role: user.role,
        })
        return { error: canDoAction ? undefined : "Permission denied" }
    }

    /**
     * Creates a new classroom record
     * @param {Object} params - Classroom creation parameters
     * @param {Object} params.__token - Authentication token
     * @param {number} params.capacity - Maximum number of students
     * @param {string} params.grade - Grade level
     * @param {string} params.section - Section identifier
     * @param {string} params.academicYear - Academic year
     * @param {Array} [params.resources] - List of classroom resources
     * @param {string} params.schoolId - Associated school ID
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Created classroom object or error
     */
    async createClassroom({ __token, capacity, grade, section, academicYear, resources, schoolId, res }) {
        const { userId } = __token

        // Permission check
        const canCreateClassroom = await this._validatePermission({
            userId,
            action: "create",
        })

        if (canCreateClassroom.error) {
            return canCreateClassroom
        }

        // Ensure school exists
        const school = await this.oyster.call("get_block", `school:${schoolId}`)
        if (!school || this.utils.isEmptyObject(school)) {
            return { error: "School not found" }
        }

        // Validate input
        const validationResult = await this.validators.classroom.createClassroom({
            capacity,
            grade,
            section,
            academicYear,
            resources,
            schoolId,
        })
        if (validationResult) return validationResult

        // Create classroom
        const classroomId = nanoid()
        const classroom = await this.oyster.call("add_block", {
            _id: classroomId,
            _label: this.classroomPrefix,
            capacity,
            grade,
            section,
            academicYear,
            resources: resources || [],
            schoolId,
            createdAt: Date.now(),
            createdBy: userId,
        })

        if (classroom.error) {
            if (classroom.error.includes("already exists")) {
                this.responseDispatcher.dispatch(res, {
                    code: 409,
                    message: "Classroom already exists",
                })
                return { selfHandleResponse: true }
            }

            console.error("Failed to create classroom:", classroom.error)
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 500,
                message: "Failed to create classroom",
            })
            return { selfHandleResponse: true }
        }

        // Link classroom to school using proper score format
        await this.oyster.call("update_relations", {
            _id: school._id,
            add: {
                _members: [`${classroom._id}~1`], // Add score of 1 to indicate direct membership
            },
        })

        return { classroom }
    }

    /**
     * Updates an existing classroom's information
     * @param {Object} params - Classroom update parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Classroom ID
     * @param {number} [params.capacity] - Updated maximum capacity
     * @param {string} [params.grade] - Updated grade level
     * @param {string} [params.section] - Updated section identifier
     * @param {string} [params.academicYear] - Updated academic year
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Updated classroom object or error
     */
    async updateClassroom({ __token, id, capacity, grade, section, academicYear, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateClassroom = await this._validatePermission({
            userId,
            action: "update",
        })

        if (canUpdateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateClassroom.error,
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.classroom.updateClassroom({
            capacity,
            grade,
            section,
            academicYear,
        })
        if (validationResult) return validationResult

        // Update classroom fields
        const updates = {}
        if (capacity) updates.capacity = capacity
        if (grade) updates.grade = grade
        if (section) updates.section = section
        if (academicYear) updates.academicYear = academicYear
        updates.updatedAt = Date.now()
        updates.updatedBy = userId

        const updatedClassroom = await this.oyster.call("update_block", {
            _id: classroom._id,
            ...updates,
        })

        return { classroom: updatedClassroom }
    }

    /**
     * Deletes a classroom record if it has no students
     * @param {Object} params - Classroom deletion parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Classroom ID to delete
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Deletion result
     */
    async deleteClassroom({ __token, id, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canDeleteClassroom = await this._validatePermission({
            userId,
            action: "delete",
        })

        if (canDeleteClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canDeleteClassroom.error,
            })
            return { selfHandleResponse: true }
        }

        // Check if classroom has students
        const students = await this.oyster.call("nav_relation", {
            _id: classroom._id,
            relation: "_members",
            label: "student",
            withScores: true,
        })

        if (students && Object.keys(students).length > 0) {
            return { error: "Cannot delete classroom with existing students" }
        }

        // Delete classroom
        await this.oyster.call("delete_block", classroom._id)

        // Remove classroom from school's relations
        await this.oyster.call("update_relations", {
            _id: `school:${classroom.schoolId}`,
            remove: {
                _members: [classroom._id],
            },
        })

        return { message: "Classroom deleted successfully" }
    }

    /**
     * Retrieves a specific classroom's information
     * @param {Object} params - Classroom retrieval parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Classroom ID to retrieve
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Classroom information or error
     */
    async getClassroom({ __token, id, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canReadClassroom = await this._validatePermission({
            userId,
            action: "read",
        })

        if (canReadClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadClassroom.error,
            })
            return { selfHandleResponse: true }
        }

        return { classroom }
    }

    /**
     * Adds a resource to a classroom
     * @param {Object} params - Resource addition parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Classroom ID
     * @param {Object} params.resource - Resource to add
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Updated classroom object or error
     */
    async addResource({ __token, id, resource, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateClassroom = await this._validatePermission({
            userId,
            action: "update",
        })

        if (canUpdateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateClassroom.error,
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.classroom.addResource({ id, resource })
        if (validationResult) return validationResult

        // Add resource
        const resources = Array.isArray(classroom.resources)
            ? classroom.resources
            : typeof classroom.resources === "string"
              ? JSON.parse(classroom.resources || "[]")
              : []
        if (resources.includes(resource)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 409,
                message: "Resource already exists",
            })
            return { selfHandleResponse: true }
        }

        resources.push(resource)
        const updatedClassroom = await this.oyster.call("update_block", {
            _id: classroom._id,
            resources,
            updatedAt: Date.now(),
            updatedBy: userId,
        })

        return { classroom: updatedClassroom }
    }

    /**
     * Removes a resource from a classroom
     * @param {Object} params - Resource removal parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Classroom ID
     * @param {Object} params.resource - Resource to remove
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Updated classroom object or error
     */
    async removeResource({ __token, id, resource, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateClassroom = await this._validatePermission({
            userId,
            action: "update",
        })

        if (canUpdateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateClassroom.error,
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.classroom.removeResource({ id, resource })
        if (validationResult) return validationResult

        // Remove resource
        const resources = classroom.resources || []
        const resourceIndex = resources.indexOf(resource)
        if (resourceIndex === -1) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Resource not found",
            })
            return { selfHandleResponse: true }
        }

        resources.splice(resourceIndex, 1)
        const updatedClassroom = await this.oyster.call("update_block", {
            _id: classroom._id,
            resources,
            updatedAt: Date.now(),
            updatedBy: userId,
        })

        return { classroom: updatedClassroom }
    }

    /**
     * Adds a student to a classroom
     * @param {Object} params - Student addition parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Classroom ID
     * @param {string} params.studentId - Student ID to add
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Updated classroom object or error
     */
    async addStudent({ __token, id, studentId, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateClassroom = await this._validatePermission({
            userId,
            action: "update",
        })

        if (canUpdateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateClassroom.error,
            })
            return { selfHandleResponse: true }
        }

        // Get student to verify it exists and belongs to the same school
        const student = await this.oyster.call("get_block", `student:${studentId}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found",
            })
            return { selfHandleResponse: true }
        }

        if (student.schoolId !== classroom.schoolId) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 400,
                message: "Cannot add student from a different school",
            })
            return { selfHandleResponse: true }
        }

        // Check if student is already in another classroom
        if (student.classroomId) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 400,
                message: "Student is already assigned to a classroom",
            })
            return { selfHandleResponse: true }
        }

        // Update student's classroom reference
        await this.oyster.call("update_block", {
            _id: `student:${studentId}`,
            classroomId: id,
            updatedAt: Date.now(),
            updatedBy: userId,
        })

        // Add student to classroom relations
        await this.oyster.call("update_relations", {
            _id: classroom._id,
            add: {
                _members: [`student:${studentId}~1`], // Add score of 1 for direct membership
            },
        })

        return { message: "Student added to classroom successfully" }
    }

    /**
     * Removes a student from a classroom
     * @param {Object} params - Student removal parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Classroom ID
     * @param {string} params.studentId - Student ID to remove
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Updated classroom object or error
     */
    async removeStudent({ __token, id, studentId, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateClassroom = await this._validatePermission({
            userId,
            action: "update",
        })

        if (canUpdateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateClassroom.error,
            })
            return { selfHandleResponse: true }
        }

        // Get student to verify it exists and belongs to this classroom
        const student = await this.oyster.call("get_block", `student:${studentId}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found",
            })
            return { selfHandleResponse: true }
        }

        if (student.classroomId !== id) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 400,
                message: "Student is not in this classroom",
            })
            return { selfHandleResponse: true }
        }

        // Update student's classroom reference
        await this.oyster.call("update_block", {
            _id: `student:${studentId}`,
            classroomId: null,
            updatedAt: Date.now(),
            updatedBy: userId,
        })

        // Remove student from classroom relations
        await this.oyster.call("update_relations", {
            _id: classroom._id,
            remove: {
                _members: [`student:${studentId}`],
            },
        })

        return { message: "Student removed from classroom successfully" }
    }
}
