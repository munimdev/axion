const { nanoid } = require("nanoid")

module.exports = class ClassroomManager {
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
            "get=listClassrooms",
            "post=addResource",
            "delete=removeResource",
            "get=listSchoolClassrooms"
        ]
    }

    async _getUser({ userId }) {
        const user = await this.oyster.call("get_block", `user:${userId}`)
        if (!user || this.utils.isEmptyObject(user)) {
            return { error: "Invalid Token" }
        }
        return user
    }

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

    async createClassroom({ __token, name, capacity, grade, section, academicYear, resources, schoolId, res }) {
        const { userId } = __token

        // Permission check
        const canCreateClassroom = await this._validatePermission({
            userId,
            action: "create",
            nodeId: `board.school.${schoolId}.classroom`
        })

        if (canCreateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canCreateClassroom.error
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.classroom.createClassroom({
            name,
            capacity,
            grade,
            section,
            academicYear,
            resources,
            schoolId
        })
        if (validationResult) return validationResult

        // Check if classroom exists
        const existingClassroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${name}`)
        if (existingClassroom && !this.utils.isEmptyObject(existingClassroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 409,
                message: "Classroom already exists with this name"
            })
            return { selfHandleResponse: true }
        }

        // Create classroom
        const classroomId = nanoid()
        const classroom = await this.oyster.call("add_block", {
            _id: `${this.classroomPrefix}:${name}`,
            _label: this.classroomPrefix,
            classroomId,
            name,
            capacity,
            grade,
            section,
            academicYear,
            resources: resources || [],
            schoolId,
            createdAt: Date.now(),
            createdBy: userId
        })

        if (classroom.error) {
            console.error("Failed to create classroom:", classroom.error)
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 500,
                message: "Failed to create classroom"
            })
            return { selfHandleResponse: true }
        }

        // Link classroom to school
        await this.oyster.call("update_relations", {
            _id: `school:${schoolId}`,
            add: {
                _classrooms: [`${this.classroomPrefix}:${name}`]
            }
        })

        return { classroom }
    }

    async updateClassroom({ __token, id, name, capacity, grade, section, academicYear, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateClassroom = await this._validatePermission({
            userId,
            action: "update",
            nodeId: `board.school.${classroom.schoolId}.classroom.${id}`
        })

        if (canUpdateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateClassroom.error
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.classroom.updateClassroom({
            name,
            capacity,
            grade,
            section,
            academicYear
        })
        if (validationResult) return validationResult

        // Update classroom fields
        const updates = {}
        if (name) updates.name = name
        if (capacity) updates.capacity = capacity
        if (grade) updates.grade = grade
        if (section) updates.section = section
        if (academicYear) updates.academicYear = academicYear
        updates.updatedAt = Date.now()
        updates.updatedBy = userId

        const updatedClassroom = await this.oyster.call("update_block", {
            _id: `${this.classroomPrefix}:${id}`,
            ...updates
        })

        return { classroom: updatedClassroom }
    }

    async deleteClassroom({ __token, id, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canDeleteClassroom = await this._validatePermission({
            userId,
            action: "delete",
            nodeId: `board.school.${classroom.schoolId}.classroom.${id}`
        })

        if (canDeleteClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canDeleteClassroom.error
            })
            return { selfHandleResponse: true }
        }

        // Delete classroom
        await this.oyster.call("delete_block", `${this.classroomPrefix}:${id}`)

        // Remove classroom from school's relations
        await this.oyster.call("update_relations", {
            _id: `school:${classroom.schoolId}`,
            remove: {
                _classrooms: [`${this.classroomPrefix}:${id}`]
            }
        })

        return { message: "Classroom deleted successfully" }
    }

    async getClassroom({ __token, id, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canReadClassroom = await this._validatePermission({
            userId,
            action: "read",
            nodeId: `board.school.${classroom.schoolId}.classroom.${id}`
        })

        if (canReadClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadClassroom.error
            })
            return { selfHandleResponse: true }
        }

        return { classroom }
    }

    async listClassrooms({ __token, schoolId, res }) {
        const { userId } = __token

        // Permission check
        const canReadClassrooms = await this._validatePermission({
            userId,
            action: "read",
            nodeId: `board.school.${schoolId}.classroom`
        })

        if (canReadClassrooms.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadClassrooms.error
            })
            return { selfHandleResponse: true }
        }

        const classrooms = await this.oyster.call("get_blocks", {
            _label: this.classroomPrefix,
            filter: {
                schoolId
            }
        })

        return { classrooms }
    }

    async listSchoolClassrooms({ __token, schoolId, res }) {
        const { userId } = __token

        // Permission check
        const canReadClassrooms = await this._validatePermission({
            userId,
            action: "read",
            nodeId: `board.school.${schoolId}.classroom`
        })

        if (canReadClassrooms.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadClassrooms.error
            })
            return { selfHandleResponse: true }
        }

        // Get all classrooms for a school using relations
        const classrooms = await this.oyster.call("nav_relation", {
            relation: "_classrooms",
            _id: `school:${schoolId}`,
            withScores: true
        })

        const classroomDetails = await Promise.all(
            Object.keys(classrooms).map(async (classroomId) => {
                const classroom = await this.oyster.call("get_block", classroomId)
                return classroom
            })
        )

        return { classrooms: classroomDetails.filter(c => c !== null) }
    }

    async addResource({ __token, id, resource, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateClassroom = await this._validatePermission({
            userId,
            action: "update",
            nodeId: `board.school.${classroom.schoolId}.classroom.${id}`
        })

        if (canUpdateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateClassroom.error
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.classroom.addResource({ id, resource })
        if (validationResult) return validationResult

        // Add resource
        const resources = classroom.resources || []
        if (resources.includes(resource)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 409,
                message: "Resource already exists"
            })
            return { selfHandleResponse: true }
        }

        resources.push(resource)
        const updatedClassroom = await this.oyster.call("update_block", {
            _id: `${this.classroomPrefix}:${id}`,
            resources,
            updatedAt: Date.now(),
            updatedBy: userId
        })

        return { classroom: updatedClassroom }
    }

    async removeResource({ __token, id, resource, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateClassroom = await this._validatePermission({
            userId,
            action: "update",
            nodeId: `board.school.${classroom.schoolId}.classroom.${id}`
        })

        if (canUpdateClassroom.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateClassroom.error
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
                message: "Resource not found"
            })
            return { selfHandleResponse: true }
        }

        resources.splice(resourceIndex, 1)
        const updatedClassroom = await this.oyster.call("update_block", {
            _id: `${this.classroomPrefix}:${id}`,
            resources,
            updatedAt: Date.now(),
            updatedBy: userId
        })

        return { classroom: updatedClassroom }
    }
} 