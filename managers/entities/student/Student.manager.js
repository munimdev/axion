const { nanoid } = require("nanoid")

/**
 * Manages student-related operations in the school management system.
 * Handles CRUD operations, student transfers, and listing functionalities.
 */
module.exports = class StudentManager {
    /**
     * Initializes the StudentManager with required dependencies
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
        this.studentPrefix = "student"

        // Exposed HTTP endpoints
        this.httpExposed = [
            "createStudent",
            "patch=updateStudent",
            "delete=deleteStudent",
            "get=getStudent",
            "post=transferStudent",
            "get=listClassroomStudents",
            "get=listSchoolStudents",
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
    async _validatePermission({ userId, action, nodeId = "board.school.class.student" }) {
        const user = await this._getUser({ userId })
        if (user.error) return user

        if (!user.role) {
            return { error: "User role not found" }
        }

        const canDoAction = await this.shark.isGranted({
            layer: "board.school.class.student",
            action,
            userId,
            nodeId,
            role: user.role,
        })
        return { error: canDoAction ? undefined : "Permission denied" }
    }

    /**
     * Creates a new student record
     * @param {Object} params - Student creation parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.name - Student's full name
     * @param {string} params.dateOfBirth - Student's date of birth
     * @param {string} params.gender - Student's gender
     * @param {string} params.parentName - Parent/guardian's name
     * @param {string} params.parentPhone - Parent/guardian's contact number
     * @param {string} params.email - Student's email address
     * @param {string} params.enrollmentDate - Date of enrollment
     * @param {string} params.bloodGroup - Student's blood group
     * @param {Object} params.emergencyContact - Emergency contact information
     * @param {Array} [params.medicalConditions] - List of medical conditions
     * @param {string} params.classroomId - Assigned classroom ID
     * @param {string} params.schoolId - School ID
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Created student object or error
     */
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
        res,
    }) {
        const { userId } = __token

        // Permission check
        const canCreateStudent = await this._validatePermission({
            userId,
            action: "create",
        })

        if (canCreateStudent.error) {
            return canCreateStudent
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
            schoolId,
        })
        if (validationResult) return validationResult

        // Create student
        const studentId = nanoid()
        const student = await this.oyster.call("add_block", {
            _id: studentId,
            _label: this.studentPrefix,
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
            createdBy: userId,
        })

        if (student.error) {
            if (student.error.includes("already exists")) {
                this.responseDispatcher.dispatch(res, {
                    code: 409,
                    message: "Student already exists",
                })
                return { selfHandleResponse: true }
            }

            console.error("Failed to create student:", student.error)
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 500,
                message: "Failed to create student",
            })
            return { selfHandleResponse: true }
        }

        // Link student to classroom and school using proper score format
        await Promise.all([
            this.oyster.call("update_relations", {
                _id: `classroom:${classroomId}`,
                add: {
                    _members: [`${student._id}~1`], // Add score of 1 for direct membership
                },
            }),
            this.oyster.call("update_relations", {
                _id: `school:${schoolId}`,
                add: {
                    _members: [`${student._id}~1`], // Add score of 1 for direct membership
                },
            }),
        ])

        return { student }
    }

    /**
     * Updates an existing student's information
     * @param {Object} params - Student update parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Student ID
     * @param {string} [params.name] - Updated full name
     * @param {string} [params.dateOfBirth] - Updated date of birth
     * @param {string} [params.gender] - Updated gender
     * @param {string} [params.parentName] - Updated parent/guardian name
     * @param {string} [params.parentPhone] - Updated parent/guardian contact
     * @param {string} [params.email] - Updated email address
     * @param {string} [params.bloodGroup] - Updated blood group
     * @param {Object} [params.emergencyContact] - Updated emergency contact
     * @param {Array} [params.medicalConditions] - Updated medical conditions
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Updated student object or error
     */
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
        res,
    }) {
        const { userId } = __token

        // Get student first to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateStudent = await this._validatePermission({
            userId,
            action: "update",
        })

        if (canUpdateStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateStudent.error,
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
            medicalConditions,
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
            ...updates,
        })

        return { student: updatedStudent }
    }

    /**
     * Deletes a student record
     * @param {Object} params - Student deletion parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Student ID to delete
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Deletion result
     */
    async deleteStudent({ __token, id, res }) {
        const { userId } = __token

        // Get student first to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canDeleteStudent = await this._validatePermission({
            userId,
            action: "delete",
        })

        if (canDeleteStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canDeleteStudent.error,
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
                    _members: [`${this.studentPrefix}:${id}`],
                },
            }),
            this.oyster.call("update_relations", {
                _id: `school:${student.schoolId}`,
                remove: {
                    _members: [`${this.studentPrefix}:${id}`],
                },
            }),
        ])

        return { message: "Student deleted successfully" }
    }

    /**
     * Retrieves a specific student's information
     * @param {Object} params - Student retrieval parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.id - Student ID to retrieve
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Student information or error
     */
    async getStudent({ __token, id, res }) {
        const { userId } = __token

        // Get student first to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${id}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canReadStudent = await this._validatePermission({
            userId,
            action: "read",
        })

        if (canReadStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadStudent.error,
            })
            return { selfHandleResponse: true }
        }

        return { student }
    }

    /**
     * Lists all students in a specific classroom
     * @param {Object} params - Classroom students listing parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.classroomId - Classroom ID to list students from
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} List of classroom students or error
     */
    async listClassroomStudents({ __token, classroomId, res }) {
        const { userId } = __token

        // Get classroom first to check school
        const classroom = await this.oyster.call("get_block", `classroom:${classroomId}`)
        if (!classroom || this.utils.isEmptyObject(classroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Classroom not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canReadStudents = await this._validatePermission({
            userId,
            action: "read",
        })

        if (canReadStudents.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadStudents.error,
            })
            return { selfHandleResponse: true }
        }

        // Get all students for a classroom using relations
        const students = await this.oyster.call("nav_relation", {
            _id: `classroom:${classroomId}`,
            relation: "_members",
            label: this.studentPrefix, // Specify we want student members
            withScores: true,
        })

        const studentDetails = await Promise.all(
            Object.keys(students).map(async (studentId) => {
                const student = await this.oyster.call("get_block", studentId)
                return student
            })
        )

        return { students: studentDetails.filter((s) => s !== null) }
    }

    /**
     * Lists all students in a specific school
     * @param {Object} params - School students listing parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.schoolId - School ID to list students from
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} List of school students or error
     */
    async listSchoolStudents({ __token, schoolId, res }) {
        const { userId } = __token

        // Permission check
        const canReadStudents = await this._validatePermission({
            userId,
            action: "read",
        })

        if (canReadStudents.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canReadStudents.error,
            })
            return { selfHandleResponse: true }
        }

        // Get all students for a school using relations
        const students = await this.oyster.call("nav_relation", {
            _id: `school:${schoolId}`,
            relation: "_members",
            label: this.studentPrefix, // Specify we want student members
            withScores: true,
        })

        const studentDetails = await Promise.all(
            Object.keys(students).map(async (studentId) => {
                const student = await this.oyster.call("get_block", studentId)
                return student
            })
        )

        return { students: studentDetails.filter((s) => s !== null) }
    }

    /**
     * Transfers a student to a different classroom
     * @param {Object} params - Student transfer parameters
     * @param {Object} params.__token - Authentication token
     * @param {string} params.studentId - ID of the student to transfer
     * @param {string} params.newClassroomId - ID of the destination classroom
     * @param {Object} params.res - Response object
     * @returns {Promise<Object>} Transfer result or error
     */
    async transferStudent({ __token, studentId, newClassroomId, res }) {
        const { userId } = __token

        // Get student first to check school
        const student = await this.oyster.call("get_block", `${this.studentPrefix}:${studentId}`)
        if (!student || this.utils.isEmptyObject(student)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "Student not found",
            })
            return { selfHandleResponse: true }
        }

        // Permission check
        const canUpdateStudent = await this._validatePermission({
            userId,
            action: "update",
        })

        if (canUpdateStudent.error) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                message: canUpdateStudent.error,
            })
            return { selfHandleResponse: true }
        }

        // Get new classroom to verify it exists and belongs to the same school
        const newClassroom = await this.oyster.call("get_block", `classroom:${newClassroomId}`)
        if (!newClassroom || this.utils.isEmptyObject(newClassroom)) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 404,
                message: "New classroom not found",
            })
            return { selfHandleResponse: true }
        }

        if (newClassroom.schoolId !== student.schoolId) {
            this.responseDispatcher.dispatch(res, {
                ok: false,
                code: 400,
                message: "Cannot transfer student to a classroom in a different school",
            })
            return { selfHandleResponse: true }
        }

        // Update student's classroom
        const oldClassroomId = student.classroomId
        await this.oyster.call("update_block", {
            _id: `${student._id}`,
            classroomId: newClassroomId,
            updatedAt: Date.now(),
            updatedBy: userId,
        })

        // Update classroom relations
        await Promise.all([
            // Remove from old classroom
            this.oyster.call("update_relations", {
                _id: `classroom:${oldClassroomId}`,
                remove: {
                    _members: [`${student._id}`],
                },
            }),
            // Add to new classroom
            this.oyster.call("update_relations", {
                _id: `classroom:${newClassroomId}`,
                add: {
                    _members: [`${student._id}~1`],
                },
            }),
        ])

        return { message: "Student transferred successfully" }
    }
}
