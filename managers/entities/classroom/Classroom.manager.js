const { nanoid } = require("nanoid")

module.exports = class ClassroomManager {
    constructor({ utils, cache, config, cortex, managers, validators, oyster }) {
        this.utils = utils
        this.config = config
        this.cortex = cortex
        this.validators = validators
        this.oyster = oyster
        this.permissionManager = managers.permission
        this.responseDispatcher = managers.responseDispatcher
        this.classroomPrefix = "classroom"
        this.schoolManager = managers.school

        // Exposed HTTP endpoints
        this.httpExposed = [
            "createClassroom",
            "updateClassroom",
            "deleteClassroom",
            "getClassroom",
            "listClassrooms",
            "addResource",
            "removeResource",
            "listSchoolClassrooms"
        ]
    }

    async _verifySchoolAdmin({ userId, schoolId }) {
        const admins = await this.oyster.call("nav_relation", {
            relation: "_admins",
            _id: `school:${schoolId}`,
            withScores: true,
        })
        return admins[`user:${userId}`] !== undefined
    }

    async createClassroom({ __role, name, capacity, grade, section, academicYear, resources, schoolId, res }) {
        // Verify if user is school admin for this school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can create classrooms"
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

        // Create classroom
        const classroomId = nanoid()
        const classroom = await this.oyster.call("add_block", {
            _id: `${this.classroomPrefix}:${classroomId}`,
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
            createdBy: __role
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
                _classrooms: [`${this.classroomPrefix}:${classroomId}`]
            }
        })

        return { classroom }
    }

    async updateClassroom({ __role, id, name, capacity, grade, section, academicYear, resources, res }) {
        // Get classroom to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Verify if user is school admin for this classroom's school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId: classroom.schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can update classrooms"
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.classroom.updateClassroom({
            name,
            capacity,
            grade,
            section,
            academicYear,
            resources
        })
        if (validationResult) return validationResult

        // Update classroom
        const updates = {}
        if (name) updates.name = name
        if (capacity) updates.capacity = capacity
        if (grade) updates.grade = grade
        if (section) updates.section = section
        if (academicYear) updates.academicYear = academicYear
        if (resources) updates.resources = resources
        updates.updatedAt = Date.now()
        updates.updatedBy = __role

        const updatedClassroom = await this.oyster.call("update_block", {
            _id: `${this.classroomPrefix}:${id}`,
            ...updates
        })

        return { classroom: updatedClassroom }
    }

    async deleteClassroom({ __role, id, res }) {
        // Get classroom to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Verify if user is school admin for this classroom's school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId: classroom.schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can delete classrooms"
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

    async getClassroom({ __role, id, res }) {
        // Get classroom
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        return { classroom }
    }

    async listSchoolClassrooms({ __role, id, res }) {
        // Get all classrooms for a school
        const classrooms = await this.oyster.call("nav_relation", {
            relation: "_classrooms",
            _id: `school:${id}`,
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

    async addResource({ __role, id, resource, res }) {
        // Get classroom to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Verify if user is school admin for this classroom's school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId: classroom.schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can manage classroom resources"
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
            updatedBy: __role
        })

        return { classroom: updatedClassroom }
    }

    async removeResource({ __role, id, resource, res }) {
        // Get classroom to check school
        const classroom = await this.oyster.call("get_block", `${this.classroomPrefix}:${id}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Verify if user is school admin for this classroom's school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId: classroom.schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can manage classroom resources"
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
            updatedBy: __role
        })

        return { classroom: updatedClassroom }
    }
} 