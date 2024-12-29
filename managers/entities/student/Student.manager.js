const { nanoid } = require("nanoid")

module.exports = class StudentManager {
    constructor({ utils, cache, config, cortex, managers, validators, oyster }) {
        this.utils = utils
        this.config = config
        this.cortex = cortex
        this.validators = validators
        this.oyster = oyster
        this.shark = managers.shark
        this.responseDispatcher = managers.responseDispatcher
        this.studentPrefix = "student"

        // Exposed HTTP endpoints
        this.httpExposed = [
            "createStudent",
            "patch=updateStudent",
            "delete=deleteStudent",
            "get=getStudent",
            "get=listStudents",
            "post=transferStudent",
            "get=listClassroomStudents",
            "get=listSchoolStudents"
        ]
    }

    async _getUser({ userId }) {
        const user = await this.oyster.call("get_block", `user:${userId}`)
        if (!user || this.utils.isEmptyObject(user)) {
            return { error: "Invalid Token" }
        }
        return user
    }

    async _validatePermission({ userId, action, nodeId = "board.student" }) {
        const user = await this._getUser({ userId })
        if (user.error) return user

        if (!user.role) {
            return { error: "User role not found" }
        }

        const canDoAction = await this.shark.isGranted({
            layer: "board.student",
            action,
            userId,
            nodeId,
            role: user.role,
        })
        return { error: canDoAction ? undefined : "Permission denied" }
    }

    async createStudent({ 
        __token, 
        name, 
        dateOfBirth, 
        gender, 
        parentName, 
        parentPhone, 
        email,
        enrollmentDate,
        bloodGroup,
        emergencyContact,
        medicalConditions,
        classroomId,
        schoolId,
        res 
    }) {
        const { userId } = __token

        // Permission check
        const canCreateStudent = await this._validatePermission({
            userId,
            action: "create",
            nodeId: `board.school.${schoolId}.student`
        })

        if (canCreateStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canCreateStudent.error
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.student.createStudent({
            name,
            dateOfBirth,
            gender,
            parentName,
            parentPhone,
            email,
            enrollmentDate,
            bloodGroup,
            emergencyContact,
            medicalConditions,
            classroomId,
            schoolId
        })
        if (validationResult) return validationResult

        // Check if student exists
        const existingStudent = await this.oyster.call("get_block", `${this.studentPrefix}:${email}`)
        if (existingStudent && !this.utils.isEmptyObject(existingStudent)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 409,
                message: "Student already exists with this email"
            })
            return { selfHandleResponse: true }
        }

        // Create student
        const studentId = nanoid()
        const student = await this.oyster.call("add_block", {
            _id: `${this.studentPrefix}:${email}`,
            _label: this.studentPrefix,
            studentId,
            name,
            dateOfBirth,
            gender,
            parentName,
            parentPhone,
            email,
            enrollmentDate,
            bloodGroup,
            emergencyContact,
            medicalConditions: medicalConditions || [],
            classroomId,
            schoolId,
            createdAt: Date.now(),
            createdBy: userId
        })

        if (student.error) {
            console.error("Failed to create student:", student.error)
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 500,
                message: "Failed to create student"
            })
            return { selfHandleResponse: true }
        }

        // Link student to classroom and school
        await Promise.all([
            this.oyster.call("update_relations", {
                _id: `classroom:${classroomId}`,
                add: {
                    _students: [`${this.studentPrefix}:${email}`]
                }
            }),
            this.oyster.call("update_relations", {
                _id: `school:${schoolId}`,
                add: {
                    _students: [`${this.studentPrefix}:${email}`]
                }
            })
        ])

        return { student }
    }

    async updateStudent({ 
        __token, 
        id, 
        name,
        dateOfBirth,
        gender,
        parentName,
        parentPhone,
        email,
        bloodGroup,
        emergencyContact,
        medicalConditions,
        res 
    }) {
        const { userId } = __token

        // Get student first to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateStudent = await this._validatePermission({
            userId,
            action: "update",
            nodeId: `board.school.${student.schoolId}.student.${id}`
        })

        if (canUpdateStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateStudent.error
            })
            return { selfHandleResponse: true }
        }

        // Validate input
        const validationResult = await this.validators.student.updateStudent({
            name,
            dateOfBirth,
            gender,
            parentName,
            parentPhone,
            email,
            bloodGroup,
            emergencyContact,
            medicalConditions
        })
        if (validationResult) return validationResult

        // Update student fields
        const updates = {}
        if (name) updates.name = name
        if (dateOfBirth) updates.dateOfBirth = dateOfBirth
        if (gender) updates.gender = gender
        if (parentName) updates.parentName = parentName
        if (parentPhone) updates.parentPhone = parentPhone
        if (email) updates.email = email
        if (bloodGroup) updates.bloodGroup = bloodGroup
        if (emergencyContact) updates.emergencyContact = emergencyContact
        if (medicalConditions) updates.medicalConditions = medicalConditions
        updates.updatedAt = Date.now()
        updates.updatedBy = userId

        const updatedStudent = await this.oyster.call("update_block", {
            _id: `${this.studentPrefix}:${id}`,
            ...updates
        })

        return { student: updatedStudent }
    }

    async deleteStudent({ __token, id, res }) {
        const { userId } = __token

        // Get student first to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canDeleteStudent = await this._validatePermission({
            userId,
            action: "delete",
            nodeId: `board.school.${student.schoolId}.student.${id}`
        })

        if (canDeleteStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canDeleteStudent.error
            })
            return { selfHandleResponse: true }
        }

        // Delete student
        await this.oyster.call("delete_block", `${this.studentPrefix}:${id}`)

        // Remove student from classroom and school relations
        await Promise.all([
            this.oyster.call("update_relations", {
                _id: `classroom:${student.classroomId}`,
                remove: {
                    _students: [`${this.studentPrefix}:${id}`]
                }
            }),
            this.oyster.call("update_relations", {
                _id: `school:${student.schoolId}`,
                remove: {
                    _students: [`${this.studentPrefix}:${id}`]
                }
            })
        ])

        return { message: "Student deleted successfully" }
    }

    async getStudent({ __token, id, res }) {
        const { userId } = __token

        // Get student first to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canReadStudent = await this._validatePermission({
            userId,
            action: "read",
            nodeId: `board.school.${student.schoolId}.student.${id}`
        })

        if (canReadStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadStudent.error
            })
            return { selfHandleResponse: true }
        }

        return { student }
    }

    async listStudents({ __token, schoolId, res }) {
        const { userId } = __token

        // Permission check
        const canReadStudents = await this._validatePermission({
            userId,
            action: "read",
            nodeId: `board.school.${schoolId}.student`
        })

        if (canReadStudents.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadStudents.error
            })
            return { selfHandleResponse: true }
        }

        const students = await this.oyster.call("get_blocks", {
            _label: this.studentPrefix,
            filter: {
                schoolId
            }
        })

        return { students }
    }

    async listClassroomStudents({ __token, classroomId, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `classroom:${classroomId}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canReadStudents = await this._validatePermission({
            userId,
            action: "read",
            nodeId: `board.school.${classroom.schoolId}.classroom.${classroomId}.student`
        })

        if (canReadStudents.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadStudents.error
            })
            return { selfHandleResponse: true }
        }

        // Get all students for a classroom using relations
        const students = await this.oyster.call("nav_relation", {
            relation: "_students",
            _id: `classroom:${classroomId}`,
            withScores: true
        })

        const studentDetails = await Promise.all(
            Object.keys(students).map(async (studentId) => {
                const student = await this.oyster.call("get_block", studentId)
                return student
            })
        )

        return { students: studentDetails.filter(s => s !== null) }
    }

    async listSchoolStudents({ __token, schoolId, res }) {
        const { userId } = __token

        // Permission check
        const canReadStudents = await this._validatePermission({
            userId,
            action: "read",
            nodeId: `board.school.${schoolId}.student`
        })

        if (canReadStudents.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadStudents.error
            })
            return { selfHandleResponse: true }
        }

        // Get all students for a school using relations
        const students = await this.oyster.call("nav_relation", {
            relation: "_students",
            _id: `school:${schoolId}`,
            withScores: true
        })

        const studentDetails = await Promise.all(
            Object.keys(students).map(async (studentId) => {
                const student = await this.oyster.call("get_block", studentId)
                return student
            })
        )

        return { students: studentDetails.filter(s => s !== null) }
    }

    async transferStudent({ __token, studentId, newClassroomId, res }) {
        const { userId } = __token

        // Get student first to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${studentId}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found"
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateStudent = await this._validatePermission({
            userId,
            action: "update",
            nodeId: `board.school.${student.schoolId}.student.${studentId}`
        })

        if (canUpdateStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateStudent.error
            })
            return { selfHandleResponse: true }
        }

        // Get new classroom to verify it exists and belongs to the same school
        const newClassroom = await this.oyster.call("get_block", `classroom:${newClassroomId}`)
        if (!newClassroom || this.utils.isEmptyObject(newClassroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "New classroom not found"
            })
            return { selfHandleResponse: true }
        }

        if (newClassroom.schoolId !== student.schoolId) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 400,
                message: "Cannot transfer student to a classroom in a different school"
            })
            return { selfHandleResponse: true }
        }

        // Update student's classroom
        const oldClassroomId = student.classroomId
        await this.oyster.call("update_block", {
            _id: `${this.studentPrefix}:${studentId}`,
            classroomId: newClassroomId,
            updatedAt: Date.now(),
            updatedBy: userId
        })

        // Update classroom relations
        await Promise.all([
            // Remove from old classroom
            this.oyster.call("update_relations", {
                _id: `classroom:${oldClassroomId}`,
                remove: {
                    _students: [`${this.studentPrefix}:${studentId}`]
                }
            }),
            // Add to new classroom
            this.oyster.call("update_relations", {
                _id: `classroom:${newClassroomId}`,
                add: {
                    _students: [`${this.studentPrefix}:${studentId}`]
                }
            })
        ])

        return { message: "Student transferred successfully" }
    }
} 