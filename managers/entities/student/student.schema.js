module.exports = {
    createStudent: [
        {
            model: "shortText",
            path: "name",
            required: true,
        },
        {
            model: "date",
            path: "dateOfBirth",
            required: true,
        },
        {
            model: "gender",
            path: "gender",
            required: true,
        },
        {
            model: "shortText",
            path: "parentName",
            required: true,
        },
        {
            model: "phone",
            path: "parentPhone",
            required: true,
        },
        {
            model: "email",
            path: "email",
            required: true,
        },
        {
            model: "date",
            path: "enrollmentDate",
            required: true,
        },
        {
            model: "bloodGroup",
            path: "bloodGroup",
            required: true,
        },
        {
            model: "phone",
            path: "emergencyContact",
            required: true,
        },
        {
            model: "arrayOfStrings",
            path: "medicalConditions",
            default: [],
        },
        {
            model: "id",
            path: "classroomId",
            required: true,
        },
        {
            model: "id",
            path: "schoolId",
            required: true,
        },
    ],
    updateStudent: [
        {
            model: "shortText",
            path: "name",
        },
        {
            model: "date",
            path: "dateOfBirth",
        },
        {
            model: "gender",
            path: "gender",
        },
        {
            model: "shortText",
            path: "parentName",
        },
        {
            model: "phone",
            path: "parentPhone",
        },
        {
            model: "email",
            path: "email",
        },
        {
            model: "bloodGroup",
            path: "bloodGroup",
        },
        {
            model: "phone",
            path: "emergencyContact",
        },
        {
            model: "arrayOfStrings",
            path: "medicalConditions",
        },
    ],
    getStudent: [
        {
            model: "id",
            path: "id",
            required: true,
        },
    ],
    deleteStudent: [
        {
            model: "id",
            path: "id",
            required: true,
        },
    ],
    transferStudent: [
        {
            model: "id",
            path: "studentId",
            required: true,
        },
        {
            model: "id",
            path: "newClassroomId",
            required: true,
        },
    ],
} 