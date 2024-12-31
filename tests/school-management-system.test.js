const UserManager = require("../managers/entities/user/User.manager")
const SchoolManager = require("../managers/entities/school/School.manager")
const ClassroomManager = require("../managers/entities/classroom/Classroom.manager")
const StudentManager = require("../managers/entities/student/Student.manager")
const { mockUsers, mockData, setupTestEnvironment } = require("./helpers")

describe("School Management System", () => {
    let testEnv
    let userManager
    let schoolManager
    let classroomManager
    let studentManager

    // Store IDs for cross-reference
    let schoolId
    let classroomId
    let studentId

    beforeEach(async () => {
        testEnv = await setupTestEnvironment()

        // Initialize all managers
        userManager = new UserManager({ ...testEnv })
        schoolManager = new SchoolManager({ ...testEnv })
        classroomManager = new ClassroomManager({ ...testEnv })
        studentManager = new StudentManager({ ...testEnv })
    })

    describe("System Setup and User Management", () => {
        it("should create system users with different roles", async () => {
            // Create superadmin
            const superadminResult = await userManager.createUser(mockUsers.superadmin)
            expect(superadminResult.error).toBeUndefined()
            expect(superadminResult.user.role).toBe("superadmin")

            // Create school admin
            const schoolAdminResult = await userManager.createUser(mockUsers.schoolAdmin)
            expect(schoolAdminResult.error).toBeUndefined()
            expect(schoolAdminResult.user.role).toBe("schoolAdmin")

            // Create teacher
            const teacherResult = await userManager.createUser(mockUsers.teacher)
            expect(teacherResult.error).toBeUndefined()
            expect(teacherResult.user.role).toBe("user")
        })

        it("should handle user authentication", async () => {
            // Create a user first
            await userManager.createUser(mockUsers.superadmin)

            // Test successful login
            const loginResult = await userManager.loginUser({
                email: mockUsers.superadmin.email,
                password: mockUsers.superadmin.password,
            })
            expect(loginResult.error).toBeUndefined()
            expect(loginResult.longToken).toBeDefined()

            // Test failed login
            const failedLogin = await userManager.loginUser({
                email: mockUsers.superadmin.email,
                password: "wrongpassword",
            })
            expect(failedLogin.selfHandleResponse).toBe(true)
        })
    })

    describe("School Management", () => {
        it("should create and manage a school", async () => {
            // Create school
            const schoolResult = await schoolManager.createSchool({
                ...mockData.school,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            expect(schoolResult.error).toBeUndefined()
            expect(schoolResult.school).toBeDefined()
            schoolId = schoolResult.school._id.split(":")[1]

            // Update school
            const updateResult = await schoolManager.updateSchool({
                id: schoolId,
                name: "Updated School Name",
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            expect(updateResult.error).toBeUndefined()
            expect(updateResult.school.name).toBe("Updated School Name")

            // Assign school admin
            const assignResult = await schoolManager.assignSchoolAdmin({
                schoolId,
                adminUserId: mockUsers.schoolAdmin._id.split(":")[1],
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            expect(assignResult.error).toBeUndefined()
            expect(assignResult.message).toBe("School admin assigned successfully")
        })

        it("should enforce school access permissions", async () => {
            // Create school as superadmin
            const schoolResult = await schoolManager.createSchool({
                ...mockData.school,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            schoolId = schoolResult.school._id.split(":")[1]

            // Try to create school as school admin (should fail)
            const unauthorizedCreate = await schoolManager.createSchool({
                ...mockData.school,
                email: "another@school.com",
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(unauthorizedCreate.error).toBe("Permission denied")

            // School admin should not be able to view school details without being assigned
            const viewResultWithoutPermission = await schoolManager.getSchool({
                id: schoolId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(viewResultWithoutPermission.error).toBe("Permission denied")

            // Create another school
            const anotherSchoolResult = await schoolManager.createSchool({
                ...mockData.school,
                email: "another@school.com",
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            const anotherSchoolId = anotherSchoolResult.school._id.split(":")[1]

            // Assign admin to first school only
            await schoolManager.assignSchoolAdmin({
                schoolId,
                adminUserId: mockUsers.schoolAdmin._id.split(":")[1],
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })

            // School admin should now be able to view assigned school
            const viewResultWithPermission = await schoolManager.getSchool({
                id: schoolId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(viewResultWithPermission.error).toBeUndefined()
            expect(viewResultWithPermission.school).toBeDefined()

            // School admin should still not be able to view unassigned school
            const viewUnassignedSchool = await schoolManager.getSchool({
                id: anotherSchoolId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(viewUnassignedSchool.error).toBe("Permission denied")
        })
    })

    describe("Classroom Management", () => {
        beforeAll(async () => {
            const schoolResult = await schoolManager.createSchool({
                ...mockData.school,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            schoolId = schoolResult.school._id.split(":")[1]
        })

        it("should create and manage classrooms", async () => {
            // Create classroom
            const classroomResult = await classroomManager.createClassroom({
                ...mockData.classroom,
                schoolId,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            expect(classroomResult.error).toBeUndefined()
            expect(classroomResult.classroom).toBeDefined()
            classroomId = classroomResult.classroom._id.split(":")[1]

            // Update classroom
            const updateResult = await classroomManager.updateClassroom({
                id: classroomId,
                capacity: 25,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(updateResult.error).toBeUndefined()

            // Add resource
            const resourceResult = await classroomManager.addResource({
                id: classroomId,
                resource: "Smart Board",
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(resourceResult.error).toBeUndefined()
            expect(resourceResult.classroom.resources).toContain("Smart Board")
        })

        it("should manage student assignments to classrooms", async () => {
            // Create a student first
            const studentResult = await studentManager.createStudent({
                ...mockData.student,
                schoolId,
                classroomId: null, // Initially no classroom
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(studentResult.error).toBeUndefined()
            const studentId = studentResult.student._id.split(":")[1]

            // Add student to classroom
            const addStudentResult = await classroomManager.addStudent({
                id: classroomId,
                studentId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(addStudentResult.error).toBeUndefined()
            expect(addStudentResult.message).toBe("Student added to classroom successfully")

            // Verify student is in classroom
            const students = await studentManager.listClassroomStudents({
                classroomId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(students.students.length).toBe(1)
            expect(students.students[0]._id).toBe(`student:${studentId}`)

            // Try to add student to another classroom (should fail)
            const anotherClassroomResult = await classroomManager.createClassroom({
                ...mockData.classroom,
                name: "Another Classroom",
                schoolId,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            const anotherClassroomId = anotherClassroomResult.classroom._id.split(":")[1]

            const addToAnotherResult = await classroomManager.addStudent({
                id: anotherClassroomId,
                studentId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(addToAnotherResult.selfHandleResponse).toBe(true)

            // Remove student from classroom
            const removeStudentResult = await classroomManager.removeStudent({
                id: classroomId,
                studentId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(removeStudentResult.error).toBeUndefined()
            expect(removeStudentResult.message).toBe("Student removed from classroom successfully")

            // Verify student is removed
            const updatedStudents = await studentManager.listClassroomStudents({
                classroomId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(updatedStudents.students.length).toBe(0)

            // Now student can be added to another classroom
            const addAfterRemovalResult = await classroomManager.addStudent({
                id: anotherClassroomId,
                studentId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(addAfterRemovalResult.error).toBeUndefined()
            expect(addAfterRemovalResult.message).toBe("Student added to classroom successfully")
        })

        it("should enforce classroom deletion constraints", async () => {
            // Create a new classroom
            const classroomResult = await classroomManager.createClassroom({
                ...mockData.classroom,
                name: "Test Deletion Classroom",
                schoolId,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            const testClassroomId = classroomResult.classroom._id.split(":")[1]

            // Create and add a student
            const studentResult = await studentManager.createStudent({
                ...mockData.student,
                email: "test.deletion@school.com",
                schoolId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            const testStudentId = studentResult.student._id.split(":")[1]

            await classroomManager.addStudent({
                id: testClassroomId,
                studentId: testStudentId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })

            // Try to delete classroom with student (should fail)
            const deleteWithStudentResult = await classroomManager.deleteClassroom({
                id: testClassroomId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(deleteWithStudentResult.error).toBe("Cannot delete classroom with existing students")

            // Remove student first
            await classroomManager.removeStudent({
                id: testClassroomId,
                studentId: testStudentId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })

            // Now deletion should succeed
            const deleteResult = await classroomManager.deleteClassroom({
                id: testClassroomId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(deleteResult.error).toBeUndefined()
            expect(deleteResult.message).toBe("Classroom deleted successfully")
        })
    })

    describe("Student Management", () => {
        beforeEach(async () => {
            // Setup complete school structure
            const schoolResult = await schoolManager.createSchool({
                ...mockData.school,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            schoolId = schoolResult.school._id.split(":")[1]

            await schoolManager.assignSchoolAdmin({
                schoolId,
                adminUserId: mockUsers.schoolAdmin._id.split(":")[1],
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })

            const classroomResult = await classroomManager.createClassroom({
                ...mockData.classroom,
                schoolId,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            classroomId = classroomResult.classroom._id.split(":")[1]
        })

        it("should manage student lifecycle", async () => {
            // Create student
            const studentResult = await studentManager.createStudent({
                ...mockData.student,
                classroomId,
                schoolId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(studentResult.error).toBeUndefined()
            expect(studentResult.student).toBeDefined()
            studentId = studentResult.student._id.split(":")[1]

            // Update student
            const updateResult = await studentManager.updateStudent({
                id: studentId,
                name: "Updated Student Name",
                bloodGroup: "B+",
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(updateResult.error).toBeUndefined()
            expect(updateResult.student.name).toBe("Updated Student Name")

            // Create another classroom for transfer
            const newClassroomResult = await classroomManager.createClassroom({
                ...mockData.classroom,
                name: "New Classroom",
                schoolId,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            const newClassroomId = newClassroomResult.classroom._id.split(":")[1]

            // Transfer student
            const transferResult = await studentManager.transferStudent({
                studentId,
                newClassroomId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(transferResult.error).toBeUndefined()
            expect(transferResult.message).toBe("Student transferred successfully")
        })

        it("should manage student listings", async () => {
            // Create multiple students
            for (let i = 0; i < 3; i++) {
                await studentManager.createStudent({
                    ...mockData.student,
                    email: `student${i}@test.com`,
                    classroomId,
                    schoolId,
                    __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
                })
            }

            // List classroom students
            const classroomStudents = await studentManager.listClassroomStudents({
                classroomId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(classroomStudents.error).toBeUndefined()
            expect(classroomStudents.students.length).toBe(3)

            // List school students
            const schoolStudents = await studentManager.listSchoolStudents({
                schoolId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(schoolStudents.error).toBeUndefined()
            expect(schoolStudents.students.length).toBe(3)
        })
    })

    describe("System-wide Access Control", () => {
        beforeEach(async () => {
            // Setup complete system
            await userManager.createUser(mockUsers.superadmin)
            await userManager.createUser(mockUsers.schoolAdmin)
            await userManager.createUser(mockUsers.teacher)

            const schoolResult = await schoolManager.createSchool({
                ...mockData.school,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            schoolId = schoolResult.school._id.split(":")[1]

            const classroomResult = await classroomManager.createClassroom({
                ...mockData.classroom,
                schoolId,
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            classroomId = classroomResult.classroom._id.split(":")[1]
        })

        it("should enforce role-based permissions across the system", async () => {
            // Test superadmin privileges
            const superadminSchoolCreate = await schoolManager.createSchool({
                ...mockData.school,
                email: "another@school.com",
                __token: { userId: mockUsers.superadmin._id.split(":")[1] },
            })
            expect(superadminSchoolCreate.error).toBeUndefined()

            // Test school admin privileges
            const schoolAdminClassroomCreate = await classroomManager.createClassroom({
                ...mockData.classroom,
                name: "Another Classroom",
                schoolId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(schoolAdminClassroomCreate.error).toBeUndefined()

            // Test teacher restrictions
            const teacherSchoolCreate = await schoolManager.createSchool({
                ...mockData.school,
                email: "teacher@school.com",
                __token: { userId: mockUsers.teacher._id.split(":")[1] },
            })
            expect(teacherSchoolCreate.error).toBe("Permission denied")
        })

        it("should maintain data integrity across operations", async () => {
            // Create a student
            const studentResult = await studentManager.createStudent({
                ...mockData.student,
                classroomId,
                schoolId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            studentId = studentResult.student._id.split(":")[1]

            // Delete classroom (should fail due to existing students)
            const deleteClassroomResult = await classroomManager.deleteClassroom({
                id: classroomId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(deleteClassroomResult.error).toBeDefined()

            // Delete student first
            await studentManager.deleteStudent({
                id: studentId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })

            // Now classroom deletion should succeed
            const secondDeleteAttempt = await classroomManager.deleteClassroom({
                id: classroomId,
                __token: { userId: mockUsers.schoolAdmin._id.split(":")[1] },
            })
            expect(secondDeleteAttempt.error).toBeUndefined()
        })
    })
})
