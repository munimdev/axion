module.exports = {
    createClassroom: [
        {
            model: "shortText",
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
            model: "arrayOfStrings",
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
            model: "id",
            path: "id",
            required: true,
        },
        {
            model: "shortText",
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
            model: "arrayOfStrings",
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
    listClassroomResources: [
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
