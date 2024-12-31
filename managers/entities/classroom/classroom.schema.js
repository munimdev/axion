module.exports = {
    createClassroom: [
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
            type: "String",
            path: "schoolId",
            required: true,
        },
    ],
    updateClassroom: [
        {
            type: "String",
            path: "id",
            required: true,
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
            type: "String",
            path: "id",
            required: true,
        },
    ],
    deleteClassroom: [
        {
            type: "String",
            path: "id",
            required: true,
        },
    ],
    listClassroomResources: [
        {
            type: "String",
            path: "id",
            required: true,
        },
    ],
    addResource: [
        {
            type: "String",
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
            type: "String",
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
