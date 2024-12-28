const { nanoid } = require("nanoid")

module.exports = class StudentManager {
    constructor({ utils, cache, config, cortex, managers, validators, oyster }) {
        this.utils = utils
        this.config = config
        this.cortex = cortex
        this.validators = validators
        this.oyster = oyster
        this.permissionManager = managers.permission
        this.responseDispatcher = managers.responseDispatcher
        this.studentPrefix = "student"
        this.classroomManager = managers.classroom

        // Exposed HTTP endpoints
        this.httpExposed = [
            "createStudent",
            "updateStudent",
            "deleteStudent",
            "getStudent",
            "listStudents",
            "transferStudent",
            "listClassroomStudents",
            "listSchoolStudents"
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

    async _verifyClassroomBelongsToSchool({ classroomId, schoolId }) {
        const classrooms = await this.oyster.call("nav_relation", {
            relation: "_classrooms",
            _id: `school:${schoolId}`,
            withScores: true,
        })
        return classrooms[`classroom:${classroomId}`] !== undefined
    }

    async createStudent({ 
        __role, 
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
        // Verify if user is school admin for this school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can create students"
            })
            return { selfHandleResponse: true }
        }

        // Verify if classroom belongs to school
        const classroomBelongsToSchool = await this._verifyClassroomBelongsToSchool({ classroomId, schoolId })
        if (!classroomBelongsToSchool) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 400,
                message: "Classroom does not belong to this school"
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

        // Create student
        const studentId = nanoid()
        const student = await this.oyster.call("add_block", {
            _id: `${this.studentPrefix}:${studentId}`,
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
            createdBy: __role
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
                    _students: [`${this.studentPrefix}:${studentId}`]
                }
            }),
            this.oyster.call("update_relations", {
                _id: `school:${schoolId}`,
                add: {
                    _students: [`${this.studentPrefix}:${studentId}`]
                }
            })
        ])

        return { student }
    }

    async updateStudent({ 
        __role, 
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
        // Get student to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found"
            })
            return { selfHandleResponse: true }
        }

        // Verify if user is school admin for this student's school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId: student.schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can update students"
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

        // Update student
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
        updates.updatedBy = __role

        const updatedStudent = await this.oyster.call("update_block", {
            _id: `${this.studentPrefix}:${id}`,
            ...updates
        })

        return { student: updatedStudent }
    }

    async deleteStudent({ __role, id, res }) {
        // Get student to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found"
            })
            return { selfHandleResponse: true }
        }

        // Verify if user is school admin for this student's school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId: student.schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can delete students"
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

    async getStudent({ __role, id, res }) {
        // Get student
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found"
            })
            return { selfHandleResponse: true }
        }

        return { student }
    }

    async listClassroomStudents({ __role, classroomId, res }) {
        // Get all students for a classroom
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

    async listSchoolStudents({ __role, schoolId, res }) {
        // Get all students for a school
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

    async transferStudent({ __role, studentId, newClassroomId, res }) {
        // Get student
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${studentId}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found"
            })
            return { selfHandleResponse: true }
        }

        // Verify if user is school admin for this student's school
        const isSchoolAdmin = await this._verifySchoolAdmin({ userId: __role, schoolId: student.schoolId })
        if (!isSchoolAdmin) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: "Only school admin can transfer students"
            })
            return { selfHandleResponse: true }
        }

        // Verify if new classroom belongs to same school
        const classroomBelongsToSchool = await this._verifyClassroomBelongsToSchool({ 
            classroomId: newClassroomId, 
            schoolId: student.schoolId 
        })
        if (!classroomBelongsToSchool) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 400,
                message: "New classroom does not belong to student's school"
            })
            return { selfHandleResponse: true }
        }

        // Update student's classroom
        const oldClassroomId = student.classroomId
        await this.oyster.call("update_block", {
            _id: `${this.studentPrefix}:${studentId}`,
            classroomId: newClassroomId,
            updatedAt: Date.now(),
            updatedBy: __role
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