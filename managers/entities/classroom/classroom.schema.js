module.exports = {
    createClassroom: [
        {
            model: "className",
            path: "name",
            required: true,
        },
        {
            model: "classCapacity",
            path: "capacity",
            required: true,
        },
        {
            model: "grade",
            path: "grade",
            required: true,
        },
        {
            model: "section",
            path: "section",
            required: true,
        },
        {
            model: "academicYear",
            path: "academicYear",
            required: true,
        },
        {
            model: "resources",
            path: "resources",
            default: [],
        },
        {
            model: "id",
            path: "schoolId",
            required: true,
        },
    ],
    updateClassroom: [
        {
            model: "className",
            path: "name",
        },
        {
            model: "classCapacity",
            path: "capacity",
        },
        {
            model: "grade",
            path: "grade",
        },
        {
            model: "section",
            path: "section",
        },
        {
            model: "academicYear",
            path: "academicYear",
        },
        {
            model: "resources",
            path: "resources",
        },
    ],
    getClassroom: [
        {
            model: "id",
            path: "id",
            required: true,
        },
    ],
    deleteClassroom: [
        {
            model: "id",
            path: "id",
            required: true,
        },
    ],
    addResource: [
        {
            model: "id",
            path: "id",
            required: true,
        },
        {
            model: "text",
            path: "resource",
            required: true,
        },
    ],
    removeResource: [
        {
            model: "id",
            path: "id",
            required: true,
        },
        {
            model: "text",
            path: "resource",
            required: true,
        },
    ],
} 